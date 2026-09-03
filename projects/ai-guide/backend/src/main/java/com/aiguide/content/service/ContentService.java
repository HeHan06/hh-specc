package com.aiguide.content.service;

import com.aiguide.common.PageResult;
import com.aiguide.common.ApiErrorCode;
import com.aiguide.common.ApiException;
import com.aiguide.content.mapper.CategoryMapper;
import com.aiguide.content.mapper.ContentMapper;
import com.aiguide.content.dto.ContentDetailView;
import com.aiguide.content.dto.ContentSummaryView;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import org.springframework.stereotype.Service;

/**
 * 阅读站内容查询服务。所有公开查询只返回已发布内容，详情访问同步累计浏览数。
 */
@Service
@Capability(req = "Req-1", name = "阅读站内容")
public class ContentService {

    private final ContentMapper contentMapper;
    private final CategoryMapper categoryMapper;

    public ContentService(ContentMapper contentMapper, CategoryMapper categoryMapper) {
        this.contentMapper = contentMapper;
        this.categoryMapper = categoryMapper;
    }

    @CapabilityPoint(task = "T-08", name = "分页查询专题内容")
    public PageResult<ContentSummaryView> pageByCategory(String categoryCode, int pageNum, int pageSize) {
        if (!Boolean.TRUE.equals(categoryMapper.isVisibleByCode(categoryCode))) {
            throw new ApiException(ApiErrorCode.CATEGORY_NOT_FOUND);
        }
        int offset = (pageNum - 1) * pageSize;
        return PageResult.of(
                contentMapper.selectPublishedByCategory(categoryCode, offset, pageSize),
                contentMapper.countPublishedByCategory(categoryCode),
                pageNum,
                pageSize);
    }

    @CapabilityPoint(task = "T-08", name = "分页查询最新内容")
    public PageResult<ContentSummaryView> pageLatest(int pageNum, int pageSize) {
        int offset = (pageNum - 1) * pageSize;
        return PageResult.of(
                contentMapper.selectLatestPublished(offset, pageSize),
                contentMapper.countLatestPublished(),
                pageNum,
                pageSize);
    }

    @CapabilityPoint(task = "T-08", name = "分页查询推荐内容")
    public PageResult<ContentSummaryView> pageRecommended(int pageNum, int pageSize) {
        int offset = (pageNum - 1) * pageSize;
        return PageResult.of(
                contentMapper.selectRecommendedPublished(offset, pageSize),
                contentMapper.countRecommendedPublished(),
                pageNum,
                pageSize);
    }

    @CapabilityPoint(task = "T-08", name = "搜索已发布内容")
    public PageResult<ContentSummaryView> search(String keyword, int pageNum, int pageSize) {
        String trimmedKeyword = keyword.trim();
        if (trimmedKeyword.isEmpty() || trimmedKeyword.length() > 50) {
            throw new ApiException(ApiErrorCode.PARAM_INVALID);
        }
        try {
            int offset = (pageNum - 1) * pageSize;
            return PageResult.of(
                    contentMapper.searchPublished(trimmedKeyword, offset, pageSize),
                    contentMapper.countSearchPublished(trimmedKeyword),
                    pageNum,
                    pageSize);
        } catch (RuntimeException ex) {
            throw new ApiException(ApiErrorCode.SEARCH_UNAVAILABLE);
        }
    }

    @CapabilityPoint(task = "T-08", name = "查询已发布内容详情")
    public ContentDetailView getPublishedDetail(String contentCode, String visitorId) {
        ContentDetailView detail = hasVisitorId(visitorId)
                ? contentMapper.selectPublishedDetailWithVisitor(contentCode, visitorId)
                : contentMapper.selectPublishedDetail(contentCode);
        if (detail == null) {
            throw new ApiException(ApiErrorCode.CONTENT_NOT_PUBLISHED);
        }
        contentMapper.incrementViewCount(contentCode);
        return detail;
    }

    private boolean hasVisitorId(String visitorId) {
        return visitorId != null && !visitorId.isBlank();
    }
}
