package com.hrms.tracking.service;

import com.hrms.tracking.dto.LiveTelemetryPacket;
import com.hrms.tracking.entity.RoutePoint;
import com.hrms.tracking.entity.TrackingSession;
import com.hrms.tracking.repository.RoutePointRepository;
import com.hrms.tracking.repository.TrackingSessionRepository;
import com.hrms.tracking.util.GeofenceUtil;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AsyncTrackingBatchService {

    private final TrackingSessionRepository sessionRepository;
    private final RoutePointRepository routePointRepository;

    private static final ZoneId IST_ZONE = ZoneId.of("Asia/Kolkata");

    // Decoupled memory queue for incoming telemetry coordinates
    private final ConcurrentLinkedQueue<LiveTelemetryPacket> incomingQueue = new ConcurrentLinkedQueue<>();

    // High performance in-memory registry for sub-millisecond HR radar lookups
    private final Map<String, LiveTelemetryPacket> latestTelemetryMap = new ConcurrentHashMap<>();

    /**
     * Enqueue a live coordinate ping from WebSocket without blocking the STOMP thread.
     * Enforces client+server noise elimination: drops accuracy > 35m, (0.0, 0.0), and speed jumps > 130 km/h.
     */
    public void enqueue(LiveTelemetryPacket packet) {
        if (packet == null || packet.getUserId() == null) return;
        if (packet.getLatitude() == null || packet.getLongitude() == null) return;

        // 1. Accuracy Filtering: Immediately drop coordinates where accuracy > 35m or (0.0, 0.0)
        if (packet.getLatitude() == 0.0 && packet.getLongitude() == 0.0) return;
        if (packet.getLatitude().isNaN() || packet.getLongitude().isNaN()) return;
        if (packet.getAccuracy() != null && packet.getAccuracy() > 35.0) {
            log.debug("Discarding inaccurate coordinate for user {}: accuracy {}m > 35m", packet.getUserId(), packet.getAccuracy());
            return;
        }

        // 2. Speed Jump Check against last known telemetry
        LiveTelemetryPacket prev = latestTelemetryMap.get(packet.getUserId());
        if (prev != null && prev.getLatitude() != null && prev.getLongitude() != null) {
            LocalDateTime prevTs = parseTimestamp(prev.getTimestamp());
            LocalDateTime currTs = parseTimestamp(packet.getTimestamp());
            if (prevTs != null && currTs != null && !currTs.isBefore(prevTs)) {
                long millis = java.time.Duration.between(prevTs, currTs).toMillis();
                double dtSec = Math.max(millis / 1000.0, 0.1);
                double distMeters = GeofenceUtil.calculateHaversineDistance(
                        prev.getLatitude(), prev.getLongitude(),
                        packet.getLatitude(), packet.getLongitude()
                );
                double calculatedSpeedKmh = (distMeters / dtSec) * 3.6;
                if (calculatedSpeedKmh > 130.0) {
                    log.warn("Discarding GPS speed jump anomaly for user {}: calculated speed {} km/h > 130 km/h",
                            packet.getUserId(), String.format("%.1f", calculatedSpeedKmh));
                    return;
                }
            }
        }

        // 3. Instantly update live in-memory registry
        latestTelemetryMap.put(packet.getUserId(), packet);

        // 4. Push to asynchronous DB buffer
        incomingQueue.offer(packet);
    }

    /**
     * Return instantaneous live telemetry for all active field staff
     */
    public Collection<LiveTelemetryPacket> getAllLatestTelemetry() {
        return latestTelemetryMap.values();
    }

    /**
     * Return instantaneous live telemetry for a specific employee
     */
    public LiveTelemetryPacket getLatestTelemetry(String userId) {
        return latestTelemetryMap.get(userId);
    }

    /**
     * Bulk-insert queued route points every 30 seconds to minimize MySQL disk I/O
     */
    @Scheduled(fixedRate = 30000)
    @Transactional
    public void flushBatch() {
        if (incomingQueue.isEmpty()) {
            return;
        }

        List<LiveTelemetryPacket> batch = new ArrayList<>();
        LiveTelemetryPacket packet;
        while ((packet = incomingQueue.poll()) != null) {
            batch.add(packet);
            if (batch.size() >= 1000) {
                // Limit individual transaction batch size
                break;
            }
        }

        if (batch.isEmpty()) return;

        log.info("Asynchronous batch worker flushing {} route points to MySQL...", batch.size());

        try {
            // Group by sessionId or create default session for user if not provided
            Map<String, List<LiveTelemetryPacket>> bySession = batch.stream()
                    .collect(Collectors.groupingBy(p -> p.getSessionId() != null ? p.getSessionId() : "session_auto_" + p.getUserId()));

            List<RoutePoint> pointsToSave = new ArrayList<>();

            for (Map.Entry<String, List<LiveTelemetryPacket>> entry : bySession.entrySet()) {
                String sessionId = entry.getKey();
                List<LiveTelemetryPacket> sessionPoints = entry.getValue();
                String userId = sessionPoints.get(0).getUserId();

                // Ensure tracking session exists in DB
                TrackingSession session = sessionRepository.findById(sessionId)
                        .orElseGet(() -> {
                            TrackingSession newSession = TrackingSession.builder()
                                    .id(sessionId)
                                    .userId(userId)
                                    .startTime(parseTimestamp(sessionPoints.get(0).getTimestamp()))
                                    .distanceKm(0.0)
                                    .areaName("Live Field Dispatch")
                                    .state("Active")
                                    .status("ACTIVE")
                                    .isOfficeHours(true)
                                    .createdAt(LocalDateTime.now())
                                    .updatedAt(LocalDateTime.now())
                                    .build();
                            return sessionRepository.save(newSession);
                        });

                for (LiveTelemetryPacket p : sessionPoints) {
                    if (p.getLatitude() == null || p.getLongitude() == null) continue;
                    LocalDateTime ts = parseTimestamp(p.getTimestamp());

                    RoutePoint rp = RoutePoint.builder()
                            .id(UUID.randomUUID().toString())
                            .session(session)
                            .userId(p.getUserId())
                            .latitude(p.getLatitude())
                            .longitude(p.getLongitude())
                            .speed(p.getSpeed() != null ? p.getSpeed() : 0.0)
                            .heading(p.getHeading() != null ? p.getHeading() : 0.0)
                            .accuracy(p.getAccuracy() != null ? p.getAccuracy() : 5.0)
                            .timestamp(ts)
                            .build();

                    pointsToSave.add(rp);
                }
            }

            if (!pointsToSave.isEmpty()) {
                routePointRepository.saveAll(pointsToSave);
                log.info("Batch flushed: {} coordinates persisted successfully.", pointsToSave.size());
            }
        } catch (Exception e) {
            log.error("Failed to persist async route batch: {}", e.getMessage(), e);
        }
    }

    @PreDestroy
    public void onShutdown() {
        log.info("Application shutting down. Flushing all remaining route coordinates...");
        flushBatch();
    }

    public static LocalDateTime parseTimestamp(String ts) {
        if (ts == null || ts.trim().isEmpty()) {
            return LocalDateTime.now(IST_ZONE);
        }
        try {
            // Check if numeric epoch millis
            long millis = Long.parseLong(ts);
            return LocalDateTime.ofInstant(Instant.ofEpochMilli(millis), IST_ZONE);
        } catch (NumberFormatException ignored) {}

        try {
            // Check ISO-8601
            Instant instant = Instant.parse(ts);
            return LocalDateTime.ofInstant(instant, IST_ZONE);
        } catch (Exception ignored) {}

        try {
            return LocalDateTime.parse(ts, DateTimeFormatter.ISO_DATE_TIME);
        } catch (Exception ignored) {}

        return LocalDateTime.now(IST_ZONE);
    }
}
