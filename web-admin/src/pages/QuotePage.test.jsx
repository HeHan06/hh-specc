import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import QuotePage from './QuotePage.jsx';
import { LOCAL_FALLBACK_QUOTE } from '../../../shared/constants/quote.js';
import { getTodayQuote } from '../../../shared/api/quote.js';

// 页面只允许通过 shared 的 API 客户端取数，测试阶段 mock 掉真实请求逻辑。
vi.mock('../../../shared/api/quote.js', () => ({
  getTodayQuote: vi.fn(),
}));

const successQuote = {
  content: '人必须为自己而活',
  source: '《活着》—— 余华',
  backgroundImage: 'https://cdn.example.com/today-bg.jpg',
  displayDate: '2026-08-23',
};

function renderQuotePage() {
  return render(<QuotePage />);
}

describe('QuotePage', () => {
  beforeEach(() => {
    getTodayQuote.mockReset();
  });

  it('渲染今日语录四要素，并通过 shared 客户端获取数据', async () => {
    getTodayQuote.mockResolvedValue(successQuote);

    renderQuotePage();

    expect(await screen.findByText(successQuote.content)).toBeInTheDocument();
    expect(screen.getByText(successQuote.source)).toBeInTheDocument();
    expect(screen.getByText(successQuote.displayDate)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '今日语录背景图' })).toHaveAttribute(
      'src',
      successQuote.backgroundImage,
    );
    expect(getTodayQuote).toHaveBeenCalledTimes(1);
    expect(getTodayQuote).toHaveBeenCalledWith(expect.any(Function));
  });

  it('接口失败时渲染本地兜底内容，不白屏', async () => {
    getTodayQuote.mockRejectedValue(new Error('网络异常'));

    renderQuotePage();

    expect(await screen.findByText(LOCAL_FALLBACK_QUOTE.content)).toBeInTheDocument();
    expect(screen.getByText(LOCAL_FALLBACK_QUOTE.source)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '今日语录背景图' })).toHaveAttribute(
      'src',
      LOCAL_FALLBACK_QUOTE.backgroundImage,
    );
    expect(screen.getByText(/\d{4}-\d{2}-\d{2}/)).toBeInTheDocument();
  });

  it('页面不提供登录/注册入口', async () => {
    getTodayQuote.mockResolvedValue(successQuote);

    renderQuotePage();

    await screen.findByText(successQuote.content);

    expect(screen.queryByText('登录')).not.toBeInTheDocument();
    expect(screen.queryByText('注册')).not.toBeInTheDocument();
  });
});
