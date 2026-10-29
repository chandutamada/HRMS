package com.hrms.tracking.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class EmployeeLiveDto {
    private String id;
    private String userId;
    private String employeeCode;
    private String fullName;
    private String email;
    private String department;
    private String designation;
    private String workLocationType; // ON_SITE or OFF_SITE
    private Double latitude;
    private Double longitude;
    private Double speed;
    private Double heading;
    private Double accuracy;
    private Double batteryLevel;
    private Boolean isMoving;
    private Boolean isOnline;
    private String lastSeen;
    private String status; // MOVING, STATIONARY, OFFLINE
}
