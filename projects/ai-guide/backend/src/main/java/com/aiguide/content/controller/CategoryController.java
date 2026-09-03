package com.aiguide.content.controller;

import com.aiguide.common.ApiResponse;
import com.aiguide.content.dto.CategoryView;
import com.aiguide.content.service.CategoryService;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 阅读站专题目录入口。
 */
@Validated
@RestController
@RequestMapping("/api/categories")
@Capability(req = "Req-1", name = "阅读站专题目录")
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    @CapabilityPoint(task = "T-14", name = "查询某主题下可见专题")
    public ApiResponse<List<CategoryView>> listVisibleCategories(@RequestParam @Size(min = 1, max = 64) String topicCode) {
        return ApiResponse.success(categoryService.listVisibleCategories(topicCode));
    }
}
