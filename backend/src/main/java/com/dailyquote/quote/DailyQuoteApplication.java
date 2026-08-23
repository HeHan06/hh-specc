package com.dailyquote.quote;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 每日一句后端服务启动类。
 *
 * 说明：这是 Spring Boot 应用唯一入口，@SpringBootApplication 会扫描
 * 本包（com.dailyquote.quote）及其子包下的 Controller/Service/Config 等组件，
 * 使其能被装配为可运行的 Web 服务。此前实现阶段遗漏了该主类，
 * 导致 spring-boot-maven-plugin 无法 repackage 出可运行 JAR。
 */
@SpringBootApplication
public class DailyQuoteApplication {

    public static void main(String[] args) {
        SpringApplication.run(DailyQuoteApplication.class, args);
    }
}
