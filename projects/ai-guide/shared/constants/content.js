/**
 * 内容类型、来源、状态的枚举值与展示文案。
 * 数值与 contracts/content.yaml、contracts/admin.yaml 对齐，双端统一从这里引用。
 *
 * @capability Req-1 阅读站内容共享常量
 * @capabilityPoint T-06 实现内容枚举与文案映射
 */

export const CONTENT_TYPE = Object.freeze({
  ALGORITHM: 'algorithm',
  ARTICLE: 'article',
  INTERVIEW: 'interview',
  QUESTION: 'question',
  RESUME: 'resume',
});

export const CONTENT_TYPE_TEXT = Object.freeze({
  algorithm: '算法题模板',
  article: '文章',
  interview: '面试复盘',
  question: '题目',
  resume: '简历优化内容',
});

export const CONTENT_SOURCE = Object.freeze({
  ORIGINAL: 'original',
  MIGRATED: 'migrated',
});

export const CONTENT_SOURCE_TEXT = Object.freeze({
  original: '原创',
  migrated: '迁移',
});

export const CONTENT_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  UNPUBLISHED: 'unpublished',
  ARCHIVED: 'archived',
});

export const CONTENT_STATUS_TEXT = Object.freeze({
  draft: '草稿',
  published: '已发布',
  unpublished: '已下架',
  archived: '已归档',
});

export const CONTENT_TYPES = Object.freeze(['article', 'algorithm', 'interview', 'question', 'resume']);
export const CONTENT_SOURCES = Object.freeze(['original', 'migrated']);
export const CONTENT_STATUSES = Object.freeze(['draft', 'published', 'unpublished', 'archived']);
