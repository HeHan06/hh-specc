## 问题

synchronized 和 ReentrantLock 的定义和区别。

## 考察点

- 两种锁的实现层面、释放方式、可中断、公平性、条件变量等差异
- 选择建议

## 标准答案

### 定义

- synchronized：Java 内置关键字，JVM 层面的锁，自动加锁释放，无需手动管理。
- ReentrantLock：JDK 提供的 API 级锁（java.util.concurrent.locks），需要手动 lock() 和 unlock()。

### 核心区别

1. 实现层面：synchronized 是 JVM 层面基于对象头 Monitor 实现；ReentrantLock 是 JDK API 层面基于 AQS 实现。
2. 锁释放：synchronized 代码块执行完或异常时 JVM 自动释放；ReentrantLock 必须在 finally 中手动 unlock()，否则死锁。
3. 可中断：synchronized 不可中断，线程阻塞后只能一直等；ReentrantLock 支持 lockInterruptibly() 响应中断。
4. 公平性：synchronized 是非公平锁；ReentrantLock 默认非公平，可通过构造参数指定为公平锁。
5. 条件变量：synchronized 只有一个 wait/notify 等待队列；ReentrantLock 通过 newCondition() 可创建多个条件队列，实现精确唤醒。
6. 超时获取：synchronized 无法超时；ReentrantLock 支持 tryLock(timeout)。
7. 性能：JDK 6 之前 ReentrantLock 明显更快，JDK 6 后 synchronized 经过偏向锁、轻量级锁等优化，两者性能接近。

### 选择建议

简单场景优先用 synchronized（代码简洁，自动释放）；需要可中断、公平锁、多条件、超时等高级功能时用 ReentrantLock。

### ReentrantLock + Condition 实例（阻塞队列的简单实现）

```java
class SimpleBlockingQueue {
    final ReentrantLock lock = new ReentrantLock();
    final Condition notEmpty = lock.newCondition();
    final Condition notFull = lock.newCondition();
    final Object[] items = new Object[10];
    int putIndex, takeIndex, count;

    public void put(Object item) throws InterruptedException {
        lock.lock();
        try {
            while (count == items.length)
                notFull.await();        // 队列满，阻塞生产者
            items[putIndex] = item;
            if (++putIndex == items.length) putIndex = 0;
            count++;
            notEmpty.signal();          // 唤醒消费者
        } finally {
            lock.unlock();
        }
    }

    public Object take() throws InterruptedException {
        lock.lock();
        try {
            while (count == 0)
                notEmpty.await();       // 队列空，阻塞消费者
            Object item = items[takeIndex];
            if (++takeIndex == items.length) takeIndex = 0;
            count--;
            notFull.signal();           // 唤醒生产者
            return item;
        } finally {
            lock.unlock();
        }
    }
}
```

关键点：synchronized 只有一个等待队列，生产者和消费者都塞在同一个 wait set 里，notifyAll 会唤醒所有人；而 ReentrantLock 用两个 Condition（notEmpty/notFull）实现了精确唤醒，性能更好。

## 关联

- synchronized 的实现原理
- 死锁
