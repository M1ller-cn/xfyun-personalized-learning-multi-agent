package com.novacloudedu.backend.interfaces.rest.learning;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacloudedu.backend.common.BaseResponse;
import com.novacloudedu.backend.common.ResultUtils;
import com.novacloudedu.backend.application.learning.command.RecordLearningEventCommand;
import com.novacloudedu.backend.application.learning.service.LearningEventApplicationService;
import com.novacloudedu.backend.infrastructure.ai.LangchainChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Personalized learning workspace used by the student-facing learning cockpit.
 * Profile extraction and evaluation use DeepSeek first and have deterministic,
 * course-grounded fallbacks so the core workflow remains available offline.
 */
@Slf4j
@RestController
@RequestMapping("/api/learning-workspace")
@RequiredArgsConstructor
public class LearningWorkspaceController {

    private static final String MODEL_ID = "deepseek/deepseek-chat";
    private static final Set<String> PROFILE_FACT_KEYS = Set.of(
            "stage", "foundation", "weakPoints", "preference", "pace", "activeCourseKey");

    private final JdbcTemplate jdbcTemplate;
    private final LangchainChatService langchainChatService;
    private final ObjectMapper objectMapper;
    private final LearningEventApplicationService learningEventService;

    @GetMapping("/workspace")
    public BaseResponse<WorkspaceResponse> workspace(
            Authentication authentication,
            @RequestParam(required = false) String courseKey,
            @RequestParam(required = false) String mode) {
        long userId = userId(authentication);
        LearnerProfile profile = loadProfile(userId);
        String selected = validCourseKey(courseKey)
                ? courseKey
                : profile != null ? profile.activeCourseKey() : "mit6006";
        String pathMode = normalizePathMode(mode == null ? loadPathMode(userId, selected) : mode);
        return ResultUtils.success(buildWorkspace(userId, profile, selected, null, pathMode));
    }

    @PostMapping("/profile/analyze")
    public BaseResponse<WorkspaceResponse> analyzeProfile(
            Authentication authentication,
            @RequestBody ProfileRequest request) {
        long userId = userId(authentication);
        String message = normalizeInput(request.message(), 1200);
        LearnerProfile previous = loadProfile(userId);
        String detectedCourse = detectCourse(message);
        String pendingCourse = loadPendingCourseIntent(userId);

        // A reply such as "保留并切换" normally has no course keyword. Keep the
        // requested course server-side until the learner has made that decision.
        if (pendingCourse != null && confirmsCourseSwitch(message)) {
            detectedCourse = pendingCourse;
        }

        if (previous != null && detectedCourse != null
                && !detectedCourse.equals(previous.activeCourseKey())
                && !confirmsCourseSwitch(message)) {
            savePendingCourseIntent(userId, detectedCourse, message);
            CourseDefinition oldCourse = course(previous.activeCourseKey());
            CourseDefinition newCourse = course(detectedCourse);
            String reply = "我听到你还想学习「" + newCourse.shortName() + "」。目前正在学习「"
                    + oldCourse.shortName() + "」，需要我保留原方向并把新课程加入下一阶段，"
                    + "还是现在切换到新课程？你可以回复“保留并切换”或“只学新课程”。";
            return ResultUtils.success(buildWorkspace(userId, previous, previous.activeCourseKey(), reply));
        }

        String selectedCourse = detectedCourse != null
                ? detectedCourse
                : previous != null ? previous.activeCourseKey() : "mit6006";
        LearnerProfile analyzed = analyzeWithAi(message, previous, selectedCourse);
        if (previous != null && !selectedCourse.equals(previous.activeCourseKey())) {
            analyzed = new LearnerProfile(analyzed.stage(),
                    "系统掌握" + course(selectedCourse).shortName() + "并完成对应练习与测评",
                    analyzed.foundation(), analyzed.weakPoints(), analyzed.preference(), analyzed.pace(),
                    selectedCourse, analyzed.revision());
        }
        saveProfile(userId, analyzed, message);
        if (previous != null && !selectedCourse.equals(previous.activeCourseKey())) {
            if (replacesExistingGoals(message)) {
                archiveActiveGoals(userId, "学生选择只保留新的当前目标");
            } else {
                promoteCurrentGoals(userId, "学生保留原目标并将新课程设为当前优先");
            }
            clearPendingCourseIntent(userId);
        }
        syncProfileGoalsAndFacts(userId, analyzed, message);
        recordPathRevision(userId, selectedCourse, loadPathMode(userId, selectedCourse),
                "画像更新后已根据当前目标和薄弱点重新生成路径", analyzed);

        String reply = previous == null
                ? "画像已经建立。我先把「" + course(selectedCourse).shortName()
                    + "」排成可执行路径，之后每次任务和测评都会继续更新画像。"
                : "我已经根据这次对话更新画像，并保留了你的历史进度。当前优先处理："
                    + analyzed.weakPoints() + "。";
        return ResultUtils.success(buildWorkspace(userId, analyzed, selectedCourse, reply));
    }

    @PostMapping("/course/select")
    public BaseResponse<WorkspaceResponse> selectCourse(
            Authentication authentication,
            @RequestBody CourseSelectionRequest request) {
        long userId = userId(authentication);
        LearnerProfile profile = loadProfile(userId);
        String selected = validCourseKey(request.courseKey()) ? request.courseKey() : "mit6006";
        if (profile != null) {
            profile = new LearnerProfile(profile.stage(), profile.goal(), profile.foundation(),
                    profile.weakPoints(), profile.preference(), profile.pace(), selected, profile.revision() + 1);
            saveProfile(userId, profile, "课程切换为 " + course(selected).shortName());
            promoteCurrentGoals(userId, "学生从课程选择器切换了当前学习课程");
            syncProfileGoalsAndFacts(userId, profile, "课程切换为 " + course(selected).shortName());
        }
        return ResultUtils.success(buildWorkspace(userId, profile, selected,
                "已切换到「" + course(selected).shortName() + "」，原课程进度仍然保留。"));
    }

    @PostMapping("/path/mode")
    public BaseResponse<WorkspaceResponse> selectPathMode(Authentication authentication,
                                                            @RequestBody PathModeRequest request) {
        long userId = userId(authentication);
        LearnerProfile profile = loadProfile(userId);
        String courseKey = validCourseKey(request.courseKey()) ? request.courseKey()
                : profile == null ? "mit6006" : profile.activeCourseKey();
        String mode = normalizePathMode(request.mode());
        jdbcTemplate.update("""
                INSERT INTO personalized_learning_path_preference (user_id, course_key, learning_mode, update_time)
                VALUES (?, ?, ?, NOW())
                ON CONFLICT (user_id, course_key) DO UPDATE SET learning_mode = EXCLUDED.learning_mode, update_time = NOW()
                """, userId, courseKey, mode);
        recordPathRevision(userId, courseKey, mode, "学生切换为" + pathModeLabel(mode) + "模式", profile);
        return ResultUtils.success(buildWorkspace(userId, profile, courseKey,
                "已切换为" + pathModeLabel(mode) + "模式。", mode));
    }

    @GetMapping("/path/history")
    public BaseResponse<List<PathRevision>> pathHistory(Authentication authentication,
                                                         @RequestParam(required = false) String courseKey) {
        long userId = userId(authentication);
        LearnerProfile profile = loadProfile(userId);
        String selected = validCourseKey(courseKey) ? courseKey
                : profile == null ? "mit6006" : profile.activeCourseKey();
        return ResultUtils.success(loadPathRevisions(userId, selected, 15));
    }

    @PostMapping("/task/complete")
    public BaseResponse<WorkspaceResponse> updateTask(
            Authentication authentication,
            @RequestBody TaskUpdateRequest request) {
        long userId = userId(authentication);
        String courseKey = validCourseKey(request.courseKey()) ? request.courseKey() : "mit6006";
        CourseTopic topic = topic(courseKey, request.topicId());
        int taskIndex = Math.max(0, Math.min(topic.tasks().size() - 1, request.taskIndex()));
        jdbcTemplate.update("""
                INSERT INTO personalized_learning_task
                    (user_id, course_key, topic_id, task_index, completed, update_time)
                VALUES (?, ?, ?, ?, ?, NOW())
                ON CONFLICT (user_id, course_key, topic_id, task_index)
                DO UPDATE SET completed = EXCLUDED.completed, update_time = NOW()
                """, userId, courseKey, topic.id(), taskIndex, request.completed() ? 1 : 0);
        if (request.completed()) {
            learningEventService.record(userId, new RecordLearningEventCommand(
                    "TASK_COMPLETED", course(courseKey).platformCourseId(), null, null, topic.title(),
                    topic.id() + ":" + taskIndex, "COMPUTER_SCIENCE", 0,
                    null, null, null, "LEARNING_PATH", Map.of("completed", true)));
        }
        LearnerProfile profile = loadProfile(userId);
        recordPathRevision(userId, courseKey, loadPathMode(userId, courseKey),
                request.completed() ? "完成任务：" + topic.title() + " - " + topic.tasks().get(taskIndex)
                        : "将任务恢复为待完成：" + topic.title(), profile);
        return ResultUtils.success(buildWorkspace(userId, profile, courseKey,
                request.completed() ? "任务已完成，学习进度已同步。" : "任务已恢复为待完成。"));
    }

    @PostMapping("/quiz/evaluate")
    public BaseResponse<EffectivenessEvaluationResponse> evaluate(
            Authentication authentication,
            @RequestBody EvaluationRequest request) {
        long userId = userId(authentication);
        String courseKey = validCourseKey(request.courseKey()) ? request.courseKey() : "mit6006";
        CourseTopic topic = topic(courseKey, request.nodeId());
        String assessmentType = normalizeAssessmentType(request.assessmentType());
        String answer = normalizeInput(request.answer(), 6000);
        EvaluationResponse result = answer.isBlank()
                ? new EvaluationResponse(0, "需要重做", "请先写出你的理解，我会按概念、步骤、复杂度和易错点给反馈。", "先回答核心定义。", false)
                : evaluateWithAi(topic, answer, assessmentType);

        boolean countsAsEvidence = !"RETENTION".equals(assessmentType)
                || isRetentionEligible(userId, courseKey, topic.id());
        String effectMessage = effectivenessMessage(assessmentType, result.passed(), countsAsEvidence);
        String question = assessmentQuestion(topic, assessmentType);

        jdbcTemplate.update("""
                INSERT INTO personalized_learning_evaluation
                    (user_id, course_key, topic_id, question, answer, score, level, feedback, create_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                """, userId, courseKey, topic.id(), question, answer,
                result.score(), result.level(), result.feedback());

        jdbcTemplate.update("""
                INSERT INTO learning_effectiveness_assessment
                    (user_id, course_key, topic_id, assessment_type, question, answer, score, passed,
                     counts_as_mastery_evidence, feedback, create_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                """, userId, courseKey, topic.id(), assessmentType, question, answer, result.score(),
                result.passed() ? 1 : 0, countsAsEvidence ? 1 : 0, result.feedback());

        learningEventService.record(userId, new RecordLearningEventCommand(
                "QUIZ_SUBMITTED", course(courseKey).platformCourseId(), null, null,
                topic.title(), topic.id(), "COMPUTER_SCIENCE", 0, result.score(), 100,
                result.passed() ? null : assessmentLabel(assessmentType) + "未达标", "LEARNING_PATH",
                Map.of("level", result.level(), "attemptPassed", result.passed(),
                        "assessmentType", assessmentType, "countsAsMasteryEvidence", countsAsEvidence)));

        if (result.score() >= 60 && ("CONCEPT".equals(assessmentType) || "TRANSFER".equals(assessmentType))) {
            refreshWeakPointAfterPass(userId, courseKey, topic.id());
        }
        recordPathRevision(userId, courseKey, loadPathMode(userId, courseKey),
                result.passed() ? "完成「" + topic.title() + "」" + assessmentLabel(assessmentType) + "，已更新掌握证据"
                        : "「" + topic.title() + "」" + assessmentLabel(assessmentType) + "未通过，已标记为待复习", loadProfile(userId));
        return ResultUtils.success(new EffectivenessEvaluationResponse(result.score(), result.level(), result.feedback(),
                result.nextStep(), result.passed(), assessmentType, countsAsEvidence, effectMessage));
    }

    @GetMapping("/effectiveness/overview")
    public BaseResponse<LearningEffectivenessOverview> learningEffectiveness(
            Authentication authentication, @RequestParam(required = false) String courseKey) {
        long userId = userId(authentication);
        LearnerProfile profile = loadProfile(userId);
        String selected = validCourseKey(courseKey) ? courseKey
                : profile == null ? "mit6006" : profile.activeCourseKey();
        CourseDefinition definition = course(selected);
        List<TopicEffectiveness> topics = definition.topics().stream()
                .map(topic -> loadTopicEffectiveness(userId, selected, topic))
                .toList();
        int verified = (int) topics.stream().filter(TopicEffectiveness::verified).count();
        int evidence = topics.stream().mapToInt(TopicEffectiveness::evidenceCount).sum();
        return ResultUtils.success(new LearningEffectivenessOverview(selected, topics, verified, evidence,
                "已验证掌握需要：概念理解、迁移应用和到期后的巩固复测均达到及格线。"));
    }

    @GetMapping("/profile/overview")
    public BaseResponse<ProfileOverview> profileOverview(Authentication authentication) {
        long userId = userId(authentication);
        return ResultUtils.success(new ProfileOverview(loadGoals(userId), loadProfileFacts(userId),
                loadAdjustments(userId, 12)));
    }

    @PostMapping("/profile/goals")
    public BaseResponse<ProfileGoal> createGoal(Authentication authentication, @RequestBody GoalRequest request) {
        long userId = userId(authentication);
        LearnerProfile profile = loadProfile(userId);
        String courseKey = validCourseKey(request.courseKey()) ? request.courseKey()
                : profile == null ? "mit6006" : profile.activeCourseKey();
        String title = normalizeInput(request.title(), 512);
        if (title.isBlank()) throw new IllegalArgumentException("学习目标不能为空");
        String priority = "LONG_TERM".equalsIgnoreCase(request.priority()) ? "LONG_TERM" : "CURRENT";
        if ("CURRENT".equals(priority)) promoteCurrentGoals(userId, "学生新增了当前优先目标");
        jdbcTemplate.update("""
                INSERT INTO personalized_learning_goal
                    (user_id, course_key, title, priority, status, confirmed, source_evidence, create_time, update_time)
                VALUES (?, ?, ?, ?, 'ACTIVE', 1, '学生手动新增', NOW(), NOW())
                ON CONFLICT (user_id, course_key, title) DO UPDATE SET
                    priority = EXCLUDED.priority, status = 'ACTIVE', confirmed = 1,
                    source_evidence = EXCLUDED.source_evidence, update_time = NOW()
                """, userId, courseKey, title, priority);
        recordAdjustment(userId, "GOAL_CREATED", "已新增" + ("CURRENT".equals(priority) ? "当前优先" : "长期") + "目标：" + title);
        return ResultUtils.success(findGoal(userId, courseKey, title));
    }

    @PutMapping("/profile/goals/{goalId}")
    public BaseResponse<ProfileGoal> updateGoal(Authentication authentication, @PathVariable long goalId,
                                                 @RequestBody GoalUpdateRequest request) {
        long userId = userId(authentication);
        ProfileGoal existing = findGoal(userId, goalId);
        String priority = request.priority() == null ? existing.priority()
                : "LONG_TERM".equalsIgnoreCase(request.priority()) ? "LONG_TERM" : "CURRENT";
        if ("CURRENT".equals(priority) && !"CURRENT".equals(existing.priority())) {
            promoteCurrentGoals(userId, "学生调整了当前优先目标");
        }
        String title = request.title() == null ? existing.title() : normalizeInput(request.title(), 512);
        if (title.isBlank()) throw new IllegalArgumentException("学习目标不能为空");
        jdbcTemplate.update("""
                UPDATE personalized_learning_goal SET title = ?, priority = ?, confirmed = ?, update_time = NOW()
                WHERE id = ? AND user_id = ?
                """, title, priority, request.confirmed() == null ? existing.confirmed() ? 1 : 0 : request.confirmed() ? 1 : 0,
                goalId, userId);
        recordAdjustment(userId, "GOAL_UPDATED", "已更新学习目标：" + title);
        return ResultUtils.success(findGoal(userId, goalId));
    }

    @DeleteMapping("/profile/goals/{goalId}")
    public BaseResponse<Boolean> archiveGoal(Authentication authentication, @PathVariable long goalId) {
        long userId = userId(authentication);
        ProfileGoal existing = findGoal(userId, goalId);
        jdbcTemplate.update("""
                UPDATE personalized_learning_goal SET status = 'ARCHIVED', update_time = NOW()
                WHERE id = ? AND user_id = ?
                """, goalId, userId);
        recordAdjustment(userId, "GOAL_ARCHIVED", "已停止目标：" + existing.title());
        return ResultUtils.success(true);
    }

    @PutMapping("/profile/facts/{factKey}")
    public BaseResponse<ProfileFact> updateProfileFact(Authentication authentication, @PathVariable String factKey,
                                                        @RequestBody FactUpdateRequest request) {
        long userId = userId(authentication);
        if (!PROFILE_FACT_KEYS.contains(factKey)) throw new IllegalArgumentException("不支持的画像字段");
        String value = normalizeInput(request.value(), 1000);
        if (value.isBlank()) throw new IllegalArgumentException("画像内容不能为空");
        jdbcTemplate.update("""
                INSERT INTO personalized_learning_profile_fact
                    (user_id, fact_key, fact_value, source_evidence, confirmed, update_time)
                VALUES (?, ?, ?, ?, ?, NOW())
                ON CONFLICT (user_id, fact_key) DO UPDATE SET
                    fact_value = EXCLUDED.fact_value, source_evidence = EXCLUDED.source_evidence,
                    confirmed = EXCLUDED.confirmed, update_time = NOW()
                """, userId, factKey, value, "学生手动确认或修改", request.confirmed() ? 1 : 0);
        recordAdjustment(userId, "PROFILE_FACT_UPDATED", "已" + (request.confirmed() ? "确认" : "修改") + "画像字段：" + factKey);
        return ResultUtils.success(findProfileFact(userId, factKey));
    }

    private WorkspaceResponse buildWorkspace(long userId, LearnerProfile storedProfile,
                                               String selectedCourse, String assistantReply) {
        return buildWorkspace(userId, storedProfile, selectedCourse, assistantReply,
                loadPathMode(userId, selectedCourse));
    }

    private WorkspaceResponse buildWorkspace(long userId, LearnerProfile storedProfile,
                                               String selectedCourse, String assistantReply, String pathMode) {
        CourseDefinition definition = course(selectedCourse);
        LearnerProfile profile = storedProfile != null ? storedProfile : emptyProfile(selectedCourse);
        Map<String, Set<Integer>> taskState = loadTaskState(userId, selectedCourse);
        Map<String, EvaluationState> evaluations = loadEvaluationState(userId, selectedCourse);

        List<PathNode> path = new ArrayList<>();
        for (int i = 0; i < definition.topics().size(); i++) {
            CourseTopic item = definition.topics().get(i);
            Set<Integer> completed = taskState.getOrDefault(item.id(), Set.of());
            EvaluationState evaluation = evaluations.getOrDefault(item.id(), new EvaluationState(0, 0));
            int progress = Math.min(100, completed.size() * 20
                    + (evaluation.bestScore() >= 60 ? 40 : Math.round(evaluation.bestScore() * 40f / 60f)));
            boolean passed = completed.size() >= item.tasks().size() && evaluation.bestScore() >= 60;
            boolean priority = containsAny(profile.weakPoints(), item.title(), item.keywords())
                    || ("EXAM_SPRINT".equals(pathMode) && evaluation.bestScore() < 60);
            boolean priorPassed = i == 0 || path.get(i - 1).passed();
            boolean currentRecommendation = path.stream().allMatch(PathNode::passed);
            boolean available = "FREE_EXPLORATION".equals(pathMode) || priorPassed || currentRecommendation;
            boolean reviewRecommended = evaluation.attempts() > 0 && evaluation.bestScore() < 60;
            int estimatedMinutes = item.tasks().size() * 15 + 20;
            String recommendation = !available ? "请先完成上一知识点，再进入本节点"
                    : reviewRecommended ? "上次检测未通过，建议先完成补救练习"
                    : priority ? "与你当前薄弱点直接相关"
                    : "EXAM_SPRINT".equals(pathMode) ? "考前冲刺：优先保留高频核心任务"
                    : "FREE_EXPLORATION".equals(pathMode) ? "自由探索：可直接进入，但建议参考先修顺序"
                    : "按课程先修顺序安排";
            path.add(new PathNode(item.id(), item.title(), item.summary(), i + 1, progress,
                    item.tasks(), completed.stream().sorted().toList(), evaluation.bestScore(),
                    evaluation.attempts(), passed, priority, available, reviewRecommended, estimatedMinutes, recommendation,
                    "/course/" + definition.platformCourseId(),
                    "/course/" + definition.platformCourseId(),
                    "/grading?mode=code&course=" + definition.platformCourseId(),
                    item.question()));
        }

        int overall = path.isEmpty() ? 0
                : Math.round(path.stream().mapToInt(PathNode::progress).sum() / (float) path.size());
        List<MindMapNode> mindMap = buildMindMap(definition, path);
        List<ResourceCard> resources = personalizedResources(definition, profile);
        List<AgentRun> agents = agentRuns(storedProfile != null, overall);

        CourseInfo courseInfo = new CourseInfo(definition.key(), definition.platformCourseId(),
                definition.title(), definition.sourceName(), "/course/" + definition.platformCourseId(),
                definition.description(), definition.topics());
        List<CourseOption> options = COURSES.stream()
                .map(item -> new CourseOption(item.key(), item.platformCourseId(), item.shortName(),
                        item.title(), item.description()))
                .toList();

        return new WorkspaceResponse(courseInfo, options, profile, storedProfile != null, pathMode,
                assistantReply, path, resources, mindMap, agents, overall, LocalDateTime.now().toString());
    }

    private LearnerProfile analyzeWithAi(String message, LearnerProfile previous, String courseKey) {
        String previousText = previous == null ? "无历史画像" : objectMapper.valueToTree(previous).toString();
        String systemPrompt = """
                你是高校个性化学习平台的画像分析 Agent。请仅输出 JSON，不要 Markdown。
                必须包含 stage、goal、foundation、weakPoints、preference、pace 六个字符串字段。
                结合历史画像增量更新，不要因一次新兴趣直接抹掉旧目标。表达简明、具体、可执行。
                不虚构学生未提供的专业、成绩或经历。
                """;
        String userPrompt = "当前课程：" + course(courseKey).title()
                + "\n历史画像：" + previousText + "\n学生消息：" + message;
        try {
            String raw = langchainChatService.chat(MODEL_ID, systemPrompt, userPrompt);
            JsonNode json = parseJsonObject(raw);
            return new LearnerProfile(
                    textOr(json, "stage", fallbackStage(message, previous)),
                    textOr(json, "goal", fallbackGoal(message, courseKey, previous)),
                    textOr(json, "foundation", fallbackFoundation(message, previous)),
                    textOr(json, "weakPoints", fallbackWeakPoints(message, courseKey)),
                    textOr(json, "preference", fallbackPreference(message, previous)),
                    textOr(json, "pace", fallbackPace(message, previous)),
                    courseKey,
                    previous == null ? 1 : previous.revision() + 1);
        } catch (Exception ex) {
            log.warn("DeepSeek profile extraction failed, using grounded fallback: {}", ex.getMessage());
            return fallbackProfile(message, previous, courseKey);
        }
    }

    private EvaluationResponse evaluateWithAi(CourseTopic topic, String answer, String assessmentType) {
        String systemPrompt = """
                你是高校课程评测 Agent。只依据给定知识点、评分关键词和参考要点评分。
                仅输出 JSON：score(0-100整数)、level、feedback、nextStep。
                60分及格，85分优秀。反馈必须指出答对的内容和缺失点，不得只按字数评分。
                """;
        String userPrompt = "测评类型：" + assessmentLabel(assessmentType) + "\n知识点：" + topic.title() + "\n说明：" + topic.summary()
                + "\n评分关键词：" + String.join("、", topic.keywords())
                + "\n题目：" + assessmentQuestion(topic, assessmentType) + "\n学生答案：" + answer;
        try {
            JsonNode json = parseJsonObject(langchainChatService.chat(MODEL_ID, systemPrompt, userPrompt));
            int score = Math.max(0, Math.min(100, json.path("score").asInt(0)));
            String level = score >= 85 ? "优秀" : score >= 60 ? "及格" : "需要重做";
            return new EvaluationResponse(score, level,
                    textOr(json, "feedback", "已完成基于课程要点的评分。"),
                    textOr(json, "nextStep", "根据缺失要点补充后再试一次。"), score >= 60);
        } catch (Exception ex) {
            log.warn("DeepSeek evaluation failed, using keyword rubric: {}", ex.getMessage());
            return rubricEvaluation(topic, answer);
        }
    }

    private EvaluationResponse rubricEvaluation(CourseTopic topic, String answer) {
        String normalized = answer.toLowerCase(Locale.ROOT);
        long hits = topic.keywords().stream()
                .filter(keyword -> normalized.contains(keyword.toLowerCase(Locale.ROOT)))
                .count();
        int knowledgeScore = Math.round(hits * 70f / Math.max(1, topic.keywords().size()));
        int structureScore = Math.min(30, answer.length() / 8);
        int score = Math.min(96, knowledgeScore + structureScore);
        String level = score >= 85 ? "优秀" : score >= 60 ? "及格" : "需要重做";
        List<String> missing = topic.keywords().stream()
                .filter(keyword -> !normalized.contains(keyword.toLowerCase(Locale.ROOT)))
                .limit(3).toList();
        String feedback = missing.isEmpty()
                ? "核心要点覆盖完整，可以再用一个边界案例验证理解。"
                : "已经覆盖部分核心概念，还需要补充：" + String.join("、", missing) + "。";
        return new EvaluationResponse(score, level, feedback,
                score >= 60 ? "继续完成本节点任务清单。" : "按缺失关键词补充答案后重新提交。", score >= 60);
    }

    private void saveProfile(long userId, LearnerProfile profile, String conversation) {
        jdbcTemplate.update("""
                INSERT INTO personalized_learning_profile
                    (user_id, stage, goal, foundation, weak_points, preference, pace,
                     active_course_key, conversation_summary, revision, initialized, create_time, update_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    stage = EXCLUDED.stage,
                    goal = EXCLUDED.goal,
                    foundation = EXCLUDED.foundation,
                    weak_points = EXCLUDED.weak_points,
                    preference = EXCLUDED.preference,
                    pace = EXCLUDED.pace,
                    active_course_key = EXCLUDED.active_course_key,
                    conversation_summary = EXCLUDED.conversation_summary,
                    revision = EXCLUDED.revision,
                    initialized = 1,
                    update_time = NOW()
                """, userId, profile.stage(), profile.goal(), profile.foundation(), profile.weakPoints(),
                profile.preference(), profile.pace(), profile.activeCourseKey(), conversation, profile.revision());
    }

    private LearnerProfile loadProfile(long userId) {
        List<LearnerProfile> rows = jdbcTemplate.query("""
                SELECT stage, goal, foundation, weak_points, preference, pace, active_course_key, revision
                FROM personalized_learning_profile
                WHERE user_id = ? AND initialized = 1
                """, (rs, rowNum) -> new LearnerProfile(
                rs.getString("stage"), rs.getString("goal"), rs.getString("foundation"),
                rs.getString("weak_points"), rs.getString("preference"), rs.getString("pace"),
                rs.getString("active_course_key"), rs.getInt("revision")), userId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private void syncProfileGoalsAndFacts(long userId, LearnerProfile profile, String evidence) {
        jdbcTemplate.update("""
                INSERT INTO personalized_learning_goal
                    (user_id, course_key, title, priority, status, confirmed, source_evidence, create_time, update_time)
                VALUES (?, ?, ?, 'CURRENT', 'ACTIVE', 0, ?, NOW(), NOW())
                ON CONFLICT (user_id, course_key, title) DO UPDATE SET
                    priority = 'CURRENT', status = 'ACTIVE', source_evidence = EXCLUDED.source_evidence,
                    update_time = NOW()
                """, userId, profile.activeCourseKey(), profile.goal(), evidence);
        upsertProfileFact(userId, "stage", profile.stage(), evidence);
        upsertProfileFact(userId, "foundation", profile.foundation(), evidence);
        upsertProfileFact(userId, "weakPoints", profile.weakPoints(), evidence);
        upsertProfileFact(userId, "preference", profile.preference(), evidence);
        upsertProfileFact(userId, "pace", profile.pace(), evidence);
        upsertProfileFact(userId, "activeCourseKey", profile.activeCourseKey(), evidence);
        recordAdjustment(userId, "PROFILE_SYNCED", "画像已更新：当前优先「"
                + course(profile.activeCourseKey()).shortName() + "」，薄弱点聚焦“" + profile.weakPoints() + "”。");
    }

    private void upsertProfileFact(long userId, String key, String value, String evidence) {
        jdbcTemplate.update("""
                INSERT INTO personalized_learning_profile_fact
                    (user_id, fact_key, fact_value, source_evidence, confirmed, update_time)
                VALUES (?, ?, ?, ?, 0, NOW())
                ON CONFLICT (user_id, fact_key) DO UPDATE SET
                    fact_value = EXCLUDED.fact_value, source_evidence = EXCLUDED.source_evidence,
                    update_time = NOW()
                """, userId, key, value, evidence);
    }

    private List<ProfileGoal> loadGoals(long userId) {
        return jdbcTemplate.query("""
                SELECT id, course_key, title, priority, status, confirmed, source_evidence, update_time
                FROM personalized_learning_goal WHERE user_id = ?
                ORDER BY CASE priority WHEN 'CURRENT' THEN 0 ELSE 1 END, update_time DESC
                """, (rs, rowNum) -> new ProfileGoal(rs.getLong("id"), rs.getString("course_key"),
                rs.getString("title"), rs.getString("priority"), rs.getString("status"),
                rs.getInt("confirmed") == 1, rs.getString("source_evidence"),
                rs.getTimestamp("update_time").toLocalDateTime().toString()), userId);
    }

    private List<ProfileFact> loadProfileFacts(long userId) {
        return jdbcTemplate.query("""
                SELECT fact_key, fact_value, source_evidence, confirmed, update_time
                FROM personalized_learning_profile_fact WHERE user_id = ?
                ORDER BY fact_key
                """, (rs, rowNum) -> new ProfileFact(rs.getString("fact_key"), rs.getString("fact_value"),
                rs.getString("source_evidence"), rs.getInt("confirmed") == 1,
                rs.getTimestamp("update_time").toLocalDateTime().toString()), userId);
    }

    private List<ProfileAdjustment> loadAdjustments(long userId, int limit) {
        return jdbcTemplate.query("""
                SELECT id, adjustment_type, message, create_time
                FROM personalized_learning_adjustment WHERE user_id = ?
                ORDER BY create_time DESC LIMIT ?
                """, (rs, rowNum) -> new ProfileAdjustment(rs.getLong("id"), rs.getString("adjustment_type"),
                rs.getString("message"), rs.getTimestamp("create_time").toLocalDateTime().toString()), userId, limit);
    }

    private ProfileGoal findGoal(long userId, long goalId) {
        return loadGoals(userId).stream().filter(goal -> goal.id() == goalId).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("学习目标不存在或无权操作"));
    }

    private ProfileGoal findGoal(long userId, String courseKey, String title) {
        return loadGoals(userId).stream()
                .filter(goal -> goal.courseKey().equals(courseKey) && goal.title().equals(title))
                .findFirst().orElseThrow(() -> new IllegalArgumentException("学习目标保存失败"));
    }

    private ProfileFact findProfileFact(long userId, String factKey) {
        return loadProfileFacts(userId).stream().filter(fact -> fact.key().equals(factKey)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("画像字段保存失败"));
    }

    private void promoteCurrentGoals(long userId, String reason) {
        int changed = jdbcTemplate.update("""
                UPDATE personalized_learning_goal SET priority = 'LONG_TERM', update_time = NOW()
                WHERE user_id = ? AND status = 'ACTIVE' AND priority = 'CURRENT'
                """, userId);
        if (changed > 0) recordAdjustment(userId, "GOAL_PROMOTED", reason);
    }

    private void archiveActiveGoals(long userId, String reason) {
        int changed = jdbcTemplate.update("""
                UPDATE personalized_learning_goal SET status = 'ARCHIVED', update_time = NOW()
                WHERE user_id = ? AND status = 'ACTIVE'
                """, userId);
        if (changed > 0) recordAdjustment(userId, "GOAL_REPLACED", reason);
    }

    private void recordAdjustment(long userId, String type, String message) {
        jdbcTemplate.update("""
                INSERT INTO personalized_learning_adjustment (user_id, adjustment_type, message, create_time)
                VALUES (?, ?, ?, NOW())
                """, userId, type, message);
    }

    private String loadPendingCourseIntent(long userId) {
        List<String> rows = jdbcTemplate.query("""
                SELECT target_course_key FROM personalized_learning_pending_course_intent WHERE user_id = ?
                """, (rs, rowNum) -> rs.getString("target_course_key"), userId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private void savePendingCourseIntent(long userId, String courseKey, String message) {
        jdbcTemplate.update("""
                INSERT INTO personalized_learning_pending_course_intent
                    (user_id, target_course_key, source_message, create_time)
                VALUES (?, ?, ?, NOW())
                ON CONFLICT (user_id) DO UPDATE SET target_course_key = EXCLUDED.target_course_key,
                    source_message = EXCLUDED.source_message, create_time = NOW()
                """, userId, courseKey, message);
    }

    private void clearPendingCourseIntent(long userId) {
        jdbcTemplate.update("DELETE FROM personalized_learning_pending_course_intent WHERE user_id = ?", userId);
    }

    private String loadPathMode(long userId, String courseKey) {
        List<String> rows = jdbcTemplate.query("""
                SELECT learning_mode FROM personalized_learning_path_preference
                WHERE user_id = ? AND course_key = ?
                """, (rs, rowNum) -> rs.getString("learning_mode"), userId, courseKey);
        return rows.isEmpty() ? "RECOMMENDED" : normalizePathMode(rows.get(0));
    }

    private String normalizePathMode(String mode) {
        if ("FREE_EXPLORATION".equalsIgnoreCase(mode)) return "FREE_EXPLORATION";
        if ("EXAM_SPRINT".equalsIgnoreCase(mode)) return "EXAM_SPRINT";
        return "RECOMMENDED";
    }

    private String pathModeLabel(String mode) {
        return switch (normalizePathMode(mode)) {
            case "FREE_EXPLORATION" -> "自由探索";
            case "EXAM_SPRINT" -> "考前冲刺";
            default -> "推荐顺序";
        };
    }

    private void recordPathRevision(long userId, String courseKey, String mode, String reason, LearnerProfile profile) {
        try {
            Map<String, Object> snapshot = new LinkedHashMap<>();
            snapshot.put("profileRevision", profile == null ? 0 : profile.revision());
            snapshot.put("weakPoints", profile == null ? "尚未诊断" : profile.weakPoints());
            snapshot.put("activeCourseKey", profile == null ? courseKey : profile.activeCourseKey());
            jdbcTemplate.update("""
                    INSERT INTO personalized_learning_path_revision
                        (user_id, course_key, learning_mode, reason, snapshot, create_time)
                    VALUES (?, ?, ?, ?, CAST(? AS jsonb), NOW())
                    """, userId, courseKey, normalizePathMode(mode), reason,
                    objectMapper.writeValueAsString(snapshot));
        } catch (Exception ex) {
            log.warn("Unable to store learning path revision: {}", ex.getMessage());
        }
    }

    private List<PathRevision> loadPathRevisions(long userId, String courseKey, int limit) {
        return jdbcTemplate.query("""
                SELECT id, learning_mode, reason, create_time
                FROM personalized_learning_path_revision
                WHERE user_id = ? AND course_key = ?
                ORDER BY create_time DESC LIMIT ?
                """, (rs, rowNum) -> new PathRevision(rs.getLong("id"), rs.getString("learning_mode"),
                rs.getString("reason"), rs.getTimestamp("create_time").toLocalDateTime().toString()),
                userId, courseKey, limit);
    }

    private Map<String, Set<Integer>> loadTaskState(long userId, String courseKey) {
        Map<String, Set<Integer>> state = new HashMap<>();
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT topic_id, task_index FROM personalized_learning_task
                WHERE user_id = ? AND course_key = ? AND completed = 1
                """, userId, courseKey);
        for (Map<String, Object> row : rows) {
            String topicId = String.valueOf(row.get("topic_id"));
            int taskIndex = ((Number) row.get("task_index")).intValue();
            state.computeIfAbsent(topicId, ignored -> new HashSet<>()).add(taskIndex);
        }
        return state;
    }

    private Map<String, EvaluationState> loadEvaluationState(long userId, String courseKey) {
        Map<String, EvaluationState> state = new HashMap<>();
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT topic_id, MAX(score) AS best_score, COUNT(*) AS attempts
                FROM personalized_learning_evaluation
                WHERE user_id = ? AND course_key = ?
                GROUP BY topic_id
                """, userId, courseKey);
        for (Map<String, Object> row : rows) {
            state.put(String.valueOf(row.get("topic_id")), new EvaluationState(
                    ((Number) row.get("best_score")).intValue(),
                    ((Number) row.get("attempts")).intValue()));
        }
        return state;
    }

    private TopicEffectiveness loadTopicEffectiveness(long userId, String courseKey, CourseTopic topic) {
        List<AssessmentEvidence> attempts = jdbcTemplate.query("""
                SELECT assessment_type, score, passed, counts_as_mastery_evidence, create_time
                FROM learning_effectiveness_assessment
                WHERE user_id = ? AND course_key = ? AND topic_id = ?
                ORDER BY create_time ASC
                """, (rs, rowNum) -> new AssessmentEvidence(rs.getString("assessment_type"),
                rs.getInt("score"), rs.getInt("passed") == 1, rs.getInt("counts_as_mastery_evidence") == 1,
                rs.getTimestamp("create_time").toLocalDateTime()), userId, courseKey, topic.id());

        int diagnostic = bestScore(attempts, "DIAGNOSTIC");
        int concept = bestScore(attempts, "CONCEPT");
        int transfer = bestScore(attempts, "TRANSFER");
        LocalDateTime conceptPassedAt = attempts.stream()
                .filter(item -> "CONCEPT".equals(item.type()) && item.passed())
                .map(AssessmentEvidence::createdAt).reduce((first, second) -> second).orElse(null);
        LocalDateTime retentionDueAt = conceptPassedAt == null ? null : conceptPassedAt.plusDays(7);
        boolean retentionVerified = retentionDueAt != null && attempts.stream().anyMatch(item ->
                "RETENTION".equals(item.type()) && item.passed() && item.countsAsEvidence()
                        && !item.createdAt().isBefore(retentionDueAt));
        int retention = bestScore(attempts.stream()
                .filter(item -> retentionDueAt == null || !item.createdAt().isBefore(retentionDueAt)).toList(), "RETENTION");
        int evidenceCount = (int) attempts.stream().filter(AssessmentEvidence::countsAsEvidence).count();
        boolean diagnosticPassed = diagnostic >= 0;
        boolean conceptPassed = concept >= 60;
        boolean transferPassed = transfer >= 60;
        boolean verified = diagnosticPassed && conceptPassed && transferPassed && retentionVerified;
        String status;
        String nextAction;
        if (!diagnosticPassed) {
            status = "待诊断";
            nextAction = "先完成诊断，建立学习前的基线。";
        } else if (!conceptPassed) {
            status = "需要补救";
            nextAction = "回到讲解与例题后，重做概念理解检测。";
        } else if (!transferPassed) {
            status = "已理解待迁移";
            nextAction = "完成迁移挑战，证明你能在新场景中使用该知识点。";
        } else if (retentionDueAt != null && LocalDateTime.now().isBefore(retentionDueAt)) {
            status = "待巩固复测";
            nextAction = "请在 " + retentionDueAt.toLocalDate() + " 后完成不看资料的巩固复测。";
        } else if (!retentionVerified) {
            status = "待延迟复测";
            nextAction = "现在进行巩固复测，验证一段时间后仍能掌握。";
        } else {
            status = "已验证掌握";
            nextAction = "已具备可追溯的学习证据，可进入后续知识点。";
        }
        Integer gain = diagnostic < 0 || concept < 0 ? null : concept - diagnostic;
        return new TopicEffectiveness(topic.id(), topic.title(), diagnostic, concept, transfer, retention,
                evidenceCount, gain, retentionDueAt == null ? null : retentionDueAt.toString(),
                verified, status, nextAction);
    }

    private int bestScore(List<AssessmentEvidence> attempts, String type) {
        return attempts.stream().filter(item -> type.equals(item.type()))
                .mapToInt(AssessmentEvidence::score).max().orElse(-1);
    }

    private boolean isRetentionEligible(long userId, String courseKey, String topicId) {
        List<LocalDateTime> rows = jdbcTemplate.query("""
                SELECT MAX(create_time) AS passed_at FROM learning_effectiveness_assessment
                WHERE user_id = ? AND course_key = ? AND topic_id = ?
                    AND assessment_type = 'CONCEPT' AND passed = 1
                """, (rs, rowNum) -> rs.getTimestamp("passed_at") == null ? null
                : rs.getTimestamp("passed_at").toLocalDateTime(), userId, courseKey, topicId);
        return !rows.isEmpty() && rows.get(0) != null && !LocalDateTime.now().isBefore(rows.get(0).plusDays(7));
    }

    private String normalizeAssessmentType(String type) {
        if ("DIAGNOSTIC".equalsIgnoreCase(type)) return "DIAGNOSTIC";
        if ("TRANSFER".equalsIgnoreCase(type)) return "TRANSFER";
        if ("RETENTION".equalsIgnoreCase(type)) return "RETENTION";
        return "CONCEPT";
    }

    private String assessmentLabel(String type) {
        return switch (normalizeAssessmentType(type)) {
            case "DIAGNOSTIC" -> "诊断测验";
            case "TRANSFER" -> "迁移挑战";
            case "RETENTION" -> "巩固复测";
            default -> "概念理解检测";
        };
    }

    private String assessmentQuestion(CourseTopic topic, String type) {
        return switch (normalizeAssessmentType(type)) {
            case "DIAGNOSTIC" -> "开始学习前，请用自己的话回答：" + topic.question()
                    + "；同时说明你最没有把握的部分。";
            case "TRANSFER" -> "迁移挑战：面对一个没有见过的新场景，你会怎样运用「" + topic.title()
                    + "」解决问题？请说明判断依据、步骤和一个边界情况。";
            case "RETENTION" -> "巩固复测：不查资料，重新解释「" + topic.title()
                    + "」的核心思路，并给出一个易错点或反例。";
            default -> topic.question();
        };
    }

    private String effectivenessMessage(String type, boolean passed, boolean countsAsEvidence) {
        if ("RETENTION".equals(type) && !countsAsEvidence) {
            return "本次复测已记录，但距离概念通过不足 7 天，不作为长期记忆的验证证据。";
        }
        if (!passed) return "这次结果已进入学习证据链，系统会安排针对性补救。";
        return switch (type) {
            case "DIAGNOSTIC" -> "已建立学习前基线；后续结果会显示相对提升。";
            case "TRANSFER" -> "已验证在新场景中的应用能力；等待到期巩固复测。";
            case "RETENTION" -> "延迟复测通过，长期记忆证据已补齐。";
            default -> "概念理解通过；下一步请完成迁移挑战，而不只停留在原题。";
        };
    }

    private void refreshWeakPointAfterPass(long userId, String courseKey, String topicId) {
        LearnerProfile profile = loadProfile(userId);
        if (profile == null) return;
        CourseDefinition definition = course(courseKey);
        int index = 0;
        for (int i = 0; i < definition.topics().size(); i++) {
            if (definition.topics().get(i).id().equals(topicId)) index = i;
        }
        CourseTopic next = definition.topics().get(Math.min(index + 1, definition.topics().size() - 1));
        String nextWeak = next.id().equals(topicId)
                ? "本课程综合应用与错题复盘"
                : next.title() + "的核心概念与实践";
        jdbcTemplate.update("""
                UPDATE personalized_learning_profile
                SET weak_points = ?, revision = revision + 1, update_time = NOW()
                WHERE user_id = ?
                """, nextWeak, userId);
    }

    private List<MindMapNode> buildMindMap(CourseDefinition definition, List<PathNode> path) {
        Map<String, Boolean> passed = new HashMap<>();
        path.forEach(node -> passed.put(node.id(), node.passed()));
        List<MindMapNode> nodes = new ArrayList<>();
        nodes.add(new MindMapNode("root", definition.shortName(), null, false, "course"));
        for (CourseTopic topic : definition.topics()) {
            nodes.add(new MindMapNode(topic.id(), topic.title(), "root",
                    passed.getOrDefault(topic.id(), false), "module"));
            for (int i = 0; i < Math.min(4, topic.keywords().size()); i++) {
                nodes.add(new MindMapNode(topic.id() + "-" + i, topic.keywords().get(i), topic.id(),
                        passed.getOrDefault(topic.id(), false), "knowledge"));
            }
        }
        return nodes;
    }

    private List<ResourceCard> personalizedResources(CourseDefinition course, LearnerProfile profile) {
        String focus = profile.weakPoints();
        return List.of(
                new ResourceCard("讲解文档", "本周核心讲义", "围绕“" + focus + "”整理概念、例子与易错点。", "Content Agent", "/course/" + course.platformCourseId(), "已就绪"),
                new ResourceCard("图解文档", "课程知识树", "从课程主干展开到关键概念，节点通过后自动变绿。", "Graph Agent", "#mind-map", "已就绪"),
                new ResourceCard("个性化练习", "薄弱点专项题", "按当前画像生成理解题、边界题和综合题。", "Exercise Agent", "#assessment", "可生成"),
                new ResourceCard("视频学习", "对应章节视频", "在平台课程页内继续学习，不打断当前学习流程。", "Media Agent", "/course/" + course.platformCourseId(), "已匹配"),
                new ResourceCard("代码实操", "代码评测工作台", "编写代码、配置输入与预期输出，并获得 AI 错因分析。", "Coding Agent", "/grading?mode=code", "可使用"),
                new ResourceCard("拓展阅读", "课程知识库延伸", "由本地 RAG 提供课程内依据和必要的补充解释。", "RAG Agent", "/ai-chat/1", "5库可检索")
        );
    }

    private List<AgentRun> agentRuns(boolean initialized, int progress) {
        return List.of(
                new AgentRun("画像分析", "提取6维画像并保留历史目标", initialized ? "完成" : "等待画像", "Profile Agent"),
                new AgentRun("知识检索", "从5门课程本地知识库召回依据", "运行中", "Course RAG Agent"),
                new AgentRun("路径规划", "按先修关系和薄弱点安排顺序", initialized ? "完成" : "待生成", "Planner Agent"),
                new AgentRun("资源编排", "组合文档、视频、题目、代码和阅读", initialized ? "完成" : "待生成", "Resource Agent"),
                new AgentRun("学习评估", "评分并更新节点与画像", progress > 0 ? "已同步" : "等待作答", "Evaluator Agent"),
                new AgentRun("安全校验", "限制无依据结论并标记课程来源", "启用", "Safety Agent")
        );
    }

    private LearnerProfile fallbackProfile(String message, LearnerProfile previous, String courseKey) {
        return new LearnerProfile(fallbackStage(message, previous), fallbackGoal(message, courseKey, previous),
                fallbackFoundation(message, previous), fallbackWeakPoints(message, courseKey),
                fallbackPreference(message, previous), fallbackPace(message, previous), courseKey,
                previous == null ? 1 : previous.revision() + 1);
    }

    private String fallbackStage(String message, LearnerProfile previous) {
        if (message.contains("大一")) return "大学一年级学习者";
        if (message.contains("大二")) return "大学二年级学习者";
        if (message.contains("考研")) return "考研备考学习者";
        return previous != null ? previous.stage() : "高校计算机课程学习者";
    }

    private String fallbackGoal(String message, String courseKey, LearnerProfile previous) {
        if (message.contains("期末")) return "完成" + course(courseKey).shortName() + "期末复习并通过综合测评";
        if (message.contains("项目")) return "完成" + course(courseKey).shortName() + "项目实践并能独立解释实现";
        return previous != null ? previous.goal() : "系统掌握" + course(courseKey).shortName() + "并完成课程实践";
    }

    private String fallbackFoundation(String message, LearnerProfile previous) {
        if (message.contains("零基础") || message.contains("没学过")) return "零基础，需要从概念和最小示例开始";
        if (message.contains("基础薄弱") || message.contains("总做错")) return "有过学习经历，但概念迁移和边界情况不稳定";
        return previous != null ? previous.foundation() : "具备基础编程能力，需要通过任务进一步诊断";
    }

    private String fallbackWeakPoints(String message, String courseKey) {
        CourseDefinition definition = course(courseKey);
        return definition.topics().stream()
                .filter(item -> containsAny(message, item.title(), item.keywords()))
                .map(CourseTopic::title)
                .findFirst()
                .map(title -> title + "的核心概念、边界情况与实践")
                .orElse(definition.topics().get(0).title() + "的核心概念与实践");
    }

    private String fallbackPreference(String message, LearnerProfile previous) {
        List<String> preferences = new ArrayList<>();
        if (message.contains("视频")) preferences.add("视频讲解");
        if (message.contains("题") || message.contains("刷题")) preferences.add("专项练习");
        if (message.contains("代码") || message.contains("实操")) preferences.add("代码实操");
        if (message.contains("图") || message.contains("可视化")) preferences.add("图解学习");
        if (!preferences.isEmpty()) return "偏好" + String.join("、", preferences) + "和即时反馈";
        return previous != null ? previous.preference() : "偏好短讲解、例题、实操和即时反馈";
    }

    private String fallbackPace(String message, LearnerProfile previous) {
        if (message.matches(".*\\d+.*小时.*")) return "按学生给出的每日小时数安排，完成讲解、练习和复盘";
        if (message.matches(".*\\d+.*分钟.*")) return "按学生给出的每日分钟数拆成学习、练习和复盘三段";
        return previous != null ? previous.pace() : "建议每天45-60分钟，学习、练习、复盘各占一段";
    }

    private LearnerProfile emptyProfile(String courseKey) {
        return new LearnerProfile("等待对话初始化", "尚未确定", "尚未诊断", "尚未诊断",
                "尚未识别", "尚未安排", courseKey, 0);
    }

    private JsonNode parseJsonObject(String raw) throws Exception {
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) throw new IllegalArgumentException("AI response does not contain JSON");
        return objectMapper.readTree(raw.substring(start, end + 1));
    }

    private String textOr(JsonNode node, String field, String fallback) {
        String value = node.path(field).asText("").trim();
        return value.isEmpty() ? fallback : value;
    }

    private String normalizeInput(String input, int maxLength) {
        if (input == null) return "";
        String normalized = input.trim();
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }

    private long userId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new IllegalStateException("请先登录");
        }
        return Long.parseLong(authentication.getName());
    }

    private boolean containsAny(String text, String title, List<String> keywords) {
        if (text == null) return false;
        String normalized = text.toLowerCase(Locale.ROOT);
        if (normalized.contains(title.toLowerCase(Locale.ROOT))) return true;
        return keywords.stream().anyMatch(item -> normalized.contains(item.toLowerCase(Locale.ROOT)));
    }

    private boolean confirmsCourseSwitch(String message) {
        String normalized = message.toLowerCase(Locale.ROOT);
        return message.contains("切换") || message.contains("只学") || message.contains("替换")
                || message.contains("不保留") || message.contains("保留并")
                || normalized.contains("switch") || normalized.contains("replace")
                || (normalized.contains("keep") && normalized.contains("existing"));
    }

    private boolean replacesExistingGoals(String message) {
        String normalized = message.toLowerCase(Locale.ROOT);
        return message.contains("只学") || message.contains("替换") || message.contains("不保留")
                || normalized.contains("replace") || normalized.contains("only new");
    }

    private String detectCourse(String message) {
        String text = message.toLowerCase(Locale.ROOT);
        if (text.contains("cs50") || text.contains("c语言") || text.contains("c 语言") || text.contains("sql")) return "cs50x";
        if (text.contains("nand2tetris") || text.contains("计算机系统") || text.contains("汇编") || text.contains("硬件")) return "nand2tetris";
        if (text.contains("cs61b") || text.contains("数据结构") || text.contains("java") || text.contains("红黑树") || text.contains("哈希表")) return "cs61b";
        if (text.contains("cs61a") || text.contains("sicp") || text.contains("python") || text.contains("解释器") || text.contains("高阶函数")) return "cs61a";
        if (text.contains("mit") || text.contains("算法") || text.contains("动态规划") || text.contains("图算法")) return "mit6006";
        return null;
    }

    private boolean validCourseKey(String key) {
        return key != null && COURSES.stream().anyMatch(item -> item.key().equals(key));
    }

    private CourseDefinition course(String key) {
        return COURSES.stream().filter(item -> item.key().equals(key)).findFirst().orElse(COURSES.get(0));
    }

    private CourseTopic topic(String courseKey, String topicId) {
        CourseDefinition definition = course(courseKey);
        return definition.topics().stream().filter(item -> item.id().equals(topicId))
                .findFirst().orElse(definition.topics().get(0));
    }

    private static CourseTopic topic(String id, String title, String summary,
                                     List<String> keywords, String question, String... tasks) {
        return new CourseTopic(id, title, summary, keywords, question, List.of(tasks));
    }

    private static final List<CourseDefinition> COURSES = List.of(
            new CourseDefinition("mit6006", 2L, "MIT 6.006", "MIT 6.006 Introduction to Algorithms",
                    "MIT OpenCourseWare", "从复杂度分析到图算法与动态规划，建立完整算法问题求解框架。", List.of(
                    topic("complexity", "算法分析", "掌握渐近复杂度、递归关系、主定理和循环不变量。", List.of("Big O", "Theta", "递归关系", "主定理"), "如何分析一个递归算法的时间复杂度？", "完成复杂度概念检查", "手推一个递归关系", "整理两个常见易错点"),
                    topic("sorting", "排序与选择", "比较归并、堆、快速排序以及线性时间选择。", List.of("稳定性", "分治", "堆排序", "快速排序"), "快速排序为什么会退化，如何降低退化概率？", "比较三种排序", "手推一次 partition", "完成边界用例测试"),
                    topic("structures", "算法数据结构", "使用哈希、堆、平衡树支撑高效算法。", List.of("哈希表", "二叉堆", "BST", "均摊"), "如何根据操作需求选择哈希表、堆或搜索树？", "列出操作复杂度", "完成结构选型题", "实现一个核心操作"),
                    topic("graphs", "图算法", "掌握 BFS、DFS、拓扑排序和最短路径。", List.of("BFS", "DFS", "Dijkstra", "拓扑排序"), "面对一张图时如何选择 BFS、DFS 或 Dijkstra？", "判断图的类型", "手推一次遍历", "完成路径恢复题"),
                    topic("dp", "动态规划", "从状态、转移、边界和遍历顺序解决重叠子问题。", List.of("状态", "转移方程", "边界条件", "最优子结构"), "设计动态规划时必须说明哪五个部分？", "定义一个状态", "写出转移与边界", "分析时间空间复杂度"),
                    topic("review", "综合复盘", "用证明、实现、复杂度和边界用例完成课程闭环。", List.of("正确性", "复杂度", "边界", "反例"), "如何证明一个算法正确并验证它的边界情况？", "复盘三道错题", "完成综合题", "输出个人算法清单")
            )),
            new CourseDefinition("cs61a", 3L, "CS61A", "UC Berkeley CS61A Structure and Interpretation of Computer Programs",
                    "UC Berkeley", "以 Python、函数抽象、递归和解释器项目理解程序构造。", List.of(
                    topic("environment", "函数与环境模型", "理解表达式求值、名称绑定、作用域和闭包。", List.of("环境帧", "作用域", "闭包", "名称绑定"), "闭包为什么能记住定义时的环境？", "画环境图", "追踪一次函数调用", "解释局部与全局绑定"),
                    topic("recursion", "递归与树递归", "从基本情况和递归情况拆解规模更小的子问题。", List.of("base case", "recursive case", "树递归", "子问题"), "如何判断一个递归函数一定会停止？", "写停止条件", "手推递归树", "改写一个递归函数"),
                    topic("higher-order", "高阶函数", "使用函数作为参数和返回值建立抽象。", List.of("高阶函数", "lambda", "装饰器", "抽象"), "高阶函数解决了什么重复问题？", "实现函数组合", "解释 lambda 捕获", "完成装饰器练习"),
                    topic("abstraction", "数据抽象与对象", "用构造器、选择器、类和接口建立抽象屏障。", List.of("ADT", "构造器", "选择器", "抽象屏障"), "为什么抽象屏障能降低程序修改成本？", "设计一个 ADT", "替换内部表示", "编写接口测试"),
                    topic("interpreter", "Scheme 与解释器", "理解解析、eval/apply、环境链和程序即数据。", List.of("Scheme", "eval", "apply", "AST"), "解释器如何对一条组合表达式求值？", "解析一个表达式", "追踪 eval/apply", "扩展一种语法"),
                    topic("projects", "课程项目", "通过 Hog、Cats、Ants 和解释器项目综合应用。", List.of("测试", "规格", "调试", "项目"), "大型课程项目应如何从规格拆到可测试任务？", "阅读项目规格", "建立测试清单", "完成项目复盘")
            )),
            new CourseDefinition("cs61b", 4L, "CS61B", "UC Berkeley CS61B Data Structures",
                    "UC Berkeley", "以 Java 工程实践掌握线性结构、树、哈希、图和自动测试。", List.of(
                    topic("java-testing", "Java 与测试", "掌握类、接口、泛型、异常、JUnit 和调试。", List.of("Java", "泛型", "JUnit", "equals"), "为什么数据结构实现前要先写测试和不变量？", "编写单元测试", "整理类不变量", "修复一个边界错误"),
                    topic("lists", "链表与数组表", "比较链表和动态数组，并理解扩容的摊还代价。", List.of("链表", "动态数组", "哨兵", "摊还"), "ArrayList 扩容为什么仍可视为摊还 O(1)？", "实现插入删除", "检查头尾边界", "分析摊还复杂度"),
                    topic("trees", "树与平衡搜索树", "掌握 BST 遍历、删除以及平衡树的高度保证。", List.of("树", "BST", "中序遍历", "红黑树", "树高"), "BST 中序遍历为什么有序，退化后复杂度如何变化？", "手推树遍历", "完成删除练习", "比较平衡与退化树"),
                    topic("hash-heap", "哈希与优先队列", "理解冲突、负载因子、堆和优先队列。", List.of("哈希表", "哈希冲突", "负载因子", "堆", "优先队列"), "哈希表和二叉堆分别适合解决什么问题？", "比较冲突策略", "完成 heapify", "验证扩容行为"),
                    topic("graph", "图与并查集", "使用图遍历、最短路、最小生成树和并查集。", List.of("图", "BFS", "最短路", "并查集"), "如何根据图的边权和任务选择合适算法？", "表示一张图", "实现一次遍历", "完成连通性练习"),
                    topic("engineering", "项目与自动评测", "从规格、测试、实现到性能评测完成工程闭环。", List.of("规格", "自动评测", "随机测试", "性能"), "怎样设计一组能发现隐藏错误的自动测试？", "拆解项目规格", "加入随机测试", "完成性能复盘")
            )),
            new CourseDefinition("nand2tetris", 5L, "Nand2Tetris", "Nand2Tetris: Building a Modern Computer from First Principles",
                    "Nand2Tetris", "从 NAND 门开始构造 CPU、汇编器、虚拟机与编译器。", List.of(
                    topic("logic", "布尔逻辑", "从 NAND 构造基础门和多路选择器。", List.of("NAND", "真值表", "Mux", "总线"), "为什么只用 NAND 就能构造所有布尔函数？", "完成真值表", "实现基础芯片", "检查总线宽度"),
                    topic("alu", "布尔算术与 ALU", "构造加法器、补码运算和 Hack ALU。", List.of("补码", "加法器", "ALU", "控制位"), "Hack ALU 的控制位如何组合出不同运算？", "手算补码", "实现加法器", "验证 ALU 控制位"),
                    topic("memory", "时序逻辑与内存", "理解 DFF、寄存器、RAM 和程序计数器。", List.of("DFF", "Register", "RAM", "时钟"), "组合逻辑和时序逻辑的本质区别是什么？", "追踪一个时钟周期", "实现寄存器", "检查 PC 优先级"),
                    topic("machine", "机器语言与 CPU", "连接 A/C 指令、CPU、Memory 和取指执行循环。", List.of("A指令", "C指令", "CPU", "取指"), "Hack CPU 如何完成一条 C 指令？", "翻译一条指令", "追踪数据通路", "完成 CPU 测试"),
                    topic("toolchain", "汇编器与 VM", "通过符号表、两遍扫描和栈机连接软硬件。", List.of("符号表", "两遍扫描", "VM", "栈帧"), "汇编器为什么通常采用两遍扫描？", "实现符号解析", "翻译 VM 指令", "调试 call/return"),
                    topic("compiler", "编译器与项目", "完成 Jack 语法分析、代码生成和系统项目。", List.of("Jack", "语法树", "代码生成", "项目"), "编译器前端和后端分别解决什么问题？", "构建语法树", "生成 VM 代码", "完成系统复盘")
            )),
            new CourseDefinition("cs50x", 6L, "CS50x", "Harvard CS50x Introduction to Computer Science",
                    "Harvard", "以 C 语言为入口覆盖内存、算法、数据结构、SQL 与 Web。", List.of(
                    topic("c-basics", "C 语言基础", "掌握类型、控制流、函数、数组和字符串。", List.of("类型", "数组", "字符串", "函数"), "C 字符串和字符数组之间是什么关系？", "完成输入输出练习", "检查数组边界", "实现一个小函数"),
                    topic("memory", "指针与内存", "理解地址、指针、栈、堆和动态内存管理。", List.of("指针", "malloc", "free", "内存泄漏"), "使用 malloc 时必须同时考虑哪些问题？", "画内存示意图", "修复一次泄漏", "检查指针生命周期"),
                    topic("algorithms", "搜索与排序", "比较线性搜索、二分搜索和经典排序。", List.of("线性搜索", "二分搜索", "排序", "复杂度"), "二分搜索为什么要求数据有序？", "手推二分搜索", "比较排序复杂度", "完成边界测试"),
                    topic("data-structures", "数据结构", "学习链表、哈希表、树和 Trie 的取舍。", List.of("链表", "哈希表", "树", "Trie"), "如何根据访问和更新需求选择数据结构？", "实现链表操作", "完成哈希练习", "比较结构复杂度"),
                    topic("sql-web", "Python、SQL 与 Web", "从底层编程过渡到数据库和 Web 应用。", List.of("Python", "SQL", "JOIN", "Flask"), "设计 SQL 查询前为什么要先明确表之间的关系？", "写一条 JOIN", "构建一个 Flask 路由", "检查输入安全"),
                    topic("final-project", "综合项目", "从问题定义、原型、实现到演示完成最终项目。", List.of("需求", "原型", "测试", "演示"), "一个可验收的课程项目需要包含哪些证据？", "确定项目目标", "建立验收清单", "完成项目演示")
            ))
    );

    public record ProfileRequest(String message) {}
    public record CourseSelectionRequest(String courseKey) {}
    public record PathModeRequest(String courseKey, String mode) {}
    public record GoalRequest(String courseKey, String title, String priority) {}
    public record GoalUpdateRequest(String title, String priority, Boolean confirmed) {}
    public record FactUpdateRequest(String value, boolean confirmed) {}
    public record TaskUpdateRequest(String courseKey, String topicId, int taskIndex, boolean completed) {}
    public record EvaluationRequest(String courseKey, String nodeId, String question, String answer, String assessmentType) {}
    public record EvaluationResponse(int score, String level, String feedback, String nextStep, boolean passed) {}
    public record EffectivenessEvaluationResponse(int score, String level, String feedback, String nextStep,
                                                  boolean passed, String assessmentType,
                                                  boolean countsAsMasteryEvidence, String effectMessage) {}
    private record EvaluationState(int bestScore, int attempts) {}
    private record CourseDefinition(String key, Long platformCourseId, String shortName, String title,
                                    String sourceName, String description, List<CourseTopic> topics) {}

    public record CourseOption(String key, Long platformCourseId, String shortName, String title, String description) {}
    public record CourseInfo(String key, Long platformCourseId, String title, String sourceName,
                             String courseUrl, String description, List<CourseTopic> topics) {}
    public record CourseTopic(String id, String title, String summary, List<String> keywords,
                              String question, List<String> tasks) {}
    public record LearnerProfile(String stage, String goal, String foundation, String weakPoints,
                                 String preference, String pace, String activeCourseKey, int revision) {}
    public record PathNode(String id, String title, String description, int sequence, int progress,
                           List<String> tasks, List<Integer> completedTasks, int bestScore, int attempts,
                           boolean passed, boolean priority, boolean available, boolean reviewRecommended,
                           int estimatedMinutes, String recommendationReason,
                           String videoUrl, String slidesUrl, String codeUrl, String question) {}
    public record ResourceCard(String type, String title, String description, String agent,
                               String url, String status) {}
    public record MindMapNode(String id, String label, String parentId, boolean passed, String nodeType) {}
    public record AgentRun(String name, String responsibility, String status, String role) {}
    public record ProfileGoal(long id, String courseKey, String title, String priority, String status,
                              boolean confirmed, String sourceEvidence, String updatedAt) {}
    public record ProfileFact(String key, String value, String sourceEvidence, boolean confirmed, String updatedAt) {}
    public record ProfileAdjustment(long id, String type, String message, String createdAt) {}
    public record ProfileOverview(List<ProfileGoal> goals, List<ProfileFact> facts,
                                  List<ProfileAdjustment> adjustments) {}
    public record PathRevision(long id, String mode, String reason, String createdAt) {}
    private record AssessmentEvidence(String type, int score, boolean passed, boolean countsAsEvidence,
                                      LocalDateTime createdAt) {}
    public record TopicEffectiveness(String topicId, String title, int diagnosticScore, int conceptScore,
                                     int transferScore, int retentionScore, int evidenceCount, Integer learningGain,
                                     String retentionDueAt, boolean verified, String status, String nextAction) {}
    public record LearningEffectivenessOverview(String courseKey, List<TopicEffectiveness> topics,
                                                int verifiedTopicCount, int evidenceCount, String standard) {}
    public record WorkspaceResponse(CourseInfo course, List<CourseOption> courses, LearnerProfile profile,
                                    boolean profileInitialized, String pathMode, String assistantReply, List<PathNode> path,
                                    List<ResourceCard> resources, List<MindMapNode> mindMap,
                                    List<AgentRun> agents, int overallProgress, String updatedAt) {}
}
