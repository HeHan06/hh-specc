import { describe, expect, it, vi } from 'vitest';
import { getTodayQuote } from '../../api/quote.js';

describe('getTodayQuote', () => {
  it('调用注入的 request 适配器请求 GET /api/quotes/today', async () => {
    const quoteData = {
      content: '人生自苦，他人难悟，唯有自爱，方能自渡',
      source: '《自渡》—— 佚名',
      backgroundImage: '/assets/images/fallback-bg.png',
      displayDate: '2026-08-23',
    };
    const request = vi.fn().mockResolvedValue({
      code: 0,
      message: 'success',
      data: quoteData,
    });

    const result = await getTodayQuote(request);

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/quotes/today',
      }),
    );
    expect(result).toEqual(quoteData);
  });

  it('统一解包响应体，只返回 data 业务数据', async () => {
    const request = vi.fn().mockResolvedValue({
      code: 0,
      message: 'success',
      data: { content: '今日语录', source: '《书》—— 作者', backgroundImage: '/a.png', displayDate: '2026-08-23' },
    });

    await expect(getTodayQuote(request)).resolves.toEqual({
      content: '今日语录',
      source: '《书》—— 作者',
      backgroundImage: '/a.png',
      displayDate: '2026-08-23',
    });
  });

  it('业务码非 0 时抛出错误，不把失败响应当成功数据返回', async () => {
    const request = vi.fn().mockResolvedValue({
      code: 2001,
      message: '内容加载失败',
      data: null,
    });

    await expect(getTodayQuote(request)).rejects.toBeInstanceOf(Error);
  });
});
