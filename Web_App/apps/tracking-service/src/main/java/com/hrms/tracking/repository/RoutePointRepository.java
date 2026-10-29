package com.hrms.tracking.repository;

import com.hrms.tracking.entity.RoutePoint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoutePointRepository extends JpaRepository<RoutePoint, String> {

    @Query("SELECT r FROM RoutePoint r WHERE r.session.id = :sessionId ORDER BY r.timestamp ASC")
    List<RoutePoint> findBySessionIdOrderByTimestampAsc(@Param("sessionId") String sessionId);

    List<RoutePoint> findByUserIdAndTimestampBetweenOrderByTimestampAsc(
            String userId, java.time.LocalDateTime start, java.time.LocalDateTime end);

    @Query("SELECT r FROM RoutePoint r WHERE r.session.id IN :sessionIds ORDER BY r.timestamp ASC")
    List<RoutePoint> findBySessionIdInOrderByTimestampAsc(@Param("sessionIds") List<String> sessionIds);

    @Modifying
    @Query("DELETE FROM RoutePoint r WHERE r.session.id = :sessionId")
    void deleteBySessionId(@Param("sessionId") String sessionId);
}
