/**
 * 匿名访客标识工具：UUID v4 生成、localStorage 持久化与读取。
 * 阅读站不采集用户级浏览行为，仅用不可关联身份的随机标识做点赞幂等与 liked 状态计算。
 *
 * @capability Req-4 内容点赞
 * @capabilityPoint T-20 访客标识生成与持久化
 */

const VISITOR_ID_KEY = 'ai-guide:visitor-id';

/**
 * 生成 RFC 4122 UUID v4。
 * 优先使用平台原生 randomUUID；不支持时回退到 crypto.getRandomValues；
 * 连 getRandomValues 也没有的环境再用 Math.random 兜底（仅开发/极老环境）。
 * @returns {string}
 */
function generateUuidV4() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * 返回当前访客标识；不存在时生成 UUID v4 并写入 localStorage。
 * 同一浏览器同一存储域内保持稳定，更换设备或清空存储后无法关联回原访客。
 * @returns {string}
 */
export function getVisitorId() {
  const existing = window.localStorage.getItem(VISITOR_ID_KEY);
  if (existing) {
    return existing;
  }

  const visitorId = generateUuidV4();
  window.localStorage.setItem(VISITOR_ID_KEY, visitorId);
  return visitorId;
}

export { VISITOR_ID_KEY };
