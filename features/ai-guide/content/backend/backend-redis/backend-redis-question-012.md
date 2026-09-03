## 问题

结合本地生活实际项目，举个最简单的应用 Redisson 分布式锁的 Java Spring Boot 项目代码示例。

## 考察点

- Redisson 分布式锁在秒杀/库存扣减场景的落地
- 锁粒度、看门狗、安全释放等工程细节

## 标准答案

场景设定：本地生活服务平台在整点发放一批优惠券，用户抢购。为了避免在高并发下超卖，需要用分布式锁来保护「库存扣减」这个核心操作。

### 1、添加依赖

```xml
<dependency>
    <groupId>org.redisson</groupId>
    <artifactId>redisson-spring-boot-starter</artifactId>
    <version>3.23.5</version> <!-- 建议使用最新稳定版本 -->
</dependency>
```

这个 Starter 会帮我们自动配置好 RedissonClient。

### 2、配置 RedissonClient (application.yml)

在 application.yml 配置文件中添加 Redis 连接信息。由于使用了 Starter，这些配置会被自动加载。

```yaml
spring:
  redis:
    host: localhost
    port: 6379
    password: 123456
    database: 0
```

### 3、编写 Service 核心业务逻辑

在 CouponService 中，实现秒杀的核心方法 purchaseCoupon。

```java
@Service
@Slf4j
public class CouponService {

    @Autowired
    private RedissonClient redissonClient;

    @Autowired
    private StringRedisTemplate redisTemplate;

    // 模拟数据库中的库存 key
    private static final String STOCK_KEY = "coupon:stock:";

    public String purchaseCoupon(Long couponId, Long userId) {
        // 1. 创建一个锁对象，锁的粒度是优惠券ID
        //    这样不同优惠券的抢购互不影响
        RLock lock = redissonClient.getLock("lock:coupon:" + couponId);

        log.info("用户 {} 尝试获取优惠券 {} 的锁", userId, couponId);

        // 2. 尝试加锁
        //    使用 tryLock 可以设置等待时间和锁自动释放时间，更灵活
        //    这里演示最常用的 lock() 方法，它会启用看门狗自动续期
        lock.lock();

        try {
            log.info("用户 {} 成功获取锁，开始处理订单", userId);

            // 3. 查询库存 (从Redis中获取)
            String stockStr = redisTemplate.opsForValue().get(STOCK_KEY + couponId);
            if (stockStr == null) {
                return "优惠券不存在";
            }

            int stock = Integer.parseInt(stockStr);

            // 4. 检查库存
            if (stock <= 0) {
                log.warn("优惠券 {} 库存不足", couponId);
                return "优惠券已抢光";
            }

            // 5. 模拟业务处理耗时 (如创建订单、扣减数据库库存等)
            //    这里仅演示扣减Redis中的库存
            redisTemplate.opsForValue().decrement(STOCK_KEY + couponId);
            log.info("用户 {} 抢购成功，剩余库存: {}", userId, stock - 1);

            // 在实际项目中，这里会包含：创建订单、扣减数据库库存、发送消息等
            // 这些操作都在锁的保护下，是线程安全的

            return "抢购成功";

        } catch (Exception e) {
            log.error("抢购过程中发生异常", e);
            return "系统繁忙，请稍后重试";
        } finally {
            // 6. 释放锁
            //    这一步至关重要，一定要在finally块中执行
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
                log.info("用户 {} 释放锁", userId);
            }
        }
    }
}
```

### 代码说明

- 锁的粒度：锁的 key 设置为 `lock:coupon:` + couponId。这意味着，不同优惠券的抢购可以并发进行，只有抢同一张券的请求才会互相等待，这极大地提高了系统的吞吐量。
- 看门狗机制：代码中使用了 lock.lock() 方法，会启用看门狗（Watchdog）机制。如果业务逻辑（如创建订单）执行时间超过了锁的默认 30 秒有效期，看门狗会自动续期，避免了因业务执行慢而锁被提前释放的问题。
- 安全释放锁：在 finally 代码块中，通过 lock.isHeldByCurrentThread() 判断当前线程是否还持有锁，然后再释放。这是一个良好的编程习惯，可以有效防止因锁已自动过期或被其他线程释放而导致的异常。
- 业务原子性：所有涉及库存检查、扣减以及后续订单创建的逻辑，都放在 lock.lock() 和 lock.unlock() 之间。这保证了这一系列操作是原子的、互斥的，从而从根本上解决了超卖问题。

这个示例直接对应了本地生活项目中的典型高并发场景，可以应用到优惠券秒杀、活动报名、库存扣减等实际业务中。

## 关联

- Redisson 分布式锁原理
- Redis 锁过期时间怎么设置
