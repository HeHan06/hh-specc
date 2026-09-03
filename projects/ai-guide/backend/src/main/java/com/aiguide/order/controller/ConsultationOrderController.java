package com.aiguide.order.controller;

import com.aiguide.common.ApiResponse;
import com.aiguide.order.dto.ConsultationCreateRequest;
import com.aiguide.order.dto.ConsultationCreateResultView;
import com.aiguide.order.dto.ConsultationStatusView;
import com.aiguide.order.service.ConsultationOrderService;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 付费咨询订单公开入口。留资后展示管理员微信号，线下收款完成后再由管理员确认排期。
 */
@Validated
@RestController
@RequestMapping("/api/consultations")
@Capability(req = "Req-6", name = "付费咨询订单")
public class ConsultationOrderController {

    private final ConsultationOrderService consultationOrderService;

    public ConsultationOrderController(ConsultationOrderService consultationOrderService) {
        this.consultationOrderService = consultationOrderService;
    }

    @PostMapping
    @CapabilityPoint(task = "T-14", name = "创建咨询订单")
    public ApiResponse<ConsultationCreateResultView> create(@Valid @RequestBody ConsultationCreateRequest request) {
        return ApiResponse.success(consultationOrderService.create(request));
    }

    @GetMapping("/{orderNo}")
    @CapabilityPoint(task = "T-14", name = "查询咨询订单状态")
    public ApiResponse<ConsultationStatusView> status(@PathVariable @Size(min = 1, max = 40) String orderNo) {
        return ApiResponse.success(consultationOrderService.getByOrderNo(orderNo));
    }
}
