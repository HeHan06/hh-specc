package com.dailyquote.quote.config;

import com.dailyquote.quote.dto.ApiResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * 接口鉴权配置。
 *
 * 本期不引入 Spring Security 依赖，通过轻量过滤器统一执行接口白名单策略：
 * 除契约声明的公开接口外，其余 /api/* 一律拒绝匿名访问，避免后续误加接口后裸奔。
 * 真正需要登录态校验的接口应在 plan 阶段补充令牌解析与角色校验方案。
 */
@Configuration
public class SecurityConfig {

    private static final int CODE_UNAUTHORIZED = 1001;
    private static final Set<String> PUBLIC_API_PATHS = Set.of("/api/quotes/today");

    @Bean
    public FilterRegistrationBean<AuthWhitelistFilter> authWhitelistFilter(ObjectMapper objectMapper) {
        FilterRegistrationBean<AuthWhitelistFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new AuthWhitelistFilter(objectMapper));
        registration.addUrlPatterns("/*");
        registration.setName("authWhitelistFilter");
        registration.setOrder(1);
        return registration;
    }

    private static final class AuthWhitelistFilter extends OncePerRequestFilter {

        private final ObjectMapper objectMapper;

        private AuthWhitelistFilter(ObjectMapper objectMapper) {
            this.objectMapper = objectMapper;
        }

        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
                throws ServletException, IOException {
            String requestPath = request.getRequestURI();
            if (requestPath.startsWith("/api/") && !PUBLIC_API_PATHS.contains(requestPath)) {
                writeUnauthorizedResponse(response);
                return;
            }
            filterChain.doFilter(request, response);
        }

        private void writeUnauthorizedResponse(HttpServletResponse response) throws IOException {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            ApiResponse<Void> body = ApiResponse.error(CODE_UNAUTHORIZED, "未登录或登录态已失效");
            objectMapper.writeValue(response.getWriter(), body);
        }
    }
}
