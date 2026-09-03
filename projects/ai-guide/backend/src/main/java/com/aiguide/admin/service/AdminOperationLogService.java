package com.aiguide.admin.service;

import com.aiguide.admin.dto.AdminViews.OperationLogView;
import com.aiguide.common.PageResult;
import com.aiguide.operationlog.OperationLogMapper;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import org.springframework.stereotype.Service;

/**
 * 后台操作日志查询服务。按对象类型与动作可选过滤，倒序分页返回操作者、时间、对象与动作。
 */
@Service
@Capability(req = "Req-11", name = "敏感操作日志")
public class AdminOperationLogService {

    private final OperationLogMapper operationLogMapper;

    public AdminOperationLogService(OperationLogMapper operationLogMapper) {
        this.operationLogMapper = operationLogMapper;
    }

    @CapabilityPoint(task = "T-12", name = "分页查询操作日志")
    public PageResult<OperationLogView> pageOperationLogs(int pageNum, int pageSize, String targetType, String action) {
        int offset = (pageNum - 1) * pageSize;
        String trimmedTargetType = trimToNull(targetType);
        String trimmedAction = trimToNull(action);
        return PageResult.of(
                operationLogMapper.selectPage(offset, pageSize, trimmedTargetType, trimmedAction),
                operationLogMapper.count(trimmedTargetType, trimmedAction),
                pageNum,
                pageSize);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
