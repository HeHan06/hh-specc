# 业界 Spec-Driven Development（SDD）流程对标分析

> 版本：v1.1 ｜ 编制日期：2026-08-22 ｜ 用途：specc（hh-specc v0.0.0）框架选型、架构设计的规划输入，并含本框架与业界方案的对标
> 状态：规划阶段文档（不涉及编码）＋ 自研方案对标（§2.7）

---

## 1. 背景：为什么会出现 Spec 驱动开发

2025 年起，"vibe coding"（凭感觉提示词写码）在规模化使用后暴露三个根本问题：

| 问题 | 表现 |
|---|---|
| 上下文丢失 | 需求只存在于聊天记录，跨会话/跨人无法传递 |
| 实现漂移 | AI 把未言明的假设变成代码，产出"看起来对、跑起来错" |
| 无法审计 | 无法回答"为什么这样实现"，变更无据可查 |

业界的统一回应是 **SDD（Spec-Driven Development）**：

> 规格（Spec）取代代码成为**唯一真相来源**；代码降级为规格的"编译产物"。
> 人在规格层做决策与审查，AI 在执行层做生成与验证。

Martin Fowler / Thoughtworks 将其划分为三个成熟度层级：

| 层级 | 含义 | 代表 |
|---|---|---|
| L1 Spec-first | 先写规格再写码（所有方案共性） | 全部 |
| L2 Spec-anchored | 规格长期留存，随系统演进维护 | Kiro、OpenSpec |
| L3 Spec-as-source | 人只维护规格、永不碰代码 | Tessl |

---

## 2. 六大主流方案逐个拆解

### 2.1 GitHub Spec Kit —— 通用基线（约 10 万 stars，MIT 协议）

- **定位**：Agent 无关的 SDD 工具包，可挂接 30+ 种 AI 编码助手
- **哲学**：意图驱动 → 先明确"做什么"，再谈"怎么做"；规格是可执行的共享真相源

**工作流（六阶段线性 + 人工检查点）**：

```
/speckit.constitution → /speckit.specify → /speckit.clarify → /speckit.plan → /speckit.tasks → /speckit.implement
        宪法                需求规格            澄清问答           技术方案         任务拆解          逐任务实现
```

**产物结构**：

| 产物 | 内容 | 关键特征 |
|---|---|---|
| `constitution.md` | 项目宪法：技术栈约束、测试哲学、不可妥协原则 | 全局生效，所有阶段强制引用 |
| `spec.md` | 用户故事、功能需求、验收标准 | **刻意不含技术细节**（无框架、无架构） |
| `plan.md` | 架构决策、数据模型、API 契约、测试策略 | 技术选型在此阶段才进入 |
| `data-model.md` / `contracts/` | 数据模型、接口契约（可选） | |
| `tasks.md` | 按用户故事分组、带文件路径、可并行标记 | 执行顺序：契约 → 测试 → 实现（测试先行） |

**特点小结**：
- ✅ 宪法机制 + 阶段门禁，治理感最强；适合团队标准化
- ❌ 流程偏重（小改动也走全流程）；绿地优化，存量项目改造摩擦大；全量上下文导致 Token 消耗高

### 2.2 AWS Kiro —— 一体化 IDE + 合规基因（商业产品）

- **定位**：把 SDD 做进 IDE 的 Agentic 开发平台（IDE + CLI 双形态）
- **哲学**：先形式化意图；从对话式 "Spec session" 生成结构化产物

**工作流（三文档栈）**：

```
requirements.md（EARS 格式需求 + 验收标准）
      ↓
design.md（架构、组件、数据模型、接口，实现蓝图）
      ↓
tasks.md（带复选框的任务清单 + 需求编号回链）
```

**独有机制（对合规场景最有参考价值）**：

| 机制 | 说明 |
|---|---|
| **EARS 需求记法** | 源自 Rolls-Royce 航空需求工程（IEEE RE'09），五种句式：通用型 `THE system SHALL…`、事件型 `WHEN…`、状态型 `WHILE…`、异常型 `IF…THEN…`、可选特性 `WHERE…`。天然可测试、可审计 |
| **Steering 文件** | Markdown 写组织级合规要求/安全标准/开发实践，生成代码时自动参照（类似"运行时宪法"） |
| **Agent Hooks** | 在保存文件/提交代码等节点自动跑合规检查、无障碍校验、安全扫描——把审查从"事后审计"提前到"开发中" |
| **Bugfix Specs** | 修 Bug 也走规格：现状/期望/不变行为分析 → 根因 → 设计 → 回归测试 |
| **需求回链** | 每个任务标注 `_Requirements: 1.1, 2.3_`，实现可追溯 |

**实战经验（AWS 官方课程与社区总结）**：
- "不做什么"比"做什么"更重要——防止 AI 发散
- 数据结构先定义——数据模型决定 80% 的实现逻辑
- 具体数字（如"< 500ms"）比形容词（"快"）有效得多

- ✅ 合规、审计、政企场景最成熟；EARS 是需求表达的最佳实践
- ❌ 绑定自家 IDE 与模型；不适合嵌进自有工具链

### 2.3 BMAD-METHOD —— 多角色虚拟团队（约 4.3 万 stars，开源）

- **定位**：用一支"AI 虚拟敏捷团队"覆盖从想法到交付的全生命周期
- **哲学**：决策显式化、上下文可持续传递、流程随工作量自适应

**两阶段流水线**：

```
阶段一：规划（可在 IDE 外完成）
  Analyst → PM → [UX] → Architect → PO 审批
  产物：Brief → PRD → UX 规格 → 架构文档 + DB Schema

阶段二：交付（IDE 内）
  Scrum Master 把计划切成"超详细 Story 文件"（含完整上下文/实现细节/架构指引）
      → Dev Agent 逐 Story 实现 → QA Agent 验收 → 人工 PR 审查
```

v6 起的交付环（Delivery Loop）支持任意入口：模糊想法从 Clarify 进、清晰大想法从 Plan 进、小改动直接 Build；Learn 环节复盘回流。

**特点小结**：
- ✅ 角色化分工让每个 Agent 上下文更聚焦（抗 context rot）；Story 文件携带完整上下文，对弱模型友好；规划产物（PRD/架构文档）天然可作合规审计证据
- ❌ 体系最重、学习曲线陡；单人小项目容易过度流程化

### 2.4 OpenSpec —— 轻量增量派（Fission AI，MIT，npm 周下载 7.7 万+）

- **定位**：为存量项目（brownfield）设计的变更提案式规格框架
- **哲学**：流动而非僵化、迭代而非瀑布、简单而非复杂

**工作流（状态机）**：

```
/opsx:explore（可选：探索思考） → /opsx:propose 生成变更提案 → 人工审查 → /opsx:apply 实施 → /opsx:archive 归档
```

**产物结构**（每个变更一个目录）：

```
openspec/changes/<change-id>/
├── proposal.md      # 为什么改、改什么
├── specs/           # 需求 + 具体场景（Requirement/Scenario，SHALL/WHEN-THEN）
├── design.md        # 技术方案
└── tasks.md         # 实施清单
```

归档后变更合并进 `openspec/specs/`（系统级规格库），形成随项目累积的活文档。

**特点小结**：
- ✅ 只关注"变更增量"（Spec Deltas），省 Token、不要求为老代码补全规格；支持跨仓库共享规格库（Stores）；无严格阶段门禁，可随时回头改任意产物
- ❌ 治理能力弱（无宪法级机制）；绿地项目的全局规划不如 Spec Kit 严谨

### 2.5 Tessl —— Spec-as-Source 激进派（商业创业公司）

- **定位**：规格即源代码；代码头部标注 `// GENERATED FROM SPEC - DO NOT EDIT`
- **特色**：维护 10,000+ 开源库的规格注册表（Spec Registry），直接缓解 API 幻觉；"Tiles" 可组合的方法论/库上下文包
- **特点小结**：
- ✅ 最彻底地解决规格-代码漂移问题（因为人根本不碰代码）
- ❌ 绑定自有生态；对现有代码库改造不现实；赌注太大

### 2.6 Claude Code 最佳实践 —— 方法论底座（Anthropic 官方）

不是框架，但是所有方案的公共方法论来源：

- **Explore → Plan → Code → Commit** 四段式：先读代码理解现状（Plan Mode 只读），再出计划，最后实施
- **给 AI 验证手段是最高杠杆**：测试/截图/期望输出，让 AI 自检而非靠人兜底
- **上下文工程四支柱**：系统提示精简（"少即是多"）、工具各司其职、JIT 按需加载（"不要搬图书馆，派图书管理员"）、长任务压缩/子代理
- **CLAUDE.md 持久记忆**：项目约定、命令、工作流的持久化上下文

### 2.7 hh-specc —— 本项目自研（v0.0.0，Git 管理）

- **定位**：面向「Web 管理系统 + 微信小程序」双端品类的 SDD 平台，把一段自然语言需求端到端转成合规、可运行的代码（后端 + Web 后台 + 小程序 + 双端共享层）。
- **形态**：纯 shell CLI（零构建、零第三方依赖）+ Codex Harness 引擎适配层；引擎可退化到 Manual 人工模式（只出提示词与产物清单，供任意 IDE Agent 执行）。
- **哲学**：不重造轮子，而是**取六方案的公约数**——Spec Kit 的流程骨架、Kiro 的 EARS、BMAD 的上下文分层、OpenSpec 的规格生命周期，针对「双端 + 中等能力模型 + 合规」这个具体场景做减法与补强。

**工作流（八阶段线性 + 双闸门）**：

```
probe → specify → clarify → visual → plan → tasks → implement → verify
  每个阶段：组装上下文 → 引擎执行 → 自动门禁✓ → 人工检查点✋
  visual 特殊：仅当模型判定「涉及新的前端视觉/交互」（frontend-scope.md）才执行，纯后端自动跳过
  implement 特殊：逐任务循环（每任务测试先行 + 失败自动重试 1 次后挂起）
```

**产物结构（三层目录，平台 / 规格 / 代码彻底隔离）**：

```
hh-specc/
├── .specc/            # 平台资产：宪法 + 平台层知识(5) + 模板(4) + 指令(8) + 配置
├── lib/ specc.sh      # 编排层：流程引擎 + 门禁 + 组装器 + 引擎适配 + 状态管理
├── features/<需求ID>/  # 规格产物：spec/plan/tasks/contracts + 业务层知识三件套
└── projects/<需求ID>/  # 代码产物：backend/ shared/ web-admin/ miniprogram/
```

**独有机制（相对六方案的差异化设计）**：

| 机制 | 说明 | 对标出处 |
|---|---|---|
| 平台组件与需求产物强隔离 | 新增需求只在 `features/`、`projects/` 下各加一个子目录，`.specc/` 与 `lib/` 零改动 | 自研（补 Spec Kit「框架资产 / 项目产物混放」问题） |
| 业务层知识三件套 | `business.md` / `data-model.md` / `flows.md` 由 specify 阶段自动生成（非预置），后续阶段 JIT 注入 | BMAD 上下文分层 + Kiro 数据模型先行 |
| specify 产物完整性门禁 | 强制校验 spec.md 结构 + 三件套齐备，缺一即失败（防「业务层知识缺失但静默通过」） | 自研（呼应「宪法要有牙齿」） |
| 逐任务循环 + 测试先行 | implement 按 tasks.md 逐任务执行，每任务带验证命令，失败自动重试 1 次后挂起 | Spec Kit + Anthropic |
| 引擎可替换 | Codex / Manual 双适配，模型、端点经 config.yaml 可切（当前 DeepSeek V4 Pro） | 自研（解耦引擎与规格） |
| Git 形态 A：工作区直写 | 代码直写工作区不自动 commit，进版本库的动作保留给人 | 自研（「人是质量守门人」） |

**端到端演练（daily-quote）**：用 hh-specc 自身完成「每日一句」双端需求，验证了全链路（彼时六阶段，现已扩展为八阶段）+ 单测 + 构建 + 真机级启动（PG 迁移 + jar 启动 + HTTP 200）。

**特点小结**：
- ✅ 宪法 / 平台层 / 业务层三层上下文分离注入，对中等能力模型友好；平台与需求隔离清晰、可复用；双闸门（自动门禁 + 人工检查点）兼顾效率与合规
- ❌ **真实局限（来自端到端演练暴露，非纸面推断）**：
  1. **verify 验证「代码看起来对」而非「系统能跑」**——单测 / 构建通过 ≠ 可运行，端到端补验才暴露 4 个串接缺陷（缺启动类、MyBatis XML 未加载、静态资源未集成、forward 规则吞资源）；
  2. **单测 mock 过度会掩盖运行时错误**（MyBatis Mapper 被 mock 绕过，XML 加载失败要到真启动才暴露）；
  3. **宪法目前是「提示词」而非「强制门禁」**——平台生成的代码仍能违反宪法（异常静默吞错），「宪法要有牙齿」是待补项；
  4. 环境依赖（PostgreSQL 等）未纳入流程前置检查；版本迭代 / 归档（archive）为 v0.2 规划未落地。

---

## 3. 横向对比

### 3.1 总体对比表

| 维度 | Spec Kit | Kiro | BMAD | OpenSpec | Tessl | hh-specc |
|---|---|---|---|---|---|---|
| 出品方 | GitHub | AWS | 社区 | Fission AI | Tessl Inc. | 自研（本仓库） |
| 形态 | CLI + 模板 | 一体化 IDE/CLI | 多代理框架 | CLI + 斜杠命令 | 框架 + 规格注册表 | shell CLI + 引擎适配 |
| 开源 | ✅ MIT | ❌ | ✅ | ✅ MIT | ❌ | ✅（自用） |
| Agent 绑定 | 无（30+） | 自家（多模型） | 无（多工具） | 无（30+） | 自家生态 | 无（Codex / Manual 双适配） |
| 流程形状 | 线性 + 门禁 | 三文档栈线性 | 双阶段 + 角色流水线 | 变更状态机（可回退） | 规格 → 再生成 | 线性 + 门禁 + 逐任务循环 |
| 治理机制 | 宪法 | Steering + Hooks | 角色分工 + PO 审批 | 轻量约定 | 规格注册表 | 宪法 + 门禁 |
| 绿地/存量 | 绿地优 | 两者皆可 | 绿地优 | **存量优** | 绿地 | 绿地优 |
| 重量级 | 中重 | 中 | 重 | **轻** | 重 | 中 |
| 需求表达 | 自由格式 + 验收标准 | **EARS（最规范）** | 用户故事 + AC | Requirement + Scenario | 结构化规格语言 | EARS + 验收标准 |
| 可追溯性 | 任务分组 | **需求编号回链** | Story 回链 | 变更目录归档 | 规格即源 | 需求↔任务双向回链 |

### 3.2 人机分工对比

| 阶段 | 人的角色 | AI 的角色 |
|---|---|---|
| 需求 | 提供意图、回答澄清、审批规格 | 起草规格、提问消歧 |
| 设计 | 定技术约束、审批方案 | 出架构、数据模型、契约 |
| 任务 | 审查粒度与排序 | 拆解、标注依赖与并行性 |
| 实现 | 审查代码与验证结果 | 逐任务执行、测试先行 |
| 验证 | 对照验收标准终审 | 跑测试、生成验证报告 |

> 共识：人的角色从"代码编写者"转变为"意图定义者 + 质量守门人"（steerer & verifier）。

### 3.3 上下文策略对比

| 方案 | 策略 | 代价 |
|---|---|---|
| Spec Kit | 全量注入宪法 + 规格 + 计划 | Token 高、长上下文依赖 |
| Kiro | Steering 常驻 + 规格按需 | 绑定其上下文管理实现 |
| BMAD | 子代理分治，每角色只拿所需上下文 | 产物交接复杂 |
| OpenSpec | 只注入变更增量（Spec Deltas） | 全局一致性靠归档累积 |
| 通用教训 | 阶段产物落盘为 Markdown，会话可随时重开 | —— |

---

## 4. 设计特点提炼：八大共性模式

从六个方案中可以提炼出已被反复验证的模式，这就是业界"最佳实践"的公约数：

| # | 模式 | 定义 | 出处 |
|---|---|---|---|
| 1 | **宪法/护栏** | 项目级不可妥协规则，所有阶段强制引用 | Spec Kit 宪法、Kiro Steering |
| 2 | **结构化需求** | 用受限句式消除自然语言歧义，验收标准可测试 | Kiro EARS、OpenSpec Scenario |
| 3 | **阶段门禁 + 人工检查点** | 每阶段产物落盘、人审通过才进入下一阶段 | 全部方案 |
| 4 | **显式声明"不做什么"** | 范围边界是规格的一等公民，防 AI 发散 | Kiro 实战 |
| 5 | **数据模型/契约先行** | 接口契约与数据结构在设计阶段锁定，实现不得私改 | Spec Kit contracts、Kiro design |
| 6 | **测试先行 + 自动验证** | 任务顺序：契约→测试→实现；每任务带验证命令 | Spec Kit、Anthropic |
| 7 | **需求↔任务双向回链** | 每个任务标注需求编号，每条需求至少一个任务覆盖 | Kiro、BMAD |
| 8 | **规格生命周期管理** | 规格不是写完即弃，而是归档/演进/防漂移 | OpenSpec archive、Tessl |

**合规视角的补充模式**（AWS 安全博客，2026-07）：

| # | 模式 | 定义 |
|---|---|---|
| 9 | **双闸门控制** | author-time：规格生成前人工审查安全决策；build-time：流水线策略扫描（SAST/IaC 检查）门禁 |
| 10 | **规格先行制度** | "代码生成前必须有已审查的规格"作为控制条款，明确"必须改什么、禁止改什么" |

---

## 5. 争议与局限（保持清醒）

1. **"Waterfall 2.0"质疑**：重量级方案确有瀑布回归风险。但关键差异是反馈环从"数月"缩短到"分钟"——规格错了可以立即再生成。真正的问题是**过度规格化**（小改动走全流程）。
2. **规格漂移（Spec Drift）**：代码改了规格没改（或反之），L1 级方案普遍缺乏防漂移机制——这是 OpenSpec 归档制与 Tessl 再生成制试图解决的问题。
3. **Token 与成本**：全量上下文方案对大型项目昂贵；增量注入（OpenSpec）是省钱路线。
4. **质量成本并未消失**：AI 压低了"起草"规格的成本，但"发现缺失边界、验证假设、识别幻觉"依然消耗真实人力。LLM 降本的是草稿，不是质量。
5. **企业级生产化尚早**：nvisia 在真实项目（反欺诈平台）中的评估结论——SDD 收益真实，但可用性摩擦与规格瓶颈仍使其未到"企业级全面生产采用"阶段。

---

## 6. hh-specc 的设计取舍（已落地 v0.0.0）

结合我们的场景约束——**"Web 管理系统 + 微信小程序"双端、React+JS / Java 技术栈、DeepSeek V4 Pro 模型驱动**：

| 启示 | 说明 |
|---|---|
| **流程骨架取 Spec Kit** | 宪法 + specify/clarify/plan/tasks/implement 的线性门禁是被验证最充分的基线，治理感符合"合规"目标 |
| **需求表达取 Kiro EARS** | 结构化句式对中等能力模型尤其重要——格式约束能弥补推理不足 |
| **上下文分层取 BMAD 思路** | 宪法 / 平台层（双端通用规约）/ 业务层（项目领域知识）三层分离注入，避免全量塞入 |
| **任务粒度取"原子化 + 测试先行"** | 小任务短循环是对抗弱模型长程漂移的最有效手段 |
| **规格生命周期取 OpenSpec** | 变更归档进系统级规格库，解决长期维护中的规格漂移（v0.2 规划，未落地） |
| **验证环节双闸门** | 开发中自动检查（lint/测试/契约一致性）+ 交付前人工对照验收标准终审 |
| **引擎与规格解耦** | 规格层是纯 Markdown 资产，引擎（Codex Harness + DeepSeek）可替换 |

---

## 7. 参考资料

- GitHub Spec Kit：github/spec-kit（README + spec-driven.md）
- Microsoft Learn：《Spec Kit 企业开发者实施指南》系列课程
- AWS：《Balancing speed and safety: A control framework for AI coding agents》（2026-07）
- AWS：《Spec-Driven Development with Kiro》官方课程大纲；Kiro GovTech 实践博客
- Martin Fowler / Thoughtworks：《Understanding Spec-Driven Development: Kiro, spec-kit, and Tessl》（Birgitta Böckeler，2025-10）
- BMAD-METHOD：bmad-code-org/BMAD-METHOD（v6.x，2026-08）
- OpenSpec：Fission-AI/OpenSpec（opsx 工作流，2026-08）
- OpenAI：《Codex as a platform: build on the open agent harness》（2026-08-19）
- Anthropic：《Best Practices for Claude Code》；《Context Engineering from Claude》（re:Invent 2025）
- EARS：Mavin et al., IEEE RE'09（Rolls-Royce）
- nvisia 白皮书：《Introducing the GitHub Spec Kit》（2025-11）
- LLM-Coding/Spec-Driven：《Four Approaches in Detailed Comparison》（2026-02）
