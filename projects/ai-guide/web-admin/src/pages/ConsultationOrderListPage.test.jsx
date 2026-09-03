/**
 * 咨询订单列表页测试：列表/详情/筛选分页、确认排期/完成/取消/备注
 * 以及免费名额结果展示；取消与备注在提交前先收集管理员输入。
 * 当前页面缺失，红测失败方向为模块无法解析；T-28 实现后同命令转绿。
 *
 * @capability Req-7 咨询订单后台状态流转
 * @capability Req-11 咨询订单管理
 * @capability Req-12 统一错误处理与敏感操作反馈
 * @capabilityPoint T-27 咨询订单列表页测试先行红测
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ConsultationOrderListPage from './ConsultationOrderListPage.jsx';
import {
  cancelConsultation,
  completeConsultation,
  confirmConsultation,
  getConsultation,
  listConsultations,
  updateConsultationNote,
} from '@shared/api/admin.js';

vi.mock('@shared/api/admin.js', () => ({
  listConsultations: vi.fn(),
  getConsultation: vi.fn(),
  confirmConsultation: vi.fn(),
  completeConsultation: vi.fn(),
  cancelConsultation: vi.fn(),
  updateConsultationNote: vi.fn(),
}));

const submittedConsultation = {
  orderNo: 'CON-20260830001',
  contactName: '李四',
  contactValue: 'wxid_lisi',
  topicText: 'Agent 记忆设计',
  priceCents: 50000,
  status: 'submitted',
  createdAt: '2026-08-30T09:00:00Z',
};

const confirmedConsultation = {
  ...submittedConsultation,
  orderNo: 'CON-20260830002',
  status: 'confirmed',
};

const consultationDetail = {
  orderNo: 'CON-20260830001',
  contactName: '李四',
  contactType: 'wechat',
  contactValue: 'wxid_lisi',
  topicText: 'Agent 记忆设计',
  requestText: '希望系统梳理上下文与记忆设计面试题',
  expectedTime: '2026-09-01T10:00:00Z',
  priceCents: 50000,
  freeQuotaUsed: false,
  status: 'submitted',
  adminNote: '',
  confirmedAt: null,
  createdAt: '2026-08-30T09:00:00Z',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/orders/consultations']}>
      <Routes>
        <Route path="/orders/consultations" element={<ConsultationOrderListPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ConsultationOrderListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listConsultations.mockResolvedValue({
      list: [submittedConsultation, confirmedConsultation],
      total: 2,
      pageNum: 1,
      pageSize: 20,
    });
    getConsultation.mockResolvedValue(consultationDetail);
    confirmConsultation.mockResolvedValue({
      orderNo: 'CON-20260830001',
      status: 'confirmed',
      priceCents: 0,
      freeQuotaUsed: true,
      confirmedAt: '2026-08-30T10:00:00Z',
    });
    completeConsultation.mockResolvedValue({
      orderNo: 'CON-20260830001',
      status: 'completed',
      completedAt: '2026-08-30T12:00:00Z',
    });
    cancelConsultation.mockResolvedValue({
      orderNo: 'CON-20260830001',
      status: 'canceled',
      canceledAt: '2026-08-30T12:00:00Z',
    });
    updateConsultationNote.mockResolvedValue({ orderNo: 'CON-20260830001', adminNote: '' });
  });

  it('渲染咨询订单列表，展示订单号、联系人、咨询主题与状态', async () => {
    renderPage();

    const rows = await screen.findAllByTestId('consultation-order-row');
    expect(rows).toHaveLength(2);

    expect(within(rows[0]).getByText('CON-20260830001')).toBeInTheDocument();
    expect(within(rows[0]).getByText('李四')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Agent 记忆设计')).toBeInTheDocument();
    expect(within(rows[0]).getByText('已提交')).toBeInTheDocument();
    expect(within(rows[1]).getByText('已确认')).toBeInTheDocument();
  });

  it('订单列表加载中展示 loading 状态', () => {
    listConsultations.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByTestId('consultation-order-loading')).toBeInTheDocument();
  });

  it('加载失败时展示错误提示，点击重试后重新加载', async () => {
    const user = userEvent.setup();
    listConsultations
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ list: [submittedConsultation], total: 1, pageNum: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('加载失败，请重试')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^重\s*试$/ }));

    expect(await screen.findByText('CON-20260830001')).toBeInTheDocument();
  });

  it('无订单时展示空态', async () => {
    listConsultations.mockResolvedValue({ list: [], total: 0, pageNum: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('暂无咨询订单')).toBeInTheDocument();
  });

  it('打开详情时按订单号查询并展示联系方式、咨询诉求与期望时间', async () => {
    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findAllByTestId('consultation-order-row'))[0];

    await user.click(within(row).getByRole('button', { name: /^详\s*情$/ }));

    await waitFor(() => {
      expect(getConsultation).toHaveBeenCalledWith(expect.anything(), 'CON-20260830001');
    });
    expect(await screen.findByText('wxid_lisi')).toBeInTheDocument();
    expect(screen.getByText('希望系统梳理上下文与记忆设计面试题')).toBeInTheDocument();
  });

  it('确认排期前必须二次确认，确认后展示免费名额结果并刷新列表', async () => {
    const user = userEvent.setup();
    listConsultations
      .mockResolvedValueOnce({ list: [submittedConsultation], total: 1, pageNum: 1, pageSize: 20 })
      .mockResolvedValueOnce({
        list: [{ ...submittedConsultation, status: 'confirmed', priceCents: 0 }],
        total: 1,
        pageNum: 1,
        pageSize: 20,
      });
    renderPage();
    const row = (await screen.findAllByTestId('consultation-order-row'))[0];

    await user.click(within(row).getByRole('button', { name: '确认排期' }));
    expect(confirmConsultation).not.toHaveBeenCalled();

    await user.click(await screen.findByRole('button', { name: /^确\s*认$/ }));

    await waitFor(() => {
      expect(confirmConsultation).toHaveBeenCalledWith(
        expect.anything(),
        'CON-20260830001',
        expect.any(Object),
      );
    });
    expect(await screen.findByText('已确认')).toBeInTheDocument();
    expect(screen.getByText('免费')).toBeInTheDocument();
  });

  it('完成订单前必须二次确认，确认后调用完成接口', async () => {
    const user = userEvent.setup();
    listConsultations.mockResolvedValue({
      list: [confirmedConsultation],
      total: 1,
      pageNum: 1,
      pageSize: 20,
    });
    renderPage();
    const row = (await screen.findAllByTestId('consultation-order-row'))[0];

    await user.click(within(row).getByRole('button', { name: /^完\s*成$/ }));
    expect(completeConsultation).not.toHaveBeenCalled();

    await user.click(await screen.findByRole('button', { name: /^确\s*认$/ }));

    await waitFor(() => {
      expect(completeConsultation).toHaveBeenCalledWith(
        expect.anything(),
        'CON-20260830002',
        expect.any(Object),
      );
    });
  });

  it('取消订单时填写取消原因后才调用取消接口', async () => {
    const user = userEvent.setup();
    listConsultations.mockResolvedValue({
      list: [submittedConsultation],
      total: 1,
      pageNum: 1,
      pageSize: 20,
    });
    renderPage();
    const row = (await screen.findAllByTestId('consultation-order-row'))[0];

    await user.click(within(row).getByRole('button', { name: /^取\s*消$/ }));
    expect(cancelConsultation).not.toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText('请输入取消原因'), '访客未按时联系');
    await user.click(screen.getByRole('button', { name: '确认取消' }));

    await waitFor(() => {
      expect(cancelConsultation).toHaveBeenCalledWith(
        expect.anything(),
        'CON-20260830001',
        expect.objectContaining({ adminNote: '访客未按时联系' }),
      );
    });
  });

  it('更新备注时填写备注内容并调用备注接口', async () => {
    const user = userEvent.setup();
    listConsultations.mockResolvedValue({
      list: [submittedConsultation],
      total: 1,
      pageNum: 1,
      pageSize: 20,
    });
    renderPage();
    const row = (await screen.findAllByTestId('consultation-order-row'))[0];

    await user.click(within(row).getByRole('button', { name: /^备\s*注$/ }));

    await user.type(screen.getByPlaceholderText('请输入管理员备注'), '已电话确认时间');
    await user.click(screen.getByRole('button', { name: '保存备注' }));

    await waitFor(() => {
      expect(updateConsultationNote).toHaveBeenCalledWith(
        expect.anything(),
        'CON-20260830001',
        expect.objectContaining({ adminNote: '已电话确认时间' }),
      );
    });
  });

  it('按关键词筛选时携带 keyword 并回到第一页', async () => {
    const user = userEvent.setup();
    listConsultations.mockResolvedValue({
      list: [submittedConsultation],
      total: 1,
      pageNum: 1,
      pageSize: 20,
    });
    renderPage();
    await screen.findByText('CON-20260830001');

    await user.type(screen.getByPlaceholderText('请输入订单号、联系人或咨询主题'), '记忆设计');
    await user.click(screen.getByRole('button', { name: /^查\s*询$/ }));

    await waitFor(() => {
      expect(listConsultations).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ keyword: '记忆设计', pageNum: 1, pageSize: 20 }),
      );
    });
  });

  it('切换分页后按 pageNum 重新请求咨询订单列表', async () => {
    listConsultations.mockResolvedValue({
      list: [submittedConsultation],
      total: 25,
      pageNum: 1,
      pageSize: 20,
    });
    renderPage();
    await screen.findByText('CON-20260830001');

    await userEvent.click(screen.getByTitle('2'));

    await waitFor(() => {
      expect(listConsultations).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ pageNum: 2, pageSize: 20 }),
      );
    });
  });
});
