package com.aiguide.order.dto;

/**
 * 打赏留资单创建结果。含管理员微信号，供访客加微信完成线下支付。
 */
public record TipCreateResultView(String orderNo, Integer amountCents, String status, String wechatId) {
}
