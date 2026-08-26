# hh-specc 平台操作指南

> 版本：v0.0.0 ｜ 编制日期：2026-08-25 ｜ 适用对象：使用 hh-specc 将自然语言需求转成可运行代码的开发者
> 配套文档：《01-业界Spec流程对标分析》（§2.7 自研对标）、《03-specc平台功能模块架构》、《07-端到端演练复盘》

---

## 0. 一句话理解 hh-specc

hh-specc 是一个**规范驱动 AI Coding 平台**：你把一段自然语言需求交给它，它按六阶段流程（`specify → clarify → plan → tasks → implement → verify`）逐阶段生成规格与代码，每一步都经过「自动门禁 + 人工检查点」双闸门，最终产出**规格资产 + 可运行代码 + 审计线索**三类交付物。

---

## 1. 快速上手

### 1.1 前置条件

| 依赖 | 用途 | 必需？ |
|---|---|---|
| bash | 平台编排层（CLI 全部用 shell 实现） | 必需（macOS 自带） |
| python3 | state.json 读写、config.yaml 解析 | 必需（macOS 自带） |
| Codex CLI | 引擎适配层（调用模型生成产物） | 可选：未装则退化为 Manual 人工模式 |
| 模型密钥环境变量 | `DEEPSEEK_API_KEY` | 仅 codex 引擎模式需要 |

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

---

## 2. 命令速查表

| 命令 | 作用 |
|---|---|
| `./specc.sh init` | 初始化/校验平台资产与工作目录 |
| `./specc.sh new <需求ID> ["需求描述"]` | 创建需求工作目录（可携带需求描述） |
| `./specc.sh status [需求ID]` | 查看阶段进度、门禁状态、任务进度、审计历史 |
| `./specc.sh <stage> <需求ID>` | 执行六阶段之一 |
| `./specc.sh redo <stage> <需求ID>` | 重置某阶段及之后的门禁（保留之前阶段） |
| `./specc.sh strip <需求ID> [--apply]` | 剥离可观测性注解/标签（交付前清理，默认仅预览） |
| `./specc.sh approve <需求ID> [意见]` | 异步审批：通过待审阶段 |
| `./specc.sh reject <需求ID> <意见>` | 异步审批：否决待审阶段 |
| `./specc.sh help` | 帮助（`-h` / `--help` 等价） |
| `./specc.sh --version` | 版本号（`-v` / `version` 等价） |

需求 ID 规则：仅允许字母、数字、连字符，且以字母数字开头（防止路径穿越）。

---

## 3. 六阶段流程

六阶段严格线性，禁止跳阶段（前置阶段未通过，后续阶段拒绝执行）。

| 阶段 | 产物（写入 `features/<需求ID>/`） | 自动门禁 | 人工检查点 |
|---|---|---|---|
| specify | `spec.md` + 业务层知识三件套 `business.md`/`data-model.md`/`flows.md` | ✅ spec 结构 + 三件套齐备 | ✅ 需人工审 |
| clarify | `clarify.md` + 回填 `spec.md` | ✅ 无 `[NEEDS CLARIFICATION]` 残留 | 自动通过 |
| plan | `plan.md` + `contracts/*.yaml` | ✅ 契约四要素齐备 | ✅ 需人工审 |
| tasks | `tasks.md` | ✅ 每条 Req 被任务回链覆盖 | 自动通过 |
| implement | 代码写入 `projects/<需求ID>/` | 逐任务验证命令 | 自动通过 |
| verify | `verify-report.md` + 跨端可观测 DAG | ✅ 验证报告四部分 + DAG 自动生成 | ✅ 需人工终审 |

### 3.1 自动门禁（✓ 先行）

每阶段产物落盘后，先跑自动门禁，失败即终止并报出**具体缺什么**：

- **specify**：`spec.md` 缺 `Req-N` 条目、缺「不做什么」章节、缺「量化约束」章节、三件套任一缺失/为空 → 任一不满足即失败
- **clarify**：`spec.md` 仍残留 `[NEEDS CLARIFICATION]` → 列出未消除的行
- **plan**：契约缺四要素（`error-code-table` / `auth:` / `pageNum` / 统一响应体）→ 逐个文件报缺哪项
- **tasks**：spec 中某条 `Req-N` 未被任何任务的回链行覆盖 → 报出缺失的需求编号
- **verify**：`verify-report.md` 缺四部分（测试汇总/契约一致性/宪法抽查/验收对照表）→ 逐项报缺；跨端可观测 DAG 生成失败 → 报扫描/合并错误

### 3.2 人工检查点（✋ 后置）

需要人工审查的阶段只有三个：**specify / plan / verify**。有两种模式：

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
  id: deepseek-v4-pro
  provider: deepseek
  base_url: https://api.deepseek.com
  wire_api: responses
  api_key_env: DEEPSEEK_API_KEY   # 密钥走环境变量，不入库

pipeline:
  profile: full             # full 六阶段全走（light/change 为 v0.2 规划）
  context_warn_chars: 60000 # 上下文体积告警阈值

tasks:
  max_retry: 1              # 单任务失败自动重试次数
```

**密钥安全**：密钥只从环境变量读取（`DEEPSEEK_API_KEY`），禁止写入 config.yaml 或任何代码/文档（宪法 2.1）。

---

## 5. 目录结构（平台与需求产物隔离）

```
hh-specc/
├── .specc/             # 平台资产（宪法/平台层/模板/指令/配置）—— 新增需求零改动
├── lib/ specc.sh       # 编排层（CLI + 流程引擎 + 门禁 + 组装器 + 引擎适配）
├── features/<需求ID>/   # 规格产物（spec/plan/tasks/contracts + 业务层知识 + state.json）
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
[信息] 开始第一阶段：./specc.sh specify daily-quote
```

产物：`features/daily-quote/`（含 `contracts/` 子目录、`state.json`、`requirement.md`）。

### 7.2 specify（需求规格化）

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

### 7.3 clarify（澄清问答）

```bash
./specc.sh clarify daily-quote
```

引擎针对 spec 中模糊点生成问答，回填 `spec.md` 并清零 `[NEEDS CLARIFICATION]`。自动门禁校验无残留后自动通过（无人工检查点）。

### 7.4 plan（技术方案 + 契约）

```bash
./specc.sh plan daily-quote
```

生成 `plan.md`（架构/数据模型/API/测试策略）+ `contracts/quote.yaml`（接口契约）。

自动门禁校验契约四要素齐备（统一响应体 / 错误码表 / 认证 / 分页），随后进入人工检查点：

```bash
./specc.sh approve daily-quote
```

### 7.5 tasks（任务拆解）

```bash
./specc.sh tasks daily-quote
```

生成 `tasks.md`：原子任务清单，每任务带「端/工程」「回链」与「验证命令」。自动门禁校验每条 `Req-N` 都被任务回链覆盖后自动通过。

### 7.6 implement（逐任务实现）

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

### 7.7 verify（验证与报告）

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
# [通过] 六阶段全部完成！需求【daily-quote】已端到端实现完毕
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
