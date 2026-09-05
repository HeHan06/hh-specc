-- V3: 移除付费咨询与打赏订单能力，新增动态广告位（合规替代：联系方式引流到闲鱼等第三方平台）。
-- 说明：订单相关表与触发器一并删除；advertisement 采用单行（id=1）承载唯一广告位，
--       无预置内容，默认不显现；后台保存时以 UPSERT 写入 id=1。

DROP TRIGGER IF EXISTS trg_tip_order_updated_at ON tip_order;
DROP TRIGGER IF EXISTS trg_consultation_order_updated_at ON consultation_order;
DROP TRIGGER IF EXISTS trg_consultation_quota_updated_at ON consultation_quota;

DROP TABLE IF EXISTS tip_order;
DROP TABLE IF EXISTS consultation_order;
DROP TABLE IF EXISTS consultation_quota;

-- 动态广告位：单行槽位，有配置且 enabled 时才在阅读站显现。
CREATE TABLE advertisement (
    id          SMALLINT    PRIMARY KEY DEFAULT 1,
    title       VARCHAR(100) NOT NULL,
    description TEXT,
    link        VARCHAR(500) NOT NULL,
    enabled     BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_advertisement_id    CHECK (id = 1),
    CONSTRAINT ck_advertisement_title CHECK (char_length(trim(title)) > 0),
    CONSTRAINT ck_advertisement_link  CHECK (char_length(trim(link)) > 0)
);

CREATE TRIGGER trg_advertisement_updated_at BEFORE UPDATE ON advertisement FOR EACH ROW EXECUTE FUNCTION set_updated_at();
