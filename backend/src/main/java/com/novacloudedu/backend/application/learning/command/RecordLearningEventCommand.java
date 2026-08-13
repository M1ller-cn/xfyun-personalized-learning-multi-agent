package com.novacloudedu.backend.application.learning.command;

import java.util.Map;

/** Canonical event payload shared by player, assessment, code judge and tutor modules. */
public record RecordLearningEventCommand(
        String eventType,
        Long courseId,
        Long sectionId,
        Long classId,
        String knowledgePoint,
        String taskId,
        String subject,
        Integer durationSec,
        Integer score,
        Integer maxScore,
        String errorCategory,
        String source,
        Map<String, Object> metadata
) {}
