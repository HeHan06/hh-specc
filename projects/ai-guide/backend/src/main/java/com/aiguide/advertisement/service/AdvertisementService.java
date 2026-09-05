package com.aiguide.advertisement.service;

import com.aiguide.advertisement.dto.AdvertisementView;
import com.aiguide.advertisement.mapper.AdvertisementMapper;
import org.springframework.stereotype.Service;

/**
 * 阅读站广告位查询服务。仅下发已启用的广告位；未配置时返回 null，阅读站据此不渲染。
 */
@Service
public class AdvertisementService {

    private final AdvertisementMapper advertisementMapper;

    public AdvertisementService(AdvertisementMapper advertisementMapper) {
        this.advertisementMapper = advertisementMapper;
    }

    public AdvertisementView getEnabled() {
        return advertisementMapper.selectEnabled();
    }
}
