/**
 * 打赏订单列表页测试：列表/详情/筛选/分页、收款确认与关闭二次确认。
 * 当前页面缺失，红测失败方向为模块无法解析；T-28 实现后同命令转绿。
 *
 * @capability Req-7 打赏订单后台状态流转
 * @capability Req-11 打赏订单管理
 * @capability Req-12 统一错误处理与敏感操作反馈
 * @capabilityPoint T-27 打赏订单列表页测试先行红测
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TipOrderListPage from './TipOrderListPage.jsx';
import { closeTip, getTip, listTips, receiveTip } from '@shared/api/admin.js';

vi.mock('@shared/api/admin.js', () => ({
  listTips: vi.fn(),
  getTip: vi.fn(),
  receiveTip: vi.fn(),
  closeTip: vi.fn(),
}));

const submittedTip = {
  orderNo: 'TIP-20260830001',
  contentCode: 'content-agent',
  amountCents: 500,
  status: 'submitted',
  contactValue: '13800138000',
  createdAt: '2026-08-30T08:00:00Z',
};

const receivedTip = {
  ...submittedTip,
  orderNo: 'TIP-20260830002',
  status: 'received',
};

const tipDetail = {
  orderNo: 'TIP-20260830001',
  contentCode: 'content-agent',
  amountCents: 500,
  contactName: '张三',
  contactValue: '13800138000',
  message: '感谢分享，内容很有帮助',
  status: 'submitted',
  receivedAt: null,
  closedAt: null,
  createdAt: '2026-08-30T08:00:00Z',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/orders/tips']}>
      <Routes>
        <Route path="/orders/tips" element={<TipOrderListPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TipOrderListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listTips.mockResolvedValue({ list: [submittedTip, receivedTip], total: 2, pageNum: 1, pageSize: 20 });
    getTip.mockResolvedValue(tipDetail);
    receiveTip.mockResolvedValue({ orderNo: 'TIP-20260830001', status: 'received', receivedAt: '2026-08-30T10:00:00Z' });
    closeTip.mockResolvedValue({ orderNo: 'TIP-20260830001', status: 'closed', closedAt: '2026-08-30T10:00:00Z' });
  });

  it('渲染打赏订单列表，展示订单号、金额与订单状态', async () => {
    renderPage();

    const rows = await screen.findAllByTestId('tip-order-row');
    expect(rows).toHaveLength(2);

    expect(within(rows[0]).getByText('TIP-20260830001')).toBeInTheDocument();
    expect(within(rows[0]).getByText('已提交')).toBeInTheDocument();
    expect(within(rows[1]).getByText('TIP-20260830002')).toBeInTheDocument();
    expect(within(rows[1]).getByText('已收款')).toBeInTheDocument();
  });

  it('订单列表加载中展示 loading 状态', () => {
    listTips.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByTestId('tip-order-loading')).toBeInTheDocument();
  });

  it('加载失败时展示错误提示，点击重试后重新加载', async () => {
    const user = userEvent.setup();
    listTips
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ list: [submittedTip], total: 1, pageNum: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('加载失败，请重试')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^重\s*试$/ }));

    expect(await screen.findByText('TIP-20260830001')).toBeInTheDocument();
  });

  it('无订单时展示空态', async () => {
    listTips.mockResolvedValue({ list: [], total: 0, pageNum: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('暂无打赏订单')).toBeInTheDocument();
  });

  it('打开详情时按订单号查询并展示联系人、联系方式与留言', async () => {
    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findAllByTestId('tip-order-row'))[0];

    await user.click(within(row).getByRole('button', { name: /^详\s*情$/ }));

    await waitFor(() => {
      expect(getTip).toHaveBeenCalledWith(expect.anything(), 'TIP-20260830001');
    });
    expect(await screen.findByText('张三')).toBeInTheDocument();
    expect(screen.getByText('13800138000')).toBeInTheDocument();
    expect(screen.getByText('感谢分享，内容很有帮助')).toBeInTheDocument();
  });

  it('确认收款前必须二次确认，确认后才调用收款接口并重新加载列表', async () => {
    const user = userEvent.setup();
    listTips.mockResolvedValue({ list: [submittedTip], total: 1, pageNum: 1, pageSize: 20 });
    renderPage();
    const row = (await screen.findAllByTestId('tip-order-row'))[0];

    await user.click(within(row).getByRole('button', { name: '确认收款' }));
    expect(receiveTip).not.toHaveBeenCalled();

    await user.click(await screen.findByRole('button', { name: /^确\s*认$/ }));

    await waitFor(() => {
      expect(receiveTip).toHaveBeenCalledWith(expect.anything(), 'TIP-20260830001');
    });
    expect(listTips).toHaveBeenCalledTimes(2);
  });

  it('关闭订单前必须二次确认，确认后才调用关闭接口', async () => {
    const user = userEvent.setup();
    listTips.mockResolvedValue({ list: [submittedTip], total: 1, pageNum: 1, pageSize: 20 });
    renderPage();
    const row = (await screen.findAllByTestId('tip-order-row'))[0];

    await user.click(within(row).getByRole('button', { name: /^关\s*闭$/ }));
    expect(closeTip).not.toHaveBeenCalled();

    await user.click(await screen.findByRole('button', { name: '确认关闭' }));

    await waitFor(() => {
      expect(closeTip).toHaveBeenCalledWith(expect.anything(), 'TIP-20260830001');
    });
  });

  it('按关键词筛选时携带 keyword 并回到第一页', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('TIP-20260830001');

    await user.type(screen.getByPlaceholderText('请输入订单号或联系方式'), 'TIP-2026');
    await user.click(screen.getByRole('button', { name: /^查\s*询$/ }));

    await waitFor(() => {
      expect(listTips).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ keyword: 'TIP-2026', pageNum: 1, pageSize: 20 }),
      );
    });
  });

  it('切换分页后按 pageNum 重新请求订单列表', async () => {
    listTips.mockResolvedValue({
      list: [submittedTip],
      total: 25,
      pageNum: 1,
      pageSize: 20,
    });
    renderPage();
    await screen.findByText('TIP-20260830001');

    await userEvent.click(screen.getByTitle('2'));

    await waitFor(() => {
      expect(listTips).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ pageNum: 2, pageSize: 20 }),
      );
    });
  });
});
