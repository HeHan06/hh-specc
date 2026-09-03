package com.aiguide.admin.service;

import com.aiguide.admin.dto.AdminRequests.LoginRequest;
import com.aiguide.admin.dto.AdminViews.LoginView;
import com.aiguide.admin.dto.AdminViews.MeView;
import com.aiguide.admin.domain.AdminUser;
import com.aiguide.admin.mapper.AdminUserMapper;
import com.aiguide.common.ApiErrorCode;
import com.aiguide.common.ApiException;
import com.aiguide.security.JwtAuthFilter;
import com.aiguide.security.JwtTokenService;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * 后台鉴权服务。账号密码通过 BCrypt 校验，成功签发唯一 ADMIN 角色的 JWT；
 * 登录失败统一返回 2300，不泄露账号是否存在。
 */
@Service
@Capability(req = "Req-8", name = "管理员鉴权")
public class AdminAuthService {

    private final AdminUserMapper adminUserMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;

    public AdminAuthService(AdminUserMapper adminUserMapper,
                            PasswordEncoder passwordEncoder,
                            JwtTokenService jwtTokenService) {
        this.adminUserMapper = adminUserMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
    }

    @CapabilityPoint(task = "T-12", name = "管理员登录")
    public LoginView login(LoginRequest request) {
        AdminUser adminUser = adminUserMapper.selectByUsername(request.username());
        if (adminUser == null || !passwordEncoder.matches(request.password(), adminUser.passwordHash())) {
            throw new ApiException(ApiErrorCode.ADMIN_LOGIN_FAILED);
        }
        if (!"enabled".equals(adminUser.status())) {
            throw new ApiException(ApiErrorCode.ADMIN_DISABLED);
        }
        if (!"ADMIN".equals(adminUser.role())) {
            throw new ApiException(ApiErrorCode.FORBIDDEN);
        }

        String token = jwtTokenService.generateToken(adminUser.id(), adminUser.username(), adminUser.role());
        return new LoginView(token, adminUser.username(), adminUser.role());
    }

    @CapabilityPoint(task = "T-12", name = "获取当前管理员信息")
    public MeView me() {
        ServletRequestAttributes attributes =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes == null) {
            // 无请求上下文时回退到唯一管理员；鉴权过滤器在真实请求中必会写入用户名与角色。
            return new MeView("admin", "ADMIN");
        }
        Object username = attributes.getRequest().getAttribute(JwtAuthFilter.ATTR_USERNAME);
        Object role = attributes.getRequest().getAttribute(JwtAuthFilter.ATTR_ROLE);
        return new MeView(username == null ? "admin" : String.valueOf(username),
                role == null ? "ADMIN" : String.valueOf(role));
    }
}
