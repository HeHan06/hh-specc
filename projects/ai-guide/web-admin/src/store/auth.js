/**
 * 管理后台登录态存取。
 * Token 只从浏览器本地存储读取，不硬编码任何账号或令牌；
 * 请求适配器通过 getAuthHeaders 统一注入 Bearer 头。
 *
 * @capability Req-8 管理后台登录
 * @capability Req-12 统一登录态与鉴权头
 * @capabilityPoint T-24 后台鉴权状态存取
 */

const SESSION_STORAGE_KEY = 'ai-guide-admin-session';

/**
 * 判断当前环境是否可用浏览器存储，避免 SSR/测试环境直接访问 window 报错。
 * @returns {Storage|null}
 */
function getStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * 保存当前管理员会话。
 * @param {{token: string, username: string, role: string}} session 登录接口返回的会话数据
 */
export function saveSession(session) {
  const storage = getStorage();
  if (!storage || !session || typeof session !== 'object') {
    return;
  }

  try {
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // 存储被禁用时保持内存态为空，接口层按未登录处理，不静默伪造登录态。
  }
}

/**
 * 读取当前管理员会话；数据缺失或非法时返回 null。
 * @returns {{token: string, username: string, role: string}|null}
 */
export function getSession() {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const session = JSON.parse(raw);
    if (!session || typeof session.token !== 'string' || session.token.length === 0) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/** 读取当前 Token，未登录时返回 null。 */
export function getToken() {
  return getSession()?.token ?? null;
}

/**
 * 生成后台请求所需的统一鉴权头。
 * 未登录时返回空对象，由后端统一返回 1001 未登录错误码。
 * @returns {{Authorization?: string}}
 */
export function getAuthHeaders() {
  const token = getToken();
  if (!token) {
    return {};
  }

  return { Authorization: `Bearer ${token}` };
}

/** 清除本地登录态。 */
export function clearSession() {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // 移除失败时也不抛出，调用方随后会按未登录处理。
  }
}
