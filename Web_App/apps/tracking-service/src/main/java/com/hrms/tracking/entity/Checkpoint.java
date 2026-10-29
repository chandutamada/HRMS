package com.hrms.tracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "checkpoints", indexes = {
    @Index(name = "idx_cp_session_id", columnList = "sessionId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Checkpoint {

    @Id
    @Column(name = "id", length = 191, nullable = false)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sessionId", nullable = false)
    private TrackingSession session;

    @Column(name = "latitude", nullable = false)
    private Double latitude;

    @Column(name = "longitude", nullable = false)
    private Double longitude;

    @Column(name = "arrivedAt", nullable = false)
    private LocalDateTime arrivedAt;

    @Column(name = "departedAt")
    private LocalDateTime departedAt;

    @Column(name = "pointIndex", nullable = false)
    private Integer pointIndex;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
}
