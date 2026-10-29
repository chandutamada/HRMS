package com.hrms.tracking.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class LiveTelemetryPacket {
    private String userId;
    private String sessionId;
    private Double latitude;
    private Double longitude;
    private Double speed;
    private Double heading;
    private Double accuracy;
    private String timestamp; // ISO-8601 or epoch millis
    private Boolean isStationary;
    private Double batteryLevel;
    private String employeeName;
    private String employeeCode;
    private String status; // MOVING, STATIONARY, STOP
}
