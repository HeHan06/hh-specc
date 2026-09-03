package com.aiguide.content.dto;

import java.util.List;

/**
 * 阅读站已发布内容详情视图。字段与 contracts/content.yaml 的 GET /api/contents/{contentCode} 一致。
 */
public record ContentDetailView(String code, String categoryCode, String topicCode, String type,
                                String title, String summary, String body, List<String> tags,
                                String source, int likeCount, long viewCount, boolean liked,
                                String publishedAt, String updatedAt) {
}
