/**
 * 阅读站内容/目录/搜索/点赞 API 客户端。
 * 路径与 contracts/content.yaml 对齐，双端统一从这里调用，禁止私写请求逻辑。
 *
 * @capability Req-1 阅读站内容 API 客户端
 * @capabilityPoint T-06 实现内容 API 路径与参数封装
 */

import createApiClient from './client.js';

export function getTopics(request) {
  return createApiClient(request).get('/api/topics');
}

export function getCategories(request, topicCode) {
  return createApiClient(request).get('/api/categories', { query: { topicCode } });
}

export function getContentsByCategory(request, params) {
  return createApiClient(request).get('/api/contents', {
    query: {
      categoryCode: params.categoryCode,
      pageNum: params.pageNum,
      pageSize: params.pageSize,
    },
  });
}

export function getLatestContents(request, params) {
  return createApiClient(request).get('/api/contents/latest', {
    query: { pageNum: params.pageNum, pageSize: params.pageSize },
  });
}

export function getRecommendedContents(request, params) {
  return createApiClient(request).get('/api/contents/recommended', {
    query: { pageNum: params.pageNum, pageSize: params.pageSize },
  });
}

export function searchContents(request, params) {
  return createApiClient(request).get('/api/contents/search', {
    query: { keyword: params.keyword, pageNum: params.pageNum, pageSize: params.pageSize },
  });
}

export function getContentDetail(request, contentCode, options = {}) {
  const config = {};
  if (options.visitorId) {
    config.headers = { 'X-Visitor-Id': options.visitorId };
  }
  return createApiClient(request).get(`/api/contents/${contentCode}`, config);
}

export function likeContent(request, contentCode, visitorId) {
  return createApiClient(request).post(`/api/contents/${contentCode}/likes`, {
    headers: { 'X-Visitor-Id': visitorId },
  });
}
