/**
 * @capability Req-1 阅读站内容 API 客户端
 * @capabilityPoint T-05 校验内容 API 路径与解包
 */
import { describe, expect, it, vi } from 'vitest';
import {
  getTopics,
  getCategories,
  getContentsByCategory,
  getLatestContents,
  getRecommendedContents,
  searchContents,
  getContentDetail,
  likeContent,
} from '../../api/content.js';

function mockRequest(data = {}) {
  return vi.fn().mockResolvedValue({ code: 0, message: 'success', data });
}

describe('内容 API 客户端', () => {
  it('getTopics 请求 GET /api/topics', async () => {
    const request = mockRequest([{ code: 'agent' }]);
    await expect(getTopics(request)).resolves.toEqual([{ code: 'agent' }]);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: '/api/topics',
    }));
  });

  it('getCategories 携带 topicCode 查询参数', async () => {
    const request = mockRequest([]);
    await getCategories(request, 'agent');
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: '/api/categories',
      query: { topicCode: 'agent' },
    }));
  });

  it('getContentsByCategory 携带专题编码与分页参数', async () => {
    const request = mockRequest([]);
    await getContentsByCategory(request, { categoryCode: 'multi-agent', pageNum: 1, pageSize: 20 });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: '/api/contents',
      query: { categoryCode: 'multi-agent', pageNum: 1, pageSize: 20 },
    }));
  });

  it('getLatestContents 请求 GET /api/contents/latest', async () => {
    const request = mockRequest([]);
    await getLatestContents(request, { pageNum: 1, pageSize: 20 });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: '/api/contents/latest',
      query: { pageNum: 1, pageSize: 20 },
    }));
  });

  it('getRecommendedContents 请求 GET /api/contents/recommended', async () => {
    const request = mockRequest([]);
    await getRecommendedContents(request, { pageNum: 1, pageSize: 20 });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: '/api/contents/recommended',
      query: { pageNum: 1, pageSize: 20 },
    }));
  });

  it('searchContents 携带关键词与分页参数', async () => {
    const request = mockRequest([]);
    await searchContents(request, { keyword: 'Agent', pageNum: 1, pageSize: 20 });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: '/api/contents/search',
      query: { keyword: 'Agent', pageNum: 1, pageSize: 20 },
    }));
  });

  it('getContentDetail 拼接内容编码并透传访客标识', async () => {
    const request = mockRequest({ code: 'content-1' });
    await getContentDetail(request, 'content-1', { visitorId: 'visitor-12345678' });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: '/api/contents/content-1',
      headers: { 'X-Visitor-Id': 'visitor-12345678' },
    }));
  });

  it('likeContent 请求 POST /api/contents/{code}/likes 并携带访客标识', async () => {
    const request = mockRequest({ liked: true, likeCount: 1 });
    await likeContent(request, 'content-1', 'visitor-12345678');
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      path: '/api/contents/content-1/likes',
      headers: { 'X-Visitor-Id': 'visitor-12345678' },
    }));
  });
});
