## 问题

线程池为什么要使用阻塞队列？

## 考察点

- 阻塞队列避免忙等、线程安全、背压机制的作用
- 不同队列与线程池的匹配

## 标准答案

1. **避免忙等**：阻塞队列的 take() 在队列空时让线程挂起（WAITING），不消耗 CPU，有任务再被唤醒；非阻塞队列只能轮询空转。
2. **天然线程安全**：BlockingQueue 内部已处理好锁和条件变量，多线程 put/take 无需额外同步。
3. **背压机制**：队列满时 put() 阻塞提交线程，限流减速防 OOM，配合拒绝策略形成完整保护链。

不同队列对应不同场景：SynchronousQueue（CachedThreadPool，容量 0 直接交付）、LinkedBlockingQueue（FixedThreadPool，无界但要防堆积）、ArrayBlockingQueue（推荐生产，有界配合拒绝策略防 OOM）。

## 关联

- 线程池常见参数
- 线程池拒绝策略
