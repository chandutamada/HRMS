package com.hrms.tracking.repository;

import com.hrms.tracking.entity.TrackingSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TrackingSessionRepository extends JpaRepository<TrackingSession, String> {

    List<TrackingSession> findByUserIdOrderByStartTimeDesc(String userId);

    List<TrackingSession> findByUserIdAndStartTimeBetweenOrderByStartTimeAsc(
            String userId, java.time.LocalDateTime start, java.time.LocalDateTime end);

    List<TrackingSession> findByEmployeeIdOrderByStartTimeDesc(String employeeId);

    List<TrackingSession> findByCompanyIdOrderByStartTimeDesc(String companyId);

    Optional<TrackingSession> findByIdAndUserId(String id, String userId);

    @Query("SELECT s FROM TrackingSession s LEFT JOIN FETCH s.routePoints LEFT JOIN FETCH s.checkpoints WHERE s.id = :id")
    Optional<TrackingSession> findByIdWithDetails(@Param("id") String id);
}
