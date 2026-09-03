/**
 * 订单状态页测试：根据路由区分打赏/咨询订单，展示管理员微信号、
 * 订单状态与收款/确认时间，失败时提供重试，且不暴露管理员备注。
 *
 * @capability Req-7 订单状态流转
 * @capability Req-12 错误反馈
 * @capability Req-13 页面可用性
 * @capabilityPoint T-21 订单状态展示与失败重试红测
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OrderStatusPage from './OrderStatusPage.jsx';
import { getTipOrder, getConsultationOrder } from '../services/order.js';

vi.mock('../services/order.js', () => ({
  getTipOrder: vi.fn(),
  getConsultationOrder: vi.fn(),
}));

const tipStatus = {
  orderNo: 'TIP-123456',
  amountCents: 500,
  status: 'received',
  wechatId: '15306507997',
  receivedAt: '2026-08-30T10:00:00Z',
};

const consultationStatus = {
  orderNo: 'CON-123456',
  priceCents: 50000,
  freeQuotaUsed: true,
  status: 'confirmed',
  wechatId: '15306507997',
  confirmedAt: '2026-08-30T11:00:00Z',
  adminNote: '内部备注不应展示',
};

function renderTipPage() {
  return render(
    <MemoryRouter initialEntries={['/orders/tips/TIP-123456']}>
      <Routes>
        <Route path="/orders/tips/:orderNo" element={<OrderStatusPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderConsultationPage() {
  return render(
    <MemoryRouter initialEntries={['/orders/consultations/CON-123456']}>
      <Routes>
        <Route path="/orders/consultations/:orderNo" element={<OrderStatusPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OrderStatusPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('打赏订单查询未返回时展示 loading 状态', () => {
    getTipOrder.mockReturnValue(new Promise(() => {}));
    renderTipPage();

    expect(screen.getByTestId('order-status-loading')).toBeInTheDocument();
    expect(getTipOrder).toHaveBeenCalledWith('TIP-123456');
  });

  it('展示打赏订单已收款状态、管理员微信号与收款时间', async () => {
    getTipOrder.mockResolvedValue(tipStatus);
    renderTipPage();

    expect(await screen.findByText('已收款')).toBeInTheDocument();
    expect(screen.getByText(/TIP-123456/)).toBeInTheDocument();
    expect(screen.getByText(/15306507997/)).toBeInTheDocument();
    expect(getTipOrder).toHaveBeenCalledWith('TIP-123456');
  });

  it('打赏订单加载失败时展示错误提示，重试成功后恢复状态', async () => {
    getTipOrder.mockRejectedValueOnce(new Error('network error'));
    renderTipPage();

    expect(await screen.findByText('加载失败，请重试')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();

    getTipOrder.mockResolvedValueOnce(tipStatus);
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    expect(await screen.findByText('已收款')).toBeInTheDocument();
    expect(getTipOrder).toHaveBeenCalledTimes(2);
  });

  it('展示咨询订单已确认状态与管理员微信号，且不暴露管理员备注', async () => {
    getConsultationOrder.mockResolvedValue(consultationStatus);
    renderConsultationPage();

    expect(await screen.findByText('已确认')).toBeInTheDocument();
    expect(screen.getByText(/CON-123456/)).toBeInTheDocument();
    expect(screen.getByText(/15306507997/)).toBeInTheDocument();
    expect(getConsultationOrder).toHaveBeenCalledWith('CON-123456');
    expect(screen.queryByText('内部备注不应展示')).not.toBeInTheDocument();
    expect(screen.queryByText('管理员备注')).not.toBeInTheDocument();
  });
});
