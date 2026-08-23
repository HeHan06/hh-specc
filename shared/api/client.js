// 共享层不依赖 DOM、fetch 或 wx.request；由各端注入 request 适配器，再由基座统一解包。
export function createApiClient(request) {
  if (typeof request !== 'function') {
    throw new TypeError('request 必须是函数适配器');
  }

  function unwrapResponse(response) {
    if (response === null || typeof response !== 'object' || Array.isArray(response)) {
      throw new Error('接口响应格式非法');
    }

    const { code, message, data } = response;
    if (code !== 0) {
      const error = new Error(message || `业务错误码：${code}`);
      error.code = code;
      error.data = data;
      throw error;
    }

    return data;
  }

  return {
    async get(path, options = {}) {
      const response = await request({ ...options, method: 'GET', path });
      return unwrapResponse(response);
    },
  };
}

export default createApiClient;
