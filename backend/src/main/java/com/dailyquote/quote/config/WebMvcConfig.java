package com.dailyquote.quote.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web 静态路由配置。
 *
 * Web 构建产物由后端静态托管：根路径与非 API 前端路由都回退到 index.html；
 * REST 控制器使用精确路径映射，Spring MVC 会优先匹配 /api/quotes/today，
 * 因此回退规则不会吞掉 API。
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/").setViewName("forward:/index.html");
        // 仅对不含扩展名的单段前端路由回退到 index.html。
        // 注意：不能用 /{path:[^\\.]*}/** 这类多段规则，否则会把
        // /assets/images/fallback-bg.png、/assets/index-*.js 等静态资源也吞掉，
        // 导致静态资源 forward 到 index.html 而 500。
        registry.addViewController("/{path:[^\\.]*}").setViewName("forward:/index.html");
    }
}
