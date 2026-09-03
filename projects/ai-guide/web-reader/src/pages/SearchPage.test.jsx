/**
 * 搜索页测试：关键词校验、命中/空态展示与错误重试。
 *
 * @capability Req-2 内容搜索
 * @capabilityPoint T-19 搜索词校验、无结果空态与失败重试红测
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SearchPage from './SearchPage.jsx';
import { searchContents } from '../services/content.js';

vi.mock('../services/content.js', () => ({
  searchContents: vi.fn(),
}));

const searchPage = {
  list: [
    {
      code: 'content-1',
      categoryCode: 'agent-memory',
      type: 'article',
      title: 'Agent 记忆设计',
      summary: '如何设计长期记忆',
      updatedAt: '2026-08-30T08:00:00Z',
    },
  ],
  total: 1,
  pageNum: 1,
  pageSize: 20,
};

const emptyPage = { list: [], total: 0, pageNum: 1, pageSize: 20 };

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/search']}>
      <Routes>
        <Route path="/search" element={<SearchPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('输入合法关键词并提交后展示命中内容', async () => {
    searchContents.mockResolvedValue(searchPage);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole('textbox'), 'Agent');
    await user.click(screen.getByRole('button', { name: '搜索' }));

    expect(await screen.findByText('Agent 记忆设计')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Agent 记忆设计' })).toHaveAttribute('href', '/docs/agent-memory#content-1');
    expect(searchContents).toHaveBeenCalledWith({ keyword: 'Agent', pageNum: 1, pageSize: 20 });
  });

  it('搜索词为空时提示校验错误，不发起请求', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: '搜索' }));

    expect(await screen.findByText('请输入 1-50 个字符的关键词')).toBeInTheDocument();
    expect(searchContents).not.toHaveBeenCalled();
  });

  it('搜索词超过 50 个字符时提示校验错误，不发起请求', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole('textbox'), 'A'.repeat(51));
    await user.click(screen.getByRole('button', { name: '搜索' }));

    expect(await screen.findByText('请输入 1-50 个字符的关键词')).toBeInTheDocument();
    expect(searchContents).not.toHaveBeenCalled();
  });

  it('请求未返回时展示 loading 状态', async () => {
    searchContents.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole('textbox'), 'Agent');
    await user.click(screen.getByRole('button', { name: '搜索' }));

    expect(await screen.findByTestId('search-loading')).toBeInTheDocument();
  });

  it('无匹配结果时展示空态', async () => {
    searchContents.mockResolvedValue(emptyPage);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole('textbox'), '不存在');
    await user.click(screen.getByRole('button', { name: '搜索' }));

    expect(await screen.findByText('暂无搜索结果')).toBeInTheDocument();
  });

  it('搜索失败时展示错误提示，重试成功后恢复结果', async () => {
    searchContents.mockRejectedValueOnce(new Error('network error'));
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole('textbox'), 'Agent');
    await user.click(screen.getByRole('button', { name: '搜索' }));

    expect(await screen.findByText('加载失败，请重试')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();

    searchContents.mockResolvedValueOnce(searchPage);
    await user.click(screen.getByRole('button', { name: '重试' }));

    expect(await screen.findByText('Agent 记忆设计')).toBeInTheDocument();
    expect(searchContents).toHaveBeenCalledTimes(2);
  });
});
