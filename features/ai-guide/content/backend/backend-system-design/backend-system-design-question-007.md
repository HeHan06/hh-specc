## 问题

订单号 / 全局唯一 ID 生成器。

## 考察点

- 雪花算法、号段模式、基因法三种方案
- 时间回拨、workerId 分配、ID 与分片键绑定、趋势递增对 B+ 树的影响

## 标准答案

### 核心思路

考点是在分库分表 + 高并发下单场景下，怎么生成一个全局唯一、趋势递增、还能反解出分片键的 ID。三个关键词串起整题：雪花算法、号段模式、基因法。

### 方案一：雪花算法（无中心、高性能，但有时钟回拨风险）

```java
public class SnowflakeIdWorker {
    private final long twepoch = 1577808000000L;          // 开始时间戳：2020-01-01
    private final long workerIdBits = 5L;                  // 机器 ID：5 位，最多 32 台
    private final long datacenterIdBits = 5L;              // 机房 ID：5 位，最多 32 个
    private final long sequenceBits = 12L;                 // 序列号：12 位，单机每毫秒 4096 个

    private final long maxWorkerId = ~(-1L << workerIdBits);         // 31
    private final long maxDatacenterId = ~(-1L << datacenterIdBits); // 31
    private final long sequenceMask = ~(-1L << sequenceBits);        // 4095

    private final long workerIdShift = sequenceBits;                             // 12
    private final long datacenterIdShift = sequenceBits + workerIdBits;          // 17
    private final long timestampShift = sequenceBits + workerIdBits + datacenterIdBits; // 22

    private final long workerId;
    private final long datacenterId;
    private long sequence = 0L;
    private long lastTimestamp = -1L;

    public SnowflakeIdWorker(long workerId, long datacenterId) {
        if (workerId > maxWorkerId || workerId < 0) throw new IllegalArgumentException("workerId 越界");
        if (datacenterId > maxDatacenterId || datacenterId < 0) throw new IllegalArgumentException("datacenterId 越界");
        this.workerId = workerId;
        this.datacenterId = datacenterId;
    }

    public synchronized long nextId() {
        long timestamp = System.currentTimeMillis();

        // 时间回拨：当前时间 < 上次生成时间
        if (timestamp < lastTimestamp) {
            long offset = lastTimestamp - timestamp;
            if (offset <= 5) {
                try { Thread.sleep(offset << 1); } catch (InterruptedException ignored) {}
                timestamp = System.currentTimeMillis();
                if (timestamp < lastTimestamp) throw new RuntimeException("时钟回拨超限");
            } else {
                throw new RuntimeException("时钟回拨超过 5ms，拒绝生成 ID");
            }
        }

        if (timestamp == lastTimestamp) {
            sequence = (sequence + 1) & sequenceMask;
            if (sequence == 0) {
                timestamp = tilNextMillis(lastTimestamp);
            }
        } else {
            sequence = 0L;
        }

        lastTimestamp = timestamp;

        // 拼装：时间戳(高位) | 机房 | 机器 | 序列号(低位)
        return ((timestamp - twepoch) << timestampShift)
             | (datacenterId << datacenterIdShift)
             | (workerId << workerIdShift)
             | sequence;
    }

    private long tilNextMillis(long lastTimestamp) {
        long timestamp = System.currentTimeMillis();
        while (timestamp <= lastTimestamp) {
            timestamp = System.currentTimeMillis();
        }
        return timestamp;
    }
}
```

### 方案二：号段模式（Leaf 思路，批量取号，DB 压力小）

```java
public class SegmentIdGenerator {
    private final JdbcTemplate jdbc;
    private final String bizTag;      // 业务标识，如 "order"
    private static final int STEP = 1000;   // 每次取 1000 个号

    private long currentId;
    private long maxId;

    public synchronized long nextId() {
        if (currentId >= maxId) {
            loadSegment();
        }
        return ++currentId;
    }

    private void loadSegment() {
        long newMax = jdbc.queryForObject(
            "UPDATE leaf_alloc SET max_id = LAST_INSERT_ID(max_id + ?) WHERE biz_tag = ?",
            Long.class, STEP, bizTag);
        this.currentId = newMax - STEP;
        this.maxId = newMax;
    }
}
```

### 方案三：基因法 —— 让 ID 反解出分片键

```java
public class GeneIdBuilder {
    public static long buildOrderId(long snowflakeId, long userId, int shardBits) {
        long gene = userId & ((1L << shardBits) - 1);
        return (snowflakeId << shardBits) | gene;
    }

    public static int shardOf(long orderId, int shardBits) {
        return (int) (orderId & ((1L << shardBits) - 1));
    }
}
```

要点提炼：雪花算法解决“无中心、高性能、趋势递增”；号段模式解决“DB 压力、可反解业务”；基因法解决“订单号直接定位分片，避免全表扫描”。

### 高频面试问题与口述答案

**Q1：为什么不用数据库自增主键？分库分表下自增 ID 有什么问题？**

单库单表下自增主键最简单，但一旦分库分表，每个库各自从 1 开始自增，ID 会全局重复。解决办法是设置不同起始值和步长，但扩容麻烦，且 ID 暴露业务量，且“从数据库拿 ID”本身就是一个单点和性能瓶颈。所以高并发场景用雪花算法或号段模式。

**Q2：为什么不用 UUID？UUID 做主键会带来什么代价？**

UUID 能做到全局唯一，但有三个致命问题：一是无序，插入 B+ 树时会造成大量页分裂和磁盘随机写；二是占空间，36 位字符串比 8 字节的 bigint 大好几倍；三是不可读，从订单号里看不出业务信息。雪花算法正好补上了“趋势递增、紧凑、可反解”。

**Q3：雪花算法的结构是什么？为什么它能做到“趋势递增”？**

雪花算法把一个 64 位的 long 拆成四段：最高位符号位不用；接着是 41 位时间戳（精确到毫秒）；然后是 10 位机器标识（5 位机房 + 5 位机器）；最后是 12 位序列号。因为它把时间戳放在高位，所以整体 ID 随时间单调递增。这种递增对 B+ 树索引非常友好，插入基本都在最右侧叶子节点。

**Q4：雪花算法的缺点是什么？时间回拨是怎么回事？**

最大的软肋是强依赖机器时钟。时间回拨就是系统时间被往回拨了——常见原因有 NTP 校时、运维手动改时间、虚拟机时钟漂移。如果生成 ID 时“当前时间”比“上次生成的时间”早，那么按老时间戳生成的 ID 就很可能重复。还有两个次生问题：workerId 需要额外机制分配；每毫秒 4096 个的上限。

**Q5：时间回拨怎么解决？有哪些工程方案？**

分层处理。第一层容忍小回拨：回拨在几毫秒以内就自旋 sleep 等时钟追上来。第二层拒绝大回拨：回拨超过阈值直接抛异常，宁可短暂不可用。第三层从根上缓解：NTP 校时改成“渐进式校时”。更彻底的方案是像美团 Leaf 那样放弃时钟、改用号段模式。

**Q6：workerId 怎么分配？多机部署时怎么保证唯一？**

常见几种：一是数据库自增，机器启动时往一张表插一条记录拿自增 workerId；二是 ZooKeeper 的持久顺序节点；三是 Redis 的 INCR；四是用机器 IP 或 hostname 的哈希取模。中小规模用数据库表分配简单可靠。

**Q7：号段模式（Leaf）的原理？相比雪花算法的优劣？**

号段模式的核心是“批量取号”：应用启动时一次性从数据库取一段号放内存里，之后在内存里自增发号。这样 DB 从“每次发号都要扛一次请求”变成“每 1000 个号才扛一次”，且天然无时钟依赖、无回拨问题。代价是 ID 是连续纯自增数字（暴露业务量）、依赖 DB 这个发号中心、应用重启会浪费内存里没发完的那段号。

**Q8：分库分表后，订单号怎么和分片键绑定？基因法怎么实现？**

订单按 user_id 分 16 张表，但用户查订单时经常只拿一个订单号。基因法就是生成订单号时把 user_id 的低 N 位（N = log2(表数)，16 张表就是 4 位）作为“基因”拼到雪花 ID 的末尾。这样拿到订单号，`orderId & 0xF` 就能直接算出它在哪张表。本质是用 ID 里冗余的几个 bit 换取“免查路由”。

**Q9：为什么 ID 要“趋势递增”？它对 B+ 树索引有什么影响？**

InnoDB 主键索引是聚簇索引，数据按主键顺序物理存储在 B+ 树叶子节点里。如果主键递增，新 ID 总是追加到最右边的叶子节点，基本是顺序写、极少页分裂。如果主键随机（如 UUID），新 ID 会随机插入到中间，频繁触发页分裂，产生大量随机 IO 和碎片。

## 关联

- 分库分表后的查询
- 数据库分库分表
