/**
 * 操作日志页测试：敏感操作留痕列表展示与 loading/error/空 三态。
 * 当前页面缺失，红测失败方向为模块无法解析；T-28 实现后同命令转绿。
 *
 * @capability Req-11 敏感操作留痕查询
 * @capability Req-12 统一错误处理与三态
 * @capabilityPoint T-27 操作日志页测试先行红测
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OperationLogPage from './OperationLogPage.jsx';
import { listOperationLogs } from '@shared/api/admin.js';

vi.mock('@shared/api/admin.js', () => ({
  listOperationLogs: vi.fn(),
}));

const tipReceiveLog = {
  id: 1,
  username: 'admin',
  action: '确认打赏收款',
  targetType: 'tip',
  targetCode: 'TIP-20260830001',
  beforeState: 'submitted',
  afterState: 'received',
  createdAt: '2026-08-30T10:00:00Z',
};

const contentArchiveLog = {
  id: 2,
  username: 'admin',
  action: '归档内容',
  targetType: 'content',
  targetCode: 'content-agent',
  beforeState: 'published',
  afterState: 'archived',
  createdAt: '2026-08-30T11:00:00Z',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/operation-logs']}>
      <Routes>
        <Route path="/operation-logs" element={<OperationLogPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OperationLogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listOperationLogs.mockResolvedValue({
      list: [tipReceiveLog, contentArchiveLog],
      total: 2,
      pageNum: 1,
      pageSize: 20,
    });
  });

  it('渲染操作日志列表，展示操作者、动作、对象与状态变化', async () => {
    renderPage();

    const rows = await screen.findAllByTestId('operation-log-row');
    expect(rows).toHaveLength(2);

    expect(within(rows[0]).getByText('admin')).toBeInTheDocument();
    expect(within(rows[0]).getByText('确认打赏收款')).toBeInTheDocument();
    expect(within(rows[0]).getByText('TIP-20260830001')).toBeInTheDocument();
    expect(within(rows[0]).getByText('submitted')).toBeInTheDocument();
    expect(within(rows[0]).getByText('received')).toBeInTheDocument();

    expect(within(rows[1]).getByText('content-agent')).toBeInTheDocument();
    expect(within(rows[1]).getByText('归档内容')).toBeInTheDocument();
  });

  it('日志加载中展示 loading 状态', () => {
    listOperationLogs.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByTestId('operation-log-loading')).toBeInTheDocument();
  });

  it('加载失败时展示错误提示，点击重试后重新加载', async () => {
    const user = userEvent.setup();
    listOperationLogs
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ list: [tipReceiveLog], total: 1, pageNum: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('加载失败，请重试')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^重\s*试$/ }));

    expect(await screen.findByText('TIP-20260830001')).toBeInTheDocument();
  });

  it('无日志时展示空态', async () => {
    listOperationLogs.mockResolvedValue({ list: [], total: 0, pageNum: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('暂无操作日志')).toBeInTheDocument();
  });
});
