## 面试概览

- 公司：能良电商
- 岗位：Agent 开发（AI 应用）
- 轮次：一面
- 时间：未知
- 流程：个人介绍 → 新出的 Agent 框架是否了解 → Claude Code 带来的启发 → hook 钩子函数作用与场景 → 沙箱作用与实现细节 → Agent runtime 机制

## 面试问题与回答

### Q1：新出的 Agent 框架了解哪些？有什么特点？

- LangGraph：StateGraph 有向有环状态图，节点纯函数 + reducer 合并 State，条件边循环分支，Checkpointer 持久化支持 human-in-the-loop。
- AutoGen：ConversableAgent + GroupChatManager 控制发言顺序，工具 register_for_llm / register_for_execution 声明执行分离。
- CrewAI：Agent + Task + Crew 三层，顺序或层级执行。
- MCP 协议：JSON-RPC 2.0 标准化工具/数据接入，Server/Client 分离，类似 USB 之于外设。

### Q2：Claude Code 给你们带来了什么启发？

- 权限模型分层（allow/ask/deny 三级 + 路径模式匹配，最小权限原则）。
- Tool Use 协议化而非函数调用（tool_use/tool_result 消息块 + content_block_id 精确关联，可审计因果链）。
- Hook 作为中间件模式（外部脚本、不侵入核心、安全策略与业务逻辑解耦）。

### Q3：Claude Code 的 Hook 钩子函数作用是什么？哪些场景使用？

- 类型与时机：PreToolUse（执行前，可改参/拒绝/放行）、PostToolUse（执行后审计脱敏日志）、Notification（状态变更）。
- 输入输出协议：标准 JSON（session_id、transcript_path、hook_event_name、payload），退出码决定 allow/deny/block。
- 场景：敏感信息脱敏、成本追踪、动态工具注入、合规检查。

### Q4：沙箱的作用与实现细节？

- 目标：不可信代码在受限环境运行，最小权限执行；隔离四维度：文件系统、网络、进程、资源。
- 隔离层级：进程级（seccomp + chroot）；容器级（Docker namespace + cgroup + OverlayFS、gVisor 用户态内核）；微虚拟机级（Firecracker，硬件虚拟化，125ms 启动）；WebAssembly 沙箱（语言级隔离）。
- 工程要点：OverlayFS 临时层、网络默认无外网 + 代理白名单、禁 fork/exec、三个硬限制（wall time/CPU time/内存）超限 SIGKILL。

### Q5：Agent Runtime 的机制是什么？

- Agent Loop 事件循环（max_steps 防死循环、early_stop 检测、并行工具调用）。
- 工具注册与调度（JSON Schema 注入 prompt、注册表、参数校验、本地/远程工具）。
- 上下文窗口管理（滑动窗口、自动摘要、结构化归档）。
- 会话持久化与 Checkpoint（原子写入、语义边界 checkpoint、human-in-the-loop 依赖）。
- 流式处理与中断（SSE 逐 token、cancel 信号、流式与非流式混用）。

## 复盘总结

### 做得好

- 个人介绍正常。

### 待改进

- 新出 Agent 框架不了解；Claude Code 没有深入使用、说不出启发；hook 机制不了解；沙箱隔离层级与实现缺乏系统认知；Agent Runtime 机制无法解释。
- 根因：之前做的是公司内部封闭环境 Agent（工具受限、场景单一），缺产品化思维，对 AI 工程化前沿关注不足，被视为技术深度不够。

### 下一步

- 系统了解 LangGraph/AutoGen/CrewAI/MCP 等主流框架。
- 深入使用 Claude Code，理解 hook、沙箱、Agent loop、tool use protocol、sandboxing。
- 补齐 Agent 产品化能力认知（沙箱安全、会话管理、hook 扩展点、多租户隔离）。
