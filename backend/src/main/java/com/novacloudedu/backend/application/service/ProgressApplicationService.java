package com.novacloudedu.backend.application.service;

import com.novacloudedu.backend.domain.course.repository.CourseSectionRepository;
import com.novacloudedu.backend.domain.course.valueobject.CourseId;
import com.novacloudedu.backend.domain.course.valueobject.SectionId;
import com.novacloudedu.backend.domain.progress.entity.UserCourseProgress;
import com.novacloudedu.backend.domain.progress.repository.UserCourseProgressRepository;
import com.novacloudedu.backend.domain.user.valueobject.UserId;
import com.novacloudedu.backend.application.learning.command.RecordLearningEventCommand;
import com.novacloudedu.backend.application.learning.service.LearningEventApplicationService;
import com.novacloudedu.backend.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 学习进度应用服务
 * 负责课程学习进度的更新、完成、重置等用例编排
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ProgressApplicationService {

    private final UserCourseProgressRepository progressRepository;
    private final CourseSectionRepository sectionRepository;
    private final LearningEventApplicationService learningEventService;

    @Transactional
    public void updateProgress(UserId userId, Long courseId, Long sectionId,
                               Integer lastPosition, Integer watchDuration, Integer progress) {
        sectionRepository.findById(SectionId.of(sectionId))
                .orElseThrow(() -> new BusinessException(40400, "小节不存在"));

        UserCourseProgress userProgress = progressRepository
                .findByUserIdAndSectionId(userId, SectionId.of(sectionId))
                .orElseGet(() -> UserCourseProgress.create(userId, CourseId.of(courseId), SectionId.of(sectionId)));

        userProgress.updateProgress(lastPosition, watchDuration, progress);
        progressRepository.save(userProgress);

        learningEventService.record(userId.value(), new RecordLearningEventCommand(
                "VIDEO_PROGRESS", courseId, sectionId, null, null, null,
                "COMPUTER_SCIENCE", watchDuration, null, null, null,
                "COURSE_PLAYER", null));
    }

    @Transactional
    public void completeSection(UserId userId, Long courseId, Long sectionId) {
        sectionRepository.findById(SectionId.of(sectionId))
                .orElseThrow(() -> new BusinessException(40400, "小节不存在"));

        UserCourseProgress progress = progressRepository
                .findByUserIdAndSectionId(userId, SectionId.of(sectionId))
                .orElseGet(() -> UserCourseProgress.create(userId, CourseId.of(courseId), SectionId.of(sectionId)));

        progress.complete();
        progressRepository.save(progress);
        learningEventService.record(userId.value(), new RecordLearningEventCommand(
                "VIDEO_COMPLETED", courseId, sectionId, null, null, null,
                "COMPUTER_SCIENCE", 0, null, null, null, "COURSE_PLAYER", null));
    }

    @Transactional
    public void resetProgress(UserId userId, Long sectionId) {
        UserCourseProgress progress = progressRepository
                .findByUserIdAndSectionId(userId, SectionId.of(sectionId))
                .orElseThrow(() -> new BusinessException(40400, "学习进度不存在"));

        progress.reset();
        progressRepository.save(progress);
        learningEventService.record(userId.value(), new RecordLearningEventCommand(
                "VIDEO_SEEKED", progress.getCourseId().value(), sectionId, null, null, null,
                "COMPUTER_SCIENCE", 0, null, null, null, "COURSE_PLAYER", null));
    }
}
