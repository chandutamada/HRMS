package com.hrms.tracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "route_points", indexes = {
    @Index(name = "idx_rp_session_id", columnList = "sessionId"),
    @Index(name = "idx_rp_timestamp", columnList = "timestamp"),
    @Index(name = "idx_rp_user_recorded", columnList = "userId, timestamp")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoutePoint {

    @Id
    @Column(name = "id", length = 191, nullable = false)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sessionId", nullable = false)
    private TrackingSession session;

    @Column(name = "userId", length = 191)
    private String userId;

    @Column(name = "latitude", nullable = false)
    private Double latitude;

    @Column(name = "longitude", nullable = false)
    private Double longitude;

    @Column(name = "altitude")
    private Double altitude;

    @Column(name = "speed")
    private Double speed;

    @Column(name = "heading")
    private Double heading;

    @Column(name = "accuracy")
    private Double accuracy;

    @Column(name = "timestamp", nullable = false)
    private LocalDateTime timestamp;

    public String getPointId() {
        return this.id;
    }

    public void setPointId(String pointId) {
        this.id = pointId;
    }

    public LocalDateTime getRecordedAt() {
        return this.timestamp;
    }

    public void setRecordedAt(LocalDateTime recordedAt) {
        this.timestamp = recordedAt;
    }
}
