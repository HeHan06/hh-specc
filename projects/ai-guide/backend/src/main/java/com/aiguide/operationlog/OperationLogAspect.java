package com.aiguide.operationlog;

import com.aiguide.common.ApiErrorCode;
import com.aiguide.common.ApiException;
import com.aiguide.security.JwtAuthFilter;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * 敏感操作日志切面。
 * 先校验当前请求上下文中的管理员身份，再调用日志服务落库；日志服务在 T-12 中实现为
 * 与业务更新同事务的 MyBatis 写入。该切面运行在业务事务入口内，不吞日志失败。
 */
@Aspect
@Component
@Capability(req = "Req-11", name = "敏感操作日志")
public class OperationLogAspect {

    private static final Logger log = LoggerFactory.getLogger(OperationLogAspect.class);

    private final OperationLogService operationLogService;

    public OperationLogAspect(OperationLogService operationLogService) {
        this.operationLogService = operationLogService;
    }

    @Around("@annotation(operationLog)")
    @CapabilityPoint(task = "T-03", name = "拦截敏感操作并落日志")
    public Object around(ProceedingJoinPoint joinPoint, OperationLog operationLog) throws Throwable {
        AdminContext admin = requireAdmin();
        Object result = joinPoint.proceed();

        try {
            String targetCode = resolve(operationLog.targetCode(), joinPoint, result);
            if (targetCode == null || targetCode.isBlank()) {
                targetCode = inferTargetCode(joinPoint);
            }
            operationLogService.record(
                    admin.userId(),
                    operationLog.action(),
                    operationLog.targetType(),
                    targetCode,
                    emptyToNull(resolve(operationLog.beforeState(), joinPoint, result)),
                    emptyToNull(resolve(operationLog.afterState(), joinPoint, result)),
                    emptyToNull(resolve(operationLog.detail(), joinPoint, result))
            );
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("敏感操作日志写入失败：action={}, targetType={}", operationLog.action(), operationLog.targetType(), ex);
            throw new ApiException(ApiErrorCode.SYSTEM_ERROR, "敏感操作日志写入失败");
        }
        return result;
    }

    private AdminContext requireAdmin() {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes == null) {
            throw new ApiException(ApiErrorCode.FORBIDDEN, "敏感操作必须在受保护的 HTTP 请求上下文中执行");
        }
        HttpServletRequest request = attributes.getRequest();
        Object role = request.getAttribute(JwtAuthFilter.ATTR_ROLE);
        Object userId = request.getAttribute(JwtAuthFilter.ATTR_USER_ID);
        if (!"ADMIN".equals(role) || !(userId instanceof Number)) {
            throw new ApiException(ApiErrorCode.FORBIDDEN);
        }
        return new AdminContext(((Number) userId).longValue());
    }

    private String resolve(String expression, ProceedingJoinPoint joinPoint, Object result) {
        if (expression == null || expression.isBlank()) {
            return null;
        }
        String trimmed = expression.trim();
        if (!trimmed.startsWith("#")) {
            return trimmed;
        }

        StandardEvaluationContext context = new StandardEvaluationContext();
        Object[] args = joinPoint.getArgs();
        context.setVariable("args", args);
        context.setVariable("result", result);
        for (int i = 0; i < args.length; i++) {
            context.setVariable("p" + i, args[i]);
            context.setVariable("a" + i, args[i]);
        }

        try {
            Object value = new SpelExpressionParser().parseExpression(trimmed).getValue(context);
            return value == null ? null : String.valueOf(value);
        } catch (Exception ex) {
            log.error("操作日志 SpEL 表达式解析失败：{}", trimmed, ex);
            throw new ApiException(ApiErrorCode.SYSTEM_ERROR, "敏感操作日志表达式解析失败");
        }
    }

    private String inferTargetCode(ProceedingJoinPoint joinPoint) {
        for (Object arg : joinPoint.getArgs()) {
            if (arg instanceof String value && !value.isBlank()) {
                return value;
            }
        }
        throw new ApiException(ApiErrorCode.SYSTEM_ERROR, "敏感操作日志目标编码缺失");
    }

    private String emptyToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value;
    }

    private record AdminContext(Long userId) {
    }
}
