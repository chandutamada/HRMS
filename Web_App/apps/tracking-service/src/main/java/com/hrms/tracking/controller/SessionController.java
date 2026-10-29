package com.hrms.tracking.controller;

import com.hrms.tracking.dto.*;
import com.hrms.tracking.security.AuthenticatedEmployee;
import com.hrms.tracking.service.SessionSyncService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tracking")
@RequiredArgsConstructor
@Slf4j
public class SessionController {

    private final SessionSyncService syncService;

    /**
     * Mobile client syncs tracking session breadcrumbs, distance, and milestone checkpoints
     */
    @PostMapping("/sessions/sync")
    public ResponseEntity<SessionSyncResponse> syncSession(
            @Valid @RequestBody SessionSyncRequest request,
            @AuthenticationPrincipal AuthenticatedEmployee employee) {

        log.info("Received session sync request from employee: id={}, session={}",
                employee.getUsername(), request.getId());

        SessionSyncResponse response = syncService.syncSession(request, employee);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Mobile client posts periodic live GPS ping (office hours + 50m geofence evaluation)
     */
    @PostMapping("/live")
    public ResponseEntity<LivePingResponse> updateLiveLocation(
            @Valid @RequestBody LivePingRequest request,
            @AuthenticationPrincipal AuthenticatedEmployee employee) {

        LivePingResponse response = syncService.handleLivePing(request, employee);
        return ResponseEntity.ok(response);
    }

    /**
     * List tracking sessions for the authenticated employee or all if HR Admin
     */
    @GetMapping("/sessions")
    public ResponseEntity<List<SessionDetailDto>> getSessions(
            @AuthenticationPrincipal AuthenticatedEmployee employee,
            @RequestParam(value = "userId", required = false) String userId) {

        List<SessionDetailDto> sessions = syncService.getSessions(employee, userId);
        return ResponseEntity.ok(sessions);
    }

    /**
     * Retrieve complete route coordinates and checkpoints for a specific tracking session
     */
    @GetMapping("/sessions/{id}")
    public ResponseEntity<SessionDetailDto> getSessionById(
            @PathVariable("id") String id,
            @AuthenticationPrincipal AuthenticatedEmployee employee) {

        return syncService.getSessionById(id, employee)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    /**
     * Health check endpoint for microservice status and monitoring
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "HRMS Tracking Service",
                "version", "1.0.0",
                "timestamp", System.currentTimeMillis()
        ));
    }
}
