## 问题

大模型 API 调用的完整链路是什么？

## 考察点

- 是否掌握请求构建、发送、错误处理、响应处理、监控观测五个阶段
- 是否有 token 校验、幂等、重试、降级的工程意识
- 是否理解 finish_reason 与 usage 等字段的价值

## 标准答案

### 第一阶段：请求构建

- 按优先级组装 prompt：系统提示词、用户当前输入、对话历史、RAG 检索结果。
- 用 tiktoken 做 token 计数校验，确保总 token 不超过「窗口 - max_tokens - 5% 安全余量」，否则上线后会出现随机截断。
- 按任务类型设置 Temperature 和 max_tokens：事实类 Temperature=0，创意类适当调高。

### 第二阶段：发送请求

- HTTP POST 到 endpoint，带认证信息和合理超时配置。
- 分开设置连接超时（通常 5-10s）和读取超时（按 max_tokens 估算，一般 60-120s，流式更宽容）。
- 请求体带 idempotency_key 做幂等保证。

### 第三阶段：错误处理和重试

- 4xx 客户端错误不重试，记录日志并告警。
- 429 限流读取 Retry-After 字段，等够时间重试，同时触发客户端限流保护。
- 5xx 和网络超时用指数退避重试（1s、2s、4s，最多 3 次），加随机 jitter 避免惊群效应。
- 重试时必须带相同的 idempotency_key，防止重复消费。

### 第四阶段：响应处理

- 检查 HTTP 状态码，try-catch 解析 JSON，不假设格式一定对。
- 重点看三个字段：content 内容本身；finish_reason（stop 正常、length 被截断、content_filter 触发安全审查）；usage 里的 token 消耗用于成本核算。
- 要求结构化输出时，先尝试 json.loads，解析失败触发重试或降级。

### 第五阶段：监控观测

- 记录端到端延迟、首 token 延迟、prompt/completion token 数、finish_reason 分布、按类型的错误率，做成监控大盘并设告警（如限流错误率超 5% 告警、finish_reason=length 比例突增就查 max_tokens 配置）。

### 全链路关键设计：多层降级

主模型 → 同厂商轻量模型 → 备选厂商模型 → 静态兜底回复，每层降级有独立超时和重试配置，不影响上一层恢复。

## 关联

- tiktoken、finish_reason、idempotency_key、指数退避、Retry-After、降级链路
