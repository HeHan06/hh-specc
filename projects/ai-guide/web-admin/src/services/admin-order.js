/**
 * 后台订单管理 service 层：注入平台 request 适配器并复用 shared 管理 API 客户端。
 * 页面只依赖本层，禁止直接 import fetch 或私写请求逻辑。
 *
 * @capability Req-7 打赏/咨询订单后台状态流转
 * @capability Req-11 打赏/咨询订单管理
 * @capability Req-12 统一订单错误处理
 * @capabilityPoint T-28 后台订单管理 service
 * @orchestrate listTips/getTip/receiveTip/closeTip/listConsultations/getConsultation/confirmConsultation/completeConsultation/cancelConsultation/updateConsultationNote
 */
import request from '../platform/request.js';
import {
  cancelConsultation as fetchCancelConsultation,
  closeTip as fetchCloseTip,
  completeConsultation as fetchCompleteConsultation,
  confirmConsultation as fetchConfirmConsultation,
  getConsultation as fetchGetConsultation,
  getTip as fetchGetTip,
  listConsultations as fetchListConsultations,
  listTips as fetchListTips,
  receiveTip as fetchReceiveTip,
  updateConsultationNote as fetchUpdateConsultationNote,
} from '@shared/api/admin.js';

/** 分页查询打赏订单。 */
export function listTips(query) {
  return fetchListTips(request, query);
}

/** 获取打赏订单详情。 */
export function getTip(orderNo) {
  return fetchGetTip(request, orderNo);
}

/** 确认打赏已线下收款（敏感操作）。 */
export function receiveTip(orderNo) {
  return fetchReceiveTip(request, orderNo);
}

/** 关闭打赏留资单（敏感操作）。 */
export function closeTip(orderNo) {
  return fetchCloseTip(request, orderNo);
}

/** 分页查询咨询订单。 */
export function listConsultations(query) {
  return fetchListConsultations(request, query);
}

/** 获取咨询订单详情。 */
export function getConsultation(orderNo) {
  return fetchGetConsultation(request, orderNo);
}

/** 确认咨询排期并占用免费名额。 */
export function confirmConsultation(orderNo, body) {
  return fetchConfirmConsultation(request, orderNo, body);
}

/** 标记咨询完成。 */
export function completeConsultation(orderNo, body) {
  return fetchCompleteConsultation(request, orderNo, body);
}

/** 取消咨询订单（敏感操作，必须携带取消原因）。 */
export function cancelConsultation(orderNo, body) {
  return fetchCancelConsultation(request, orderNo, body);
}

/** 更新咨询订单管理员备注。 */
export function updateConsultationNote(orderNo, body) {
  return fetchUpdateConsultationNote(request, orderNo, body);
}
