package com.aiguide.config;

import com.aiguide.common.ApiResponse;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 站点公开配置入口。仅下发留资后展示所需的管理员微信号，不下发任何敏感配置。
 */
@RestController
@RequestMapping("/api/site")
@Capability(req = "Req-7", name = "站点配置")
public class SiteConfigController {

    private final SiteConfigProperties siteConfigProperties;

    public SiteConfigController(SiteConfigProperties siteConfigProperties) {
        this.siteConfigProperties = siteConfigProperties;
    }

    @GetMapping("/config")
    @CapabilityPoint(task = "T-14", name = "下发站点公开配置")
    public ApiResponse<Map<String, String>> getPublicConfig() {
        return ApiResponse.success(Map.of("wechatId", siteConfigProperties.getWechatId()));
    }
}
