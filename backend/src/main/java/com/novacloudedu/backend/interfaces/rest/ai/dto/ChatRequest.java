package com.novacloudedu.backend.interfaces.rest.ai.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class ChatRequest {

    @NotBlank(message = "消息内容不能为空")
    private String message;

    private List<Map<String, String>> history;

    private String systemPrompt;

    private List<String> imageUrls;

    /** 模型ID，格式: "provider/model"，如 "dashscope/qwen-max"。为空则使用默认模型 */
    private String modelId;
}
