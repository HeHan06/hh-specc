package com.dailyquote.quote.controller;

import com.dailyquote.quote.dto.ApiResponse;
import com.dailyquote.quote.dto.QuoteView;
import com.dailyquote.quote.service.QuoteService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 每日一句公开查询接口。
 * 该接口列入鉴权白名单，匿名读者可直接访问；返回统一响应体包裹 QuoteView。
 */
@RestController
@RequestMapping("/api/quotes")
public class QuoteController {

    private final QuoteService quoteService;

    public QuoteController(QuoteService quoteService) {
        this.quoteService = quoteService;
    }

    @GetMapping("/today")
    public ApiResponse<QuoteView> getTodayQuote() {
        return ApiResponse.success(quoteService.getTodayQuote());
    }
}
