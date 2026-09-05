package com.aiguide.admin.controller;

import com.aiguide.admin.dto.AdminRequests.AdvertisementUpdateRequest;
import com.aiguide.admin.service.AdminAdvertisementService;
import com.aiguide.advertisement.dto.AdvertisementView;
import com.aiguide.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 后台广告位管理入口。单槽位广告位，保存即覆盖（UPSERT）。
 */
@Validated
@RestController
@RequestMapping("/api/admin")
public class AdminAdvertisementController {

    private final AdminAdvertisementService adminAdvertisementService;

    public AdminAdvertisementController(AdminAdvertisementService adminAdvertisementService) {
        this.adminAdvertisementService = adminAdvertisementService;
    }

    @GetMapping("/advertisement")
    public ApiResponse<AdvertisementView> get() {
        return ApiResponse.success(adminAdvertisementService.get());
    }

    @PutMapping("/advertisement")
    public ApiResponse<AdvertisementView> save(@Valid @RequestBody AdvertisementUpdateRequest request) {
        return ApiResponse.success(adminAdvertisementService.save(request));
    }
}
