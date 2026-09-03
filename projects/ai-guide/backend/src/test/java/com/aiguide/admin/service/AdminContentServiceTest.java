package com.aiguide.admin.service;

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
import com.aiguide.admin.dto.AdminViews.ContentPublishView;
import com.aiguide.admin.dto.AdminViews.ContentStatusView;
import com.aiguide.admin.dto.AdminViews.ContentUpdateView;
import com.aiguide.admin.dto.AdminViews.TopicView;
import com.aiguide.common.ApiException;
import com.aiguide.content.mapper.CategoryMapper;
import com.aiguide.content.mapper.ContentMapper;
import com.aiguide.content.mapper.TopicMapper;
import com.aiguide.operationlog.OperationLogService;
import java.lang.reflect.Constructor;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * 后台内容与目录管理服务测试（T-11 测试先行）。
 *
 * 当前 AdminContentService 为 T-04 占位实现，因此本测试在 T-12 实现前应以红色失败结束。
 * 断言方向：主题/专题/内容 CRUD、创建内容为草稿、编辑携带 version 乐观锁、发布必须
 * {@code reviewConfirmed=true}、下架/恢复/归档状态机。
 */
class AdminContentServiceTest {

    private static final String TOPIC_CODE = "agent";
    private static final String CATEGORY_CODE = "agent-design";
    private static final String CONTENT_CODE = "content-1";

    private TopicMapper topicMapper;
    private CategoryMapper categoryMapper;
    private ContentMapper contentMapper;
    private OperationLogService operationLogService;
    private AdminContentService adminContentService;

    @BeforeEach
    void setUp() {
        topicMapper = Mockito.mock(TopicMapper.class);
        categoryMapper = Mockito.mock(CategoryMapper.class);
        contentMapper = Mockito.mock(ContentMapper.class);
        operationLogService = Mockito.mock(OperationLogService.class);

        when(topicMapper.existsByCode(TOPIC_CODE)).thenReturn(true);
        when(topicMapper.updateTopic(anyString(), anyString(), any(), anyInt(), anyBoolean())).thenReturn(1);
        when(categoryMapper.existsByCode(CATEGORY_CODE)).thenReturn(true);
        when(categoryMapper.updateCategory(anyString(), anyString(), anyString(), any(), anyInt(), anyBoolean())).thenReturn(1);
        when(contentMapper.updateContent(anyString(), anyString(), anyString(), anyString(), anyString(),
                anyString(), any(), anyString(), anyBoolean(), anyInt())).thenReturn(1);
        when(contentMapper.transitionContentStatus(anyString(), anyString(), anyString(), anyInt())).thenReturn(1);

        adminContentService = instantiateService(
                AdminContentService.class, topicMapper, categoryMapper, contentMapper, operationLogService);
    }

    @Test
    void createTopic_returnsCreatedTopic() {
        TopicView view = adminContentService.createTopic(new TopicCreateRequest(
                TOPIC_CODE, "Agent 设计", "Agent 架构与设计", 1, true));

        assertNotNull(view);
        assertEquals(TOPIC_CODE, view.code());
        assertEquals("Agent 设计", view.name());
    }

    @Test
    void updateTopic_returnsUpdatedTopic() {
        TopicView view = adminContentService.updateTopic(TOPIC_CODE,
                new TopicUpdateRequest("Agent 设计（更新）", "更新后的简介", 2, true));

        assertNotNull(view);
        assertEquals(TOPIC_CODE, view.code());
        assertEquals("Agent 设计（更新）", view.name());
    }

    @Test
    void createCategory_returnsCreatedCategory() {
        CategoryView view = adminContentService.createCategory(new CategoryCreateRequest(
                CATEGORY_CODE, TOPIC_CODE, "Agent 设计", "专题简介", 1, true));

        assertNotNull(view);
        assertEquals(CATEGORY_CODE, view.code());
        assertEquals(TOPIC_CODE, view.topicCode());
    }

    @Test
    void updateCategory_returnsUpdatedCategory() {
        CategoryView view = adminContentService.updateCategory(CATEGORY_CODE,
                new CategoryUpdateRequest(TOPIC_CODE, "Agent 设计（更新）", "更新后的专题简介", 2, true));

        assertNotNull(view);
        assertEquals(CATEGORY_CODE, view.code());
        assertEquals("Agent 设计（更新）", view.name());
    }

    @Test
    void createContent_returnsDraft() {
        ContentStatusView view = adminContentService.createContent(validContentCreate());

        assertNotNull(view);
        assertEquals("draft", view.status());
    }

    @Test
    void getContent_returnsDetailWithVersion() {
        when(contentMapper.selectAdminDetailByCode(CONTENT_CODE)).thenReturn(adminDetail("draft", 0));

        ContentDetailView view = adminContentService.getContent(CONTENT_CODE);

        assertNotNull(view);
        assertEquals(CONTENT_CODE, view.code());
        assertNotNull(view.version());
    }

    @Test
    void updateContent_success_returnsUpdatedDetail() {
        when(contentMapper.selectAdminDetailByCode(CONTENT_CODE))
                .thenReturn(adminDetail("draft", 0), adminDetail("draft", 1));

        ContentUpdateView view = adminContentService.updateContent(
                CONTENT_CODE, validContentUpdate(0));

        assertNotNull(view);
        assertEquals(CONTENT_CODE, view.code());
        assertNotNull(view.version());
    }

    @Test
    void updateContent_versionMismatch_throwsConflict() {
        when(contentMapper.selectAdminDetailByCode(CONTENT_CODE)).thenReturn(adminDetail("draft", 0));

        ContentUpdateRequest request = validContentUpdate(99);

        ApiException ex = assertThrows(ApiException.class,
                () -> adminContentService.updateContent(CONTENT_CODE, request));

        assertEquals(2302, ex.getErrorCode().getCode());
    }

    @Test
    void publishContent_requiresReviewConfirmedTrue() {
        PublishRequest request = new PublishRequest(false, 0);

        ApiException ex = assertThrows(ApiException.class,
                () -> adminContentService.publishContent(CONTENT_CODE, request));

        int code = ex.getErrorCode().getCode();
        assertTrue(code == 1000 || code == 2303, "未审核发布应返回参数非法或状态流转非法");
    }

    @Test
    void publishContent_transitionsToPublished() {
        when(contentMapper.selectAdminDetailByCode(CONTENT_CODE))
                .thenReturn(adminDetail("draft", 0), adminDetail("published", 1));

        ContentPublishView view = adminContentService.publishContent(
                CONTENT_CODE, new PublishRequest(true, 0));

        assertNotNull(view);
        assertEquals("published", view.status());
    }

    @Test
    void unpublishContent_transitionsToUnpublished() {
        when(contentMapper.selectAdminDetailByCode(CONTENT_CODE))
                .thenReturn(adminDetail("published", 0), adminDetail("unpublished", 1));

        ContentStatusView view = adminContentService.unpublishContent(
                CONTENT_CODE, new UnpublishRequest(0));

        assertNotNull(view);
        assertEquals("unpublished", view.status());
    }

    @Test
    void restoreContent_transitionsToPublished() {
        when(contentMapper.selectAdminDetailByCode(CONTENT_CODE))
                .thenReturn(adminDetail("unpublished", 0), adminDetail("published", 1));

        ContentStatusView view = adminContentService.restoreContent(
                CONTENT_CODE, new RestoreRequest(true, 0));

        assertNotNull(view);
        assertEquals("published", view.status());
    }

    @Test
    void archiveContent_transitionsToArchived() {
        when(contentMapper.selectAdminDetailByCode(CONTENT_CODE))
                .thenReturn(adminDetail("published", 0), adminDetail("archived", 1));

        ContentStatusView view = adminContentService.archiveContent(
                CONTENT_CODE, new ArchiveRequest(0));

        assertNotNull(view);
        assertEquals("archived", view.status());
    }

    private static ContentCreateRequest validContentCreate() {
        return new ContentCreateRequest(
                CATEGORY_CODE, "article", "标题", "摘要", "正文",
                List.of("tag1"), "original");
    }

    private static ContentUpdateRequest validContentUpdate(int version) {
        return new ContentUpdateRequest(
                CATEGORY_CODE, "article", "标题", "摘要", "正文",
                List.of("tag1"), "original", false, version);
    }

    private static ContentDetailView adminDetail(String status, int version) {
        return new ContentDetailView(CONTENT_CODE, CATEGORY_CODE, "article", "标题", "摘要", "正文",
                List.of("tag1"), "original", status, false, version, null, "2026-08-29T00:00:00Z");
    }

    private static <T> T instantiateService(Class<T> serviceType, Object... dependencies) {
        Constructor<?> target = maxArgsConstructor(serviceType);
        target.setAccessible(true);
        Class<?>[] parameterTypes = target.getParameterTypes();
        Object[] args = new Object[parameterTypes.length];
        for (int i = 0; i < parameterTypes.length; i++) {
            args[i] = findDependency(parameterTypes[i], dependencies);
            if (args[i] == null) {
                args[i] = defaultMock(parameterTypes[i]);
            }
        }
        try {
            return serviceType.cast(target.newInstance(args));
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException("无法创建被测服务", ex);
        }
    }

    private static Constructor<?> maxArgsConstructor(Class<?> serviceType) {
        Constructor<?> target = null;
        for (Constructor<?> constructor : serviceType.getDeclaredConstructors()) {
            if (target == null || constructor.getParameterCount() > target.getParameterCount()) {
                target = constructor;
            }
        }
        return target;
    }

    private static Object findDependency(Class<?> type, Object[] dependencies) {
        if (dependencies != null) {
            for (Object dependency : dependencies) {
                if (dependency != null && type.isInstance(dependency)) {
                    return dependency;
                }
            }
        }
        return null;
    }

    private static Object defaultMock(Class<?> type) {
        if (type == String.class) {
            return "";
        }
        return Mockito.mock(type);
    }
}
