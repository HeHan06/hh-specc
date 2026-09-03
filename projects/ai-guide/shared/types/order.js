/**
 * 订单域共享类型定义。
 * 仅承载 JSDoc 类型，供双端与 shared 客户端共享订单结构约束。
 *
 * @capability Req-5 打赏订单共享类型
 * @capability Req-6 付费咨询订单共享类型
 * @capabilityPoint T-06 定义打赏/咨询订单视图类型
 */

/**
 * @typedef {'submitted'|'received'|'closed'} TipOrderStatus
 * 打赏订单状态：已提交、已收款、已关闭。
 */

/**
 * @typedef {'submitted'|'confirmed'|'completed'|'canceled'} ConsultationOrderStatus
 * 咨询订单状态：已提交、已确认、已完成、已取消。
 */

/**
 * @typedef {Object} TipOrderView
 * @property {string} orderNo 不可猜测的订单号
 * @property {string|null} contentCode 关联内容编码，可空
 * @property {number} amountCents 打赏金额（分）
 * @property {TipOrderStatus} status 订单状态
 * @property {string} wechatId 管理员微信号
 * @property {string|null} receivedAt 收款时间
 */

/**
 * @typedef {Object} ConsultationOrderView
 * @property {string} orderNo 不可猜测的订单号
 * @property {number} priceCents 咨询价格（分），最终是否免费由确认排期时判定
 * @property {boolean} freeQuotaUsed 是否占用免费名额
 * @property {ConsultationOrderStatus} status 订单状态
 * @property {string} wechatId 管理员微信号
 * @property {string|null} confirmedAt 确认排期时间
 */

export {};
