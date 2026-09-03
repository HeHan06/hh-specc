## 问题

ThreadLocal 原理和使用场景，内存泄漏的原因和解决方法。

## 考察点

- ThreadLocal 的隔离原理
- 内存泄漏成因与解决方式

## 标准答案

### 原理

每个 Thread 内部持有 ThreadLocalMap，key 是 ThreadLocal 的弱引用，value 是线程私有的变量副本。get/set 时以当前 ThreadLocal 为 key 操作当前线程的 Map，实现线程隔离无需加锁。

### 场景

数据库连接管理（Spring 事务）、Web 请求上下文（RequestContextHolder）、链路追踪 TraceId（MDC）、非线程安全工具类（SimpleDateFormat）。

### 泄漏原因

Entry 中 key 为弱引用、value 为强引用。ThreadLocal 外部引用消失后 key 被 GC 回收变 null，但 value 仍被 Entry 强引用。只要线程存活（尤其是线程池），value 永不回收。

### 解决方法

1. 用完必调 remove()，放 finally 块。
2. 声明 static final 减少 null-key 脏 Entry。
3. 用 FastThreadLocal / TransmittableThreadLocal 等框架方案。

### 三个关键要点

- ThreadLocal 声明为 static final：确保整个应用只有一个 ThreadLocal 实例，避免因重复创建导致旧实例失去强引用后 key 被回收，加剧内存泄漏。
- try-finally 保证 remove() 一定被执行：即使业务逻辑抛出异常，finally 块也能确保 ThreadLocal 被清理。
- 在使用完毕后立即清理，而不是在下次使用前设置：使用前 set() 虽然可以覆盖旧值解决脏数据问题，但无法解决上一次任务遗留 value 的内存占用问题。只有在用完后 remove()，才能同时避免内存泄漏和数据污染。

## 关联

- OutOfMemoryError
- 线程池
