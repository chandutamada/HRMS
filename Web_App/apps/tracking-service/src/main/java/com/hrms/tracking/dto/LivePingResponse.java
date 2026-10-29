package com.hrms.tracking.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LivePingResponse {
    private boolean success;
    private Map<String, Object> meta;
    private String message;
}
