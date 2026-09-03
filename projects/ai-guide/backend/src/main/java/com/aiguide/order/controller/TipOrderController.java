package com.aiguide.order.controller;

import com.aiguide.common.ApiResponse;
import com.aiguide.order.dto.TipCreateRequest;
import com.aiguide.order.dto.TipCreateResultView;
import com.aiguide.order.dto.TipStatusView;
import com.aiguide.order.service.TipOrderService;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 打赏留资单公开入口。创建订单后展示管理员微信号，订单号查询仅暴露必要字段。
 */
@Validated
@RestController
@RequestMapping("/api/tips")
@Capability(req = "Req-5", name = "打赏订单")
public class TipOrderController {

    private final TipOrderService tipOrderService;

    public TipOrderController(TipOrderService tipOrderService) {
        this.tipOrderService = tipOrderService;
    }

    @PostMapping
    @CapabilityPoint(task = "T-14", name = "创建打赏留资单")
    public ApiResponse<TipCreateResultView> create(@Valid @RequestBody TipCreateRequest request,
                                                   @RequestHeader(name = "X-Visitor-Id", required = false) @Size(min = 8, max = 64) String visitorId) {
        return ApiResponse.success(tipOrderService.create(request, visitorId));
    }

    @GetMapping("/{orderNo}")
    @CapabilityPoint(task = "T-14", name = "查询打赏订单状态")
    public ApiResponse<TipStatusView> status(@PathVariable @Size(min = 1, max = 40) String orderNo) {
        return ApiResponse.success(tipOrderService.getByOrderNo(orderNo));
    }
}
