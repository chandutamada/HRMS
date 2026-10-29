package com.hrms.tracking.repository;

import com.hrms.tracking.entity.Checkpoint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CheckpointRepository extends JpaRepository<Checkpoint, String> {

    @Query("SELECT c FROM Checkpoint c WHERE c.session.id = :sessionId ORDER BY c.pointIndex ASC")
    List<Checkpoint> findBySessionIdOrderByPointIndexAsc(@Param("sessionId") String sessionId);

    @Modifying
    @Query("DELETE FROM Checkpoint c WHERE c.session.id = :sessionId")
    void deleteBySessionId(@Param("sessionId") String sessionId);
}
