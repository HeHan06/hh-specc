## 问题

抽奖 / 中奖概率（营销活动）。

## 考察点

- 权重区间法命中奖品、Redis Lua 原子扣库存、防刷（限次 + 兜底奖品）

## 标准答案

### 核心思路

考点是怎么让抽奖概率可配置、中奖后库存不超发、并发下防刷。核心三件事：概率命中（权重区间法）、库存原子扣减（Redis）、防刷（限次 + 兜底奖品）。

### 核心：权重区间法命中奖品 + Redis 原子扣库存 + 防刷

```java
public class Prize {
    private long id;
    private String name;
    private int weight;     // 权重，中奖概率 = weight / 总权重
    private int stock;      // 库存
}
```

```java
@Service
public class LotteryService {

    @Autowired
    private StringRedisTemplate redis;

    private static final String STOCK_KEY = "lottery:stock:";

    // 第一步：按权重命中奖品（纯内存计算，无并发问题）
    public Prize hitPrize(List<Prize> prizes) {
        int totalWeight = prizes.stream().mapToInt(Prize::getWeight).sum();
        int rand = ThreadLocalRandom.current().nextInt(totalWeight);
        int cur = 0;
        for (Prize p : prizes) {
            cur += p.getWeight();
            if (rand < cur) {
                return p;
            }
        }
        return prizes.get(prizes.size() - 1);   // 兜底：最后一个是"谢谢参与"
    }

    // Lua 脚本：判断库存 > 0 才扣，否则不扣
    private static final String DEDUCT_LUA =
        "local stock = redis.call('GET', KEYS[1]) " +
        "if stock and tonumber(stock) > 0 then " +
        "    redis.call('DECR', KEYS[1]) " +
        "    return 1 " +
        "else " +
        "    return 0 " +
        "end";

    // 第二步：中奖后用 Lua 原子扣库存，扣失败直接降级为"谢谢参与"
    public Prize draw(long userId, List<Prize> prizes) {
        // 防刷：同用户一天最多抽 N 次，用 INCR 计数
        String limitKey = "lottery:limit:" + userId + ":" + LocalDate.now();
        Long count = redis.opsForValue().increment(limitKey);
        if (count == 1) redis.expire(limitKey, Duration.ofDays(1));
        if (count > 5) {
            return prizes.get(prizes.size() - 1);   // 超过次数，直接兜底奖品
        }

        // 命中奖品
        Prize hit = hitPrize(prizes);

        // 判断 + 扣减合并成一个 Lua 脚本原子执行
        Long result = redis.execute(
            new DefaultRedisScript<>(DEDUCT_LUA, Long.class),
            Collections.singletonList(STOCK_KEY + hit.getId())
        );

        if (result != null && result == 1) {
            asyncGrantPrize(userId, hit);
            return hit;
        } else {
            return prizes.get(prizes.size() - 1);
        }
    }
}
```

### 关键点说明

为什么用“权重区间法”而不是“if 概率判断”：权重区间法把所有奖品的权重排成区间，随机数落在哪段就是哪个，概率可配置（改 weight 就行）、天然保证概率之和 = 100%；if 判断把概率写死在代码里，改概率要发版，且容易算错。

为什么扣库存用 Lua 脚本，而不是“DECR 后判断再回滚”：DECR 本身是原子的，但“DECR → 判断 → INCR 回滚”整体不是原子的，库存会被短暂扣成负数，若进程在 INCR 前崩溃负数会永久残留。Lua 脚本把“GET 判断 + DECR”合并成一个不可分割的整体，库存为 0 时根本不会执行 DECR，库存永远不为负。

防刷为什么用 INCR + 次数上限：防止同一用户狂刷抽奖接口，INCR 原子计数，超过上限返回兜底奖品（不中奖），而不是拒绝请求（保持体验）。

### 高频面试问题与口述答案

**Q1：概率抽奖怎么实现？权重区间法是什么？和 if 判断比有什么优势？**

权重区间法：给每个奖品一个权重，把所有权重累加成一个大区间，在 [0, 总权重) 里随机一个数，落在谁的区间段就命中谁。比 if 判断好在两点：一是概率由权重决定，天然加起来 100%；二是改概率只改权重值，不用改代码逻辑。

**Q2：概率怎么做到可配置、动态调整？**

把奖品权重存到配置中心（Nacos、Apollo）或数据库，抽奖时实时读取。要注意动态调整的时机——最好在低峰或活动间隔改，避免有的请求用旧权重、有的用新权重。更严谨的做法是配置版本化，做到原子切换。

**Q3：中奖后怎么扣库存保证不超发？为什么用 Lua 而不是 DECR 后判断？**

用 Lua 脚本把“判断 + 扣减”合并成原子操作：先 GET 库存，判断 > 0 才 DECR。因为 Redis 单线程执行 Lua，脚本内部的“判断 → 扣减”不可分割，并发下库存一定从 N 精确减到 0，永远不会变负。凡是“有条件的扣减”，都要用 Lua 把条件判断和扣减绑成原子整体。

**Q4：为什么“DECR → 判断 → 回滚”这种方案有问题？**

核心缺陷是“判断 + 回滚”不是一个原子操作。第一，库存会短暂变负，负数窗口期里监控、补货、报表都会读到脏数据。第二，回滚失败会永久残留负数：假设请求 DECR 到 -1 后进程崩溃，INCR 回滚没执行，库存永久卡在 -1。正确做法是用 Lua 让库存根本不可能变负，用原子性替代回滚。

**Q5：怎么防刷？同一用户/设备限次怎么做？**

分几层。第一层频率限制：用 Redis 的 INCR 给每个用户每天计数，超过上限返回兜底奖品。第二层设备/账号去重：结合 userId + 设备指纹（deviceId）。第三层风控：对异常行为（同一 IP 大量请求、异常时间点）做识别拦截。核心原则是限次但不硬拒绝——超过次数的用户返回“谢谢参与”，让刷子无利可图。

**Q6：抽奖并发量很大（比如秒杀式抽奖），Redis 扛得住吗？**

扛得住，因为抽奖的核心动作被设计成了纯 Redis 原子操作：一次抽奖就是一次 INCR（限次）+ 一次 Lua 脚本（判断 + DECR 扣库存）。真正的“概率命中”计算是在应用内存里做的，不占用 Redis。只有“扣库存”“计数”这两个需要全局一致性的操作才走 Redis。瓶颈不在 Redis，而在入口限流。

**Q7：“谢谢参与”这类兜底奖品为什么要放在最后？**

因为权重区间法的最后一段是“兜底区间”。计算时从前往后累加权重，如果随机数超过了所有真实奖品的权重区间，最后落到就是最后那个奖品。把“谢谢参与”这种必中、无库存限制的奖品放在列表最后，天然承接所有“没中奖”的情况。同时库存不足降级的逻辑也返回这个兜底奖品，保证链路闭环。

**Q8：如果奖品有总库存，但某个时间点库存被抽完了，后续用户怎么处理？**

库存抽完（Lua 脚本返回 0）后，后续所有命中该奖品的用户都会被降级为“谢谢参与”。工程上通常做前端联动：库存为 0 的奖品，前端转盘直接隐藏或替换成“谢谢参与”，让用户看到的概率和实际一致。

**Q9：抽奖记录和发奖是同步还是异步？为什么？**

必须异步。抽奖是并发尖峰，如果每个中奖的人同步写数据库发奖，数据库瞬间被打爆。正确做法是：抽奖命中 + 扣库存成功后立即返回中奖结果，同时投递一条 MQ 消息，由消费端异步落库、发奖。Redis 负责高并发的实时扣减，数据库通过 MQ 异步跟上。

**Q10：概率配置抽奖中途改了会有什么影响？怎么平滑变更？**

概率中途修改主要影响统计一致性和用户体验。一是统计口径会乱；二是用户体验可能突变。一般原则是：概率配置在活动开始前定好，运行中尽量不改；要改也选低峰时段，并且做版本化、记录变更日志。

## 关联

- 抢红包
- 秒杀系统
