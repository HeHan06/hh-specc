/**
 * 阅读站广告位 service 层：注入平台 request 适配器并复用 shared 广告 API 客户端。
 * 页面只依赖本层，禁止直接 import fetch 或私写请求逻辑。
 *
 * @orchestrate getAdvertisement
 */
import request from '../platform/request.js';
import { getAdvertisement as fetchGetAdvertisement } from '@shared/api/advertisement.js';

/** 查询阅读站可见广告位；未配置或未启用时返回 null。 */
export function getAdvertisement() {
  return fetchGetAdvertisement(request);
}
