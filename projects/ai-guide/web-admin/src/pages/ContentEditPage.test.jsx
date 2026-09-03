/**
 * 内容编辑页测试：编辑携带 version、并发冲突提示重新加载、发布前人工审核确认、
 * 下架/恢复/归档入口与 loading/error 状态。
 * 当前页面缺失，红测失败方向为模块无法解析；T-26 实现后同命令转绿。
 *
 * @capability Req-9 后台内容编辑
 * @capability Req-10 发布前人工审核确认
 * @capabilityPoint T-25 内容编辑页测试先行红测
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ContentEditPage from './ContentEditPage.jsx';
import {
  archiveContent,
  getContent,
  listCategories,
  publishContent,
  restoreContent,
  unpublishContent,
  updateContent,
} from '@shared/api/admin.js';

vi.mock('@shared/api/admin.js', () => ({
  getContent: vi.fn(),
  updateContent: vi.fn(),
  publishContent: vi.fn(),
  unpublishContent: vi.fn(),
  restoreContent: vi.fn(),
  archiveContent: vi.fn(),
  listCategories: vi.fn(),
}));

const draftContent = {
  code: 'content-article',
  categoryCode: 'agent-memory',
  type: 'article',
  title: 'Agent 设计入门',
  summary: '摘要',
  body: '正文',
  tags: [],
  source: 'original',
  status: 'draft',
  recommended: false,
  version: 3,
  publishedAt: null,
  updatedAt: '2026-08-30T08:00:00Z',
};

const publishedContent = { ...draftContent, status: 'published' };
const unpublishedContent = { ...draftContent, status: 'unpublished' };

function renderEditPage() {
  return render(
    <MemoryRouter initialEntries={['/contents/content-article/edit']}>
      <Routes>
        <Route path="/contents/:contentCode/edit" element={<ContentEditPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ContentEditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getContent.mockResolvedValue(draftContent);
    listCategories.mockResolvedValue({
      list: [{ code: 'agent-memory', topicCode: 'agent', name: '记忆设计' }],
      total: 1,
      pageNum: 1,
      pageSize: 20,
    });
    updateContent.mockResolvedValue({ code: 'content-article', version: 4 });
    publishContent.mockResolvedValue({ code: 'content-article', status: 'published', publishedAt: '2026-08-30T09:00:00Z' });
    unpublishContent.mockResolvedValue({ code: 'content-article', status: 'unpublished' });
    restoreContent.mockResolvedValue({ code: 'content-article', status: 'published' });
    archiveContent.mockResolvedValue({ code: 'content-article', status: 'archived' });
  });

  it('详情加载中展示 loading 状态', () => {
    getContent.mockReturnValue(new Promise(() => {}));
    renderEditPage();

    expect(screen.getByTestId('content-edit-loading')).toBeInTheDocument();
  });

  it('详情加载失败时展示错误提示，点击重试后重新加载', async () => {
    const user = userEvent.setup();
    getContent.mockRejectedValueOnce(new Error('network error')).mockResolvedValueOnce(draftContent);
    renderEditPage();

    expect(await screen.findByText('加载失败，请重试')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '重试' }));

    expect(await screen.findByDisplayValue('Agent 设计入门')).toBeInTheDocument();
  });

  it('保存编辑时携带当前 version，防止静默覆盖', async () => {
    const user = userEvent.setup();
    renderEditPage();
    await screen.findByDisplayValue('Agent 设计入门');

    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(updateContent).toHaveBeenCalledWith(
        expect.anything(),
        'content-article',
        expect.objectContaining({ version: 3 }),
      );
    });
  });

  it('并发冲突时提示重新加载，并允许重新拉取最新内容', async () => {
    const user = userEvent.setup();
    updateContent.mockRejectedValueOnce(Object.assign(new Error('conflict'), { code: 2302 }));
    renderEditPage();
    await screen.findByDisplayValue('Agent 设计入门');

    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('内容已被他人更新，请重新加载后再编辑')).toBeInTheDocument();
    const reloadButton = screen.getByRole('button', { name: '重新加载' });
    await user.click(reloadButton);

    await waitFor(() => {
      expect(getContent).toHaveBeenCalledTimes(2);
    });
  });

  it('发布前必须勾选人工审核确认，确认后提交 reviewConfirmed=true', async () => {
    const user = userEvent.setup();
    renderEditPage();
    await screen.findByDisplayValue('Agent 设计入门');

    const publishButton = screen.getByRole('button', { name: '发布' });
    const reviewCheckbox = screen.getByRole('checkbox', { name: '我已完成人工审核' });

    await user.click(publishButton);
    expect(publishContent).not.toHaveBeenCalled();

    await user.click(reviewCheckbox);
    await user.click(publishButton);

    await waitFor(() => {
      expect(publishContent).toHaveBeenCalledWith(
        expect.anything(),
        'content-article',
        expect.objectContaining({ reviewConfirmed: true, version: 3 }),
      );
    });
  });

  it('已发布内容提供下架与归档入口，且操作携带 version', async () => {
    const user = userEvent.setup();
    getContent.mockResolvedValue(publishedContent);
    renderEditPage();
    await screen.findByDisplayValue('Agent 设计入门');

    expect(screen.getByRole('button', { name: '下架' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '归档' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '下架' }));

    await waitFor(() => {
      expect(unpublishContent).toHaveBeenCalledWith(
        expect.anything(),
        'content-article',
        expect.objectContaining({ version: 3 }),
      );
    });
  });

  it('已发布内容归档操作携带 version', async () => {
    const user = userEvent.setup();
    getContent.mockResolvedValue(publishedContent);
    renderEditPage();
    await screen.findByDisplayValue('Agent 设计入门');

    await user.click(screen.getByRole('button', { name: '归档' }));

    await waitFor(() => {
      expect(archiveContent).toHaveBeenCalledWith(
        expect.anything(),
        'content-article',
        expect.objectContaining({ version: 3 }),
      );
    });
  });

  it('已下架内容提供恢复发布入口，恢复前同样要求人工审核确认', async () => {
    const user = userEvent.setup();
    getContent.mockResolvedValue(unpublishedContent);
    renderEditPage();
    await screen.findByDisplayValue('Agent 设计入门');

    const restoreButton = screen.getByRole('button', { name: '恢复发布' });
    const reviewCheckbox = screen.getByRole('checkbox', { name: '我已完成人工审核' });

    await user.click(restoreButton);
    expect(restoreContent).not.toHaveBeenCalled();

    await user.click(reviewCheckbox);
    await user.click(restoreButton);

    await waitFor(() => {
      expect(restoreContent).toHaveBeenCalledWith(
        expect.anything(),
        'content-article',
        expect.objectContaining({ reviewConfirmed: true, version: 3 }),
      );
    });
  });
});
