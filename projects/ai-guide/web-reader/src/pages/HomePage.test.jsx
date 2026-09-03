/**
 * 首页测试：Hero 数据背书、热门主题/最近更新入口与三态。
 *
 * @capability Req-1 阅读站内容目录
 * @capabilityPoint T-17 首页目录展示与三态红测
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage.jsx';
import { getCategories, getLatestContents, getTopics } from '../services/content.js';

vi.mock('../services/content.js', () => ({
  getTopics: vi.fn(),
  getCategories: vi.fn(),
  getLatestContents: vi.fn(),
}));

const topics = [
  { code: 'agent', name: 'Agent 设计', description: 'Agent 架构与设计', sortOrder: 1 },
  { code: 'llm', name: '大模型基础', description: 'LLM 基础', sortOrder: 2 },
];

const categoriesMap = {
  agent: [{ code: 'agent-arch', topicCode: 'agent', name: 'Agent 架构', sortOrder: 1 }],
  llm: [{ code: 'llm-base', topicCode: 'llm', name: 'LLM 基础', sortOrder: 1 }],
};

const latestPage = {
  list: [
    {
      code: 'content-1',
      categoryCode: 'agent-arch',
      type: 'article',
      title: '最新文章标题',
      summary: '最新文章摘要',
      updatedAt: '2026-08-30T08:00:00Z',
    },
  ],
  total: 1,
  pageNum: 1,
  pageSize: 20,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTopics.mockResolvedValue(topics);
    getCategories.mockImplementation((topicCode) => Promise.resolve(categoriesMap[topicCode] ?? []));
    getLatestContents.mockResolvedValue(latestPage);
  });

  it('展示热门主题与最近更新，并提供直达内容流的链接', async () => {
    renderPage();

    expect(await screen.findByText('Agent 设计')).toBeInTheDocument();
    expect(screen.getByText('大模型基础')).toBeInTheDocument();
    expect(screen.getByText('热门主题')).toBeInTheDocument();
    expect(screen.getByText('最近更新')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Agent 设计/ })).toHaveAttribute('href', '/docs/agent-arch');
    expect(screen.getByRole('link', { name: /最新文章标题/ })).toHaveAttribute('href', '/docs/agent-arch#content-1');
  });

  it('数据未返回时展示 loading 状态', () => {
    getTopics.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByTestId('home-loading')).toBeInTheDocument();
  });

  it('加载失败时展示错误提示与重试入口', async () => {
    getTopics.mockRejectedValue(new Error('network error'));
    renderPage();

    expect(await screen.findByText('加载失败，请重试')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });

  it('主题与内容为空时仍正常渲染页面骨架', async () => {
    getTopics.mockResolvedValue([]);
    getLatestContents.mockResolvedValue({ list: [], total: 0, pageNum: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('热门主题')).toBeInTheDocument();
    expect(screen.queryByText('Agent 设计')).not.toBeInTheDocument();
  });
});
