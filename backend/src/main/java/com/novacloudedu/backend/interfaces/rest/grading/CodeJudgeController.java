package com.novacloudedu.backend.interfaces.rest.grading;

import com.novacloudedu.backend.common.BaseResponse;
import com.novacloudedu.backend.common.ResultUtils;
import com.novacloudedu.backend.application.learning.command.RecordLearningEventCommand;
import com.novacloudedu.backend.application.learning.service.LearningEventApplicationService;
import com.novacloudedu.backend.infrastructure.ai.LangchainChatService;
import com.novacloudedu.backend.infrastructure.workflow.executor.code.DockerCppExecutionService;
import com.novacloudedu.backend.infrastructure.workflow.executor.code.DockerJavaExecutionService;
import com.novacloudedu.backend.infrastructure.workflow.executor.code.DockerPythonExecutionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.Authentication;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Tag(name = "Code Judge", description = "CPH-like custom input/output runner")
@RestController
@RequestMapping("/api/grading/code-judge")
@RequiredArgsConstructor
@Slf4j
public class CodeJudgeController {

    private final DockerPythonExecutionService pythonExecutionService;
    private final DockerCppExecutionService cppExecutionService;
    private final DockerJavaExecutionService javaExecutionService;
    private final LangchainChatService langchainChatService;
    private final LearningEventApplicationService learningEventService;

    @PostMapping("/run-custom")
    @Operation(summary = "Run user code against custom stdin/stdout test cases")
    public BaseResponse<CustomJudgeResponse> runCustom(@RequestBody CustomJudgeRequest request,
                                                       Authentication authentication) {
        if (request == null || request.code() == null || request.code().isBlank()) {
            return (BaseResponse<CustomJudgeResponse>) ResultUtils.error(40000, "code cannot be empty");
        }
        if (request.tests() == null || request.tests().isEmpty()) {
            return (BaseResponse<CustomJudgeResponse>) ResultUtils.error(40000, "please add at least one test case");
        }

        String language = request.language() == null ? "cpp" : request.language().toLowerCase();
        if (!language.equals("cpp") && !language.equals("python") && !language.equals("java")) {
            return (BaseResponse<CustomJudgeResponse>) ResultUtils.error(40000, "only C++, Python and Java are supported now");
        }
        if (language.equals("cpp") && !cppExecutionService.isAvailable()) {
            return (BaseResponse<CustomJudgeResponse>) ResultUtils.error(50001, "C++ sandbox is unavailable, please check Docker");
        }
        if (language.equals("java") && !javaExecutionService.isAvailable()) {
            return (BaseResponse<CustomJudgeResponse>) ResultUtils.error(50001, "Java sandbox is unavailable, please check Docker");
        }
        if (language.equals("python") && !pythonExecutionService.isAvailable()) {
            return (BaseResponse<CustomJudgeResponse>) ResultUtils.error(50001, "Python sandbox is unavailable, please check Docker");
        }

        List<CustomTestResult> cases = request.tests().stream()
                .limit(20)
                .map(test -> runOneCase(language, request.code(), test))
                .toList();
        long passed = cases.stream().filter(CustomTestResult::passed).count();
        String verdict = passed == cases.size() ? "ACCEPTED" : cases.stream().anyMatch(c -> c.error() != null && !c.error().isBlank())
                ? "RUNTIME_ERROR"
                : "WRONG_ANSWER";
        CustomJudgeResponse result = new CustomJudgeResponse((int) passed, cases.size(), verdict, cases);
        recordJudgeEvent(authentication, request, result);
        return ResultUtils.success(result);
    }

    @PostMapping("/analyze")
    @Operation(summary = "Analyze failed custom judge result with AI")
    public BaseResponse<JudgeAnalysisResponse> analyze(@RequestBody JudgeAnalysisRequest request,
                                                        Authentication authentication) {
        if (request == null || request.code() == null || request.code().isBlank()) {
            return (BaseResponse<JudgeAnalysisResponse>) ResultUtils.error(40000, "code cannot be empty");
        }
        String language = request.language() == null ? "cpp" : request.language();
        String systemPrompt = """
                你是一名耐心的算法课助教，正在帮助学生分析本地代码评测结果。
                回答必须使用中文，语气自然，先指出最可能的问题，再给调试步骤。
                不要直接重写完整答案，除非用户代码是编译错误或运行时错误需要最小修改。
                输出结构控制在 4 段以内：可能原因、定位方法、最小修改建议、下一步测试。
                """;
        String codeFenceLanguage = switch (language.toLowerCase()) {
            case "python" -> "python";
            case "java" -> "java";
            default -> "cpp";
        };
        String userMessage = """
                语言：%s

                学生代码：
                ```%s
                %s
                ```

                评测结果 JSON：
                %s
                """.formatted(language, codeFenceLanguage, request.code(), request.resultJson());
        try {
            String analysis = langchainChatService.chat("deepseek/deepseek-chat", systemPrompt, userMessage);
            recordAnalysisEvent(authentication, request);
            return ResultUtils.success(new JudgeAnalysisResponse(analysis));
        } catch (Exception e) {
            log.warn("AI judge analysis failed: {}", e.getMessage());
            recordAnalysisEvent(authentication, request);
            return ResultUtils.success(new JudgeAnalysisResponse(
                    "AI 分析暂时不可用。你可以先对比未通过用例的“预期输出”和“实际输出”，再检查输入读取、边界条件、换行格式和变量类型。"
            ));
        }
    }

    private CustomTestResult runOneCase(String language, String code, CustomTestCase test) {
        try {
            Map<String, Object> execution = switch (language) {
                case "cpp" -> cppExecutionService.execute(code, test.input());
                case "java" -> javaExecutionService.execute(code, test.input());
                default -> runPythonProgram(code, test.input());
            };
            String output = String.valueOf(execution.getOrDefault("output", ""));
            String stderr = String.valueOf(execution.getOrDefault("stderr", ""));
            boolean success = Boolean.TRUE.equals(execution.get("success"));
            boolean passed = success && sameOutput(output, test.expectedOutput());
            return new CustomTestResult(
                    test.id(),
                    test.input(),
                    test.expectedOutput(),
                    output,
                    passed,
                    success ? null : stderr,
                    ((Number) execution.getOrDefault("exitCode", 0)).intValue()
            );
        } catch (Exception e) {
            log.warn("Custom code judge failed: {}", e.getMessage());
            return new CustomTestResult(test.id(), test.input(), test.expectedOutput(), "", false, e.getMessage(), -1);
        }
    }

    private Map<String, Object> runPythonProgram(String code, String stdin) {
        Map<String, Object> input = new LinkedHashMap<>();
        input.put("userCode", code);
        input.put("stdin", stdin == null ? "" : stdin);
        Map<String, Object> result = pythonExecutionService.execute(PYTHON_PROGRAM_HARNESS, input, "");
        Map<String, Object> output = new LinkedHashMap<>();
        output.put("success", Boolean.TRUE.equals(result.get("success")));
        output.put("output", result.getOrDefault("output", ""));
        output.put("stderr", result.getOrDefault("stderr", ""));
        output.put("exitCode", result.getOrDefault("exitCode", 0));
        return output;
    }

    private void recordJudgeEvent(Authentication authentication, CustomJudgeRequest request,
                                  CustomJudgeResponse result) {
        if (authentication == null || authentication.getName() == null) return;
        learningEventService.record(Long.parseLong(authentication.getName()), new RecordLearningEventCommand(
                "CODE_JUDGED", request.courseId(), null, null, request.knowledgePoint(), null,
                "COMPUTER_SCIENCE", 0, result.passed(), result.total(),
                result.verdict().equals("ACCEPTED") ? null : result.verdict(), "CODE_JUDGE",
                Map.of("language", request.language() == null ? "cpp" : request.language(), "verdict", result.verdict())));
    }

    private void recordAnalysisEvent(Authentication authentication, JudgeAnalysisRequest request) {
        if (authentication == null || authentication.getName() == null) return;
        learningEventService.record(Long.parseLong(authentication.getName()), new RecordLearningEventCommand(
                "CODE_ANALYSIS_VIEWED", request.courseId(), null, null, request.knowledgePoint(), null,
                "COMPUTER_SCIENCE", 0, null, null, null, "CODE_JUDGE",
                Map.of("language", request.language() == null ? "cpp" : request.language())));
    }

    private static boolean sameOutput(String actual, String expected) {
        return normalizeOutput(actual).equals(normalizeOutput(expected));
    }

    private static String normalizeOutput(String value) {
        if (value == null) {
            return "";
        }
        String normalized = value.replace("\r\n", "\n").replace("\r", "\n").strip();
        String[] lines = normalized.split("\n", -1);
        for (int i = 0; i < lines.length; i++) {
            lines[i] = lines[i].stripTrailing();
        }
        return String.join("\n", lines);
    }

    private static final String PYTHON_PROGRAM_HARNESS = """
            import contextlib, io, sys, traceback

            def main(args):
                stdin = io.StringIO(args.get("stdin", ""))
                stdout = io.StringIO()
                stderr = io.StringIO()
                old_stdin = sys.stdin
                try:
                    sys.stdin = stdin
                    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                        namespace = {"__name__": "__main__"}
                        exec(args["userCode"], namespace)
                    return {"success": True, "output": stdout.getvalue(), "stderr": stderr.getvalue(), "exitCode": 0}
                except SystemExit as exc:
                    code = exc.code if isinstance(exc.code, int) else 0
                    return {"success": code == 0, "output": stdout.getvalue(), "stderr": stderr.getvalue(), "exitCode": code}
                except Exception:
                    return {"success": False, "output": stdout.getvalue(), "stderr": traceback.format_exc(), "exitCode": 1}
                finally:
                    sys.stdin = old_stdin
            """;

    public record CustomJudgeRequest(String language, String code, List<CustomTestCase> tests,
                                     Long courseId, String knowledgePoint) {}

    public record CustomTestCase(String id, String input, String expectedOutput) {}

    public record CustomJudgeResponse(int passed, int total, String verdict, List<CustomTestResult> cases) {}

    public record CustomTestResult(
            String id,
            String input,
            String expectedOutput,
            String actualOutput,
            boolean passed,
            String error,
            int exitCode
    ) {}

    public record JudgeAnalysisRequest(String language, String code, String resultJson,
                                       Long courseId, String knowledgePoint) {}

    public record JudgeAnalysisResponse(String analysis) {}
}
