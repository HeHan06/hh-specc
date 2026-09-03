## 问题

缓存模式的完整图谱（7 种标准模式）。

## 考察点

- 读策略、写策略、协同与兜底策略的分类
- 按业务场景选型的决策矩阵

## 标准答案

### 读策略（Read Patterns）—— 解决「怎么把数据塞进缓存」

- Cache-Aside（旁路缓存）：应用层代码先查缓存，未命中则查 DB，再回填缓存。
- Read-Through（读穿透）：应用只与缓存交互。缓存组件内部封装了查 DB 的逻辑，自动回填。
- Refresh-Ahead（预刷新）：缓存组件异步在数据过期前自动加载最新数据，而不是等到读请求触发。不阻塞请求，后台线程静默更新，适合热点数据。

### 写策略（Write Patterns）—— 解决「数据变更时怎么处理」

- Write-Through（写穿透）：应用只更新缓存，由缓存组件同步将数据写入 DB。保证缓存和 DB 强一致，但写入延迟变高。
- Write-Behind / Write-Back（回写）：应用只更新缓存，缓存组件异步批量将数据刷入 DB。写入性能极高（异步合并），但存在数据丢失风险（缓存宕机）。
- Write-Around（绕写）：数据直接写入 DB，只删除缓存（Invalidation），不更新缓存。

### 协同与兜底策略

- Multilayer Cache（多级缓存）：L1（本地 Caffeine）+ L2（Redis）协同工作。
- Cache Invalidation（缓存失效广播）：通过 MQ/Redis Pub/Sub 通知分布式集群删除本地缓存。

### 大厂实战选型（决策矩阵）

决策维度 1：对数据一致性（Consistency）的要求

- 必须强一致（金融/库存扣减）：禁止使用任何读/写缓存模式，直接查 DB。如果非要加缓存，采用 Write-Through + 事务性发件箱模式，但成本极高，一般不推荐。

决策维度 2：读写比例（Read/Write Ratio）

- 读多写少（> 9:1）（商品详情、用户信息）：选型 Cache-Aside（读）+ Write-Around（写）。原因：读时懒加载，写时删缓存，这是最经典、最稳定的组合。配合 Read-Through（用 Caffeine 的 LoadingCache）可以让代码更简洁。
- 写多读少（< 5:5）（日志收集、埋点计数）：选型 Write-Behind（回写）。原因：将多次写入合并成一次批量 DB 操作，极大提升吞吐量。但要接受极端宕机丢数据的风险。

决策维度 3：是否分布式（单机 vs 集群）

- 单机应用 / 非共享数据：直接用 Read-Through + Write-Through，缓存组件全权接管，代码最干净。
- 分布式多实例（大厂常态）：
  - 读：采用 Multilayer Cache（Caffeine L1 + Redis L2）。L1 使用 Read-Through（自动加载），L2 使用 Cache-Aside（手动查 Redis 回填）。
  - 写：采用 Write-Around（写删）+ Invalidation 广播。绝对不能使用 Write-Through 或 Write-Behind，因为分布式环境下数据同步根本无法实现。

## 关联

- 本地缓存如何更新
- 缓存穿透、雪崩、击穿
