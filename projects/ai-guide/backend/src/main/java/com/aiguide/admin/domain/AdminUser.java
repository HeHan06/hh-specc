package com.aiguide.admin.domain;

/**
 * 管理员账号数据对象。全平台仅允许一个 ADMIN 账号，
 * 密码仅存 BCrypt 哈希，绝不明文或可逆加密（宪法 2.6）。
 */
public record AdminUser(Long id, String username, String passwordHash, String role, String status) {
}
