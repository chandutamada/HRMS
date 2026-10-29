package com.hrms.tracking.service;

import com.hrms.tracking.dto.EmployeeLiveDto;
import com.hrms.tracking.dto.LiveTelemetryPacket;
import com.hrms.tracking.dto.TimelineResponseDto;
import com.hrms.tracking.entity.RoutePoint;
import com.hrms.tracking.entity.TimelineStop;
import com.hrms.tracking.entity.TrackingSession;
import com.hrms.tracking.repository.RoutePointRepository;
import com.hrms.tracking.repository.TimelineStopRepository;
import com.hrms.tracking.repository.TrackingSessionRepository;
import com.hrms.tracking.util.GeofenceUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TimelineService {

    private final TrackingSessionRepository sessionRepository;
    private final RoutePointRepository routePointRepository;
    private final TimelineStopRepository timelineStopRepository;
    private final ReverseGeocodingService geocodingService;
    private final AsyncTrackingBatchService batchService;

    private static final ZoneId IST_ZONE = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("hh:mm a");

    @Transactional
    public TimelineResponseDto getTimeline(String userId, String dateStr) {
        LocalDate targetDate = (dateStr != null && !dateStr.trim().isEmpty())
                ? LocalDate.parse(dateStr, DATE_FMT)
                : LocalDate.now(IST_ZONE);

        LocalDateTime startOfDay = targetDate.atStartOfDay();
        LocalDateTime endOfDay = targetDate.atTime(LocalTime.MAX);

        // 1. Fetch recorded route points for this user on target date
        List<RoutePoint> routePoints = routePointRepository
                .findByUserIdAndTimestampBetweenOrderByTimestampAsc(userId, startOfDay, endOfDay);

        // If no points directly by userId, also check via TrackingSessions
        if (routePoints.isEmpty()) {
            List<TrackingSession> sessions = sessionRepository
                    .findByUserIdAndStartTimeBetweenOrderByStartTimeAsc(userId, startOfDay, endOfDay);
            if (!sessions.isEmpty()) {
                List<String> sids = sessions.stream().map(TrackingSession::getId).collect(Collectors.toList());
                routePoints = routePointRepository.findBySessionIdInOrderByTimestampAsc(sids);
            }
        }

        // 2. Fetch recorded stops
        List<TimelineStop> recordedStops = timelineStopRepository
                .findByUserIdAndArrivalTimeBetweenOrderByArrivalTimeAsc(userId, startOfDay, endOfDay);

        // If no stops recorded yet but route points exist, detect stops algorithmically (stationary <20m for >= 3 mins)
        if (recordedStops.isEmpty() && !routePoints.isEmpty()) {
            recordedStops = detectStopsFromRoutePoints(userId, routePoints);
        }

        // 3. Reverse geocode any stops missing addresses (rate-limited and cached)
        for (TimelineStop stop : recordedStops) {
            if (stop.getStreetAddress() == null || stop.getStreetAddress().isEmpty()) {
                ReverseGeocodingService.GeocodedAddress geocoded =
                        geocodingService.resolveAddress(stop.getLatitude(), stop.getLongitude());
                stop.setPlaceName(geocoded.getPlaceName());
                stop.setStreetAddress(geocoded.getStreetAddress());
                timelineStopRepository.save(stop);
            }
        }

        // 4. Build Route Polyline & Point DTOs
        List<List<Double>> polyline = new ArrayList<>();
        List<TimelineResponseDto.RoutePointDetailDto> pointDtos = new ArrayList<>();
        double calculatedDistanceKm = 0.0;
        RoutePoint prevPoint = null;

        for (RoutePoint pt : routePoints) {
            polyline.add(List.of(pt.getLatitude(), pt.getLongitude()));
            pointDtos.add(TimelineResponseDto.RoutePointDetailDto.builder()
                    .pointId(pt.getId())
                    .sessionId(pt.getSession() != null ? pt.getSession().getId() : null)
                    .latitude(pt.getLatitude())
                    .longitude(pt.getLongitude())
                    .speed(pt.getSpeed())
                    .heading(pt.getHeading())
                    .accuracy(pt.getAccuracy())
                    .recordedAt(pt.getTimestamp().format(DateTimeFormatter.ISO_DATE_TIME))
                    .build());

            if (prevPoint != null) {
                double distMeters = GeofenceUtil.calculateHaversineDistance(
                        prevPoint.getLatitude(), prevPoint.getLongitude(),
                        pt.getLatitude(), pt.getLongitude()
                );
                if (distMeters >= 3.0) {
                    calculatedDistanceKm += (distMeters / 1000.0);
                }
            }
            prevPoint = pt;
        }

        // 5. Build TimelineStop DTOs
        List<TimelineResponseDto.TimelineStopDto> stopDtos = new ArrayList<>();
        for (int i = 0; i < recordedStops.size(); i++) {
            TimelineStop stop = recordedStops.get(i);
            String arrStr = stop.getArrivalTime() != null ? stop.getArrivalTime().format(TIME_FMT) : "09:00 AM";
            String depStr = stop.getDepartureTime() != null ? stop.getDepartureTime().format(TIME_FMT) : null;
            String timeRange = depStr != null ? arrStr + " – " + depStr : "Arrived " + arrStr;

            long durationMins = stop.calculateDurationMinutes();
            String durText = durationMins > 0 ? (durationMins >= 60 ? (durationMins / 60) + " hr " + (durationMins % 60) + " min" : durationMins + " min") : "Brief Stop";

            stopDtos.add(TimelineResponseDto.TimelineStopDto.builder()
                    .index(i + 1)
                    .id(stop.getId())
                    .name(stop.getPlaceName() != null ? stop.getPlaceName() : "Checkpoint #" + (i + 1))
                    .tag(i == 0 ? "START LOCATION" : (i == recordedStops.size() - 1 ? "CURRENT LOCATION" : "STOP #" + (i + 1)))
                    .timeRange(timeRange)
                    .durationText(durText)
                    .stayDurationMinutes(durationMins)
                    .address(stop.getStreetAddress() != null ? stop.getStreetAddress() : "Identified Station Coordinate")
                    .latitude(stop.getLatitude())
                    .longitude(stop.getLongitude())
                    .isOffice(i == 0 || (stop.getPlaceName() != null && stop.getPlaceName().toLowerCase().contains("office")))
                    .arrivalTime(stop.getArrivalTime() != null ? stop.getArrivalTime().toString() : null)
                    .departureTime(stop.getDepartureTime() != null ? stop.getDepartureTime().toString() : null)
                    .build());
        }

        // 6. Build Transits between consecutive stops
        List<TimelineResponseDto.TransitItemDto> transitDtos = new ArrayList<>();
        for (int i = 0; i < stopDtos.size() - 1; i++) {
            TimelineResponseDto.TimelineStopDto from = stopDtos.get(i);
            TimelineResponseDto.TimelineStopDto to = stopDtos.get(i + 1);
            double distKm = GeofenceUtil.calculateHaversineDistance(
                    from.getLatitude(), from.getLongitude(),
                    to.getLatitude(), to.getLongitude()
            ) / 1000.0;
            distKm = Math.round(distKm * 10.0) / 10.0;
            long estMins = Math.max(5, Math.round((distKm / 35.0) * 60)); // ~35 km/h driving estimate

            transitDtos.add(TimelineResponseDto.TransitItemDto.builder()
                    .fromStopIndex(from.getIndex())
                    .toStopIndex(to.getIndex())
                    .mode(distKm < 1.0 ? "WALKING" : "DRIVING")
                    .distanceKm(distKm)
                    .durationText(estMins + " min")
                    .build());
        }

        // 7. Multi-day Calendar Strip (Preceding 7 days)
        List<TimelineResponseDto.DayItem> availableDays = new ArrayList<>();
        LocalDate today = LocalDate.now(IST_ZONE);
        for (int d = 6; d >= 0; d--) {
            LocalDate day = today.minusDays(d);
            String dayStr = day.format(DATE_FMT);
            String label = day.equals(today) ? "Today" : day.format(DateTimeFormatter.ofPattern("EEE, MMM d"));
            availableDays.add(TimelineResponseDto.DayItem.builder()
                    .date(dayStr)
                    .label(label)
                    .isToday(day.equals(today))
                    .isSelected(day.equals(targetDate))
                    .build());
        }

        // 8. Trip Summary
        double totalDist = Math.round(calculatedDistanceKm * 100.0) / 100.0;
        String startTimeStr = !routePoints.isEmpty() ? routePoints.get(0).getTimestamp().format(TIME_FMT) : null;
        String endTimeStr = !routePoints.isEmpty() ? routePoints.get(routePoints.size() - 1).getTimestamp().format(TIME_FMT) : null;

        TimelineResponseDto.TripSummary summary = TimelineResponseDto.TripSummary.builder()
                .title(stopDtos.size() + " places visited • " + totalDist + " km")
                .totalPlaces(stopDtos.size())
                .totalDistanceKm(totalDist)
                .totalDurationText("Full Day Route")
                .startTime(startTimeStr)
                .endTime(endTimeStr)
                .hasTravelData(!routePoints.isEmpty() || !stopDtos.isEmpty())
                .build();

        // 9. Latest live telemetry packet for real-time overlay
        LiveTelemetryPacket live = batchService.getLatestTelemetry(userId);

        return TimelineResponseDto.builder()
                .userId(userId)
                .date(targetDate.format(DATE_FMT))
                .totalDistanceKm(totalDist)
                .totalPlaces(stopDtos.size())
                .totalDurationText(summary.getTotalDurationText())
                .employee(TimelineResponseDto.EmployeeInfo.builder()
                        .id(userId)
                        .fullName(live != null && live.getEmployeeName() != null ? live.getEmployeeName() : "Field Specialist (" + userId + ")")
                        .employeeCode(live != null && live.getEmployeeCode() != null ? live.getEmployeeCode() : "EMP-" + userId.substring(0, Math.min(6, userId.length())))
                        .department("Field Operations & Logistics")
                        .designation("Drone & Operations Engineer")
                        .workLocationType("OFF_SITE")
                        .build())
                .tripSummary(summary)
                .availableDays(availableDays)
                .stops(stopDtos)
                .transits(transitDtos)
                .routePoints(pointDtos)
                .routePolyline(polyline)
                .liveLocation(live)
                .build();
    }

    /**
     * Algorithmic stationary stop detection from raw route coordinates:
     * Discovers stops when coordinates remain within 20 meters for 3+ minutes.
     */
    private List<TimelineStop> detectStopsFromRoutePoints(String userId, List<RoutePoint> points) {
        List<TimelineStop> detected = new ArrayList<>();
        if (points.isEmpty()) return detected;

        RoutePoint clusterStart = points.get(0);
        RoutePoint lastInCluster = clusterStart;

        for (int i = 1; i < points.size(); i++) {
            RoutePoint pt = points.get(i);
            double distMeters = GeofenceUtil.calculateHaversineDistance(
                    clusterStart.getLatitude(), clusterStart.getLongitude(),
                    pt.getLatitude(), pt.getLongitude()
            );

            if (distMeters <= 20.0) {
                lastInCluster = pt;
            } else {
                long stationarySeconds = java.time.Duration.between(
                        clusterStart.getTimestamp(), lastInCluster.getTimestamp()).getSeconds();

                if (stationarySeconds >= 180) { // >= 3 minutes
                    TimelineStop stop = TimelineStop.builder()
                            .id(UUID.randomUUID().toString())
                            .sessionId(clusterStart.getSession() != null ? clusterStart.getSession().getId() : "auto_session")
                            .userId(userId)
                            .arrivalTime(clusterStart.getTimestamp())
                            .departureTime(lastInCluster.getTimestamp())
                            .latitude(clusterStart.getLatitude())
                            .longitude(clusterStart.getLongitude())
                            .stayDurationMinutes(stationarySeconds / 60)
                            .build();

                    detected.add(stop);
                }
                clusterStart = pt;
                lastInCluster = pt;
            }
        }

        // Add first and last points as landmark waypoints if no stops detected
        if (detected.isEmpty() && !points.isEmpty()) {
            RoutePoint startPt = points.get(0);
            detected.add(TimelineStop.builder()
                    .id(UUID.randomUUID().toString())
                    .sessionId(startPt.getSession() != null ? startPt.getSession().getId() : "auto_session")
                    .userId(userId)
                    .arrivalTime(startPt.getTimestamp())
                    .departureTime(startPt.getTimestamp().plusMinutes(15))
                    .latitude(startPt.getLatitude())
                    .longitude(startPt.getLongitude())
                    .stayDurationMinutes(15L)
                    .build());

            if (points.size() > 5) {
                RoutePoint endPt = points.get(points.size() - 1);
                detected.add(TimelineStop.builder()
                        .id(UUID.randomUUID().toString())
                        .sessionId(endPt.getSession() != null ? endPt.getSession().getId() : "auto_session")
                        .userId(userId)
                        .arrivalTime(endPt.getTimestamp().minusMinutes(10))
                        .departureTime(endPt.getTimestamp())
                        .latitude(endPt.getLatitude())
                        .longitude(endPt.getLongitude())
                        .stayDurationMinutes(10L)
                        .build());
            }
        }

        return detected;
    }

    /**
     * Returns latest known live telemetry for all active field employees
     */
    public List<EmployeeLiveDto> getLiveEmployees() {
        Collection<LiveTelemetryPacket> telemetryList = batchService.getAllLatestTelemetry();
        List<EmployeeLiveDto> result = new ArrayList<>();

        for (LiveTelemetryPacket packet : telemetryList) {
            result.add(EmployeeLiveDto.builder()
                    .id(packet.getUserId())
                    .userId(packet.getUserId())
                    .employeeCode(packet.getEmployeeCode() != null ? packet.getEmployeeCode() : "EMP-" + packet.getUserId())
                    .fullName(packet.getEmployeeName() != null ? packet.getEmployeeName() : "Employee " + packet.getUserId())
                    .department("Field Operations")
                    .designation("Field Executive")
                    .workLocationType("OFF_SITE")
                    .latitude(packet.getLatitude())
                    .longitude(packet.getLongitude())
                    .speed(packet.getSpeed() != null ? packet.getSpeed() : 0.0)
                    .heading(packet.getHeading() != null ? packet.getHeading() : 0.0)
                    .accuracy(packet.getAccuracy() != null ? packet.getAccuracy() : 5.0)
                    .batteryLevel(packet.getBatteryLevel() != null ? packet.getBatteryLevel() : 95.0)
                    .isMoving(Boolean.FALSE.equals(packet.getIsStationary()) && packet.getSpeed() != null && packet.getSpeed() > 1.0)
                    .isOnline(true)
                    .lastSeen(packet.getTimestamp())
                    .status(Boolean.TRUE.equals(packet.getIsStationary()) ? "STATIONARY" : "MOVING")
                    .build());
        }

        return result;
    }
}
