/**
 * 阅读站广告位 API 客户端。有启用广告时返回视图，未配置时后端返回 null。
 *
 * @capabilityPoint T-06 实现广告位 API 路径与参数封装
 */

import createApiClient from './client.js';

export function getAdvertisement(request) {
  return createApiClient(request).get('/api/advertisement');
}
