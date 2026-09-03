/**
 * 共享输入校验规则：联系方式、搜索词、分页、打赏金额与咨询表单。
 * 规则与 contracts/*.yaml 的字段 validate 对齐，双端复用同一份校验逻辑。
 *
 * @capability Req-5 打赏订单输入校验
 * @capability Req-6 付费咨询输入校验
 * @capability Req-12 输入校验
 * @capabilityPoint T-06 实现共享输入校验规则
 */

import { TIP_AMOUNT_CENTS } from '../constants/order.js';

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

/**
 * 校验打赏金额是否属于预设档位。
 * @param {unknown} amount 打赏金额（分）
 * @returns {boolean}
 */
export function isValidTipAmount(amount) {
  return Number.isInteger(amount) && TIP_AMOUNT_CENTS.includes(amount);
}

/**
 * 校验付费咨询表单，返回 valid 与逐字段错误。
 * @param {Object} [form] 咨询表单
 * @returns {{valid: boolean, errors: Record<string, string>}}
 */
export function validateConsultationForm(form = {}) {
  const errors = {};

  const contactName = typeof form.contactName === 'string' ? form.contactName.trim() : '';
  if (contactName.length < 1 || contactName.length > 50) {
    errors.contactName = '请填写联系人（1-50 个字符）';
  }

  const contactType = form.contactType;
  if (contactType !== 'phone' && contactType !== 'wechat') {
    errors.contactType = '联系方式类型非法';
  }

  if (!isValidContactValue(form.contactValue, contactType)) {
    errors.contactValue = '请填写正确的手机号或微信';
  }

  const topicText = typeof form.topicText === 'string' ? form.topicText.trim() : '';
  if (topicText.length < 1 || topicText.length > 200) {
    errors.topicText = '请填写咨询主题（1-200 个字符）';
  }

  const requestText = typeof form.requestText === 'string' ? form.requestText.trim() : '';
  if (requestText.length < 1 || requestText.length > 2000) {
    errors.requestText = '请填写咨询诉求（1-2000 个字符）';
  }

  if (!isValidExpectedTime(form.expectedTime)) {
    errors.expectedTime = '请选择晚于当前时间的期望时间';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

function isValidExpectedTime(value) {
  if (typeof value !== 'string') return false;
  const time = Date.parse(value);
  return !Number.isNaN(time) && time > Date.now();
}
