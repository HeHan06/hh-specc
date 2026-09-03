## 问题

Function Calling 的完整链路是什么？

## 考察点

- 是否理解「模型决策、代码执行、结果回传」的循环本质
- 能否讲清五个步骤及 tool_call_id 匹配等关键约束
- 是否有循环上限、并行调用、失败处理、选型等工程意识

## 标准答案

### 本质

Function Calling 是「模型决策，代码执行，结果回传」的循环，不是模型自己去调函数。

### 五个步骤

1. 定义函数并发送请求：在 API 请求里带 tools 数组，每个工具包含函数名、描述和 JSON Schema 参数定义；模型拿到定义后判断用户问题是否需要调用某函数。
2. 模型返回调用指令：若需调用函数，响应里 finish_reason 是「tool_calls」而非「stop」，message 含 tool_calls 数组，每个 tool_call 有 id（唯一标识）、function name（函数名）、function arguments（JSON 参数字符串）。注意模型只生成参数，不执行任何代码。
3. 解析并执行函数：代码解析 tool_calls，按函数名路由到对应实现，把 arguments 做 JSON 解析后传入，做参数校验和异常捕获，执行结果序列化成字符串。
4. 结果回传并追加对话：把工具调用结果以 role=tool 的消息追加到 message 列表。两个关键约束：tool_call_id 必须与第二步返回的 id 精确匹配；必须保留历史 tool call 消息，对话历史不能断。
5. 继续循环或结束：把更新后的 message 再次发给模型，模型要么生成最终回复（finish_reason=stop），要么继续调用其他函数循环。

### 工程关键点

- 循环必须设上限（一般 5-10 次），否则模型反复调函数不满足会死循环烧光 API 预算。
- 并行调用要处理好：一个响应可能含多个 tool_calls，总延迟等于最慢的那个。
- 函数失败不要把错误信息抛给用户，把错误作为 tool result 正常回传给模型，让模型决定如何向用户解释。
- 选型：只要结构化数据输出不需要真正调外部函数，用 Structured Outputs 代替 Function Calling（不伪装工具调用、输出更干净）；Function Calling 只在确实需要触发外部系统操作时用。

## 关联

- tool_calls、finish_reason、JSON Schema、tool_call_id、并行调用、Structured Outputs
