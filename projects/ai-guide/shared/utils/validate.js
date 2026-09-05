/**
 * 共享输入校验规则：联系方式、搜索词、分页。
 * 规则与 contracts/*.yaml 的字段 validate 对齐，双端复用同一份校验逻辑。
 *
 * @capability Req-12 输入校验
 * @capabilityPoint T-06 实现共享输入校验规则
 */

const PHONE_PATTERN = /^1[3-9]\d{9}$/;
const WECHAT_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{5,19}$/;

/**
 * 校验大陆手机号。
 * @param {unknown} value 待校验值
 * @returns {boolean}
 */
export function isValidPhone(value) {
  return typeof value === 'string' && PHONE_PATTERN.test(value);
}

/**
 * 校验微信号：6-20 位，字母开头，可含字母/数字/下划线/短横线。
 * @param {unknown} value 待校验值
 * @returns {boolean}
 */
export function isValidWechat(value) {
  return typeof value === 'string' && WECHAT_PATTERN.test(value);
}

/**
 * 按联系类型分派校验，类型不在 phone/wechat 时视为非法。
 * @param {unknown} value 联系方式
 * @param {unknown} type 联系类型
 * @returns {boolean}
 */
export function isValidContactValue(value, type) {
  if (type === 'phone') return isValidPhone(value);
  if (type === 'wechat') return isValidWechat(value);
  return false;
}

/**
 * 校验搜索词 trim 后长度 1-50。
 * @param {unknown} value 搜索词
 * @returns {boolean}
 */
export function isValidSearchKeyword(value) {
  if (typeof value !== 'string') return false;
  const keyword = value.trim();
  return keyword.length >= 1 && keyword.length <= 50;
}

/**
 * 页码必须为大于等于 1 的整数。
 * @param {unknown} value 页码
 * @returns {boolean}
 */
export function isValidPageNum(value) {
  return Number.isInteger(value) && value >= 1;
}

/**
 * 每页条数必须为 1-100 的整数。
 * @param {unknown} value 每页条数
 * @returns {boolean}
 */
export function isValidPageSize(value) {
  return Number.isInteger(value) && value >= 1 && value <= 100;
}
