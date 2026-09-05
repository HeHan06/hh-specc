package com.aiguide.admin.service;

import com.aiguide.admin.dto.AdminRequests.AdvertisementUpdateRequest;
import com.aiguide.advertisement.dto.AdvertisementView;
import com.aiguide.advertisement.mapper.AdvertisementMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 后台广告位管理服务。单槽位广告位，保存即写入 id=1（UPSERT），未配置时查询返回 null。
 */
@Service
public class AdminAdvertisementService {

    private final AdvertisementMapper advertisementMapper;

    public AdminAdvertisementService(AdvertisementMapper advertisementMapper) {
        this.advertisementMapper = advertisementMapper;
    }

    public AdvertisementView get() {
        return advertisementMapper.selectCurrent();
    }

    @Transactional
    public AdvertisementView save(AdvertisementUpdateRequest request) {
        advertisementMapper.upsert(
                request.title().trim(),
                trimToNull(request.description()),
                request.link().trim(),
                Boolean.TRUE.equals(request.enabled()));
        return advertisementMapper.selectCurrent();
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
