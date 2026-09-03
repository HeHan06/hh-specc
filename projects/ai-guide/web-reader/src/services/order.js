/**
 * 阅读站订单 service 层：注入平台 request 适配器并复用 shared 订单 API 客户端。
 * 页面只依赖本层，禁止直接 import fetch 或私写请求逻辑。
 *
 * @capability Req-5 打赏订单服务编排
 * @capability Req-6 付费咨询订单服务编排
 * @capability Req-7 订单状态查询服务编排
 * @capability Req-12 统一请求适配器
 * @capabilityPoint T-22 打赏/咨询/订单状态 service
 */

import request from '../platform/request.js';
import {
  createConsultationOrder as fetchCreateConsultationOrder,
  createTipOrder as fetchCreateTipOrder,
  getConsultationOrder as fetchGetConsultationOrder,
  getTipOrder as fetchGetTipOrder,
} from '@shared/api/order.js';

/** 创建打赏留资单；visitorId 作为请求头，其余字段作为请求体。 */
export function createTipOrder(payload) {
  return fetchCreateTipOrder(request, payload);
}

/** 查询打赏留资单状态与管理员微信号。 */
export function getTipOrder(orderNo) {
  return fetchGetTipOrder(request, orderNo);
}

/** 创建付费咨询订单。 */
export function createConsultationOrder(form) {
  return fetchCreateConsultationOrder(request, form);
}

/** 查询付费咨询订单状态与管理员微信号。 */
export function getConsultationOrder(orderNo) {
  return fetchGetConsultationOrder(request, orderNo);
}
