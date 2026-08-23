import { describe, expect, it } from 'vitest';
import { truncateQuoteText, formatShanghaiDate } from '../../utils/quote.js';

describe('truncateQuoteText', () => {
  it('正文超过 60 字时截断到 60 字，保留原文前缀', () => {
    const content = '人'.repeat(61);
    expect(truncateQuoteText(content, 60)).toBe('人'.repeat(60));
    expect(truncateQuoteText(content, 60)).toHaveLength(60);
  });

  it('正文恰好 60 字时不做截断', () => {
    const content = '人'.repeat(60);
    expect(truncateQuoteText(content, 60)).toBe(content);
  });

  it('正文少于 60 字时原样返回', () => {
    const content = '人生自苦，他人难悟';
    expect(truncateQuoteText(content, 60)).toBe(content);
  });
});

describe('formatShanghaiDate', () => {
  it('按 Asia/Shanghai 时区输出 YYYY-MM-DD', () => {
    // 该时刻在 UTC 为 8/22 16:00，在上海为 8/23 00:00，用于锁定上海日期边界
    expect(formatShanghaiDate(new Date('2026-08-22T16:00:00.000Z'))).toBe('2026-08-23');
    // 该时刻在上海为 8/22 23:59，仍应输出 8/22
    expect(formatShanghaiDate(new Date('2026-08-22T15:59:00.000Z'))).toBe('2026-08-22');
  });

  it('返回结果格式固定为 YYYY-MM-DD', () => {
    expect(formatShanghaiDate(new Date('2026-01-05T03:30:00.000Z'))).toBe('2026-01-05');
  });
});
