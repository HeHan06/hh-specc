## 问题

分库分表后的查询（订单按用户分片）。

## 考察点

- 分片键选择、基因法让订单号反解出 user_id
- 跨分片查询（广播表/全局表/异构索引）

## 标准答案

### 核心思路

考点是「分片之后，不是所有查询都恰好带分片键」。分库分表解决了单表数据量爆炸，但引入了查询路由问题。带分片键的查询（按 user_id 查订单）能一步定位到目标库表；不带分片键的查询（只拿订单号、按时间范围查报表）会退化成"广播扫所有分片"。工程解法是一套组合：基因法让订单号自带分片信息、广播表解决小表 join、异构索引（ES/索引表）解决跨维度查询。

### 1. 分片规则配置（ShardingSphere-JDBC）

```yaml
spring:
  shardingsphere:
    datasource:
      names: ds0,ds1        # 简化：实际 16 库
      ds0: { type: com.zaxxer.hikari.HikariDataSource, jdbcUrl: ..., ... }
      ds1: { type: com.zaxxer.hikari.HikariDataSource, jdbcUrl: ..., ... }
    rules:
      sharding:
        tables:
          t_order:
            actualDataNodes: ds${0..1}.t_order_${0..127}   # 2 库 × 128 表
            databaseStrategy:
              standard:
                shardingColumn: user_id
                # 库路由：user_id % 16
                algorithmClassName: com.demo.sharding.ModShardingAlgorithm
            tableStrategy:
              standard:
                shardingColumn: user_id
                # 表路由：user_id / 16 % 128
                algorithmClassName: com.demo.sharding.ModShardingAlgorithm
            keyGenerateStrategy:
              column: order_id
              algorithmName: snowflake
        # 广播表：每个库都放一份，join 时不必跨库
        broadcastTables: t_region, t_config
```

### 2. 分片算法 + 基因法（订单号反解分片键）

```java
// 精确分片算法：支持 = / IN 查询的路由
public class ModShardingAlgorithm implements StandardShardingAlgorithm<Long> {

    @Override
    public String doSharding(Collection<String> targets,
                             PreciseShardingValue<Long> value) {
        long userId = value.getValue();
        // 库索引 = userId % 16，表索引 = userId / 16 % 128
        // 这里简化为直接对表取模
        int idx = (int) (userId % targets.size());
        // 返回目标物理表名，ShardingSphere 据此把 SQL 改写到正确库表
        for (String t : targets) {
            if (t.endsWith(String.valueOf(idx))) return t;
        }
        throw new UnsupportedOperationException("无可用分片");
    }
}

// 基因法：订单号里冗余 user_id 的低位，凭订单号就能反解路由
// （生成侧在第 8 题 ID 生成器里讲过，这里只看查询侧怎么用）
public class GeneSharding {

    static final int SHARD_BITS = 7;   // 128 表 = 2^7

    public static int shardOf(long orderId) {
        // 取订单号末尾 7 位基因，直接算出落在哪张表，无需 DB
        return (int) (orderId & ((1L << SHARD_BITS) - 1));
    }
}
```

### 3. 三类查询的不同路由

```java
// 场景一：带分片键（user_id）—— ShardingSphere 自动路由到单库单表，最优
public List<Order> listByUser(long userId) {
    return orderMapper.selectByUserId(userId);
}

// 场景二：只有订单号 —— 基因法直接算路由，仍走单分片
public Order getByOrderNoByGene(long orderNo) {
    // 若订单号采用基因法生成，可反解 user_id 分片位
    int shard = GeneSharding.shardOf(orderNo);
    return orderMapper.selectByOrderNo(orderNo);   // 带分片提示后走单分片
}

// 场景三：跨维度（按时间查报表）—— 走异构索引 ES，不扫分片库
@Service
public class OrderReportService {

    @Autowired
    private OrderEsRepository esRepo;

    // 按"时间范围 + 订单状态"查统计：分片键用不上，走 ES
    public long countByTime(LocalDateTime from, LocalDateTime to, String status) {
        return esRepo.countByCreateTimeBetweenAndStatus(from, to, status);
    }
}
```

### 4. 异构索引：订单号 → user_id 映射（无基因法时的兜底）

```java
// 问题：订单号没带 user_id，又没用基因法时，要么广播扫所有库，要么靠映射表
// 方案：建一张"索引表"，只按 order_no 分片，主键存 order_no + user_id
@Service
public class OrderByNoService {

    @Autowired private OrderIndexMapper indexMapper;   // 索引表：order_no → user_id
    @Autowired private OrderMapper     orderMapper;    // 主表：按 user_id 分片

    public Order getByOrderNo(long orderNo) {
        // 第一步：查索引表拿 user_id（索引表按 order_no 分片，一步定位）
        Long userId = indexMapper.selectUserIdByOrderNo(orderNo);
        if (userId == null) return null;
        // 第二步：拿到 user_id 后，带分片键查主表，再一步定位
        return orderMapper.selectByOrderNoAndUser(orderNo, userId);
    }
}

// 索引表 DDL：只存路由关系，数据量小、按 order_no 自己分片
// CREATE TABLE t_order_index (order_no BIGINT PRIMARY KEY, user_id BIGINT, KEY idx_user(user_id));
```

### 高频面试问题与口述答案

**Q1：为什么订单按 user_id 分片，而不是按 order_id？**

选分片键的核心原则是"按最高频查询维度分片，让大多数查询能带分片键"。订单系统最高频的查询是"查某个用户的订单列表"，所以按 user_id 分片能让这类查询直接落到单库单表。如果按 order_id 分片，"查用户订单"就不知道该去哪个分片，要广播扫所有库再归并。按 user_id 分片的代价是"按订单号查单"变难，但这可以用基因法或异构索引解决。本质是用低频维度的复杂度换高频维度的性能。

**Q2：分片键怎么选？选错会怎样？**

看三点：高频度、离散度、避免数据倾斜。按业务最高频的查询维度选，让它带上分片键；分片键要足够离散保证数据均匀分布；考虑未来扩容，最好选能一致性 hash 扩容或模翻倍的键。选错的典型后果是数据倾斜（如按省份分片，北上广数据量是西藏几百倍）或查询全失效（选了几乎不参与查询的字段，绝大多数查询不带分片键，退化成全分片扫描）。经验是：先统计线上查询维度分布，选覆盖 80% 以上查询量的维度做分片键。

**Q3：用户只给一个订单号，怎么定位库表？基因法？**

订单号本身不带分片信息，直接查 ShardingSphere 只能广播到所有库。基因法解法：生成订单号时把 user_id 的低 N 位（N = log2(表数)，128 表就是 7 位）作为"基因"拼到订单号末尾。这样 orderId & 0x7F 就能直接算出它在哪张表，一步定位。本质是用 ID 里冗余的几个 bit 换取"免查路由"。优势是零额外存储、零额外查询；缺点是扩容不灵活——表数翻倍后老订单号的基因位数不够，需要数据迁移或双写过渡。

**Q4：广播表是什么？什么场景用？**

广播表是"每个库都放一份完整副本的小表"，比如地区表、配置表、字典表。作用是解决跨库 join：订单表按 user_id 分片后要 join 地区表拿地区名，把地区表广播到每个库，join 就能在单库内完成。代价一是写要广播（改一条配置要同步所有库），二是一致性维护成本（一般用配置中心或 Canal 监听变更再同步）。判断标准：数据量小（万级以内）、变更频率低、被大量 join，三者都满足才用。

**Q5：按时间查报表（不带分片键）怎么办？异构索引怎么选？**

按时间范围查报表是分片键的死角——user_id 分片和"按时间查"正交，只能广播扫所有库再归并。两个工程解法：一是异构索引表，建 (order_no → user_id) 或 (create_time → user_id) 映射表，自己按查询维度分片，先查索引拿 user_id 再带分片键查主表；二是 ES，把订单全量同步到 ES，按时间、状态等多维度查直接走 ES 倒排索引和聚合。倾向用 ES——报表要的是聚合统计，ES 天然擅长，支持任意维度组合查询。代价是数据同步延迟和额外存储成本。分工：带分片键的实时查走分片库，报表/复杂查询走 ES。

**Q6：ShardingSphere 的路由原理？精确分片 vs 范围分片？**

原理是"SQL 改写 + 结果归并"：应用写逻辑 SQL，经过解析按分片键算出目标库表，改写成物理 SQL 发到对应库，再把多库结果归并返回。对应用透明。分片算法分两类：精确分片（=、IN）能算出具体某几个分片，只发到目标库；范围分片（between、>）可能命中多个分片，要发到多个库再归并。范围查询天然比精确查询贵，这也是为什么分片键要选高频且等值查询的字段。

**Q7：分库分表后跨库 join 怎么解决？**

四种解法。一是广播表：小表（地区、配置）每个库一份，join 在单库完成。二是绑定表：两张有关联的表（订单表、订单明细表）按相同分片键和分片算法分片，保证同一个 user_id 的订单和明细落在同一库，join 仍是单库 join。三是应用层 join：分两次查，先查主表拿 id 再批量查关联表，在应用内存拼装。四是 ES/异构存储：把需要 join 的数据冗余进 ES，查询直接走 ES。生产最常用绑定表 + 广播表组合：主从表绑定分片保证同库 join，小字典表广播，剩下的复杂报表走 ES。

**Q8：分库分表后深翻页（limit 10000,10）有什么问题？怎么优化？**

深翻页是重灾区。单库 limit 10000,10 只是丢弃前 10000 行，但分库分表后 ShardingSphere 要对每个分片都查 limit 0,10010，N 个分片就是 N × 10010 行，归并排序后取第 10000~10010 条，基本是 O(N × offset)。三种优化：一是带分片键（带上 user_id 后只查一个分片）；二是游标翻页（用上一页最后一条 id 做 where id > lastId limit 10，避免大 offset，但要保证排序字段唯一且递增）；三是禁止跳页（只允许下一页）。本质是把"全局排序归并"变成"基于游标的局部查询"。

### 补充：分片扩容——为什么"2 的幂"很重要

1. 倍数扩容（推荐）：分片数从 16 翻倍到 32，因为 userId % 16 和 userId % 32 的关系是"原分片 0 的数据，一半留在新分片 0、一半去新分片 16"，只需迁移一半数据，且路由逻辑连续不中断。
2. 非倍数扩容（如 16 → 24）：几乎所有数据都要重新分布，全量迁移，停机成本高。

所以规划分片数时优先选 2 的幂（16、32、64、128），给未来倍数扩容留余地。基因法同理——基因位数 N 对应 2^N 张表，扩容时 N 加 1 翻倍，迁移量最小。

## 关联

- 全局唯一 ID
- 接口幂等
