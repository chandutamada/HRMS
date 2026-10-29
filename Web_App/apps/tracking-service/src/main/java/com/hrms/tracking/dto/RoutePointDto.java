package com.hrms.tracking.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoutePointDto {
    private Double lat;
    private Double lng;
    private Double alt;
    private Double speed;
    private Double accuracy;
    private Double heading;
    private Long ts;
}
