/**
 * 平台无关 API 客户端基座。
 * 请求适配器由各端注入，本层只约定统一响应体并解包 data；
 * 不直接依赖 fetch/DOM，满足 shared 纯逻辑约束。
 *
 * @capability Req-12 统一响应解包
 * @capabilityPoint T-06 实现注入 request 的统一客户端基座
 */

/**
 * 创建 API 客户端。
 * @param {Function} request 平台注入的请求适配器，签名 (options) => Promise<envelope>
 * @returns {{get: Function, post: Function, put: Function}}
 */
export function createApiClient(request) {
  if (typeof request !== 'function') {
    throw new TypeError('request 必须是由平台注入的函数');
  }

  return {
    get: (path, options = {}) => execute(request, 'GET', path, options),
    post: (path, options = {}) => execute(request, 'POST', path, options),
    put: (path, options = {}) => execute(request, 'PUT', path, options),
  };
}

async function execute(request, method, path, options) {
  const envelope = await request({ method, path, ...options });

  if (!envelope || typeof envelope !== 'object') {
    throw new Error('接口返回了非法响应体');
  }

  if (envelope.code !== 0) {
    const error = new Error(envelope.message || '业务处理失败');
    error.code = envelope.code;
    throw error;
  }

  return envelope.data;
}

export default createApiClient;
