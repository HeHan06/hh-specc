/**
 * 付费咨询页测试：必填与格式校验、提交参数、500 元/半小时展示、
 * 提交后展示管理员微信号与「备注订单号完成支付」提示。
 *
 * @capability Req-6 付费咨询
 * @capability Req-12 输入校验与错误反馈
 * @capabilityPoint T-21 咨询必填/格式校验与提交成功提示红测
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ConsultationPage from './ConsultationPage.jsx';
import { createConsultationOrder } from '../services/order.js';

vi.mock('../services/order.js', () => ({
  createConsultationOrder: vi.fn(),
}));

const consultationResult = {
  orderNo: 'CON-123456',
  priceCents: 50000,
  status: 'submitted',
  wechatId: '15306507997',
};

const validForm = {
  contactName: '张三',
  contactType: 'phone',
  contactValue: '13800138000',
  topicText: 'Agent 架构',
  requestText: '想咨询多 Agent 协作设计',
  expectedTime: '2099-01-01T00:00:00.000Z',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/consultation/new']}>
      <Routes>
        <Route path="/consultation/new" element={<ConsultationPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillValidForm(user) {
  await user.type(screen.getByRole('textbox', { name: '联系人' }), validForm.contactName);
  await user.click(screen.getByRole('radio', { name: '手机' }));
  await user.type(screen.getByRole('textbox', { name: '联系方式' }), validForm.contactValue);
  await user.type(screen.getByRole('textbox', { name: '咨询主题' }), validForm.topicText);
  await user.type(screen.getByRole('textbox', { name: '咨询诉求' }), validForm.requestText);
  await user.type(screen.getByRole('textbox', { name: '期望时间' }), validForm.expectedTime);
  await user.click(screen.getByRole('button', { name: '提交咨询' }));
}

describe('ConsultationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('展示 500 元/半小时计价', () => {
    renderPage();

    expect(screen.getByText(/500\s*元\s*\/\s*半小时/)).toBeInTheDocument();
  });

  it('必填项缺失或联系方式格式非法时不提交，并给出校验提示', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole('textbox', { name: '联系人' }), '张三');
    await user.click(screen.getByRole('radio', { name: '手机' }));
    await user.type(screen.getByRole('textbox', { name: '联系方式' }), 'abc');
    await user.click(screen.getByRole('button', { name: '提交咨询' }));

    expect(await screen.findByText('请填写正确的手机号或微信')).toBeInTheDocument();
    expect(screen.getByText('请填写咨询主题（1-200 个字符）')).toBeInTheDocument();
    expect(screen.getByText('请填写咨询诉求（1-2000 个字符）')).toBeInTheDocument();
    expect(screen.getByText('请选择晚于当前时间的期望时间')).toBeInTheDocument();
    expect(createConsultationOrder).not.toHaveBeenCalled();
  });

  it('合法表单提交后按契约参数创建订单，并展示管理员微信号与备注订单号提示', async () => {
    createConsultationOrder.mockResolvedValue(consultationResult);
    const user = userEvent.setup();
    renderPage();

    await fillValidForm(user);

    expect(await screen.findByText(/CON-123456/)).toBeInTheDocument();
    expect(screen.getByText(/15306507997/)).toBeInTheDocument();
    expect(screen.getByText(/备注订单号完成支付/)).toBeInTheDocument();
    expect(createConsultationOrder).toHaveBeenCalledWith(expect.objectContaining({
      contactName: validForm.contactName,
      contactType: validForm.contactType,
      contactValue: validForm.contactValue,
      topicText: validForm.topicText,
      requestText: validForm.requestText,
      expectedTime: validForm.expectedTime,
    }));
  });
});
