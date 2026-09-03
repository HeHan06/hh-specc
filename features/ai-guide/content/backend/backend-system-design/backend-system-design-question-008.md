## 问题

网关入口限流（防刷 / 秒杀前置）。

## 考察点

- 固定窗口、漏桶、令牌桶、滑动窗口四种算法的行为差异
- 单机限流 vs Redis+Lua 分布式限流的边界与原子性

## 标准答案

### 核心思路

考点是流量洪峰下怎么在网关层把请求挡在服务前面，既保护下游、又不误伤正常用户。核心是分清四种限流算法的行为差异，以及单机限流与分布式限流的边界。

### 单机限流：固定窗口 + 令牌桶 + 漏桶 + 滑动窗口

```java
// 1. 固定窗口计数：最简单，但窗口边界会突刺
public class FixedWindowRateLimiter {
    private final int limit;
    private final long windowMs;
    private long windowStart = System.currentTimeMillis();
    private final AtomicLong count = new AtomicLong(0);

    public FixedWindowRateLimiter(int limit, long windowMs) {
        this.limit = limit;
        this.windowMs = windowMs;
    }

    public boolean tryAcquire() {
        long now = System.currentTimeMillis();
        synchronized (this) {
            if (now - windowStart >= windowMs) {
                windowStart = now;
                count.set(0);
            }
        }
        return count.incrementAndGet() <= limit;
    }
}
```

```java
// 2. 漏桶：强制匀速流出，能削峰，但无法应对突发流量
public class LeakyBucketRateLimiter {
    private final long capacity;
    private final long ratePerMs;
    private long water = 0;
    private long lastLeakTime = System.currentTimeMillis();

    public LeakyBucketRateLimiter(long capacity, long ratePerSecond) {
        this.capacity = capacity;
        this.ratePerMs = ratePerSecond / 1000;
    }

    public synchronized boolean tryAcquire() {
        long now = System.currentTimeMillis();
        water = Math.max(0, water - (now - lastLeakTime) * ratePerMs);
        lastLeakTime = now;
        if (water < capacity) {
            water++;
            return true;
        }
        return false;
    }
}
```

```java
// 3. 令牌桶：匀速生成令牌，可突发（最常用）
public class TokenBucketRateLimiter {
    private final long capacity;
    private final long ratePerMs;
    private double tokens;
    private long lastRefillTime = System.currentTimeMillis();

    public TokenBucketRateLimiter(long capacity, long ratePerSecond) {
        this.capacity = capacity;
        this.ratePerMs = ratePerSecond / 1000.0;
        this.tokens = capacity;
    }

    public synchronized boolean tryAcquire() {
        long now = System.currentTimeMillis();
        tokens = Math.min(capacity, tokens + (now - lastRefillTime) * ratePerMs);
        lastRefillTime = now;
        if (tokens >= 1) {
            tokens -= 1;
            return true;
        }
        return false;
    }
}
```

```java
// 4. 滑动窗口：把固定窗口再切细，解决边界突刺问题，精确但占用稍高
public class SlidingWindowRateLimiter {
    private final int limit;
    private final long windowMs;
    private final int bucketCount;
    private final long bucketMs;
    private final long[] buckets;
    private long lastBucketTime;

    public SlidingWindowRateLimiter(int limit, long windowMs, int bucketCount) {
        this.limit = limit;
        this.windowMs = windowMs;
        this.bucketCount = bucketCount;
        this.bucketMs = windowMs / bucketCount;
        this.buckets = new long[bucketCount];
        this.lastBucketTime = System.currentTimeMillis();
    }

    public synchronized boolean tryAcquire() {
        long now = System.currentTimeMillis();
        long elapsedBuckets = (now - lastBucketTime) / bucketMs;
        for (int i = 0; i < Math.min(elapsedBuckets, bucketCount); i++) {
            buckets[(int) ((now / bucketMs) % bucketCount)] = 0;
        }
        lastBucketTime = now;
        long sum = 0;
        for (long b : buckets) sum += b;
        if (sum >= limit) return false;
        buckets[(int) ((now / bucketMs) % bucketCount)]++;
        return true;
    }
}
```

### 分布式限流：Redis + Lua 保证原子性

```java
@Service
public class RedisRateLimiter {

    @Autowired
    private StringRedisTemplate redis;

    private static final String LUA =
        "local key = KEYS[1] " +
        "local limit = tonumber(ARGV[1]) " +
        "local window = tonumber(ARGV[2]) " +
        "local current = redis.call('INCR', key) " +
        "if current == 1 then " +
        "    redis.call('PEXPIRE', key, window) " +
        "end " +
        "if current > limit then " +
        "    return 0 " +
        "end " +
        "return 1";

    public boolean tryAcquire(String resourceKey, int limit, long windowMs) {
        Long result = redis.execute(
            (RedisCallback<Long>) conn -> conn.eval(
                LUA.getBytes(), ReturnType.INTEGER, 1,
                ("ratelimit:" + resourceKey).getBytes(),
                String.valueOf(limit).getBytes(),
                String.valueOf(windowMs).getBytes()
            )
        );
        return result != null && result == 1L;
    }
}
```

```java
// 网关入口用法：一个拦截器对接口 / 用户 / IP 做多维限流
@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    @Autowired
    private RedisRateLimiter rateLimiter;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String userId = request.getHeader("userId");
        String ip = getClientIp(request);
        String uri = request.getRequestURI();

        if (!rateLimiter.tryAcquire("api:" + uri, 10000, 1000)
         || !rateLimiter.tryAcquire("user:" + userId, 100, 1000)
         || !rateLimiter.tryAcquire("ip:" + ip, 200, 1000)) {
            response.setStatus(429);   // Too Many Requests
            return false;
        }
        return true;
    }
}
```

### 高频面试问题与口述答案

**Q1：令牌桶、漏桶、固定窗口、滑动窗口的区别？各自适合什么场景？**

固定窗口计数器最简单，缺点是有临界突刺——两个窗口交界处能各放满一次。滑动窗口就是把固定窗口切细，用多个小格滚动统计，解决突刺问题。漏桶是强制匀速流出，适合需要严格匀速、保护下游的场景，但不能应对突发。令牌桶是按固定速率放令牌，请求来了拿令牌，桶里攒多少令牌就能放多少，所以允许一定程度的突发，这是它和漏桶最本质的区别。网关入口一般用令牌桶或滑动窗口。

**Q2：为什么说固定窗口有“临界突刺”问题？滑动窗口怎么解决？**

假设限制是 1 秒 100 个，窗口是 [0s, 1s)。攻击者可以在 0.9s~1s 之间发 100 个，又在 1s~1.1s 之间发 100 个，站在这 0.2 秒里看实际进来了 200 个。滑动窗口把 1 秒切成更细的格子，统计“最近一个完整窗口”的请求总和，跨边界的连续流量会被正确累加，突刺就消失了。

**Q3：单机限流和分布式限流的区别？什么时候必须用分布式限流？**

单机限流是每台机器各自维护计数器，不共享状态，零网络开销，但多节点部署时总流量是单机限额 × 节点数。如果限流的对象是“整个集群对外”的总量，就必须用分布式限流。工程上常见做法是两层结合：本地先做粗限流，Redis 再做精确限流。

**Q4：Redis+Lua 为什么能保证限流的原子性？不用 Lua 会出什么问题？**

限流的本质是“判断当前计数是否超限，再决定是否放行”，这是一个读-判断-写的复合操作。不用 Lua，客户端要先 GET 计数、判断后再 INCR，两步之间有窗口期，并发下会超限。Lua 脚本在 Redis 服务端单线程原子执行，把“INCR + 判断 + 设过期”打包成不可分割的操作。

**Q5：漏桶和令牌桶最本质的区别是什么？（突发 vs 匀速）**

最本质的区别在“是否允许突发”。漏桶控制的是流出速率，桶里存的是请求本身，流量被强制平滑成匀速。令牌桶控制的是流入速率，桶里存的是令牌，请求来了只要桶里有令牌就能立刻拿走并放行，所以如果攒了一堆令牌，突发流量可以瞬间被放行。一句话：漏桶“削峰且匀速”，令牌桶“限制平均速率但容忍短时突发”。

**Q6：限流的粒度一般怎么设计？（接口 / 用户 / IP / 全局）**

一般是多维叠加，从粗到细：最粗是全局限流；往下是接口级；再往下是用户级，防止单用户刷接口；还有 IP 级，防爬虫和分布式攻击。这四层同时生效，任一超限就拒。通常“接口 + 用户”两层就能覆盖大多数场景，IP 层做粗一点的兜底。

**Q7：限流和熔断、降级是什么关系？分别在什么层面起作用？**

限流是“事前”防御，在请求还没进来时就把超过阈值的挡在门外；熔断是“事中”止损，当下游已经出现大量失败或超时，主动切断调用；降级是“事后”保底，在资源不足或依赖故障时主动放弃非核心功能。实际网关里它们通常串联：先限流，下游还是出问题就熔断，熔断期间走降级。

**Q8：令牌桶的“容量”和“速率”两个参数分别控制什么？**

速率（rate）控制长期平均流量——每秒生成多少个令牌，决定系统能持续承受的稳态 QPS。容量（capacity）控制允许的最大突发量——桶里最多攒多少令牌，决定瞬时能放行多少请求。容量设太大突发就没限制住；设太小正常的小波动都会被误杀。

**Q9：被限流的请求怎么处理？直接拒绝还是排队？（快速失败 vs 排队等待）**

两种策略。快速失败：直接返回 429，让客户端立刻知道。排队等待：把请求放入队列按令牌速率慢慢放行，适合“请求不能丢、但可以慢”的场景。网关这种在线请求场景通常用快速失败 + 客户端退避重试；下单这种关键写操作，宁可排队或引导用户稍后再试。核心原则是：让限流行为对系统是“可控的拒绝”，对用户是“明确的反馈”。

## 关联

- 秒杀系统
- 商品详情页缓存设计
