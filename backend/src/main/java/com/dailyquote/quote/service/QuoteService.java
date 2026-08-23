package com.dailyquote.quote.service;

import com.dailyquote.quote.dto.QuoteView;
import com.dailyquote.quote.mapper.QuoteMapper;
import com.dailyquote.quote.mapper.SystemConfigMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.regex.Pattern;

/**
 * 今日语录查询服务。
 *
 * 展示日期统一在服务端按 Asia/Shanghai 计算，客户端不传日期；
 * 当日无已上架语录时，从 system_config 读取预置兜底内容组装视图。
 */
@Service
public class QuoteService {

    private static final ZoneId SHANGHAI_ZONE = ZoneId.of("Asia/Shanghai");
    private static final String FALLBACK_CONTENT_KEY = "fallback.quote.content";
    private static final String FALLBACK_SOURCE_KEY = "fallback.quote.source";
    private static final String FALLBACK_BACKGROUND_IMAGE_KEY = "fallback.quote.backgroundImage";

    // 与 quote 表 CHECK 约束保持一致：出处格式必须为「《书名》—— 作者」。
    private static final Pattern SOURCE_FORMAT = Pattern.compile("^《[^》]+》—— .+$");

    private final QuoteMapper quoteMapper;
    private final SystemConfigMapper systemConfigMapper;

    public QuoteService(QuoteMapper quoteMapper, SystemConfigMapper systemConfigMapper) {
        this.quoteMapper = quoteMapper;
        this.systemConfigMapper = systemConfigMapper;
    }

    public QuoteView getTodayQuote() {
        LocalDate today = LocalDate.now(SHANGHAI_ZONE);
        QuoteView published = quoteMapper.selectPublishedByDisplayDate(today);
        if (published != null) {
            return published;
        }

        String content = requireConfig(FALLBACK_CONTENT_KEY, "兜底语录正文");
        String source = requireConfig(FALLBACK_SOURCE_KEY, "兜底语录出处");
        String backgroundImage = requireConfig(FALLBACK_BACKGROUND_IMAGE_KEY, "兜底背景图");

        if (!SOURCE_FORMAT.matcher(source).matches()) {
            throw new IllegalArgumentException("兜底语录出处格式非法，必须为「《书名》—— 作者」");
        }

        return new QuoteView(content, source, backgroundImage, today.toString());
    }

    private String requireConfig(String configKey, String fieldName) {
        String value = systemConfigMapper.selectValueByKey(configKey);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(fieldName + "配置缺失，无法返回完整内容");
        }
        return value;
    }
}
