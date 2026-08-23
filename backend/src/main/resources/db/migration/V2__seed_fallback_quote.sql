-- V2：预置兜底语录内容
-- 依赖 V1 创建的 system_config；使用 ON CONFLICT 保证重复执行不产生重复行。
-- 兜底内容属运营预置数据，入库可追溯，避免发布后修改仍需发版。

BEGIN;

INSERT INTO system_config (config_key, config_value, description) VALUES
    ('fallback.quote.content', '人生自苦，他人难悟，唯有自爱，方能自渡', '当日无上架语录时展示的默认正文'),
    ('fallback.quote.source', '《自渡》—— 佚名', '默认出处'),
    ('fallback.quote.backgroundImage', '/assets/images/fallback-bg.png', '默认背景图')
ON CONFLICT (config_key) DO UPDATE
SET config_value = EXCLUDED.config_value;

COMMIT;
