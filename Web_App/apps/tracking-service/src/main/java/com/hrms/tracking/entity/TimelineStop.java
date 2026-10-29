package com.hrms.tracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Duration;
import java.time.LocalDateTime;

@Entity
@Table(name = "timeline_stops", indexes = {
    @Index(name = "idx_ts_stop_session", columnList = "sessionId"),
    @Index(name = "idx_ts_stop_user_arr", columnList = "userId, arrivalTime")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TimelineStop {

    @Id
    @Column(name = "id", length = 191, nullable = false)
    private String id;

    @Column(name = "sessionId", length = 191, nullable = false)
    private String sessionId;

    @Column(name = "userId", length = 191)
    private String userId;

    @Column(name = "arrivalTime", nullable = false)
    private LocalDateTime arrivalTime;

    @Column(name = "departureTime")
    private LocalDateTime departureTime;

    @Column(name = "latitude", nullable = false)
    private Double latitude;

    @Column(name = "longitude", nullable = false)
    private Double longitude;

    @Column(name = "placeName", length = 255)
    private String placeName;

    @Column(name = "streetAddress", length = 500)
    private String streetAddress;

    @Column(name = "stayDurationMinutes")
    private Long stayDurationMinutes;

    public String getStopId() {
        return this.id;
    }

    public void setStopId(String stopId) {
        this.id = stopId;
    }

    public Long calculateDurationMinutes() {
        if (arrivalTime != null && departureTime != null) {
            return Duration.between(arrivalTime, departureTime).toMinutes();
        }
        return stayDurationMinutes != null ? stayDurationMinutes : 0L;
    }

    @PrePersist
    @PreUpdate
    public void updateDuration() {
        if (departureTime != null && arrivalTime != null) {
            this.stayDurationMinutes = Math.max(0L, Duration.between(arrivalTime, departureTime).toMinutes());
        }
    }
}
