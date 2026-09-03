package com.aiguide.config;

import com.aiguide.security.JwtAuthFilter;
import com.aiguide.security.JwtTokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * 接口鉴权配置。
 * 本期不引入 Spring Security，使用轻量 Servlet 过滤器对 {@code /api/admin/**} 强制 JWT + ADMIN；
 * 登录接口保持公开白名单，其余公开阅读站接口由各自 Controller 按契约提供服务。
 */
@Configuration
@Capability(req = "Req-8", name = "管理员鉴权")
public class SecurityConfig {

    @Bean
    @CapabilityPoint(task = "T-03", name = "注册后台 JWT 鉴权过滤器")
    public FilterRegistrationBean<JwtAuthFilter> jwtAuthFilter(JwtTokenService jwtTokenService,
                                                              ObjectMapper objectMapper) {
        FilterRegistrationBean<JwtAuthFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new JwtAuthFilter(jwtTokenService, objectMapper));
        registration.addUrlPatterns("/api/*");
        registration.setName("jwtAuthFilter");
        registration.setOrder(1);
        return registration;
    }

    @Bean
    @CapabilityPoint(task = "T-12", name = "提供 BCrypt 密码编码器")
    public PasswordEncoder passwordEncoder() {
        // BCrypt 自适应强度；管理员密码仅以哈希入库，禁止明文或可逆加密（宪法 2.6）。
        return new BCryptPasswordEncoder();
    }
}
