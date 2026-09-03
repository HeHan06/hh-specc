/**
 * 金额换算工具：后端统一使用「分」整数，展示层再换算为「元」。
 * 用整数乘法/除法避免浮点精度问题。
 *
 * @capability Req-5 打赏订单金额换算
 * @capability Req-6 付费咨询金额换算
 * @capabilityPoint T-06 实现分/元双向换算
 */

/**
 * 元转分，返回整数。
 * @param {number} yuan 金额（元）
 * @returns {number} 金额（分）
 */
export function yuanToFen(yuan) {
  return Math.round(Number(yuan) * 100);
}

/**
 * 分转元。
 * @param {number} fen 金额（分）
 * @returns {number} 金额（元）
 */
export function fenToYuan(fen) {
  return Number(fen) / 100;
}
