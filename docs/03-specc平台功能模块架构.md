# specc 平台功能模块架构

> 版本：v0.0.0（已实装）｜ 更新日期：2026-08-26
> 上游依据：《01-业界Spec流程对标分析》《02-specc流程设计文档》（技术决策已定稿）
> 状态：**已实现**（六阶段全流程 + 可观测性 DAG + 多模态输入 + UI 预设库）。下表用 ✅ 标注已落地能力，用 ⏳ 标注 v0.2 规划未实现项。

---

## 1. 平台定位回顾

specc 是一个**领域专属的规范驱动（Spec-Driven）AI Coding 平台**：

- 面向场景：Web 管理系统 + 微信小程序（双端）
- 技术栈：React 18 + Vite + Ant Design（Web 后台）｜ Taro（小程序）｜ Java 17 + Spring Boot 3 + MyBatis（后端）｜ PostgreSQL
- 引擎：Codex Harness，模型按环节可配置（默认 `deepseek-v4-pro` 推理模型；上下文带图时自动切 `deepseek-v4-flash-vision-exp` 视觉多模态，见 M6/M9）
- 验证：自动化测试（单测 + lint + 契约一致性）+ 跨端可观测 DAG（code-graph）

**输入**：一段自然语言需求描述。

---

## 2. 输出形态定义（已定稿）

### 2.1 三类交付物

```
输入：一段自然语言需求描述
        │
        ▼
┌─ ① 规格产物包（永久资产，进仓库）────────────────────┐
│   features/<需求ID>/                                │
│   ├── spec.md          需求规格（EARS）              │
│   ├── clarify.md       澄清记录                     │
│   ├── plan.md          技术方案                     │
│   ├── contracts/       API 契约（YAML）             │
│   ├── tasks.md         任务清单（含需求回链）          │
│   ├── verify-report.md 验证报告（验收标准逐条对照）    │
│   └── state.json       状态 + 人工审查历史（审计链）   │
└──────────────────────────────────────────────────┘
┌─ ② 代码产物（本体，归档到 projects/<需求ID>/）──────────┐
│   projects/<需求ID>/                                  │
│   ├── web-admin/       React 18 + Vite + AntD      │
│   ├── miniprogram/     Taro 小程序                  │
│   ├── backend/         Java 17 + SB3 + MyBatis + PgSQL│
│   └── shared/          双端共享（类型/工具/常量）       │
│   + 对应单元测试                                      │
└──────────────────────────────────────────────────┘
└─ ③ 审计线索：每任务/每变更可回链到 Req 编号 ──────────┘
```

### 2.2 Git 形态（决策：A）

| 模式 | 行为 | 状态 |
|---|---|---|
| **A. 工作区直写（默认，已选定）** | 代码直接写入目标工程工作区，**不自动 commit**；verify 通过后由人工检查、自行提交 | ✅ 已采用 |
| B. 自动分支（可选开关） | 自动创建 `specc/<需求ID>` 分支，按任务粒度 commit（message 含任务 ID + 需求回链），不 push 不建 PR | v0.2 规划 |

**选 A 的理由**：门禁已保证代码通过自动化测试，但"进入版本库"这一动作保留给人——人是质量守门人，合规上最干净。

### 2.3 仓库结构（决策：Monorepo）

specc 仓库本身即代码仓库，单仓库多需求归档：

```
specc/                            # = 本仓库
├── .specc/                       # 框架资产（宪法/平台层/模板/提示词，纯跨需求通用）
├── features/                     # 需求工作目录（规格 + 业务层知识）
├── projects/                     # ★ 需求代码归档区（每个需求一个子目录）
│   └── <需求ID>/                 #   与 features/<需求ID>/ 靠需求ID对应
│       ├── web-admin/            #   Web 后台工程（React 18 + Vite + AntD）
│       ├── miniprogram/          #   小程序工程（Taro）
│       ├── backend/              #   后端工程（Java 17 + SB3 + MyBatis + PgSQL）
│       └── shared/               #   双端共享（类型/工具/常量，Taro 与 React 共用）
├── specc-observability/          # ★ 可观测性 SDK（注解 + APT + 前端扫描器 + 合并器 + strip）
├── lib/                          # 编排层脚本（M2~M10 载体）
└── specc.sh                      # CLI 入口
```

**选 Monorepo 的理由**：规格与代码同库，需求回链天然一致；双端 + 共享层跨工程改动一次提交完成；单人/小团队维护成本最低。

**隔离原则（已补强）**：平台组件（`.specc/`、`lib/`、`specc.sh`）与需求产物（`features/<ID>/`、`projects/<ID>/`）严格分离——新建需求只增删 `features/` 与 `projects/` 下的对应子目录，平台资产零改动；需求代码归档进 `projects/`，避免与框架内部内容混在一起。

---

## 3. 功能模块全景图（已实现 vs 规划）

```
┌─────────────────────────────────────────────────────────────────────────┐
│          M1 CLI 命令模块（用户入口）        ✅ 全部已实现                    │
│   init / new(--prd需求文档 · --kb知识库) / status / redo / strip(--apply) /│
│   approve / reject / <stage> / help / --version                          │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                  M2 流程引擎（阶段状态机）       ✅ 已实现                  │
│   specify→clarify→plan→tasks→implement→verify                            │
│   阶段路由 · 前置条件检查 · 断点续跑 · redo 回退 · 异步审批(approve/reject)   │
└───┬───────────────┬───────────────────┬──────────────────┬──────────────┘
    │               │                   │                  │
┌───▼─────┐   ┌─────▼──────┐   ┌────────▼────────┐   ┌─────▼───────┐
│ M3 知识  │   │ M4 模板与   │   │ M5 上下文组装器  │   │ M8 状态与    │
│ 资产库 ✅ │   │ 提示词系统 ✅│   │ (Assembler) ✅  │   │ 检查点管理 ✅ │
│ 宪法/平台 │   │ 4产物模板    │   │ 三层知识JIT拼装  │   │ state.json  │
│ 层(含UI预 │   │ 6阶段指令    │   │ 超阈值告警      │   │ 进度/审计链  │
│ 设/契约)  │   │            │   │                │   │             │
└───┬─────┘   └─────┬──────┘   └────────┬────────┘   └─────────────┘
    │               │                   │
    └───────────────┴─────────►  阶段提示词（组装完成）
                                        │
                               ┌────────▼────────┐
                               │ M6 引擎适配层 ✅  │
                               │ Codex(按环节切模型)│◄── M9 配置管理 ✅
                               │ 退化:Manual产物模式│   (model.id + model.vision)
                               └────────┬────────┘
                                        │ 产物落盘
                               ┌────────▼────────┐
                               │ M7 门禁检查系统 ✅ │
                               │ 结构·契约·测试…   │
                               │ (specify/clarify/ │
                               │  plan/tasks/verify)│
                               └────────┬────────┘
                                        │ 全部通过
   ┌────────────────────────────────────┴────────────────────────────────────┐
   │  M11 可观测性与交付（✅ 已实现）       │  M10 归档与规格库（⏳ v0.2 未实现） │
   │  三注解@Capability/Point/@Orchestrate│   specc archive 归档进 specs/     │
   │  后端APT编译期生成code-graph.json/.mmd│   规格库消费·变更检测·防漂移       │
   │  前端扫描器Babel解析JSDoc标签         │   （依赖版本迭代，随 v0.2 一并做） │
   │  跨端合并器merge出完整调用链DAG       │                                 │
   │  strip命令交付前剥离标签(可逆)        │                                 │
   └────────────────────────────────────┴────────────────────────────────────┘
```

> **已实现能力一览**：六阶段全流程 + 双闸门（自动门禁/人工检查点）；需求材料双轨输入（`--prd` 需求文档进 `requirement.md` 全文注入 / `--kb` 知识库进 `knowledge/` 索引+选读——区分「需求正文」与「参考素材」，`--attach` 已退役）；模型按环节自动切视觉（带图自动用 `model.vision`）；UI 预设库（`ui-presets/` 三种范式，供 plan/implement 锁定视觉）；可观测 DAG（后端 APT + 前端扫描 + 跨端合并，verify 阶段自动生成）；`strip` 交付前剥离（可逆）。
>
> **⏳ 未实现（v0.2 规划）**：`M10 归档与规格库`（`specs/` 与 `specc archive`，依赖版本迭代一并做）；`light/change` 流程裁剪；契约一致性比对增强、安全扫描闸门；多需求并行隔离、知识资产版本化。

---

## 4. 模块详细设计

### M1 CLI 命令模块

**职责**：用户唯一入口，解析命令、调度流程引擎、呈现门禁结果与人工检查点交互。

| 命令 | 功能 | 状态 |
|---|---|---|
| `specc init` | 初始化/校验 `.specc/` 资产（宪法/平台层/模板/指令）+ 幂等创建 `features/`、`projects/` 工作目录；业务层知识不预置，由 specify 阶段按需生成 | ✅ |
| `specc new <需求ID> ["描述"]` | 创建需求工作目录 `features/<需求ID>/`（可携带需求描述，缺省则占位待补齐） | ✅ |
| `specc new <需求ID> --prd <文件\|目录>` | 创建需求并挂入**需求文档（PRD）**：全文并入 `requirement.md`，作为 specify 的 `{REQUIREMENT_TEXT}` 正文 | ✅ |
| `specc new <需求ID> --kb <文件\|目录>` | 创建需求并挂入**知识库**：复制进 `knowledge/`，走「索引 + 选读」，不全文灌入 | ✅ |
| `specc <stage>` | 执行指定阶段（specify/clarify/plan/tasks/implement/verify） | ✅ |
| `specc status [需求ID]` | 展示当前需求的阶段进度、门禁状态、任务进度、最近审计历史 | ✅ |
| `specc redo <stage> [需求ID]` | 重跑某阶段（人工修改产物后重置其前后门禁） | ✅ |
| `specc strip <需求ID> [--apply]` | 剥离可观测性注解/标签（交付前清理，默认预览 diff，`--apply` 才写文件并自动备份） | ✅ |
| `specc approve <需求ID> [意见]` | 异步审批：通过待人工审查的阶段（specify/plan/verify） | ✅ |
| `specc reject <需求ID> <意见>` | 异步审批：否决并记入审计链 | ✅ |
| `specc help` | 帮助（`-h` / `--help` 等价） | ✅ |
| `specc --version` | 版本号（`-v` / `version` 等价，读 `.specc/config.yaml` 的 `app.version`） | ✅ |
| `specc archive` | verify 通过后归档规格进系统级规格库（依赖版本迭代） | ⏳ v0.2 |

**边界**：CLI 不含业务逻辑，只做路由与交互；所有规则在流程引擎与门禁系统中。

### M2 流程引擎（阶段状态机）

**职责**：驱动六阶段线性流程，执行"前置条件 → 组装上下文 → 调引擎 → 落盘 → 过门禁"的循环。

| 子能力 | 说明 |
|---|---|
| 阶段路由 | 根据 state.json 当前状态决定可执行的下一阶段；跳阶段直接拒绝 |
| 前置条件检查 | 如 tasks 阶段要求 plan 已通过人审；implement 要求无未覆盖需求 |
| 门禁编排 | 自动门禁先行（✓），失败即终止并报告；通过后暂停等待人工检查点（✋） |
| 断点续跑 | 任意时刻中断后，从 state.json 恢复；implement 按任务粒度续跑 |
| 回退支持 | `redo` 会重置目标阶段及其后的门禁状态 |

**状态定义**：每阶段状态 ∈ {`pending`, `running`, `gate_failed`, `awaiting_review`, `approved`}；需求级状态 ∈ {`active`, `verified`, `archived`}。

### M3 知识资产库

**职责**：承载三层领域知识，是"输出合规代码"的核心资产（详见 02 文档第 5 节）。

| 层 | 内容 | 维护方式 |
|---|---|---|
| 宪法 `constitution.md` | 技术栈锁定（Java17/SB3/MyBatis/React18/Vite/AntD/Taro/PgSQL）、安全红线、测试标准、流程纪律、小程序合规、单一真相源（§7.6，引用不复制） | 变更需人工审批，版本化 |
| 平台层 `platform/`（6 文件 + ui-presets） | 技术栈契约 / 双端边界 / 小程序规范 / Web后台规范 / API约定 / **前端架构契约** + **UI 预设库**（dashboard-admin / landing-page / mobile-content-feed） | 双端品类通用，跨项目复用 |
| 业务层知识（3 文件） | business（术语+角色）/ data-model / flows | **由 specify 阶段从需求描述自动生成**，归档在 `features/<需求ID>/` 下，随需求走，不进 `.specc/` |
| 需求知识库 `features/<需求ID>/knowledge/` | 用户随 `--kb` 挂入的参考素材（沉淀/题库/范文），仅作上下文参考 | 随需求走；对产物只**引用**不复制 |

**设计要点**：
- 全部为 Markdown，人与 AI 同读
- 平台层与业务层分离 → 同一框架服务多个业务项目
- **业务层知识是 specify 的产出物而非全局资产**：一个需求一份，新建需求时随 specify 重新生成，无需替换平台资产
- **知识库（corpus）是需求级参考源**：由 `--kb` 挂入 `features/<ID>/knowledge/`，specify 时只注入「索引 + 选读文件」，不全文灌入——避免大量沉淀材料稀释需求重点（见 M5）
- Taro 决策带来的新增规约点：**双端共享策略**（共享组件库/工具函数/类型定义的目录约定）写入 dual-end-boundary.md

### M4 模板与提示词系统

**职责**：定义产物结构与阶段行为，保证产出格式稳定（对中等能力模型尤其重要）。

| 资产 | 数量 | 作用 |
|---|---|---|
| 产物模板 `templates/` | 4 个（spec/plan/tasks/contract） | 产物骨架 + 必填字段 + 示例；spec 模板内置 EARS 五句式与"不做什么"章节 |
| 阶段指令 `prompts/` | 6 个（每阶段一个） | 该阶段的角色设定、输入说明、输出要求、禁止事项、完成判据 |

**设计要点**：提示词只写"流程与规则"，领域知识一律由 M5 动态注入——模板保持通用，知识集中管理，避免两处维护。

### M5 上下文组装器（Context Assembler）

**职责**：按阶段公式拼装最终提示词，实现 JIT（按需）注入，控制上下文体积。

```
阶段提示词 = 宪法 + 平台层相关片段 + 业务层知识片段（来自 features/<需求ID>/）+ 上一阶段产物(片段) + 模板 + 阶段指令
```

| 能力 | 说明 |
|---|---|
| 阶段相关性映射 | 内置"阶段 → 平台层文件"映射表（见 02 文档 5 节），plan 阶段全量、其余按需 |
| 产物片段提取 | implement 阶段只注入当前任务相关的 plan 片段，而非整个 plan.md |
| 知识库选读注入 | specify 阶段若 `knowledge/` 有内容：只注入「`knowledge/.index.md`（标题行摘要索引）+ `selection.md` 已选文件全文」，未建 `selection.md` 时仅给索引；受 `knowledge.max_files` 上限约束 |
| Token 预算 | 组装结果超阈值时告警，提示裁剪（对抗长上下文劣化） |

### M6 引擎适配层

**职责**：屏蔽引擎差异，规格层不感知具体引擎。

| 适配器 | 行为 |
|---|---|
| **CodexAdapter（主）** | 调 `codex exec` 执行有界阶段任务；读取配置中的模型/端点；**按环节自动解析模型**：若上下文 prompt 携带图片引用（markdown 图片 / 【附图:path】 / 裸图片路径），自动切 `model.vision`，否则用默认 `model.id`（`_prompt_needs_vision` / `_resolve_model_id`） |
| **ManualAdapter（退化）** | 不调引擎，输出"组装好的提示词 + 产物清单"，人在任意 IDE Agent 手动执行，再把产物放回约定路径 |

**关键约定**：
- 一个阶段 = 一次（或任务粒度的多次）有界调用，不做无限会话
- implement 阶段任务失败自动重试 1 次，再失败挂起转人工
- 高风险操作（删文件、改契约、改 DDL）触发审批策略（Codex `approval_policy`）
- 密钥未设置时 codex 引擎明确报错并自动退化为 manual 模式（不崩溃）

### M7 门禁检查系统

**职责**：两类自动门禁 + 人工检查点的统一执行框架。

| 门禁 | 阶段 | 检查内容 | 实现形态 |
|---|---|---|---|
| 结构检查 | specify | spec 结构（Req-N/不做什么/量化约束）+ 业务层知识三件套齐备非空 | 脚本扫描 Markdown |
| 结构检查 | clarify | 无 `[NEEDS CLARIFICATION]` 残留 | 脚本扫描 Markdown |
| 契约完整性 | plan | 契约四要素（统一响应体/错误码表/认证/分页） | 脚本校验 YAML 字段 |
| 需求回链 | tasks | 每条 Req 至少被一个任务回链覆盖 | 脚本交叉核对 |
| 代码验证 | implement/verify | 每任务 lint + 单测（前端测试 + JUnit）+ 契约一致性 | 跑构建/测试命令，解析结果 |
| 验证报告 | verify | `verify-report.md` 四部分齐备（测试汇总/契约一致性/宪法抽查/验收对照表）+ 跨端 DAG 自动生成 | 脚本校验 + observability_generate |
| 人工检查点 | specify/plan/verify | CLI 暂停，展示产物，等待 approve / reject(附意见) | 交互式 / 异步审批 |

**输出**：每次门禁产出结构化结果（通过/失败项清单），失败项写入 state.json，成为下一次的整改输入。

### M8 状态与检查点管理

**职责**：单一事实来源记录流程状态，支撑断点续跑与审计。

```
features/<需求ID>/state.json
{
  "feature": "订单管理",
  "stage": "implement",
  "gates": { "specify": "approved", "plan": "approved", ... },
  "tasks": { "T-01": "done", "T-02": "failed:测试未通过", "T-03": "pending" },
  "history": [ { "stage": "plan", "ts": "...", "reviewer": "人工意见摘要" } ]
}
```

**审计价值**：history 记录每个人工审查决策，满足合规可追溯要求。

### M9 配置管理

**职责**：引擎与环境配置集中管理，敏感信息不入库。

| 配置项 | 位置 | 说明 |
|---|---|---|
| 模型与端点 | `.specc/config.yaml` | `model.id`（默认推理模型）+ `model.vision.id`（视觉多模态，仅 ID 不同其余继承）、base_url、wire_api；引擎按环节自动解析 |
| API 密钥 | 环境变量（如 `DEEPSEEK_API_KEY`） | 绝不写入文件与仓库；`.gitignore` 兜底 |
| Codex 引擎配置 | `$CODEX_HOME/config.toml` | 由 `_gen_codex_config` 依据 `.specc/config.yaml` 动态生成，不入项目仓库 |
| 流程开关 | `.specc/config.yaml` | `engine.type`（codex/manual）、`tasks.max_retry`、`pipeline.profile`（full；light/change 为 v0.2） |
| 知识库选读 | `.specc/config.yaml` | `knowledge.enabled`（是否启用）、`knowledge.selection`（manual/auto）、`knowledge.max_files`（单次最多选读） |

### M10 归档与规格库（v0.2 规划，未实现）

> ⚠ 本模块为 **v0.2 规划，当前未实现**：`specs/` 目录与 `specc archive` 命令尚未落地。
> 归档是「版本迭代」链条的收尾动作（版本机制未定，归档格式就定不下来），故整体并入版本迭代一并实现，不单独提前。

**职责**：解决规格漂移（Spec Drift）——规格不是一次性文档，而是随系统演进的活资产。

| 能力 | 说明 |
|---|---|
| 归档 | `specc archive` 将已验证需求的 spec/contracts 摘要合并进 `specs/`（系统级规格库） |
| 规格库消费 | 后续需求的 specify/plan 阶段，组装器注入相关的存量规格片段，避免重复定义与冲突 |
| 变更检测（v0.2） | 代码契约变化时提示规格库同步更新 |

### M11 可观测性与交付（✅ 已实现）

**职责**：给 AI 生成的代码打标签，形成 DAG 状态图供审查（**审查时生效、执行时不生效**），并支持交付前剥离。

实现方式：**注解贴代码 + 编译期/构建期扫描**，而非从意图层间接生成文档（避免多次开发后漂移），且符合"编码前规范"/"单一真相源"。

| 子能力 | 说明 | 载体 |
|---|---|---|
| 三层标签定义 | `@Capability`（类对齐 Req-N）/ `@CapabilityPoint`（方法对齐 T-XX）/ `@Orchestrate`（调用边） | Java 注解（SOURCE 保留）+ 前端 JSDoc |
| 后端 APT | 编译期扫描三个 SOURCE 注解，生成 `code-graph.json` 与 `code-graph.mmd` | `CodeGraphProcessor` + META-INF services |
| 前端扫描器 | Babel AST 解析 JSDoc 标签，产物与后端同构 | `scan.cjs`（复用各工程 node_modules） |
| 跨端合并 | 按节点 id 合并前后端 DAG，展示「前端页面→后端接口→服务层」完整链路 | `merge.cjs` |
| 自动生成 | verify 阶段自动产出三张图（后端 APT / 前端扫描 / 跨端总图） | `observability_generate`（lib/observability.sh） |
| 交付剥离 | 手动清理部署包里的注解/标签（可逆，--apply 前自动备份） | `strip.sh` + `strip.py` |

**关键设计**：
- `RetentionPolicy.SOURCE` + `scope=provided` → 生产运行零开销、快速插拔、代码隔离
- 硬约束：标签编号必须**真实对齐 spec/tasks**，禁止臆造（见 tech-stack §6）

---

## 5. 模块交互：一次完整需求的调用时序

```
用户: specc new order-mgmt && specc specify "顾客可在小程序下单…"
  │
  M1 CLI ──► M2 流程引擎（新建 state.json，进入 specify）
  M2 ──► M5 组装器: 宪法 + 平台层 + spec模板 + specify指令
  M5 ──► M6 CodexAdapter: codex exec（有界调用）
  M6 ──► 产物落盘 spec.md + business.md + data-model.md + flows.md（业务层知识三件套）
  M2 ──► M7 门禁: 结构检查 ✓ → 人工检查点 ✋（用户审规格）
  用户 approve ──► M8 记录 state: specify=approved
  …（clarify / plan / tasks 同理）…
  specc implement:
  M2 逐任务循环 ──► M5 注入任务片段 ──► M6 执行 ──► M7 跑该任务测试
       ├─ 通过 → 下一任务
       ├─ 失败 → 自动重试1次 → 仍失败则挂起（state 记录 failed 原因）
       └─ 全部完成 → verify 阶段
  specc verify 通过 ──► [v0.2] specc archive ──► M10 合并进 specs/
```

---

## 6. 模块 × 文件映射

| 模块 | 载体 |
|---|---|
| M1 CLI | `specc.sh`（用 shell 实现，保持零依赖） |
| M2 流程引擎 | `specc.sh` 内的阶段函数 + `lib/pipeline.sh` |
| M3 知识资产库 | `.specc/constitution.md`、`.specc/platform/`（含 `ui-presets/`、`frontend-architecture.md`；业务层知识在 `features/<需求ID>/`） |
| M4 模板与提示词 | `.specc/templates/`、`.specc/prompts/` |
| M5 上下文组装器 | `lib/assemble.sh`（阶段→知识片段映射表） |
| M6 引擎适配层 | `lib/engines.sh`（含 CodexAdapter / ManualAdapter + 按环节切模型 `_resolve_model_id`） |
| M7 门禁检查系统 | `lib/gates.sh`（结构检查/契约校验/需求回链/测试执行/人工检查点 + verify 门禁） |
| M8 状态管理 | `features/<ID>/state.json` + `lib/state.sh` |
| M9 配置管理 | `.specc/config.yaml` + 环境变量 |
| M10 归档与规格库 | `specs/` + `lib/archive.sh`（v0.2 规划，未实现） |
| M11 可观测性与交付 | `specc-observability/`（Java 注解 + APT + 前端扫描器 + 合并器 + strip.py）+ `lib/observability.sh` + `lib/strip.sh` |
| 代码工作区 | `projects/<需求ID>/` 下的 `web-admin/`、`miniprogram/`、`backend/`、`shared/`（工作区直写，不自动 commit） |

> 选型说明：编排层用 shell 脚本（无构建、无依赖、可直接跑），核心复杂度在规格资产而非代码；若后续门禁逻辑复杂化，可迁移到 Node/Python 而不影响规格层。

---

## 7. 版本范围

| 模块 | 已实现（v0.0.0） | v0.2（演进） |
|---|---|---|
| M1 CLI | init / new(--attach) / status / redo / strip / approve / reject / <stage> / help / --version | light/change profile 命令 |
| M2 流程引擎 | full profile 六阶段 | light（小改动）/ change（增量变更）裁剪 |
| M3 知识资产库 | 宪法 + 平台层 6 文件 + ui-presets；业务层知识由 specify 生成于 features/ | 知识资产版本化与冲突检测 |
| M4 模板提示词 | 4 模板 + 6 指令 | 按演练反馈迭代 |
| M5 组装器 | 阶段映射 + 片段注入 + 超阈值告警 | Token 预算自动裁剪 |
| M6 引擎适配 | Codex + Manual 双适配 + 按环节切模型 | 更多引擎（Claude Code 等） |
| M7 门禁 | 结构检查 + 契约校验 + 需求回链 + 测试执行 + verify 门禁 + 人工检查点 | 契约一致性自动比对脚本增强、安全扫描闸门 |
| M8 状态管理 | state.json + 断点续跑 + 异步审批审计链 | 多需求并行隔离 |
| M9 配置 | model.id + model.vision 按环节切换、engine.type、task 重试 | 多项目配置继承 |
| M10 归档 | （推迟 v0.2，随版本迭代实现） | 归档进 specs/ + 规格漂移检测 |
| M11 可观测性 | 三注解 + 后端 APT + 前端扫描器 + 跨端合并 + strip（verify 自动生成） | 能力多落点去重、字节码推断调用边、节点精确到方法行号 |

---

## 8. 关键设计决策摘要

| 决策 | 理由 |
|---|---|
| 输出形态：规格产物包 + 代码 + 审计线索三类交付物 | 规格可审计、代码可运行、变更可回链 |
| Git 形态 A（工作区直写，不自动 commit） | 人是质量守门人，进版本库的动作保留给人 |
| Monorepo 单仓库 + projects/<需求ID>/ 需求代码归档 + shared/ 共享层 | 规格与代码同库回链一致；Taro/React 共享代码有明确归属；平台组件与需求产物隔离 |
| 规格层纯 Markdown、与引擎解耦 | 引擎可从 Qwen 换到任何模型，资产不废弃 |
| 编排层用 shell | 零依赖、透明可审；复杂度在资产不在代码 |
| 一阶段一次有界调用、任务原子化 | 对抗中等模型长程漂移的最有效手段 |
| 门禁自动先行、人工后置 | 机器能查的不劳人；人只审决策与验收 |
| 状态全量落盘（state.json + history） | 断点续跑 + 合规审计双收益 |
| 规格库归档制 | 借鉴 OpenSpec，解决长期维护的规格漂移 |
