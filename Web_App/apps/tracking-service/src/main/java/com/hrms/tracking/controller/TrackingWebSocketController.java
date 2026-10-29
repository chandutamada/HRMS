package com.hrms.tracking.controller;

import com.hrms.tracking.dto.LiveTelemetryPacket;
import com.hrms.tracking.entity.TimelineStop;
import com.hrms.tracking.repository.TimelineStopRepository;
import com.hrms.tracking.service.AsyncTrackingBatchService;
import com.hrms.tracking.service.ReverseGeocodingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

@Controller
@RequiredArgsConstructor
@Slf4j
public class TrackingWebSocketController {

    private final SimpMessagingTemplate messagingTemplate;
    private final AsyncTrackingBatchService batchService;
    private final ReverseGeocodingService geocodingService;
    private final TimelineStopRepository timelineStopRepository;

    /**
     * Mobile client streams live telemetry coordinates via STOMP to /app/track/{userId}
     * Immediately broadcast to subscribed HR Dashboard web clients at /topic/employee/{userId}
     */
    @MessageMapping("/track/{userId}")
    public void handleLiveTrack(
            @DestinationVariable("userId") String userId,
            @Payload LiveTelemetryPacket packet) {

        if (packet == null) return;
        packet.setUserId(userId);

        if (packet.getTimestamp() == null || packet.getTimestamp().isEmpty()) {
            packet.setTimestamp(Instant.now().toString());
        }

        // 1. Immediately broadcast transient telemetry to HR dashboard channel (Zero DB latency)
        messagingTemplate.convertAndSend("/topic/employee/" + userId, packet);
        messagingTemplate.convertAndSend("/topic/employees/live", packet);

        // 2. Hand off to decoupled async batch buffer for periodic persistence
        batchService.enqueue(packet);

        // 3. If stop / stationary state event detected, record TimelineStop with reverse geocoded landmark
        if (Boolean.TRUE.equals(packet.getIsStationary()) && packet.getLatitude() != null && packet.getLongitude() != null) {
            handleStationaryStopEvent(userId, packet);
        }
    }

    private void handleStationaryStopEvent(String userId, LiveTelemetryPacket packet) {
        try {
            ReverseGeocodingService.GeocodedAddress address =
                    geocodingService.resolveAddress(packet.getLatitude(), packet.getLongitude());

            String sessionId = packet.getSessionId() != null ? packet.getSessionId() : "session_auto_" + userId;
            LocalDateTime now = LocalDateTime.now();

            TimelineStop stop = TimelineStop.builder()
                    .id(UUID.randomUUID().toString())
                    .sessionId(sessionId)
                    .userId(userId)
                    .arrivalTime(now)
                    .departureTime(null)
                    .latitude(packet.getLatitude())
                    .longitude(packet.getLongitude())
                    .placeName(address.getPlaceName())
                    .streetAddress(address.getStreetAddress())
                    .stayDurationMinutes(0L)
                    .build();

            timelineStopRepository.save(stop);
            log.info("Stationary Stop recorded for user {}: {}", userId, address.getPlaceName());
        } catch (Exception e) {
            log.warn("Failed to persist stationary stop: {}", e.getMessage());
        }
    }
}
