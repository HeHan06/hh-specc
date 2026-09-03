package com.aiguide.order.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 创建付费咨询订单请求。联系方式与期望时间必须由访客完整填写。
 */
public record ConsultationCreateRequest(
        @NotBlank @Size(max = 50) String contactName,
        @NotBlank @Pattern(regexp = "phone|wechat") String contactType,
        @NotBlank @Size(max = 100) String contactValue,
        @NotBlank @Size(max = 200) String topicText,
        @NotBlank @Size(max = 2000) String requestText,
        @NotBlank String expectedTime
) {
}
