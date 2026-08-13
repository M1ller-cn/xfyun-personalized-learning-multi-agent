package com.novacloudedu.backend.application.learning.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacloudedu.backend.application.analytics.event.LearningActivityEvent;
import com.novacloudedu.backend.application.learning.command.RecordLearningEventCommand;
import com.novacloudedu.backend.domain.analytics.valueobject.ActivityType;
import com.novacloudedu.backend.domain.exam.valueobject.Subject;
import com.novacloudedu.backend.domain.grading.entity.StudentKnowledgeProfile;
import com.novacloudedu.backend.domain.grading.repository.StudentKnowledgeProfileRepository;
import com.novacloudedu.backend.domain.user.valueobject.UserId;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Writes a single, auditable learning evidence stream and mirrors it into the
 * existing analytics and knowledge-profile models during the transition.
 */
@Service
@RequiredArgsConstructor
public class LearningEventApplicationService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;
    private final StudentKnowledgeProfileRepository knowledgeProfileRepository;

    @Transactional
    public LearningEventView record(long userId, RecordLearningEventCommand command) {
        String eventType = normalizeEventType(command.eventType());
        String subjectCode = normalizeSubject(command.subject());
        int durationSec = Math.max(0, command.durationSec() == null ? 0 : command.durationSec());
        String metadata = json(command.metadata());
        Long id = jdbcTemplate.queryForObject("""
                INSERT INTO learning_event
                    (user_id, event_type, course_id, section_id, class_id, knowledge_point, task_id,
                     subject, duration_sec, score, max_score, error_category, source, metadata, create_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), NOW())
                RETURNING id
                """, Long.class,
                userId, eventType, command.courseId(), command.sectionId(), command.classId(),
                trim(command.knowledgePoint(), 256), trim(command.taskId(), 128), subjectCode,
                durationSec, command.score(), command.maxScore(), trim(command.errorCategory(), 128),
                trim(command.source(), 64, "STUDENT"), metadata);

        mirrorToAnalytics(userId, eventType, command, subjectCode, durationSec);
        updateKnowledgeEvidence(userId, subjectCode, command);
        return new LearningEventView(id, eventType, command.courseId(), command.sectionId(),
                command.knowledgePoint(), subjectCode, durationSec, command.score(), command.maxScore());
    }

    public List<LearningEventView> listRecent(long userId, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 100));
        return jdbcTemplate.query("""
                SELECT id, event_type, course_id, section_id, knowledge_point, subject,
                       duration_sec, score, max_score
                FROM learning_event WHERE user_id = ?
                ORDER BY create_time DESC LIMIT ?
                """, (rs, rowNum) -> new LearningEventView(
                rs.getLong("id"), rs.getString("event_type"),
                (Long) rs.getObject("course_id"), (Long) rs.getObject("section_id"),
                rs.getString("knowledge_point"), rs.getString("subject"),
                rs.getInt("duration_sec"), (Integer) rs.getObject("score"),
                (Integer) rs.getObject("max_score")), userId, safeLimit);
    }

    private void mirrorToAnalytics(long userId, String eventType, RecordLearningEventCommand command,
                                   String subject, int durationSec) {
        ActivityType activityType = switch (eventType) {
            case "VIDEO_STARTED", "VIDEO_PAUSED", "VIDEO_SEEKED", "VIDEO_PROGRESS", "VIDEO_COMPLETED" -> ActivityType.COURSE_WATCH;
            case "DOCUMENT_READ", "GRAPH_NODE_VIEWED", "RESOURCE_FAVOURITED", "TUTOR_QUESTION" -> ActivityType.ARTICLE_READ;
            case "QUIZ_SUBMITTED", "TASK_COMPLETED" -> ActivityType.EXAM_PRACTICE;
            case "CODE_RUN", "CODE_JUDGED", "CODE_ANALYSIS_VIEWED" -> ActivityType.HOMEWORK_SUBMIT;
            default -> ActivityType.EXAM_PRACTICE;
        };
        Long referenceId = command.courseId() != null ? command.courseId() : command.sectionId();
        String detail = eventType + (command.knowledgePoint() == null ? "" : ":" + command.knowledgePoint());
        eventPublisher.publishEvent(new LearningActivityEvent(
                this, userId, activityType, referenceId, subject, command.classId(), durationSec,
                command.score(), command.maxScore(), detail));
    }

    private void updateKnowledgeEvidence(long userId, String subjectCode, RecordLearningEventCommand command) {
        if (command.knowledgePoint() == null || command.knowledgePoint().isBlank()
                || command.score() == null || command.maxScore() == null || command.maxScore() <= 0) {
            return;
        }
        Subject subject = Subject.fromCode(subjectCode);
        String knowledgePoint = trim(command.knowledgePoint(), 256);
        StudentKnowledgeProfile profile = knowledgeProfileRepository
                .findByStudentAndSubjectAndPoint(UserId.of(userId), subject, knowledgePoint)
                .orElseGet(() -> StudentKnowledgeProfile.create(UserId.of(userId), subject, knowledgePoint));
        double rate = command.score() / (double) command.maxScore();
        if (rate >= 0.6d) {
            profile.recordCorrect();
        } else {
            profile.recordError(trim(command.errorCategory(), 128, "概念理解不足"));
        }
        knowledgeProfileRepository.save(profile);
    }

    private String normalizeEventType(String raw) {
        String value = trim(raw, 64, "").toUpperCase(Locale.ROOT);
        return switch (value) {
            case "VIDEO_STARTED", "VIDEO_PAUSED", "VIDEO_SEEKED", "VIDEO_PROGRESS", "VIDEO_COMPLETED",
                 "DOCUMENT_READ", "GRAPH_NODE_VIEWED", "RESOURCE_FAVOURITED", "QUIZ_SUBMITTED",
                 "TASK_COMPLETED", "CODE_RUN", "CODE_JUDGED", "CODE_ANALYSIS_VIEWED", "TUTOR_QUESTION" -> value;
            default -> throw new IllegalArgumentException("不支持的学习事件类型: " + raw);
        };
    }

    private String normalizeSubject(String subject) {
        String code = trim(subject, 64, "COMPUTER_SCIENCE").toUpperCase(Locale.ROOT);
        Subject.fromCode(code);
        return code;
    }

    private String json(Map<String, Object> metadata) {
        try {
            return objectMapper.writeValueAsString(metadata == null ? Map.of() : metadata);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("学习事件元数据无法序列化", ex);
        }
    }

    private String trim(String value, int maxLength) {
        return trim(value, maxLength, null);
    }

    private String trim(String value, int maxLength, String fallback) {
        if (value == null || value.isBlank()) return fallback;
        String normalized = value.trim();
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }

    public record LearningEventView(Long id, String eventType, Long courseId, Long sectionId,
                                    String knowledgePoint, String subject, int durationSec,
                                    Integer score, Integer maxScore) {}
}
