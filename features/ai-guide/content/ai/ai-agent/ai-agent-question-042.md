## 问题

JSON Mode 和 Structured Outputs（JSON Schema）有什么区别？

## 考察点

- 是否理解两者「语法合法 vs 语法与 Schema 都严格符合」的本质区别
- 能否说清 Structured Outputs 的约束解码与拒绝机制
- 是否有 Structured Outputs 可平替 Function Calling 的选型意识

## 标准答案

### 本质区别

JSON Mode 只保证语法合法，Structured Outputs 保证语法和 Schema 都严格符合。

### JSON Mode

- 设置 response_format: {"type": "json_object"}，再在 Prompt 里用自然语言描述期望的 JSON 格式。
- API 登场会强制模型输出以 { 开头，保证最终输出是一段合法的 JSON 字符串。
- 但它不会检查输出结果是否按 Prompt 的描述来。

### Structured Outputs

- 2024 年推出的第二代方案，直接在请求里传完整的 JSON Schema，定义字段名、类型、必填标识、枚举值和描述。
- API 在推理阶段使用约束解码技术——每生成一个 token 都过滤掉不符合 schema 规范的 token。
- 所以不仅能保证 JSON 语法正确，还能保证结构完全匹配。

### 关键差异：拒绝机制

- JSON Mode 不会拒绝：要求输出 JSON 就一定输出 JSON，哪怕内容不合理。
- Structured Outputs 如果判断 schema 在当前上下文无法满足，会返回一个 refusal 而不是硬编一个。

### 与 Function Calling 的关系

生产中使用的 Function Calling 大部分场景可平替为 Structured Outputs。Function Calling 本质是把工具调用伪装成结构化输出（输出函数名加 JSON 参数）；如果只是想要结构化数据而非真的调用函数，用 Structured Outputs 更直接、输出更干净、少一层解析。

## 关联

- JSON Mode、JSON Schema、约束解码、refusal、Function Calling
