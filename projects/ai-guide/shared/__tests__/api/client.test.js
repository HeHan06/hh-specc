/**
 * @capability Req-12 统一响应解包
 * @capabilityPoint T-05 校验 API 客户端基座
 */
import { describe, expect, it, vi } from 'vitest';
import createApiClient, { createApiClient as namedCreateApiClient } from '../../api/client.js';

describe('createApiClient', () => {
  it('默认导出与命名导出为同一工厂函数', () => {
    expect(namedCreateApiClient).toBe(createApiClient);
  });

  it('request 不是函数时抛出 TypeError', () => {
    expect(() => createApiClient(null)).toThrow(TypeError);
  });

  it('get 注入 GET 方法与路径，并统一解包返回 data', async () => {
    const request = vi.fn().mockResolvedValue({ code: 0, message: 'success', data: { id: 1 } });
    const client = createApiClient(request);

    await expect(client.get('/api/topics')).resolves.toEqual({ id: 1 });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: '/api/topics',
    }));
  });

  it('get 透传查询参数等额外配置', async () => {
    const request = vi.fn().mockResolvedValue({ code: 0, message: 'success', data: null });
    await createApiClient(request).get('/api/contents', { query: { pageNum: 1, pageSize: 20 } });

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: '/api/contents',
      query: { pageNum: 1, pageSize: 20 },
    }));
  });

  it('post 注入 POST 方法与路径，并透传请求体与请求头', async () => {
    const request = vi.fn().mockResolvedValue({ code: 0, message: 'success', data: { orderNo: 'T1' } });
    await createApiClient(request).post('/api/tips', {
      body: { amount: 100 },
      headers: { 'X-Visitor-Id': 'visitor-12345678' },
    });

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      path: '/api/tips',
      body: { amount: 100 },
      headers: { 'X-Visitor-Id': 'visitor-12345678' },
    }));
  });

  it('put 注入 PUT 方法与路径', async () => {
    const request = vi.fn().mockResolvedValue({ code: 0, message: 'success', data: { ok: true } });
    await createApiClient(request).put('/api/admin/topics/agent', { body: { name: 'Agent' } });

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'PUT',
      path: '/api/admin/topics/agent',
      body: { name: 'Agent' },
    }));
  });

  it('业务码非 0 时抛出带 code 的错误', async () => {
    const request = vi.fn().mockResolvedValue({ code: 2000, message: '内容不存在', data: null });
    await expect(createApiClient(request).get('/api/contents/nope')).rejects.toMatchObject({ code: 2000 });
  });

  it('响应体不是对象时视为非法响应', async () => {
    const request = vi.fn().mockResolvedValue(null);
    await expect(createApiClient(request).get('/api/topics')).rejects.toBeInstanceOf(Error);
  });
});
