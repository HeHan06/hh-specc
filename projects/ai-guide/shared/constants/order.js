/**
 * 打赏与咨询订单的金额档位、计价常量与状态枚举。
 * 金额单位统一为「分」；文案供双端直接展示。
 *
 * @capability Req-5 打赏订单共享常量
 * @capability Req-6 付费咨询订单共享常量
 * @capabilityPoint T-06 实现订单金额档位与状态常量
 */

export const TIP_AMOUNT_CENTS = Object.freeze([10, 100, 500, 1000, 5000, 10000]);
export const CONSULTATION_PRICE_CENTS = 50000;
export const FREE_CONSULTATION_QUOTA_LIMIT = 10;

export const TIP_ORDER_STATUS = Object.freeze({
  SUBMITTED: 'submitted',
  RECEIVED: 'received',
  CLOSED: 'closed',
});

export const CONSULTATION_ORDER_STATUS = Object.freeze({
  SUBMITTED: 'submitted',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
});

export const TIP_ORDER_STATUS_TEXT = Object.freeze({
  submitted: '已提交',
  received: '已收款',
  closed: '已关闭',
});

export const CONSULTATION_ORDER_STATUS_TEXT = Object.freeze({
  submitted: '已提交',
  confirmed: '已确认',
  completed: '已完成',
  canceled: '已取消',
});
