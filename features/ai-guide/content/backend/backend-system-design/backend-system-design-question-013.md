## 问题

接口幂等（重复提交 / MQ 重复消费 / 重试）。

## 考察点

- 三种重复来源（用户重复提交、网络重试、MQ 重复投递）
- 三道防线：唯一索引（DB 兜底）、token/唯一键（入口防重）、状态机（状态不可逆）

## 标准答案

### 核心思路

考点是「同一个请求被执行多次，结果必须和只执行一次完全一样」。核心是分清三种重复来源，以及三道防线：唯一索引（DB 兜底）、token/唯一键（入口防重）、状态机（状态不可逆）。

### 场景一：用户重复提交订单（token 防重 + 唯一索引兜底）

```java
// 1. 下单前先领一个"防重 token"，提交时带上；服务端用 SETNX 保证同一 token 只消费一次
@RestController
public class OrderController {

    @Autowired
    private StringRedisTemplate redis;
    @Autowired
    private OrderService orderService;

    // 前端进入下单页时调用，领取 token
    @GetMapping("/order/token")
    public String getToken(@RequestParam Long userId) {
        String token = UUID.randomUUID().toString();
        redis.opsForValue().set("order:token:" + userId, token, Duration.ofMinutes(30));
        return token;
    }

    // 提交订单：用 token 防重复点击
    @PostMapping("/order/submit")
    public String submit(@RequestBody OrderSubmitReq req) {
        // 关键：SETNX 原子判断 + 删除 token，保证同一 token 只能通过一次
        String tokenKey = "order:token:" + req.getUserId();
        Boolean first = redis.opsForValue()
            .setIfAbsent("order:submit:" + req.getToken(), "1", Duration.ofMinutes(30));
        if (!Boolean.TRUE.equals(first)) {
            return "请勿重复提交";
        }

        // 真正下单（内部还有唯一索引兜底，见下）
        return orderService.createOrder(req);
    }
}
```

```java
// 2. 唯一索引兜底：数据库层面保证"订单号"只存在一条，重复插入直接失败
@Service
public class OrderService {

    @Autowired
    private OrderMapper orderMapper;

    @Transactional
    public String createOrder(OrderSubmitReq req) {
        String orderNo = generateOrderNo(req);   // 业务侧生成的全局唯一订单号

        try {
            orderMapper.insert(new Order(orderNo, req.getUserId(), ...));
        } catch (DuplicateKeyException e) {
            // 命中唯一索引：说明这个订单号已经存在，直接返回已有结果，而不是报错
            return "订单已存在，请勿重复提交";
        }
        return "下单成功：" + orderNo;
    }
}
```

```sql
-- 唯一索引：数据库层面的最后一道防线
ALTER TABLE t_order ADD UNIQUE KEY uk_order_no (order_no);
```

### 场景二：MQ 重复消费（消费端幂等）

```java
// MQ 消费端：消费前用 SETNX 做"消费去重"，保证同一条消息只处理一次
@Component
public class PayCallbackConsumer {

    @Autowired
    private StringRedisTemplate redis;
    @Autowired
    private OrderService orderService;

    @RabbitListener(queues = "pay.callback")
    public void onMessage(PayCallbackMsg msg) {
        String dedupKey = "pay:dedup:" + msg.getMsgId();   // msgId 是消息全局唯一 ID

        // SETNX 原子去重：只有第一次消费能成功标记，后续重复投递直接跳过
        Boolean first = redis.opsForValue().setIfAbsent(dedupKey, "1", Duration.ofHours(24));
        if (!Boolean.TRUE.equals(first)) {
            return;   // 重复消息，直接丢弃
        }

        // 真正的业务处理：把订单标记为已支付
        orderService.markPaid(msg.getOrderNo());
    }
}
```

### 场景三：状态机防重（支付状态不可逆）

```java
// 状态机：用"条件更新"保证状态只能单向流转，重复回调不会二次生效
@Mapper
public interface OrderMapper {

    // 关键：WHERE status = '待支付' 才更新，影响行数为 0 说明状态已经被改过（重复回调）
    @Update("UPDATE t_order SET status = '已支付', pay_time = now() " +
            "WHERE order_no = #{orderNo} AND status = '待支付'")
    int markPaid(String orderNo);
}

// 使用方：根据影响行数判断是"首次成功"还是"重复回调"
// int rows = orderMapper.markPaid(orderNo);
// rows == 1 -> 首次成功，发后续动作；rows == 0 -> 重复回调，直接忽略
```

### 高频面试问题与口述答案

**Q1：什么是幂等？为什么需要？**

幂等是指同一个操作执行一次和执行多次，产生的效果完全一样。它解决的核心问题是"重复"——分布式系统里重复几乎不可避免：用户手抖连点两次、网络超时客户端重试、MQ 消费失败重投、定时任务重跑。没有幂等保护就会造成重复扣款、重复下单、重复发券。本质是：系统无法阻止请求重复到达，只能让重复到达的请求不产生额外副作用。

**Q2：重复提交的常见场景？**

归纳成四类。一是用户侧重复：前端没做防抖，用户狂点提交按钮。二是网络重试：客户端请求超时后自动重试，但服务端其实已经处理成功，只是响应丢了。三是 MQ 重复投递：消费失败后重试，或网络闪断导致消息投递两次。四是定时任务重跑：任务执行到一半挂了，下次启动又从头执行。共同点是服务端无法靠"前端限制"杜绝，必须在服务端做幂等。

**Q3：token 防重怎么做的？**

核心是"一次性的令牌"。前端进入下单页时先领一个 token（存 Redis），提交订单时带上；后端用 SETNX 原子地"消费"这个 token——SETNX 保证同一个 token 只有第一次能标记成功，第二次及以后都失败。SETNX 的原子性很关键：并发下两个相同 token 同时到达，Redis 单线程保证只有一个能 setIfAbsent 成功。本质是用 Redis 的原子性，把"判断是否处理过"和"标记已处理"合并成一个不可分割的动作。

**Q4：唯一索引兜底为什么最可靠？**

因为它是数据库层面的约束，不依赖应用逻辑、不依赖 Redis、不依赖任何中间件。原理是给"业务唯一键"（订单号、用户+活动 ID）建唯一索引，重复插入时数据库直接抛 DuplicateKeyException，在最后一道防线上杜绝重复数据。数据库的 ACID 特性保证唯一约束在任何并发下都成立，即使应用代码写错、Redis 挂了、消息重复了，只要数据要落库就逃不过唯一索引。涉及资金的接口，唯一索引是必须的兜底，Redis token 只是"提前拦截、减少无效请求"。

**Q5：MQ 消费怎么幂等？**

用消费去重 key。利用消息本身携带的全局唯一 ID（msgId），消费端处理前先 SETNX 一个 dedup:msgId 标记，第一次消费成功标记，后续重复投递直接跳过。要分清两种语义："恰好一次"消费（RocketMQ 靠 offset + 事务消息尽量保证，但不绝对）和"至少一次"消费（默认，重复投递是常态），所以消费端必须自己幂等。去重 key 一般用业务唯一键 + msgId 组合。核心思想是把"消费过了"这个事实持久化，让重复投递变成 no-op。

**Q6：状态机怎么实现幂等？**

用条件更新（乐观锁）而不是"先查再改"。以支付为例：订单状态只能从"待支付"→"已支付"单向流转。更新时 SQL 带上前置条件 WHERE status = '待支付'，只有满足前置状态才更新，影响行数为 1；重复回调时状态已是"已支付"，WHERE 不命中，影响行数为 0，天然拦截。不用"先查再改"是因为查和改之间有时间窗，两个并发请求都查到"待支付"就都执行更新。条件更新把状态前置条件写进 SQL，让数据库的原子性保证状态流转只发生一次。

**Q7：token、唯一索引、状态机分别在什么层面？都要用吗？**

三层纵深防御，作用层面不同。token 在入口层，作用提前拦截，把大部分重复请求挡在业务逻辑外，但依赖 Redis，挂了或 token 过期就失效。唯一索引在数据层，作用最终兜底，任何重复最终都会在落库时被拦截，最可靠但拦截时机最晚。状态机在业务层，作用状态不可逆，适用有明确状态流转的场景。不一定要全用：只读查询天然幂等不用做；创建订单接口 token + 唯一索引就够；支付回调状态机最合适。原则是按资金/状态敏感度分层加码，不是无脑堆。

**Q8：幂等键怎么设计？业务键 vs 技术键？**

业务幂等键是业务上天然唯一的字段，比如订单号、用户 ID + 活动 ID、手机号 + 券批次，由业务语义决定，是唯一索引的候选。技术幂等键是为这次请求临时生成的唯一标识，比如前端领的 token、客户端 requestId、MQ 的 msgId，和技术流程绑定，生命周期短。能用业务键就用业务键（天然跨请求、跨系统稳定），业务键不存在时（纯动作类请求）再用技术键。核心是选一个能"唯一标识这次业务动作"的字段。

**Q9：Redis 幂等键过期了，还能保证幂等吗？**

不能完全保证，这正是 Redis 做幂等的边界。Redis key 有 TTL，token 过期后重试会再次成功导致重复。所以 Redis 只能做"短时间窗口"的幂等（拦截高频重复），不能做"永久幂等"。要永久幂等必须靠数据库唯一索引——没有过期概念，只要数据在约束就在。正确组合是：Redis token 负责秒级~分钟级防重，唯一索引负责永久兜底。幂等的最终保障一定在数据库，Redis 只是缓存层的前置拦截。

**Q10：支付回调为什么状态机比 token 更合适？**

因为支付回调的重复不是"同一时间连点"，而是跨时间的重试（回调失败后渠道会在几分钟、几小时后再次回调）。token 是"一次性令牌"，只适合拦截短时间内的重复点击，不适合跨小时的重复。状态机（WHERE status='待支付' 条件更新）天然适合有状态流转的场景——不管重试多少次、间隔多久，只要状态已是"已支付"，条件更新就永远影响 0 行。状态机还表达业务语义，把"只能从待支付变已支付"这条规则固化在 SQL 里。有状态流转用状态机，无状态动作用 token/唯一键。

### 补充：SETNX 的边界——为什么资金幂等不能只靠它

SETNX 是"最常见"的去重工具，但不是"最佳实践"的代名词。它有三个缺陷，决定它只能做"前置加速"，不能做"最终保障"：

1. 标记与业务非原子：SETNX 成功和业务真正成功之间隔着业务逻辑。若业务失败/崩溃/事务回滚，去重标记还在，后续重试会被一直挡掉——请求被"吞"了，业务永远无法补偿。
2. 有 TTL：Redis key 会过期，过期后重复请求又能通过，只能做短窗口防重。
3. 依赖 Redis 可用性：Redis 挂了，防重直接失效。

## 关联

- 分布式事务
- 分库分表后的查询
