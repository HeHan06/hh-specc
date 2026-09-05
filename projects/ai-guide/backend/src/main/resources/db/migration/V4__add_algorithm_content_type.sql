-- V4：新增内容类型 algorithm（算法题模板，含解题思路与代码模板）
-- 原 ck_content_type 仅允许 article/interview/question/resume，此处放开 algorithm。

ALTER TABLE content DROP CONSTRAINT ck_content_type;

ALTER TABLE content ADD CONSTRAINT ck_content_type
    CHECK (type IN ('article', 'algorithm', 'interview', 'question', 'resume'));
