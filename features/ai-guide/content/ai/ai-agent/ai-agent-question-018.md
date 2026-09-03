## 问题

Prompt 四要素 Role、Task、Context、Format 分别解决什么问题？

## 考察点

- 是否准确理解四要素各自回答的问题
- 是否理解 Context 是四要素中最重、最动态的一环
- 是否有 Role/Task/Format 固化、Context 动态编排的工程意识

## 标准答案

### Role（角色）

- 回答「你是谁」，用来对齐模型的知识域、口吻和能力边界。
- 本质不是让模型有人格，而是通过限定身份收窄采样空间，让输出更聚焦、更专业。
- 角色要写具体，不能只写「你是专家」，要写明领域、经验背景和约束。

### Task（任务）

- 回答「干什么」，让模型聚焦目标、避免答非所问。
- 写法上用动词开头、一句话说清，复杂任务再拆步骤。

### Context（上下文）

- 回答「基于什么来干」，提供必要的输入信息，避免模型凭空编造（减少幻觉）。
- 与 Task 的区别：Task 是动作，Context 是素材。这是四要素最重、最动态的一环。

### Format（格式）

- 回答「按什么格式输出」，让输出结构化、可解析、稳定。
- 在 Agent 系统里尤其重要，因为输出常被程序解析；格式不稳定会导致工具解析失败、链路中断。
- 生产里强制 schema、给 few-shot 示例，必要时用 Function Calling 或 JSON Mode 强制约束。

### 工程要点

Role、Task、Format 相对稳定，可固化成系统提示词骨架；Context 是动态的，每轮都要重新编排（检索、压缩、排序），这正是 Context Engineering 的核心动作。所以四要素里 Context 的维护成本最高，也最影响最终效果。

## 关联

- 系统提示词、Context Engineering、Function Calling、JSON Mode、few-shot
