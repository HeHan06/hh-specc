package com.aiguide.order.dto;

/**
 * 咨询订单创建结果。最终免费与否由管理员确认排期时判定。
 */
public record ConsultationCreateResultView(String orderNo, Integer priceCents, String status, String wechatId) {
}
