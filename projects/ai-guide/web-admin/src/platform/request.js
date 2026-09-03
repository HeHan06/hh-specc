/**
 * Web 管理后台唯一 fetch 入口。
 * 将 shared API 客户端的 options 翻译为 HTTP 请求，并统一注入 Bearer 鉴权头；
 * 401/403 会清理本地登录态，业务失败仍交给 shared/api/client.js 按 code 抛出。
 *
 * @capability Req-12 前端统一请求适配器与错误拦截
 * @capabilityPoint T-24 后台请求适配器
 */
import { clearSession, getAuthHeaders } from '../store/auth.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * 序列化查询参数；跳过空值，避免把 undefined/null 拼进 URL。
 * @param {Record<string, unknown>} query
 * @returns {string}
 */
function serializeQuery(query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    params.append(key, String(value));
  });
  return params.toString();
}

/**
 * 平台注入的请求适配器，签名与 shared/api/client.js 约定一致。
 * @param {{method?: string, path: string, query?: object, headers?: object, body?: unknown}} options
 * @returns {Promise<{code:number, message:string, data:unknown}>} 统一响应体
 */
export default async function request({ method = 'GET', path, query, headers = {}, body } = {}) {
  if (!path) {
    throw new Error('请求路径不能为空');
  }

  const queryString = serializeQuery(query);
  const url = `${API_BASE_URL}${path}${queryString ? `?${queryString}` : ''}`;

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('网络异常，请稍后重试');
  }

  // 未登录/越权由后端拦截器返回传输层状态，前端统一清理登录态。
  if (response.status === 401 || response.status === 403) {
    clearSession();
  }

  let envelope;
  try {
    envelope = await response.json();
  } catch {
    const error = new Error('服务响应异常，请稍后重试');
    error.status = response.status;
    error.code = response.status === 401 ? 1001 : response.status === 403 ? 1002 : 1004;
    throw error;
  }

  // 传输层失败且不是统一响应体时，按统一错误码抛出，避免把后端原始异常直接展示给用户。
  if (!response.ok && (!envelope || typeof envelope.code !== 'number')) {
    const error = new Error('服务响应异常，请稍后重试');
    error.status = response.status;
    error.code = response.status === 401 ? 1001 : response.status === 403 ? 1002 : 1004;
    throw error;
  }

  return envelope;
}
