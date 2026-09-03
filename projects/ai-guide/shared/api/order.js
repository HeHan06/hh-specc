/**
 * 打赏与咨询订单 API 客户端。
 * 路径与 contracts/tip.yaml、contracts/consultation.yaml 对齐。
 *
 * @capability Req-5 打赏订单 API 客户端
 * @capability Req-6 付费咨询订单 API 客户端
 * @capabilityPoint T-06 实现订单 API 路径与参数封装
 */

import createApiClient from './client.js';

export function createTipOrder(request, payload) {
  const { visitorId, ...body } = payload;
  return createApiClient(request).post('/api/tips', {
    headers: visitorId ? { 'X-Visitor-Id': visitorId } : undefined,
    body,
  });
}

export function getTipOrder(request, orderNo) {
  return createApiClient(request).get(`/api/tips/${orderNo}`);
}

export function createConsultationOrder(request, body) {
  return createApiClient(request).post('/api/consultations', { body });
}

export function getConsultationOrder(request, orderNo) {
  return createApiClient(request).get(`/api/consultations/${orderNo}`);
}
