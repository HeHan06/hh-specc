/**
 * 后台广告位管理 service 层：注入平台 request 适配器并复用 shared 管理 API 客户端。
 * 页面只依赖本层，禁止直接 import fetch 或私写请求逻辑。
 *
 * @orchestrate getAdvertisement/updateAdvertisement
 */
import request from '../platform/request.js';
import {
  getAdvertisement as fetchGetAdvertisement,
  updateAdvertisement as fetchUpdateAdvertisement,
} from '@shared/api/admin.js';

/** 查询当前广告位（未配置时返回 null）。 */
export function getAdvertisement() {
  return fetchGetAdvertisement(request);
}

/** 保存广告位（单槽位，UPSERT）。 */
export function updateAdvertisement(body) {
  return fetchUpdateAdvertisement(request, body);
}
