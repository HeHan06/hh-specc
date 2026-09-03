package com.aiguide.order.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 创建打赏留资单请求。金额单位为分，可选关联内容与联系方式。
 */
public record TipCreateRequest(
        @Size(max = 64) String contentCode,
        @NotNull @Min(1) Integer amount,
        @Size(max = 50) String contactName,
        @Size(max = 100) String contactValue,
        @Size(max = 500) String message
) {
}
