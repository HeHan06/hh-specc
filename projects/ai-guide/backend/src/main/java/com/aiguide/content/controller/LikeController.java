package com.aiguide.content.controller;

import com.aiguide.common.ApiResponse;
import com.aiguide.content.dto.LikeResultView;
import com.aiguide.content.service.LikeService;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 阅读站点赞入口。访客标识通过请求头传入，后端做格式与长度校验。
 */
@Validated
@RestController
@RequestMapping("/api/contents/{contentCode}/likes")
@Capability(req = "Req-4", name = "内容点赞")
public class LikeController {

    private final LikeService likeService;

    public LikeController(LikeService likeService) {
        this.likeService = likeService;
    }

    @PostMapping
    @CapabilityPoint(task = "T-14", name = "点赞内容")
    public ApiResponse<LikeResultView> like(@PathVariable @Size(min = 1, max = 64) String contentCode,
                                            @RequestHeader(name = "X-Visitor-Id", required = false) String visitorId) {
        return ApiResponse.success(likeService.like(contentCode, visitorId));
    }
}
