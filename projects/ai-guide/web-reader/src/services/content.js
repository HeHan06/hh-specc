/**
 * 阅读站内容 service 层：注入平台 request 适配器并复用 shared API 客户端。
 * 页面只依赖本层，禁止直接 import fetch 或私写请求逻辑。
 *
 * @capability Req-1 阅读站内容服务编排
 * @capability Req-2 阅读站内容搜索
 * @capability Req-3 阅读站内容详情
 * @capability Req-4 阅读站内容点赞
 * @capabilityPoint T-18 阅读站目录 service
 * @capabilityPoint T-20 阅读站详情/搜索/点赞 service
 */

import request from '../platform/request.js';
import {
  getCategories as fetchCategories,
  getContentsByCategory as fetchContentsByCategory,
  getContentDetail as fetchContentDetail,
  getLatestContents as fetchLatestContents,
  getRecommendedContents as fetchRecommendedContents,
  getTopics as fetchTopics,
  likeContent as fetchLikeContent,
  searchContents as fetchSearchContents,
} from '@shared/api/content.js';

const DEFAULT_PAGE = Object.freeze({ pageNum: 1, pageSize: 20 });

/** 查询阅读站可见主题目录。 */
export function getTopics() {
  return fetchTopics(request);
}

/** 查询某主题下可见专题。 */
export function getCategories(topicCode) {
  return fetchCategories(request, topicCode);
}

/** 分页查询某专题下已发布内容。 */
export function getContentsByCategory(params) {
  return fetchContentsByCategory(request, params);
}

/** 分页查询最新已发布内容。 */
export function getLatestContents(params = DEFAULT_PAGE) {
  return fetchLatestContents(request, params);
}

/** 分页查询推荐已发布内容。 */
export function getRecommendedContents(params = DEFAULT_PAGE) {
  return fetchRecommendedContents(request, params);
}

/** 分页搜索已发布内容（标题/摘要/标签）。 */
export function searchContents(params) {
  return fetchSearchContents(request, params);
}

/** 获取已发布内容详情；可携带匿名访客标识用于返回 liked 状态。 */
export function getContentDetail(contentCode, options = {}) {
  return fetchContentDetail(request, contentCode, options);
}

/** 对已发布内容点赞；幂等由后端保证，页面负责重复点击仅忽略。 */
export function likeContent(contentCode, visitorId) {
  return fetchLikeContent(request, contentCode, visitorId);
}
