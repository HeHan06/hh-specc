/**
 * 后台操作日志 service 层：注入平台 request 适配器并复用 shared 管理 API 客户端。
 * 页面只依赖本层，禁止直接 import fetch 或私写请求逻辑。
 *
 * @capability Req-11 敏感操作留痕查询
 * @capability Req-12 统一错误处理与三态
 * @capabilityPoint T-28 后台操作日志 service
 * @orchestrate listOperationLogs
 */
import request from '../platform/request.js';
import { listOperationLogs as fetchListOperationLogs } from '@shared/api/admin.js';

/** 分页查询敏感操作日志。 */
export function listOperationLogs(query) {
  return fetchListOperationLogs(request, query);
}
