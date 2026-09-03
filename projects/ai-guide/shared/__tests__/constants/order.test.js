/**
 * @capability Req-5 打赏订单共享常量
 * @capability Req-6 付费咨询订单共享常量
 * @capabilityPoint T-05 校验订单金额档位与状态常量
 */
import { describe, expect, it } from 'vitest';
import {
  TIP_AMOUNT_CENTS,
  CONSULTATION_PRICE_CENTS,
  FREE_CONSULTATION_QUOTA_LIMIT,
  TIP_ORDER_STATUS,
  CONSULTATION_ORDER_STATUS,
  TIP_ORDER_STATUS_TEXT,
  CONSULTATION_ORDER_STATUS_TEXT,
} from '../../constants/order.js';

describe('订单金额常量', () => {
  it('打赏金额档位固定为 10/100/500/1000/5000/10000 分', () => {
    expect(TIP_AMOUNT_CENTS).toEqual([10, 100, 500, 1000, 5000, 10000]);
  });

  it('付费咨询计价为 500 元/半小时，即 50000 分', () => {
    expect(CONSULTATION_PRICE_CENTS).toBe(50000);
  });

  it('免费咨询名额上限为 10', () => {
    expect(FREE_CONSULTATION_QUOTA_LIMIT).toBe(10);
  });
});

describe('订单状态常量', () => {
  it('打赏订单状态与数据模型一致', () => {
    expect(TIP_ORDER_STATUS.SUBMITTED).toBe('submitted');
    expect(TIP_ORDER_STATUS.RECEIVED).toBe('received');
    expect(TIP_ORDER_STATUS.CLOSED).toBe('closed');
  });

  it('咨询订单状态与数据模型一致', () => {
    expect(CONSULTATION_ORDER_STATUS.SUBMITTED).toBe('submitted');
    expect(CONSULTATION_ORDER_STATUS.CONFIRMED).toBe('confirmed');
    expect(CONSULTATION_ORDER_STATUS.COMPLETED).toBe('completed');
    expect(CONSULTATION_ORDER_STATUS.CANCELED).toBe('canceled');
  });

  it('订单状态文案可被前端直接展示', () => {
    expect(TIP_ORDER_STATUS_TEXT.submitted).toBe('已提交');
    expect(TIP_ORDER_STATUS_TEXT.received).toBe('已收款');
    expect(TIP_ORDER_STATUS_TEXT.closed).toBe('已关闭');
    expect(CONSULTATION_ORDER_STATUS_TEXT.submitted).toBe('已提交');
    expect(CONSULTATION_ORDER_STATUS_TEXT.confirmed).toBe('已确认');
    expect(CONSULTATION_ORDER_STATUS_TEXT.completed).toBe('已完成');
    expect(CONSULTATION_ORDER_STATUS_TEXT.canceled).toBe('已取消');
  });
});
