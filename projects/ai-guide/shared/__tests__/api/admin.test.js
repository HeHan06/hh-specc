/**
 * @capability Req-12 管理后台 API 客户端统一封装
 * @capabilityPoint T-05 校验后台 API 路径与解包
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  login,
  getMe,
  listTopics,
  createTopic,
  updateTopic,
  listCategories,
  createCategory,
  updateCategory,
  listContents,
  createContent,
  getContent,
  updateContent,
  publishContent,
  unpublishContent,
  restoreContent,
  archiveContent,
  getAdvertisement,
  updateAdvertisement,
  listOperationLogs,
} from '../../api/admin.js';

describe('管理后台 API 客户端', () => {
  let request;

  beforeEach(() => {
    request = vi.fn().mockResolvedValue({ code: 0, message: 'success', data: { ok: true } });
  });

  const cases = [
    {
      name: 'login 使用 POST /api/admin/auth/login',
      run: () => login(request, { username: 'admin', password: 'secret' }),
      method: 'POST',
      path: '/api/admin/auth/login',
      body: { username: 'admin', password: 'secret' },
    },
    {
      name: 'getMe 使用 GET /api/admin/me',
      run: () => getMe(request),
      method: 'GET',
      path: '/api/admin/me',
    },
    {
      name: 'listTopics 使用 GET /api/admin/topics',
      run: () => listTopics(request, { pageNum: 1, pageSize: 20, keyword: 'Agent' }),
      method: 'GET',
      path: '/api/admin/topics',
      query: { pageNum: 1, pageSize: 20, keyword: 'Agent' },
    },
    {
      name: 'createTopic 使用 POST /api/admin/topics',
      run: () => createTopic(request, { code: 'agent', name: 'Agent 设计', description: '', sortOrder: 0, enabled: true }),
      method: 'POST',
      path: '/api/admin/topics',
      body: { code: 'agent', name: 'Agent 设计', description: '', sortOrder: 0, enabled: true },
    },
    {
      name: 'updateTopic 使用 PUT /api/admin/topics/{topicCode}',
      run: () => updateTopic(request, 'agent', { name: 'Agent 设计', enabled: true }),
      method: 'PUT',
      path: '/api/admin/topics/agent',
      body: { name: 'Agent 设计', enabled: true },
    },
    {
      name: 'listCategories 使用 GET /api/admin/categories',
      run: () => listCategories(request, { topicCode: 'agent', pageNum: 1, pageSize: 20 }),
      method: 'GET',
      path: '/api/admin/categories',
      query: { topicCode: 'agent', pageNum: 1, pageSize: 20 },
    },
    {
      name: 'createCategory 使用 POST /api/admin/categories',
      run: () => createCategory(request, { code: 'multi-agent', topicCode: 'agent', name: '多 Agent' }),
      method: 'POST',
      path: '/api/admin/categories',
      body: { code: 'multi-agent', topicCode: 'agent', name: '多 Agent' },
    },
    {
      name: 'updateCategory 使用 PUT /api/admin/categories/{categoryCode}',
      run: () => updateCategory(request, 'multi-agent', { topicCode: 'agent', name: '多 Agent', enabled: true }),
      method: 'PUT',
      path: '/api/admin/categories/multi-agent',
      body: { topicCode: 'agent', name: '多 Agent', enabled: true },
    },
    {
      name: 'listContents 使用 GET /api/admin/contents',
      run: () => listContents(request, { status: 'draft', type: 'article', categoryCode: 'multi-agent', keyword: 'Agent', pageNum: 1, pageSize: 20 }),
      method: 'GET',
      path: '/api/admin/contents',
      query: { status: 'draft', type: 'article', categoryCode: 'multi-agent', keyword: 'Agent', pageNum: 1, pageSize: 20 },
    },
    {
      name: 'createContent 使用 POST /api/admin/contents',
      run: () => createContent(request, { categoryCode: 'multi-agent', type: 'article', title: '标题', summary: '摘要', body: '正文', tags: [], source: 'original' }),
      method: 'POST',
      path: '/api/admin/contents',
      body: { categoryCode: 'multi-agent', type: 'article', title: '标题', summary: '摘要', body: '正文', tags: [], source: 'original' },
    },
    {
      name: 'getContent 使用 GET /api/admin/contents/{contentCode}',
      run: () => getContent(request, 'content-1'),
      method: 'GET',
      path: '/api/admin/contents/content-1',
    },
    {
      name: 'updateContent 使用 PUT /api/admin/contents/{contentCode}',
      run: () => updateContent(request, 'content-1', { categoryCode: 'multi-agent', type: 'article', title: '标题2', summary: '摘要', body: '正文', tags: [], source: 'original', version: 1 }),
      method: 'PUT',
      path: '/api/admin/contents/content-1',
      body: { categoryCode: 'multi-agent', type: 'article', title: '标题2', summary: '摘要', body: '正文', tags: [], source: 'original', version: 1 },
    },
    {
      name: 'publishContent 使用 POST /api/admin/contents/{contentCode}/publish',
      run: () => publishContent(request, 'content-1', { reviewConfirmed: true, version: 1 }),
      method: 'POST',
      path: '/api/admin/contents/content-1/publish',
      body: { reviewConfirmed: true, version: 1 },
    },
    {
      name: 'unpublishContent 使用 POST /api/admin/contents/{contentCode}/unpublish',
      run: () => unpublishContent(request, 'content-1', { version: 1 }),
      method: 'POST',
      path: '/api/admin/contents/content-1/unpublish',
      body: { version: 1 },
    },
    {
      name: 'restoreContent 使用 POST /api/admin/contents/{contentCode}/restore',
      run: () => restoreContent(request, 'content-1', { reviewConfirmed: true, version: 1 }),
      method: 'POST',
      path: '/api/admin/contents/content-1/restore',
      body: { reviewConfirmed: true, version: 1 },
    },
    {
      name: 'archiveContent 使用 POST /api/admin/contents/{contentCode}/archive',
      run: () => archiveContent(request, 'content-1', { version: 1 }),
      method: 'POST',
      path: '/api/admin/contents/content-1/archive',
      body: { version: 1 },
    },
    {
      name: 'getAdvertisement 使用 GET /api/admin/advertisement',
      run: () => getAdvertisement(request),
      method: 'GET',
      path: '/api/admin/advertisement',
    },
    {
      name: 'updateAdvertisement 使用 PUT /api/admin/advertisement',
      run: () => updateAdvertisement(request, { title: '闲鱼引流', link: 'https://example.com', enabled: true }),
      method: 'PUT',
      path: '/api/admin/advertisement',
      body: { title: '闲鱼引流', link: 'https://example.com', enabled: true },
    },
    {
      name: 'listOperationLogs 使用 GET /api/admin/operation-logs',
      run: () => listOperationLogs(request, { targetType: 'content', pageNum: 1, pageSize: 20 }),
      method: 'GET',
      path: '/api/admin/operation-logs',
      query: { targetType: 'content', pageNum: 1, pageSize: 20 },
    },
  ];

  cases.forEach(({ name, run, method, path, query, body }) => {
    it(name, async () => {
      await run();
      const expected = { method, path };
      if (query !== undefined) expected.query = query;
      if (body !== undefined) expected.body = body;
      expect(request).toHaveBeenCalledWith(expect.objectContaining(expected));
    });
  });

  it('统一解包响应体，仅返回 data', async () => {
    request.mockResolvedValue({
      code: 0,
      message: 'success',
      data: { token: 'jwt', username: 'admin', role: 'ADMIN' },
    });

    await expect(login(request, { username: 'admin', password: 'secret' })).resolves.toEqual({
      token: 'jwt',
      username: 'admin',
      role: 'ADMIN',
    });
  });
});
