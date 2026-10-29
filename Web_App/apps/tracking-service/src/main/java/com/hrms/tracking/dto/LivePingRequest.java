package com.hrms.tracking.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LivePingRequest {
    @NotNull(message = "Latitude is required")
    private Double latitude;

    @NotNull(message = "Longitude is required")
    private Double longitude;

    private Double accuracy;
    private Double altitude;
    private Double speed;
    private Double heading;
    private Boolean isMoving;
    private Double batteryLevel;
}
