package com.hrms.tracking.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TimelineResponseDto {

    private String userId;
    private String date;
    private Double totalDistanceKm;
    private Integer totalPlaces;
    private String totalDurationText;

    private EmployeeInfo employee;
    private TripSummary tripSummary;

    @Builder.Default
    private List<DayItem> availableDays = new ArrayList<>();

    @Builder.Default
    private List<TimelineStopDto> stops = new ArrayList<>();

    @Builder.Default
    private List<TransitItemDto> transits = new ArrayList<>();

    @Builder.Default
    private List<RoutePointDetailDto> routePoints = new ArrayList<>();

    @Builder.Default
    private List<List<Double>> routePolyline = new ArrayList<>();

    private LiveTelemetryPacket liveLocation;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class EmployeeInfo {
        private String id;
        private String fullName;
        private String employeeCode;
        private String department;
        private String designation;
        private String workLocationType;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TripSummary {
        private String title;
        private Integer totalPlaces;
        private Double totalDistanceKm;
        private String totalDurationText;
        private String startTime;
        private String endTime;
        private Boolean hasTravelData;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DayItem {
        private String date;
        private String label;
        private Boolean isToday;
        private Boolean isSelected;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TimelineStopDto {
        private Integer index;
        private String id;
        private String name;
        private String tag;
        private String timeRange;
        private String durationText;
        private Long stayDurationMinutes;
        private String address;
        private Double latitude;
        private Double longitude;
        private Boolean isOffice;
        private String arrivalTime;
        private String departureTime;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TransitItemDto {
        private Integer fromStopIndex;
        private Integer toStopIndex;
        private String mode; // DRIVING or WALKING
        private Double distanceKm;
        private String durationText;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RoutePointDetailDto {
        private String pointId;
        private String sessionId;
        private Double latitude;
        private Double longitude;
        private Double speed;
        private Double heading;
        private Double accuracy;
        private String recordedAt;
    }
}
