package com.aiguide.order.dto;

/**
 * 打赏留资单公开状态视图。
 */
public record TipStatusView(String orderNo, Integer amountCents, String status, String wechatId, String receivedAt) {
}
