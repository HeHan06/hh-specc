## 面试概览

- 公司：拼多多（PDD）
- 岗位：电商交易部门（购物车提单）
- 轮次：一面
- 时间：未知
- 流程：自我介绍 → 项目介绍 → 刷题 → 八股

## 面试问题与回答

### Q1：MySQL 索引为什么用 B+ 树而不是 B 树？

- B+ 树所有数据都存在叶子节点，非叶子节点只存索引键；叶子节点之间用双向链表连接。
- 选 B+ 树的四个原因：范围查询效率高（叶子链表顺序遍历）；IO 次数更少（树更矮）；查询路径长度完全一致；磁盘预读友好（顺序读取优于随机读取）。
- 补充：InnoDB 主键索引（聚簇索引）叶子节点存整行数据，二级索引叶子存主键值；建议用自增 ID 做主键以避免页分裂、保证插入性能。

### Q2：MySQL 和 Redis 数据一致性怎么保证？

- 核心矛盾：缓存和数据库是两个独立存储，任何写入时序都无法绝对保证一致性。
- 标准方案 Cache Aside（旁路缓存）：读先查缓存、未命中读库回填；写先更新数据库、再删除缓存。
- 延迟双删：先删缓存 → 更新数据库 → 延迟几百毫秒再删一次，防止并发读把旧数据写回。
- 最终一致兜底：Canal + MQ 监听 binlog 异步同步、设置合理过期时间、分布式读写锁。

### Q3：数据库分区分表怎么设计？分表键怎么选？

- 分区（Partition）：单库单表按规则拆多个物理文件、对应用透明，适合按时间清理历史数据；分表（Sharding）：拆到多个物理表/库、应用感知路由，适合海量水平扩展。
- 选键三原则：让大多数查询带上分表键、避免跨分片事务、数据分布均匀。
- 常见策略：哈希取模、一致性哈希、范围分片、基因法（订单号里嵌入 user_id 哈希）。
- 扩容：一致性哈希减少迁移量、停服迁移 + 双写切流、提前预留足够逻辑分片。

### Q4：缓存雪崩、穿透、击穿分别是什么？怎么解决？

- 雪崩：大量缓存集中过期或 Redis 宕机、请求全打库。解决：过期时间加随机值、多级缓存、集群/哨兵高可用、限流降级熔断。
- 穿透：查询不存在的 key 每次都穿透到库。解决：布隆过滤器、缓存空值（短 TTL）、参数校验。
- 击穿：热点 key 过期瞬间大量并发打库。解决：热点永不过期/逻辑过期、互斥锁（SETNX 分布式锁）、异步刷新。

### Q4-补充：热点 Key 如何设计？

- 多级缓存 + 本地缓存（Caffeine/Guava，短 TTL 1-3 秒 + 变更通知刷新）。
- Key 分片（Sharding）：把单一热点 key 拆成多个子 key 分散到 Redis 不同分片，写时分发、读时汇总。
- 请求合并（Request Coalescing）：同一 key 只让一个请求穿透后端，其余等待结果（CompletableFuture）。
- 读写分离：写走主节点、读走从节点。
- Agent 场景：Session Context 按用户维度本地缓存 + Redis 异步双写、上下文分层（短期本地/长期 Redis/归档对象存储）、降级为空上下文回复。

### Q5：Kafka 核心架构是什么？怎么保证消息不丢？

- 核心概念：Topic、Partition（有序不可变消息序列）、Producer、Consumer Group、Broker。
- 吞吐高原因：顺序写磁盘、零拷贝（sendfile）、批量发送压缩、Page Cache。
- 不丢三端保障：Producer `acks=all` + `retries`；Broker `min.insync.replicas=2` + 禁 unclean 选举；Consumer 手动提交 offset。

### Q6：流量削峰怎么做？

- 链路：验证码/答题 → CDN 静态化 → Nginx 令牌桶限流 → 前端排队页 → MQ 削峰 → 后端消费 → Redis 缓存 → DB + 熔断降级兜底。
- 各环节精髓：验证码摊平瞬时脉冲；CDN 消化 90%+ 流量；令牌桶封顶总量；MQ 生产消费速率解耦（蓄水池）；Redis 是 DB 前最后一道保护；熔断宁可部分不可用也不全挂。

### Q6-补充：Kafka 如何保证有序消费？如何保证数据一致性？

- 有序性：单 Partition 内有序、多 Partition 无序；靠把需有序消息路由到同一 Partition（指定 Partition Key）、单 Partition Topic、消费端幂等 + 版本号兜底。
- 一致性：Producer→Broker 靠 `acks=all` 等；Broker→Consumer 靠幂等消费（唯一键去重 / Redis SETNX / 业务天然幂等）、Kafka 事务（0.11+）、手动提交 offset（先处理后提交 + 幂等兜底）。

### Q7：线程池核心参数有哪些？怎么合理配置？

- 七参数：corePoolSize、maximumPoolSize、keepAliveTime、unit、workQueue、threadFactory、rejectedHandler。
- 工作流程：核心线程满 → 入队列 → 队列满建非核心线程（至 maximumPoolSize）→ 全满走拒绝策略。
- 四拒绝策略：AbortPolicy（默认抛异常）、CallerRunsPolicy（调用线程自己执行）、DiscardPolicy（静默丢弃）、DiscardOldestPolicy（丢弃最旧任务）。
- 配置：CPU 密集型核数 + 1；IO 密集型核数 × 2；以压测和监控（活跃线程、队列积压、拒绝次数）为准。

### Q8：ThreadLocal 使用场景和内存泄漏问题？

- 原理：每线程有 ThreadLocalMap，key 是 ThreadLocal 弱引用，value 是存的值。
- 场景：链路追踪 traceId、Spring 事务连接、日期格式化、用户上下文传递。
- 泄漏原因：key 弱引用被 GC 后 value 仍被 Entry 强引用；线程池线程复用使 value 永远无法回收。
- 解决：用完手动 `remove()`，try-finally 保证清理（拦截器 afterCompletion 清理）；线程池场景尤需注意。

### Q9：Dubbo 通信协议是什么？RPC 和 HTTP 什么区别？

- Dubbo 协议：dubbo://（Netty + TCP 长连接 + Hessian2）、tri://（HTTP/2 + Protobuf，兼容 gRPC）、rest://（HTTP + JSON）。
- 特点：单一长连接、NIO 异步、16 字节自定义协议头。
- RPC vs HTTP：RPC 二进制长连接性能高、强类型契约、内置服务治理；HTTP 文本协议、松契约、对外 API 友好。
- 选型：内部微服务用 RPC（Dubbo/gRPC），对外 API 用 HTTP。

### Q10：为什么 Dubbo 默认用单一长连接？

- 服务提供者少、消费者多（避免连接爆炸）、请求量小用连接池不划算、连接有成本（fd/内存/心跳维护）。
- 大文件传输场景可配置 connections 增加连接数。

### 六、算法题

- PDD 一面通常考 1-2 道中等题；高频：链表反转 / K 个一组反转、LRU、二叉树层序/锯齿遍历、最长无重复子串、岛屿数量。
- 刷题建议：剑指 Offer + LeetCode Hot 100 + CodeTop 企业题库。

## 复盘总结

### 做得好

- 项目介绍环节大概率过关（Agent 项目经历扎实）。
- 原文未明确记录其他亮点，其余为经验教训沉淀。

### 待改进

- 八股整体未准备，数据库、缓存、Kafka、线程池、ThreadLocal、Dubbo 等经典高频题均未答好。
- 知识结构两面性：Agent/AI 强，但基础后端八股薄弱。

### 下一步

- 按模块建立八股知识体系（Java 并发、MySQL、Redis、MQ、RPC、网络），区分优先级逐一攻克。
- 八股回答用「是什么 → 为什么/怎么用 → 踩坑经历」三段论组织。
- 按公司定制准备（PDD/京东/交易部门重 MySQL/Redis/MQ/并发）。
- 刷题别裸考：突击 Hot 100、CodeTop 高频题；每个知识点准备一个踩坑经历。
