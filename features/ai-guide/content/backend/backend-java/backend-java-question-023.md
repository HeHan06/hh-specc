## 问题

乐观锁和悲观锁的定义和区别，以及 Java 实现和项目应用场景。

## 考察点

- 乐观锁与悲观锁的思想差异
- Java 实现方式与典型应用场景

## 标准答案

### 定义与区别

- 悲观锁：认为并发冲突一定会发生，每次读写数据都先加锁，其他线程阻塞等待。适用于写多读少、冲突频繁的场景。
- 乐观锁：认为并发冲突很少发生，读写不加锁，只在提交更新时检查数据是否被修改过。适用于读多写少、冲突少的场景。

### Java 实现

- 悲观锁：synchronized、ReentrantLock
- 乐观锁：AtomicInteger 等 CAS 原子类（底层 Unsafe.compareAndSwap，通过 CPU 的 CMPXCHG 指令原子地比较并交换）

### 项目应用场景

- 悲观锁：银行转账（需保证强一致性）、库存扣减（高并发抢购场景）
- 乐观锁：数据库版本号字段（`update table set stock=stock-1, version=version+1 where id=1 and version=5`）、配置项更新、用户信息修改等低冲突场景

总结：悲观锁以性能换安全，乐观锁以重试换吞吐。

## 关联

- synchronized 与 ReentrantLock
- CAS 与原子类
