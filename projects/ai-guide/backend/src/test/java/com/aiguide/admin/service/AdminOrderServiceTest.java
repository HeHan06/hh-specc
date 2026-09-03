package com.aiguide.admin.service;

import com.aiguide.admin.dto.AdminRequests.CancelRequest;
import com.aiguide.admin.dto.AdminRequests.ConfirmRequest;
import com.aiguide.admin.dto.AdminRequests.NoteRequest;
import com.aiguide.admin.dto.AdminViews.ConsultationDetailView;
import com.aiguide.admin.dto.AdminViews.TipDetailView;
import com.aiguide.common.ApiException;
import com.aiguide.operationlog.OperationLog;
import com.aiguide.operationlog.OperationLogService;
import com.aiguide.order.mapper.ConsultationOrderMapper;
import com.aiguide.order.mapper.TipOrderMapper;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * 后台订单管理服务测试（T-11 测试先行）。
 *
 * 当前 AdminOrderService 为 T-04 占位实现，因此本测试在 T-12 实现前应以红色失败结束。
 * 断言方向：打赏收款/关闭、咨询确认排期/完成/取消、免费名额占用与释放、非法状态流转，
 * 以及敏感操作必须同时具备事务与操作日志注解（日志与业务更新同事务生效）。
 */
class AdminOrderServiceTest {

    private static final String TIP_ORDER_NO = "tip-0001";
    private static final String CONSULTATION_ORDER_NO = "consultation-0001";

    private TipOrderMapper tipOrderMapper;
    private ConsultationOrderMapper consultationOrderMapper;
    private OperationLogService operationLogService;
    private AdminOrderService adminOrderService;

    @BeforeEach
    void setUp() {
        tipOrderMapper = Mockito.mock(TipOrderMapper.class);
        consultationOrderMapper = Mockito.mock(ConsultationOrderMapper.class);
        operationLogService = Mockito.mock(OperationLogService.class);

        when(tipOrderMapper.selectTipStatus(anyString())).thenReturn("submitted");
        when(tipOrderMapper.receiveTip(anyString())).thenReturn(1);
        when(tipOrderMapper.closeTip(anyString())).thenReturn(1);

        when(consultationOrderMapper.selectConsultationStatus(anyString())).thenReturn("submitted");
        when(consultationOrderMapper.selectUsedCountForUpdate()).thenReturn(0);
        when(consultationOrderMapper.incrementConsultationQuota()).thenReturn(1);
        when(consultationOrderMapper.decrementConsultationQuota()).thenReturn(1);
        when(consultationOrderMapper.confirmConsultation(anyString(), any(), anyInt(), anyBoolean())).thenReturn(1);
        when(consultationOrderMapper.completeConsultation(anyString(), any())).thenReturn(1);
        when(consultationOrderMapper.cancelConsultation(anyString(), any())).thenReturn(1);
        when(consultationOrderMapper.selectAdminConsultationByOrderNo(anyString()))
                .thenReturn(consultationDetail("confirmed", 0, true));

        adminOrderService = instantiateService(
                AdminOrderService.class, tipOrderMapper, consultationOrderMapper, operationLogService);
    }

    @Test
    void receiveTip_transitionsToReceived() {
        when(tipOrderMapper.selectAdminTipByOrderNo(TIP_ORDER_NO)).thenReturn(tipDetail("received"));

        TipDetailView view = adminOrderService.receiveTip(TIP_ORDER_NO);

        assertNotNull(view);
        assertEquals("received", view.status());
        assertNotNull(view.receivedAt());
    }

    @Test
    void closeTip_transitionsToClosed() {
        when(tipOrderMapper.selectAdminTipByOrderNo(TIP_ORDER_NO)).thenReturn(tipDetail("closed"));

        TipDetailView view = adminOrderService.closeTip(TIP_ORDER_NO);

        assertNotNull(view);
        assertEquals("closed", view.status());
        assertNotNull(view.closedAt());
    }

    @Test
    void receiveTip_invalidState_throwsOrderStateError() {
        when(tipOrderMapper.selectTipStatus(TIP_ORDER_NO)).thenReturn("received");

        ApiException ex = assertThrows(ApiException.class,
                () -> adminOrderService.receiveTip(TIP_ORDER_NO));

        assertEquals(2304, ex.getErrorCode().getCode());
    }

    @Test
    void confirmConsultation_firstTenAreFree() {
        when(consultationOrderMapper.selectAdminConsultationByOrderNo(CONSULTATION_ORDER_NO))
                .thenReturn(consultationDetail("confirmed", 0, true));

        ConsultationDetailView view = adminOrderService.confirmConsultation(
                CONSULTATION_ORDER_NO, new ConfirmRequest("首单免费名额"));

        assertNotNull(view);
        assertEquals("confirmed", view.status());
        assertEquals(0, view.priceCents());
        assertTrue(view.freeQuotaUsed());
    }

    @Test
    void confirmConsultation_afterTenUsesPaidPrice() {
        // 前 10 个确认订单免费；第 11 个应按 50000 分计价，且不再占用免费名额。
        for (int i = 0; i < 10; i++) {
            adminOrderService.confirmConsultation(
                    "consultation-" + i, new ConfirmRequest(null));
        }
        when(consultationOrderMapper.selectUsedCountForUpdate()).thenReturn(10);
        when(consultationOrderMapper.selectAdminConsultationByOrderNo(CONSULTATION_ORDER_NO))
                .thenReturn(consultationDetail("confirmed", 50000, false));

        ConsultationDetailView view = adminOrderService.confirmConsultation(
                CONSULTATION_ORDER_NO, new ConfirmRequest("超出免费名额"));

        assertNotNull(view);
        assertEquals("confirmed", view.status());
        assertEquals(50000, view.priceCents());
        assertFalse(view.freeQuotaUsed());
    }

    @Test
    void completeConsultation_transitionsToCompleted() {
        when(consultationOrderMapper.selectConsultationStatus(CONSULTATION_ORDER_NO)).thenReturn("confirmed");
        when(consultationOrderMapper.selectAdminConsultationByOrderNo(CONSULTATION_ORDER_NO))
                .thenReturn(consultationDetail("completed", 50000, false));

        ConsultationDetailView view = adminOrderService.completeConsultation(
                CONSULTATION_ORDER_NO, new NoteRequest("完成"));

        assertNotNull(view);
        assertEquals("completed", view.status());
    }

    @Test
    void cancelConsultation_confirmedFreeOrder_releasesQuota() {
        when(consultationOrderMapper.selectAdminConsultationByOrderNo(CONSULTATION_ORDER_NO))
                .thenReturn(consultationDetail("confirmed", 0, true),
                        consultationDetail("confirmed", 0, true),
                        consultationDetail("canceled", 0, true));

        adminOrderService.confirmConsultation(
                CONSULTATION_ORDER_NO, new ConfirmRequest("占用免费名额"));

        ConsultationDetailView view = adminOrderService.cancelConsultation(
                CONSULTATION_ORDER_NO, new CancelRequest("用户取消"));

        assertNotNull(view);
        assertEquals("canceled", view.status());
    }

    @Test
    void cancelConsultation_invalidState_throwsOrderStateError() {
        when(consultationOrderMapper.selectAdminConsultationByOrderNo(CONSULTATION_ORDER_NO))
                .thenReturn(consultationDetail("completed", 50000, false));

        ApiException ex = assertThrows(ApiException.class,
                () -> adminOrderService.cancelConsultation(
                        CONSULTATION_ORDER_NO, new CancelRequest("非法取消")));

        assertEquals(2304, ex.getErrorCode().getCode());
    }

    @Test
    void sensitiveOperations_areTransactionalAndLogged() throws NoSuchMethodException {
        assertSensitiveOperation("receiveTip", String.class);
        assertSensitiveOperation("closeTip", String.class);
        assertSensitiveOperation("confirmConsultation", String.class, ConfirmRequest.class);
        assertSensitiveOperation("completeConsultation", String.class, NoteRequest.class);
        assertSensitiveOperation("cancelConsultation", String.class, CancelRequest.class);
    }

    private static void assertSensitiveOperation(String methodName, Class<?>... parameterTypes)
            throws NoSuchMethodException {
        Method method = AdminOrderService.class.getMethod(methodName, parameterTypes);
        boolean transactional = method.isAnnotationPresent(Transactional.class)
                || method.getDeclaringClass().isAnnotationPresent(Transactional.class);
        assertTrue(transactional, methodName + " 必须声明事务边界");
        assertTrue(method.isAnnotationPresent(OperationLog.class),
                methodName + " 必须声明敏感操作日志");
    }

    private static TipDetailView tipDetail(String status) {
        return new TipDetailView(TIP_ORDER_NO, null, 1000, "访客", "13800138000", "感谢分享",
                status, "received".equals(status) ? "2026-08-29T00:00:00Z" : null,
                "closed".equals(status) ? "2026-08-29T00:00:00Z" : null,
                "2026-08-29T00:00:00Z");
    }

    private static ConsultationDetailView consultationDetail(String status, int priceCents, boolean freeQuotaUsed) {
        return new ConsultationDetailView(CONSULTATION_ORDER_NO, "访客", "wechat", "visitor_wechat",
                "Agent 架构咨询", "希望梳理面试重点", "2026-09-01T10:00:00Z", priceCents,
                freeQuotaUsed, status, "备注", null, "2026-08-29T00:00:00Z");
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
