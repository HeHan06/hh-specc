## 问题

MCP Tool 和普通 HTTP API 有什么关系？

## 考察点

- 是否理解 MCP Tool 不是替代 HTTP API 而是上层包装
- 能否从描述层、连接层、调用传输层说明三层嵌套关系
- 是否有「统一管理 HTTP API」的价值认知

## 标准答案

### 关系定位

MCP Tool 不是替代 HTTP API 的，而是 HTTP API 的上层包装。

### 三层嵌套关系

1. 描述层：普通 HTTP 文档是写给人看的，人读懂了再写代码；MCP Tool 要求为模型提供接口描述、参数描述、输入输出 schema，让模型能像人读文档一样理解工具作用，是面向 AI 的语义层面。
2. 连接层：普通 HTTP API 通常各自独立部署和鉴权；MCP Tool 部署在 MCP Server 内，统一管理连接和认证，所有 tool 共享一个安全上下文，不用每个接口单独维护凭证。
3. 调用和传输层：MCP Tool 底层执行时，完全可以就是普通 HTTP API 的调用。

### 代码视角

一个 MCP Tool 的 handler 函数里通常就是三步：1）解析模型传来的参数；2）调用对应的 HTTP API；3）返回结果给模型。整个过程 MCP 只是在 HTTP API 外面加了一层标准化的壳。

### 价值

MCP Tool 不能替代 HTTP API，但能统一管理 HTTP API。以前每接一个新服务既要看文档写代码、又要配置认证、还要处理错误格式；MCP 的做法是一个 Server 启动时声明自己的工具列表，Client 自动获取、自动转换为 Function Calling 的 tools 格式，10 个 HTTP API 配一次而不是 10 次。

## 关联

- MCP、HTTP API、工具发现、鉴权、Function Calling、标准化
