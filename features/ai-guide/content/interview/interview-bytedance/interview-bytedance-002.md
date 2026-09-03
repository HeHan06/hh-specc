## 面试概览

- 公司：字节跳动
- 岗位：本地生活国际化部门（后端/Agent 开发）
- 轮次：一面（技术面）
- 时间：未知
- 流程：Agent 系统设计 → Java 基础 → 算法（翻转二叉树，禁递归）→ 反问

## 面试问题与回答

### Q1：讲讲你们的 Agent 系统是怎么设计的？

- 三层回答框架：第一层全局定位（C 端导购 Agent、日均 30 万对话、ReAct + 协调者-子智能体 Multi-Agent，三阶段演进）；第二层架构展开（协调者负责意图识别/任务拆解/工具路由，子 Agent 各自独立上下文和工具集）；第三层架构演进思考（单 Agent → Multi-Agent → Agent as OS）。
- 上下文四象限治理：按稳定/动态 × 全局/当前任务分类，预加载、按需注入、压缩替换。
- 窗口占比与预算管理（追问点）：64K 预算分配（System Prompt 12K、工具定义 8K、历史摘要 6K、工具结果 20K、思考余量 18K），超预算策略与监控告警。

### Q2：线程池的创建参数和拒绝策略？

- 七参数：corePoolSize、maximumPoolSize、keepAliveTime、unit、workQueue、threadFactory、handler。
- 执行流程：核心线程满 → 放队列 → 队列满建非核心线程 → 全满走拒绝策略。
- 四拒绝策略：AbortPolicy（默认抛异常）、CallerRunsPolicy（调用线程执行，不丢任务）、DiscardPolicy（静默丢弃）、DiscardOldestPolicy（丢最旧）。
- 实际场景：Agent 工具调用用 CallerRunsPolicy，保证核心链路不丢任务。

### Q3：实际业务中线程池有哪些坑？

- 不要用 Executors 创建（FixedThreadPool 无界队列、CachedThreadPool 无限线程），必须显式 new ThreadPoolExecutor。
- 线程池隔离：不同业务类型用不同池（工具调用短平快、LLM 请求耗时长分开）。
- ThreadLocal 内存泄漏：线程池线程复用，用完必须 remove，否则读脏数据（traceId 串了）。

### Q4：实际项目中怎么监控线程池？

- 封装 ThreadPoolExecutor 重写 beforeExecute/afterExecute 记录等待时间、执行时间、队列大小、活跃线程数。
- 接入监控平台，核心指标：queue_size、active_count、task_wait_time、reject_count；queue_size 超阈值或 reject_count>0 触发 P1 告警。

### Q5：算法——翻转二叉树（迭代，禁止递归）

- 用栈做迭代前序遍历（或队列做 BFS 层序），遍历每个节点时交换左右子树。
- 时间复杂度 O(n)、空间复杂度 O(n)（最坏链状树）。

## 复盘总结

### 做得好

- 算法题通过：翻转二叉树在「不能递归」约束下用栈迭代完成，有应变能力。
- 有真实 Agent 落地经验（日均 30 万对话）。

### 待改进

- Agent 设计讲得太「项目化」，缺结构化框架（窗口占比、预算管理细节遗漏）。
- Java 多线程基础不扎实。
- 沟通不够主动，等追问才展开，缺少节奏感。

### 下一步

- 背熟 Agent 三层回答框架，控制在 5 分钟内；补窗口占比/预算管理的数字细节。
- 刷 Java 多线程高频题（volatile/synchronized/CAS/AQS/ThreadLocal 速查表）。
- 练习面试节奏（先给结论和数据，再展开，结尾抛延伸思考）。
