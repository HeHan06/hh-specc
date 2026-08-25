package com.dailyquote.quote.controller;

import com.dailyquote.quote.dto.ApiResponse;
import com.dailyquote.quote.dto.QuoteView;
import com.dailyquote.quote.service.QuoteService;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import com.hhspecc.observability.Orchestrate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 每日一句公开查询接口。
 * 该接口列入鉴权白名单，匿名读者可直接访问；返回统一响应体包裹 QuoteView。
 */
@Capability(req = "Req-1", name = "当日语录展示")
@RestController
@RequestMapping("/api/quotes")
public class QuoteController {

    private final QuoteService quoteService;

    public QuoteController(QuoteService quoteService) {
        this.quoteService = quoteService;
    }

    @CapabilityPoint(task = "T-09", name = "获取今日语录接口")
    @Orchestrate(from = "T-09", to = "T-07", rel = "calls")
    @GetMapping("/today")
    public ApiResponse<QuoteView> getTodayQuote() {
        return ApiResponse.success(quoteService.getTodayQuote());
    }
}
