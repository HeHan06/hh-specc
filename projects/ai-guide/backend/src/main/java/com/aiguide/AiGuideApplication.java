package com.aiguide;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * ai-guide 后端启动入口。
 * 组件扫描、自动配置与 MyBatis Mapper 扫描均以本类所在包 {@code com.aiguide} 为根。
 */
@SpringBootApplication
public class AiGuideApplication {

    public static void main(String[] args) {
        SpringApplication.run(AiGuideApplication.class, args);
    }
}
