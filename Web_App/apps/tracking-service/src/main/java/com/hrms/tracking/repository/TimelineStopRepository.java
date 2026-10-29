package com.hrms.tracking.repository;

import com.hrms.tracking.entity.TimelineStop;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TimelineStopRepository extends JpaRepository<TimelineStop, String> {

    List<TimelineStop> findBySessionIdOrderByArrivalTimeAsc(String sessionId);

    List<TimelineStop> findByUserIdAndArrivalTimeBetweenOrderByArrivalTimeAsc(
            String userId, LocalDateTime start, LocalDateTime end);

    void deleteBySessionId(String sessionId);
}
