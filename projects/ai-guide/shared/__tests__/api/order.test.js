/**
 * @capability Req-5 打赏订单 API 客户端
 * @capability Req-6 付费咨询订单 API 客户端
 * @capabilityPoint T-05 校验订单 API 路径与解包
 */
import { describe, expect, it, vi } from 'vitest';
import {
  createTipOrder,
  getTipOrder,
  createConsultationOrder,
  getConsultationOrder,
} from '../../api/order.js';

function mockRequest(data = {}) {
  return vi.fn().mockResolvedValue({ code: 0, message: 'success', data });
}

describe('打赏订单 API', () => {
  it('createTipOrder 请求 POST /api/tips 并将 visitorId 放入请求头', async () => {
    const request = mockRequest({
      orderNo: 'T-1',
      amountCents: 100,
      status: 'submitted',
      wechatId: '15306507997',
    });

    const result = await createTipOrder(request, {
      visitorId: 'visitor-12345678',
      contentCode: 'content-1',
      amount: 100,
      message: '支持一下',
    });

    expect(result).toEqual({
      orderNo: 'T-1',
      amountCents: 100,
      status: 'submitted',
      wechatId: '15306507997',
    });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      path: '/api/tips',
      headers: { 'X-Visitor-Id': 'visitor-12345678' },
      body: { contentCode: 'content-1', amount: 100, message: '支持一下' },
    }));
  });

  it('getTipOrder 请求 GET /api/tips/{orderNo}', async () => {
    const request = mockRequest({ orderNo: 'T-1', status: 'received' });
    await getTipOrder(request, 'T-1');
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: '/api/tips/T-1',
    }));
  });
});

describe('咨询订单 API', () => {
  it('createConsultationOrder 请求 POST /api/consultations', async () => {
    const request = mockRequest({ orderNo: 'C-1', priceCents: 50000, status: 'submitted' });
    const body = {
      contactName: '张三',
      contactType: 'phone',
      contactValue: '13800138000',
      topicText: 'Agent 架构',
      requestText: '想咨询多 Agent 协作',
      expectedTime: '2026-09-01T00:00:00.000Z',
    };

    await createConsultationOrder(request, body);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      path: '/api/consultations',
      body,
    }));
  });

  it('getConsultationOrder 请求 GET /api/consultations/{orderNo}', async () => {
    const request = mockRequest({ orderNo: 'C-1', status: 'confirmed' });
    await getConsultationOrder(request, 'C-1');
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: '/api/consultations/C-1',
    }));
  });
});
