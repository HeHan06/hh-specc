# 技术方案：ai-guide

## 1. 方案概述

`ai-guide` 代码归档于 `projects/ai-guide/{web-reader,web-admin,backend,shared}`；以「Web 阅读站 + Web 管理后台」两个 Web 端交付，均采用 React 18 + JavaScript + Vite + Ant Design；后端采用 Java 17 + Spring Boot 3 + MyBatis + PostgreSQL；双端共享纯逻辑放入 `shared/`。阅读站面向匿名访客，提供「主题 → 专题 → 内容」目录浏览、搜索、阅读、点赞、打赏与付费咨询；管理后台仅允许单一管理员登录，负责内容维护、发布前人工审核与订单处理。本期不实现微信小程序（见 `spec.md` 第 3 节「不做什么」）。

关键取舍：阅读站与后台拆成两个独立前端工程但共享 `shared/`，避免把匿名公开端与高权限管理端混在同一打包体；不接入在线支付（无商户资质），打赏与付费咨询统一改为「加管理员微信」线下收款，访客留资后展示管理员微信号，管理员在后台确认收款/排期；内容状态机、订单状态机与契约在本阶段锁定，implement 阶段不得私改。

## 2. 前端设计

### 2.1 Web 阅读站（web-reader/）

| 页面/路由 | 功能 | 对应需求 |
|---|---|---|
| `/` | 首页：展示主题/专题目录、最新内容、推荐内容、空态 | Req-1 |
| `/topics/:topicCode` | 主题详情：该主题下启用的专题与内容入口 | Req-1 |
| `/categories/:categoryCode` | 专题内容列表：分页展示标题、摘要、更新时间，含空态 | Req-1 |
| `/contents/:contentCode` | 内容详情：正文（Markdown 渲染）、标签、来源、时间、点赞/浏览数；点赞入口；打赏入口；付费咨询入口 | Req-3、Req-4、Req-5、Req-6、Req-14 |
| `/search` | 搜索结果：按标题/摘要/标签检索已发布内容，含无结果空态与失败重试 | Req-2 |
| `/consultation/new` | 付费咨询表单：联系人、手机/微信、咨询主题、诉求、期望时间；提交后展示加微信收款提示 | Req-6 |
| `/orders/tips/:orderNo` | 打赏留资单状态：展示管理员微信号与收款状态 | Req-5、Req-7 |
| `/orders/consultations/:orderNo` | 咨询订单状态：展示管理员微信号与收款状态 | Req-6、Req-7 |

正文渲染：`body` 为结构化 Markdown（唯一真相源 `content-template.md`），阅读站用 `react-markdown` + `remark-gfm` 渲染并配套排版样式（新增依赖声明见 §8.1）。

前端分层：`src/pages/` → `src/services/` → `src/api/` → `shared/`，`fetch` 只允许出现在 `src/platform/request.js`。所有列表页实现 `loading` / `error` / 空 三态；`useEffect` 使用 `cancelled` 防竞态；组件与 service 标注 `@capability` / `@capabilityPoint` / `@orchestrate`（编号对齐 `spec.md` 与 `tasks.md`，禁止臆造）。

### 2.2 Web 管理后台（web-admin/）

| 页面/路由 | 功能 | 对应需求 |
|---|---|---|
| `/login` | 管理员登录：统一失败提示，不泄露账号是否存在 | Req-8 |
| `/contents` | 内容列表：按类型、状态、专题、关键词筛选，分页 | Req-9 |
| `/contents/new` | 新建内容：保存草稿或发布 | Req-9、Req-10 |
| `/contents/:contentCode/edit` | 编辑内容：携带 `version`，冲突时提示重新加载 | Req-9、Req-10 |
| `/topics` | 主题管理：新增/编辑/启用/停用 | Req-9 |
| `/categories` | 专题管理：新增/编辑/启用/停用 | Req-9 |
| `/orders/tips` | 打赏订单：列表/详情/收款确认/关闭 | Req-11 |
| `/orders/consultations` | 咨询订单：列表/详情/确认排期/完成/取消/备注 | Req-11 |
| `/operation-logs` | 操作日志：查看敏感操作留痕 | Req-11、宪法 7.4 |

后台采用 RBAC：用户 → 角色（唯一 `ADMIN`）→ 权限点。前端只做菜单/按钮显隐，后端接口级校验为强制项。所有危险操作使用 `Popconfirm` 二次确认；接口封装统一走 `shared/` API 客户端。

### 2.3 小程序（miniprogram/）

本期不实现。`spec.md` 已明确「不做 App 与小程序；本期仅 Web 阅读站 + Web 管理后台」。契约与代码结构不预留未获批准的小程序页面。

### 2.4 双端共享（shared/）

| 共享项 | 类型 | 说明 |
|---|---|---|
| `shared/types/content.js` | 类型定义 | JSDoc 定义 `TopicView`、`CategoryView`、`ContentView`、`ContentType`、`ContentStatus` |
| `shared/types/order.js` | 类型定义 | `TipOrderView`、`ConsultationOrderView`、订单状态枚举 |
| `shared/constants/content.js` | 常量 | 内容类型、来源、状态枚举值与文案 |
| `shared/constants/order.js` | 常量 | 打赏金额档位（分）、咨询计价、订单状态枚举 |
| `shared/constants/error-code-text.js` | 常量 | 通用错误码与各模块错误码的前端默认文案映射 |
| `shared/utils/money.js` | 工具 | `fenToYuan` / `yuanToFen` 金额换算 |
| `shared/utils/validate.js` | 校验规则 | 手机/微信、搜索词长度、分页参数、金额档位、咨询表单校验 |
| `shared/api/client.js` | API客户端 | 平台无关请求基座；注入 `request` 适配器，统一解包响应体 |
| `shared/api/content.js` | API客户端 | 阅读站内容/目录/搜索/点赞接口 |
| `shared/api/order.js` | API客户端 | 打赏/咨询订单接口 |
| `shared/api/admin.js` | API客户端 | 后台登录、内容管理、订单管理接口 |

规则：`shared/` 只放与平台无关的纯逻辑，禁止 DOM、`fetch`、React 组件、路由；Web 阅读站与后台分别注入 `fetch` 适配器。

## 3. 后端设计（backend/）

- 项目根包：`com.aiguide`
- 涉及模块：
  - `content`：`TopicController` / `CategoryController` / `ContentController` / `LikeController` 及对应 Service、Mapper，负责阅读站公开内容能力。
  - `admin`：`AdminAuthController`、`AdminContentController`、`AdminOrderController`、`OperationLogController`，负责后台鉴权与管理。
  - `order`：`TipOrderController`、`ConsultationOrderController` 及对应 Service、Mapper，负责留资单创建、查询与状态机。
  - `config`：站点级配置（管理员微信号等）的读取与下发，供阅读站展示加微信提示。
  - `common`：统一响应体、全局异常处理、JWT 校验过滤器、操作日志切面。

- 关键类/分层职责：
  - Controller：入参校验、鉴权声明、统一响应体包装，不写业务逻辑。
  - Service：业务规则与状态机；所有写操作声明事务边界；关键敏感操作记录操作日志。
  - Mapper：MyBatis XML/注解访问；所有用户输入使用 `#{}`，禁止 `${}` 拼接 SQL。

- 事务与并发要点：
  - 点赞幂等：依赖 `content_like` 的 `UNIQUE(content_id, visitor_id)`，重复请求捕获唯一键冲突后返回当前计数与 `liked=true`；点赞数与记录在同一事务更新。
  - 浏览数：`UPDATE content SET view_count = view_count + 1 WHERE code = #{code} AND status = 'published'`；不采集用户级行为。
  - 内容编辑：`content.version` 作为乐观锁，更新 SQL 为 `WHERE code = #{code} AND version = #{version}`，影响行数为 0 返回并发冲突。
  - 咨询免费名额：`consultation_quota` 单行 `FOR UPDATE` 串行化确认；`used_count <= 10`；管理员确认排期时占用名额（前 10 个确认订单免费），取消已确认的免费订单释放名额。
  - 收款确认：打赏订单由管理员确认收款置为已收款并记录收款时间；咨询订单由管理员确认排期置为已确认并记录确认时间。
  - 敏感操作：收款确认、取消、状态变更通过操作日志切面，先校验 `ADMIN` 角色再落日志；日志写入与业务更新同事务。

- 需求落点：
  - Req-1：`GET /api/topics`、`GET /api/categories`、`GET /api/contents`、`GET /api/contents/latest`、`GET /api/contents/recommended`。
  - Req-2：`GET /api/contents/search`。
  - Req-3：`GET /api/contents/{contentCode}`（仅返回 `published`，累计浏览数）。
  - Req-4：`POST /api/contents/{contentCode}/likes`。
  - Req-5：`POST /api/tips`（创建打赏留资单）、`GET /api/tips/{orderNo}`（查询状态与管理员微信号）。
  - Req-6：`POST /api/consultations`（创建咨询订单）、`GET /api/consultations/{orderNo}`（查询状态与管理员微信号）。
  - Req-7：`GET /api/site/config`（下发管理员微信号）以及后台收款状态流转接口 `POST /api/admin/tips/{orderNo}/receive`、`POST /api/admin/consultations/{orderNo}/confirm`。
  - Req-8：`POST /api/admin/auth/login`，JWT 校验过滤全部 `/api/admin/**`。
  - Req-9：`/api/admin/topics`、`/api/admin/categories`、`/api/admin/contents` 及内容状态流转接口。
  - Req-10：`POST /api/admin/contents/{contentCode}/publish` 强制要求人工审核确认参数。
  - Req-11：`/api/admin/tips`、`/api/admin/consultations` 及状态流转、收款确认/关闭接口。
  - Req-12：统一全局异常处理 + 各接口入参校验 + 前端统一拦截器。
  - Req-13：内容接口响应设计满足 P95 指标，前端失败态与重试入口由三态样板保证。

## 4. 数据模型（PostgreSQL）

```sql
-- backend/src/main/resources/db/migration/V1__init_ai_guide.sql

CREATE TABLE admin_user (
    id            BIGSERIAL PRIMARY KEY,
    username      VARCHAR(64)  NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    role          VARCHAR(32)  NOT NULL DEFAULT 'ADMIN' CHECK (role = 'ADMIN'),
    status        VARCHAR(16)  NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE topic (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(64)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_topic_name CHECK (char_length(trim(name)) > 0)
);

CREATE TABLE category (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(64)  NOT NULL UNIQUE,
    topic_id    BIGINT       NOT NULL REFERENCES topic(id),
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_category_name CHECK (char_length(trim(name)) > 0)
);
CREATE INDEX idx_category_topic_enabled ON category(topic_id, enabled);

CREATE TABLE content (
    id            BIGSERIAL PRIMARY KEY,
    code          VARCHAR(64)  NOT NULL UNIQUE,
    category_id   BIGINT       NOT NULL REFERENCES category(id),
    type          VARCHAR(20)  NOT NULL CHECK (type IN ('article', 'interview', 'question', 'resume')),
    title         VARCHAR(200) NOT NULL,
    summary       TEXT         NOT NULL,
    body          TEXT         NOT NULL,
    tags          TEXT[]       NOT NULL DEFAULT '{}',
    source        VARCHAR(16)  NOT NULL CHECK (source IN ('original', 'migrated')),
    status        VARCHAR(20)  NOT NULL CHECK (status IN ('draft', 'published', 'unpublished', 'archived')),
    recommended   BOOLEAN      NOT NULL DEFAULT FALSE,
    like_count    INTEGER      NOT NULL DEFAULT 0 CHECK (like_count >= 0),
    view_count    BIGINT       NOT NULL DEFAULT 0 CHECK (view_count >= 0),
    version       INTEGER      NOT NULL DEFAULT 0,
    published_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_content_title CHECK (char_length(trim(title)) > 0),
    CONSTRAINT ck_content_summary CHECK (char_length(trim(summary)) > 0),
    CONSTRAINT ck_content_body CHECK (char_length(trim(body)) > 0)
);
CREATE INDEX idx_content_category_status ON content(category_id, status);
CREATE INDEX idx_content_published_at ON content(published_at DESC) WHERE status = 'published';
CREATE INDEX idx_content_recommended ON content(published_at DESC) WHERE status = 'published' AND recommended;
CREATE INDEX idx_content_tags ON content USING GIN(tags);

-- 中文搜索依赖 pg_trgm；若数据库不具备建扩展权限，SearchService 回退到 ILIKE 顺序扫描。
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_content_title_trgm ON content USING GIN(title gin_trgm_ops);
CREATE INDEX idx_content_summary_trgm ON content USING GIN(summary gin_trgm_ops);

CREATE TABLE content_like (
    id          BIGSERIAL PRIMARY KEY,
    content_id  BIGINT      NOT NULL REFERENCES content(id),
    visitor_id  VARCHAR(64) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_content_like UNIQUE (content_id, visitor_id),
    CONSTRAINT ck_visitor_id CHECK (char_length(trim(visitor_id)) BETWEEN 8 AND 64)
);
CREATE INDEX idx_content_like_content ON content_like(content_id);

CREATE TABLE tip_order (
    id              BIGSERIAL PRIMARY KEY,
    order_no        VARCHAR(40)  NOT NULL UNIQUE,
    content_id      BIGINT       REFERENCES content(id),
    amount_cents    INTEGER      NOT NULL,
    contact_name    VARCHAR(50),
    contact_value   VARCHAR(100),
    message         TEXT,
    status          VARCHAR(20)  NOT NULL CHECK (status IN ('submitted', 'received', 'closed')),
    received_at     TIMESTAMPTZ,
    closed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_tip_amount CHECK (amount_cents IN (10, 100, 500, 1000, 5000, 10000))
);
CREATE INDEX idx_tip_order_status_created ON tip_order(status, created_at DESC);

CREATE TABLE consultation_order (
    id                BIGSERIAL PRIMARY KEY,
    order_no          VARCHAR(40)  NOT NULL UNIQUE,
    contact_name      VARCHAR(50)  NOT NULL,
    contact_type      VARCHAR(16)  NOT NULL CHECK (contact_type IN ('phone', 'wechat')),
    contact_value     VARCHAR(100) NOT NULL,
    topic_text        VARCHAR(200) NOT NULL,
    request_text      TEXT         NOT NULL,
    expected_time     TIMESTAMPTZ  NOT NULL,
    price_cents       INTEGER      NOT NULL CHECK (price_cents IN (0, 50000)),
    free_quota_used   BOOLEAN      NOT NULL DEFAULT FALSE,
    status            VARCHAR(20)  NOT NULL CHECK (status IN ('submitted', 'confirmed', 'completed', 'canceled')),
    admin_note        TEXT,
    confirmed_at      TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    canceled_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_consultation_contact_name CHECK (char_length(trim(contact_name)) > 0),
    CONSTRAINT ck_consultation_topic CHECK (char_length(trim(topic_text)) > 0),
    CONSTRAINT ck_consultation_request CHECK (char_length(trim(request_text)) > 0)
);
CREATE INDEX idx_consultation_status_created ON consultation_order(status, created_at DESC);

CREATE TABLE consultation_quota (
    id          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    used_count  INTEGER NOT NULL DEFAULT 0 CHECK (used_count BETWEEN 0 AND 10),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE operation_log (
    id           BIGSERIAL PRIMARY KEY,
    admin_user_id BIGINT      NOT NULL REFERENCES admin_user(id),
    action       VARCHAR(64)  NOT NULL,
    target_type  VARCHAR(32)  NOT NULL,
    target_code  VARCHAR(64)  NOT NULL,
    before_state VARCHAR(32),
    after_state  VARCHAR(32),
    detail       JSONB,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_operation_log_target ON operation_log(target_type, target_code);
CREATE INDEX idx_operation_log_created ON operation_log(created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_admin_user_updated_at BEFORE UPDATE ON admin_user FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_topic_updated_at BEFORE UPDATE ON topic FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_category_updated_at BEFORE UPDATE ON category FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_content_updated_at BEFORE UPDATE ON content FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tip_order_updated_at BEFORE UPDATE ON tip_order FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_consultation_order_updated_at BEFORE UPDATE ON consultation_order FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_consultation_quota_updated_at BEFORE UPDATE ON consultation_quota FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 初始化唯一免费名额控制行
INSERT INTO consultation_quota (id, used_count) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;
```

- 迁移策略：版本化 SQL 位于 `backend/src/main/resources/db/migration/`，使用 `psql "$DATABASE_URL" -f <file>` 顺序执行；本期不引入 Flyway/Liquibase，避免新增清单外依赖。管理员账号通过 `AdminBootstrapRunner` 从环境变量初始化：生产环境读取 `ADMIN_USERNAME` 与 `ADMIN_PASSWORD_HASH`（BCrypt）；本地开发可在首次启动时读取 `ADMIN_INITIAL_PASSWORD` 生成哈希，密码不入库、不入日志。
- 管理员微信号通过环境变量 `ADMIN_WECHAT_ID` 配置（默认 `15306507997`），经 `GET /api/site/config` 下发给阅读站展示，不入库、不入前端打包产物。
- 金额单位：所有金额字段使用「分」整数；时间使用 `TIMESTAMPTZ`，契约返回 ISO-8601 UTC 字符串。
- 软删除约定：内容不物理删除，通过 `status='archived'` 表达终态；主题/专题通过 `enabled` 控制可见性。

## 5. 接口契约

- 契约文件：
  - `contracts/common.yaml`：统一响应体、分页约定与 `1000-1099` 通用错误码唯一源。
  - `contracts/content.yaml`：目录/搜索/详情/点赞，错误码段 `2000-2099`。
  - `contracts/tip.yaml`：打赏留资单，错误码段 `2100-2199`。
  - `contracts/consultation.yaml`：付费咨询订单，错误码段 `2200-2299`。
  - `contracts/admin.yaml`：后台登录、内容/目录管理、订单管理、操作日志，错误码段 `2300-2399`。
  - `contracts/site.yaml`：站点公开配置（管理员微信号下发），错误码段 `2400-2499`。
- 本需求错误码段：内容 `2000-2099`；打赏 `2100-2199`；咨询 `2200-2299`；后台 `2300-2399`；站点 `2400-2499`；通用 `1000-1099`（见 `contracts/common.yaml`，各模块只引用、不复制）。
- `audience` 取值在本需求内为 `web-reader` / `web-admin` / `both`；`both` 表示 Web 阅读站与后台共用，本期无小程序，不使用 `miniprogram`。
- 分页默认值遵循 `spec.md` 第 4 节：`pageSize` 默认 20、上限 100（覆盖平台层通用默认 10；上限保持一致）。
- 契约四要素自检：统一响应体 ✅ / 错误码表 ✅ / 认证标注 ✅ / 分页约定 ✅

## 6. 关键技术决策与理由

| 决策 | 备选 | 选择理由 |
|---|---|---|
| 阅读站与后台拆为两个独立 Vite 工程 | 单工程内路由隔离 | 匿名公开端与管理端安全边界、部署粒度、依赖面均不同；两工程复用 `shared/`，避免重复实现 |
| 阅读站采用 React 18 + JS + Vite + Ant Design | 另引入轻量 UI 库 | 宪法第一条锁定的 Web 技术栈，阅读站与后台保持同一工程形态，不新增清单外 UI 库 |
| 不接入在线支付，统一「加管理员微信」线下收款 | 接入支付宝/微信支付 SDK | 无商户资质，避免第三方 SDK 审批与密钥管理成本；留资 + 人工收款满足匿名打赏与咨询场景 |
| 搜索用 `pg_trgm` GIN 索引 + `ILIKE`，不可建扩展时回退 `ILIKE` | Elasticsearch / PostgreSQL 中文分词插件 | 无新增第三方服务；内容量级小，满足搜索 P95 < 1000ms |
| 匿名访客标识为前端 UUID v4，存 `localStorage`，经 `X-Visitor-Id` 请求头传递 | cookie / 后端设备指纹 | 不采集个人身份信息，满足最小必要；后端只做格式与长度校验 |
| 咨询免费名额采用 `used_count` 行级锁控制，确认排期时占用 | 创建订单时即锁定名额 | 以管理员确认排期为免费判定时机，避免未成交订单占用名额；取消已确认免费订单释放名额 |
| 内容并发编辑使用 `version` 乐观锁 | 最后写入覆盖 | 满足 `spec.md` Req-9「冲突时提示重新加载，不静默覆盖」 |
| 迁移用版本化 SQL + `psql` 执行 | Flyway/Liquibase | 与既有 `daily-quote` 工程一致，不引入清单外迁移依赖 |
| 管理员 JWT 单一 `ADMIN` 角色 | 多角色/细粒度权限表 | `spec.md` 明确仅单一管理员；预留 `role` 字段但不实现未批准的多角色 |
| 正文 Markdown 结构化 + `react-markdown`/`remark-gfm` 渲染 | 纯文本直渲染 | 满足 `spec.md` Req-14 的结构化与阅读体验；两依赖在 plan 声明（宪法 1.3），仅作用于 `web-reader` |

## 7. 风险与验证

- 风险：
  - 线下加微信收款依赖管理员人工操作，需在后台清晰展示留资信息（联系方式、留言、订单号），避免漏单；收款确认无自动对账，依赖管理员纪律。
  - `pg_trgm` 建扩展需要数据库权限；不具备时搜索退化为 `ILIKE`，需在验收环境验证 P95 是否仍满足 1000ms。
  - 匿名点赞/打赏依赖前端 `X-Visitor-Id`，更换设备/清空 `localStorage` 后无法保持同一访客身份，但符合匿名与最小必要原则。
  - 免费咨询名额在管理员确认排期时占用，取消已确认的免费订单需释放名额；需在集成测试覆盖占用与释放路径，避免名额泄漏或超发。
  - 公开订单查询用不可猜测 `orderNo`，仍应限制查询字段展示范围，避免通过 `GET /api/tips/{orderNo}` 枚举订单。
  - Web 静态托管需保证 `/api/*` 优先匹配，其余前端路由回退 `index.html`。
- 验证命令（供 tasks 阶段引用）：
  - 后端：`cd backend && ./mvnw test`
  - 数据库迁移：`psql "$DATABASE_URL" -f backend/src/main/resources/db/migration/V1__init_ai_guide.sql`
  - 共享层：`cd shared && npm run test && npm run build`
  - Web 阅读站：`cd web-reader && npm run test && npm run build`
  - Web 管理后台：`cd web-admin && npm run test && npm run build`

## 8. 内容结构化与数据迁移方案（Req-14）

### 8.1 新增第三方依赖声明（宪法 1.3）

| 依赖 | 作用 | 引入理由 |
|---|---|---|
| `react-markdown` | 阅读站渲染 Markdown 正文 | 满足 Req-14「阅读站以 Markdown 渲染正文」；纯文本直渲染无法提供标题/加粗/列表/代码块视觉层级 |
| `remark-gfm` | GFM 扩展（表格/任务列表/删除线） | `content-template.md` 骨架用到表格；GFM 是 CommonMark 通用扩展，无额外服务 |

- 仅作用于 `web-reader` 前端；后端与 `shared/` 不引入。
- 版本由 `package.json` 锁定，安装后回归 `npm run build` 与既有测试。

### 8.2 正文渲染方案

- `body` 字段语义为结构化 Markdown（唯一真相源 `content-template.md`），契约 `body` 字段已标注。
- 阅读站详情页用 `react-markdown` + `remark-gfm` 渲染，配套 `ContentPage.module.css` 的 Markdown 排版样式。
- 搜索仍按标题/摘要/标签检索，不检索 Markdown 正文（见 `spec.md` Req-2）。

### 8.3 内容拆分与改造方案

- 粒度：内容 = 最小内容单元（一道题一条 `question`；一篇面经一条 `interview`；一篇知识文一条 `article`；一份简历一条 `resume`），与 `content-template.md` 第 1 节一致。
- 桌面资料逐文件改写为结构化 Markdown，按「主题 → 专题」映射到 `topic`/`category`，`source=migrated`，并生成 `summary`/`tags`。

### 8.4 幂等 seed 导入方案

- 用版本化 SQL `backend/src/main/resources/db/migration/V2__seed_content.sql` 承载，`INSERT ... ON CONFLICT (code) DO UPDATE` 幂等，可重复执行。
- 不引入 Flyway/Liquibase，与 §4 迁移策略一致；seed 只写主题/专题/内容数据，不写账号密码/令牌（宪法 2.1）。
- 旧存量纯文本内容由脚本显式迁移为结构化 Markdown 后再重新导入。
