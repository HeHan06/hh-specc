package com.aiguide.content.dto;

/**
 * 阅读站可见主题视图。字段与 contracts/content.yaml 的 GET /api/topics 响应一致。
 */
public record TopicView(String code, String name, String description, Integer sortOrder) {
}
