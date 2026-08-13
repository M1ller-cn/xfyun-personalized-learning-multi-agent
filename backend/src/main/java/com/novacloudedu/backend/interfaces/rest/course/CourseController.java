package com.novacloudedu.backend.interfaces.rest.course;

import com.novacloudedu.backend.annotation.AuthCheck;
import com.novacloudedu.backend.application.course.command.*;
import com.novacloudedu.backend.application.course.query.GetCourseQuery;
import com.novacloudedu.backend.application.service.CourseApplicationService;
import com.novacloudedu.backend.application.service.CourseAuthorizationService;
import com.novacloudedu.backend.common.BaseResponse;
import com.novacloudedu.backend.common.ErrorCode;
import com.novacloudedu.backend.common.ResultUtils;
import com.novacloudedu.backend.domain.course.entity.Course;
import com.novacloudedu.backend.domain.course.valueobject.CourseDifficulty;
import com.novacloudedu.backend.domain.course.valueobject.CourseStatus;
import com.novacloudedu.backend.domain.course.valueobject.CourseType;
import com.novacloudedu.backend.domain.user.valueobject.UserId;
import com.novacloudedu.backend.exception.BusinessException;
import com.novacloudedu.backend.interfaces.rest.course.assembler.CourseAssembler;
import com.novacloudedu.backend.interfaces.rest.course.dto.CourseResponse;
import com.novacloudedu.backend.interfaces.rest.course.dto.CreateCourseRequest;
import com.novacloudedu.backend.interfaces.rest.course.dto.UpdateCourseRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/course")
@RequiredArgsConstructor
@Tag(name = "课程管理", description = "课程相关接口")
public class CourseController {

    private final CourseApplicationService courseApplicationService;
    private final CourseAuthorizationService courseAuthorizationService;
    private final GetCourseQuery getCourseQuery;
    private final CourseAssembler courseAssembler;

    @PostMapping
    @AuthCheck(mustRole = "teacher")
    @Operation(summary = "创建课程（管理员）")
    public BaseResponse<Long> createCourse(@Valid @RequestBody CreateCourseRequest request,
                                          Authentication authentication) {
        Long adminId = Long.parseLong(authentication.getName());
        CreateCourseCommand command = new CreateCourseCommand(
                request.getTitle(),
                request.getSubtitle(),
                request.getDescription(),
                request.getCoverImage(),
                request.getPrice(),
                CourseType.fromCode(request.getCourseType()),
                CourseDifficulty.fromCode(request.getDifficulty()),
                courseAuthorizationService.resolveTeacherIdForCreation(request.getTeacherId()),
                request.getTags()
        );
        Long courseId = courseApplicationService.createCourse(command, UserId.of(adminId));
        return ResultUtils.success(courseId);
    }

    @PutMapping("/{id}")
    @AuthCheck(mustRole = "teacher")
    @Operation(summary = "更新课程（管理员）")
    public BaseResponse<Void> updateCourse(@PathVariable @Parameter(description = "课程ID") Long id,
                                          @Valid @RequestBody UpdateCourseRequest request) {
        courseAuthorizationService.assertCanManage(id);
        UpdateCourseCommand command = new UpdateCourseCommand(
                id,
                request.getTitle(),
                request.getSubtitle(),
                request.getDescription(),
                request.getCoverImage(),
                request.getPrice(),
                CourseType.fromCode(request.getCourseType()),
                CourseDifficulty.fromCode(request.getDifficulty()),
                request.getTags()
        );
        courseApplicationService.updateCourse(command);
        return ResultUtils.success(null);
    }

    @PostMapping("/{id}/publish")
    @AuthCheck(mustRole = "teacher")
    @Operation(summary = "发布课程（管理员）")
    public BaseResponse<Void> publishCourse(@PathVariable @Parameter(description = "课程ID") Long id) {
        courseAuthorizationService.assertCanManage(id);
        courseApplicationService.publishCourse(id);
        return ResultUtils.success(null);
    }

    @PostMapping("/{id}/offline")
    @AuthCheck(mustRole = "teacher")
    @Operation(summary = "下架课程（管理员）")
    public BaseResponse<Void> takeOffline(@PathVariable @Parameter(description = "课程ID") Long id) {
        courseAuthorizationService.assertCanManage(id);
        courseApplicationService.takeOfflineCourse(id);
        return ResultUtils.success(null);
    }

    @DeleteMapping("/{id}")
    @AuthCheck(mustRole = "teacher")
    @Operation(summary = "删除课程（管理员）")
    public BaseResponse<Void> deleteCourse(@PathVariable @Parameter(description = "课程ID") Long id) {
        courseAuthorizationService.assertCanManage(id);
        courseApplicationService.deleteCourse(id);
        return ResultUtils.success(null);
    }

    @PostMapping("/join-by-code")
    @Operation(summary = "学生通过课程码加入课程")
    public BaseResponse<CourseResponse> joinCourseByCode(@RequestBody Map<String, String> request,
                                                        Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        Course course = courseApplicationService.joinCourseByCode(request.get("code"), UserId.of(userId));
        return ResultUtils.success(courseAssembler.toCourseResponse(course));
    }

    @GetMapping("/my")
    @Operation(summary = "获取当前学生已加入课程")
    public BaseResponse<List<CourseResponse>> listMyCourses(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        List<CourseResponse> responses = courseApplicationService.listMyCourses(UserId.of(userId), page, size).stream()
                .map(courseAssembler::toCourseResponse)
                .collect(Collectors.toList());
        return ResultUtils.success(responses);
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取课程详情")
    public BaseResponse<CourseResponse> getCourse(@PathVariable @Parameter(description = "课程ID") Long id) {
        Course course = getCourseQuery.execute(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND_ERROR));
        return ResultUtils.success(courseAssembler.toCourseResponse(course));
    }

    @GetMapping("/list")
    @Operation(summary = "获取课程列表")
    public BaseResponse<List<CourseResponse>> listCourses(
            @RequestParam(required = false) @Parameter(description = "状态：0-未发布，1-已发布，2-已下架") Integer status,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码") int page,
            @RequestParam(defaultValue = "10") @Parameter(description = "每页数量") int size) {
        
        List<Course> courses;
        if (status != null) {
            courses = getCourseQuery.executeByStatus(CourseStatus.fromCode(status), page, size);
        } else {
            courses = getCourseQuery.executeList(page, size);
        }

        List<CourseResponse> responses = courses.stream()
                .map(courseAssembler::toCourseResponse)
                .collect(Collectors.toList());
        return ResultUtils.success(responses);
    }

    @GetMapping("/teacher/{teacherId}")
    @Operation(summary = "获取讲师的课程列表")
    public BaseResponse<List<CourseResponse>> listCoursesByTeacher(
            @PathVariable @Parameter(description = "讲师ID") Long teacherId,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码") int page,
            @RequestParam(defaultValue = "10") @Parameter(description = "每页数量") int size) {
        
        List<Course> courses = getCourseQuery.executeByTeacherId(teacherId, page, size);
        List<CourseResponse> responses = courses.stream()
                .map(courseAssembler::toCourseResponse)
                .collect(Collectors.toList());
        return ResultUtils.success(responses);
    }

    @GetMapping("/search")
    @Operation(summary = "搜索课程")
    public BaseResponse<List<CourseResponse>> searchCourses(
            @RequestParam @Parameter(description = "关键词") String keyword,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码") int page,
            @RequestParam(defaultValue = "10") @Parameter(description = "每页数量") int size) {
        
        List<Course> courses = getCourseQuery.searchByKeyword(keyword, page, size);
        List<CourseResponse> responses = courses.stream()
                .map(courseAssembler::toCourseResponse)
                .collect(Collectors.toList());
        return ResultUtils.success(responses);
    }
}
