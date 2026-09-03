## 面试概览

- 公司：小米
- 岗位：小爱同学（Agent 相关）
- 轮次：二面
- 时间：2026-08-24
- 流程：自我介绍 → 简历提问 → 后端基础知识提问

## 面试问题与回答

### Q1：单机 QPS 优化 5 倍，具体怎么做的？

- 场景：某项目接入导购 Agent，压测端到端 QPS 仅 1~2，单机每秒只能扛 1~2 个完整请求。
- 定位到两个瓶颈：CPU 高负载；推品工具和预约要素收集工具串行调用导致端到端 RT 过长。
- 两个动作：用有界阻塞队列做缓冲削峰、缓解 CPU 峰值；推品 + 预约要素收集工具并行化（RT 从求和降到取最大值）。
- 结果：单机 QPS 从 1~2 提到 10+（约 5 倍）；推品首 token 时延降 33%、预约要素收集降 38%。

### Q2：评测平台的系统设计难点

- 难点一：数据集质量和覆盖度（Agent 覆盖 200+ 行业，分层采样 + 标注规范）。
- 难点二：LLM-as-Judge 一致性和校准（人机一致率从 40% 用案例驱动校准拉到 90%）。
- 难点三：大规模评测任务编排（数据集管理、批量执行、失败重试、并发调度、可复现可回溯）。
- 核心难点是「怎么让机器评得和人类一样准」。

### Q3：大模型裁判（LLM-as-Judge）的提示词最佳实践

- 明确评估维度和评分标准（rubric）；结构化输出（评分 + 理由分离成 JSON）；few-shot 黄金案例校准；单一职责（一次评一个维度）；防偏见（位置偏见、长度偏见，交换顺序双向评估取平均）。
- 落地核心：主观评价优先 + 案例驱动校准，一致率 40%→90%。

### Q4：MVCC 原理 + 如何解决读已提交和可重复读

- 三样东西：每行隐藏列 trx_id + roll_pointer；undo log 版本链；ReadView（m_ids/min_trx_id/max_trx_id/creator_trx_id）。
- 可见性规则：trx_id=creator 可见；<min_trx_id 已提交可见；>=max_trx_id 未来不可见；中间看是否在 m_ids。
- RC vs RR 区别在 ReadView 生成时机：RC 每次 SELECT 生成新 ReadView（出现不可重复读/幻读）；RR 事务第一次 SELECT 生成一个并复用（解决不可重复读）。
- 补充：RR 下当前读（FOR UPDATE/UPDATE/DELETE）MVCC 管不住，靠 next-key lock 防幻读。

### Q5：Kafka 场景：3 partition + 3 consumer 怎么加速？变 6 个会更快吗？

- 结论：变 6 个不会更快，反而有 3 个空闲（一个 partition 同一时刻只能被一个 consumer 消费）。
- 加快正确做法：增加 partition 数量（根本手段，但只能增不能减、会触发 rebalance）；提升单条消息处理效率；批量消费（fetch.min.bytes/max.poll.records）；异步化（消费与处理解耦）。

### Q6：Redis ZSet 原理 + 各操作复杂度 + 为什么不用 hash

- 底层：哈希表（dict，member→score 映射）+ 跳表（skiplist 按 score 排序）；元素少时用 listpack。
- 复杂度：ZADD O(logN)、ZSCORE O(1)、ZRANK/ZREVRANK O(logN)、ZRANGE/ZRANGEBYSCORE O(logN+M)、ZREM O(logN)、ZCARD O(1)。
- 为什么不用 hash：hash 只能 O(1) 按键取单个值，无顺序概念；ZSet 的价值在「有序」，适合排行榜、延时队列、滑动窗口限流、TopK。

## 复盘总结

### 做得好

- 原文未记录明确亮点。

### 待改进

- 简历写了「结果导向」的亮眼数据，但没准备好「怎么做到」的推导链（QPS 5 倍、评测平台、LLM 裁判 prompt），被追问就卡壳。
- 后端八股（MVCC、Kafka、Redis ZSet）只背结论、没理解「原理 + 为什么这么设计」。

### 下一步

- 简历每个数字都配「问题 → 手段 → 数据」链路（QPS 5 倍、一致率 90%、Token 70k→1.5k）。
- 后端八股单独补一轮，重点「为什么这么设计 + 不同选择的取舍」。
- 自己项目必须讲出「难点 + 解法 + 量化结果」，避免被质疑简历真实性。
