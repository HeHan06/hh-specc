# 平台层知识：技术栈契约（tech-stack）

> 层级：平台层（"Web 管理系统 + 微信小程序"品类通用，跨业务项目复用）
> 用途：plan / tasks / implement 阶段注入，约束技术方案与代码形态
> 注意：具体版本与禁止项以宪法第一条为准，本文件定义工程结构与技术细节约定

## 1. 仓库结构（Monorepo）

```
项目根/
├── .specc/           # specc 框架资产（平台层知识 + 模板 + 指令 + 配置）
├── lib/ specc.sh     # specc 平台组件（CLI + 流程引擎 + 门禁）
├── features/         # 需求工作目录（规格产物：spec/plan/tasks/contracts）
├── projects/         # 需求代码归档目录（每需求一个子目录，与平台组件隔离）
│   └── <需求ID>/
│       ├── web-admin/    # Web 管理后台（React 18 + Vite + Ant Design）
│       ├── miniprogram/  # 微信小程序（Taro）
│       ├── backend/      # 后端（Java 17 + Spring Boot 3 + MyBatis）
│       └── shared/       # 双端共享层（见 platform/dual-end-boundary.md）
└── docs/             # 项目文档
```

## 2. Web 后台（web-admin/）

- 构建：Vite；路由：React Router；状态：轻量优先（Context / Zustand），不默认引入 Redux
- UI：Ant Design 组件库；页面模式遵循 `platform/web-admin-standards.md`
- 目录约定：
  - `src/pages/` 页面（按业务模块分目录）
  - `src/components/` 通用组件
  - `src/services/` 数据流转（页面访问数据的唯一入口）
  - `src/api/` 接口封装（必须复用 `shared/` 的 API 客户端基座）
  - `src/utils/`、`src/constants/` 优先从 `shared/` 引入，不重复造

## 3. 小程序（miniprogram/）

- 框架：Taro（React 语法），编译目标为微信小程序
- 目录约定：`src/pages/`（页面）、`src/components/`、`src/services/`（数据流转，复用 `shared/`）
- 平台差异：微信特有 API（wx.*）统一封装在 `src/platform/`，禁止页面内裸调
- 遵循 `platform/miniprogram-standards.md` 的合规与体积约束

## 3.1 跨端前端架构统一（防漂移）

跨端分层、防漂移硬规则、三态与竞态样板、抽象触发闸门等细则统一见 `platform/frontend-architecture.md`（F-01 ~ F-06），本章不重复其内容，只维护各端目录清单与端权责。若两者冲突，以 `frontend-architecture.md` 为准。

## 4. 后端（backend/）

- Java 17 + Spring Boot 3 + MyBatis + PostgreSQL
- 分层：Controller（参数校验/鉴权）→ Service（业务逻辑）→ Mapper（MyBatis 数据访问）
- 目录约定：按业务模块分包（`com.<项目>.<模块>`），不按技术层平铺
- 统一响应体、错误码、分页格式见 `platform/api-conventions.md`
- 数据库变更：DDL 必须在 plan 阶段给出（PostgreSQL 语法），随任务生成迁移脚本，禁止运行期手工改表

## 5. 通用约定

- 前后端跨域、鉴权令牌传递方式由契约统一约定，禁止各端私定
- 所有工程必须能通过各自的标准构建命令（plan 阶段写明验证命令）
- 依赖版本在 plan 阶段锁定，implement 阶段不得随意升级

## 6. 可观测性注解（code-graph 标签规范）

> 目的：让 AI 生成的代码携带「语义标签」，编译期自动生成 DAG 图（code-graph.json/.mmd），
> 供 verify 阶段与人工 review 快速理解「这段代码属于哪个能力、实现哪个任务、调用关系如何」。
> 关键：注解保留策略为 SOURCE，仅编译期被 APT 扫描，运行时不进字节码，业务性能零影响。

### 6.1 后端（Java）三个注解

| 注解 | 贴在哪 | 语义 | 对齐资产 |
|---|---|---|---|
| `@Capability` | 类/接口 | 能力（功能面） | `spec.md` 的 `Req-N` |
| `@CapabilityPoint` | 方法 | 能力点（原子任务） | `tasks.md` 的 `T-XX` |
| `@Orchestrate` | 方法 | 编排边（调用关系） | `flows.md` / 契约 |

- **编号必须真实对齐 spec/tasks，禁止臆造**（否则 DAG 撒谎，失去可观测价值）。
- `@Orchestrate.from/to` 用任务编号（T-XX）显式声明上游→下游，`rel` 默认 `calls`。
- 依赖用 `scope=provided`，构建挂 APT 处理器（`annotationProcessorPaths`），产物写 `target/observability/`。
- 注解模块：`specc-observability`（平台级 SDK，跨需求复用，不随业务代码入库）。

### 6.2 前端（web-admin / miniprogram）标注

- 语义对齐：能力=`Req-N`、能力点=`T-XX`、编排边=调用关系。
- 以 JSDoc 标签标注语义（`@capability` / `@capabilityPoint` / `@orchestrate`）。
- 前端扫描器 `specc-observability/frontend/scan.cjs` 用 Babel AST 解析 JSDoc 标签，
  产出与后端同构的 DAG；跨端合并器 `merge.cjs` 按节点 id 合并前后端为完整调用链。
- 扫描与合并已接入 verify 阶段自动执行（见 `lib/observability.sh`），无需手动敲命令。
