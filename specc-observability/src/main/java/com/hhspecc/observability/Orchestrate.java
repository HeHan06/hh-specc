package com.hhspecc.observability;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 编排（Orchestration）：显式声明两个能力点之间的调用/依赖边。
 * 标注在方法上，通常 from 指向本方法对应的能力点任务编号，to 指向下游任务编号。
 *
 * <p>这是 MVP 中保证「边不漂移」的手段：调用关系不靠事后推断，
 * 而是由编写者在源码中显式声明，随代码一起演进。</p>
 */
@Documented
@Retention(RetentionPolicy.SOURCE)
@Target(ElementType.METHOD)
public @interface Orchestrate {

    /** 上游能力点任务编号，例如 T-05 */
    String from();

    /** 下游能力点任务编号，例如 T-06 */
    String to();

    /** 关系类型，例如 calls / dependsOn，默认 calls */
    String rel() default "calls";
}
