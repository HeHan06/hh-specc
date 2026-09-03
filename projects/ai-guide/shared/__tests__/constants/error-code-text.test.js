/**
 * @capability Req-12 统一错误处理
 * @capabilityPoint T-05 校验错误码前端文案映射
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ERROR_TEXT,
  ERROR_CODE_TEXT,
  getErrorText,
} from '../../constants/error-code-text.js';

describe('错误码文案映射', () => {
  it('提供兜底文案，避免后端 message 直接暴露给用户', () => {
    expect(DEFAULT_ERROR_TEXT).toBe('系统繁忙，请稍后重试');
  });

  it('通用错误码映射为契约中的 user-text', () => {
    expect(ERROR_CODE_TEXT[1000]).toBe('请检查输入内容后重试');
    expect(ERROR_CODE_TEXT[1001]).toBe('请先登录后再操作');
    expect(ERROR_CODE_TEXT[1002]).toBe('暂无操作权限');
    expect(ERROR_CODE_TEXT[1003]).toBe('资源不存在或已移除');
    expect(ERROR_CODE_TEXT[1004]).toBe('系统繁忙，请稍后重试');
  });

  it('各业务模块错误码映射为契约中的 user-text', () => {
    expect(getErrorText(2000)).toBe('内容不存在或已下架');
    expect(getErrorText(2100)).toBe('请选择合法的打赏金额');
    expect(getErrorText(2200)).toBe('请检查咨询信息后重新提交');
    expect(getErrorText(2302)).toBe('内容已被他人更新，请重新加载后再编辑');
  });

  it('未登记错误码回退到默认文案', () => {
    expect(getErrorText(9999)).toBe(DEFAULT_ERROR_TEXT);
  });
});
