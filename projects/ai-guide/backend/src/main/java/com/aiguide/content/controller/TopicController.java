package com.aiguide.content.controller;

import com.aiguide.common.ApiResponse;
import com.aiguide.content.dto.TopicView;
import com.aiguide.content.service.TopicService;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 阅读站主题目录入口。Controller 只负责参数与统一响应包装，不写业务逻辑。
 */
@RestController
@RequestMapping("/api/topics")
@Capability(req = "Req-1", name = "阅读站主题目录")
public class TopicController {

    private final TopicService topicService;

    public TopicController(TopicService topicService) {
        this.topicService = topicService;
    }

    @GetMapping
    @CapabilityPoint(task = "T-14", name = "查询阅读站可见主题")
    public ApiResponse<List<TopicView>> listVisibleTopics() {
        return ApiResponse.success(topicService.listVisibleTopics());
    }
}
