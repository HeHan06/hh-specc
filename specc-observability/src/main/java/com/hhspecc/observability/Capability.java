package com.hhspecc.observability;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 能力（Capability）：对应 spec.md 中的一条需求 Req-N。
 * 标注在类/接口上，表示该类归属于某个业务能力面。
 *
 * <p>保留策略为 {@link RetentionPolicy#SOURCE}：注解仅存在于源码，
 * 编译后不进入字节码，运行时 JVM 不加载、不反射、零开销。
 * 其唯一生效点发生在编译期，由 APT 处理器扫描并生成 code-graph.json。</p>
 */
@Documented
@Retention(RetentionPolicy.SOURCE)
@Target(ElementType.TYPE)
public @interface Capability {

    /** 需求编号，例如 Req-1 */
    String req();

    /** 能力名称，例如「今日语录」 */
    String name();
}
