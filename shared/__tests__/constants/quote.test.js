import { describe, expect, it } from 'vitest';
import {
  MAX_CONTENT_LENGTH,
  QUOTE_TODAY_PATH,
  LOCAL_FALLBACK_QUOTE,
} from '../../constants/quote.js';

describe('quote 常量', () => {
  it('正文上限为 60 字', () => {
    expect(MAX_CONTENT_LENGTH).toBe(60);
  });

  it('今日语录接口路径为 /api/quotes/today', () => {
    expect(QUOTE_TODAY_PATH).toBe('/api/quotes/today');
  });

  it('本地兜底文案包含非空正文与出处', () => {
    expect(LOCAL_FALLBACK_QUOTE).toBeTruthy();
    expect(LOCAL_FALLBACK_QUOTE.content).toBeTruthy();
    expect(LOCAL_FALLBACK_QUOTE.source).toBeTruthy();
  });
});
