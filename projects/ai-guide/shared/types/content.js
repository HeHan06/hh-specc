/**
 * 内容域共享类型定义。
 * 本文件仅承载 JSDoc 类型，供 Web 阅读站与后台在编辑器中共享结构约束；
 * 不导出运行时对象，避免在双端各复制一份字段说明。
 *
 * @capability Req-1 阅读站内容共享类型
 * @capabilityPoint T-06 定义主题/专题/内容视图类型
 */

/**
 * @typedef {Object} TopicView
 * @property {string} code 主题唯一编码
 * @property {string} name 主题名称
 * @property {string} description 主题简介
 * @property {number} sortOrder 显示顺序
 */

/**
 * @typedef {Object} CategoryView
 * @property {string} code 专题唯一编码
 * @property {string} topicCode 所属主题编码
 * @property {string} name 专题名称
 * @property {string} description 专题简介
 * @property {number} sortOrder 显示顺序
 */

/**
 * @typedef {'article'|'interview'|'question'|'resume'} ContentType
 * 内容四分类：文章、面试复盘、题目、简历优化内容。
 */

/**
 * @typedef {'original'|'migrated'} ContentSource
 * 内容来源：原创或历史知识迁移。
 */

/**
 * @typedef {'draft'|'published'|'unpublished'|'archived'} ContentStatus
 * 内容状态机：草稿、已发布、已下架、已归档。
 */

/**
 * @typedef {Object} ContentSummaryView
 * @property {string} code 内容唯一编码
 * @property {string} categoryCode 所属专题编码
 * @property {string} topicCode 所属主题编码
 * @property {ContentType} type 内容类型
 * @property {string} title 标题
 * @property {string} summary 摘要
 * @property {string} updatedAt 更新时间
 */

/**
 * @typedef {ContentSummaryView & {
 *   body: string,
 *   tags: string[],
 *   source: ContentSource,
 *   likeCount: number,
 *   viewCount: number,
 *   liked: boolean,
 *   publishedAt: string|null
 * }} ContentDetailView
 * 阅读站可见的内容详情；liked 依据匿名访客标识计算。
 */

export {};
