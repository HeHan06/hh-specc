-- 初始化 ai-guide 数据库结构（唯一源：plan.md 第 4 节数据模型）
-- 执行方式：psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/src/main/resources/db/migration/V1__init_ai_guide.sql
-- 说明：本迁移只建表、约束、索引与配额初始化，不写入任何账号密码/令牌（见宪法 2.1）。

-- 管理员（全平台唯一账号，角色固定 ADMIN；密码哈希由 AdminBootstrapRunner 从环境变量初始化）
CREATE TABLE admin_user (
    id            BIGSERIAL PRIMARY KEY,
    username      VARCHAR(64)  NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    role          VARCHAR(32)  NOT NULL DEFAULT 'ADMIN',
    status        VARCHAR(16)  NOT NULL DEFAULT 'enabled',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_admin_user_role   CHECK (role = 'ADMIN'),
    CONSTRAINT ck_admin_user_status CHECK (status IN ('enabled', 'disabled'))
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
    type          VARCHAR(20)  NOT NULL,
    title         VARCHAR(200) NOT NULL,
    summary       TEXT         NOT NULL,
    body          TEXT         NOT NULL,
    tags          TEXT[]       NOT NULL DEFAULT '{}',
    source        VARCHAR(16)  NOT NULL,
    status        VARCHAR(20)  NOT NULL,
    recommended   BOOLEAN      NOT NULL DEFAULT FALSE,
    like_count    INTEGER      NOT NULL DEFAULT 0,
    view_count    BIGINT       NOT NULL DEFAULT 0,
    version       INTEGER      NOT NULL DEFAULT 0,
    published_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_content_type    CHECK (type IN ('article', 'interview', 'question', 'resume')),
    CONSTRAINT ck_content_source   CHECK (source IN ('original', 'migrated')),
    CONSTRAINT ck_content_status   CHECK (status IN ('draft', 'published', 'unpublished', 'archived')),
    CONSTRAINT ck_content_title    CHECK (char_length(trim(title)) > 0),
    CONSTRAINT ck_content_summary  CHECK (char_length(trim(summary)) > 0),
    CONSTRAINT ck_content_body     CHECK (char_length(trim(body)) > 0),
    CONSTRAINT ck_content_like_cnt CHECK (like_count >= 0),
    CONSTRAINT ck_content_view_cnt CHECK (view_count >= 0)
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
    status          VARCHAR(20)  NOT NULL,
    received_at     TIMESTAMPTZ,
    closed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_tip_amount CHECK (amount_cents IN (10, 100, 500, 1000, 5000, 10000)),
    CONSTRAINT ck_tip_status CHECK (status IN ('submitted', 'received', 'closed'))
);
CREATE INDEX idx_tip_order_status_created ON tip_order(status, created_at DESC);

CREATE TABLE consultation_order (
    id                BIGSERIAL PRIMARY KEY,
    order_no          VARCHAR(40)  NOT NULL UNIQUE,
    contact_name      VARCHAR(50)  NOT NULL,
    contact_type      VARCHAR(16)  NOT NULL,
    contact_value     VARCHAR(100) NOT NULL,
    topic_text        VARCHAR(200) NOT NULL,
    request_text      TEXT         NOT NULL,
    expected_time     TIMESTAMPTZ  NOT NULL,
    price_cents       INTEGER      NOT NULL,
    free_quota_used   BOOLEAN      NOT NULL DEFAULT FALSE,
    status            VARCHAR(20)  NOT NULL,
    admin_note        TEXT,
    confirmed_at      TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    canceled_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_consultation_contact_name CHECK (char_length(trim(contact_name)) > 0),
    CONSTRAINT ck_consultation_contact_type CHECK (contact_type IN ('phone', 'wechat')),
    CONSTRAINT ck_consultation_topic        CHECK (char_length(trim(topic_text)) > 0),
    CONSTRAINT ck_consultation_request      CHECK (char_length(trim(request_text)) > 0),
    CONSTRAINT ck_consultation_price        CHECK (price_cents IN (0, 50000)),
    CONSTRAINT ck_consultation_status       CHECK (status IN ('submitted', 'confirmed', 'completed', 'canceled'))
);
CREATE INDEX idx_consultation_status_created ON consultation_order(status, created_at DESC);

-- 免费名额控制：单行 + 行级锁串行化确认排期，used_count 上限 10
CREATE TABLE consultation_quota (
    id          SMALLINT PRIMARY KEY DEFAULT 1,
    used_count  INTEGER NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_consultation_quota_id   CHECK (id = 1),
    CONSTRAINT ck_consultation_quota_used CHECK (used_count BETWEEN 0 AND 10)
);

CREATE TABLE operation_log (
    id            BIGSERIAL PRIMARY KEY,
    admin_user_id BIGINT      NOT NULL REFERENCES admin_user(id),
    action        VARCHAR(64) NOT NULL,
    target_type   VARCHAR(32) NOT NULL,
    target_code   VARCHAR(64) NOT NULL,
    before_state  VARCHAR(32),
    after_state   VARCHAR(32),
    detail        JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_operation_log_target ON operation_log(target_type, target_code);
CREATE INDEX idx_operation_log_created ON operation_log(created_at DESC);

-- 统一 updated_at 自动维护触发器
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
