## 问题

AI 应用的调用日志里至少要记录哪些字段？

## 考察点

- 是否理解 AI 日志除了排查故障还要回答「花了多少钱」和「为什么回答不完整」
- 能否按五组字段系统列出记录内容
- 是否有分层存储策略（全量 vs 采样、文本存对象存储）

## 标准答案

### 日志设计目标

AI 应用日志与传统应用不一样——除了排查故障，还要回答「花了多少钱」和「为什么回答不完整」。按排查链路分成 5 组字段。

### 五组字段

1. 请求标识：request_id（贯穿全链路）、session_id（关联多轮对话）、timestamp（精确到毫秒）。
2. 请求内容：model（模型名）、input_prompt（全量存储实际发给模型的完整 prompt）、input_tokens（以 usage.prompt_tokens 为准，用于成本核算）。
3. 响应内容：output_content（原始输出全量文本不截断）、output_tokens、finish_reason（stop 正常、length 被截断、content_filter 触发安全审查）。线上最常见投诉是「回答不完整」，不看 finish_reason 分不清是模型不会答还是被截断。
4. 性能与成本：TTFT（首 token 时延）、E2E latency（端到端延迟）、cost（本次实际费用）。cost 必须写入时实时计算固化，不能事后离线算，因为 API 定价可能调整，事后算的对不上账。
5. 异常与上下文：error_type（超时/限流/服务端错误/内容审查）、retry_count、userid（问题归因和成本分摊）。

### 存储策略

分两个通道：全量日志保存 7 天用于实时故障排查，采样日志保留 90 天用于成本分析和模型效果回归。文本字段建议存对象存储，数据库只保留元数据和引用路径——prompt 和 output 可能动辄几十 KB，存关系库成本高且慢查询。

## 关联

- finish_reason、TTFT、usage.prompt_tokens、成本核算、对象存储、采样日志
