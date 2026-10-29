package com.hrms.tracking.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SessionSyncRequest {

    @NotBlank(message = "Session id is required")
    private String id;

    @NotNull(message = "Session start time is required")
    private Long startTime;

    private Long endTime;

    @Builder.Default
    private Double distanceKm = 0.0;

    private String areaName;

    private String state;

    private String employeeId;

    private String notes;

    @Builder.Default
    private List<RoutePointDto> routePoints = new ArrayList<>();

    @Builder.Default
    private List<CheckpointDto> checkpoints = new ArrayList<>();
}
