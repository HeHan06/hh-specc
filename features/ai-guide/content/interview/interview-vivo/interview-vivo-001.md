## 面试概览

- 公司：vivo
- 岗位：小v手机助手（Agent 方向）
- 轮次：一面
- 时间：未知
- 流程：个人介绍 → Agent 相关知识提问 → 反问

## 面试问题与回答

### Q1：deepseek harness 是什么？

- 概念纠偏：harness 与应用开发框架（LangChain）不是同层的东西；应用框架组装 LLM/工具/memory，harness 是运行时/宿主框架，业界公式 `Agent = Model + Harness`。
- DeepSeek 官方开源的 Agent 运行时框架（命令 `dsh`，MIT），定位「一切皆插件（Everything is a Plugin）」。
- 四层架构：内核层 Cordis（只做插件加载/卸载/依赖管理）；能力插件层（模型适配器、工具、Skills、会话日志、沙箱、存储、循环调度、Web UI 全是插件）；Capability Seam（Service Definition/Provider/Consumer 三角色独立演进）；配置层（preset/profile 自由组合）。
- 关键机制：append-only 事件溯源会话日志（唯一事实源，支持恢复/分叉/回放/压缩）；子 Agent 委托（spawn/fork）；工具执行管道 + 审批分级；四种运行模式（标准/PTC/极简/headless）。
- 优缺点：可组合性极强、事件溯源可审计可回放；但插件化抽象学习成本高、仍为 Developer Preview。

### Q2：codeX harness 框架 + 为什么采用 ReAct 规划模式？

- codeX harness 是驱动 Codex App/CLI/IDE/Web 同一套底层执行系统，定位 open agent harness。
- 三层 + 一核心：入口层（cli/tui/app-server/exec/SDK）、Agent Core 编排层（codex-core 对外暴露 queue pair、protocol、tools、thread-store）、能力层（api/exec-server/mcp/sandboxing 内核级沙箱）。
- 关键机制：上下文压缩（compaction）非简单文本摘要；审批门状态机 + 内核级沙箱（Seatbelt/Landlock）；Prompt 组装 + 缓存。
- 为什么 ReAct：代码任务每步结果依赖上一步、路径不可预先枚举、环境副作用可观察，适合「边想边做」；ReAct 与 Plan-and-Execute 是执行风格光谱两端，工程常组合使用。

### Q3：skill 和 tool 的应用选型（新增功能时新增 skill 还是 tool）

- Tool：单个原子能力，走 Function Calling，靠 name + description + JSON Schema，一次调用一个动作。
- Skill：更高层的可复用程序化单元，打包「指令 + 脚本/资源文件」，多步骤流程。
- 判断三问：是否一次原子调用；是否跨 Agent/场景复用且附带流程知识；确定性 vs 模型自由度。
- 一句话：原子、无流程、单次调用 → Tool；多步、带流程/规则、跨场景复用 → Skill。

### Q4：Agent 轨迹有做评测吗，如何评测？

- 轨迹是一次 trial 的完整记录（输入、Thought/Action/Observation、工具调用链、中间结果），评的是「执行路径合不合理」而非只看最终答案。
- 我们做的是场景回放（Scenario Replay）：把历史多轮 Query、链路 trace、上下文快照、外部接口数据落用例仓库，重放执行 + 结果评估。
- 指标三层：组件层（工具路由/参数提取准确率、调用成功率）、轨迹层（路径合理性/步数/Token 耗时）、任务层（Success Rate、pass@k / pass^k）。
- 两个原则：评 Outcome 不只评嘴；用沙箱/mock 保证可复现。

### Q5：记忆实现，以及如何评估记忆好坏

- 实现：短期记忆放当前会话上下文（AssistantMemoryProvider 拉取、时间窗口过滤、去重、按类型过滤）；会话内已确认预约字段用 Redis 缓存；长期/画像走 Persona 16 维标签；实时行为序列走流量组 API；历史订单按需拉取。
- 通用记忆五环节：记什么 → 记在哪 → 怎么取 → 怎么维护 → 怎么保护；存储分层（短期上下文、语义向量库、结构化硬事实关系库/Redis、实体知识图谱），硬事实绝不过向量库。
- 评估四指标：信息保留率、语义漂移度、推理一致性、幻觉率；补充召回命中率、冲突/时效正确性。

## 复盘总结

### 做得好

- 原文未记录明确亮点（面试记录只给出流程与失分点）。

### 待改进

- 对外部工具/开源生态跟进不足（deepseek harness、codeX harness 反复被问仍答不好）。
- 缺少 skill/tool 选型的可复用决策框架。
- 评测覆盖面窄：轨迹评测、记忆评测未答好（履历有料但没组织成话术）。

### 下一步

- 补齐 harness 认知与横向工具生态视野；建立能力选型决策框架；把轨迹评测、记忆评测沉淀成口述话术。
