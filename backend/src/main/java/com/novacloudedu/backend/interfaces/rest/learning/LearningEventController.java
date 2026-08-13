package com.novacloudedu.backend.interfaces.rest.learning;

import com.novacloudedu.backend.application.learning.command.RecordLearningEventCommand;
import com.novacloudedu.backend.application.learning.service.LearningEventApplicationService;
import com.novacloudedu.backend.common.BaseResponse;
import com.novacloudedu.backend.common.ResultUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/learning-events")
@RequiredArgsConstructor
public class LearningEventController {

    private final LearningEventApplicationService learningEventService;

    @PostMapping
    public BaseResponse<LearningEventApplicationService.LearningEventView> record(
            Authentication authentication, @Valid @RequestBody RecordLearningEventRequest request) {
        long userId = Long.parseLong(authentication.getName());
        return ResultUtils.success(learningEventService.record(userId, new RecordLearningEventCommand(
                request.eventType(), request.courseId(), request.sectionId(), request.classId(),
                request.knowledgePoint(), request.taskId(), request.subject(), request.durationSec(),
                request.score(), request.maxScore(), request.errorCategory(), request.source(), request.metadata())));
    }

    @GetMapping("/me")
    public BaseResponse<List<LearningEventApplicationService.LearningEventView>> recent(
            Authentication authentication, @RequestParam(defaultValue = "30") int limit) {
        return ResultUtils.success(learningEventService.listRecent(Long.parseLong(authentication.getName()), limit));
    }

    public record RecordLearningEventRequest(
            @NotBlank String eventType,
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
}
