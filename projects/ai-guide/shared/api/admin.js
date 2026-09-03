/**
 * 管理后台 API 客户端统一封装。
 * 路径与 contracts/admin.yaml 对齐；鉴权头由平台请求适配器统一注入。
 *
 * @capability Req-12 管理后台 API 客户端统一封装
 * @capabilityPoint T-06 实现后台 API 路径与参数封装
 */

import createApiClient from './client.js';

const BASE = '/api/admin';

export function login(request, body) {
  return createApiClient(request).post(`${BASE}/auth/login`, { body });
}

export function getMe(request) {
  return createApiClient(request).get(`${BASE}/me`);
}

export function listTopics(request, query) {
  return createApiClient(request).get(`${BASE}/topics`, { query });
}

export function createTopic(request, body) {
  return createApiClient(request).post(`${BASE}/topics`, { body });
}

export function updateTopic(request, topicCode, body) {
  return createApiClient(request).put(`${BASE}/topics/${topicCode}`, { body });
}

export function listCategories(request, query) {
  return createApiClient(request).get(`${BASE}/categories`, { query });
}

export function createCategory(request, body) {
  return createApiClient(request).post(`${BASE}/categories`, { body });
}

export function updateCategory(request, categoryCode, body) {
  return createApiClient(request).put(`${BASE}/categories/${categoryCode}`, { body });
}

export function listContents(request, query) {
  return createApiClient(request).get(`${BASE}/contents`, { query });
}

export function createContent(request, body) {
  return createApiClient(request).post(`${BASE}/contents`, { body });
}

export function getContent(request, contentCode) {
  return createApiClient(request).get(`${BASE}/contents/${contentCode}`);
}

export function updateContent(request, contentCode, body) {
  return createApiClient(request).put(`${BASE}/contents/${contentCode}`, { body });
}

export function publishContent(request, contentCode, body) {
  return createApiClient(request).post(`${BASE}/contents/${contentCode}/publish`, { body });
}

export function unpublishContent(request, contentCode, body) {
  return createApiClient(request).post(`${BASE}/contents/${contentCode}/unpublish`, { body });
}

export function restoreContent(request, contentCode, body) {
  return createApiClient(request).post(`${BASE}/contents/${contentCode}/restore`, { body });
}

export function archiveContent(request, contentCode, body) {
  return createApiClient(request).post(`${BASE}/contents/${contentCode}/archive`, { body });
}

export function listTips(request, query) {
  return createApiClient(request).get(`${BASE}/tips`, { query });
}

export function getTip(request, orderNo) {
  return createApiClient(request).get(`${BASE}/tips/${orderNo}`);
}

export function receiveTip(request, orderNo) {
  return createApiClient(request).post(`${BASE}/tips/${orderNo}/receive`);
}

export function closeTip(request, orderNo) {
  return createApiClient(request).post(`${BASE}/tips/${orderNo}/close`);
}

export function listConsultations(request, query) {
  return createApiClient(request).get(`${BASE}/consultations`, { query });
}

export function getConsultation(request, orderNo) {
  return createApiClient(request).get(`${BASE}/consultations/${orderNo}`);
}

export function confirmConsultation(request, orderNo, body) {
  return createApiClient(request).post(`${BASE}/consultations/${orderNo}/confirm`, { body });
}

export function completeConsultation(request, orderNo, body) {
  return createApiClient(request).post(`${BASE}/consultations/${orderNo}/complete`, { body });
}

export function cancelConsultation(request, orderNo, body) {
  return createApiClient(request).post(`${BASE}/consultations/${orderNo}/cancel`, { body });
}

export function updateConsultationNote(request, orderNo, body) {
  return createApiClient(request).post(`${BASE}/consultations/${orderNo}/note`, { body });
}

export function listOperationLogs(request, query) {
  return createApiClient(request).get(`${BASE}/operation-logs`, { query });
}
