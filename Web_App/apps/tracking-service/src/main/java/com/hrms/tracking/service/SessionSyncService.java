package com.hrms.tracking.service;

import com.hrms.tracking.dto.*;
import com.hrms.tracking.entity.Checkpoint;
import com.hrms.tracking.entity.RoutePoint;
import com.hrms.tracking.entity.TrackingSession;
import com.hrms.tracking.repository.CheckpointRepository;
import com.hrms.tracking.repository.RoutePointRepository;
import com.hrms.tracking.repository.TrackingSessionRepository;
import com.hrms.tracking.security.AuthenticatedEmployee;
import com.hrms.tracking.util.GeofenceUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SessionSyncService {

    private final TrackingSessionRepository sessionRepository;
    private final RoutePointRepository routePointRepository;
    private final CheckpointRepository checkpointRepository;

    private static final ZoneId IST_ZONE = ZoneId.of("Asia/Kolkata");

    // Standard HQ Office coordinates (Bangalore Superbee)
    private static final double DEFAULT_OFFICE_LAT = 13.04983;
    private static final double DEFAULT_OFFICE_LON = 77.62024;
    private static final double DEFAULT_OFFICE_RADIUS = 50.0;

    /**
     * Synchronize completed or incremental batch session data from client app
     */
    @Transactional
    public SessionSyncResponse syncSession(SessionSyncRequest request, AuthenticatedEmployee employee) {
        log.info("Processing session sync: id={}, points={}, checkpoints={}, employee={}",
                request.getId(),
                request.getRoutePoints() != null ? request.getRoutePoints().size() : 0,
                request.getCheckpoints() != null ? request.getCheckpoints().size() : 0,
                employee.getUsername());

        LocalDateTime startTime = toLocalDateTime(request.getStartTime());
        LocalDateTime endTime = request.getEndTime() != null ? toLocalDateTime(request.getEndTime()) : null;
        boolean isOfficeHours = GeofenceUtil.isWithinOfficeHours(request.getStartTime());

        // 1. Fetch or create TrackingSession
        TrackingSession session = sessionRepository.findById(request.getId())
                .orElseGet(() -> TrackingSession.builder()
                        .id(request.getId())
                        .userId(employee.getUserId())
                        .employeeId(request.getEmployeeId() != null ? request.getEmployeeId() : employee.getEmployeeId())
                        .companyId(employee.getCompanyId())
                        .startTime(startTime)
                        .createdAt(LocalDateTime.now())
                        .build());

        session.setEndTime(endTime);
        session.setDistanceKm(request.getDistanceKm() != null ? request.getDistanceKm() : 0.0);
        session.setAreaName(request.getAreaName() != null ? request.getAreaName() : "Field Duty Operations");
        session.setState(request.getState() != null ? request.getState() : "Active");
        session.setIsOfficeHours(isOfficeHours);
        session.setUpdatedAt(LocalDateTime.now());

        final TrackingSession savedSession = sessionRepository.save(session);

        // 2. Wipe previous route points and checkpoints for clean idempotent sync
        routePointRepository.deleteBySessionId(savedSession.getId());
        checkpointRepository.deleteBySessionId(savedSession.getId());

        // 3. Persist route points
        int pointsCount = 0;
        if (request.getRoutePoints() != null && !request.getRoutePoints().isEmpty()) {
            List<RoutePoint> routePoints = request.getRoutePoints().stream().map(pt -> RoutePoint.builder()
                    .id(UUID.randomUUID().toString())
                    .session(savedSession)
                    .latitude(pt.getLat())
                    .longitude(pt.getLng())
                    .altitude(pt.getAlt())
                    .speed(pt.getSpeed())
                    .accuracy(pt.getAccuracy())
                    .timestamp(pt.getTs() != null ? toLocalDateTime(pt.getTs()) : LocalDateTime.now())
                    .build()).collect(Collectors.toList());

            routePointRepository.saveAll(routePoints);
            pointsCount = routePoints.size();
        }

        // 4. Persist checkpoints / stationary stops
        int checkpointsCount = 0;
        if (request.getCheckpoints() != null && !request.getCheckpoints().isEmpty()) {
            final List<Checkpoint> checkpoints = new ArrayList<>();
            for (int i = 0; i < request.getCheckpoints().size(); i++) {
                CheckpointDto cp = request.getCheckpoints().get(i);
                checkpoints.add(Checkpoint.builder()
                        .id(cp.getId() != null ? cp.getId() : UUID.randomUUID().toString())
                        .session(savedSession)
                        .latitude(cp.getLat())
                        .longitude(cp.getLng())
                        .arrivedAt(cp.getArrivedAt() != null ? toLocalDateTime(cp.getArrivedAt()) : LocalDateTime.now())
                        .departedAt(cp.getDepartedAt() != null ? toLocalDateTime(cp.getDepartedAt()) : null)
                        .pointIndex(cp.getIndex() != null ? cp.getIndex() : i + 1)
                        .notes(cp.getNotes() != null ? cp.getNotes() : "Milestone Stop #" + (i + 1))
                        .build());
            }

            checkpointRepository.saveAll(checkpoints);
            checkpointsCount = checkpoints.size();
        }

        return SessionSyncResponse.builder()
                .success(true)
                .sessionId(savedSession.getId())
                .distanceKm(savedSession.getDistanceKm())
                .isOfficeHours(isOfficeHours)
                .routePointsCount(pointsCount)
                .checkpointsCount(checkpointsCount)
                .message("Session successfully synchronized with HR persistent route storage")
                .build();
    }

    /**
     * Process real-time location ping with office hours and 50m geofence validation
     */
    public LivePingResponse handleLivePing(LivePingRequest request, AuthenticatedEmployee employee) {
        boolean isOfficeHours = GeofenceUtil.isWithinOfficeHours();
        double distanceToOffice = GeofenceUtil.calculateHaversineDistance(
                request.getLatitude(),
                request.getLongitude(),
                DEFAULT_OFFICE_LAT,
                DEFAULT_OFFICE_LON
        );
        boolean isWithinGeofence = distanceToOffice <= DEFAULT_OFFICE_RADIUS;

        Map<String, Object> meta = new HashMap<>();
        meta.put("employeeName", employee.getUsername());
        meta.put("isWithinOfficeHours", isOfficeHours);
        meta.put("isWithinGeofence", isWithinGeofence);
        meta.put("distanceToOfficeMeters", Math.round(distanceToOffice * 100.0) / 100.0);
        meta.put("officeName", "Superbee Aeronautics HQ");

        return LivePingResponse.builder()
                .success(true)
                .meta(meta)
                .message("Live location ping accepted")
                .build();
    }

    /**
     * Get all tracking sessions for the authenticated employee or all if HR/Super Admin
     */
    @Transactional(readOnly = true)
    public List<SessionDetailDto> getSessions(AuthenticatedEmployee employee, String queryUserId) {
        boolean isHrAdmin = employee.getRoles() != null && employee.getRoles().stream()
                .anyMatch(r -> r.equalsIgnoreCase("HR_ADMIN") || r.equalsIgnoreCase("SUPER_ADMIN"));

        List<TrackingSession> sessions;
        if (isHrAdmin && queryUserId == null) {
            sessions = employee.getCompanyId() != null
                    ? sessionRepository.findByCompanyIdOrderByStartTimeDesc(employee.getCompanyId())
                    : sessionRepository.findAll();
        } else {
            String targetUserId = (isHrAdmin && queryUserId != null) ? queryUserId : employee.getUserId();
            sessions = sessionRepository.findByUserIdOrderByStartTimeDesc(targetUserId);
        }

        return sessions.stream().map(this::toDetailDto).collect(Collectors.toList());
    }

    /**
     * Get single tracking session with all route points and milestone checkpoints
     */
    @Transactional(readOnly = true)
    public Optional<SessionDetailDto> getSessionById(String sessionId, AuthenticatedEmployee employee) {
        Optional<TrackingSession> opt = sessionRepository.findById(sessionId);
        if (opt.isEmpty()) return Optional.empty();

        TrackingSession session = opt.get();

        // Security check: Employee can only read their own sessions unless HR Admin
        boolean isHrAdmin = employee.getRoles() != null && employee.getRoles().stream()
                .anyMatch(r -> r.equalsIgnoreCase("HR_ADMIN") || r.equalsIgnoreCase("SUPER_ADMIN"));

        if (!isHrAdmin && !session.getUserId().equals(employee.getUserId())) {
            return Optional.empty();
        }

        List<RoutePoint> points = routePointRepository.findBySessionIdOrderByTimestampAsc(sessionId);
        List<Checkpoint> checkpoints = checkpointRepository.findBySessionIdOrderByPointIndexAsc(sessionId);

        SessionDetailDto dto = toDetailDto(session);
        dto.setRoutePoints(points.stream().map(p -> RoutePointDto.builder()
                .lat(p.getLatitude())
                .lng(p.getLongitude())
                .alt(p.getAltitude())
                .speed(p.getSpeed())
                .accuracy(p.getAccuracy())
                .ts(toEpochMilli(p.getTimestamp()))
                .build()).collect(Collectors.toList()));

        dto.setCheckpoints(checkpoints.stream().map(c -> CheckpointDto.builder()
                .id(c.getId())
                .lat(c.getLatitude())
                .lng(c.getLongitude())
                .arrivedAt(toEpochMilli(c.getArrivedAt()))
                .departedAt(c.getDepartedAt() != null ? toEpochMilli(c.getDepartedAt()) : null)
                .index(c.getPointIndex())
                .notes(c.getNotes())
                .build()).collect(Collectors.toList()));

        return Optional.of(dto);
    }

    private SessionDetailDto toDetailDto(TrackingSession session) {
        return SessionDetailDto.builder()
                .id(session.getId())
                .userId(session.getUserId())
                .employeeId(session.getEmployeeId())
                .companyId(session.getCompanyId())
                .startTime(session.getStartTime())
                .endTime(session.getEndTime())
                .distanceKm(session.getDistanceKm())
                .areaName(session.getAreaName())
                .state(session.getState())
                .isOfficeHours(session.getIsOfficeHours())
                .routePointsCount(session.getRoutePoints() != null ? session.getRoutePoints().size() : 0)
                .checkpointsCount(session.getCheckpoints() != null ? session.getCheckpoints().size() : 0)
                .build();
    }

    private LocalDateTime toLocalDateTime(Long epochMilli) {
        if (epochMilli == null) return LocalDateTime.now();
        return LocalDateTime.ofInstant(Instant.ofEpochMilli(epochMilli), IST_ZONE);
    }

    private Long toEpochMilli(LocalDateTime dt) {
        if (dt == null) return null;
        return dt.atZone(IST_ZONE).toInstant().toEpochMilli();
    }
}
