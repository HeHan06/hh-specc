## 问题

电商双 11 商品详情页缓存设计。

## 考察点

- 缓存穿透、击穿、雪崩、双写一致性的成因与解法
- Cache-Aside 模式下布隆过滤器、互斥锁、随机 TTL、延迟双删的落地

## 标准答案

### 核心思路

核心是 Cache-Aside（旁路缓存）模式：读请求先查缓存，命中直接返回；未命中查 DB 再回填缓存。穿透/击穿/雪崩/一致性都是在这个主流程上“打补丁”。

### SpringBoot 最小编码实例

```java
@Service
public class ProductService {

    @Autowired
    private StringRedisTemplate redis;
    @Autowired
    private ProductMapper productMapper;

    // 布隆过滤器：启动时把已存在的商品 ID 都灌进去，快速拦截"不存在的 ID"
    private final BloomFilter<String> bloomFilter =
        BloomFilter.create(Funnels.stringFunnel(Charset.defaultCharset()), 100_0000, 0.01);

    public Product getProduct(Long id) {
        String cacheKey = "product:" + id;

        // 1. 穿透防线一：布隆过滤器，先判断 ID 是否可能存在
        if (!bloomFilter.mightContain(String.valueOf(id))) {
            return null;   // 一定不存在，直接返回，不打 DB
        }

        // 2. 先查缓存
        String json = redis.opsForValue().get(cacheKey);
        if (json != null) {
            if ("NULL".equals(json)) {
                return null;   // 穿透防线二：空值缓存，拦截重复打 DB
            }
            return JSON.parseObject(json, Product.class);
        }

        // 3. 击穿防线：热点 key 过期瞬间，用互斥锁只放一个线程去回源
        String lockKey = "lock:product:" + id;
        try {
            boolean gotLock = redis.opsForValue()
                .setIfAbsent(lockKey, "1", Duration.ofSeconds(3));
            if (gotLock) {
                return loadFromDbAndCache(id, cacheKey);   // 拿到锁：查 DB + 回填
            } else {
                Thread.sleep(50);                          // 没拿到锁：自旋重试查缓存
                return getProduct(id);
            }
        } finally {
            redis.delete(lockKey);   // 简化版，生产里注意"删了别人的锁"问题
        }
    }

    private Product loadFromDbAndCache(Long id, String cacheKey) {
        Product p = productMapper.selectById(id);
        if (p == null) {
            // 穿透：DB 也没有 -> 缓存一个空值，并给更短的过期时间
            redis.opsForValue().set(cacheKey, "NULL", Duration.ofMinutes(1));
            return null;
        }
        // 雪崩防线：过期时间加随机值，避免大量 key 同一时刻集中过期
        long ttl = 30 + ThreadLocalRandom.current().nextInt(10);   // 30~40 分钟随机
        redis.opsForValue().set(cacheKey, JSON.toJSONString(p), Duration.ofMinutes(ttl));
        return p;
    }
}
```

```java
// 一致性：更新商品后，用"延迟双删"清理缓存
@Service
public class ProductUpdateService {

    @Autowired
    private StringRedisTemplate redis;
    @Autowired
    private ProductMapper productMapper;

    public void updateProduct(Product p) {
        String cacheKey = "product:" + p.getId();

        // 第一次删缓存：防止"更新期间读请求把旧值回填进缓存"
        redis.delete(cacheKey);

        // 更新数据库
        productMapper.updateById(p);

        // 第二次延迟删：兜底——更新期间若有并发读把旧值写回缓存，这里再删一次
        CompletableFuture.runAsync(() -> {
            try { Thread.sleep(500); } catch (InterruptedException ignored) {}
            redis.delete(cacheKey);
        });
    }
}
```

要点提炼：布隆过滤器拦“肯定不存在”，空值缓存拦“误判和绕过布隆的”，互斥锁拦“热点 key 重建风暴”，随机 TTL 防“雪崩”，延迟双删求“最终一致”。

### 高频面试问题与口述答案

**Q1：缓存穿透、击穿、雪崩分别是什么？成因和各自的解法？**

穿透是查一个“根本不存在的 key”，缓存里没有、DB 里也没有，每次请求都直接打到 DB。解法是两层：布隆过滤器在缓存前拦一道，再加空值缓存。击穿是某个“存在的热点 key”过期了，瞬间大量并发同时回源打 DB。解法是互斥锁，只放一个线程去重建缓存。雪崩是大量 key 在同一时刻过期，或者 Redis 本身挂了。解法是过期时间加随机值，同时做 Redis 高可用和本地缓存兜底。

**Q2：布隆过滤器的原理？误判率怎么理解？能删除元素吗？**

布隆过滤器本质是一个 bit 数组加多个哈希函数。写入时，把一个元素用 k 个哈希函数算出 k 个位置，都置为 1；查询时，同样算出 k 个位置，只要有一个是 0 就说明“一定不存在”，全为 1 就说明“可能存在”。它有两个特性：不会漏报（说没有就一定没有），但会误报（说有不一定真有）。而且它不支持删除，因为一个 bit 可能被多个元素共用。商品会删除的话，一般用 Cuckoo Filter 或者定期重建。

**Q3：击穿用「互斥锁」和「逻辑过期」两种方案有什么区别？**

互斥锁是“挡住并发”，只让一个线程回源，其他线程等，缺点是有延迟。逻辑过期是“不设物理过期时间，而是往 value 里存一个逻辑过期时间戳”，读请求发现逻辑过期了，先返回旧值（不阻塞），同时异步起一个线程去重建缓存。逻辑过期不阻塞读、用户体验好，但返回的可能是旧数据，一致性更弱。一致性要求高用互斥锁，用户体验要求高用逻辑过期。

**Q4：缓存和数据库双写一致性：先删缓存还是先更新 DB？为什么会有延迟双删？**

先删缓存再更新 DB：删完缓存后、DB 还没更新完的窗口里，读请求查 DB 拿到旧值又写回缓存，缓存就脏了。先更新 DB 再删缓存更推荐，因为删缓存的操作很快，脏窗口更小；但它也有一个极小概率的窗口——A 读到旧值准备写回，B 更新 DB 并删缓存，然后 A 把旧值写回。延迟双删就是为兜底这种情况：先删一次，更新 DB，再延迟几百毫秒删第二次。核心思想是：用最终一致性换高性能，缓存和 DB 永远不可能强一致。

**Q5：延迟双删的延迟时间怎么定？真的能保证一致吗？**

延迟时间一般取“读请求从 DB 读旧值到写回缓存”的耗时，通常几百毫秒到一秒。但要诚实说：延迟双删做不到强一致，它只是把脏窗口压到很小。真要强一致，得用订阅 binlog（Canal）异步删缓存、或者读写都走缓存的一致性方案。

**Q6：热点 key 怎么提前发现和预热？**

两个动作：发现和预热。发现热点：基于监控（Redis 的 --hotkeys 或客户端埋点统计）或业务侧预判（大促前就知道哪些是爆款）。预热：在活动开始前，主动把这些热点商品详情加载进缓存，并设置“永不过期”或“逻辑过期”。单个 key 特别热的话，可以做本地缓存（Caffeine）做二级缓存。

**Q7：为什么缓存过期时间要随机化？随机范围怎么选？**

就是为了防雪崩。假设 100 万个 key 都在同一时刻过期，下一瞬间这 100 万个请求会同时打到 DB。给每个 key 的过期时间加一个随机增量，就能把失效点均匀摊到一个时间区间里。随机范围一般取基础 TTL 的 10%~30%。

**Q8：如果 Redis 挂了，怎么保证系统可用？**

分几层兜底。第一层是降级：Redis 挂了就不走缓存，但要配限流，或者直接熔断返回兜底数据。第二层是本地缓存：在应用内存里加一层 Caffeine。第三层是高可用：Redis 本身用主从 + 哨兵或 Cluster。核心思想是“多级缓存 + 降级熔断”。

**Q9：布隆过滤器数据量变大、删商品了怎么办？**

布隆过滤器有容量上限，数据量超出设计容量后误判率会上升，所以需要扩容重建。删除的话，标准布隆过滤器删不了，两个解法：一是容忍误判，反正后面还有“空值缓存 + DB 校验”兜底；二是用支持删除的变体，比如 Cuckoo Filter 或带计数的布隆过滤器。

## 关联

- 排行榜（ZSet）
- 网关入口限流
