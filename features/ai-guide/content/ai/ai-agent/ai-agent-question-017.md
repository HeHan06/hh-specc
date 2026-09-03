## 问题

Prompt Engineering 和 Context Engineering 有什么区别？

## 考察点

- 是否理解 Prompt Engineering 是 Context Engineering 的子集
- 能否区分两者的作用对象与层次（静态指令 vs 动态信息环境）
- 是否有「上下文决定效果上限」的认知

## 标准答案

### 层级关系

Prompt Engineering 是 Context Engineering 的一个子集。

### Prompt Engineering

- 关注 Prompt 本身：角色设定、指令如何措辞、few-shot 示例、输出格式约束、思维链引导。
- 目标是让模型准确理解任务、输出规范。

### Context Engineering

- 关注整个上下文窗口的编排，是系统级的：窗口里放什么、放多少、按什么顺序、优先级怎么排、哪些内容该检索、哪些该压缩、哪些该丢弃。
- 它是动态的，每轮对话都在实时变化。

### 核心区别

- 作用对象和层次不同：前者作用在「指令」上，偏静态；后者作用在「信息环境」上，偏动态和系统化。
- 真实 Agent 或 RAG 系统里，决定效果上限的往往不是指令写得有多好，而是喂进去的上下文质量——检索回来一堆无关片段、历史冗余、过时记忆，指令再精也救不回来。

### 结论

更看重 Context Engineering 这层：管理好 token 预算、检索结果的相关性过滤、历史压缩、记忆分层和内容排序。前者决定「怎么问」，后者决定「给模型看哪些东西、按什么顺序看」。

## 关联

- Prompt、上下文窗口、RAG、token 预算、检索过滤、记忆分层
