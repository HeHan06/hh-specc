/**
 * 内容列表页测试：筛选/分页、四类内容类型与 loading/error/空 三态。
 * 当前页面缺失，红测失败方向为模块无法解析；T-26 实现后同命令转绿。
 *
 * @capability Req-9 后台内容列表
 * @capability Req-12 统一错误处理与三态
 * @capabilityPoint T-25 内容列表页测试先行红测
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ContentListPage from './ContentListPage.jsx';
import { listCategories, listContents } from '@shared/api/admin.js';
import { CONTENT_TYPE_TEXT } from '@shared/constants/content.js';

vi.mock('@shared/api/admin.js', () => ({
  listContents: vi.fn(),
  listCategories: vi.fn(),
}));

const singleContent = {
  code: 'content-article',
  categoryCode: 'agent-memory',
  type: 'article',
  title: 'Agent 设计入门',
  status: 'draft',
  version: 1,
  updatedAt: '2026-08-30T08:00:00Z',
};

const fourTypePage = {
  list: ['article', 'interview', 'question', 'resume'].map((type, index) => ({
    code: `content-${type}`,
    categoryCode: 'agent-memory',
    type,
    title: `${type} 标题`,
    status: 'draft',
    version: index + 1,
    updatedAt: '2026-08-30T08:00:00Z',
  })),
  total: 4,
  pageNum: 1,
  pageSize: 20,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/contents']}>
      <Routes>
        <Route path="/contents" element={<ContentListPage />} />
        <Route path="/contents/:contentCode/edit" element={<div>编辑页占位</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ContentListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listContents.mockResolvedValue({ list: [singleContent], total: 1, pageNum: 1, pageSize: 20 });
    listCategories.mockResolvedValue({ list: [], total: 0, pageNum: 1, pageSize: 20 });
  });

  it('渲染筛选控件并展示四类内容类型的文案', async () => {
    listContents.mockResolvedValue(fourTypePage);
    renderPage();

    expect(screen.getByPlaceholderText('请输入内容标题关键词')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查询' })).toBeInTheDocument();

    const rows = await screen.findAllByTestId('content-row');
    expect(rows).toHaveLength(4);

    expect(within(rows[0]).getByText(CONTENT_TYPE_TEXT.article)).toBeInTheDocument();
    expect(within(rows[1]).getByText(CONTENT_TYPE_TEXT.interview)).toBeInTheDocument();
    expect(within(rows[2]).getByText(CONTENT_TYPE_TEXT.question)).toBeInTheDocument();
    expect(within(rows[3]).getByText(CONTENT_TYPE_TEXT.resume)).toBeInTheDocument();
  });

  it('分页切换后按 pageNum 重新请求内容列表', async () => {
    listContents.mockResolvedValue({
      list: [singleContent],
      total: 25,
      pageNum: 1,
      pageSize: 20,
    });
    renderPage();
    await screen.findByText('Agent 设计入门');

    await userEvent.click(screen.getByTitle('2'));

    await waitFor(() => {
      expect(listContents).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ pageNum: 2, pageSize: 20 }),
      );
    });
  });

  it('按关键词筛选时携带 keyword 并回到第一页', async () => {
    const user = userEvent.setup();
    listContents.mockResolvedValue({ list: [singleContent], total: 1, pageNum: 1, pageSize: 20 });
    renderPage();
    await screen.findByText('Agent 设计入门');

    await user.type(screen.getByPlaceholderText('请输入内容标题关键词'), 'Agent');
    await user.click(screen.getByRole('button', { name: '查询' }));

    await waitFor(() => {
      expect(listContents).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ keyword: 'Agent', pageNum: 1, pageSize: 20 }),
      );
    });
  });

  it('内容列表加载中展示 loading 状态', () => {
    listContents.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByTestId('content-loading')).toBeInTheDocument();
  });

  it('加载失败时展示错误提示，点击重试后重新加载', async () => {
    const user = userEvent.setup();
    listContents
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ list: [singleContent], total: 1, pageNum: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('加载失败，请重试')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '重试' }));

    expect(await screen.findByText('Agent 设计入门')).toBeInTheDocument();
  });

  it('无内容时展示空态', async () => {
    listContents.mockResolvedValue({ list: [], total: 0, pageNum: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('暂无内容')).toBeInTheDocument();
  });
});
