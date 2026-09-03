/**
 * @capability Req-1 阅读站内容共享常量
 * @capabilityPoint T-05 校验内容类型/来源/状态常量
 */
import { describe, expect, it } from 'vitest';
import {
  CONTENT_TYPE,
  CONTENT_TYPE_TEXT,
  CONTENT_SOURCE,
  CONTENT_SOURCE_TEXT,
  CONTENT_STATUS,
  CONTENT_STATUS_TEXT,
  CONTENT_TYPES,
  CONTENT_SOURCES,
  CONTENT_STATUSES,
} from '../../constants/content.js';

describe('内容类型常量', () => {
  it('四类内容枚举值与契约一致', () => {
    expect(CONTENT_TYPE.ARTICLE).toBe('article');
    expect(CONTENT_TYPE.INTERVIEW).toBe('interview');
    expect(CONTENT_TYPE.QUESTION).toBe('question');
    expect(CONTENT_TYPE.RESUME).toBe('resume');
  });

  it('内容类型文案与业务术语一致', () => {
    expect(CONTENT_TYPE_TEXT.article).toBe('文章');
    expect(CONTENT_TYPE_TEXT.interview).toBe('面试复盘');
    expect(CONTENT_TYPE_TEXT.question).toBe('题目');
    expect(CONTENT_TYPE_TEXT.resume).toBe('简历优化内容');
  });

  it('内容来源与状态枚举与数据模型一致', () => {
    expect(CONTENT_SOURCE.ORIGINAL).toBe('original');
    expect(CONTENT_SOURCE.MIGRATED).toBe('migrated');
    expect(CONTENT_STATUS.DRAFT).toBe('draft');
    expect(CONTENT_STATUS.PUBLISHED).toBe('published');
    expect(CONTENT_STATUS.UNPUBLISHED).toBe('unpublished');
    expect(CONTENT_STATUS.ARCHIVED).toBe('archived');
  });

  it('来源与状态文案可被前端直接展示', () => {
    expect(CONTENT_SOURCE_TEXT.original).toBe('原创');
    expect(CONTENT_SOURCE_TEXT.migrated).toBe('迁移');
    expect(CONTENT_STATUS_TEXT.draft).toBe('草稿');
    expect(CONTENT_STATUS_TEXT.published).toBe('已发布');
    expect(CONTENT_STATUS_TEXT.unpublished).toBe('已下架');
    expect(CONTENT_STATUS_TEXT.archived).toBe('已归档');
  });

  it('提供枚举值数组便于下拉与筛选', () => {
    expect(CONTENT_TYPES).toEqual(['article', 'interview', 'question', 'resume']);
    expect(CONTENT_SOURCES).toEqual(['original', 'migrated']);
    expect(CONTENT_STATUSES).toEqual(['draft', 'published', 'unpublished', 'archived']);
  });
});
