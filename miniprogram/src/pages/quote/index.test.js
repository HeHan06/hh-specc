import TestUtils from '@tarojs/test-utils-react';
import QuotePage from './index.jsx';
import { LOCAL_FALLBACK_QUOTE } from '../../../../shared/constants/quote.js';
import { getTodayQuote } from '../../../../shared/api/quote.js';

// 页面只允许通过 shared 的 API 客户端取数，测试阶段 mock 掉真实请求逻辑，聚焦页面渲染行为。
jest.mock('../../../../shared/api/quote.js', () => ({
  getTodayQuote: jest.fn(),
}));

// 契约四要素（QuoteView）的成功样例，字段与 contracts/quote.yaml 保持一致。
const successQuote = {
  content: '人必须为自己而活',
  source: '《活着》—— 余华',
  backgroundImage: 'https://cdn.example.com/today-bg.jpg',
  displayDate: '2026-08-23',
};

describe('pages/quote/index', () => {
  let testUtils;

  beforeEach(() => {
    testUtils = new TestUtils();
    getTodayQuote.mockReset();
  });

  it('渲染今日语录四要素，并通过 shared 客户端获取数据', async () => {
    getTodayQuote.mockResolvedValue(successQuote);

    await testUtils.mount(QuotePage);

    // 四要素：正文、出处、当天日期、背景图。
    await testUtils.queries.waitForQueryByText(successQuote.content);
    expect(testUtils.queries.queryByText(successQuote.source)).not.toBeNull();
    expect(testUtils.queries.queryByText(successQuote.displayDate)).not.toBeNull();
    await testUtils.queries.waitForQueryByAttribute('src', successQuote.backgroundImage);

    // 数据只能从 shared 客户端获取一次，且请求适配器由页面注入（平台差异走注入）。
    expect(getTodayQuote).toHaveBeenCalledTimes(1);
    expect(getTodayQuote).toHaveBeenCalledWith(expect.any(Function));
  });

  it('接口失败时渲染本地兜底内容，不白屏', async () => {
    getTodayQuote.mockRejectedValue(new Error('网络异常'));

    await testUtils.mount(QuotePage);

    // 接口不可用时回退 shared 里的本地兜底，正文、出处、背景图三要素都必须出现。
    await testUtils.queries.waitForQueryByText(LOCAL_FALLBACK_QUOTE.content);
    expect(testUtils.queries.queryByText(LOCAL_FALLBACK_QUOTE.source)).not.toBeNull();
    await testUtils.queries.waitForQueryByAttribute('src', LOCAL_FALLBACK_QUOTE.backgroundImage);

    // 兜底也要展示当天日期（YYYY-MM-DD），不能只有文案没有日期。
    const dateNode = testUtils.queries.querySelector('.quote-date');
    expect(dateNode).not.toBeNull();
    expect(dateNode.textContent).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('页面不提供登录/注册入口', async () => {
    getTodayQuote.mockResolvedValue(successQuote);

    await testUtils.mount(QuotePage);
    await testUtils.queries.waitForQueryByText(successQuote.content);

    // 读者端匿名阅读，不能出现任何账号入口。
    expect(testUtils.queries.queryByText('登录')).toBeNull();
    expect(testUtils.queries.queryByText('注册')).toBeNull();
  });
});
