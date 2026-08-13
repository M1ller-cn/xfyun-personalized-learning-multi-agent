package com.novacloudedu.backend.infrastructure.workflow.executor.code;

import com.github.dockerjava.api.DockerClient;
import com.github.dockerjava.api.command.CreateContainerResponse;
import com.github.dockerjava.api.command.WaitContainerResultCallback;
import com.github.dockerjava.api.model.Bind;
import com.github.dockerjava.api.model.HostConfig;
import com.github.dockerjava.api.model.Volume;
import com.github.dockerjava.core.DefaultDockerClientConfig;
import com.github.dockerjava.core.DockerClientConfig;
import com.github.dockerjava.core.DockerClientImpl;
import com.github.dockerjava.zerodep.ZerodepDockerHttpClient;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class DockerJavaExecutionService {

    private static final String JAVA_IMAGE = "eclipse-temurin:21-jdk";

    private final CodeSandboxConfig config;

    private DockerClient dockerClient;

    @PostConstruct
    public void init() {
        if (!config.isDockerEnabled()) {
            return;
        }
        try {
            DockerClientConfig clientConfig = DefaultDockerClientConfig.createDefaultConfigBuilder()
                    .withDockerHost(config.getDockerHost())
                    .build();
            ZerodepDockerHttpClient httpClient = new ZerodepDockerHttpClient.Builder()
                    .dockerHost(clientConfig.getDockerHost())
                    .maxConnections(10)
                    .connectionTimeout(Duration.ofSeconds(10))
                    .responseTimeout(Duration.ofSeconds(30))
                    .build();
            dockerClient = DockerClientImpl.getInstance(clientConfig, httpClient);
            dockerClient.pingCmd().exec();
            ensureJavaImage();
        } catch (Exception e) {
            log.warn("[Docker-Java] Java sandbox is unavailable: {}", e.getMessage());
            dockerClient = null;
        }
    }

    @PreDestroy
    public void destroy() {
        if (dockerClient != null) {
            try {
                dockerClient.close();
            } catch (IOException e) {
                log.warn("Close Docker client failed", e);
            }
        }
    }

    public boolean isAvailable() {
        return dockerClient != null;
    }

    public Map<String, Object> execute(String code, String stdin) {
        if (dockerClient == null) {
            throw new IllegalStateException("Java sandbox is unavailable. Please make sure Docker is running.");
        }

        Path tempDir = null;
        String containerId = null;
        try {
            tempDir = Files.createTempDirectory(Path.of(config.getTempDir()), "java_");
            Files.writeString(tempDir.resolve("Main.java"), code, StandardCharsets.UTF_8);
            Files.writeString(tempDir.resolve("input.txt"), stdin == null ? "" : stdin, StandardCharsets.UTF_8);

            String workDir = resolveContainerWorkDir(tempDir);
            HostConfig hostConfig = buildHostConfig(tempDir.toString(), workDir);
            String command = "javac Main.java > compile.log 2>&1"
                    + " && timeout " + Math.max(1, config.getTimeoutSeconds())
                    + "s java Main < input.txt > output.txt 2> stderr.txt";

            CreateContainerResponse container = dockerClient.createContainerCmd(JAVA_IMAGE)
                    .withHostConfig(hostConfig)
                    .withWorkingDir(workDir)
                    .withCmd("sh", "-lc", command)
                    .exec();
            containerId = container.getId();
            dockerClient.startContainerCmd(containerId).exec();

            WaitContainerResultCallback waitCallback = new WaitContainerResultCallback();
            dockerClient.waitContainerCmd(containerId).exec(waitCallback);
            boolean completed = waitCallback.awaitCompletion(config.getTimeoutSeconds() + 8L, TimeUnit.SECONDS);
            if (!completed) {
                try {
                    dockerClient.stopContainerCmd(containerId).withTimeout(2).exec();
                } catch (Exception ignored) {
                }
                return Map.of("success", false, "output", "", "stderr", "Time limit exceeded", "exitCode", 124);
            }

            int statusCode = dockerClient.inspectContainerCmd(containerId).exec().getState().getExitCodeLong().intValue();
            String output = readFile(tempDir.resolve("output.txt"));
            String stderr = readFile(tempDir.resolve("stderr.txt"));
            String compileLog = readFile(tempDir.resolve("compile.log"));
            if (!compileLog.isBlank() && statusCode != 0) {
                stderr = compileLog + (stderr.isBlank() ? "" : "\n" + stderr);
            }
            return Map.of("success", statusCode == 0, "output", output, "stderr", stderr, "exitCode", statusCode);
        } catch (Exception e) {
            throw new RuntimeException("Java code execution failed: " + e.getMessage(), e);
        } finally {
            if (containerId != null) {
                try {
                    dockerClient.removeContainerCmd(containerId).withForce(true).exec();
                } catch (Exception e) {
                    log.warn("Clean Java container failed: {}", e.getMessage());
                }
            }
            if (tempDir != null) {
                cleanupDir(tempDir);
            }
        }
    }

    private void ensureJavaImage() {
        try {
            dockerClient.inspectImageCmd(JAVA_IMAGE).exec();
        } catch (Exception e) {
            try {
                dockerClient.pullImageCmd(JAVA_IMAGE).start().awaitCompletion(10, TimeUnit.MINUTES);
            } catch (Exception pullEx) {
                log.warn("[Docker-Java] Pull image failed: {}", pullEx.getMessage());
            }
        }
    }

    private HostConfig buildHostConfig(String hostWorkDir, String containerWorkDir) {
        Bind workBind = hasSharedTempVolume()
                ? new Bind(config.getSharedTempVolume(), new Volume(config.getContainerWorkRoot()))
                : new Bind(hostWorkDir, new Volume(containerWorkDir));
        return HostConfig.newHostConfig()
                .withBinds(workBind)
                .withMemory(config.getMemoryLimit())
                .withCpuCount(config.getCpuCount())
                .withNetworkMode("none")
                .withReadonlyRootfs(false);
    }

    private String resolveContainerWorkDir(Path tempDir) {
        if (hasSharedTempVolume()) {
            return config.getContainerWorkRoot() + "/" + tempDir.getFileName();
        }
        return "/app";
    }

    private boolean hasSharedTempVolume() {
        return config.getSharedTempVolume() != null && !config.getSharedTempVolume().isBlank();
    }

    private String readFile(Path path) throws IOException {
        return Files.exists(path) ? Files.readString(path, StandardCharsets.UTF_8) : "";
    }

    private void cleanupDir(Path dir) {
        try {
            if (Files.exists(dir)) {
                Files.walk(dir)
                        .sorted(java.util.Comparator.reverseOrder())
                        .forEach(p -> {
                            try {
                                Files.deleteIfExists(p);
                            } catch (IOException ignored) {
                            }
                        });
            }
        } catch (IOException e) {
            log.warn("Clean temp dir failed: {}", dir, e);
        }
    }
}
