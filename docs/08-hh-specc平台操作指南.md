# hh-specc 平台操作指南

> 版本：v0.0.0 ｜ 编制日期：2026-08-25 ｜ 适用对象：使用 hh-specc 将自然语言需求转成可运行代码的开发者
> 配套文档：《01-业界Spec流程对标分析》（§2.7 自研对标）、《03-specc平台功能模块架构》、《07-端到端演练复盘》

---

## 0. 一句话理解 hh-specc

hh-specc 是一个**规范驱动 AI Coding 平台**：你把一段自然语言需求交给它，它按七阶段流程（`probe → specify → clarify → plan → tasks → implement → verify`）先帮你把需求探询补全，再逐阶段生成规格与代码，每一步都经过「自动门禁 + 人工检查点」双闸门，最终产出**规格资产 + 可运行代码 + 审计线索**三类交付物。

---

## 1. 快速上手

### 1.1 前置条件

| 依赖 | 用途 | 必需？ |
|---|---|---|
| bash | 平台编排层（CLI 全部用 shell 实现） | 必需（macOS 自带） |
| python3 | state.json 读写、config.yaml 解析 | 必需（macOS 自带） |
| Codex CLI | 引擎适配层（调用模型生成产物） | 可选：未装则退化为 Manual 人工模式 |
| 模型密钥环境变量 | `DEEPSEEK_API_KEY` | 仅 codex 引擎模式需要 |

> 密钥建议写入 `~/.zshrc`（`export DEEPSEEK_API_KEY="..."`），一次配置、每个新终端会话自动生效，无需每次手动 export。

> 业务项目自身依赖（如 Java 17、Node、PostgreSQL）由**具体需求**决定，不在平台前置条件内。本文 §7 的示例需求（双端项目）需要它们。

### 1.2 初始化

```bash
./specc.sh init
```

- 校验 `.specc/` 平台资产完整性（宪法/平台层/模板/指令/配置），缺失即报错提示恢复
- 幂等创建 `features/`、`projects/` 两个工作目录
- 不预置业务层知识（业务层知识由 specify 阶段按需生成）

### 1.3 查看版本

```bash
./specc.sh --version   # 或 -v / version
# 输出：hh-specc v0.0.0
```

版本号单一真相源在 `.specc/config.yaml` 的 `app.version`，与 git tag 保持一致。

### 1.4 输入需求材料（`--prd` 需求文档 / `--kb` 知识库）

新建需求时，除了用一句话描述需求外，还可挂入两类材料。平台严格区分二者语义，**不再使用旧的 `--attach`**（已退役，语义模糊）：

| 参数 | 语义 | 去向 | 注入方式 |
|---|---|---|---|
| `--prd <文件\|目录>` | **需求文档（PRD）**——本次要做什么，是需求正文 | `requirement.md` | specify **全文**注入（作为 `{REQUIREMENT_TEXT}`） |
| `--kb <文件\|目录>` | **知识库（参考素材）**——长期沉淀、辅助参考 | `knowledge/` | 索引 + 选读，**只读选中** |

```bash
# 需求文档：全文并入 requirement.md，作为需求正文
./specc.sh new demo "需求概述" --prd ./需求文档.md

# 知识库：复制进 knowledge/，走「索引 + 选读」，不全文灌入
./specc.sh new demo "需求概述" --kb ./参考目录/ --kb ./术语表.md

# 二者可并用：一份 PRD + 若干参考资料
./specc.sh new demo "需求概述" --prd ./需求文档.md --kb ./参考目录/
```

- **文件**：按扩展名白名单（md/txt/json/yaml/js/jsx/ts/tsx/java/sql/css/scss/html/xml/sh 等）读入，忽略非文本与空文件。`--prd` 全量 cat 进 `requirement.md`；`--kb` 复制进 `knowledge/`。
- **目录**：`--prd` 读入目录内全部文本文件（标注来源）；`--kb` 递归复制文本文件到 `knowledge/`（保留相对路径），并过滤 `node_modules`/`.git`/`target`/`dist`/`build`/`*.log` 及图片/`.class` 等非文本噪音。
- **知识库选读机制**：`--kb` 的内容不会一股脑灌进上下文。`new` 时会自动生成 `knowledge/.index.md`（仅每个文件的标题行摘要），probe/specify 阶段先只给模型这份**索引**；模型据此写出候选清单 `knowledge/selection.md`（每行一个相对路径），你编辑确认后重跑相应阶段，系统才把**选中的那几份**全文注入。上下文从「全量」收敛为「索引 + 3~5 份选中」，且你不会蹲在命令行猜挂哪个文件。
- **图片**：当前引擎接收的是文本 prompt，图片二进制本身不直接作为输入。但框架已支持**按环节自动切换视觉多模态模型**（`model.vision.id`，默认 `deepseek-v4-flash-vision-exp`）——凡上下文带有图片路径引用（markdown 图片 / 【附图:path】 / 裸图片路径，如 UI 预设的首页设计图、`--prd` 目录里的图片路径），该环节会自动用视觉模型，模型即可「看图」理解布局与风格。
- **需求描述缺省**：无 `--prd` 也无描述时，`requirement.md` 写入占位提示（见下方「空需求占位」），作为 probe 探询的阶段起点，可由探询/后续手动补充。

> `--attach` 已被退役。若仍使用会直接报错并提示改用 `--prd`（需求文档，进 `requirement.md`）或 `--kb`（知识库，进 `knowledge/`）。

---

## 2. 命令速查表

| 命令 | 作用 |
|---|---|
| `./specc.sh init` | 初始化/校验平台资产与工作目录 |
| `./specc.sh new <需求ID> ["描述"]` | 创建需求工作目录（可携带需求描述） |
| `./specc.sh new <需求ID> ["描述"] --prd <文件\|目录>...` | 创建需求并挂入**需求文档（PRD）**（进 `requirement.md` 全文注入，见 §1.4） |
| `./specc.sh new <需求ID> ["描述"] --kb <文件\|目录>...` | 创建需求并挂入**知识库**（进 `knowledge/`，索引+选读，见 §1.4） |
| `./specc.sh status [需求ID]` | 查看阶段进度、门禁状态、任务进度、审计历史 |
| `./specc.sh <stage> <需求ID>` | 执行七阶段之一 |
| `./specc.sh redo <stage> <需求ID>` | 重置某阶段及之后的门禁（保留之前阶段） |
| `./specc.sh strip <需求ID> [--apply]` | 剥离可观测性注解/标签（交付前清理，默认仅预览） |
| `./specc.sh approve <需求ID> [意见]` | 异步审批：通过待审阶段 |
| `./specc.sh reject <需求ID> <意见>` | 异步审批：否决待审阶段 |
| `./specc.sh help` | 帮助（`-h` / `--help` 等价） |
| `./specc.sh --version` | 版本号（`-v` / `version` 等价） |

> `--attach` 已退役（语义模糊），改用 `--prd`（需求文档） / `--kb`（知识库）。

需求 ID 规则：仅允许字母、数字、连字符，且以字母数字开头（防止路径穿越）。

---

## 3. 七阶段流程

七阶段严格线性，禁止跳阶段（前置阶段未通过，后续阶段拒绝执行）。

| 阶段 | 产物（写入 `features/<需求ID>/`） | 自动门禁 | 人工检查点 |
|---|---|---|---|
| probe | `probe-questions.md`（探询问题清单）；用户回答写 `probe-answers.md` | ✅ 问题清单已生成 | ✅ 需人工审（裁决"是否问清了"） |
| specify | `spec.md` + 业务层知识三件套 `business.md`/`data-model.md`/`flows.md` | ✅ spec 结构 + 三件套齐备 | ✅ 需人工审 |
| clarify | `clarify.md` + 回填 `spec.md` | ✅ 无 `[NEEDS CLARIFICATION]` 残留 | 自动通过 |
| plan | `plan.md` + `contracts/*.yaml` | ✅ 契约四要素齐备 | ✅ 需人工审 |
| tasks | `tasks.md` | ✅ 每条 Req 被任务回链覆盖 | 自动通过 |
| implement | 代码写入 `projects/<需求ID>/` | 逐任务验证命令 | 自动通过 |
| verify | `verify-report.md` + 跨端可观测 DAG | ✅ 验证报告四部分 + DAG 自动生成 | ✅ 需人工终审 |

### 3.1 自动门禁（✓ 先行）

每阶段产物落盘后，先跑自动门禁，失败即终止并报出**具体缺什么**：

- **probe**：`probe-questions.md` 缺失或为空 → 报「探询阶段未产出问题清单」。是否"问清了"由人工裁决，门禁只保证清单存在
- **specify**：`spec.md` 缺 `Req-N` 条目、缺「不做什么」章节、缺「量化约束」章节、三件套任一缺失/为空 → 任一不满足即失败
- **clarify**：`spec.md` 仍残留 `[NEEDS CLARIFICATION]` → 列出未消除的行
- **plan**：契约缺四要素（`error-code-table` / `auth:` / `pageNum` / 统一响应体）→ 逐个文件报缺哪项
- **tasks**：spec 中某条 `Req-N` 未被任何任务的回链行覆盖 → 报出缺失的需求编号
- **verify**：`verify-report.md` 缺四部分（测试汇总/契约一致性/宪法抽查/验收对照表）→ 逐项报缺；跨端可观测 DAG 生成失败 → 报扫描/合并错误

### 3.2 人工检查点（✋ 后置）

需要人工审查的阶段有四个：**probe / specify / plan / verify**。有两种模式：

**交互模式**（你在终端直接跑，stdin 是 TTY）：CLI 暂停，提示输入 `approve` / `reject`。

**异步模式**（脚本/CI/IDE Agent 代跑，stdin 非 TTY）：不阻塞，返回特殊状态 `awaiting_review`，提示你手动执行：

```bash
./specc.sh approve <需求ID>      # 通过
./specc.sh reject <需求ID> 意见   # 否决（意见记入审计链）
```

> 本平台在 IDE Agent 代跑的场景下通常走**异步模式**——这是「人工检查点异步化」的提前落地，人始终是质量守门人。

---

## 4. 配置说明（`.specc/config.yaml`）

```yaml
app:
  name: hh-specc            # 框架名
  version: 0.0.0            # 版本号（单一真相源）

engine:
  type: codex               # codex（调模型）| manual（只出提示词由人工执行）
  output_dir: .specc-cache/prompts   # 提示词组装输出目录

model:                      # 切模型只改这里，lib/engines.sh 自动生成 Codex 配置
  id: deepseek-v4-pro       # 默认推理/文本模型（绝大多数阶段使用）
  provider: deepseek
  base_url: https://api.deepseek.com
  wire_api: responses
  api_key_env: DEEPSEEK_API_KEY   # 密钥走环境变量，不入库
  vision:                     # 多模态视觉模型：上下文带图时自动切换（其余字段继承上层）
    id: deepseek-v4-flash-vision-exp

pipeline:
  profile: full             # full 七阶段全走（light/change 为 v0.2 规划）
  context_warn_chars: 60000 # 上下文体积告警阈值

tasks:
  max_retry: 1              # 单任务失败自动重试次数

knowledge:                  # 知识库（corpus）选读配置
  enabled: true             # 是否启用知识库机制（false 时 probe/specify 忽略 knowledge/）
  selection: manual         # manual=模型先出候选清单，你编辑确认后再读；auto=直接按清单读
  max_files: 8              # 单次最多选读文件数（防上下文超限）
```

**密钥安全**：密钥只从环境变量读取（`DEEPSEEK_API_KEY`），禁止写入 config.yaml 或任何代码/文档（宪法 2.1）。

> 模型按环节自动切换：默认用 `model.id`（v4-pro 推理/文本）；当某阶段上下文携带图片引用（markdown 图片 / 【附图:path】 / 裸图片路径）时会自动改用 `model.vision.id`（视觉多模态），无需手动干预。切换模型只需改 `model.id` / `model.vision.id`，改后 `lib/engines.sh` 会据此重新生成 Codex 配置，无需手动改 `~/.codex/config.toml`。

---

## 5. 目录结构（平台与需求产物隔离）

```
hh-specc/
├── .specc/             # 平台资产（宪法/平台层/模板/指令/配置）—— 新增需求零改动
├── lib/ specc.sh       # 编排层（CLI + 流程引擎 + 门禁 + 组装器 + 引擎适配）
├── features/<需求ID>/   # 规格产物（spec/plan/tasks/contracts + 业务层知识 + knowledge 知识库 + state.json）
│   └── knowledge/      # 本需求专属知识库（--kb 挂入；含 .index.md 索引 + selection.md 选读清单）
├── projects/<需求ID>/   # 代码产物（backend/ shared/ web-admin/ miniprogram/）
└── docs/               # 项目文档
```

**隔离原则**：新增一个自然语言需求，只在 `features/` 和 `projects/` 下各加一个子目录，平台组件（`.specc/`、`lib/`）保持不变。

---

## 6. 状态与审计

每个需求的进度记录在 `features/<需求ID>/state.json`：

```json
{
  "feature": "daily-quote",
  "stage": "verify",
  "gates": { "specify": "approved", "clarify": "approved", "...": "..." },
  "tasks": { "T-01": "done", "T-02": "done" },
  "history": [ { "ts": "...", "text": "..." } ]
}
```

- `gates.<stage>` 取值：`pending`（未开始）→ `running` → `approved` / `awaiting_review` / `rejected` / `gate_failed` / `engine_failed`
- `history` 是完整审计链，记录阶段开始/通过、人工审查结论、任务执行等

用 `./specc.sh status <需求ID>` 可查看全部状态与最近 10 条审计历史。

---

## 7. 真实执行流程示例（daily-quote）

> 以下是 hh-specc 自身端到端演练的真实案例：需求「每日一句」——Web 管理后台 + 微信小程序展示一段文学作品语录。产物已生成在 `features/daily-quote/` 与 `projects/daily-quote/`，可对照查看。

### 7.1 创建需求

```bash
./specc.sh init
./specc.sh new daily-quote "实现一个每日一句功能：Web 后台与微信小程序各展示一段文学作品语录，含出处、背景图、日期；后端提供今日语录接口；无语录时走系统兜底"
```

输出：

```
[通过] 需求工作目录已创建：.../features/daily-quote
[通过] 需求描述已记录：.../features/daily-quote/requirement.md
[信息] 开始第一阶段（需求探询）：./specc.sh probe daily-quote
```

产物：`features/daily-quote/`（含 `contracts/` 子目录、`state.json`、`requirement.md`）。

若想挂入需求文档或知识库，可用 `--prd` / `--kb`（见 §1.4）：

```bash
# 挂一份需求文档（PRD）+ 几份参考素材（知识库）
./specc.sh new ai-guide "AI Agent 方向岗位面试指南 web 平台" \
  --prd ./需求说明书.md \
  --kb ~/Documents/AI-Guide/AI/Agent知识 --kb ~/Documents/AI-Guide/简历优化
```

挂入知识库后，probe/specify 时系统会先给模型知识库**索引**（标题行摘要），模型写出候选清单 `knowledge/selection.md` 供你确认，确认后重跑相应阶段才注入选中文件全文（详见 §1.4「知识库选读机制」）。

### 7.2 probe（需求探询——用户说清"能说的"）

```bash
./specc.sh probe daily-quote
```

引擎（Codex）读取宪法 + 需求描述（探询起点）+ **需求要素清单模板**（`probe-checklist.template.md`，九维）+ probe 指令，产出：

- `probe-questions.md`：本轮**问题清单**，只列【必填】【协作】维度的问题
- `probe-answers.md`：**完整九维需求沉淀**——【必填】=用户回答，【协作】=用户直觉+模型精确化，【方案】=模型出的草案（经用户确认或改）

九维按人机分工分三档（模板为唯一源，见 `.specc/templates/probe-checklist.template.md`）：

| 档位 | 维度 | 谁来做 |
|---|---|---|
| 【必填】 | 产品定位 / 端与角色 / 明确不做 | **必须用户给**（用户独有的商业事实） |
| 【协作】 | 领域术语 / 量化约束 | 用户给直觉，模型精确化 |
| 【方案】 | 核心流程 / 数据对象 / 边界规则 / 假设与依赖 | **模型出草案**，用户确认或改 |

你在 `probe-answers.md` 里逐条回答（每问一行），然后把答案写入后重跑或在人工检查点确认：

```bash
# 编辑 features/daily-quote/probe-answers.md，逐条回答
./specc.sh probe daily-quote   # 多轮：模型基于你的回答收敛或追问
./specc.sh approve daily-quote  # 你认为"问清了、无阻塞歧义"→ 进 specify
```

> probe 的意义：把「用户第一句含糊描述」补全成可支撑规格的完整需求，specify 才不生成错误地基上的草稿。**必填项只有用户能定，非必填项由模型出方案、用户确认**——用户只给「是什么」，方案细节交给模型推导。由你（而非模型）裁决「是否问清了」，这是"人裁决终止"的关键。

### 7.3 specify（需求规格化）

```bash
./specc.sh specify daily-quote
```

引擎（Codex）读取宪法 + 需求描述 + specify 指令，生成：

- `spec.md`（EARS 需求 + 验收标准 + 「不做什么」+「量化约束」）
- `business.md`（术语/角色）
- `data-model.md`（数据结构）
- `flows.md`（业务流程）

自动门禁校验 spec 结构与三件套齐备后，进入人工检查点（异步模式下提示）：

```
✋ 人工检查点（异步模式）：阶段【specify】产物已生成，等待人工审查
   审查通过后执行：./specc.sh approve daily-quote
```

人工审查 spec.md 后通过：

```bash
./specc.sh approve daily-quote
# [通过] 阶段【specify】审查通过 ✔
# [信息] 下一阶段：clarify（./specc.sh clarify daily-quote）
```

### 7.4 clarify（澄清问答——信息完整后补盲/评审）

```bash
./specc.sh clarify daily-quote
```

引擎针对 spec 中模糊点生成问答，回填 `spec.md` 并清零 `[NEEDS CLARIFICATION]`。自动门禁校验无残留后自动通过（无人工检查点）。

### 7.5 plan（技术方案 + 契约）

```bash
./specc.sh plan daily-quote
```

生成 `plan.md`（架构/数据模型/API/测试策略）+ `contracts/quote.yaml`（接口契约）。

自动门禁校验契约四要素齐备（统一响应体 / 错误码表 / 认证 / 分页），随后进入人工检查点：

```bash
./specc.sh approve daily-quote
```

### 7.6 tasks（任务拆解）

```bash
./specc.sh tasks daily-quote
```

生成 `tasks.md`：原子任务清单，每任务带「端/工程」「回链」与「验证命令」。自动门禁校验每条 `Req-N` 都被任务回链覆盖后自动通过。

### 7.7 implement（逐任务实现）

```bash
./specc.sh implement daily-quote
```

按 tasks.md 顺序逐任务执行（一个任务一次有界引擎调用）：

```
==> 任务 T-01 开始
   ...
[通过] 任务 T-01 完成 ✔
==> 任务 T-02 开始
   ...
```

- 代码写入 `projects/daily-quote/` 下的 `backend/`、`shared/`、`web-admin/`、`miniprogram/`
- 每任务测试先行 + 跑该任务验证命令；失败自动重试 1 次，仍失败则挂起
- 不自动 commit（Git 形态 A：进版本库的动作保留给人）

### 7.8 verify（验证与报告）

```bash
./specc.sh verify daily-quote
```

生成 `verify-report.md`（测试汇总 + 契约一致性 + 验收标准逐条对照表），并自动生成跨端可观测 DAG：

- 后端 DAG：`projects/daily-quote/backend/target/observability/`（编译期 APT 自动生成）
- 前端 DAG：`projects/daily-quote/target/observability-frontend/`（前端扫描器生成）
- 跨端总图：`projects/daily-quote/target/observability/`（前后端按节点 id 合并，展示完整调用链）

人工对照验收标准终审后：

```bash
./specc.sh approve daily-quote
# [通过] 七阶段全部完成！需求【daily-quote】已端到端实现完毕
```

---

## 8. 常见操作与注意事项

**交付前剥离可观测性注解/标签（strip）**

```bash
./specc.sh strip daily-quote             # 默认仅预览，展示将删除的 diff，不写文件
./specc.sh strip daily-quote --apply     # 真正剥离（自动备份到 .specc-cache/strip-backup/）
```

- 清理对象：后端 `@Capability` / `@CapabilityPoint` / `@Orchestrate` 注解 + 对应 import；前端 JSDoc 的 `@capability` / `@capabilityPoint` / `@orchestrate` 标签块
- 安全性：只删可观测性标签，业务逻辑零改动；注解为 SOURCE 保留策略，删除后编译/运行零影响
- 幂等：可反复执行，第二次起提示「未发现可观测性注解/标签」
- 还原：`--apply` 前自动整目录备份，从 `.specc-cache/strip-backup/<需求ID>-<时间戳>/` 恢复

**重跑某阶段（修改产物后）**

```bash
./specc.sh redo plan daily-quote    # 重置 plan 及其后所有阶段门禁，之前的保留
./specc.sh plan daily-quote         # 重新执行
```

**查看进度**

```bash
./specc.sh status daily-quote
# 展示：当前阶段、各门禁状态、任务进度、最近 10 条审计历史
```

**切换为纯人工模式（不调模型）**

编辑 `.specc/config.yaml`：`engine.type: manual`。此后每个阶段只输出组装好的提示词与产物清单，由你在任意 IDE Agent 中手动执行、把产物放回约定路径，再重跑该阶段命令过门禁。

**密钥未设置时**

codex 引擎会明确报错 `未设置环境变量 DEEPSEEK_API_KEY`，并自动退化为 manual 模式（不崩溃）。

---

## 9. 当前版本（v0.0.0）边界

以下为 v0.2 规划，**当前未实现**（已在对应文档标注）：

- `specc archive` 归档与规格库（`specs/` 目录）——随版本迭代一并实现
- `light` / `change` 流程裁剪 profile
- 契约一致性自动比对脚本增强、安全扫描闸门
- 多需求并行隔离、知识资产版本化

> 端到端演练暴露的真实短板（详见《07-端到端演练复盘》）：verify 验证的是「代码看起来对」而非「系统能跑」，建议人工在 verify 后补做一次真机级启动冒烟（启动依赖服务 → 迁移 → 启动后端 → 验证接口与静态资源）。
