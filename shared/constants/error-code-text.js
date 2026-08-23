// 文案与 contracts/quote.yaml 的 error-code-table 保持一致；前端统一由错误码映射用户文案。
export const DEFAULT_ERROR_TEXT = '内容加载失败，请稍后再试';

export const ERROR_CODE_TEXT = Object.freeze({
  2001: '内容加载失败，请稍后再试',
  2002: '内容配置异常，请稍后再试',
});

// 未登记的业务码回退到默认文案，避免把后端 message 直接暴露给用户。
export function getErrorText(code) {
  if (!Number.isInteger(code)) {
    return DEFAULT_ERROR_TEXT;
  }

  return ERROR_CODE_TEXT[code] || DEFAULT_ERROR_TEXT;
}
