package com.aiguide.order.service;

import com.aiguide.common.ApiException;
import com.aiguide.config.SiteConfigProperties;
import com.aiguide.order.dto.ConsultationCreateRequest;
import com.aiguide.order.dto.ConsultationCreateResultView;
import com.aiguide.order.dto.ConsultationStatusView;
import com.aiguide.order.mapper.ConsultationOrderMapper;
import java.lang.reflect.Constructor;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.mockito.invocation.InvocationOnMock;
import org.mockito.stubbing.Answer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

/**
 * 付费咨询订单 Service 测试（T-09 测试先行）。
 *
 * 只依赖 ConsultationOrderService 的公共方法签名，不绑定 T-10 将要补齐的 Mapper 方法名；
 * 当前 Service 为 T-04 占位实现，因此本测试应以红色失败结束。
 * 断言方向：咨询必填、期望时间未来、联系方式类型与格式校验、计价常量、订单号不可猜测、公开查询字段范围。
 */
class ConsultationOrderServiceTest {

    private static final String WECHAT_ID = "admin-wechat-001";
    private static final String ORDER_NO = "f9e8d7c6b5a4-4932-8f10-abcdef012345";
    private static final String FUTURE_TIME = "2099-01-01T00:00:00Z";
    private static final String PAST_TIME = "2000-01-01T00:00:00Z";
    private static final int PRICE_CENTS = 50000;
    private static final Pattern UNGUESSABLE_ORDER_NO =
            Pattern.compile("^[A-Za-z0-9-]{16,40}$");

    private ConsultationOrderMapper consultationOrderMapper;

    private SiteConfigProperties siteConfigProperties;

    private ConsultationOrderService consultationOrderService;

    @BeforeEach
    void setUp() {
        consultationOrderMapper = Mockito.mock(
                ConsultationOrderMapper.class, new ConsultationMapperAnswer());
        siteConfigProperties = Mockito.mock(SiteConfigProperties.class);
        when(siteConfigProperties.getWechatId()).thenReturn(WECHAT_ID);
        consultationOrderService = instantiateService(
                ConsultationOrderService.class, consultationOrderMapper, siteConfigProperties);
    }

    @Test
    void create_validRequestReturnsSubmittedWithPriceAndUnguessableOrderNo() {
        ConsultationCreateRequest request = validRequest();

        ConsultationCreateResultView result = consultationOrderService.create(request);

        assertNotNull(result);
        assertTrue(UNGUESSABLE_ORDER_NO.matcher(result.orderNo()).matches(), "订单号必须为不可猜测随机值");
        assertEquals(PRICE_CENTS, result.priceCents());
        assertEquals("submitted", result.status());
        assertEquals(WECHAT_ID, result.wechatId());
    }

    @Test
    void create_rejectsMissingRequiredContactName() {
        ConsultationCreateRequest request =
                new ConsultationCreateRequest(null, "phone", "13800138000",
                        "Agent 设计", "想系统学习", FUTURE_TIME);

        ApiException ex = assertThrows(ApiException.class,
                () -> consultationOrderService.create(request));

        assertEquals(2200, ex.getErrorCode().getCode());
    }

    @Test
    void create_rejectsInvalidContactType() {
        ConsultationCreateRequest request =
                new ConsultationCreateRequest("张三", "email", "zhangsan@example.com",
                        "Agent 设计", "想系统学习", FUTURE_TIME);

        ApiException ex = assertThrows(ApiException.class,
                () -> consultationOrderService.create(request));

        assertEquals(2200, ex.getErrorCode().getCode());
    }

    @Test
    void create_rejectsContactValueThatDoesNotMatchContactType() {
        ConsultationCreateRequest request =
                new ConsultationCreateRequest("张三", "phone", "not-a-phone",
                        "Agent 设计", "想系统学习", FUTURE_TIME);

        ApiException ex = assertThrows(ApiException.class,
                () -> consultationOrderService.create(request));

        assertEquals(2200, ex.getErrorCode().getCode());
    }

    @Test
    void create_rejectsExpectedTimeInThePast() {
        ConsultationCreateRequest request =
                new ConsultationCreateRequest("张三", "phone", "13800138000",
                        "Agent 设计", "想系统学习", PAST_TIME);

        ApiException ex = assertThrows(ApiException.class,
                () -> consultationOrderService.create(request));

        assertEquals(2200, ex.getErrorCode().getCode());
    }

    @Test
    void getByOrderNo_returnsOnlyPublicStatusFields() {
        ConsultationStatusView view = consultationOrderService.getByOrderNo(ORDER_NO);

        assertNotNull(view);
        assertEquals(ORDER_NO, view.orderNo());
        assertEquals(PRICE_CENTS, view.priceCents());
        assertEquals("submitted", view.status());
        assertEquals(WECHAT_ID, view.wechatId());
        assertFalse(view.freeQuotaUsed());
    }

    @Test
    void getByOrderNo_unknownOrderThrowsBusinessError() {
        consultationOrderService = instantiateService(
                ConsultationOrderService.class,
                Mockito.mock(ConsultationOrderMapper.class),
                siteConfigProperties);

        ApiException ex = assertThrows(ApiException.class,
                () -> consultationOrderService.getByOrderNo("missing-order"));

        assertEquals(2201, ex.getErrorCode().getCode());
    }

    private static ConsultationCreateRequest validRequest() {
        return new ConsultationCreateRequest("张三", "phone", "13800138000",
                "Agent 设计", "想系统学习 Agent 架构", FUTURE_TIME);
    }

    private static <T> T instantiateService(Class<T> serviceType, Object... dependencies) {
        Constructor<?>[] constructors = serviceType.getDeclaredConstructors();
        Constructor<?> target = null;
        for (Constructor<?> constructor : constructors) {
            if (target == null || constructor.getParameterCount() > target.getParameterCount()) {
                target = constructor;
            }
        }
        target.setAccessible(true);
        Class<?>[] parameterTypes = target.getParameterTypes();
        Object[] args = new Object[parameterTypes.length];
        for (int i = 0; i < parameterTypes.length; i++) {
            for (Object dependency : dependencies) {
                if (parameterTypes[i].isInstance(dependency)) {
                    args[i] = dependency;
                    break;
                }
            }
            if (args[i] == null) {
                throw new IllegalStateException("未找到构造参数对应替身: " + parameterTypes[i]);
            }
        }
        try {
            return serviceType.cast(target.newInstance(args));
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException("无法创建被测服务", ex);
        }
    }

    /**
     * 按领域返回合理的 Mapper 默认值，避免测试绑定 T-10 的具体 Mapper 方法名。
     */
    private static final class ConsultationMapperAnswer implements Answer<Object> {

        @Override
        public Object answer(InvocationOnMock invocation) {
            Class<?> returnType = invocation.getMethod().getReturnType();
            if (returnType == ConsultationStatusView.class) {
                return new ConsultationStatusView(
                        ORDER_NO, PRICE_CENTS, false, "submitted", WECHAT_ID, null);
            }
            if (returnType == Integer.class || returnType == int.class) {
                return 1;
            }
            if (returnType == Long.class || returnType == long.class) {
                return 1L;
            }
            if (returnType == Boolean.class || returnType == boolean.class) {
                return false;
            }
            return null;
        }
    }
}
