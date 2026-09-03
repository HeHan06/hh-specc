## 问题

如何使用 Redis 设计一个排行榜（ZSet）。

## 考察点

- ZSet 核心 API（ZADD/ZINCRBY/ZREVRANK/ZREVRANGE）的使用与原子性
- 大 key 裁剪、深分页、热 key 治理

## 标准答案

### 完整 Spring Boot 代码实现

#### 依赖与配置

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

```yaml
spring:
  redis:
    host: localhost
    port: 6379
```

#### DTO

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

#### Service：核心逻辑

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

    // 覆盖式设置分数：对应 ZADD
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
    public void trimToTopN(int n) {
        redisTemplate.opsForZSet().removeRange(KEY, 0, -(n + 1));
    }
}
```

关键点（读代码时最容易卡住的地方）：

- 排名下标从 0 开始：`reverseRank` 返回 0 表示第 1 名，所以 `getRank()` 里要 `rank + 1`。
- 正序 vs 倒序：`ZRANK/ZRANGE` 是分数从小到大，带 `reverse` 前缀的是从大到小。排行榜要“高分在前”，所以全部用 `reverse` 系列。
- `removeRange(KEY, 0, -(n + 1))` 的含义：`removeRange` 对应 `ZREMRANGEBYRANK`，内部按 score 升序排名，`0` 是分数最低（最后一名），`-1` 是分数最高（第一名），`-(n+1)` 是“倒数第 n+1 低分”。所以 `[0, -(n+1)]` 删掉除最高 n 个之外的所有低分，保留前 n 名。
- `TypedTuple` 要解包：必须 `t.getValue()` 拿 userId、`t.getScore()` 拿分数。

### 围绕实现出的面试题

**Q1：把 zset 的四组常用 API 背一遍。**

- 基础：`ZADD key score member`（添加或覆盖）、`ZREM key member...`（删成员）、`ZSCORE key member`（查分）、`ZCARD key`（成员总数）、`ZCOUNT key min max`（区间内成员个数）。
- 排名：`ZRANK key member`（升序名次）、`ZREVRANK key member`（降序名次）。
- 范围：`ZRANGE key start stop`（升序取区间）、`ZREVRANGE key start stop`（降序取区间）、`ZRANGEBYSCORE key min max`（按分数区间升序）、`ZREVRANGEBYSCORE key max min`（按分数区间降序，参数先大后小）。
- 聚合与删除：`ZINCRBY key increment member`（原子增减分数）、`ZUNIONSTORE`/`ZINTERSTORE`（并集/交集落新 key）、`ZREMRANGEBYRANK key start stop`（按名次区间删）、`ZREMRANGEBYSCORE key min max`（按分数区间删）。

**Q2：加分为什么要用 `incrementScore`（ZINCRBY），而不是“先读分数、本地相加、再写回”？**

因为“读-改-写”三步不是原子的，高并发下会丢更新。两个请求同时读到旧分 100，各自加 10 后都写回 110，正确结果应是 120。`ZINCRBY` 在 Redis 服务端把“读、算、写”合并成一步原子操作。

**Q3（找 bug 题）：高并发下“读-改-写”更新分数有什么问题？怎么改？**

问题就是“读-改-写”非原子导致丢失更新。改成 `redisTemplate.opsForZSet().incrementScore(KEY, userId, delta);` 一行搞定。注意：题干一旦出现“高并发”关键词，先往原子性/竞态方向查。

**Q4：查 Top N 为什么要带 WITHSCORES？**

不带分数就只能拿到 member，之后为了显示分数还得逐个再查 `ZSCORE`，产生 N+1 次网络往返。`WITHSCORES` 一次把 member 和 score 都带回来，把 N+1 压成 1 次。

**Q5：深分页怎么办？比如要查第 1000 名到第 1010 名。**

`ZREVRANGE key 1000 1010` 这类带大 offset 的查询，复杂度随 offset 线性增长。正确做法是改成按分数游标翻页：记录上一页最后一名成员的 score，用 `ZREVRANGEBYSCORE key (lastScore -inf LIMIT offset count` 继续取。

**Q6：榜单头部的热 key 怎么处理？**

Top 榜访问高度集中，单 key 压力大。做法是本地缓存（Caffeine）挡一层，定期刷 TopN 到本地；或按榜单分片（如按品类拆 key），再在应用层归并。

**Q7：成员数过多（大 key）怎么治理？**

用 `ZREMRANGEBYRANK` 定期裁剪，只保留 Top N；成员千万级时再按业务维度分片，避免单 ZSet 过大拖慢 `ZINCRBY` 和范围查询。

## 关联

- 分布式锁（Redisson）
- 商品详情页缓存设计
