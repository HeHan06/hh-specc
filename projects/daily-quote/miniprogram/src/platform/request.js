import Taro from '@tarojs/taro';

// 后端服务地址由构建环境注入；仅作为请求前缀，不承载任何密钥或凭证。
const API_BASE_URL = process.env.TARO_APP_API_BASE_URL || '';

function buildApiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

// 微信特有请求能力统一封装在这里，页面不裸调 wx.*。
// 只负责发请求并返回统一响应体，业务解包交给 shared/api/client.js。
export function wxRequestAdapter({ path, method }) {
  return new Promise((resolve, reject) => {
    Taro.request({
      url: buildApiUrl(path),
      method,
      header: { Accept: 'application/json' },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(new Error(`请求失败：${res.statusCode}`));
        }
      },
      fail: (err) => {
        reject(err);
      },
    });
  });
}

export default wxRequestAdapter;
