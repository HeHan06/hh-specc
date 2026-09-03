/**
 * Web 阅读站唯一 fetch 入口。
 * 只负责把 shared API 客户端的 options 翻译为 HTTP 请求并返回统一响应体；
 * 业务失败统一由 shared/api/client.js 按 code 抛出，这里不静默吞错。
 *
 * @capability Req-12 前端统一请求适配器
 * @capabilityPoint T-18 阅读站请求适配器
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * 把查询参数序列化为 URL query；跳过空值，避免把 undefined 拼进地址。
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
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('网络异常，请稍后重试');
  }

  let envelope;
  try {
    envelope = await response.json();
  } catch {
    throw new Error('服务响应异常，请稍后重试');
  }

  // 传输层失败时仍优先把统一响应体交给 shared client 按 code 处理；
  // 只有响应不是统一包裹结构时才按传输错误抛出，避免静默吞错。
  if (!response.ok && (!envelope || typeof envelope.code !== 'number')) {
    const error = new Error('服务响应异常，请稍后重试');
    error.status = response.status;
    throw error;
  }

  return envelope;
}
