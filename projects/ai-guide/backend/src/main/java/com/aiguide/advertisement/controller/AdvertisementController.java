package com.aiguide.advertisement.controller;

import com.aiguide.advertisement.dto.AdvertisementView;
import com.aiguide.advertisement.service.AdvertisementService;
import com.aiguide.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 阅读站广告位入口。Controller 只负责参数与统一响应包装，不写业务逻辑。
 */
@RestController
@RequestMapping("/api/advertisement")
public class AdvertisementController {

    private final AdvertisementService advertisementService;

    public AdvertisementController(AdvertisementService advertisementService) {
        this.advertisementService = advertisementService;
    }

    @GetMapping
    public ApiResponse<AdvertisementView> getEnabled() {
        return ApiResponse.success(advertisementService.getEnabled());
    }
}
