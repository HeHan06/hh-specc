/**
 * 专题管理页测试：列表展示、新建（选择所属主题）、编辑与 loading/error/空 三态。
 * 当前页面缺失，红测失败方向为模块无法解析；T-26 实现后同命令转绿。
 *
 * @capability Req-9 后台专题管理
 * @capability Req-12 统一错误处理与三态
 * @capabilityPoint T-25 专题管理页测试先行红测
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CategoryManagePage from './CategoryManagePage.jsx';
import { createCategory, listCategories, listTopics, updateCategory } from '@shared/api/admin.js';

vi.mock('@shared/api/admin.js', () => ({
  listCategories: vi.fn(),
  listTopics: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
}));

const agentTopic = {
  code: 'agent',
  name: 'Agent 设计',
  description: '',
  sortOrder: 1,
  enabled: true,
  updatedAt: '2026-08-30T08:00:00Z',
};

const memoryCategory = {
  code: 'agent-memory',
  topicCode: 'agent',
  name: '记忆设计',
  description: '上下文与长期记忆',
  sortOrder: 1,
  enabled: true,
  updatedAt: '2026-08-30T08:00:00Z',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/categories']}>
      <Routes>
        <Route path="/categories" element={<CategoryManagePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CategoryManagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCategories.mockResolvedValue({ list: [memoryCategory], total: 1, pageNum: 1, pageSize: 20 });
    listTopics.mockResolvedValue({ list: [agentTopic], total: 1, pageNum: 1, pageSize: 20 });
    createCategory.mockResolvedValue({ code: 'agent-memory', topicCode: 'agent' });
    updateCategory.mockResolvedValue({ code: 'agent-memory' });
  });

  it('渲染专题列表，展示编码、所属主题编码与名称', async () => {
    renderPage();

    const rows = await screen.findAllByTestId('category-row');
    expect(rows).toHaveLength(1);

    expect(within(rows[0]).getByText('agent-memory')).toBeInTheDocument();
    expect(within(rows[0]).getByText('agent')).toBeInTheDocument();
    expect(within(rows[0]).getByText('记忆设计')).toBeInTheDocument();
  });

  it('专题加载中展示 loading 状态', () => {
    listCategories.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByTestId('category-loading')).toBeInTheDocument();
  });

  it('加载失败时展示错误提示，点击重试后重新加载', async () => {
    const user = userEvent.setup();
    listCategories
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ list: [memoryCategory], total: 1, pageNum: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('加载失败，请重试')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '重试' }));

    expect(await screen.findByText('记忆设计')).toBeInTheDocument();
  });

  it('无专题时展示空态', async () => {
    listCategories.mockResolvedValue({ list: [], total: 0, pageNum: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('暂无专题')).toBeInTheDocument();
  });

  it('新建专题时选择所属主题并提交编码与名称', async () => {
    const user = userEvent.setup();
    listCategories.mockResolvedValue({ list: [], total: 0, pageNum: 1, pageSize: 20 });
    renderPage();
    await screen.findByText('暂无专题');

    await user.type(screen.getByPlaceholderText('请输入专题编码'), 'agent-memory');
    await user.type(screen.getByPlaceholderText('请输入专题名称'), '记忆设计');

    await user.click(screen.getByRole('combobox'));
    const topicOption = await screen.findByRole('option', { name: 'Agent 设计' });
    await user.click(topicOption);

    await user.click(screen.getByRole('button', { name: '新建' }));

    await waitFor(() => {
      expect(createCategory).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ code: 'agent-memory', topicCode: 'agent', name: '记忆设计' }),
      );
    });
  });

  it('编辑专题时携带 categoryCode 提交更新', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('记忆设计');

    await user.click(screen.getByRole('button', { name: '编辑' }));

    const nameInput = screen.getByPlaceholderText('请输入专题名称');
    await user.clear(nameInput);
    await user.type(nameInput, '记忆系统');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(updateCategory).toHaveBeenCalledWith(
        expect.anything(),
        'agent-memory',
        expect.objectContaining({ name: '记忆系统' }),
      );
    });
  });
});
