package com.hrms.tracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "tracking_sessions", indexes = {
    @Index(name = "idx_ts_user_id", columnList = "userId"),
    @Index(name = "idx_ts_employee_id", columnList = "employeeId"),
    @Index(name = "idx_ts_company_id", columnList = "companyId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrackingSession {

    @Id
    @Column(name = "id", length = 191, nullable = false)
    private String id;

    @Column(name = "userId", length = 191, nullable = false)
    private String userId;

    @Column(name = "employeeId", length = 191)
    private String employeeId;

    @Column(name = "companyId", length = 191)
    private String companyId;

    @Column(name = "startTime", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "endTime")
    private LocalDateTime endTime;

    @Column(name = "distanceKm", nullable = false)
    @Builder.Default
    private Double distanceKm = 0.0;

    @Column(name = "status", length = 50)
    private String status;

    @Column(name = "areaName", length = 150)
    private String areaName;

    @Column(name = "state", length = 100)
    private String state;

    @Column(name = "isOfficeHours", nullable = false)
    @Builder.Default
    private Boolean isOfficeHours = true;

    @Column(name = "createdAt", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updatedAt", nullable = false)
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<RoutePoint> routePoints = new ArrayList<>();

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<Checkpoint> checkpoints = new ArrayList<>();

    public String getSessionId() {
        return this.id;
    }

    public void setSessionId(String sessionId) {
        this.id = sessionId;
    }

    public Double getTotalDistanceKm() {
        return this.distanceKm != null ? this.distanceKm : 0.0;
    }

    public void setTotalDistanceKm(Double totalDistanceKm) {
        this.distanceKm = totalDistanceKm;
    }

    public String getEffectiveStatus() {
        if (this.status != null && !this.status.isEmpty()) return this.status;
        return this.state != null ? this.state : "ACTIVE";
    }

    @PrePersist
    public void onPrePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.updatedAt == null) {
            this.updatedAt = LocalDateTime.now();
        }
        if (this.distanceKm == null) {
            this.distanceKm = 0.0;
        }
        if (this.isOfficeHours == null) {
            this.isOfficeHours = true;
        }
    }

    @PreUpdate
    public void onPreUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
