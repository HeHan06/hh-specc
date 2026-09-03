package com.aiguide.admin.service;

import com.aiguide.admin.dto.AdminRequests.LoginRequest;
import com.aiguide.admin.dto.AdminViews.LoginView;
import com.aiguide.admin.dto.AdminViews.MeView;
import com.aiguide.common.ApiException;
import com.aiguide.security.JwtTokenService;
import java.lang.reflect.Constructor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.mockito.invocation.InvocationOnMock;
import org.mockito.stubbing.Answer;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * 后台鉴权服务测试（T-11 测试先行）。
 *
 * 当前 AdminAuthService 为 T-04 占位实现，因此本测试在 T-12 实现前应以红色失败结束。
 * 断言方向：登录失败返回统一 2300（不泄露账号是否存在）、成功签发 JWT 且角色唯一为 ADMIN。
 */
class AdminAuthServiceTest {

    private static final String USERNAME = "admin";

    private JwtTokenService jwtTokenService;
    private PasswordEncoder passwordEncoder;
    private AdminAuthService adminAuthService;

    @BeforeEach
    void setUp() {
        jwtTokenService = Mockito.mock(JwtTokenService.class);
        passwordEncoder = Mockito.mock(PasswordEncoder.class);

        when(jwtTokenService.generateToken(anyLong(), anyString(), anyString()))
                .thenReturn("jwt-token");
        when(passwordEncoder.matches(anyString(), anyString()))
                .thenAnswer(invocation -> "correct".equals(invocation.getArgument(0)));

        // T-12 才会引入 AdminUserMapper；这里按类名反射创建替身，避免测试期强依赖未落盘类型。
        Object adminUserMapper = null;
        try {
            Class<?> adminUserMapperType = Class.forName("com.aiguide.admin.mapper.AdminUserMapper");
            adminUserMapper = Mockito.mock(adminUserMapperType, new AdminUserMapperAnswer());
        } catch (ClassNotFoundException ignored) {
            // T-11 阶段类型尚未创建，T-12 实现后该分支不再生效。
        }

        adminAuthService = instantiateService(
                AdminAuthService.class, jwtTokenService, passwordEncoder, adminUserMapper);
    }

    @Test
    void login_wrongPassword_throwsUnifiedLoginError() {
        LoginRequest request = new LoginRequest(USERNAME, "wrong");

        ApiException ex = assertThrows(ApiException.class,
                () -> adminAuthService.login(request));

        assertEquals(2300, ex.getErrorCode().getCode());
    }

    @Test
    void login_success_returnsTokenAndUniqueAdminRole() {
        LoginRequest request = new LoginRequest(USERNAME, "correct");

        LoginView view = adminAuthService.login(request);

        assertNotNull(view);
        assertNotNull(view.token());
        assertEquals(USERNAME, view.username());
        assertEquals("ADMIN", view.role());
    }

    @Test
    void me_returnsUniqueAdminRole() {
        MeView view = adminAuthService.me();

        assertNotNull(view);
        assertEquals("ADMIN", view.role());
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

    /**
     * 按类名动态创建 AdminUserMapper 替身；查询 admin 账号时返回一个被桩化的管理员对象，
     * 从而让登录成功路径在 T-12 引入真实 Mapper 类型后仍可运行。
     */
    private static final class AdminUserMapperAnswer implements Answer<Object> {

        @Override
        public Object answer(InvocationOnMock invocation) {
            Class<?> returnType = invocation.getMethod().getReturnType();
            if (returnType == void.class || returnType == Void.class) {
                return null;
            }
            if (returnType == String.class) {
                return null;
            }
            if (returnType == Integer.class || returnType == int.class) {
                return 0;
            }
            if (returnType == Long.class || returnType == long.class) {
                return 0L;
            }
            if (returnType == Boolean.class || returnType == boolean.class) {
                return false;
            }

            Object[] args = invocation.getArguments();
            if (args.length > 0 && USERNAME.equals(args[0])) {
                return Mockito.mock(returnType, new AdminUserAnswer());
            }
            return null;
        }
    }

    /**
     * 管理员实体替身：账号密码走 BCrypt 校验，角色固定为 ADMIN，状态默认启用。
     */
    private static final class AdminUserAnswer implements Answer<Object> {

        @Override
        public Object answer(InvocationOnMock invocation) {
            String methodName = invocation.getMethod().getName();
            if ("username".equals(methodName) || "getUsername".equals(methodName)) {
                return USERNAME;
            }
            if ("passwordHash".equals(methodName) || "getPasswordHash".equals(methodName)) {
                return "bcrypt-hash";
            }
            if ("role".equals(methodName) || "getRole".equals(methodName)) {
                return "ADMIN";
            }
            if ("status".equals(methodName) || "getStatus".equals(methodName)) {
                return "enabled";
            }
            if ("id".equals(methodName) || "getId".equals(methodName)) {
                return 1L;
            }
            Class<?> returnType = invocation.getMethod().getReturnType();
            if (returnType == String.class) {
                return null;
            }
            if (returnType == Long.class || returnType == long.class) {
                return 0L;
            }
            if (returnType == Integer.class || returnType == int.class) {
                return 0;
            }
            if (returnType == Boolean.class || returnType == boolean.class) {
                return false;
            }
            return null;
        }
    }
}
