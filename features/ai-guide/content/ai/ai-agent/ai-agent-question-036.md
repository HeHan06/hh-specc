## 问题

SSE、WebSocket、HTTP Chunked 在流式输出场景下怎么选？

## 考察点

- 是否明确流式输出场景选 SSE 的结论与理由
- 能否从场景匹配、协议成本、基础设施兼容三个维度对比
- 是否知道 WebSocket 与 HTTP Chunked 的适用边界及 SSE 认证头注意点

## 标准答案

### 结论

大模型流式输出场景明确选择 SSE，这是业界事实标准，OpenAI、Anthropic、国内主流 API 全部用 SSE。

### 三个对比维度

1. 场景匹配度：大模型流式输出是纯粹的单向数据推送，SSE 为单向推送而设计；WebSocket 是双向全双工，功能过剩；HTTP Chunked 是最底层传输编码，处理无结构字节流而非消息帧，解析成本高。
2. 协议成本和工程复杂度：SSE 本质是 HTTP 长连接加简单文本格式（data:{}\n\n 一条消息，data:[DONE] 结束），前端原生 EventSource API 一行搞定且自带断线重连；WebSocket 要做协议升级握手、定帧格式、ping/pong 保活、重连逻辑，代码量差一个数量级。
3. 基础设施兼容性：SSE 跑在 HTTP 上可穿透绝大多数代理、负载均衡和 CDN；WebSocket 在企业网络常被防火墙拦截，B 端产品部署成本高。

### 什么时候考虑 WebSocket

只有一个场景——客户端需要在推理过程中发送控制指令，如点击「停止生成」、实时调整输出风格、多模态交互需同时收发。但即使要「停止生成」，在 SSE 连接上发 FIN 包也能 abort，真正需要 WebSocket 的场景很少。

### HTTP Chunked

不建议直接使用，现在后端框架都在 HTTP 上封装了 SSE 支持，不需要自己操作 chunked 传输层。

### SSE 工程要点

浏览器原生 EventSource API 不支持自定义请求头，没法传 Authorization 认证。生产代码通常用 fetch API 手动读取响应 readableStream 按 SSE 格式逐行解析，既能带认证头也能完整控制流式处理；APP 场景用原生 URLSession 或 OKHttp 则无此限制。

## 关联

- SSE、WebSocket、HTTP Chunked、EventSource、全双工、认证头
