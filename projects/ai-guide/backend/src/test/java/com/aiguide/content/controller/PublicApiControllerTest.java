package com.aiguide.content.controller;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.aiguide.config.SiteConfigController;
import com.aiguide.config.SiteConfigProperties;
import com.aiguide.common.ApiErrorCode;
import com.aiguide.common.ApiException;
import com.aiguide.common.GlobalExceptionHandler;
import com.aiguide.common.PageResult;
import com.aiguide.content.dto.CategoryView;
import com.aiguide.content.dto.ContentDetailView;
import com.aiguide.content.dto.ContentSummaryView;
import com.aiguide.content.dto.LikeResultView;
import com.aiguide.content.dto.TopicView;
import com.aiguide.content.service.CategoryService;
import com.aiguide.content.service.ContentService;
import com.aiguide.content.service.LikeService;
import com.aiguide.content.service.TopicService;
import com.aiguide.security.JwtAuthFilter;
import com.aiguide.security.JwtTokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

/**
 * 阅读站公开接口 Controller/安全测试（T-13 测试先行）。
 *
 * 本测试只验证公开接口的路由、入参校验、鉴权白名单与统一响应体，
 * 不加载 Spring Boot 完整上下文，也不访问数据库；Service 均为 Mock 替身。
 * T-14 已装配 SiteConfigController；断言方向与 contracts/ 保持一致。
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PublicApiControllerTest {

    private static final String TOPIC_CODE = "agent";
    private static final String CATEGORY_CODE = "langchain";
    private static final String CONTENT_CODE = "content-1";
    private static final String VISITOR_ID = "visitor-0001";
    private static final String WECHAT_ID = "15306507997";

    @Mock
    private TopicService topicService;

    @Mock
    private CategoryService categoryService;

    @Mock
    private ContentService contentService;

    @Mock
    private LikeService likeService;

    @Mock
    private JwtTokenService jwtTokenService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders.standaloneSetup(
                        new TopicController(topicService),
                        new CategoryController(categoryService),
                        new ContentController(contentService),
                        new LikeController(likeService),
                        new SiteConfigController(new SiteConfigProperties(WECHAT_ID)))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .setMessageConverters(new MappingJackson2HttpMessageConverter(objectMapper))
                .addFilter(new JwtAuthFilter(jwtTokenService, objectMapper), "/api/*")
                .build();
    }

    @Test
    void listTopics_isPublicAndReturnsUnifiedEnvelope() throws Exception {
        when(topicService.listVisibleTopics()).thenReturn(List.of(topicView()));

        mockMvc.perform(get("/api/topics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.message").value("success"))
                .andExpect(jsonPath("$.data[0].code").value(TOPIC_CODE));
    }

    @Test
    void listCategories_requiresTopicCode() throws Exception {
        mockMvc.perform(get("/api/categories"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(1000));
    }

    @Test
    void listCategories_returnsVisibleCategoriesForTopic() throws Exception {
        when(categoryService.listVisibleCategories(TOPIC_CODE)).thenReturn(List.of(categoryView()));

        mockMvc.perform(get("/api/categories").param("topicCode", TOPIC_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data[0].code").value(CATEGORY_CODE));
    }

    @Test
    void listContents_requiresCategoryCode() throws Exception {
        mockMvc.perform(get("/api/contents"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(1000));
    }

    @Test
    void listContents_returnsPaginationEnvelope() throws Exception {
        PageResult<ContentSummaryView> page = new PageResult<>(List.of(summaryView()), 1L, 1, 20);
        when(contentService.pageByCategory(CATEGORY_CODE, 1, 20)).thenReturn(page);

        mockMvc.perform(get("/api/contents")
                        .param("categoryCode", CATEGORY_CODE)
                        .param("pageNum", "1")
                        .param("pageSize", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.list[0].code").value(CONTENT_CODE))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.pageNum").value(1))
                .andExpect(jsonPath("$.data.pageSize").value(20));

        verify(contentService).pageByCategory(CATEGORY_CODE, 1, 20);
    }

    @Test
    void listLatest_usesDefaultPagination() throws Exception {
        PageResult<ContentSummaryView> page = new PageResult<>(List.of(summaryView()), 1L, 1, 20);
        when(contentService.pageLatest(1, 20)).thenReturn(page);

        mockMvc.perform(get("/api/contents/latest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.pageNum").value(1))
                .andExpect(jsonPath("$.data.pageSize").value(20));

        verify(contentService).pageLatest(1, 20);
    }

    @Test
    void listRecommended_isPublicAndReturnsPaginationEnvelope() throws Exception {
        when(contentService.pageRecommended(1, 20)).thenReturn(PageResult.empty(1, 20));

        mockMvc.perform(get("/api/contents/recommended"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.total").value(0))
                .andExpect(jsonPath("$.data.pageNum").value(1))
                .andExpect(jsonPath("$.data.pageSize").value(20));
    }

    @Test
    void search_requiresKeyword() throws Exception {
        mockMvc.perform(get("/api/contents/search"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(1000));
    }

    @Test
    void search_returnsPaginationEnvelope() throws Exception {
        PageResult<ContentSummaryView> page = new PageResult<>(List.of(summaryView()), 1L, 1, 20);
        when(contentService.search("agent", 1, 20)).thenReturn(page);

        mockMvc.perform(get("/api/contents/search")
                        .param("keyword", "agent")
                        .param("pageNum", "1")
                        .param("pageSize", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.list[0].code").value(CONTENT_CODE))
                .andExpect(jsonPath("$.data.total").value(1));
    }

    @Test
    void getContentDetail_isPublicAndSupportsOptionalVisitorHeader() throws Exception {
        when(contentService.getPublishedDetail(CONTENT_CODE, null)).thenReturn(detailView());

        mockMvc.perform(get("/api/contents/{contentCode}", CONTENT_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.code").value(CONTENT_CODE))
                .andExpect(jsonPath("$.data.liked").value(false));

        verify(contentService).getPublishedDetail(CONTENT_CODE, null);
    }

    @Test
    void getContentDetail_forwardsVisitorIdForLikedState() throws Exception {
        when(contentService.getPublishedDetail(CONTENT_CODE, VISITOR_ID)).thenReturn(detailView(true));

        mockMvc.perform(get("/api/contents/{contentCode}", CONTENT_CODE)
                        .header("X-Visitor-Id", VISITOR_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.liked").value(true));

        verify(contentService).getPublishedDetail(CONTENT_CODE, VISITOR_ID);
    }

    @Test
    void getContentDetail_returnsContentErrorWhenNotPublished() throws Exception {
        when(contentService.getPublishedDetail(CONTENT_CODE, null))
                .thenThrow(new ApiException(ApiErrorCode.CONTENT_NOT_PUBLISHED));

        mockMvc.perform(get("/api/contents/{contentCode}", CONTENT_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(2000));
    }

    @Test
    void likeContent_isPublicAndReturnsLikeResult() throws Exception {
        when(likeService.like(CONTENT_CODE, VISITOR_ID)).thenReturn(new LikeResultView(true, 4));

        mockMvc.perform(post("/api/contents/{contentCode}/likes", CONTENT_CODE)
                        .header("X-Visitor-Id", VISITOR_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.liked").value(true))
                .andExpect(jsonPath("$.data.likeCount").value(4));

        verify(likeService).like(CONTENT_CODE, VISITOR_ID);
    }

    @Test
    void likeContent_returnsContentErrorWhenNotPublished() throws Exception {
        when(likeService.like(CONTENT_CODE, VISITOR_ID))
                .thenThrow(new ApiException(ApiErrorCode.CONTENT_NOT_PUBLISHED));

        mockMvc.perform(post("/api/contents/{contentCode}/likes", CONTENT_CODE)
                        .header("X-Visitor-Id", VISITOR_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(2000));
    }

    @Test
    void getSiteConfig_isPublicAndReturnsWechatId() throws Exception {
        mockMvc.perform(get("/api/site/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.wechatId").isNotEmpty());
    }

    @Test
    void adminEndpoint_requiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/admin/topics"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(1001));
    }

    private TopicView topicView() {
        return new TopicView(TOPIC_CODE, "Agent 设计", "Agent 架构与设计", 1);
    }

    private CategoryView categoryView() {
        return new CategoryView(CATEGORY_CODE, TOPIC_CODE, "LangChain", "框架与工具", 1);
    }

    private ContentSummaryView summaryView() {
        return new ContentSummaryView(CONTENT_CODE, CATEGORY_CODE, "article", "标题", "摘要", "2026-08-29T00:00:00Z");
    }

    private ContentDetailView detailView() {
        return detailView(false);
    }

    private ContentDetailView detailView(boolean liked) {
        return new ContentDetailView(
                CONTENT_CODE,
                CATEGORY_CODE,
                TOPIC_CODE,
                "article",
                "标题",
                "摘要",
                "正文",
                List.of("agent"),
                "original",
                3,
                10,
                liked,
                "2026-08-29T00:00:00Z",
                "2026-08-29T00:00:00Z");
    }
}
