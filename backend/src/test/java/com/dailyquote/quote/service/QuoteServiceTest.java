package com.dailyquote.quote.service;

import com.dailyquote.quote.dto.QuoteView;
import com.dailyquote.quote.mapper.QuoteMapper;
import com.dailyquote.quote.mapper.SystemConfigMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.time.ZoneId;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * QuoteService 的单元测试。
 *
 * 本测试是 T-06 的测试先行产物：先固定业务期望，T-07 再按相同契约实现。
 * 当前 QuoteService 为占位实现，因此本测试应以红色失败结束；
 * 断言方向与 Req-2（上海日期查询）、Req-4（无内容回退兜底）、
 * Req-8（格式非法拒绝返回）保持一致。
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class QuoteServiceTest {

    private static final ZoneId SHANGHAI = ZoneId.of("Asia/Shanghai");

    @Mock
    private QuoteMapper quoteMapper;

    @Mock
    private SystemConfigMapper systemConfigMapper;

    @InjectMocks
    private QuoteService quoteService;

    @Test
    void getTodayQuote_returnsPublishedQuote_whenTodayHasPublishedQuote() {
        LocalDate today = LocalDate.now(SHANGHAI);
        QuoteView published = new QuoteView(
                "今日正文",
                "《测试书名》—— 测试作者",
                "/assets/images/today-bg.png",
                today.toString()
        );

        when(quoteMapper.selectPublishedByDisplayDate(today)).thenReturn(published);

        QuoteView result = quoteService.getTodayQuote();

        assertNotNull(result);
        assertEquals(published.getContent(), result.getContent());
        assertEquals(published.getSource(), result.getSource());
        assertEquals(published.getBackgroundImage(), result.getBackgroundImage());
        assertEquals(today.toString(), result.getDisplayDate());
        verify(quoteMapper).selectPublishedByDisplayDate(today);
    }

    @Test
    void getTodayQuote_returnsFallback_whenNoPublishedQuote() {
        LocalDate today = LocalDate.now(SHANGHAI);

        when(quoteMapper.selectPublishedByDisplayDate(today)).thenReturn(null);
        when(systemConfigMapper.selectValueByKey("fallback.quote.content"))
                .thenReturn("人生自苦，他人难悟，唯有自爱，方能自渡");
        when(systemConfigMapper.selectValueByKey("fallback.quote.source"))
                .thenReturn("《自渡》—— 佚名");
        when(systemConfigMapper.selectValueByKey("fallback.quote.backgroundImage"))
                .thenReturn("/assets/images/fallback-bg.png");

        QuoteView result = quoteService.getTodayQuote();

        assertNotNull(result);
        assertEquals("人生自苦，他人难悟，唯有自爱，方能自渡", result.getContent());
        assertEquals("《自渡》—— 佚名", result.getSource());
        assertEquals("/assets/images/fallback-bg.png", result.getBackgroundImage());
        assertEquals(today.toString(), result.getDisplayDate());
        verify(systemConfigMapper).selectValueByKey("fallback.quote.content");
        verify(systemConfigMapper).selectValueByKey("fallback.quote.source");
        verify(systemConfigMapper).selectValueByKey("fallback.quote.backgroundImage");
    }

    @Test
    void getTodayQuote_throwsBusinessException_whenFallbackConfigMissing() {
        LocalDate today = LocalDate.now(SHANGHAI);

        when(quoteMapper.selectPublishedByDisplayDate(today)).thenReturn(null);
        // 缺少正文配置时，服务不应返回残缺内容，而应抛出业务异常。
        when(systemConfigMapper.selectValueByKey("fallback.quote.content")).thenReturn(null);
        when(systemConfigMapper.selectValueByKey("fallback.quote.source"))
                .thenReturn("《自渡》—— 佚名");
        when(systemConfigMapper.selectValueByKey("fallback.quote.backgroundImage"))
                .thenReturn("/assets/images/fallback-bg.png");

        assertThrows(RuntimeException.class, quoteService::getTodayQuote);
    }

    @Test
    void getTodayQuote_throwsBusinessException_whenFallbackSourceFormatInvalid() {
        LocalDate today = LocalDate.now(SHANGHAI);

        when(quoteMapper.selectPublishedByDisplayDate(today)).thenReturn(null);
        when(systemConfigMapper.selectValueByKey("fallback.quote.content"))
                .thenReturn("人生自苦，他人难悟，唯有自爱，方能自渡");
        // 出处不符合「《书名》—— 作者」格式，应在组装视图前被拒绝。
        when(systemConfigMapper.selectValueByKey("fallback.quote.source"))
                .thenReturn("自渡—— 佚名");
        when(systemConfigMapper.selectValueByKey("fallback.quote.backgroundImage"))
                .thenReturn("/assets/images/fallback-bg.png");

        assertThrows(RuntimeException.class, quoteService::getTodayQuote);
    }
}
