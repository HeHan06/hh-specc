## 问题

线程池常见参数有哪些？如何解释？

## 考察点

- 线程池七大核心参数 + allowCoreThreadTimeOut 的含义
- 各参数作用

## 标准答案

- corePoolSize：核心线程数，线程池保持的线程数，即使没有任务。
- maximumPoolSize：最大线程数，线程池允许的最大线程数。
- keepAliveTime：空闲时间，线程池维护线程的最长时间，超过时间的线程会被销毁。
- unit：keepAliveTime 参数的时间单位。
- workQueue：任务队列，用于存储等待执行的任务。
- threadFactory：线程工厂，用于创建线程。
- handler：拒绝策略，用于处理拒绝任务。
- allowCoreThreadTimeOut：是否允许核心线程超时。

## 关联

- 线程池拒绝策略
- 线程池处理流程
