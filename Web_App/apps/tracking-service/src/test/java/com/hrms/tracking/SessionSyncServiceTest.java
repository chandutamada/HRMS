package com.hrms.tracking;

import com.hrms.tracking.dto.CheckpointDto;
import com.hrms.tracking.dto.RoutePointDto;
import com.hrms.tracking.dto.SessionSyncRequest;
import com.hrms.tracking.dto.SessionSyncResponse;
import com.hrms.tracking.entity.TrackingSession;
import com.hrms.tracking.repository.CheckpointRepository;
import com.hrms.tracking.repository.RoutePointRepository;
import com.hrms.tracking.repository.TrackingSessionRepository;
import com.hrms.tracking.security.AuthenticatedEmployee;
import com.hrms.tracking.service.SessionSyncService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class SessionSyncServiceTest {

    @Mock
    private TrackingSessionRepository sessionRepository;

    @Mock
    private RoutePointRepository routePointRepository;

    @Mock
    private CheckpointRepository checkpointRepository;

    @InjectMocks
    private SessionSyncService syncService;

    private AuthenticatedEmployee testEmployee;

    @BeforeEach
    void setUp() {
        testEmployee = AuthenticatedEmployee.builder()
                .userId("user_test_123")
                .email("test.employee@superbee.internal")
                .employeeId("emp_test_456")
                .companyId("company_superbee")
                .roles(List.of("EMPLOYEE"))
                .build();
    }

    @Test
    void testSyncSession_Success() {
        String sessionId = "session_test_999";
        long now = System.currentTimeMillis();

        RoutePointDto pt1 = RoutePointDto.builder()
                .lat(13.0498)
                .lng(77.6202)
                .alt(920.0)
                .speed(15.2)
                .accuracy(5.0)
                .heading(90.0)
                .ts(now)
                .build();

        CheckpointDto cp1 = CheckpointDto.builder()
                .lat(13.0498)
                .lng(77.6202)
                .arrivedAt(now)
                .departedAt(now + 60000)
                .index(1)
                .notes("Stationary Stop #1")
                .build();

        SessionSyncRequest request = SessionSyncRequest.builder()
                .id(sessionId)
                .startTime(now - 3600000)
                .endTime(now)
                .distanceKm(3.45)
                .areaName("Bangalore Field Test")
                .state("Karnataka")
                .routePoints(List.of(pt1))
                .checkpoints(List.of(cp1))
                .build();

        TrackingSession savedSession = TrackingSession.builder()
                .id(sessionId)
                .userId(testEmployee.getUserId())
                .distanceKm(3.45)
                .startTime(LocalDateTime.now().minusHours(1))
                .endTime(LocalDateTime.now())
                .build();

        when(sessionRepository.findById(sessionId)).thenReturn(Optional.empty());
        when(sessionRepository.save(any(TrackingSession.class))).thenReturn(savedSession);

        SessionSyncResponse response = syncService.syncSession(request, testEmployee);

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertEquals(sessionId, response.getSessionId());
        assertEquals(3.45, response.getDistanceKm());
        assertEquals(1, response.getRoutePointsCount());
        assertEquals(1, response.getCheckpointsCount());

        verify(routePointRepository, times(1)).deleteBySessionId(sessionId);
        verify(checkpointRepository, times(1)).deleteBySessionId(sessionId);
        verify(routePointRepository, times(1)).saveAll(any());
        verify(checkpointRepository, times(1)).saveAll(any());
    }
}
