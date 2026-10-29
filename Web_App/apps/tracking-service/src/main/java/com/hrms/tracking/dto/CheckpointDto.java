package com.hrms.tracking.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CheckpointDto {
    private String id;
    private Double lat;
    private Double lng;
    private Long arrivedAt;
    private Long departedAt;
    private Integer index;
    private String notes;
}
