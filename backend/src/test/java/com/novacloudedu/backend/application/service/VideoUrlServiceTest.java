package com.novacloudedu.backend.application.service;

import com.novacloudedu.backend.domain.file.service.OssService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class VideoUrlServiceTest {

    private final VideoUrlService service = new VideoUrlService(mock(OssService.class));

    @Test
    void externalCourseMediaDoesNotRequireTranscoding() {
        assertFalse(service.requiresTranscode("https://www.youtube.com/watch?v=course"));
        assertFalse(service.requiresTranscode("http://media.example.com/lecture.mp4"));
    }

    @Test
    void platformObjectKeyRequiresTranscoding() {
        assertTrue(service.requiresTranscode("course-videos/lecture-01.mp4"));
        assertFalse(service.requiresTranscode("  "));
        assertFalse(service.requiresTranscode(null));
    }
}
