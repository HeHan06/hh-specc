## 问题

Function Calling 和 MCP 有什么区别？

## 考察点

- 是否理解二者不在同一层级、是协作而非替代
- 能否说清 Function Calling 是调用协议层、MCP 是工具发现与连接层
- 是否有 MCP 与 Function Calling 的分层分工与生产选型判断

## 标准答案

### 层级定位

它们不在同一层级，是协作而不是替代关系。

- Function Calling 是调用协议层：定义模型在一次 API 调用中如何表达「我要调用函数 A，参数是什么」，核心产物是 tool_calls 结构（函数名 + 参数），解决的是「格式层面」问题。
- MCP 是工具发现与连接层：全称 Model Context Protocol，是 Anthropic 在 2024 年底发布的开放协议，核心价值是标准化「模型如何发现外部世界有哪些工具可用」。

### MCP 的做法

启动一个 MCP Server，对外暴露三种能力——Tools（可执行函数）、Resources（可读取数据源）、Prompts（预定义提示词模板）。客户端通过 JSON-RPC 协议连接 server，自动获取工具列表，不需要手动复制粘贴。

### 分层分工

1. MCP 负责工具发现：应用启动时连接各 MCP Server，拉取它们暴露的 Tools 列表，转成 Function Calling 需要的 tools 数组格式。
2. Function Calling 负责调用决策：把 tools 列表和用户问题一起发给模型，模型输出 tool_calls 决定调哪个、传什么参数。
3. 应用代码负责执行和回传：解析 tool_calls，路由到对应函数实现，把结果以 tool message 形式传回模型。

### MCP 的三大优势

1. 解耦和复用：接入新工具只需对接一个 MCP Server，其他人也能复用，不用重复造轮子。
2. 跨模型兼容：开放协议不绑定任何模型厂商，同一 MCP Server 可被 Claude、GPT、本地开源模型用。
3. 动态发现：工具列表由 Server 端实时返回，Server 更新后客户端自动感知，无需改代码重新部署。

### 现状与选型

MCP 还在快速迭代，协议版本、安全机制、权限控制仍在建设。生产策略：内部工具链先试用 MCP 接入，面向用户的核心链路继续用成熟的 Function Calling 方案，两者并行，等 MCP 生态稳定后逐步迁移。

## 关联

- Model Context Protocol、tool_calls、JSON-RPC、工具发现、跨模型兼容
