## 问题

【代码题】Redis 排行榜（ZSet）：先写完整 Spring Boot 实现，再围绕实现出面试题。

## 考察点

- ZSet 排行榜的完整代码实现（加分、查名次、Top N、裁剪）
- 围绕实现的核心 API、原子性、深分页、大 Key 治理等面试要点

## 标准答案

题目场景：游戏战力榜 / 本地生活销量榜这类实时排行榜。用户上报分数（或每产生一笔订单销量），需要实时维护排名，并支持「查 Top N」「查某个用户的名次」。

### 一、完整 Spring Boot 代码实现（正确版）

#### 1、依赖（pom.xml）

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
```

#### 2、application.yml

```yaml
spring:
  redis:
    host: localhost
    port: 6379
```

#### 3、DTO

```java
public class RankItem {
    private int rank;      // 名次，从 1 开始
    private String userId;
    private double score;

    public RankItem(int rank, String userId, double score) {
        this.rank = rank;
        this.userId = userId;
        this.score = score;
    }
    // getter/setter 省略
}
```

#### 4、Service：核心逻辑，全部基于 StringRedisTemplate 的 opsForZSet()（对应原生 zset 命令）

```java
@Service
public class LeaderboardService {

    private final StringRedisTemplate redisTemplate;
    private static final String KEY = "leaderboard:score";

    public LeaderboardService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    // 原子加分：对应 ZINCRBY，并发安全，不会丢更新
    public void incrScore(String userId, double delta) {
        redisTemplate.opsForZSet().incrementScore(KEY, userId, delta);
    }

    // 覆盖式设置分数：对应 ZADD（用于"最高分"这类只保留最大值的榜）
    public void setScore(String userId, double score) {
        redisTemplate.opsForZSet().add(KEY, userId, score);
    }

    // 查名次：对应 ZREVRANK，返回 0 起，这里转成 1 起
    public Long getRank(String userId) {
        Long rank = redisTemplate.opsForZSet().reverseRank(KEY, userId);
        return rank == null ? null : rank + 1;
    }

    // 查 Top N：对应 ZREVRANGE 0 n-1 WITHSCORES（一次带出分数，避免 N+1）
    public List<RankItem> getTopN(int n) {
        Set<ZSetOperations.TypedTuple<String>> tuples =
                redisTemplate.opsForZSet().reverseRangeWithScores(KEY, 0, n - 1);
        if (tuples == null || tuples.isEmpty()) {
            return Collections.emptyList();
        }
        List<RankItem> result = new ArrayList<>(tuples.size());
        int rank = 1;
        for (ZSetOperations.TypedTuple<String> t : tuples) {
            result.add(new RankItem(rank++, t.getValue(), t.getScore()));
        }
        return result;
    }

    // 查分数：对应 ZSCORE
    public Double getScore(String userId) {
        return redisTemplate.opsForZSet().score(KEY, userId);
    }

    // 定期裁剪只保留 Top N：对应 ZREMRANGEBYRANK，防大 key
    // 注意：removeRange 内部按 score【升序】排名，0 是分数最低（最后一名），-1 才是分数最高（第一名）
    public void trimToTopN(int n) {
        // 删除 [0, -(n+1)]：即从"分数最低"删到"倒数第 n+1 低分"，保留最高的 n 个
        redisTemplate.opsForZSet().removeRange(KEY, 0, -(n + 1));
    }
}
```

#### Service 用到的 API 对照说明（Java 方法 ↔ 原生 Redis 命令）

三个入口对象：

| 对象 | 来源 | 作用 |
|------|------|------|
| `StringRedisTemplate` | Spring 注入 | 操作 Redis 的模板类，`String` 版表示 key/value 都是字符串 |
| `opsForZSet()` | `redisTemplate.opsForZSet()` | 返回 `ZSetOperations`，专门操作有序集合（zset）的操作器 |
| `ZSetOperations.TypedTuple<String>` | 范围查询的返回元素 | 一个"成员 + 分数"的组合，用 `getValue()` 拿成员、`getScore()` 拿分数 |

zset 相关方法对照表：

| Java 方法 | 原生命令 | 参数含义 | 返回值 |
|-----------|---------|---------|--------|
| `incrementScore(key, member, delta)` | `ZINCRBY key delta member` | member=被加分的成员，delta=增量（可为负，表示减分） | 加分后的最新分数（Double） |
| `add(key, member, score)` | `ZADD key score member` | member=成员，score=要设置的分数（覆盖式） | 是否成功新增（Boolean） |
| `reverseRank(key, member)` | `ZREVRANK key member` | 按分数**从高到低**查成员名次 | 0 起下标；成员不存在返回 null |
| `reverseRangeWithScores(key, start, end)` | `ZREVRANGE key start end WITHSCORES` | start/end=名次下标区间，闭区间 | `Set<TypedTuple<String>>`，一次带回成员和分数 |
| `score(key, member)` | `ZSCORE key member` | 查指定成员分数 | 分数（Double）；不存在返回 null |
| `removeRange(key, start, end)` | `ZREMRANGEBYRANK key start end` | 按**升序**名次下标区间删除（0=分数最低，-1=分数最高），下标可为负数 | 删除的元素个数（Long） |

关键点（读代码时最容易卡住的地方）：

- 排名下标从 0 开始：`reverseRank` 返回 0 表示第 1 名，所以 `getRank()` 里要 `rank + 1` 转成人习惯的"从 1 起"。
- 正序 vs 倒序：`ZRANK` / `ZRANGE` 是分数从小到大（正序），带 `reverse` 前缀的 `ZREVRANK` / `ZREVRANGE` 是分数从大到小（倒序）。排行榜要"高分在前"，所以全部用 `reverse` 系列。
- `removeRange(KEY, 0, -(n + 1))` 的含义：`removeRange` 对应 `ZREMRANGEBYRANK`，内部按 score **升序**（分数从小到大）排名，和 `reverseRank` 的降序**相反**——这里 `0` 是分数最低（榜单最后一名），`-1` 是分数最高（第一名），`-(n+1)` 是"倒数第 n+1 低分"。所以 `[0, -(n+1)]` 删的是"从最低分到倒数第 n+1 低分"，正好把除最高的 n 个之外的所有低分删掉，保留前 n 名。例：n=3、共 10 个成员，删 `[0, -4]`（-4=下标 6），删掉第 10~4 名，保留第 3~1 名。
- `TypedTuple` 要解包：`reverseRangeWithScores` 返回的不是简单字符串集合，而是 `TypedTuple`，必须 `t.getValue()` 拿 userId、`t.getScore()` 拿分数，否则直接打印看到的是对象引用。

#### 5、Controller

```java
@RestController
@RequestMapping("/leaderboard")
public class LeaderboardController {

    private final LeaderboardService service;

    public LeaderboardController(LeaderboardService service) {
        this.service = service;
    }

    // 上报分数（增量）
    @PostMapping("/incr")
    public String incr(@RequestParam String userId, @RequestParam double delta) {
        service.incrScore(userId, delta);
        return "ok";
    }

    @GetMapping("/top")
    public List<RankItem> top(@RequestParam(defaultValue = "10") int n) {
        return service.getTopN(n);
    }

    @GetMapping("/rank")
    public Long rank(@RequestParam String userId) {
        return service.getRank(userId);
    }
}
```

### 二、围绕实现出的面试题

#### Q1：把 zset 的四组常用 API 背一遍

分四组（加 ⭐ 的是上面 Service 代码已经用过的，其余是补充）：

- 基础：
  - `ZADD key score member`：添加或覆盖成员分数 ⭐（对应 `add`）
  - `ZREM key member...`：删除指定成员
  - `ZSCORE key member`：查成员分数 ⭐（对应 `score`）
  - `ZCARD key`：返回成员总数（集合大小）
  - `ZCOUNT key min max`：返回分数在 `[min, max]` 区间内的成员个数
- 排名：
  - `ZRANK key member`：按分数**升序**（低→高）查名次，0 起
  - `ZREVRANK key member`：按分数**降序**（高→低）查名次，0 起 ⭐（对应 `reverseRank`）
- 范围：
  - `ZRANGE key start stop`：按名次升序取区间成员（不带分数）
  - `ZREVRANGE key start stop`：按名次降序取区间成员 ⭐（对应 `reverseRange`）
  - `ZRANGEBYSCORE key min max`：按**分数区间**升序取成员（可加 `LIMIT` 分页）
  - `ZREVRANGEBYSCORE key max min`：按**分数区间**降序取成员（注意参数先大后小）
- 聚合与删除：
  - `ZINCRBY key increment member`：原子增减分数 ⭐（对应 `incrementScore`）
  - `ZUNIONSTORE dest numkeys key...`：多个 zset 求并集，结果存到新 key（可用于合并分片榜）
  - `ZINTERSTORE dest numkeys key...`：多个 zset 求交集，结果存到新 key
  - `ZREMRANGEBYRANK key start stop`：按名次区间删除 ⭐（对应 `removeRange`）
  - `ZREMRANGEBYSCORE key min max`：按分数区间删除

速记：`ZADD` 是增改、`ZREM` 是删成员、`ZSCORE` 查分、`ZCARD` 数人头、`ZCOUNT` 按分数数人头；`ZRANK/ZREVRANK` 查名次；`ZRANGE/ZREVRANGE` 按名次取、`ZRANGEBYSCORE/ZREVRANGEBYSCORE` 按分数取；`ZUNIONSTORE/ZINTERSTORE` 是集合运算落新 key；`ZREMRANGEBYRANK/ZREMRANGEBYSCORE` 是批量删。

#### Q2：加分为什么要用 `incrementScore`（ZINCRBY），而不是"先读分数、本地相加、再写回"？

因为「读-改-写」三步不是原子的，高并发下会丢更新。两个请求同时读到旧分 100，各自加 10 后都写回 110，正确结果应是 120，排名因此不准。`ZINCRBY` 在 Redis 服务端把「读、算、写」合并成一步原子操作，天然并发安全。

#### Q3（找 bug 题）：下面这段"更新分数"的代码，在高并发下有什么问题？怎么改？

```java
public void updateScore(String userId, double delta) {
    Double old = redisTemplate.opsForZSet().score(KEY, userId);  // 1. 读
    double newScore = (old == null ? 0 : old) + delta;           // 2. 算
    redisTemplate.opsForZSet().add(KEY, userId, newScore);       // 3. 写
}
```

答：问题就是「读-改-写」非原子导致丢失更新（见 Q2）。改成 `redisTemplate.opsForZSet().incrementScore(KEY, userId, delta);` 一行搞定。注意：题干一旦出现"高并发"关键词，先往原子性/竞态方向查，而不是先找编译错误。

#### Q4：查 Top N 为什么要带 `WITHSCORES`（对应 `reverseRangeWithScores`）？

不带分数就只能拿到 member，之后为了显示分数还得逐个再查 `ZSCORE`，产生 N+1 次网络往返。`WITHSCORES` 一次把 member 和 score 都带回来，把 N+1 压成 1 次。

#### Q5：深分页怎么办？比如要查第 1000 名到第 1010 名。

`ZREVRANGE key 1000 1010` 这类带大 offset 的查询，复杂度随 offset 线性增长，offset 越大越慢。正确做法是改成按分数游标翻页：记录上一页最后一名成员的 score，用 `ZREVRANGEBYSCORE key (lastScore -inf LIMIT offset count` 继续取。Top10 这种小 offset 用 `ZREVRANGE` 没问题，深翻页必须走 score 游标。

#### Q6：榜单头部的热 key 怎么处理？

Top 榜访问高度集中，单 key 压力大。做法是本地缓存（Caffeine）挡一层，定期刷 TopN 到本地，读请求优先走本地；或按榜单分片（如按品类拆 key），再在应用层归并。

#### Q7：成员数过多（大 key）怎么治理？

用 `ZREMRANGEBYRANK` 定期裁剪，只保留 Top N（对应上面 `trimToTopN`）；成员千万级时再按业务维度分片，避免单 ZSet 过大拖慢 `ZINCRBY` 和范围查询。

## 关联

- 使用 Redis 实现一个排行榜怎么做
- ZSet 数据结构
