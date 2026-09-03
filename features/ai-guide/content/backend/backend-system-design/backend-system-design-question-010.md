## 问题

电商下单超时关单（30 分钟未支付）。

## 考察点

- 延迟任务方案选型（Redis ZSet / RocketMQ 延迟消息 / 时间轮）
- 关单与支付回调的并发竞争、条件更新（状态机）与幂等

## 标准答案

### 核心思路

考点是海量订单里怎么可靠地实现“30 分钟后自动关单”这个延迟任务，并且和支付回调不打架。核心三件事：延迟触发的选型、关单与支付的并发竞争、幂等。

### 方案一：Redis ZSet 实现延迟队列（最常用、可扩展）

```java
@Service
public class OrderDelayService {

    @Autowired
    private StringRedisTemplate redis;
    @Autowired
    private OrderService orderService;

    private static final String DELAY_KEY = "order:delay:queue";

    // 下单时：把订单号加入延迟队列，score = 期望关单时间（毫秒时间戳）
    public void addDelayTask(long orderId, long delayMinutes) {
        long expireAt = System.currentTimeMillis() + delayMinutes * 60 * 1000;
        redis.opsForZSet().add(DELAY_KEY, String.valueOf(orderId), expireAt);
    }

    // 定时轮询：每秒扫一次，取出"到期"的订单执行关单
    @Scheduled(fixedDelay = 1000)
    public void scanAndClose() {
        long now = System.currentTimeMillis();
        Set<String> expired = redis.opsForZSet().rangeByScore(DELAY_KEY, 0, now, 0, 100);
        if (expired.isEmpty()) return;

        for (String orderId : expired) {
            // 关键：先尝试从 ZSet 移除，移除成功才处理，保证多实例下只被处理一次
            Long removed = redis.opsForZSet().remove(DELAY_KEY, orderId);
            if (removed != null && removed == 1) {
                orderService.closeOrder(Long.valueOf(orderId));
            }
        }
    }
}
```

```java
// 关单逻辑：带状态机和幂等保护
@Service
public class OrderService {

    @Autowired
    private JdbcTemplate jdbc;

    public void closeOrder(long orderId) {
        // 幂等 + 并发竞争：用"条件更新"保证只有"待支付"状态才能被关单
        int updated = jdbc.update(
            "UPDATE orders SET status = 'CLOSED' " +
            "WHERE id = ? AND status = 'WAIT_PAY'", orderId);

        if (updated == 1) {
            restoreStock(orderId);
            releaseCoupon(orderId);
        }
        // updated == 0 说明订单已支付或已关，什么都不做，这就是幂等
    }
}
```

### 方案二：RocketMQ 延迟消息（有 MQ 时的首选）

```java
@Service
public class OrderDelayMqService {

    @Autowired
    private RocketMQTemplate rocketMQTemplate;

    // 下单时：发一条延迟消息，30 分钟后投递给消费者
    public void sendDelayCloseMessage(long orderId) {
        Message<String> msg = MessageBuilder
            .withPayload(String.valueOf(orderId))
            .build();
        // delayLevel：RocketMQ 默认支持 1s~2h 的固定延迟等级，这里是第 16 级 ≈ 30 分钟
        rocketMQTemplate.syncSend("ORDER_CLOSE_TOPIC", msg, 3000, 16);
    }

    @RocketMQMessageListener(topic = "ORDER_CLOSE_TOPIC", consumerGroup = "order-close")
    public class OrderCloseConsumer implements RocketMQListener<String> {
        @Override
        public void onMessage(String orderId) {
            orderService.closeOrder(Long.valueOf(orderId));
        }
    }
}
```

### 方案三：时间轮（单机高性能延迟，Netty HashedWheelTimer 思路）

```java
public class TimeWheelDelayQueue {

    private final List<Set<Runnable>>[] wheel;
    private int currentSlot = 0;
    private final int slotCount;

    public TimeWheelDelayQueue(int slotCount) {
        this.slotCount = slotCount;
        this.wheel = new List[slotCount];
        for (int i = 0; i < slotCount; i++) wheel[i] = new ArrayList<>();
    }

    public void addTask(Runnable task, long delaySeconds) {
        int target = (currentSlot + (int) delaySeconds) % slotCount;
        wheel[target].add(task);
    }

    @Scheduled(fixedDelay = 1000)   // 每秒推进一格
    public void tick() {
        Set<Runnable> tasks = wheel[currentSlot];
        for (Runnable t : tasks) t.run();
        tasks.clear();
        currentSlot = (currentSlot + 1) % slotCount;
    }
}
```

要点提炼：ZSet 方案可扩展、可持久化、多实例安全（靠 remove 原子抢占）；RocketMQ 延迟消息最省心但延迟等级是固定的；时间轮单机性能最好但不持久化。关单本身用条件更新做状态机 + 幂等。

### 高频面试问题与口述答案

**Q1：实现“延迟任务”有哪几种方案？各自的优缺点？**

常见四种。数据库轮询：建一张延时任务表，定时扫，简单但轮询频繁、性能差。Redis ZSet：把任务放进有序集合，score 是期望执行时间，性能好、可持久化，是最常用的自研方案。消息队列延迟消息：RocketMQ 自带，最省心，但延迟等级固定。时间轮：单机内 O(1) 插入和触发，性能最高，但一般不持久化。

**Q2：Redis ZSet 实现延迟队列的原理？多实例部署下怎么保证一个任务只被处理一次？**

核心是用 ZSet 的原子 ZREM 抢占。多个实例都在轮询扫描到期的任务，如果一个实例直接 ZRANGE 取出来就执行，所有实例都会拿到同一批任务，重复执行。正确做法是扫描到到期任务后，先执行 ZREM 把它移除，只有移除成功的那个实例才真正处理。因为 ZREM 是原子的，同一个 member 只会被移除成功一次。

**Q3：RocketMQ 延迟消息的原理？它的延迟等级是什么？有什么局限？**

RocketMQ 的延迟消息不是真正“到了时间才投递”，而是先存起来、时间到了再投递。生产者指定延迟等级，Broker 收到后把消息放到内部延迟队列，后台定时器到时间后再搬到真实 topic 投递。局限有两个：一是延迟等级固定（1s 5s 10s 30s 1m … 2h 等 18 个档位），不能精确指定；二是延迟最大到 2 小时。

**Q4：时间轮的原理？为什么它比“每秒轮询数据库”高效？**

数据库轮询是每秒 `SELECT * WHERE expire_time <= now`，任务越多每次扫描越慢，而且大部分时候扫出来是空的。时间轮把时间轴切成槽，任务按“还有多少时间”直接落到对应槽，插入是 O(1)；每秒指针只推进一格，只处理当前格里的任务，处理也是 O(1)。

**Q5：关单和支付回调同时到达，怎么保证不重复扣库存、不出现“既支付又关单”？**

用订单状态机 + 条件更新。关单和支付回调都通过 `UPDATE ... WHERE id = ? AND status = '待支付'` 这种带状态条件的更新来抢占。数据库的行锁 + 条件更新保证同一时刻只有一个能成功——关单成功，支付回调再进来 WHERE 条件不命中，就触发退款；支付先成功，关单任务的 UPDATE 影响 0 行，就不回补库存。谁先抢到状态谁说了算，另一个做补偿。

**Q6：为什么关单要用“条件更新（状态机）”而不是先查再改？**

因为“先查再改”有并发窗口。先 SELECT 查状态是“待支付”，判断可以关，然后再 UPDATE，这两步之间支付回调可能已经把状态改成“已支付”了。条件更新把“判断状态”和“修改状态”合并成一条 UPDATE，数据库在行锁保护下原子完成。这是处理状态流转的通用原则：凡是“先判断再更新”的地方，都要考虑改成“条件更新”。

**Q7：延迟任务如果因为进程崩溃丢了怎么办？（持久化、可靠投递）**

RocketMQ 延迟消息天然持久化在 Broker，崩溃也不会丢。Redis ZSet 开了 AOF/RDB 持久化也不容易丢，但极端情况仍可能丢。时间轮完全在内存里，崩溃必丢。所以工程上要双保险：延迟队列是“快速路径”，另外在数据库里订单本身有“过期时间”字段，做一条兜底扫描。延迟队列负责及时，兜底扫描负责可靠。

**Q8：延迟队列的“轮询空转”问题怎么优化？**

空转就是每次扫都没有到期任务却还在不停扫。优化方向有两个：一是用阻塞替代轮询，比如 Redis 的 BZPOPMIN，没有到期任务时就阻塞等待；二是动态调整扫描间隔，算出“最近一个任务还有多久到期”。时间轮也是这个思路的极致。

**Q9：下单后 30 分钟这个延迟时间，如果用户中途支付了，延迟任务还需要执行吗？怎么取消？**

需要“不执行”或“执行了也没事”。两种处理：一是主动取消，支付成功时把订单从延迟队列 ZREM 掉；二是被动幂等，不取消，让关单任务照常触发，但关单逻辑用条件更新判断——发现状态已经是“已支付”，UPDATE 影响 0 行。工程上两者结合：主动取消减少无用任务，条件更新做最终兜底。

## 关联

- 接口幂等
- 抢红包
