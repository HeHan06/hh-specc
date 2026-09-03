# verify 验证报告：ai-guide

> 阶段：verify ｜ 需求ID：ai-guide ｜ 审计日期：2026-09-03（Asia/Shanghai）
> 审计范围：`spec.md`、`plan.md`、`tasks.md`、`contracts/*.yaml`、`content-template.md`、`../projects/ai-guide/{backend,shared,web-reader,web-admin}`、`content/`
> 结论：**有条件通过**。本轮「历史需求再开发」核心目标 Req-14（内容结构化与 Markdown 渲染）的 AC-14.1~14.4 全部满足，端到端冒烟通过；存在历史遗留项（契约错误码、adminNote 校验、性能类 AC 需人工实测）不阻断本轮内容改造，但作为整体需求终审需人工逐条确认。

## 一、端到端冒烟

> 依据：`smoke-report.md`（由 `lib/smoke.sh` 确定性执行生成，冒烟时间 2026-09-03T13:27:57）。

**结论：通过**（13/13 全部通过）。

| 结果 | 检查项 |
|---|---|
| ✅ | 后端启动成功（端口 8080） |
| ✅ | 前端 [web-admin] 页面可访问（5173） |
| ✅ | 前端 [web-reader] 页面可访问（5174） |
| ✅ | [web-admin] 页面入口 `/` 返回 200 |
| ✅ | [web-admin] 经前端代理 `/api/topics` 返回 code=0 |
| ✅ | [web-admin] 经前端代理 `/api/contents/latest` 返回 code=0 |
| ✅ | [web-admin] 经前端代理 `/api/contents/recommended` 返回 code=0 |
| ✅ | [web-reader] 页面入口 `/` 返回 200 |
| ✅ | [web-reader] 经前端代理 `/api/topics` 返回 code=0 |
| ✅ | [web-reader] 经前端代理 `/api/contents/latest` 返回 code=0 |
| ✅ | [web-reader] 经前端代理 `/api/contents/recommended` 返回 code=0 |
| ✅ | 后端直连 `/api/topics` 返回 code=0 |
| ✅ | 管理员登录链路通过（admin） |

> 说明：本阶段按 verify 规则不再以「后端 JUnit / 前端 vitest 单测」作为验收手段（单测只加载局部，无法证明代码真实可运行）；真实可运行性由上述端到端冒烟兜底。

## 二、契约一致性检查

### 2.1 已通过

- **Req-14 正文契约**：`contracts/content.yaml:134`、`contracts/admin.yaml:186/210/233` 的 `body` 字段均标注「Markdown 正文，分节骨架见 content-template.md」，指向唯一真相源，未在各契约复制模板内容。
- **渲染实现与契约一致**：`web-reader/src/pages/ContentPage.jsx:16-17,146` 使用 `react-markdown` + `remark-gfm` 渲染 `content.body`，与 plan §8 声明一致。
- 契约四要素完整：`common/content/tip/consultation/admin/site` 均有统一响应体引用、错误码表、认证标注与分页约定；`contracts/common.yaml` 为通用响应体与分页唯一源。
- 统一响应体与分页结构：`ApiResponse`、`PageResult` 符合 `contracts/common.yaml`；列表默认 `pageSize=20`、上限 `100`。
- 双端统一 API 客户端：阅读站与后台均复用 `shared/api/*.js`，`fetch` 仅出现在各自 `src/platform/request.js`。
- **内容错误码 2001–2004 已实现**：`ApiErrorCode` 补齐 `TOPIC_NOT_FOUND(2001)`/`CATEGORY_NOT_FOUND(2002)`/`SEARCH_UNAVAILABLE(2003)`/`VISITOR_ID_INVALID(2004)`，由 `CategoryService`/`ContentService`/`LikeService` 在对应场景抛出，与 `contracts/content.yaml` 错误码表一致（端到端 curl 已验证）。
- **`/consultations/{orderNo}/note` 的 `adminNote` 必填已实现**：新增 `NoteUpdateRequest(@NotBlank @Size(max=500))` 专供 note 端点，`/complete` 继续复用 `NoteRequest(@Size(max=500))` 保持可选，契约 `validate` 同步修正为「长度 1-500」。

### 2.2 不一致与观察项（历史遗留，非本轮引入）

- **部分响应字段超出契约声明**：`GET /api/contents` 额外返回 `categoryCode/type`；后台内容接口返回完整 `ContentDetailView`，比契约声明字段更多。若按严格契约校验需收敛，或回 plan 更新契约。

## 三、宪法抽查

| 条款 | 检查项 | 结果 | 证据 |
|---|---|---|---|
| 1.3 | 新增第三方依赖需声明理由并经人工审查 | ✅ | `plan.md:321-326` §8.1 声明 `react-markdown`/`remark-gfm` 作用与引入理由（满足 Req-14 渲染；纯文本无法提供标题/加粗/列表/代码块层级），仅作用于 web-reader |
| 2.1 | 密钥/密码零入库 | ✅ | `application.yml` 仅引用 `${DATABASE_URL}` 等环境变量；`V2__seed_content.sql` 仅插入 topic/category/content，不含 `admin_user` 凭据或真实令牌（正文中 `password: 123456` 为 Redis 连接教学示例，非真实凭据） |
| 2.2 | 接口必鉴权 | ✅ | `JwtAuthFilter` 对 `/api/admin/**` 强制 JWT + ADMIN；冒烟验证管理员登录链路通过 |
| 2.4 | SQL 注入防护 | ✅ | Mapper XML 均使用 `#{}`；`V2__seed_content.sql` 的 content 插入为静态幂等 upsert，无用户输入拼接 |
| 7.5 | 禁止调试残留/死代码/TODO | ✅ | 本轮改动文件（ContentPage.jsx/module.css/test.jsx）无 `console.log/TODO/FIXME/debugger` |
| 1.2 | 禁止 JPA/Hibernate | ✅ | `pom.xml` 无 JPA/Hibernate，数据访问均为 MyBatis |

## 四、验收标准对照表

### Req-14（本轮核心）

| AC | 验收项 | 状态 | 证据 |
|---|---|---|---|
| AC-14.1 | 正文以 Markdown 存储，阅读站渲染出标题、加粗、列表、代码块视觉层级 | ✅ | `content/**/*.md` 正文为 Markdown；`ContentPage.jsx:146` 用 `ReactMarkdown remarkPlugins={[remarkGfm]}` 渲染；`ContentPage.module.css` 配套 h2/h3/p/ul/ol/code/pre/table 样式；冒烟验证详情链路可达 |
| AC-14.2 | 四种内容类型均遵循 `content-template.md` 固定分节骨架 | ✅ | `content-template.md` 定义 question/interview/article/resume 四类分节；220 条内容按此改造（question 190、interview 27、article 2、resume 1），抽样 `ai-agent-question-001`、`interview-alibaba-001` 分节正确 |
| AC-14.3 | 新增依赖（react-markdown、remark-gfm）在 plan 阶段声明理由并通过人工审查（宪法 1.3） | ✅ | `plan.md:321-326` §8.1 声明；本轮经 redo plan 人工审查通过 |
| AC-14.4 | 存量纯文本内容可被幂等脚本迁移为结构化 Markdown | ✅ | `V2__seed_content.sql` 采用「先清 migrated 引用与内容，再 `ON CONFLICT (code) DO UPDATE` 插入」；实测重复执行后内容仍为 220，无重复行 |

### Req-1 ~ Req-13（历史验收，与上轮一致）

| AC | 验收项 | 状态 | 证据 |
|---|---|---|---|
| AC-1.1 | 首页可见主题/专题目录及最新/推荐入口 | ✅ | `HomePage.jsx` / `HomePage.test.jsx` |
| AC-1.2 | 专题列表项含标题、摘要、更新时间 | ✅ | `CategoryPage.jsx` / `CategoryPage.test.jsx` |
| AC-1.3 | 空目录/空列表显示空态 | ✅ | 目录页三态测试 |
| AC-2.1 | 搜索命中标题、摘要、标签 | ✅ | `ContentMapper.xml#searchPublished` 三字段 ILIKE |
| AC-2.2 | 搜索只含已发布内容 | ✅ | 查询固定 `status='published'` |
| AC-2.3 | 无结果显示空态 | ✅ | `SearchPage.test.jsx` |
| AC-2.4 | 搜索 P95 < 1000ms | ⚠️ 需人工确认 | 无真实数据库压测 |
| AC-3.1 | 已发布详情完整展示 | ✅ | `ContentService.getPublishedDetail` |
| AC-3.2 | 不存在/草稿/归档返回统一“内容不存在” | ✅ | `CONTENT_NOT_PUBLISHED(2000)` |
| AC-3.3 | 有效阅读浏览数 +1，不采集用户级行为 | ✅ | 仅 `view_count + 1` |
| AC-3.4 | 详情 P95 < 500ms | ⚠️ 需人工确认 | 无真实数据库压测 |
| AC-4.1~4.4 | 点赞幂等与唯一约束 | ✅ | `uk_content_like(content_id, visitor_id)` + `DuplicateKeyException` 捕获 |
| AC-5.1~5.5 | 打赏留资单、金额枚举、微信提示 | ✅ | `TipOrderService` + `TIP_AMOUNT_CENTS` |
| AC-6.1~6.5 | 咨询订单、联系方式校验、前 10 免费 | ✅ | `ConsultationOrderService` + `FREE_QUOTA_LIMIT=10` |
| AC-7.1~7.4 | 订单状态流转 | ✅ | `AdminOrderService` + 状态前置校验 |
| AC-8.1~8.3 | 唯一管理员登录与鉴权 | ✅ | `AdminBootstrapRunner` + `JwtAuthFilter` |
| AC-9.1~9.4 | 内容全生命周期与乐观锁 | ✅ | `AdminContentService` + `version` |
| AC-10.1~10.3 | 发布人工审核与可见性 | ✅ | `PublishRequest.reviewConfirmed` |
| AC-11.1~11.4 | 订单列表与操作日志 | ✅ | `AdminOrderService` + `OperationLogServiceImpl` |
| AC-12.1~12.3 | 入参校验与统一错误 | ✅ | Controller 约束 + `GlobalExceptionHandler` |
| AC-13.1~13.3 | 首屏/列表/详情/搜索性能 | ⚠️ 需人工确认 | 无真实性能实测 |
| AC-13.4 | 失败/超时展示重试入口 | ✅ | 阅读站各页面三态/重试 |

## 五、回链完整性

- `tasks.md` 覆盖检查表：Req-14 → T-29、T-30、T-31；Req-3 补充 T-29。
- T-29（Markdown 渲染）、T-30（内容改造）、T-31（seed 生成与幂等导入）均已完成并通过各自验证命令。
- 数据库实测：内容总数 220（`migrated + published`），type 分布 question=190 / interview=27 / article=2 / resume=1；`algorithm` 主题与 `algorithm-patterns` 分类已 `enabled=false`（前台不可见，数据保留）。
- 全部 14 条 Req 均有任务覆盖，无未覆盖需求。

## 六、遗留项清单

1. **契约一致性（已收敛）**：内容接口响应字段超契约问题已修复（后台内容变更接口返回契约最小视图，`contracts/content.yaml` 列表元素字段补齐）。
2. **性能类 AC 需人工实测**：AC-2.4、AC-3.4、AC-13.1~13.3 需在验收环境实测 P95/首屏数据。
3. **构建体积**：`web-admin` 产物超 500 kB chunk 警告，建议按路由拆包。

> 结论：本轮 Req-14（内容结构化与 Markdown 渲染）无阻断项，端到端冒烟通过；内容接口响应字段超契约已收敛，遗留项为性能类验收项与构建体积，不阻断内容改造交付，建议提交人工终审逐条确认。
