package com.aiguide.content.dto;

/**
 * 阅读站内容聚合统计视图：全站累计浏览数与获赞数（仅已发布内容）。
 */
public record ContentStatsView(long totalViews, long totalLikes) {
}
