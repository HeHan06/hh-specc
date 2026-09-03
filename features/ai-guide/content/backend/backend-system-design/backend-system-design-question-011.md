## 问题

抢红包（微信 / 支付宝）。

## 考察点

- 二倍均值法随机拆分、预分配防超发、Redis List 原子弹出、SETNX 去重

## 标准答案

### 核心思路

考点是高并发下怎么既做到金额随机、总额不超发，又能保证公平和一人只能抢一次。核心三件事：随机拆分算法（预分配）、Redis 原子扣减（防超发）、去重（防重复抢）。

### 核心思路：发红包时“预拆分”，抢红包时“原子取一个”

```java
@Service
public class RedPacketService {

    @Autowired
    private StringRedisTemplate redis;

    // 二倍均值法：保证每份金额随机、总额精确，且"先抢的人方差更大，但期望相等"
    public List<Integer> splitAmount(int totalAmount, int count) {
        List<Integer> result = new ArrayList<>();
        int remainAmount = totalAmount;   // 剩余金额（单位：分）
        int remainCount = count;          // 剩余红包数

        Random random = new Random();
        for (int i = 0; i < count - 1; i++) {
            // 每个红包的随机上限 = 剩余平均金额的 2 倍，保证不会有人抢到 0，也不会提前抢光
            int max = remainAmount / remainCount * 2;
            int money = 1 + random.nextInt(max);   // 至少 1 分
            result.add(money);
            remainAmount -= money;
            remainCount--;
        }
        result.add(remainAmount);   // 最后一个红包拿走剩余全部，保证总额精确
        return result;
    }

    // 发红包：拆分后 LPUSH 进 List，抢的时候 RPOP（或 LPOP）拿
    public void createRedPacket(long packetId, int totalAmount, int count) {
        List<Integer> amounts = splitAmount(totalAmount, count);
        for (int amount : amounts) {
            redis.opsForList().rightPush("redpacket:" + packetId, String.valueOf(amount));
        }
        redis.opsForValue().set("redpacket:total:" + packetId, String.valueOf(totalAmount));
    }
}
```

```java
@Service
public class GrabRedPacketService {

    @Autowired
    private StringRedisTemplate redis;

    public Long grab(long packetId, long userId) {
        // 关键点一：去重 —— 先判断用户是否抢过，用 SETNX 原子标记
        Boolean firstGrab = redis.opsForValue()
            .setIfAbsent("redpacket:grabbed:" + packetId + ":" + userId, "1");
        if (Boolean.FALSE.equals(firstGrab)) {
            return null;   // 抢过了
        }

        // 关键点二：防超发 —— LPOP/RPOP 是原子的，抢一个少一个
        String amount = redis.opsForList().rightPop("redpacket:" + packetId);
        if (amount == null) {
            // 关键点三：没抢到要回滚去重标记
            redis.delete("redpacket:grabbed:" + packetId + ":" + userId);
            return null;   // 已抢完
        }

        // 抢到了，异步落库入账
        asyncSaveGrabRecord(packetId, userId, Long.valueOf(amount));
        return Long.valueOf(amount);
    }
}
```

### 关键点说明

为什么“预分配”而不是“抢的时候实时算”：预分配把随机拆分放到发红包那一刻，抢的时候只是原子取一个，抢的瞬间几乎没有计算，扛得住 10 万人并发；实时算要么加锁（性能崩），要么算错（超发）。

为什么用 LPOP/RPOP 而不是先读长度再取：先 GET 长度判断 > 0 再 LPOP，两步之间并发下会超发；LPOP/RPOP 是原子的，“取一个少一个”，返回 null 就是抢完了。

去重为什么用 SETNX：判断“抢没抢过” + 标记“抢过了”两步必须原子，否则并发下同一用户能抢两次。

### 高频面试问题与口述答案

**Q1：抢红包的金额怎么做到随机又不超发？二倍均值法是什么？**

核心约束是总额精确。二倍均值法：每次拆一个红包时，把“剩余金额 ÷ 剩余个数 × 2”作为这个红包的随机上限。这样第一个红包不会把总额都拿走，后面的人不会抢到 0。最后一个红包直接拿剩余的全部，保证总额精确。特性是每个人的金额期望相等（都 ≈ 平均值），但方差不同——先抢的人方差大，后抢的人方差小。

**Q2：为什么要“预分配”金额，而不是抢的时候实时算？**

预分配把随机拆分放到发红包那一刻，抢的时候只是原子取一个。抢的瞬间是并发尖峰，如果每个请求都实时算随机金额，还要保证总额不超，要么加锁（性能雪崩），要么无锁（必然超发）。发红包是低频操作，在发的这一刻慢慢算，代价极小。本质是把计算压力从“读高峰”挪到“写低谷”。

**Q3：Redis 里红包金额用什么数据结构存？为什么用 List？**

用 Redis 的 List。发红包时把拆好的金额一个个 RPUSH 进去，抢的时候 LPOP/RPOP 取一个。选 List 的原因就一个：LPOP/RPOP 是原子的，天然满足“取一个少一个”，抢完了返回 null，不可能超发。

**Q4：怎么保证一个人只能抢一次？SETNX 去重的坑在哪？**

用 SETNX 做去重标记。抢红包前先 `SETNX redpacket:grabbed:{packetId}:{userId}`，成功才允许继续抢。坑在于：如果标记成功之后 LPOP 发现红包已经抢完了（返回 null），就必须把刚才的标记删掉，否则用户会变成“标记了抢过、但实际没抢到钱”。正确顺序是“标记 → 抢 → 抢失败就回滚标记”。

**Q5：10 万人同时抢 100 个红包，Redis 扛得住吗？怎么扛住？**

扛得住。第一是预分配 + 原子操作，抢的动作就一个 LPOP 加一个 SETNX，都是单命令原子操作，Redis 单线程能达到每秒十万级。第二是失败快速返回，99.9% 的请求在 LPOP 返回 null 时就直接失败了，不会穿透到数据库。第三是限流 + 排队。第四是集群 + 多副本。核心是抢红包被设计成了纯内存的原子命令，不碰数据库、不加锁。

**Q6：抢到的钱什么时候入账？为什么不能抢的时候同步写数据库？**

一定不能抢的时候同步写数据库。抢的瞬间是并发尖峰，每个抢到的人同步 INSERT 一条入账记录，数据库瞬间被打爆。正确做法是异步入账：抢到后先返回成功，然后投递一条 MQ 消息，由消费端异步写数据库、更新用户余额。

**Q7：如果抢红包的过程中服务崩溃了，钱会丢吗？怎么保证最终一致？**

存在这种风险，所以要做对账兜底。发红包时把“总额、个数、每个红包的金额明细”先持久化到数据库；抢红包时每抢一个就记一条日志（或异步 MQ 落库）。这样即使 Redis 挂了，也能从数据库里的“红包明细”和“已抢记录”对账。Redis 是快速路径，数据库是可靠兜底。

**Q8：手气最佳怎么算？抢红包是不是先抢的人手气更好？**

手气最佳就是抢到的金额最大的那个。至于“先抢的人是否更划算”：二倍均值法下，先抢和后抢的金额期望是相等的，区别只在方差——先抢的人上限是均值的 2 倍、但下限趋近 0，波动大；后抢的人范围收窄，更接近平均值。所以“先抢手气更好”是错觉，先抢的人只是方差更大、更刺激。

**Q9：二倍均值法和“线段分割法”有什么区别？哪个更公平？**

两者都是“发红包时把总额拆成 N 份”的算法，区别在随机分布。二倍均值法是顺序拆，每个红包的期望相等、方差递减。线段分割法是在 [0, 总额] 线段上随机切 N-1 刀，每段长度就是金额，每个红包的金额分布完全对称，是真正的“绝对公平”。抢红包里二倍均值因为“先抢更刺激”而被广泛采用，线段分割适合“必须严格公平”的场景（比如 AA 分账）。

## 关联

- 抽奖 / 中奖概率
- 秒杀系统
