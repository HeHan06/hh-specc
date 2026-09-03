package com.aiguide.admin.mapper;

import com.aiguide.admin.domain.AdminUser;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * 管理员账号数据访问接口。仅支持按用户名查询与初始化写入；
 * 所有用户输入均使用 MyBatis {@code #{} } 参数化占位。
 */
@Mapper
@Capability(req = "Req-8", name = "管理员账号")
public interface AdminUserMapper {

    @CapabilityPoint(task = "T-12", name = "按用户名查询管理员")
    AdminUser selectByUsername(@Param("username") String username);

    @CapabilityPoint(task = "T-12", name = "初始化写入管理员账号")
    int insertAdminUser(@Param("username") String username,
                        @Param("passwordHash") String passwordHash,
                        @Param("role") String role,
                        @Param("status") String status);
}
