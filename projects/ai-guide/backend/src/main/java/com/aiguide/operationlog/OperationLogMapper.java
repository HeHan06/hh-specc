package com.aiguide.operationlog;

import com.aiguide.admin.dto.AdminViews;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * 操作日志数据访问接口。
 * 全部入参由 MyBatis {@code #{} } 参数化占位，禁止字符串拼接 SQL；
 * 对应 XML Mapper 在 T-12 与后台 Mapper 一同落盘。
 */
@Mapper
@Capability(req = "Req-11", name = "敏感操作日志")
public interface OperationLogMapper {

    @CapabilityPoint(task = "T-03", name = "持久化敏感操作日志")
    int insert(@Param("adminUserId") Long adminUserId,
               @Param("action") String action,
               @Param("targetType") String targetType,
               @Param("targetCode") String targetCode,
               @Param("beforeState") String beforeState,
               @Param("afterState") String afterState,
               @Param("detail") String detail);

    @CapabilityPoint(task = "T-12", name = "分页查询操作日志")
    List<AdminViews.OperationLogView> selectPage(@Param("offset") int offset,
                                                 @Param("limit") int limit,
                                                 @Param("targetType") String targetType,
                                                 @Param("action") String action);

    @CapabilityPoint(task = "T-12", name = "统计操作日志条数")
    long count(@Param("targetType") String targetType,
               @Param("action") String action);
}
