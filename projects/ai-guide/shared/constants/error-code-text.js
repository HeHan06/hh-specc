/**
 * 错误码到前端默认文案的映射。
 * 文案与 contracts/common.yaml 及各模块契约的 error-code-table 一致；
 * 未登记的错误码回退到 DEFAULT_ERROR_TEXT，避免直接暴露后端 message。
 *
 * @capability Req-12 统一错误处理
 * @capabilityPoint T-06 实现错误码前端文案映射
 */

export const DEFAULT_ERROR_TEXT = '系统繁忙，请稍后重试';

export const ERROR_CODE_TEXT = Object.freeze({
  // 通用错误码（contracts/common.yaml）
  1000: '请检查输入内容后重试',
  1001: '请先登录后再操作',
  1002: '暂无操作权限',
  1003: '资源不存在或已移除',
  1004: '系统繁忙，请稍后重试',

  // 内容模块（contracts/content.yaml）
  2000: '内容不存在或已下架',
  2001: '主题不存在或暂不可用',
  2002: '专题不存在或暂不可用',
  2003: '搜索暂不可用，请稍后重试',
  2004: '操作失败，请刷新页面后重试',

  // 管理后台（contracts/admin.yaml）
  2300: '账号或密码错误',
  2301: '编码已存在，请更换后重试',
  2302: '内容已被他人更新，请重新加载后再编辑',
  2303: '当前内容状态不支持该操作',
  2305: '内容参数非法或内容不存在',
  2306: '操作未完成，请稍后重试',
  2307: '账号不可用，请联系管理员',
});

/**
 * 返回错误码对应的前端文案；未知错误码回退到默认文案。
 * @param {number|string} code 业务错误码
 * @returns {string} 面向用户的文案
 */
export function getErrorText(code) {
  return ERROR_CODE_TEXT[code] ?? DEFAULT_ERROR_TEXT;
}
