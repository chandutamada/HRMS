package com.hrms.tracking.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SessionSyncResponse {
    private boolean success;
    private String sessionId;
    private Double distanceKm;
    private boolean isOfficeHours;
    private int routePointsCount;
    private int checkpointsCount;
    private String message;
}
