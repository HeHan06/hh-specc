package com.aiguide.config;

import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;
import org.springframework.web.servlet.resource.ResourceResolverChain;

/**
 * Web MVC 配置。
 * 保证 {@code /api/*} 由 Controller/统一异常处理优先响应，非 API 路径命中真实静态资源时返回文件，
 * 未命中文件的前端路由统一回退 {@code index.html}，从而支持 Web 阅读站与管理后台的 SPA 深层链接。
 */
@Configuration
@Capability(req = "Req-13", name = "Web MVC 与静态回退")
public class WebMvcConfig implements WebMvcConfigurer {

    private static final String INDEX_HTML = "index.html";
    private static final String API_PREFIX = "api/";

    /**
     * 注册单段与多段静态资源映射，但不覆盖 Spring Boot 默认的 {@code /**} 资源映射。
     * 这样 API Controller 始终优先，同时为前端 SPA 路由提供自定义回退解析器。
     */
    @Override
    @CapabilityPoint(task = "T-16", name = "配置非 API 路由回退 index.html")
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/*", "/**")
                .addResourceLocations(
                        "classpath:/META-INF/resources/",
                        "classpath:/resources/",
                        "classpath:/static/",
                        "classpath:/public/")
                .resourceChain(true)
                .addResolver(new SpaFallbackResourceResolver());
    }

    @Override
    @CapabilityPoint(task = "T-16", name = "根路径转发 index.html")
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/").setViewName("forward:/index.html");
    }

    /**
     * SPA 回退解析器。
     * API 路径一律不回退，避免把不存在的接口伪装成 200 HTML；
     * 带扩展名的缺失资源直接返回 404，避免把缺失的 JS/CSS 误回退为 HTML。
     */
    private static final class SpaFallbackResourceResolver extends PathResourceResolver {

        @Override
        protected Resource resolveResourceInternal(HttpServletRequest request, String requestPath,
                                                   List<? extends Resource> locations,
                                                   ResourceResolverChain chain) {
            String relativePath = stripLeadingSlash(requestPath);
            if (isApiPath(relativePath)) {
                return null;
            }

            Resource resource = super.resolveResourceInternal(request, requestPath, locations, chain);
            if (resource != null) {
                return resource;
            }

            if (looksLikeFileRequest(relativePath)) {
                return null;
            }

            return super.resolveResourceInternal(request, INDEX_HTML, locations, chain);
        }

        private String stripLeadingSlash(String requestPath) {
            if (requestPath == null) {
                return "";
            }
            int index = 0;
            while (index < requestPath.length() && requestPath.charAt(index) == '/') {
                index++;
            }
            return requestPath.substring(index);
        }

        private boolean isApiPath(String path) {
            return "api".equals(path) || path.startsWith(API_PREFIX);
        }

        private boolean looksLikeFileRequest(String path) {
            int slashIndex = path.lastIndexOf('/');
            String leaf = slashIndex >= 0 ? path.substring(slashIndex + 1) : path;
            return leaf.contains(".");
        }
    }
}
