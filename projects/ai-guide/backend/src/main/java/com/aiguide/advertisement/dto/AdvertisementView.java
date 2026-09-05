package com.aiguide.advertisement.dto;

/**
 * 广告位视图。阅读站仅下发已启用的广告位；后台返回当前槽位（含禁用态）用于编辑。
 */
public record AdvertisementView(String title, String description, String link, boolean enabled) {
}
