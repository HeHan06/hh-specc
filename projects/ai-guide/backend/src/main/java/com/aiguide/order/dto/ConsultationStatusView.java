package com.aiguide.order.dto;

/**
 * 咨询订单公开状态视图。
 */
public record ConsultationStatusView(String orderNo, Integer priceCents, boolean freeQuotaUsed,
                                     String status, String wechatId, String confirmedAt) {
}
