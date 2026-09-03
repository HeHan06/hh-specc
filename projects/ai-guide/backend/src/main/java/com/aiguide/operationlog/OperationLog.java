package com.aiguide.operationlog;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 敏感操作日志标注。
 * 标注在后台 Service 的敏感写方法上，由 {@link OperationLogAspect} 在业务事务内统一记录
 * 操作者、动作、目标对象与状态变化；表达式字段支持 SpEL（如 {@code #p0} 或方法参数名）。
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface OperationLog {

    /** 动作名称，例如「确认打赏收款」。 */
    String action();

    /** 目标类型，与 operation_log.target_type 对应，例如 tip/consultation/content。 */
    String targetType();

    /** 目标编码，支持 SpEL 表达式；留空则由切面尝试从首个 String 参数推导。 */
    String targetCode() default "";

    /** 操作前状态，支持 SpEL 表达式。 */
    String beforeState() default "";

    /** 操作后状态，支持 SpEL 表达式。 */
    String afterState() default "";

    /** 补充说明，支持 SpEL 表达式。 */
    String detail() default "";
}
