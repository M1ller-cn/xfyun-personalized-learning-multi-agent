package com.novacloudedu.backend.interfaces.rest.common;

import com.novacloudedu.backend.annotation.AuthCheck;
import com.novacloudedu.backend.common.BaseResponse;
import com.novacloudedu.backend.common.ResultUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Readiness checks used by administrators and the local demonstration audit.
 * Checks are deliberately shallow and never send prompts or consume AI credits.
 */
@RestController
@RequestMapping("/api/platform")
@RequiredArgsConstructor
public class PlatformReadinessController {

    private final JdbcTemplate jdbcTemplate;
    private final StringRedisTemplate redisTemplate;

    @Value("${ai.chat-models.providers.deepseek.enabled:false}")
    private boolean deepSeekEnabled;

    @Value("${ai.chat-models.providers.deepseek.api-key:}")
    private String deepSeekApiKey;

    @Value("${typst.service.url:http://localhost:8200}")
    private String typstServiceUrl;

    @Value("${spring.elasticsearch.uris:http://localhost:9200}")
    private String elasticsearchUrl;

    @Value("${CODE_SANDBOX_DOCKER_ENABLED:false}")
    private boolean dockerSandboxEnabled;

    @GetMapping("/readiness")
    @AuthCheck(mustRole = "admin")
    public BaseResponse<ReadinessResponse> readiness() {
        List<ServiceCheck> checks = new ArrayList<>();
        checks.add(database());
        checks.add(redis());
        checks.add(rag());
        checks.add(deepSeek());
        checks.add(codeSandbox());
        checks.add(pdf());

        boolean ready = checks.stream()
                .filter(ServiceCheck::required)
                .allMatch(check -> "READY".equals(check.status()));
        boolean degraded = checks.stream().anyMatch(check -> "DEGRADED".equals(check.status()));
        String status = ready ? (degraded ? "READY_WITH_DEGRADATION" : "READY") : "NOT_READY";
        return ResultUtils.success(new ReadinessResponse(status, ready, checks, Instant.now().toString()));
    }

    private ServiceCheck database() {
        try {
            Integer value = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            return ready("DATABASE", "PostgreSQL", "查询正常: " + value, true);
        } catch (Exception ex) {
            return failed("DATABASE", "PostgreSQL", ex, true);
        }
    }

    private ServiceCheck redis() {
        try (RedisConnection connection = redisTemplate.getConnectionFactory().getConnection()) {
            String pong = connection.ping();
            return ready("REDIS", "Redis", "连接正常: " + pong, true);
        } catch (Exception ex) {
            return failed("REDIS", "Redis", ex, true);
        }
    }

    private ServiceCheck rag() {
        try {
            Integer knowledgeBases = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM knowledge_base WHERE is_delete = 0", Integer.class);
            int statusCode = httpStatus(elasticsearchUrl + "/_cluster/health");
            if (statusCode < 200 || statusCode >= 300) {
                return new ServiceCheck("RAG", "课程知识库", "DEGRADED",
                        "Elasticsearch 不可用，当前知识库数: " + knowledgeBases, false);
            }
            String status = knowledgeBases != null && knowledgeBases > 0 ? "READY" : "DEGRADED";
            return new ServiceCheck("RAG", "课程知识库", status,
                    "Elasticsearch 正常，已加载 " + knowledgeBases + " 个知识库", false);
        } catch (Exception ex) {
            return failed("RAG", "课程知识库", ex, false);
        }
    }

    private ServiceCheck deepSeek() {
        boolean configured = deepSeekEnabled && deepSeekApiKey != null && !deepSeekApiKey.isBlank();
        return new ServiceCheck("DEEPSEEK", "DeepSeek 智能体", configured ? "READY" : "DEGRADED",
                configured ? "密钥和模型路由已配置；未发起计费探测" : "未配置，将使用规则与本地降级能力", false);
    }

    private ServiceCheck codeSandbox() {
        boolean socketPresent = Files.exists(Path.of("/var/run/docker.sock"));
        boolean available = dockerSandboxEnabled && socketPresent;
        return new ServiceCheck("CODE_SANDBOX", "代码沙箱", available ? "READY" : "DEGRADED",
                available ? "Docker 代码沙箱已启用" : "代码沙箱未就绪，在线评测会返回明确降级提示", false);
    }

    private ServiceCheck pdf() {
        try {
            int statusCode = httpStatus(typstServiceUrl + "/health");
            if (statusCode >= 200 && statusCode < 300) {
                return ready("PDF", "Typst PDF 服务", "试卷预览与导出可用", true);
            }
            return new ServiceCheck("PDF", "Typst PDF 服务", "NOT_READY", "健康检查返回 HTTP " + statusCode, true);
        } catch (Exception ex) {
            return failed("PDF", "Typst PDF 服务", ex, true);
        }
    }

    private int httpStatus(String url) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(2))
                .GET()
                .build();
        return HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build()
                .send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
    }

    private ServiceCheck ready(String key, String name, String detail, boolean required) {
        return new ServiceCheck(key, name, "READY", detail, required);
    }

    private ServiceCheck failed(String key, String name, Exception ex, boolean required) {
        String message = ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage();
        return new ServiceCheck(key, name, required ? "NOT_READY" : "DEGRADED", message, required);
    }

    public record ServiceCheck(String key, String name, String status, String detail, boolean required) {}
    public record ReadinessResponse(String status, boolean ready, List<ServiceCheck> checks, String checkedAt) {}
}
