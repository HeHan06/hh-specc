## 问题

微博关注流 / 朋友圈 Feed 流。

## 考察点

- 推模式（写扩散）与拉模式（读扩散）的取舍
- 大 V 扇出瓶颈与推拉结合、游标分页

## 标准答案

### 核心思路

考点是海量用户刷关注流时，怎么在“写扩散的存储成本”和“读扩散的延迟成本”之间做取舍。核心不是选一个模式，而是按用户粉丝量分层、推拉结合，以及用游标分页解决 Feed 流的深分页和翻页错乱。

### 推模式核心：发微博时“写扩散”

```java
@Service
public class FeedService {

    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private RedisTemplate<String, String> redis;

    // 1. 发布微博：先落库，再异步"写扩散"到粉丝收件箱
    public void publish(long authorId, String content) {
        long postId = insertPost(authorId, content);
        asyncFanout(authorId, postId);
    }

    private void asyncFanout(long authorId, long postId) {
        long fanCount = getFanCount(authorId);
        if (fanCount > 100_0000) {
            // 大 V：不推，改成"拉模式"
            return;
        }
        // 小博主：遍历粉丝，把 postId 写进每个粉丝的收件箱
        List<Long> fans = queryFans(authorId);
        for (Long fanId : fans) {
            // ZSet：key = feed:{fanId}, member = postId, score = 发布时间戳
            redis.opsForZSet().add("feed:" + fanId, String.valueOf(postId), System.currentTimeMillis());
        }
    }

    // 2. 读 feed：直接从自己的收件箱取，按时间倒序分页
    public List<Long> readFeed(long userId, long cursor, int pageSize) {
        Set<String> postIds = redis.opsForZSet()
            .reverseRangeByScore("feed:" + userId, 0, cursor - 1, 0, pageSize);
        return postIds.stream().map(Long::valueOf).collect(Collectors.toList());
    }
}
```

### 游标分页：为什么不用 OFFSET

```java
// 问题：OFFSET 分页在 feed 流里有两个坑
// 1) 深分页：OFFSET 10000 要扫描并丢弃前 10000 条，越翻越慢
// 2) 翻页错乱：翻页过程中有新微博插入，后面的内容会整体后移，导致重复或漏读
public List<Post> readFeedByCursor(long userId, long lastTime, int pageSize) {
    return jdbc.query(
        "SELECT * FROM feed f JOIN post p ON f.post_id = p.id " +
        "WHERE f.user_id = ? AND p.create_time < ? " +
        "ORDER BY p.create_time DESC LIMIT ?",
        new Object[]{userId, lastTime, pageSize},
        (rs, i) -> new Post(rs.getLong("id"), rs.getString("content"), rs.getLong("create_time"))
    );
}
```

### 推拉结合：按粉丝量分层（业界标准做法）

```java
public List<Post> readFeedMixed(long userId, long cursor, int pageSize) {
    // 1. 普通博主的微博：已经从收件箱推给我了，直接读
    List<Long> pushedIds = readFromInbox(userId, cursor, pageSize);
    // 2. 我关注的大 V 的微博：读的时候实时去拉
    List<Long> bigVIds = queryMyBigVFollowees(userId);
    List<Long> pulledIds = new ArrayList<>();
    for (Long bigVId : bigVIds) {
        pulledIds.addAll(queryRecentPosts(bigVId, cursor, pageSize));
    }
    // 3. 合并、去重、按时间倒序排序，再截断到 pageSize
    return mergeAndSort(pushedIds, pulledIds).stream()
        .limit(pageSize)
        .collect(Collectors.toList());
}
```

要点提炼：推模式是“写的时候辛苦、读的时候省事”，拉模式相反；大 V 的 5000 万粉丝如果全推，写一次要扩散 5000 万次，所以大 V 必须走拉，这就是推拉结合的根因。

### 高频面试问题与口述答案

**Q1：推模式（写扩散）和拉模式（读扩散）的区别？各自的优缺点？**

本质是把计算成本放在写还是放在读。推模式：博主发微博时立刻推送到所有粉丝的收件箱，读很快，但写代价大，很多粉丝可能根本不活跃，白白浪费存储。拉模式：博主发微博只落自己的内容表，粉丝读的时候实时拉取关注对象最近发的微博再合并，写简单、不浪费存储，但关注越多读越慢、延迟高。

**Q2：为什么大 V 不能走推模式？扇出瓶颈具体卡在哪？**

核心是写放大。大 V 有 5000 万粉丝，发一条微博就要往 5000 万个收件箱各写一条。这带来三个问题：耗时（同步写不可接受）、存储爆炸（5000 万条副本）、热点（发微博瞬间写请求打到存储形成扇出尖峰）。而且大量僵尸粉是纯浪费。所以大 V 统一走拉模式。

**Q3：推拉结合具体怎么做？粉丝量阈值怎么定？**

按粉丝量分层。普通用户（粉丝量小）走推模式；大 V 走拉模式。读 feed 时把“已推给我的普通博主内容”和“实时拉取的大 V 内容”合并排序。阈值一般是经验值，比如粉丝量超过 10 万或 100 万就切到拉模式，按“存储成本 vs 读延迟”的实际压测来定。

**Q4：Feed 流分页为什么用游标（cursor）而不用 OFFSET？**

OFFSET 有两个致命问题。第一是深分页慢：`LIMIT 10000, 10` 需要扫描并丢弃前 10000 条。第二是翻页错乱：翻页过程中有新微博插入，列表整体后移，导致重复或漏读。游标分页锚定时间点而不是偏移量，中间插入多少新内容都不影响后续页的正确性。

**Q5：用游标分页时，如果两条微博时间戳相同怎么办？**

时间戳相同会导致游标分页漏读（严格小于）和排序不稳定。解法是加次级排序键，通常用微博 ID 作为 tie-breaker：排序改成 `ORDER BY create_time DESC, id DESC`，游标升级成 `(create_time, id)` 二元组。

**Q6：拉模式实时聚合时，如果关注了几百个人，怎么高效拉取？（多路归并）**

不能对每个关注对象都发一次查询。高效做法是多路归并：一次性查出“我关注的所有人”最近 N 条微博（`WHERE author_id IN (...)`），在内存里按时间倒序做归并排序。更进一步用优先队列（堆）做 TopN 归并。核心是把几百个独立查询合并成一次批量查询，再用堆做 TopN。

**Q7：收件箱用 Redis 的什么数据结构存？为什么用 ZSet？**

用 Redis 的 ZSet（有序集合）。原因有两点：一是 ZSet 天然有序，member 是微博 ID，score 是发布时间戳；二是它支持 `ZREVRANGEBYSCORE` 按 score 范围取，正好对应游标分页。代价是 ZSet 比 List 占内存略大，所以收件箱一般设一个长度上限，超出就 `ZREMRANGEBYRANK` 裁剪。

**Q8：一个用户很久不活跃，他的收件箱要不要清理？（冷热分离）**

要。推模式最大的浪费就是“给僵尸粉也推了内容”。做法是冷热分离：活跃用户的收件箱常驻内存（Redis），不活跃用户的收件箱做降级——要么不推、等他下次活跃时用拉模式补齐，要么把收件箱落到磁盘。判断活跃度可以用“最近一次登录时间”或“最近一次刷 feed 时间”。

**Q9：粉丝列表很大，推模式遍历粉丝会阻塞发微博，怎么异步化？**

发微博主流程不能因为要给几万粉丝写收件箱而卡住，所以写扩散必须异步 + 分批。做法是：博主发微博先落库，然后投递一条消息到 MQ，由消费端异步地把 postId 扩散到粉丝收件箱。扩散过程再分批，比如每批 1000 个粉丝。异步化带来“一致性延迟”——粉丝可能晚几秒才看到，这在 feed 场景是可以接受的最终一致。

**Q10：微博被删除或作者删了，怎么同步清理所有粉丝的收件箱？**

这是推模式的一个隐藏成本。两个方案：一是同步删除，删除微博时发异步消息遍历粉丝删 postId，但成本高；二是懒删除（读时过滤），粉丝读 feed 拿到一批 postId 后，批量查这些微博是否还存在，把已删的过滤掉。工程上通常用懒删除 + 定期对账。

## 关联

- 下单超时关单
- 排行榜（ZSet）
