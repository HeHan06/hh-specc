package com.aiguide.content.controller;

import com.aiguide.common.ApiResponse;
import com.aiguide.common.PageResult;
import com.aiguide.content.dto.ContentDetailView;
import com.aiguide.content.dto.ContentStatsView;
import com.aiguide.content.dto.ContentSummaryView;
import com.aiguide.content.service.ContentService;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 阅读站内容查询入口。仅暴露已发布内容，详情累计浏览数。
 */
@Validated
@RestController
@RequestMapping("/api/contents")
@Capability(req = "Req-1", name = "阅读站内容")
public class ContentController {

    private final ContentService contentService;

    public ContentController(ContentService contentService) {
        this.contentService = contentService;
    }

    @GetMapping
    @CapabilityPoint(task = "T-14", name = "分页查询专题内容")
    public ApiResponse<PageResult<ContentSummaryView>> listByCategory(@RequestParam @Size(min = 1, max = 64) String categoryCode,
                                                                       @RequestParam(defaultValue = "1") @Min(1) int pageNum,
                                                                       @RequestParam(defaultValue = "20") @Min(1) @Max(100) int pageSize) {
        return ApiResponse.success(contentService.pageByCategory(categoryCode, pageNum, pageSize));
    }

    @GetMapping("/latest")
    @CapabilityPoint(task = "T-14", name = "分页查询最新内容")
    public ApiResponse<PageResult<ContentSummaryView>> listLatest(@RequestParam(defaultValue = "1") @Min(1) int pageNum,
                                                                   @RequestParam(defaultValue = "20") @Min(1) @Max(100) int pageSize) {
        return ApiResponse.success(contentService.pageLatest(pageNum, pageSize));
    }

    @GetMapping("/recommended")
    @CapabilityPoint(task = "T-14", name = "分页查询推荐内容")
    public ApiResponse<PageResult<ContentSummaryView>> listRecommended(@RequestParam(defaultValue = "1") @Min(1) int pageNum,
                                                                        @RequestParam(defaultValue = "20") @Min(1) @Max(100) int pageSize) {
        return ApiResponse.success(contentService.pageRecommended(pageNum, pageSize));
    }

    @GetMapping("/search")
    @CapabilityPoint(task = "T-14", name = "搜索已发布内容")
    public ApiResponse<PageResult<ContentSummaryView>> search(@RequestParam @Size(min = 1, max = 50) String keyword,
                                                               @RequestParam(defaultValue = "1") @Min(1) int pageNum,
                                                               @RequestParam(defaultValue = "20") @Min(1) @Max(100) int pageSize) {
        return ApiResponse.success(contentService.search(keyword, pageNum, pageSize));
    }

    @GetMapping("/stats")
    @CapabilityPoint(task = "T-14", name = "查询内容聚合统计")
    public ApiResponse<ContentStatsView> stats() {
        return ApiResponse.success(contentService.getStats());
    }

    @GetMapping("/{contentCode}")
    @CapabilityPoint(task = "T-14", name = "查询已发布内容详情")
    public ApiResponse<ContentDetailView> detail(@PathVariable @Size(min = 1, max = 64) String contentCode,
                                                 @RequestHeader(name = "X-Visitor-Id", required = false) @Size(min = 8, max = 64) String visitorId) {
        return ApiResponse.success(contentService.getPublishedDetail(contentCode, visitorId));
    }
}
