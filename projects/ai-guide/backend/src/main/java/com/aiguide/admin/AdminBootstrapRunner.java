package com.aiguide.admin;

import com.aiguide.admin.domain.AdminUser;
import com.aiguide.admin.mapper.AdminUserMapper;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * 管理员账号初始化。
 * 生产环境从环境变量读取 {@code ADMIN_USERNAME} 与 {@code ADMIN_PASSWORD_HASH}（BCrypt），
 * 本地开发可读取 {@code ADMIN_INITIAL_PASSWORD} 生成哈希；任何密码均不入日志、不入代码。
 */
@Component
@Capability(req = "Req-8", name = "管理员账号初始化")
public class AdminBootstrapRunner implements ApplicationRunner {

    private final AdminUserMapper adminUserMapper;
    private final PasswordEncoder passwordEncoder;
    private final String adminUsername;
    private final String adminPasswordHash;
    private final String adminInitialPassword;

    public AdminBootstrapRunner(AdminUserMapper adminUserMapper,
                                PasswordEncoder passwordEncoder,
                                @Value("${ADMIN_USERNAME:}") String adminUsername,
                                @Value("${ADMIN_PASSWORD_HASH:}") String adminPasswordHash,
                                @Value("${ADMIN_INITIAL_PASSWORD:}") String adminInitialPassword) {
        this.adminUserMapper = adminUserMapper;
        this.passwordEncoder = passwordEncoder;
        this.adminUsername = trimToNull(adminUsername);
        this.adminPasswordHash = trimToNull(adminPasswordHash);
        this.adminInitialPassword = trimToNull(adminInitialPassword);
    }

    @Override
    @CapabilityPoint(task = "T-12", name = "初始化唯一管理员账号")
    public void run(ApplicationArguments args) {
        if (adminUsername == null) {
            return;
        }

        AdminUser existing = adminUserMapper.selectByUsername(adminUsername);
        if (existing != null) {
            return;
        }

        if (adminPasswordHash != null) {
            adminUserMapper.insertAdminUser(adminUsername, adminPasswordHash, "ADMIN", "enabled");
            return;
        }

        if (adminInitialPassword != null) {
            // 本地开发兜底：首次启动生成 BCrypt 哈希；生产应直接注入已哈希的 ADMIN_PASSWORD_HASH。
            adminUserMapper.insertAdminUser(adminUsername, passwordEncoder.encode(adminInitialPassword),
                    "ADMIN", "enabled");
            return;
        }

        throw new IllegalStateException(
                "已配置 ADMIN_USERNAME，但未提供 ADMIN_PASSWORD_HASH 或 ADMIN_INITIAL_PASSWORD");
    }

    private static String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
