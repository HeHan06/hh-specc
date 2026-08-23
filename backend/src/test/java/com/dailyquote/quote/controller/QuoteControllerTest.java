package com.dailyquote.quote.controller;

import com.dailyquote.quote.dto.QuoteView;
import com.dailyquote.quote.service.QuoteService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.nullValue;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * QuoteController 的切片测试（T-08 测试先行）。
 *
 * 验证契约中的三条硬性约束：
 * 1. GET /api/quotes/today 为鉴权白名单，匿名请求即可访问；
 * 2. 成功响应使用统一响应体，data 中携带 content/source/backgroundImage/displayDate 四要素；
 * 3. 服务异常经统一异常处理返回标准业务错误码，而不是裸露 Spring 异常。
 */
@WebMvcTest(QuoteController.class)
@Import(QuoteController.class)
class QuoteControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private QuoteService quoteService;

    @Test
    void getTodayQuote_isPublicAndReturnsUnifiedEnvelopeWithFourFields() throws Exception {
        QuoteView quoteView = new QuoteView(
                "人生自苦，他人难悟，唯有自爱，方能自渡",
                "《自渡》—— 佚名",
                "/assets/images/fallback-bg.png",
                "2026-08-23"
        );
        when(quoteService.getTodayQuote()).thenReturn(quoteView);

        mockMvc.perform(get("/api/quotes/today"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("success"))
                .andExpect(jsonPath("$.data.content").value(quoteView.getContent()))
                .andExpect(jsonPath("$.data.source").value(quoteView.getSource()))
                .andExpect(jsonPath("$.data.backgroundImage").value(quoteView.getBackgroundImage()))
                .andExpect(jsonPath("$.data.displayDate").value(quoteView.getDisplayDate()));
    }

    @Test
    void getTodayQuote_returnsStandardErrorCode_whenFallbackConfigMissing() throws Exception {
        // 兜底配置缺失对应契约错误码 2001，统一处理器应把 IllegalStateException 转成标准响应体。
        when(quoteService.getTodayQuote())
                .thenThrow(new IllegalStateException("兜底语录正文配置缺失，无法返回完整内容"));

        mockMvc.perform(get("/api/quotes/today"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value(2001))
                .andExpect(jsonPath("$.message").isNotEmpty())
                .andExpect(jsonPath("$.data").value(nullValue()));
    }

    @Test
    void getTodayQuote_returnsStandardErrorCode_whenFallbackSourceFormatInvalid() throws Exception {
        // 兜底出处格式非法对应契约错误码 2002，统一处理器应把 IllegalArgumentException 转成标准响应体。
        when(quoteService.getTodayQuote())
                .thenThrow(new IllegalArgumentException("兜底语录出处格式非法，必须为「《书名》—— 作者」"));

        mockMvc.perform(get("/api/quotes/today"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value(2002))
                .andExpect(jsonPath("$.message").isNotEmpty())
                .andExpect(jsonPath("$.data").value(nullValue()));
    }

    /**
     * 当前工程暂未提供独立启动类，切片测试通过该配置类提供 Spring 配置锚点；
     * 仅扫描 common/config 下的 MVC 组件，避免把 Service/Mapper 一并载入。
     */
    @SpringBootConfiguration
    @ComponentScan(basePackages = {
            "com.dailyquote.quote.common",
            "com.dailyquote.quote.config"
    })
    static class QuoteControllerTestConfiguration {
    }
}
