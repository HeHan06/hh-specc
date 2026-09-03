package com.aiguide.admin.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.aiguide.admin.dto.AdminRequests;
import com.aiguide.admin.dto.AdminViews;
import com.aiguide.admin.service.AdminAuthService;
import com.aiguide.admin.service.AdminContentService;
import com.aiguide.admin.service.AdminOperationLogService;
import com.aiguide.admin.service.AdminOrderService;
import com.aiguide.common.ApiErrorCode;
import com.aiguide.common.ApiException;
import com.aiguide.common.GlobalExceptionHandler;
import com.aiguide.common.PageResult;
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
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

/**
 * 后台 API Controller/安全测试（T-15 测试先行）。
 *
 * 使用 standalone MockMvc 装配真实后台 Controller 与 {@link JwtAuthFilter}，
 * Service 均为 Mock 替身，不加载 Spring Boot 完整上下文、不访问数据库。
 * 断言方向与 contracts/admin.yaml 保持一致：
 * 登录为公开白名单，其余 /api/admin/** 必须 JWT + ADMIN；
 * 未登录返回 1001，无权限返回 1002；分页、内容状态流转、订单状态流转与操作日志均走统一响应体。
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminApiControllerTest {

    private static final String CONTENT_CODE = "content-1";
    private static final String TOPIC_CODE = "agent";
    private static final String ORDER_NO = "0123456789abcdef0123456789abcdef";

    private static final String VALID_TOKEN = "valid-admin-token";
    private static final String NON_ADMIN_TOKEN = "non-admin-token";
    private static final String BAD_TOKEN = "bad-token";

    @Mock
    private AdminAuthService adminAuthService;

    @Mock
    private AdminContentService adminContentService;

    @Mock
    private AdminOrderService adminOrderService;

    @Mock
    private AdminOperationLogService adminOperationLogService;

    @Mock
    private JwtTokenService jwtTokenService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        when(jwtTokenService.parseToken(VALID_TOKEN))
                .thenReturn(new JwtTokenService.JwtClaims(1L, "admin", "ADMIN"));
        when(jwtTokenService.parseToken(NON_ADMIN_TOKEN))
                .thenReturn(new JwtTokenService.JwtClaims(1L, "admin", "USER"));
        when(jwtTokenService.parseToken(BAD_TOKEN))
                .thenThrow(new RuntimeException("token invalid"));

        mockMvc = MockMvcBuilders.standaloneSetup(
                        new AdminAuthController(adminAuthService),
                        new AdminContentController(adminContentService),
                        new AdminOrderController(adminOrderService),
                        new OperationLogController(adminOperationLogService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .setMessageConverters(new MappingJackson2HttpMessageConverter(objectMapper))
                .addFilter(new JwtAuthFilter(jwtTokenService, objectMapper), "/api/*")
                .build();
    }

    @Test
    void login_isPublicAndReturnsToken() throws Exception {
        when(adminAuthService.login(any(AdminRequests.LoginRequest.class)))
                .thenReturn(new AdminViews.LoginView("token-1", "admin", "ADMIN"));

        mockMvc.perform(post("/api/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"secret123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.token").value("token-1"))
                .andExpect(jsonPath("$.data.role").value("ADMIN"));
    }

    @Test
    void login_validatesRequiredFields() throws Exception {
        mockMvc.perform(post("/api/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(1000));
    }

    @Test
    void me_requiresValidAdminTokenAndReturnsCurrentAdmin() throws Exception {
        when(adminAuthService.me()).thenReturn(new AdminViews.MeView("admin", "ADMIN"));

        mockMvc.perform(get("/api/admin/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(VALID_TOKEN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.username").value("admin"))
                .andExpect(jsonPath("$.data.role").value("ADMIN"));
    }

    @Test
    void adminEndpoint_withoutToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/admin/topics"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(1001));
    }

    @Test
    void adminEndpoint_withInvalidToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/admin/topics")
                        .header(HttpHeaders.AUTHORIZATION, bearer(BAD_TOKEN)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(1001));
    }

    @Test
    void adminEndpoint_withNonAdminRole_returnsForbidden() throws Exception {
        mockMvc.perform(get("/api/admin/topics")
                        .header(HttpHeaders.AUTHORIZATION, bearer(NON_ADMIN_TOKEN)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(1002));
    }

    @Test
    void pageTopics_withAdminToken_returnsPaginationEnvelope() throws Exception {
        PageResult<AdminViews.TopicView> page =
                new PageResult<>(List.of(topicView()), 1L, 1, 20);
        when(adminContentService.pageTopics(1, 20, null, null)).thenReturn(page);

        mockMvc.perform(get("/api/admin/topics")
                        .param("pageNum", "1")
                        .param("pageSize", "20")
                        .header(HttpHeaders.AUTHORIZATION, bearer(VALID_TOKEN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.list[0].code").value(TOPIC_CODE))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.pageNum").value(1))
                .andExpect(jsonPath("$.data.pageSize").value(20));
    }

    @Test
    void publishContent_withAdminToken_returnsPublishedStatus() throws Exception {
        when(adminContentService.publishContent(any(String.class), any(AdminRequests.PublishRequest.class)))
                .thenReturn(contentPublishView("published"));

        mockMvc.perform(post("/api/admin/contents/{contentCode}/publish", CONTENT_CODE)
                        .header(HttpHeaders.AUTHORIZATION, bearer(VALID_TOKEN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reviewConfirmed\":true,\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.status").value("published"));
    }

    @Test
    void unpublishContent_withAdminToken_returnsUnpublishedStatus() throws Exception {
        when(adminContentService.unpublishContent(any(String.class), any(AdminRequests.UnpublishRequest.class)))
                .thenReturn(contentStatusView("unpublished"));

        mockMvc.perform(post("/api/admin/contents/{contentCode}/unpublish", CONTENT_CODE)
                        .header(HttpHeaders.AUTHORIZATION, bearer(VALID_TOKEN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.status").value("unpublished"));
    }

    @Test
    void restoreContent_withAdminToken_returnsPublishedStatus() throws Exception {
        when(adminContentService.restoreContent(any(String.class), any(AdminRequests.RestoreRequest.class)))
                .thenReturn(contentStatusView("published"));

        mockMvc.perform(post("/api/admin/contents/{contentCode}/restore", CONTENT_CODE)
                        .header(HttpHeaders.AUTHORIZATION, bearer(VALID_TOKEN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reviewConfirmed\":true,\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.status").value("published"));
    }

    @Test
    void archiveContent_withAdminToken_returnsArchivedStatus() throws Exception {
        when(adminContentService.archiveContent(any(String.class), any(AdminRequests.ArchiveRequest.class)))
                .thenReturn(contentStatusView("archived"));

        mockMvc.perform(post("/api/admin/contents/{contentCode}/archive", CONTENT_CODE)
                        .header(HttpHeaders.AUTHORIZATION, bearer(VALID_TOKEN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.status").value("archived"));
    }

    @Test
    void receiveTip_withAdminToken_returnsReceivedStatus() throws Exception {
        when(adminOrderService.receiveTip(ORDER_NO)).thenReturn(tipDetailView("received"));

        mockMvc.perform(post("/api/admin/tips/{orderNo}/receive", ORDER_NO)
                        .header(HttpHeaders.AUTHORIZATION, bearer(VALID_TOKEN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.status").value("received"));
    }

    @Test
    void closeTip_withAdminToken_returnsClosedStatus() throws Exception {
        when(adminOrderService.closeTip(ORDER_NO)).thenReturn(tipDetailView("closed"));

        mockMvc.perform(post("/api/admin/tips/{orderNo}/close", ORDER_NO)
                        .header(HttpHeaders.AUTHORIZATION, bearer(VALID_TOKEN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.status").value("closed"));
    }

    @Test
    void confirmConsultation_withAdminToken_returnsConfirmedStatus() throws Exception {
        when(adminOrderService.confirmConsultation(any(String.class), any(AdminRequests.ConfirmRequest.class)))
                .thenReturn(consultationDetailView("confirmed"));

        mockMvc.perform(post("/api/admin/consultations/{orderNo}/confirm", ORDER_NO)
                        .header(HttpHeaders.AUTHORIZATION, bearer(VALID_TOKEN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"adminNote\":\"已收款，本周排期\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.status").value("confirmed"))
                .andExpect(jsonPath("$.data.freeQuotaUsed").value(true));
    }

    @Test
    void completeConsultation_withAdminToken_returnsCompletedStatus() throws Exception {
        when(adminOrderService.completeConsultation(any(String.class), any(AdminRequests.NoteRequest.class)))
                .thenReturn(consultationDetailView("completed"));

        mockMvc.perform(post("/api/admin/consultations/{orderNo}/complete", ORDER_NO)
                        .header(HttpHeaders.AUTHORIZATION, bearer(VALID_TOKEN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"adminNote\":\"已完成\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.status").value("completed"));
    }

    @Test
    void cancelConsultation_withAdminToken_returnsCanceledStatus() throws Exception {
        when(adminOrderService.cancelConsultation(any(String.class), any(AdminRequests.CancelRequest.class)))
                .thenReturn(consultationDetailView("canceled"));

        mockMvc.perform(post("/api/admin/consultations/{orderNo}/cancel", ORDER_NO)
                        .header(HttpHeaders.AUTHORIZATION, bearer(VALID_TOKEN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"adminNote\":\"访客取消\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.status").value("canceled"));
    }

    @Test
    void updateConsultationNote_withAdminToken_returnsUpdatedNote() throws Exception {
        when(adminOrderService.updateConsultationNote(any(String.class), any(AdminRequests.NoteUpdateRequest.class)))
                .thenReturn(consultationDetailView("submitted"));

        mockMvc.perform(post("/api/admin/consultations/{orderNo}/note", ORDER_NO)
                        .header(HttpHeaders.AUTHORIZATION, bearer(VALID_TOKEN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"adminNote\":\"候选人本周可约\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.orderNo").value(ORDER_NO));
    }

    @Test
    void updateConsultationNote_withBlankNote_returnsParamInvalid() throws Exception {
        mockMvc.perform(post("/api/admin/consultations/{orderNo}/note", ORDER_NO)
                        .header(HttpHeaders.AUTHORIZATION, bearer(VALID_TOKEN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"adminNote\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(1000));
    }

    @Test
    void pageOperationLogs_withAdminToken_returnsPaginationEnvelope() throws Exception {
        PageResult<AdminViews.OperationLogView> page =
                new PageResult<>(List.of(operationLogView()), 1L, 1, 20);
        when(adminOperationLogService.pageOperationLogs(1, 20, "content", "publish"))
                .thenReturn(page);

        mockMvc.perform(get("/api/admin/operation-logs")
                        .param("pageNum", "1")
                        .param("pageSize", "20")
                        .param("targetType", "content")
                        .param("action", "publish")
                        .header(HttpHeaders.AUTHORIZATION, bearer(VALID_TOKEN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.list[0].username").value("admin"))
                .andExpect(jsonPath("$.data.list[0].targetType").value("content"))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.pageNum").value(1))
                .andExpect(jsonPath("$.data.pageSize").value(20));
    }

    @Test
    void contentStateError_isWrappedInUnifiedResponse() throws Exception {
        when(adminContentService.archiveContent(any(String.class), any(AdminRequests.ArchiveRequest.class)))
                .thenThrow(new ApiException(ApiErrorCode.CONTENT_STATE_INVALID));

        mockMvc.perform(post("/api/admin/contents/{contentCode}/archive", CONTENT_CODE)
                        .header(HttpHeaders.AUTHORIZATION, bearer(VALID_TOKEN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(2303));
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private AdminViews.TopicView topicView() {
        return new AdminViews.TopicView(TOPIC_CODE, "Agent 设计", "Agent 架构与设计", 1, true,
                "2026-08-29T00:00:00Z");
    }

    private AdminViews.ContentDetailView contentDetailView(String status) {
        return new AdminViews.ContentDetailView(
                CONTENT_CODE,
                "langchain",
                "article",
                "标题",
                "摘要",
                "正文",
                List.of("agent"),
                "original",
                status,
                false,
                1,
                "published".equals(status) ? "2026-08-29T00:00:00Z" : null,
                "2026-08-29T00:00:00Z");
    }

    private AdminViews.ContentStatusView contentStatusView(String status) {
        return new AdminViews.ContentStatusView(CONTENT_CODE, status);
    }

    private AdminViews.ContentPublishView contentPublishView(String status) {
        return new AdminViews.ContentPublishView(CONTENT_CODE, status, "2026-08-29T00:00:00Z");
    }

    private AdminViews.TipDetailView tipDetailView(String status) {
        return new AdminViews.TipDetailView(
                ORDER_NO,
                CONTENT_CODE,
                1000,
                "张三",
                "13800138000",
                "感谢分享",
                status,
                "received".equals(status) ? "2026-08-29T00:00:00Z" : null,
                "closed".equals(status) ? "2026-08-29T00:00:00Z" : null,
                "2026-08-29T00:00:00Z");
    }

    private AdminViews.ConsultationDetailView consultationDetailView(String status) {
        return new AdminViews.ConsultationDetailView(
                ORDER_NO,
                "张三",
                "phone",
                "13800138000",
                "Agent 架构",
                "想咨询 Agent 面试",
                "2099-01-01T00:00:00Z",
                "confirmed".equals(status) ? 0 : 50000,
                "confirmed".equals(status),
                status,
                null,
                "confirmed".equals(status) ? "2026-08-29T00:00:00Z" : null,
                "2026-08-29T00:00:00Z");
    }

    private AdminViews.OperationLogView operationLogView() {
        return new AdminViews.OperationLogView(
                1L,
                "admin",
                "publish",
                "content",
                CONTENT_CODE,
                "draft",
                "published",
                "2026-08-29T00:00:00Z");
    }
}
