/**
 * 主题管理页测试：列表展示、新建、编辑与 loading/error/空 三态。
 * 当前页面缺失，红测失败方向为模块无法解析；T-26 实现后同命令转绿。
 *
 * @capability Req-9 后台主题管理
 * @capability Req-12 统一错误处理与三态
 * @capabilityPoint T-25 主题管理页测试先行红测
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TopicManagePage from './TopicManagePage.jsx';
import { createTopic, listTopics, updateTopic } from '@shared/api/admin.js';

vi.mock('@shared/api/admin.js', () => ({
  listTopics: vi.fn(),
  createTopic: vi.fn(),
  updateTopic: vi.fn(),
}));

const agentTopic = {
  code: 'agent',
  name: 'Agent 设计',
  description: 'Agent 架构与工具调用',
  sortOrder: 1,
  enabled: true,
  updatedAt: '2026-08-30T08:00:00Z',
};

const llmTopic = {
  code: 'llm',
  name: '大模型基础',
  description: '预训练与微调',
  sortOrder: 2,
  enabled: false,
  updatedAt: '2026-08-29T08:00:00Z',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/topics']}>
      <Routes>
        <Route path="/topics" element={<TopicManagePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TopicManagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listTopics.mockResolvedValue({ list: [agentTopic, llmTopic], total: 2, pageNum: 1, pageSize: 20 });
    createTopic.mockResolvedValue({ code: 'agent', name: 'Agent 设计' });
    updateTopic.mockResolvedValue({ code: 'agent' });
  });

  it('渲染主题列表，展示编码、名称与启用状态', async () => {
    renderPage();

    const rows = await screen.findAllByTestId('topic-row');
    expect(rows).toHaveLength(2);

    expect(within(rows[0]).getByText('agent')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Agent 设计')).toBeInTheDocument();
    expect(within(rows[0]).getByText('启用')).toBeInTheDocument();
    expect(within(rows[1]).getByText('停用')).toBeInTheDocument();
  });

  it('主题加载中展示 loading 状态', () => {
    listTopics.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByTestId('topic-loading')).toBeInTheDocument();
  });

  it('加载失败时展示错误提示，点击重试后重新加载', async () => {
    const user = userEvent.setup();
    listTopics
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ list: [agentTopic], total: 1, pageNum: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('加载失败，请重试')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '重试' }));

    expect(await screen.findByText('Agent 设计')).toBeInTheDocument();
  });

  it('无主题时展示空态', async () => {
    listTopics.mockResolvedValue({ list: [], total: 0, pageNum: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('暂无主题')).toBeInTheDocument();
  });

  it('新建主题时提交编码与名称', async () => {
    const user = userEvent.setup();
    listTopics.mockResolvedValue({ list: [], total: 0, pageNum: 1, pageSize: 20 });
    renderPage();
    await screen.findByText('暂无主题');

    await user.type(screen.getByPlaceholderText('请输入主题编码'), 'agent');
    await user.type(screen.getByPlaceholderText('请输入主题名称'), 'Agent 设计');
    await user.click(screen.getByRole('button', { name: '新建' }));

    await waitFor(() => {
      expect(createTopic).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ code: 'agent', name: 'Agent 设计' }),
      );
    });
  });

  it('编辑主题时携带 topicCode 提交更新', async () => {
    const user = userEvent.setup();
    listTopics.mockResolvedValue({ list: [agentTopic], total: 1, pageNum: 1, pageSize: 20 });
    renderPage();
    await screen.findByText('Agent 设计');

    await user.click(screen.getByRole('button', { name: '编辑' }));

    const nameInput = screen.getByPlaceholderText('请输入主题名称');
    await user.clear(nameInput);
    await user.type(nameInput, 'Agent 架构');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(updateTopic).toHaveBeenCalledWith(
        expect.anything(),
        'agent',
        expect.objectContaining({ name: 'Agent 架构' }),
      );
    });
  });
});
