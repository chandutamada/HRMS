package com.hrms.tracking.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SessionDetailDto {
    private String id;
    private String userId;
    private String employeeId;
    private String companyId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Double distanceKm;
    private String areaName;
    private String state;
    private Boolean isOfficeHours;
    private int routePointsCount;
    private int checkpointsCount;
    private List<RoutePointDto> routePoints;
    private List<CheckpointDto> checkpoints;
}
