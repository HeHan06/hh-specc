## 问题

如何根据场景设置线程池的参数？

## 考察点

- CPU 密集型与 IO 密集型线程数估算
- 队列、拒绝策略、keepAliveTime 的选择

## 标准答案

核心是判断任务类型。

### CPU 密集型（计算、加密）

coreSize = N+1（N=CPU 核数），maxSize 与 coreSize 一致，避免线程过多导致频繁上下文切换。

### IO 密集型（DB、RPC、文件 IO）

coreSize = 2N 或 N × (1 + 等待时间/计算时间)，maxSize 设为 coreSize 的 1.5~3 倍应对突发流量，让 CPU 在等待 IO 时能切换到其他线程工作。

### 队列大小

根据单任务耗时和目标吞吐量估算，队列容量 ≈ 期望缓冲时间 / 单任务耗时；或用动态公式 队列大小 = coreSize × (1 + 等待时间/计算时间)，确保任务不堆积过久。建议用有界 ArrayBlockingQueue 防 OOM。

### 拒绝策略

CallerRunsPolicy 做限流降级（推荐），关键业务用 AbortPolicy 抛异常感知失败。

### keepAliveTime

IO 密集型设短些（30s~60s）及时回收，CPU 密集型可设长些。

生产环境必须压测验证，公式只是起点。

## 关联

- 线程池常见参数
- 线程池拒绝策略
