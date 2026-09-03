package com.aiguide.admin.controller;

import com.aiguide.admin.dto.AdminViews.OperationLogView;
import com.aiguide.admin.service.AdminOperationLogService;
import com.aiguide.common.ApiResponse;
import com.aiguide.common.PageResult;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 敏感操作日志查询入口。
 */
@Validated
@RestController
@RequestMapping("/api/admin/operation-logs")
@Capability(req = "Req-11", name = "敏感操作日志")
public class OperationLogController {

    private final AdminOperationLogService adminOperationLogService;

    public OperationLogController(AdminOperationLogService adminOperationLogService) {
        this.adminOperationLogService = adminOperationLogService;
    }

    @GetMapping
    @CapabilityPoint(task = "T-16", name = "分页查询操作日志")
    public ApiResponse<PageResult<OperationLogView>> pageOperationLogs(@RequestParam(defaultValue = "1") @Min(1) int pageNum,
                                                                        @RequestParam(defaultValue = "20") @Min(1) @Max(100) int pageSize,
                                                                        @RequestParam(required = false) @Size(max = 16) String targetType,
                                                                        @RequestParam(required = false) @Size(max = 64) String action) {
        return ApiResponse.success(adminOperationLogService.pageOperationLogs(pageNum, pageSize, targetType, action));
    }
}
