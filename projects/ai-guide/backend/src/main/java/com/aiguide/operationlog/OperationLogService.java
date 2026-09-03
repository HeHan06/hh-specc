package com.aiguide.operationlog;

import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;

/**
 * 敏感操作日志服务。
 * 由操作日志切面在业务事务内调用，确保日志写入与业务更新同事务生效；
 * 具体落库实现在 T-12 的 OperationLogServiceImpl 中完成。
 */
@Capability(req = "Req-11", name = "敏感操作日志")
public interface OperationLogService {

    /**
     * 记录一次敏感操作。
     *
     * @param adminUserId 操作者（管理员）ID
     * @param action      动作名称
     * @param targetType  目标类型
     * @param targetCode  目标编码
     * @param beforeState 操作前状态，可为 null
     * @param afterState  操作后状态，可为 null
     * @param detail      补充说明 JSON 字符串，可为 null
     */
    @CapabilityPoint(task = "T-03", name = "写入敏感操作日志")
    void record(Long adminUserId, String action, String targetType, String targetCode,
                String beforeState, String afterState, String detail);
}
