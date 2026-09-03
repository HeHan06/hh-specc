## 问题

如何使用 Redis 设计一个分布式锁（Redisson）。

## 考察点

- Redisson 可重入锁、看门狗续期、安全释放
- 手写 Redis 锁的原子性与误删问题
- 主从切换下的锁丢失与替代方案

## 标准答案

### 完整 Spring Boot 代码实现

#### 依赖与配置

```xml
<dependency>
    <groupId>org.redisson</groupId>
    <artifactId>redisson-spring-boot-starter</artifactId>
    <version>3.23.5</version>
</dependency>
```

```yaml
spring:
  redis:
    host: localhost
    port: 6379
```

#### Service：核心业务

```java
@Service
public class StockService {

    private final RedissonClient redissonClient;
    private final StringRedisTemplate redisTemplate;

    private static final String STOCK_KEY = "stock:item:";

    public StockService(RedissonClient redissonClient, StringRedisTemplate redisTemplate) {
        this.redissonClient = redissonClient;
        this.redisTemplate = redisTemplate;
    }

    public boolean deduct(String itemId, int num) {
        RLock lock = redissonClient.getLock("lock:stock:" + itemId);
        try {
            // tryLock(等待时间, 单位)：leaseTime=-1，启用看门狗自动续期
            if (!lock.tryLock(3, TimeUnit.SECONDS)) {
                return false; // 3 秒拿不到锁，快速失败，避免请求排队拖垮系统
            }
            try {
                Integer stock = getStock(itemId);
                if (stock == null || stock < num) {
                    return false;
                }
                // 扣库存
                redisTemplate.opsForValue().decrement(STOCK_KEY + itemId, num);
                return true;
            } finally {
                // 只释放自己还持有的锁，防止锁已过期被他人拿到后误删
                if (lock.isHeldByCurrentThread()) {
                    lock.unlock();
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    private Integer getStock(String itemId) {
        String s = redisTemplate.opsForValue().get(STOCK_KEY + itemId);
        return s == null ? null : Integer.valueOf(s);
    }
}
```

关键点：

- `getLock` 不是加锁：`RLock lock = redissonClient.getLock(...)` 只是拿到 RLock 对象，还没真正去 Redis 加锁，加锁发生在 `lock()` / `tryLock()` 那一刻。
- `tryLock(3, TimeUnit.SECONDS)` 只传了等待时间，没传第三个 leaseTime 参数，所以 leaseTime = -1 → 启用看门狗自动续期。
- 锁粒度用 itemId 区分：`"lock:stock:" + itemId` 让不同商品的扣减互不阻塞。

### 围绕实现出的面试题

**Q1：Redisson 的可重入是怎么实现的？**

底层用 Redis 的 Hash 结构。key 是锁名，field 是“线程唯一标识”（线程 id + 连接 id），value 是重入次数。同一线程每次 `lock()` 就把 value +1，每次 `unlock()` 就 -1，减到 0 才真正删除锁。

**Q2：看门狗（Watchdog）自动续期是怎么回事？**

调用 `lock()` 或 `tryLock(等待时间)` 时，如果 leaseTime 传 -1，默认锁 30 秒过期，同时启动一个后台看门狗线程，每 10 秒（即 1/3 过期时间）判断当前线程是否还持有锁，持有就自动续期回 30 秒。如果手动指定了 leaseTime，看门狗不生效，锁到期就自动释放。

**Q3：`lock()` 和 `tryLock()` 有什么区别？**

`lock()` 拿不到锁会一直阻塞等待；`tryLock()` 拿不到立即返回 false，`tryLock(waitTime, unit)` 则在 waitTime 内重试，超时返回 false。高并发短耗时场景用 `tryLock` 快速失败更好。

**Q4：为什么 finally 里要先 `isHeldByCurrentThread()` 再 `unlock()`？**

防止“锁已过期被别的线程抢走，我再去 unlock 把别人的锁删了”。`isHeldByCurrentThread` 校验当前线程确实还持有锁，才执行释放。

**Q5：锁过期时间怎么设置？**

分场景。耗时不确定、性能不敏感的后台任务，用 `lock()` 依赖默认 30 秒 + 看门狗续期；高并发、短耗时的核心接口（扣库存），禁用看门狗，按业务 P99 耗时设一个短 TTL（如 500ms），强制业务在 SLA 内完成。

**Q6（找 bug 题）：下面两种手写 Redis 锁各有什么问题？**

```java
// 版本 1：SETNX 与 EXPIRE 分开，非原子
Boolean ok = redisTemplate.opsForValue().setIfAbsent("lock:key", "1");
if (Boolean.TRUE.equals(ok)) {
    redisTemplate.expire("lock:key", 30, TimeUnit.SECONDS); // 崩溃则死锁
}

// 版本 2：解锁不校验身份
redisTemplate.delete("lock:key"); // 可能误删别人的锁
```

版本 1 的问题：加锁（SETNX）和设置过期（EXPIRE）不是原子操作，两步之间宕机会产生永久锁（死锁）。必须用原子命令 `SET key value NX PX 30000`。版本 2 的问题：解锁前不校验持有者身份，会释放别人的锁。必须用 Lua 脚本把“校验 value + 删除”做成原子操作：

```lua
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
```

**Q7：Redis 主从切换时锁会不会丢？怎么办？**

会。Redis 主从是异步复制，主节点刚写入锁、还没同步到从节点就宕机，从节点被提升为主后锁丢失，可能出现两个客户端同时持锁。对一致性要求极高的场景用 Zookeeper（CP，临时顺序节点 + Watcher）或 RedLock（多节点多数派）；能容忍极小概率不一致的大厂业务，直接用 Redisson 即可。

## 关联

- 秒杀系统
- 排行榜（ZSet）
