package com.hrms.tracking.controller;

import com.hrms.tracking.dto.EmployeeLiveDto;
import com.hrms.tracking.dto.SessionSyncRequest;
import com.hrms.tracking.dto.SessionSyncResponse;
import com.hrms.tracking.dto.TimelineResponseDto;
import com.hrms.tracking.security.AuthenticatedEmployee;
import com.hrms.tracking.service.SessionSyncService;
import com.hrms.tracking.service.TimelineService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@Slf4j
public class TrackingRestController {

    private final TimelineService timelineService;
    private final SessionSyncService syncService;

    /**
     * GET /api/employees/live
     * Fetches the latest known location of all active field employees
     */
    @GetMapping({"/api/employees/live", "/api/tracking/employees/live"})
    public ResponseEntity<List<EmployeeLiveDto>> getLiveEmployees() {
        List<EmployeeLiveDto> liveEmployees = timelineService.getLiveEmployees();
        return ResponseEntity.ok(liveEmployees);
    }

    /**
     * GET /api/timeline?userId={id}&date=YYYY-MM-DD
     * Returns full day route points, identified stops, stay durations, total distance, and resolved landmark addresses
     */
    @GetMapping({"/api/timeline", "/api/tracking/timeline"})
    public ResponseEntity<TimelineResponseDto> getTimeline(
            @RequestParam(value = "userId", required = false) String userId,
            @RequestParam(value = "employeeId", required = false) String employeeId,
            @RequestParam(value = "date", required = false) String date,
            @AuthenticationPrincipal AuthenticatedEmployee employee) {

        String targetUserId = userId != null ? userId : employeeId;
        if (targetUserId == null && employee != null) {
            targetUserId = employee.getUserId();
        }
        if (targetUserId == null) {
            targetUserId = "demo_field_worker";
        }

        TimelineResponseDto timeline = timelineService.getTimeline(targetUserId, date);
        return ResponseEntity.ok(timeline);
    }

    /**
     * POST /api/sessions/sync
     * Offline sync endpoint for mobile client route batching
     */
    @PostMapping({"/api/sessions/sync", "/api/tracking/sessions/sync"})
    public ResponseEntity<SessionSyncResponse> syncSession(
            @Valid @RequestBody SessionSyncRequest request,
            @AuthenticationPrincipal AuthenticatedEmployee employee) {

        AuthenticatedEmployee authEmp = employee != null ? employee : AuthenticatedEmployee.builder()
                .userId(request.getId() != null ? request.getId() : "mobile_user")
                .employeeId(request.getEmployeeId() != null ? request.getEmployeeId() : "EMP-001")
                .username("Mobile Employee")
                .roles(List.of("EMPLOYEE"))
                .build();

        SessionSyncResponse response = syncService.syncSession(request, authEmp);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
