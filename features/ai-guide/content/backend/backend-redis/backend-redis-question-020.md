## 问题

【代码题】Redis 分布式锁（Redisson）：先写完整 Spring Boot 实现，再围绕实现出面试题。

## 考察点

- Redisson 分布式锁的完整代码实现（tryLock、看门狗、安全释放）
- 可重入、看门狗、lock 与 tryLock 区别、锁过期与主从切换等面试要点

## 标准答案

题目场景：本地生活秒杀 / 库存扣减，多实例部署下用分布式锁保护「校验 + 扣减」这一临界区，防止超卖。

### 一、完整 Spring Boot 代码实现（正确版）

#### 1、依赖（pom.xml）

```xml
<dependency>
    <groupId>org.redisson</groupId>
    <artifactId>redisson-spring-boot-starter</artifactId>
    <version>3.23.5</version>
</dependency>
```

#### 2、application.yml（Starter 会自动装配 RedissonClient）

```yaml
spring:
  redis:
    host: localhost
    port: 6379
```

#### 3、Service：核心业务

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

#### Service 用到的 API 对照说明（Java 方法 ↔ 原生 Redis 命令）

这里涉及两类对象：Redisson 的锁 API（分布式锁核心），以及 `StringRedisTemplate` 的字符串 API（库存读写）。

先看 Redisson 锁 API：

| Java 方法 | 作用 | 关键说明 |
|-----------|------|---------|
| `redissonClient.getLock(name)` | 拿一把名为 name 的锁句柄 | **注意：只是拿到 RLock 对象，还没真正去 Redis 加锁**，加锁发生在 `lock()` / `tryLock()` 那一刻 |
| `lock.tryLock(waitTime, unit)` | 尝试加锁 | 在 waitTime 内反复重试，拿到返回 true，超时返回 false；leaseTime 默认 -1，会启用看门狗续期 |
| `lock.lock()` | 阻塞加锁 | 拿不到就一直等，直到拿到为止（无超时概念） |
| `lock.isHeldByCurrentThread()` | 判断当前线程是否仍持有这把锁 | 释放前的前置校验，防止删了别人的锁 |
| `lock.unlock()` | 释放锁 | 底层是 Lua 脚本"校验身份 + 删除"，原子操作 |

再看 StringRedisTemplate 字符串 API（库存操作）：

| Java 方法 | 原生命令 | 参数含义 | 返回值 |
|-----------|---------|---------|--------|
| `opsForValue().get(key)` | `GET key` | 读字符串类型的值 | 字符串；key 不存在返回 null |
| `opsForValue().decrement(key, num)` | `DECRBY key num` | 把 key 的值原子地减 num | 扣减后的值（Long） |
| `opsForValue().setIfAbsent(key, value)` | `SETNX key value` | 仅当 key 不存在时设置 | 设置成功返回 true，已存在返回 false |
| `expire(key, timeout, unit)` | `EXPIRE key seconds` | 给 key 设置过期时间 | 设置成功返回 true |
| `delete(key)` | `DEL key` | 删除 key | 是否删除 |

关键点（读代码时最容易卡住的地方）：

- `opsForValue()` 是操作 String 类型的入口，和排行榜里的 `opsForZSet()` 是两套独立操作器：String 用 `opsForValue()`，zset 用 `opsForZSet()`，不能混用。
- `getLock` 不是加锁：`RLock lock = redissonClient.getLock("lock:stock:" + itemId)` 这行只是声明"我要用这把锁"，真正的互斥从 `tryLock` 成功返回才生效。
- `tryLock(3, TimeUnit.SECONDS)` 只传了等待时间，没传第三个 leaseTime 参数，所以 leaseTime = -1 → 启用看门狗自动续期。这是「锁永不因业务执行慢而提前过期」的关键。
- 锁粒度用 itemId 区分：`"lock:stock:" + itemId` 让不同商品的扣减互不阻塞，只有扣同一商品的请求才会排队，避免一把大锁拖垮所有请求。

### 二、围绕实现出的面试题

#### Q1：Redisson 的可重入是怎么实现的？

底层用 Redis 的 Hash 结构。key 是锁名，field 是「线程唯一标识」（线程 id + 连接 id），value 是重入次数。同一线程每次 `lock()` 就把 value +1，每次 `unlock()` 就 -1，减到 0 才真正删除锁。所以同一线程可重复加锁，不会自己锁死自己。

#### Q2：看门狗（Watchdog）自动续期是怎么回事？

调用 `lock()` 或 `tryLock(等待时间)` 时，如果 leaseTime 传 -1，默认锁 30 秒过期，同时启动一个后台看门狗线程，每 10 秒（即 1/3 过期时间）判断当前线程是否还持有锁，持有就自动续期回 30 秒，避免业务执行超时锁被提前释放。**如果手动指定了 leaseTime，看门狗不生效**，锁到期就自动释放。

#### Q3：`lock()` 和 `tryLock()` 有什么区别？

`lock()` 拿不到锁会一直阻塞等待，直到拿到；`tryLock()` 拿不到立即返回 false，`tryLock(waitTime, unit)` 则在 waitTime 内重试，超时返回 false。高并发短耗时场景用 `tryLock` 快速失败更好，避免请求长时间排队。

#### Q4：为什么 finally 里要先 `isHeldByCurrentThread()` 再 `unlock()`？

防止「锁已过期被别的线程抢走，我再去 unlock 把别人的锁删了」。`isHeldByCurrentThread` 校验当前线程确实还持有锁，才执行释放，是安全释放锁的关键。

#### Q5：锁过期时间怎么设置？（呼应 Redis 锁过期时间）

分场景。耗时不确定、性能不敏感的后台任务，用 `lock()` 依赖默认 30 秒 + 看门狗续期；高并发、短耗时的核心接口（扣库存），禁用看门狗，按业务 P99 耗时设一个短 TTL（如 500ms），强制业务在 SLA 内完成。

#### Q6（找 bug 题）：下面两种手写 Redis 锁各有什么问题？

```java
// 版本 1：SETNX 与 EXPIRE 分开，非原子
Boolean ok = redisTemplate.opsForValue().setIfAbsent("lock:key", "1");
if (Boolean.TRUE.equals(ok)) {
    // 如果这行之前进程崩溃/宕机，锁没有过期时间，永远不释放 → 死锁
    redisTemplate.expire("lock:key", 30, TimeUnit.SECONDS);
}

// 版本 2：解锁不校验身份
// 线程 A 拿到锁，业务执行 40s，锁 30s 过期；线程 B 重新拿到锁；
// A 执行完直接 del，把 B 的锁删了 → 误删
redisTemplate.delete("lock:key");
```

答：版本 1 的问题：加锁（SETNX）和设置过期（EXPIRE）不是原子操作，两步之间宕机会产生永久锁（死锁）。必须用原子命令 `SET key value NX PX 30000`。版本 2 的问题：解锁前不校验持有者身份，会释放别人的锁。必须用 Lua 脚本把「校验 value + 删除」做成原子操作：

```lua
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
```

#### Q7：Redis 主从切换时锁会不会丢？怎么办？

会。Redis 主从是异步复制，主节点刚写入锁、还没同步到从节点就宕机，从节点被提升为主后锁丢失，可能出现两个客户端同时持锁。对一致性要求极高的场景用 Zookeeper（CP，临时顺序节点 + Watcher）或 RedLock（多节点多数派）；能容忍极小概率不一致的大厂业务，直接用 Redisson 即可。

## 关联

- Redisson 分布式锁原理
- Redis 锁过期时间怎么设置
