/**
 * 打赏页测试：金额档位按元展示、按分提交，联系方式可选，提交后展示
 * 管理员微信号与「备注订单号完成支付」提示。
 *
 * @capability Req-5 打赏
 * @capability Req-12 输入校验与错误反馈
 * @capabilityPoint T-21 打赏金额枚举、可选联系方式与提交成功提示红测
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TipPage from './TipPage.jsx';
import { createTipOrder } from '../services/order.js';
import { TIP_AMOUNT_CENTS } from '@shared/constants/order.js';
import { fenToYuan } from '@shared/utils/money.js';

vi.mock('../services/order.js', () => ({
  createTipOrder: vi.fn(),
}));

const VISITOR_KEY = 'ai-guide:visitor-id';
const VISITOR_ID = 'visitor-12345678';
const AMOUNT_LABELS = TIP_AMOUNT_CENTS.map((cents) => `${fenToYuan(cents)} 元`);

const tipResult = {
  orderNo: 'TIP-123456',
  amountCents: 500,
  status: 'submitted',
  wechatId: '15306507997',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/tips/new?contentCode=content-1']}>
      <Routes>
        <Route path="/tips/new" element={<TipPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function submitValidTip(user) {
  await user.click(screen.getByRole('radio', { name: '5 元' }));
  await user.click(screen.getByRole('button', { name: '提交打赏' }));
}

describe('TipPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem(VISITOR_KEY, VISITOR_ID);
  });

  it('展示全部预设金额档位，并按元展示', () => {
    renderPage();

    expect(screen.getAllByRole('radio')).toHaveLength(TIP_AMOUNT_CENTS.length);
    AMOUNT_LABELS.forEach((label) => {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    });
  });

  it('联系方式可选：未填写联系方式也能提交，并按分提交金额与关联内容、携带访客标识', async () => {
    createTipOrder.mockResolvedValue(tipResult);
    const user = userEvent.setup();
    renderPage();

    await submitValidTip(user);

    expect(await screen.findByText(/TIP-123456/)).toBeInTheDocument();
    expect(createTipOrder).toHaveBeenCalledWith(expect.objectContaining({
      visitorId: VISITOR_ID,
      contentCode: 'content-1',
      amount: 500,
    }));
  });

  it('提交后展示管理员微信号与「备注订单号完成支付」提示', async () => {
    createTipOrder.mockResolvedValue(tipResult);
    const user = userEvent.setup();
    renderPage();

    await submitValidTip(user);

    expect(await screen.findByText(/15306507997/)).toBeInTheDocument();
    expect(screen.getByText(/备注订单号完成支付/)).toBeInTheDocument();
    expect(screen.getByText(/TIP-123456/)).toBeInTheDocument();
  });

  it('联系方式填写但格式非法时提示校验错误，不提交订单', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole('textbox', { name: '联系人（选填）' }), '张三');
    await user.type(screen.getByRole('textbox', { name: '联系方式（选填）' }), 'abc');
    await submitValidTip(user);

    expect(await screen.findByText('请填写正确的手机号或微信')).toBeInTheDocument();
    expect(createTipOrder).not.toHaveBeenCalled();
  });
});
