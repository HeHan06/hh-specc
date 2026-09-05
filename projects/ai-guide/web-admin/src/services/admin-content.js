/**
 * 后台内容与目录管理 service 层：注入平台 request 适配器并复用 shared 管理 API 客户端。
 * 页面只依赖本层，禁止直接 import fetch 或私写请求逻辑。
 *
 * @capability Req-9 后台内容与目录管理
 * @capability Req-10 发布前人工审核确认
 * @capabilityPoint T-26 后台内容/主题/专题 service
 * @orchestrate listContents/getContent/updateContent/publishContent
 */
import request from '../platform/request.js';
import {
  archiveContent as fetchArchiveContent,
  createCategory as fetchCreateCategory,
  createContent as fetchCreateContent,
  createTopic as fetchCreateTopic,
  getContent as fetchGetContent,
  listCategories as fetchListCategories,
  listContents as fetchListContents,
  listTopics as fetchListTopics,
  publishContent as fetchPublishContent,
  restoreContent as fetchRestoreContent,
  unpublishContent as fetchUnpublishContent,
  updateCategory as fetchUpdateCategory,
  updateContent as fetchUpdateContent,
  updateTopic as fetchUpdateTopic,
} from '@shared/api/admin.js';

/** 分页查询主题。 */
export function listTopics(query) {
  return fetchListTopics(request, query);
}

/** 创建主题。 */
export function createTopic(body) {
  return fetchCreateTopic(request, body);
}

/** 更新主题。 */
export function updateTopic(topicCode, body) {
  return fetchUpdateTopic(request, topicCode, body);
}

/** 分页查询专题。 */
export function listCategories(query) {
  return fetchListCategories(request, query);
}

/** 创建专题。 */
export function createCategory(body) {
  return fetchCreateCategory(request, body);
}

/** 更新专题。 */
export function updateCategory(categoryCode, body) {
  return fetchUpdateCategory(request, categoryCode, body);
}

/** 分页查询内容（含草稿、已下架、已归档）。 */
export function listContents(query) {
  return fetchListContents(request, query);
}

/** 创建内容草稿，返回服务端生成的内容编码与初始状态。 */
export function createContent(body) {
  return fetchCreateContent(request, body);
}

/** 获取内容管理详情（含 version，用于乐观锁）。 */
export function getContent(contentCode) {
  return fetchGetContent(request, contentCode);
}

/** 编辑内容，body 必须携带服务端当前 version，防止静默覆盖。 */
export function updateContent(contentCode, body) {
  return fetchUpdateContent(request, contentCode, body);
}

/** 发布内容，body 必须携带 reviewConfirmed=true。 */
export function publishContent(contentCode, body) {
  return fetchPublishContent(request, contentCode, body);
}

/** 下架内容。 */
export function unpublishContent(contentCode, body) {
  return fetchUnpublishContent(request, contentCode, body);
}

/** 恢复已下架内容为已发布，body 必须携带 reviewConfirmed=true。 */
export function restoreContent(contentCode, body) {
  return fetchRestoreContent(request, contentCode, body);
}

/** 归档内容（终态，不物理删除）。 */
export function archiveContent(contentCode, body) {
  return fetchArchiveContent(request, contentCode, body);
}
