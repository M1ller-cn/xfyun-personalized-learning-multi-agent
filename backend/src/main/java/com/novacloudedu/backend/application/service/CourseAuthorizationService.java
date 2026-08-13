package com.novacloudedu.backend.application.service;

import com.novacloudedu.backend.common.ErrorCode;
import com.novacloudedu.backend.domain.course.entity.Course;
import com.novacloudedu.backend.domain.course.repository.CourseRepository;
import com.novacloudedu.backend.domain.course.valueobject.CourseId;
import com.novacloudedu.backend.domain.teacher.entity.Teacher;
import com.novacloudedu.backend.domain.teacher.repository.TeacherRepository;
import com.novacloudedu.backend.domain.teacher.valueobject.TeacherId;
import com.novacloudedu.backend.domain.user.entity.User;
import com.novacloudedu.backend.domain.user.valueobject.UserId;
import com.novacloudedu.backend.domain.user.valueobject.UserRole;
import com.novacloudedu.backend.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Keeps teacher ownership checks consistent across course, chapter and section writes. */
@Service
@RequiredArgsConstructor
public class CourseAuthorizationService {

    private final CourseRepository courseRepository;
    private final TeacherRepository teacherRepository;
    private final UserApplicationService userApplicationService;

    public Long resolveTeacherIdForCreation(Long requestedTeacherId) {
        User currentUser = userApplicationService.getCurrentUser();
        if (currentUser.getRole() == UserRole.ADMIN) {
            return requestedTeacherId;
        }
        Teacher teacher = currentTeacher(currentUser);
        Long ownTeacherId = teacher.getId().value();
        if (requestedTeacherId != null && !ownTeacherId.equals(requestedTeacherId)) {
            throw new BusinessException(ErrorCode.NO_AUTH_ERROR, "教师只能创建归属自己的课程");
        }
        return ownTeacherId;
    }

    public void assertCanManage(Long courseId) {
        User currentUser = userApplicationService.getCurrentUser();
        if (currentUser.getRole() == UserRole.ADMIN) {
            return;
        }
        Course course = courseRepository.findById(CourseId.of(courseId))
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND_ERROR));
        Teacher teacher = currentTeacher(currentUser);
        if (!course.getTeacherId().value().equals(teacher.getId().value())) {
            throw new BusinessException(ErrorCode.NO_AUTH_ERROR, "无权管理其他教师的课程");
        }
    }

    private Teacher currentTeacher(User user) {
        return teacherRepository.findByUserId(UserId.of(user.getId().value()))
                .orElseThrow(() -> new BusinessException(ErrorCode.NO_AUTH_ERROR, "当前教师档案不存在"));
    }
}
