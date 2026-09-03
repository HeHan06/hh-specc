package com.aiguide.security;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import javax.crypto.SecretKey;

import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * JWT 签发与校验服务。
 * 密钥仅从环境变量 {@code JWT_SECRET} 读取，禁止在代码或配置中硬编码；
 * 令牌采用 HS256，携带管理员用户 ID、用户名与角色，供鉴权过滤器与操作日志切面使用。
 */
@Service
@Capability(req = "Req-8", name = "管理员鉴权")
public class JwtTokenService {

    private final SecretKey secretKey;
    private final long ttlMillis;

    public JwtTokenService(@Value("${JWT_SECRET}") String secret,
                           @Value("${JWT_TTL_MINUTES:120}") long ttlMinutes) {
        byte[] secretBytes = secret.getBytes(StandardCharsets.UTF_8);
        // HS256 要求至少 256 位密钥；启动即失败，避免使用弱密钥签发令牌。
        if (secretBytes.length < 32) {
            throw new IllegalStateException("JWT_SECRET 长度至少为 32 字节");
        }
        this.secretKey = Keys.hmacShaKeyFor(secretBytes);
        this.ttlMillis = ttlMinutes * 60_000L;
    }

    /**
     * 签发管理员 JWT。令牌主体为用户名，额外携带用户 ID 与角色声明。
     */
    @CapabilityPoint(task = "T-03", name = "签发管理员 JWT")
    public String generateToken(Long userId, String username, String role) {
        Date now = new Date();
        return Jwts.builder()
                .subject(username)
                .claim("uid", userId)
                .claim("role", role)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + ttlMillis))
                .signWith(secretKey)
                .compact();
    }

    /**
     * 解析并校验 JWT。签名、格式或过期不合法时由 JJWT 抛出异常，由调用方统一拦截。
     */
    @CapabilityPoint(task = "T-03", name = "校验并解析管理员 JWT")
    public JwtClaims parseToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        Long userId = null;
        Number uid = claims.get("uid", Number.class);
        if (uid != null) {
            userId = uid.longValue();
        }
        return new JwtClaims(userId, claims.getSubject(), claims.get("role", String.class));
    }

    /**
     * 已校验令牌的载荷。操作日志切面依赖其中的用户 ID 与角色完成管理员校验。
     */
    public record JwtClaims(Long userId, String username, String role) {
    }
}
