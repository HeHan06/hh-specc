package com.aiguide.order.service;

import com.aiguide.common.ApiException;
import com.aiguide.config.SiteConfigProperties;
import com.aiguide.order.dto.TipCreateRequest;
import com.aiguide.order.dto.TipCreateResultView;
import com.aiguide.order.dto.TipStatusView;
import com.aiguide.order.mapper.TipOrderMapper;
import java.lang.reflect.Constructor;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.mockito.invocation.InvocationOnMock;
import org.mockito.stubbing.Answer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

/**
 * 打赏留资单 Service 测试（T-09 测试先行）。
 *
 * 只依赖 TipOrderService 的公共方法签名，不绑定 T-10 将要补齐的 Mapper 方法名；
 * 当前 Service 为 T-04 占位实现，因此本测试应以红色失败结束。
 * 断言方向：金额枚举、联系方式可选与格式校验、订单号不可猜测、公开查询字段范围、未知订单错误码。
 */
class TipOrderServiceTest {

    private static final String WECHAT_ID = "admin-wechat-001";
    private static final String ORDER_NO = "0a1b2c3d4e5f6789abcdef0123456789";
    private static final int AMOUNT_CENTS = 1000;
    private static final Pattern UNGUESSABLE_ORDER_NO =
            Pattern.compile("^[A-Za-z0-9-]{16,40}$");

    private TipOrderMapper tipOrderMapper;

    private SiteConfigProperties siteConfigProperties;

    private TipOrderService tipOrderService;

    @BeforeEach
    void setUp() {
        tipOrderMapper = Mockito.mock(TipOrderMapper.class, new TipMapperAnswer());
        siteConfigProperties = Mockito.mock(SiteConfigProperties.class);
        when(siteConfigProperties.getWechatId()).thenReturn(WECHAT_ID);
        tipOrderService = instantiateService(TipOrderService.class, tipOrderMapper, siteConfigProperties);
    }

    @Test
    void create_acceptsPresetAmountAndReturnsUnguessableSubmittedOrder() {
        TipCreateRequest request = new TipCreateRequest(null, AMOUNT_CENTS, null, null, null);

        TipCreateResultView result = tipOrderService.create(request, null);

        assertNotNull(result);
        assertTrue(UNGUESSABLE_ORDER_NO.matcher(result.orderNo()).matches(), "订单号必须为不可猜测随机值");
        assertEquals(AMOUNT_CENTS, result.amountCents());
        assertEquals("submitted", result.status());
        assertEquals(WECHAT_ID, result.wechatId());
    }

    @Test
    void create_rejectsAmountOutsidePresetEnum() {
        TipCreateRequest request = new TipCreateRequest(null, 250, null, null, null);

        ApiException ex = assertThrows(ApiException.class,
                () -> tipOrderService.create(request, null));

        assertEquals(2100, ex.getErrorCode().getCode());
    }

    @Test
    void create_allowsOptionalContactInfoToBeAbsent() {
        TipCreateRequest request = new TipCreateRequest("content-1", 100, null, null, "感谢分享");

        TipCreateResultView result = tipOrderService.create(request, null);

        assertNotNull(result);
        assertEquals("submitted", result.status());
    }

    @Test
    void create_rejectsInvalidContactValueWhenProvided() {
        TipCreateRequest request = new TipCreateRequest(null, AMOUNT_CENTS, null, "bad", null);

        ApiException ex = assertThrows(ApiException.class,
                () -> tipOrderService.create(request, null));

        assertEquals(2105, ex.getErrorCode().getCode());
    }

    @Test
    void getByOrderNo_returnsOnlyPublicStatusFields() {
        TipStatusView view = tipOrderService.getByOrderNo(ORDER_NO);

        assertNotNull(view);
        assertEquals(ORDER_NO, view.orderNo());
        assertEquals(AMOUNT_CENTS, view.amountCents());
        assertEquals("submitted", view.status());
        assertEquals(WECHAT_ID, view.wechatId());
    }

    @Test
    void getByOrderNo_unknownOrderThrowsBusinessError() {
        tipOrderService = instantiateService(TipOrderService.class,
                Mockito.mock(TipOrderMapper.class), siteConfigProperties);

        ApiException ex = assertThrows(ApiException.class,
                () -> tipOrderService.getByOrderNo("missing-order"));

        assertEquals(2101, ex.getErrorCode().getCode());
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
    private static final class TipMapperAnswer implements Answer<Object> {

        @Override
        public Object answer(InvocationOnMock invocation) {
            Class<?> returnType = invocation.getMethod().getReturnType();
            if (returnType == TipStatusView.class) {
                return new TipStatusView(ORDER_NO, AMOUNT_CENTS, "submitted", WECHAT_ID, null);
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
