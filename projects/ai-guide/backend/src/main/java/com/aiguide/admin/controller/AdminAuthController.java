package com.aiguide.admin.controller;

import com.aiguide.admin.dto.AdminRequests.LoginRequest;
import com.aiguide.admin.dto.AdminViews.LoginView;
import com.aiguide.admin.dto.AdminViews.MeView;
import com.aiguide.admin.service.AdminAuthService;
import com.aiguide.common.ApiResponse;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 后台鉴权入口。登录接口为鉴权白名单，其余后台接口由 JwtAuthFilter 统一保护。
 */
@RestController
@RequestMapping("/api/admin")
@Capability(req = "Req-8", name = "管理员鉴权")
public class AdminAuthController {

    private final AdminAuthService adminAuthService;

    public AdminAuthController(AdminAuthService adminAuthService) {
        this.adminAuthService = adminAuthService;
    }

    @PostMapping("/auth/login")
    @CapabilityPoint(task = "T-16", name = "管理员登录")
    public ApiResponse<LoginView> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.success(adminAuthService.login(request));
    }

    @GetMapping("/me")
    @CapabilityPoint(task = "T-16", name = "获取当前管理员信息")
    public ApiResponse<MeView> me() {
        return ApiResponse.success(adminAuthService.me());
    }
}
