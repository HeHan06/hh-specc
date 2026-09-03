package com.aiguide.operationlog;

import com.aiguide.common.ApiErrorCode;
import com.aiguide.common.ApiException;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 敏感操作日志落库实现。
 * 使用 MANDATORY 传播级别加入调用方事务，确保日志与业务更新同事务生效；
 * 日志写入失败时抛出业务异常，禁止静默吞掉留痕失败（宪法 7.4）。
 */
@Service
@Capability(req = "Req-11", name = "敏感操作日志")
public class OperationLogServiceImpl implements OperationLogService {

    private final OperationLogMapper operationLogMapper;

    public OperationLogServiceImpl(OperationLogMapper operationLogMapper) {
        this.operationLogMapper = operationLogMapper;
    }

    @Override
    @CapabilityPoint(task = "T-12", name = "持久化敏感操作日志")
    @Transactional(propagation = Propagation.MANDATORY)
    public void record(Long adminUserId, String action, String targetType, String targetCode,
                       String beforeState, String afterState, String detail) {
        int rows = operationLogMapper.insert(adminUserId, action, targetType, targetCode,
                beforeState, afterState, detail);
        if (rows != 1) {
            throw new ApiException(ApiErrorCode.OPERATION_LOG_FAILED);
        }
    }
}
