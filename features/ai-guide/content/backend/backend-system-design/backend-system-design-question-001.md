## 问题

如何设计一个秒杀系统。

## 考察点

- 超高并发下的超卖、重复抢购、数据库击穿、最终一致性等难点
- Redis 预扣库存 + 防重去重 + 异步削峰 + 限流的组合方案

## 标准答案

### 核心思路

秒杀的本质是短时间、海量并发、限量抢购。它不是“一个接口”的问题，而是一串问题的叠加：超卖、重复抢购、数据库被打垮、热点数据、订单最终一致性。工程上的解法是一套组合拳：Redis 原子预扣库存 + 防重去重 + 异步削峰 + 限流 + 最终一致。

核心三件事：① 预加载库存到 Redis → ② 用 Lua 原子扣减防超卖 → ③ 防重去重 + 异步下单削峰。

### 编码实例

#### 1. 秒杀接口（Controller）

```java
@RestController
@RequestMapping("/seckill")
public class SeckillController {

    @Autowired
    private SeckillService seckillService;

    @PostMapping("/{goodsId}")
    public String seckill(@PathVariable Long goodsId,
                          @RequestHeader("userId") Long userId) {
        return seckillService.seckill(userId, goodsId);
    }
}
```

#### 2. 核心服务：Redis 原子扣库存 + 防重

```java
@Service
public class SeckillService {

    private static final String STOCK_KEY = "seckill:stock:";
    private static final String USER_KEY  = "seckill:user:";

    // Lua 脚本：先判断库存是否 > 0，再扣减。Redis 单线程执行脚本，保证原子性
    private static final String DEDUCT_LUA =
        "local stock = redis.call('get', KEYS[1]); " +
        "if stock and tonumber(stock) > 0 then " +
        "   redis.call('decr', KEYS[1]); " +
        "   return 1; " +
        "end " +
        "return 0;";

    private final StringRedisTemplate redisTemplate;
    private final OrderService orderService;

    public SeckillService(StringRedisTemplate redisTemplate, OrderService orderService) {
        this.redisTemplate = redisTemplate;
        this.orderService = orderService;
    }

    // 活动开始前预加载库存（实际应从 DB 读）
    @PostConstruct
    public void initStock() {
        redisTemplate.opsForValue().set(STOCK_KEY + 1001L, "100");
    }

    public String seckill(Long userId, Long goodsId) {
        // 1. 防重复：同一用户同一商品只能成功一次（SET NX EX 幂等去重）
        Boolean first = redisTemplate.opsForValue()
                .setIfAbsent(USER_KEY + userId + ":" + goodsId, "1", Duration.ofMinutes(5));
        if (Boolean.FALSE.equals(first)) {
            return "请勿重复抢购";
        }

        // 2. 原子扣减库存，杜绝超卖
        DefaultRedisScript<Long> script = new DefaultRedisScript<>(DEDUCT_LUA, Long.class);
        Long r = redisTemplate.execute(script, List.of(STOCK_KEY + goodsId));
        if (r == null || r == 0) {
            redisTemplate.delete(USER_KEY + userId + ":" + goodsId); // 回滚防重标记
            return "已售罄";
        }

        // 3. 异步下单，快速返回（削峰），生产环境改用 MQ 投递
        orderService.createOrderAsync(userId, goodsId);
        return "抢购成功，订单生成中";
    }
}
```

#### 3. 异步下单（落库）

```java
@Service
public class OrderService {

    // 生产环境：投递到 RocketMQ/Kafka 由消费者落库；这里用 @Async 简化演示
    @Async
    public void createOrderAsync(Long userId, Long goodsId) {
        // 扣 DB 真实库存 + 生成订单，用乐观锁保证不超卖：
        // UPDATE goods SET stock = stock - 1 WHERE id = ? AND stock > 0
        // 若影响行数为 0，说明 DB 库存已空，回滚 + 发补偿
    }
}
```

需要 `@EnableAsync` 开启异步。这套骨架已经覆盖了“防超卖 + 防重复 + 削峰”三大命门，其余（限流、降级、最终一致）是围绕它做的加固。

### 高频面试问题与口述答案

**Q1：秒杀系统最大的技术难点是什么？**

最大的难点是超高并发下的数据一致性和系统可用性。秒杀是瞬时几万甚至几十万请求打同一个商品，如果直接读写数据库，连接池会被打满、锁竞争剧烈、单点库存行成为热点，服务直接雪崩。所以核心矛盾是：如何在极短时间、极高并发下，保证不超卖、不重复卖，同时让绝大多数用户快速得到结果，把真正落库的压力削平。

**Q2：如何防止超卖？**

分两层。第一层是 Redis 预扣库存：活动前把库存预热到 Redis，用 Lua 脚本原子地“判断并扣减”，因为 Redis 单线程执行脚本，天然串行。第二层是数据库兜底：真正落库时用乐观锁 `UPDATE goods SET stock = stock - 1 WHERE id = ? AND stock > 0`，通过影响行数判断是否成功。这样“Redis 扛并发、DB 保正确”。

**Q3：如何防止同一用户重复抢购？**

用 Redis 的 `SET NX EX` 做幂等去重。用户进来先 `setIfAbsent(userId + goodsId)`，抢到就成功，抢不到说明已经抢过或正在处理。这个 key 设一个短过期时间（比如 5 分钟）。最终的强一致兜底是在订单表上建 `(user_id, goods_id)` 唯一索引。

**Q4：海量请求同时到达，如何避免数据库被击垮？**

三板斧：缓存前置、异步化、限流。第一，库存判断全部在 Redis 完成，只有极少数真正抢到的人才会走到下单流程。第二，下单异步化，抢到后投递 MQ 快速返回，由消费者慢慢落库。第三，入口限流，用令牌桶或漏桶拒绝超出容量的请求。

**Q5：怎么做限流和削峰？**

限流分层做：最外层 Nginx 按 IP/QPS 限流；应用层用 Sentinel 或 RateLimiter 做令牌桶限流。削峰主要靠 MQ：抢购成功的请求不直接落库，而是写入 RocketMQ/Kafka，消费者按自己的处理能力匀速消费。另外还有前端削峰，比如按钮置灰、防抖、答题/验证码。

**Q6：Redis 挂了怎么办？会不会超卖或丢数据？**

分两种情况。如果 Redis 只是短暂抖动，可以用主从 + 哨兵或 Cluster 保证高可用。但 Redis 毕竟是内存缓存，存在丢数据的理论风险，所以原则是 DB 是最终一致性的兜底：即使 Redis 少扣了，DB 乐观锁 `stock > 0` 依然保证不超卖。最坏情况是 Redis 完全不可用，这时可以降级——要么熔断返回“系统繁忙”，要么降级为纯 DB 乐观锁扣减，宁可少卖、不可超卖。

**Q7：Redis 扣减成功、但下单失败，如何保证最终一致性？**

这是典型的缓存与 DB 不一致问题。做法是：Redis 扣减成功后投递 MQ，消费端落库；如果落库失败，进入重试机制，重试多次仍失败就写入死信队列，由人工或补偿任务介入。同时做对账：定时比对 Redis 已扣量与 DB 已下单量，发现缺口就触发补偿。核心是让已经扣掉的库存不凭空消失，用 MQ 的至少一次投递 + 幂等消费来保证。

**Q8：用户抢到却不支付，库存怎么回收？**

订单生成后会进入“待支付”状态，设一个支付超时时间（如 15 分钟）。用延迟队列（RocketMQ 的延迟消息，或 Redis 的 ZSet / 延迟任务）在超时后触发关闭订单，同时回补库存（Redis 和 DB 都加回去）。回补也要做幂等，防止重复回补把库存加爆。

## 关联

- 网关入口限流
- 接口幂等
- 抢红包
