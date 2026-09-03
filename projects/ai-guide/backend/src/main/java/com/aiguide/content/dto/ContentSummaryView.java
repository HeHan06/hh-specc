package com.aiguide.content.dto;

/**
 * 阅读站内容摘要视图。用于专题列表、最新/推荐与搜索结果。
 */
public record ContentSummaryView(String code, String categoryCode, String type,
                                 String title, String summary, String updatedAt) {
}
