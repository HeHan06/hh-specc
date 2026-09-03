package com.aiguide.content.dto;

/**
 * 阅读站可见专题视图。字段与 contracts/content.yaml 的 GET /api/categories 响应一致。
 */
public record CategoryView(String code, String topicCode, String name, String description, Integer sortOrder) {
}
