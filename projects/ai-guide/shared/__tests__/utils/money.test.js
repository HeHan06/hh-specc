/**
 * @capability Req-5 打赏订单金额换算
 * @capability Req-6 付费咨询金额换算
 * @capabilityPoint T-05 校验金额分/元换算
 */
import { describe, expect, it } from 'vitest';
import { fenToYuan, yuanToFen } from '../../utils/money.js';

describe('yuanToFen', () => {
  it('500 元换算为 50000 分', () => {
    expect(yuanToFen(500)).toBe(50000);
  });

  it('0.1 元换算为 10 分，且不产生浮点误差', () => {
    expect(yuanToFen(0.1)).toBe(10);
  });

  it('整数元与零元均正确换算', () => {
    expect(yuanToFen(5)).toBe(500);
    expect(yuanToFen(0)).toBe(0);
  });
});

describe('fenToYuan', () => {
  it('50000 分换算为 500 元', () => {
    expect(fenToYuan(50000)).toBeCloseTo(500);
  });

  it('10 分换算为 0.1 元', () => {
    expect(fenToYuan(10)).toBeCloseTo(0.1);
  });

  it('0 分换算为 0 元', () => {
    expect(fenToYuan(0)).toBe(0);
  });
});
