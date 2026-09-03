package com.aiguide.content.service;

import com.aiguide.common.ApiException;
import com.aiguide.common.PageResult;
import com.aiguide.content.dto.CategoryView;
import com.aiguide.content.dto.ContentDetailView;
import com.aiguide.content.dto.ContentSummaryView;
import com.aiguide.content.dto.LikeResultView;
import com.aiguide.content.dto.TopicView;
import com.aiguide.content.mapper.CategoryMapper;
import com.aiguide.content.mapper.ContentMapper;
import com.aiguide.content.mapper.LikeMapper;
import com.aiguide.content.mapper.TopicMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DuplicateKeyException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 阅读站内容公开能力 Service 测试（T-07 测试先行）。
 *
 * 当前 ContentService/TopicService/CategoryService/LikeService 均为 T-04 占位实现，
 * 因此本测试在 T-08 实现前应以红色失败结束；断言方向与契约及 plan 保持一致：
 * 启用主题/专题目录、仅已发布内容可见、最新/推荐排序、搜索（pg_trgm 加速 + ILIKE 兜底）、
 * 详情仅对已发布内容累计浏览数、点赞幂等与唯一约束。
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ContentServiceTest {

    private static final String CONTENT_CODE = "content-1";
    private static final String VISITOR_ID = "visitor-0001";

    @Mock
    private TopicMapper topicMapper;

    @Mock
    private CategoryMapper categoryMapper;

    @Mock
    private ContentMapper contentMapper;

    @Mock
    private LikeMapper likeMapper;

    @InjectMocks
    private TopicService topicService;

    @InjectMocks
    private CategoryService categoryService;

    @InjectMocks
    private ContentService contentService;

    @InjectMocks
    private LikeService likeService;

    @Test
    void listVisibleTopics_returnsEnabledTopics() {
        List<TopicView> topics = List.of(
                new TopicView("agent", "Agent 设计", "Agent 架构与设计", 1)
        );
        when(topicMapper.selectVisibleTopics()).thenReturn(topics);

        List<TopicView> result = topicService.listVisibleTopics();

        assertEquals(topics, result);
        verify(topicMapper).selectVisibleTopics();
    }

    @Test
    void listVisibleCategories_returnsEnabledCategoriesForTopic() {
        List<CategoryView> categories = List.of(
                new CategoryView("langchain", "agent", "LangChain", "框架与工具", 1)
        );
        when(topicMapper.isVisibleByCode("agent")).thenReturn(true);
        when(categoryMapper.selectVisibleCategories("agent")).thenReturn(categories);

        List<CategoryView> result = categoryService.listVisibleCategories("agent");

        assertEquals(categories, result);
        verify(categoryMapper).selectVisibleCategories("agent");
    }

    @Test
    void listVisibleCategories_throwsTopicNotFound_whenTopicNotVisible() {
        when(topicMapper.isVisibleByCode("missing")).thenReturn(false);

        ApiException ex = assertThrows(ApiException.class,
                () -> categoryService.listVisibleCategories("missing"));

        assertEquals(2001, ex.getErrorCode().getCode());
        verify(categoryMapper, never()).selectVisibleCategories("missing");
    }

    @Test
    void pageByCategory_returnsOnlyPublishedContent() {
        List<ContentSummaryView> items = List.of(summary(CONTENT_CODE));
        when(categoryMapper.isVisibleByCode("langchain")).thenReturn(true);
        when(contentMapper.selectPublishedByCategory("langchain", 0, 20)).thenReturn(items);
        when(contentMapper.countPublishedByCategory("langchain")).thenReturn(1L);

        PageResult<ContentSummaryView> result = contentService.pageByCategory("langchain", 1, 20);

        assertEquals(items, result.list());
        assertEquals(1L, result.total());
        assertEquals(1, result.pageNum());
        assertEquals(20, result.pageSize());
        verify(contentMapper).selectPublishedByCategory("langchain", 0, 20);
        verify(contentMapper).countPublishedByCategory("langchain");
    }

    @Test
    void pageByCategory_throwsCategoryNotFound_whenCategoryNotVisible() {
        when(categoryMapper.isVisibleByCode("missing")).thenReturn(false);

        ApiException ex = assertThrows(ApiException.class,
                () -> contentService.pageByCategory("missing", 1, 20));

        assertEquals(2002, ex.getErrorCode().getCode());
        verify(contentMapper, never()).selectPublishedByCategory(anyString(), anyInt(), anyInt());
    }

    @Test
    void pageByCategory_appliesOneBasedPageNumberToOffset() {
        when(categoryMapper.isVisibleByCode("langchain")).thenReturn(true);
        when(contentMapper.selectPublishedByCategory("langchain", 40, 20)).thenReturn(List.of());
        when(contentMapper.countPublishedByCategory("langchain")).thenReturn(0L);

        contentService.pageByCategory("langchain", 3, 20);

        verify(contentMapper).selectPublishedByCategory("langchain", 40, 20);
    }

    @Test
    void pageLatest_returnsNewestPublishedContentFirst() {
        List<ContentSummaryView> items = List.of(summary("new-2"), summary("new-1"));
        when(contentMapper.selectLatestPublished(0, 20)).thenReturn(items);
        when(contentMapper.countLatestPublished()).thenReturn(2L);

        PageResult<ContentSummaryView> result = contentService.pageLatest(1, 20);

        assertEquals(items, result.list());
        assertEquals(2L, result.total());
        verify(contentMapper).selectLatestPublished(0, 20);
        verify(contentMapper).countLatestPublished();
    }

    @Test
    void pageRecommended_returnsRecommendedPublishedContent() {
        List<ContentSummaryView> items = List.of(summary("rec-1"));
        when(contentMapper.selectRecommendedPublished(0, 20)).thenReturn(items);
        when(contentMapper.countRecommendedPublished()).thenReturn(1L);

        PageResult<ContentSummaryView> result = contentService.pageRecommended(1, 20);

        assertEquals(items, result.list());
        assertEquals(1L, result.total());
        verify(contentMapper).selectRecommendedPublished(0, 20);
        verify(contentMapper).countRecommendedPublished();
    }

    @Test
    void search_trimsKeywordAndDelegatesToMapperWhichUsesTrgmWithIlikeFallback() {
        List<ContentSummaryView> items = List.of(summary(CONTENT_CODE));
        when(contentMapper.searchPublished("agent", 0, 20)).thenReturn(items);
        when(contentMapper.countSearchPublished("agent")).thenReturn(1L);

        PageResult<ContentSummaryView> result = contentService.search("  agent  ", 1, 20);

        assertEquals(items, result.list());
        assertEquals(1L, result.total());
        verify(contentMapper).searchPublished("agent", 0, 20);
        verify(contentMapper).countSearchPublished("agent");
    }

    @Test
    void search_throwsSearchUnavailable_whenSearchExecutionFails() {
        when(contentMapper.searchPublished("agent", 0, 20))
                .thenThrow(new RuntimeException("db error"));

        ApiException ex = assertThrows(ApiException.class,
                () -> contentService.search("agent", 1, 20));

        assertEquals(2003, ex.getErrorCode().getCode());
    }

    @Test
    void getPublishedDetail_returnsDetailAndIncrementsViewCount() {
        ContentDetailView detail = detail(false);
        when(contentMapper.selectPublishedDetail(CONTENT_CODE)).thenReturn(detail);
        when(contentMapper.incrementViewCount(CONTENT_CODE)).thenReturn(1);

        ContentDetailView result = contentService.getPublishedDetail(CONTENT_CODE, null);

        assertNotNull(result);
        assertEquals(CONTENT_CODE, result.code());
        assertFalse(result.liked());
        verify(contentMapper).selectPublishedDetail(CONTENT_CODE);
        verify(contentMapper).incrementViewCount(CONTENT_CODE);
    }

    @Test
    void getPublishedDetail_throwsBusinessError_whenContentNotPublished() {
        when(contentMapper.selectPublishedDetail("draft-1")).thenReturn(null);

        ApiException ex = assertThrows(ApiException.class,
                () -> contentService.getPublishedDetail("draft-1", null));

        assertEquals(2000, ex.getErrorCode().getCode());
        verify(contentMapper, never()).incrementViewCount("draft-1");
    }

    @Test
    void like_throwsVisitorIdInvalid_whenVisitorIdMissingOrInvalid() {
        ApiException missingEx = assertThrows(ApiException.class,
                () -> likeService.like(CONTENT_CODE, null));
        assertEquals(2004, missingEx.getErrorCode().getCode());

        ApiException shortEx = assertThrows(ApiException.class,
                () -> likeService.like(CONTENT_CODE, "short"));
        assertEquals(2004, shortEx.getErrorCode().getCode());

        verify(likeMapper, never()).insertLike(anyString(), anyString());
    }

    @Test
    void like_returnsLikedTrueAndCurrentCount() {
        when(likeMapper.countLike(any(), eq(VISITOR_ID))).thenReturn(1);
        when(likeMapper.insertLike(any(), eq(VISITOR_ID))).thenReturn(1);

        LikeResultView result = likeService.like(CONTENT_CODE, VISITOR_ID);

        assertTrue(result.liked());
        assertEquals(1, result.likeCount());
    }

    @Test
    void like_isIdempotent_whenUniqueConstraintConflict() {
        when(likeMapper.countLike(any(), eq(VISITOR_ID))).thenReturn(1);
        when(likeMapper.insertLike(any(), eq(VISITOR_ID)))
                .thenThrow(new DuplicateKeyException("uk_content_like(content_id, visitor_id)"));

        LikeResultView result = likeService.like(CONTENT_CODE, VISITOR_ID);

        assertTrue(result.liked());
        assertEquals(1, result.likeCount());
    }

    private static ContentSummaryView summary(String code) {
        return new ContentSummaryView(code, "langchain", "article",
                "标题-" + code, "摘要-" + code, "2026-08-29T00:00:00Z");
    }

    private static ContentDetailView detail(boolean liked) {
        return new ContentDetailView(CONTENT_CODE, "langchain", "agent", "article",
                "Agent 设计要点", "系统化讲解 Agent 架构", "正文内容", List.of("agent"),
                "original", 3, 41, liked, "2026-08-29T00:00:00Z", "2026-08-29T00:00:00Z");
    }
}
