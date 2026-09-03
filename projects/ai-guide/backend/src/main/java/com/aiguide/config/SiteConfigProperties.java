package com.aiguide.config;

import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 站点级配置。
 * 管理员微信号从环境变量 {@code ADMIN_WECHAT_ID} 读取，用于阅读站在留资后展示加微信收款提示；
 * 默认值仅作为本地开发兜底，生产环境应从环境变量显式注入。
 */
@Component
@Capability(req = "Req-7", name = "站点配置")
public class SiteConfigProperties {

    private final String wechatId;

    public SiteConfigProperties(@Value("${ADMIN_WECHAT_ID:15306507997}") String wechatId) {
        this.wechatId = wechatId;
    }

    @CapabilityPoint(task = "T-03", name = "读取管理员微信号配置")
    public String getWechatId() {
        return wechatId;
    }
}
