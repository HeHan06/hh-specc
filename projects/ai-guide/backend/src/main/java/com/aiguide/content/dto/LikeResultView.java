package com.aiguide.content.dto;

/**
 * 点赞结果视图。返回当前访客是否已点赞与最新点赞总数。
 */
public record LikeResultView(boolean liked, int likeCount) {
}
