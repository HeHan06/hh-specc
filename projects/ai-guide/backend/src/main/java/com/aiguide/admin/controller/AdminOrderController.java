package com.aiguide.admin.controller;

import com.aiguide.admin.dto.AdminRequests.CancelRequest;
import com.aiguide.admin.dto.AdminRequests.ConfirmRequest;
import com.aiguide.admin.dto.AdminRequests.NoteRequest;
import com.aiguide.admin.dto.AdminRequests.NoteUpdateRequest;
import com.aiguide.admin.dto.AdminViews.ConsultationDetailView;
import com.aiguide.admin.dto.AdminViews.ConsultationListView;
import com.aiguide.admin.dto.AdminViews.TipDetailView;
import com.aiguide.admin.dto.AdminViews.TipListView;
import com.aiguide.admin.service.AdminOrderService;
import com.aiguide.common.ApiResponse;
import com.aiguide.common.PageResult;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 后台订单管理入口。收款确认、排期确认、取消等敏感操作由操作日志切面留痕。
 */
@Validated
@RestController
@RequestMapping("/api/admin")
@Capability(req = "Req-11", name = "后台订单管理")
public class AdminOrderController {

    private final AdminOrderService adminOrderService;

    public AdminOrderController(AdminOrderService adminOrderService) {
        this.adminOrderService = adminOrderService;
    }

    @GetMapping("/tips")
    @CapabilityPoint(task = "T-16", name = "分页查询打赏订单")
    public ApiResponse<PageResult<TipListView>> pageTips(@RequestParam(defaultValue = "1") @Min(1) int pageNum,
                                                          @RequestParam(defaultValue = "20") @Min(1) @Max(100) int pageSize,
                                                          @RequestParam(required = false) @Size(max = 20) String status,
                                                          @RequestParam(required = false) @Size(max = 100) String keyword) {
        return ApiResponse.success(adminOrderService.pageTips(pageNum, pageSize, status, keyword));
    }

    @GetMapping("/tips/{orderNo}")
    @CapabilityPoint(task = "T-16", name = "获取打赏订单详情")
    public ApiResponse<TipDetailView> getTip(@PathVariable @Size(min = 1, max = 40) String orderNo) {
        return ApiResponse.success(adminOrderService.getTip(orderNo));
    }

    @PostMapping("/tips/{orderNo}/receive")
    @CapabilityPoint(task = "T-16", name = "确认打赏收款")
    public ApiResponse<TipDetailView> receiveTip(@PathVariable @Size(min = 1, max = 40) String orderNo) {
        return ApiResponse.success(adminOrderService.receiveTip(orderNo));
    }

    @PostMapping("/tips/{orderNo}/close")
    @CapabilityPoint(task = "T-16", name = "关闭打赏订单")
    public ApiResponse<TipDetailView> closeTip(@PathVariable @Size(min = 1, max = 40) String orderNo) {
        return ApiResponse.success(adminOrderService.closeTip(orderNo));
    }

    @GetMapping("/consultations")
    @CapabilityPoint(task = "T-16", name = "分页查询咨询订单")
    public ApiResponse<PageResult<ConsultationListView>> pageConsultations(@RequestParam(defaultValue = "1") @Min(1) int pageNum,
                                                                            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int pageSize,
                                                                            @RequestParam(required = false) @Size(max = 20) String status,
                                                                            @RequestParam(required = false) @Size(max = 100) String keyword) {
        return ApiResponse.success(adminOrderService.pageConsultations(pageNum, pageSize, status, keyword));
    }

    @GetMapping("/consultations/{orderNo}")
    @CapabilityPoint(task = "T-16", name = "获取咨询订单详情")
    public ApiResponse<ConsultationDetailView> getConsultation(@PathVariable @Size(min = 1, max = 40) String orderNo) {
        return ApiResponse.success(adminOrderService.getConsultation(orderNo));
    }

    @PostMapping("/consultations/{orderNo}/confirm")
    @CapabilityPoint(task = "T-16", name = "确认咨询排期")
    public ApiResponse<ConsultationDetailView> confirmConsultation(@PathVariable @Size(min = 1, max = 40) String orderNo,
                                                                   @Valid @RequestBody(required = false) ConfirmRequest request) {
        return ApiResponse.success(adminOrderService.confirmConsultation(orderNo, request));
    }

    @PostMapping("/consultations/{orderNo}/complete")
    @CapabilityPoint(task = "T-16", name = "完成咨询订单")
    public ApiResponse<ConsultationDetailView> completeConsultation(@PathVariable @Size(min = 1, max = 40) String orderNo,
                                                                    @Valid @RequestBody(required = false) NoteRequest request) {
        return ApiResponse.success(adminOrderService.completeConsultation(orderNo, request));
    }

    @PostMapping("/consultations/{orderNo}/cancel")
    @CapabilityPoint(task = "T-16", name = "取消咨询订单")
    public ApiResponse<ConsultationDetailView> cancelConsultation(@PathVariable @Size(min = 1, max = 40) String orderNo,
                                                                  @Valid @RequestBody CancelRequest request) {
        return ApiResponse.success(adminOrderService.cancelConsultation(orderNo, request));
    }

    @PostMapping("/consultations/{orderNo}/note")
    @CapabilityPoint(task = "T-16", name = "更新咨询订单备注")
    public ApiResponse<ConsultationDetailView> updateConsultationNote(@PathVariable @Size(min = 1, max = 40) String orderNo,
                                                                      @Valid @RequestBody NoteUpdateRequest request) {
        return ApiResponse.success(adminOrderService.updateConsultationNote(orderNo, request));
    }
}
