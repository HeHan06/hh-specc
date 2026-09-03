package com.aiguide.admin.controller;

import com.aiguide.admin.dto.AdminRequests.ArchiveRequest;
import com.aiguide.admin.dto.AdminRequests.CategoryCreateRequest;
import com.aiguide.admin.dto.AdminRequests.CategoryUpdateRequest;
import com.aiguide.admin.dto.AdminRequests.ContentCreateRequest;
import com.aiguide.admin.dto.AdminRequests.ContentUpdateRequest;
import com.aiguide.admin.dto.AdminRequests.PublishRequest;
import com.aiguide.admin.dto.AdminRequests.RestoreRequest;
import com.aiguide.admin.dto.AdminRequests.TopicCreateRequest;
import com.aiguide.admin.dto.AdminRequests.TopicUpdateRequest;
import com.aiguide.admin.dto.AdminRequests.UnpublishRequest;
import com.aiguide.admin.dto.AdminViews.CategoryView;
import com.aiguide.admin.dto.AdminViews.ContentDetailView;
import com.aiguide.admin.dto.AdminViews.ContentListView;
import com.aiguide.admin.dto.AdminViews.ContentPublishView;
import com.aiguide.admin.dto.AdminViews.ContentStatusView;
import com.aiguide.admin.dto.AdminViews.ContentUpdateView;
import com.aiguide.admin.dto.AdminViews.TopicView;
import com.aiguide.admin.service.AdminContentService;
import com.aiguide.common.ApiResponse;
import com.aiguide.common.PageResult;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 后台内容与目录管理入口。Controller 仅做参数接驳与统一响应包装，业务规则全部下沉 Service。
 */
@Validated
@RestController
@RequestMapping("/api/admin")
@Capability(req = "Req-9", name = "后台内容管理")
public class AdminContentController {

    private final AdminContentService adminContentService;

    public AdminContentController(AdminContentService adminContentService) {
        this.adminContentService = adminContentService;
    }

    @GetMapping("/topics")
    @CapabilityPoint(task = "T-16", name = "分页查询主题")
    public ApiResponse<PageResult<TopicView>> pageTopics(@RequestParam(defaultValue = "1") @Min(1) int pageNum,
                                                          @RequestParam(defaultValue = "20") @Min(1) @Max(100) int pageSize,
                                                          @RequestParam(required = false) @Size(max = 100) String keyword,
                                                          @RequestParam(required = false) Boolean enabled) {
        return ApiResponse.success(adminContentService.pageTopics(pageNum, pageSize, keyword, enabled));
    }

    @PostMapping("/topics")
    @CapabilityPoint(task = "T-16", name = "创建主题")
    public ApiResponse<TopicView> createTopic(@Valid @RequestBody TopicCreateRequest request) {
        return ApiResponse.success(adminContentService.createTopic(request));
    }

    @PutMapping("/topics/{topicCode}")
    @CapabilityPoint(task = "T-16", name = "更新主题")
    public ApiResponse<TopicView> updateTopic(@PathVariable @Size(min = 1, max = 64) String topicCode,
                                              @Valid @RequestBody TopicUpdateRequest request) {
        return ApiResponse.success(adminContentService.updateTopic(topicCode, request));
    }

    @GetMapping("/categories")
    @CapabilityPoint(task = "T-16", name = "分页查询专题")
    public ApiResponse<PageResult<CategoryView>> pageCategories(@RequestParam(required = false) @Size(min = 1, max = 64) String topicCode,
                                                                 @RequestParam(defaultValue = "1") @Min(1) int pageNum,
                                                                 @RequestParam(defaultValue = "20") @Min(1) @Max(100) int pageSize,
                                                                 @RequestParam(required = false) @Size(max = 100) String keyword,
                                                                 @RequestParam(required = false) Boolean enabled) {
        return ApiResponse.success(adminContentService.pageCategories(topicCode, pageNum, pageSize, keyword, enabled));
    }

    @PostMapping("/categories")
    @CapabilityPoint(task = "T-16", name = "创建专题")
    public ApiResponse<CategoryView> createCategory(@Valid @RequestBody CategoryCreateRequest request) {
        return ApiResponse.success(adminContentService.createCategory(request));
    }

    @PutMapping("/categories/{categoryCode}")
    @CapabilityPoint(task = "T-16", name = "更新专题")
    public ApiResponse<CategoryView> updateCategory(@PathVariable @Size(min = 1, max = 64) String categoryCode,
                                                    @Valid @RequestBody CategoryUpdateRequest request) {
        return ApiResponse.success(adminContentService.updateCategory(categoryCode, request));
    }

    @GetMapping("/contents")
    @CapabilityPoint(task = "T-16", name = "分页查询内容")
    public ApiResponse<PageResult<ContentListView>> pageContents(@RequestParam(defaultValue = "1") @Min(1) int pageNum,
                                                                  @RequestParam(defaultValue = "20") @Min(1) @Max(100) int pageSize,
                                                                  @RequestParam(required = false) @Size(max = 20) String status,
                                                                  @RequestParam(required = false) @Size(max = 20) String type,
                                                                  @RequestParam(required = false) @Size(min = 1, max = 64) String categoryCode,
                                                                  @RequestParam(required = false) @Size(max = 100) String keyword) {
        return ApiResponse.success(adminContentService.pageContents(pageNum, pageSize, status, type, categoryCode, keyword));
    }

    @PostMapping("/contents")
    @CapabilityPoint(task = "T-16", name = "创建内容草稿")
    public ApiResponse<ContentStatusView> createContent(@Valid @RequestBody ContentCreateRequest request) {
        return ApiResponse.success(adminContentService.createContent(request));
    }

    @GetMapping("/contents/{contentCode}")
    @CapabilityPoint(task = "T-16", name = "获取内容管理详情")
    public ApiResponse<ContentDetailView> getContent(@PathVariable @Size(min = 1, max = 64) String contentCode) {
        return ApiResponse.success(adminContentService.getContent(contentCode));
    }

    @PutMapping("/contents/{contentCode}")
    @CapabilityPoint(task = "T-16", name = "编辑内容")
    public ApiResponse<ContentUpdateView> updateContent(@PathVariable @Size(min = 1, max = 64) String contentCode,
                                                        @Valid @RequestBody ContentUpdateRequest request) {
        return ApiResponse.success(adminContentService.updateContent(contentCode, request));
    }

    @PostMapping("/contents/{contentCode}/publish")
    @CapabilityPoint(task = "T-16", name = "发布内容")
    public ApiResponse<ContentPublishView> publishContent(@PathVariable @Size(min = 1, max = 64) String contentCode,
                                                         @Valid @RequestBody PublishRequest request) {
        return ApiResponse.success(adminContentService.publishContent(contentCode, request));
    }

    @PostMapping("/contents/{contentCode}/unpublish")
    @CapabilityPoint(task = "T-16", name = "下架内容")
    public ApiResponse<ContentStatusView> unpublishContent(@PathVariable @Size(min = 1, max = 64) String contentCode,
                                                           @Valid @RequestBody UnpublishRequest request) {
        return ApiResponse.success(adminContentService.unpublishContent(contentCode, request));
    }

    @PostMapping("/contents/{contentCode}/restore")
    @CapabilityPoint(task = "T-16", name = "恢复发布内容")
    public ApiResponse<ContentStatusView> restoreContent(@PathVariable @Size(min = 1, max = 64) String contentCode,
                                                         @Valid @RequestBody RestoreRequest request) {
        return ApiResponse.success(adminContentService.restoreContent(contentCode, request));
    }

    @PostMapping("/contents/{contentCode}/archive")
    @CapabilityPoint(task = "T-16", name = "归档内容")
    public ApiResponse<ContentStatusView> archiveContent(@PathVariable @Size(min = 1, max = 64) String contentCode,
                                                         @Valid @RequestBody ArchiveRequest request) {
        return ApiResponse.success(adminContentService.archiveContent(contentCode, request));
    }
}
