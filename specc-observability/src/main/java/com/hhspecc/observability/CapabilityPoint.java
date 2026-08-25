package com.hhspecc.observability;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 能力点（Capability Point）：对应 tasks.md 中的一个任务 T-XX。
 * 标注在方法上，表示该方法实现某个可观测的原子能力点。
 *
 * <p>所属能力（Capability）由其所在类上的 {@link Capability} 自动推导，
 * 无需在此重复声明。</p>
 */
@Documented
@Retention(RetentionPolicy.SOURCE)
@Target(ElementType.METHOD)
public @interface CapabilityPoint {

    /** 任务编号，例如 T-05 */
    String task();

    /** 能力点名称，例如「获取今日语录」 */
    String name();
}
