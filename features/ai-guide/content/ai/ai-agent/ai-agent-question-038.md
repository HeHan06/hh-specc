## 问题

大模型限流为什么不能只按 QPS 做？

## 考察点

- 是否理解大模型 API 负载与 token 数强相关而非请求数
- 能否区分 TPM、RPM 与单请求上限三个维度
- 是否有三层嵌套限流与客户端预检的动态调节意识

## 标准答案

### 为什么不能只按 QPS

大模型 API 的成本和负载跟请求数不是线性关系，而是跟 token 数强相关。一个请求输入「你好」消耗 10 token，另一个请求粘贴整篇论文消耗 80k token，按 QPS 计数两者都是 1 次请求，但后者计算资源消耗是前者的几千倍。只用 QPS 限流会导致大请求放过去把 GPU 打满、小请求被错杀。

### 消耗的多维度

1. TPM（每分钟 token 消耗）：真正反映 GPU 负载的指标，token 数直接对应 FLOPs 计算量和显存占用，厂商核心限流策略都是 TPM 优先。
2. RPM（每分钟请求数）：防止连接层面打垮 API 网关，连接建立、鉴权、KV cache 初始化开销与 token 数无关，只限 TPM 会被人用海量 1 token 短请求耗尽连接池。
3. 单请求上限：防止单个用户一次发 128K 请求把整个 TPM 预算占满，客户端设单请求 input token 上限（如 32K）。

### 三层嵌套限流方案

1. 每分钟总 token 预算：滑动窗口计数器，分输入和输出 token（prefill 吃算力，decode 吃显存带宽）。
2. 每分钟请求数上限（RPM）：防连接洪水和调度资源耗尽。
3. 单次请求 token 上限：防单个请求吃掉大部分配额。

### 客户端实现

做预检和动态调节：每次请求前用 tiktoken 算清所需 token 数，判断是否超剩余预算，超了排队或拒绝；持续读响应头的 x-ratelimit-remaining-tokens 和 x-ratelimit-remaining-requests 动态调频；收到 429 读 Retry-After 按指示等待后重试。

## 关联

- TPM、RPM、滑动窗口、prefill、decode、Retry-After、tiktoken
