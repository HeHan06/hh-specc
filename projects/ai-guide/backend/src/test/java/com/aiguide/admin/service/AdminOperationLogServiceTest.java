package com.aiguide.admin.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiguide.admin.dto.AdminViews.OperationLogView;
import com.aiguide.common.PageResult;
import com.aiguide.operationlog.OperationLogMapper;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * 后台操作日志查询服务测试（T-12 实现）。
 * 断言分页 offset/limit 计算、可选过滤参数 trim、以及分页结果组装。
 */
class AdminOperationLogServiceTest {

    private OperationLogMapper operationLogMapper;
    private AdminOperationLogService adminOperationLogService;

    @BeforeEach
    void setUp() {
        operationLogMapper = mock(OperationLogMapper.class);
        adminOperationLogService = new AdminOperationLogService(operationLogMapper);
    }

    @Test
    void pageOperationLogs_computesOffsetAndReturnsPageResult() {
        OperationLogView view = new OperationLogView(1L, "admin", "publish", "content",
                "content-1", "draft", "published", "2026-08-30T00:00:00Z");
        when(operationLogMapper.selectPage(anyInt(), anyInt(), anyString(), anyString()))
                .thenReturn(List.of(view));
        when(operationLogMapper.count(anyString(), anyString())).thenReturn(1L);

        PageResult<OperationLogView> result =
                adminOperationLogService.pageOperationLogs(2, 20, "content", "publish");

        verify(operationLogMapper).selectPage(20, 20, "content", "publish");
        verify(operationLogMapper).count("content", "publish");
        assertEquals(2, result.pageNum());
        assertEquals(20, result.pageSize());
        assertEquals(1L, result.total());
        assertEquals(1, result.list().size());
        assertEquals("admin", result.list().get(0).username());
    }

    @Test
    void pageOperationLogs_trimsBlankFiltersToNull() {
        when(operationLogMapper.selectPage(anyInt(), anyInt(), anyString(), anyString()))
                .thenReturn(List.of());
        when(operationLogMapper.count(anyString(), anyString())).thenReturn(0L);

        adminOperationLogService.pageOperationLogs(1, 20, "  content  ", "   ");

        verify(operationLogMapper).selectPage(0, 20, "content", null);
        verify(operationLogMapper).count("content", null);
    }

    @Test
    void pageOperationLogs_nullFiltersStayNull() {
        when(operationLogMapper.selectPage(anyInt(), anyInt(), anyString(), anyString()))
                .thenReturn(List.of());
        when(operationLogMapper.count(anyString(), anyString())).thenReturn(0L);

        adminOperationLogService.pageOperationLogs(1, 20, null, null);

        verify(operationLogMapper).selectPage(0, 20, null, null);
        verify(operationLogMapper).count(null, null);
    }
}
