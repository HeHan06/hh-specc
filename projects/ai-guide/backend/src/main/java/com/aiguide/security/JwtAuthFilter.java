package com.aiguide.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import com.aiguide.common.ApiErrorCode;
import com.aiguide.common.ApiResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * JWT Bearer 鉴权过滤器。
 * 仅拦截 {@code /api/admin/**}：登录接口为公开白名单，其余后台接口必须携带有效 JWT 且角色为 ADMIN。
 * 阅读站公开接口与登录白名单不受本过滤器限制；校验通过后把用户 ID/用户名/角色写入请求属性，
 * 供后续 Controller 与操作日志切面读取。
 */
@Capability(req = "Req-8", name = "管理员鉴权")
public class JwtAuthFilter extends OncePerRequestFilter {

    public static final String ATTR_USER_ID = "aiguide.auth.userId";
    public static final String ATTR_USERNAME = "aiguide.auth.username";
    public static final String ATTR_ROLE = "aiguide.auth.role";

    private static final String ROLE_ADMIN = "ADMIN";
    private static final String ADMIN_LOGIN_PATH = "/api/admin/auth/login";

    private final JwtTokenService jwtTokenService;
    private final ObjectMapper objectMapper;

    public JwtAuthFilter(JwtTokenService jwtTokenService, ObjectMapper objectMapper) {
        this.jwtTokenService = jwtTokenService;
        this.objectMapper = objectMapper;
    }

    @Override
    @CapabilityPoint(task = "T-03", name = "执行后台接口 JWT 鉴权")
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        // CORS 预检请求不校验令牌，避免浏览器预检被误拦。
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String path = request.getRequestURI();
        if (!path.startsWith("/api/admin/")) {
            filterChain.doFilter(request, response);
            return;
        }

        if (isPublicLoginEndpoint(request, path)) {
            filterChain.doFilter(request, response);
            return;
        }

        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            writeErrorResponse(response, ApiErrorCode.UNAUTHORIZED);
            return;
        }

        try {
            JwtTokenService.JwtClaims claims = jwtTokenService.parseToken(authorization.substring(7).trim());
            if (claims.role() == null || !ROLE_ADMIN.equals(claims.role())) {
                writeErrorResponse(response, ApiErrorCode.FORBIDDEN);
                return;
            }
            request.setAttribute(ATTR_USER_ID, claims.userId());
            request.setAttribute(ATTR_USERNAME, claims.username());
            request.setAttribute(ATTR_ROLE, claims.role());
            filterChain.doFilter(request, response);
        } catch (RuntimeException ex) {
            writeErrorResponse(response, ApiErrorCode.UNAUTHORIZED);
        }
    }

    private boolean isPublicLoginEndpoint(HttpServletRequest request, String path) {
        return ADMIN_LOGIN_PATH.equals(path) && "POST".equalsIgnoreCase(request.getMethod());
    }

    private void writeErrorResponse(HttpServletResponse response, ApiErrorCode errorCode) throws IOException {
        int status = errorCode == ApiErrorCode.UNAUTHORIZED
                ? HttpServletResponse.SC_UNAUTHORIZED
                : HttpServletResponse.SC_FORBIDDEN;
        response.setStatus(status);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), ApiResponse.error(errorCode));
    }
}
