## 问题

分布式事务（下单扣库存跨服务）。

## 考察点

- TCC（Try/Confirm/Cancel）vs 本地消息表 + MQ 最终一致性 vs SAGA
- 选型的强一致 vs 最终一致权衡

## 标准答案

### 核心思路

考点是「跨多个独立数据库/服务，怎么保证"要么全成功、要么全回滚"」。本地事务靠单库 ACID 就够了，但下单要调三个微服务、各自有独立库，本地事务管不到跨库——这就是分布式事务的根因。工程解法分两条路：强一致（2PC/TCC，同步阻塞、实时可见，但性能差、侵入大）和最终一致（本地消息表/MQ 事务消息/SAGA，异步、解耦，但有短暂不一致窗口）。选型的本质是问业务：能不能容忍秒级不一致——能，走最终一致；不能（资金、库存），走 TCC。

### 方案一：本地消息表 + MQ 最终一致（最常用）

```java
// 订单服务：本地事务里同时写"订单"和"消息表"，保证两者原子
@Service
public class OrderService {

    @Autowired private OrderMapper orderMapper;
    @Autowired private MessageTableMapper msgMapper;

    @Transactional
    public void createOrder(OrderReq req) {
        // 1. 写订单
        orderMapper.insert(new Order(req));
        // 2. 写"待发消息"到本地消息表（同一事务，订单和消息要么都成要么都败）
        msgMapper.insert(new Msg("DEDUCT_STOCK", JSON.toJSONString(req), "PENDING"));
        // 关键：不在这里直接发 MQ！事务还没提交，发了会出现"消息已发但订单回滚"的脏消息
    }
}

// 定时任务：扫描"未发送"的消息，投递到 MQ，投递成功后标记已发
@Component
public class MsgPublisher {

    @Autowired private MessageTableMapper msgMapper;
    @Autowired private RocketMQTemplate mq;

    @Scheduled(fixedDelay = 1000)
    public void publish() {
        for (Msg m : msgMapper.selectByStatus("PENDING")) {
            try {
                mq.send("stock-topic", m.getPayload());
                msgMapper.markSent(m.getId());   // 标记已发，下次不再扫
            } catch (Exception e) {
                // 失败不标记，下次定时任务还会扫到，重发（消费者端必须幂等）
            }
        }
    }
}

// 库存服务：消费 MQ 扣库存，幂等防重复消费
@RocketMQMessageListener(topic = "stock-topic", consumerGroup = "stock-cg")
public class StockConsumer {

    @Autowired private StockMapper stockMapper;
    @Autowired private StringRedisTemplate redis;

    public void onMessage(String payload) {
        DeductReq req = JSON.parseObject(payload, DeductReq.class);
        // 幂等去重（见第 13 题）：同一 msgId 只消费一次
        Boolean first = redis.opsForValue()
            .setIfAbsent("stock:dedup:" + req.getMsgId(), "1", Duration.ofDays(1));
        if (!Boolean.TRUE.equals(first)) return;
        stockMapper.deduct(req.getSkuId(), req.getQty());
    }
}
```

要点：订单和消息表在同一个本地事务，保证"订单写成功"和"有消息要发"原子绑定。投递失败定时重试，消费端幂等，最终库存一定扣掉——这就是"最终一致"。

### 方案二：RocketMQ 事务消息（省掉消息表）

```java
// 事务消息：半消息 + 本地事务执行 + 回查机制
@Service
public class OrderTxService {

    @Autowired private RocketMQTemplate mq;

    public void createOrder(OrderReq req) {
        Message<String> msg = MessageBuilder.withPayload(JSON.toJSONString(req)).build();
        // 1. 先发"半消息"：broker 收到但不投递给消费者
        // 2. 半消息发送成功后，执行本地事务（写订单）
        // 3. 本地事务成功 → commit 半消息（消费者可见）；失败 → rollback（消费者不可见）
        mq.sendMessageInTransaction("stock-topic", msg, req);
    }

    // 事务监听器：执行本地事务 + 回查
    @RocketMQTransactionListener
    public class OrderTxListener implements RocketMQLocalTransactionListener {

        @Autowired private OrderService orderService;
        @Autowired private OrderMapper orderMapper;

        @Override
        public RocketMQLocalTransactionState executeLocalTransaction(Message msg, Object arg) {
            try {
                orderService.createOrder((OrderReq) arg);   // 本地写订单
                return RocketMQLocalTransactionState.COMMIT;     // 成功 → 提交半消息
            } catch (Exception e) {
                return RocketMQLocalTransactionState.ROLLBACK;    // 失败 → 回滚半消息
            }
        }

        @Override
        public RocketMQLocalTransactionState checkLocalTransaction(Message msg) {
            // 回查：如果 broker 收不到 commit/rollback（比如应用挂了），主动回来问"这笔订单到底成没成"
            OrderReq req = JSON.parseObject(new String(msg.getBody()), OrderReq.class);
            return orderMapper.existsByOrderNo(req.getOrderNo())
                ? RocketMQLocalTransactionState.COMMIT
                : RocketMQLocalTransactionState.ROLLBACK;
        }
    }
}
```

和方案一比，省掉了本地消息表和定时扫描——broker 的回查机制替代了"扫表重发"。但前提是必须用 RocketMQ，且业务要有"回查接口"（能根据消息体查到本地事务到底成没成）。

### 方案三：TCC（Try-Confirm-Cancel，强一致）

```java
// TCC：业务自己实现三个方法，框架（Seata）负责协调
// Try：冻结资源（预扣库存、预扣余额），不动总量只挪到"冻结"字段
// Confirm：真正扣减（把冻结转成实际扣减）
// Cancel：解冻（把预扣的还回去）

@LocalTCC
public interface StockTccAction {

    // @TwoPhaseBusinessAction 声明这是一个 TCC 接口，commitMethod/rollbackMethod 指定二阶段方法
    @TwoPhaseBusinessAction(name = "deductStock",
            commitMethod = "confirm",
            rollbackMethod = "cancel")
    boolean prepare(BusinessActionContext ctx,
                    @BusinessActionContextParameter("skuId") Long skuId,
                    @BusinessActionContextParameter("qty") int qty);

    boolean confirm(BusinessActionContext ctx);
    boolean cancel(BusinessActionContext ctx);
}

// 业务表设计：total = available + frozen（总量 = 可用 + 冻结）
// CREATE TABLE stock (sku_id BIGINT, available INT, frozen INT DEFAULT 0);

// Try：从 available 挪到 frozen（预占，总量不变）
//   UPDATE stock SET available = available - ?, frozen = frozen + ?
//   WHERE sku_id = ? AND available >= ?;
// Confirm：从 frozen 扣掉（总量减少，真正的扣库存）
//   UPDATE stock SET frozen = frozen - ? WHERE sku_id = ?;
// Cancel：从 frozen 还回 available（解冻，恢复可用）
//   UPDATE stock SET frozen = frozen - ?, available = available + ? WHERE sku_id = ?;

// TM（事务发起方）开启全局 TCC 事务
@GlobalTransactional
public void placeOrder(OrderReq req) {
    orderService.create(req);
    stockTccAction.prepare(null, req.getSkuId(), req.getQty());  // 各服务 Try
    accountTccAction.prepare(null, req.getUserId(), req.getAmount());
    // 全部 Try 成功 → 框架自动调各服务的 Confirm
    // 任一 Try 失败   → 框架自动调已 Try 成功服务的 Cancel
}
```

要点：TCC 的精髓是"预留资源"——Try 只冻结不真扣，Confirm 才真扣，Cancel 解冻。所以即使 Cancel 失败重试，也只是"把冻结还回去"，不会出现"扣了库存又还回去但中间被别人抢了"的问题。代价是业务侵入大：每个动作要写三份逻辑，且要加"冻结字段"这种业务模型改造。

### 高频面试问题与口述答案

**Q1：为什么会有分布式事务？本地事务为什么不行？**

本地事务解决"单个数据库内多个操作要么全成要么全败"，靠数据库 ACID，事务边界在单库内。微服务架构下一次下单要调订单、库存、账户服务，各自有独立数据库——跨了库，本地事务的 redo/undo 就管不到了。订单写成功但调库存超时，库存到底扣没扣不知道。分布式事务就是为解决"跨多个独立资源的一致性"而生。核心矛盾：每个资源自己有事务，但没有全局协调者能同时管多个资源。方案本质都是"加一个全局协调者"，区别只是协调方式不同——2PC 同步锁住所有资源，TCC 业务层预留资源，最终一致异步重试。

**Q2：CAP 和 BASE 是什么？和分布式事务什么关系？**

CAP 是分布式系统的三个特性：一致性（C）、可用性（A）、分区容错（P），三选二。网络分区（P）不可避免，所以实际是在 C 和 A 之间选——CP 系统优先一致（ZooKeeper、etcd），AP 系统优先可用（Eureka）。分布式事务选型就是在 CAP 之间做权衡：2PC/TCC 选 C（强一致，牺牲可用性和性能），本地消息表/SAGA 选 A（最终一致，保证可用）。BASE 是 AP 路线的实践指南：基本可用、软状态、最终一致。强一致方案是"同步阻塞换 C"，最终一致方案是"异步重试换 A + E"。

**Q3：2PC 是什么？为什么生产很少用？**

两阶段提交：第一阶段 Prepare，协调者问所有参与者"能不能提交"，参与者锁资源、写 undo log，回复 yes/no；第二阶段 Commit/Rollback，全 yes 就 commit，任一 no 就全部 rollback。三个致命问题：同步阻塞（Prepare 后所有参与者锁资源直到第二阶段，链路卡死）；协调者单点（协调者挂了参与者一直锁着等待，陷入死锁）；数据不一致（Commit 阶段部分参与者提交、部分没收到，出现部分提交）。XA 协议（MySQL 支持）就是 2PC 实现，但性能损耗大，互联网高并发基本不用，只在传统金融同库跨表、低并发场景见得到。

**Q4：TCC 的原理？Try/Confirm/Cancel 各做什么？**

TCC 是"业务层面的两阶段提交"，把 2PC 的"锁资源"换成"业务预留"。Try 做资源预留——扣库存不是真扣，而是把 available 挪一部分到 frozen（预占），总量不变；Confirm 做真正提交——把 frozen 转成实际扣减；Cancel 做取消预留——把 frozen 还回 available。和 2PC 核心区别：2PC 靠数据库锁资源，TCC 靠业务字段预留资源。好处是不锁数据库、并发高、能跨不同类型资源；代价是业务侵入大（每个动作写三份代码 + 改造数据模型加 frozen 字段）。适合扣库存、扣余额、扣积分这种强一致 + 高并发的核心交易场景。

**Q5：TCC 的三大难题？怎么解决？**

三个经典问题。一是空回滚：Try 还没执行 Cancel 先到了（Try 超时 TM 以为失败发了 Cancel）。解法是记录事务状态——Cancel 前查 Try 有没有执行过，没执行过直接返回成功。二是幂等：Confirm/Cancel 都可能被重试，重复执行会出问题（解冻两次 available 多了）。解法是用全局事务 ID 做幂等键，执行前查"这个 xid 是不是处理过"。三是悬挂：Cancel 先到、Try 后到，Try 执行了资源预留但永远等不到 Confirm/Cancel。解法也是靠事务状态——Try 前查"是不是已经 Cancel 过了"，是的话拒绝 Try。三个难题本质都是"网络异常导致顺序错乱"，统一解法：用一张"事务状态表"记录每个 xid 的进度，所有动作执行前先查状态。

**Q6：本地消息表怎么实现最终一致？为什么不丢消息？**

把"发消息"和"本地事务"绑定。订单服务在本地事务里同时写订单和消息表（两张表同一库，一个事务），保证"订单成功"和"有消息待发"原子绑定。定时任务扫描消息表，把未发的消息投递到 MQ，投递成功标记已发。消费者幂等消费。不丢消息的保证链：消息表和订单在本地事务原子写入（不会"订单成功消息没记录"）；定时任务只要没标记已发就重试（不会忘记发）；MQ 有持久化和 ACK（不会发了 MQ 丢）；消费者幂等（不会重复消费出问题）。本质是把分布式事务降级成"本地事务 + 可靠异步重试"，牺牲实时一致性换可用性和解耦。

**Q7：RocketMQ 事务消息原理？和本地消息表比有什么优势？**

用"半消息 + 回查"替代本地消息表。流程：先发半消息（broker 收到但不投递给消费者），半消息成功后执行本地事务，成功 commit 半消息（消费者可见）、失败 rollback（消费者不可见）。broker 收不到 commit/rollback（应用挂了）就定期回查生产者"这笔事务到底成没成"，生产者查本地 DB 返回结果。优势是省掉消息表和定时扫描——回查机制替代扫表重发，架构更轻。劣势是强依赖 RocketMQ（Kafka 没有事务消息），且必须实现回查接口。两者本质都是"本地事务 + 可靠投递"。

**Q8：SAGA 适合什么场景？和 TCC 的区别？**

SAGA 适合长事务、跨多服务的场景，比如"订机票 → 订酒店 → 租车 → 扣款"这种链路长、每步耗时的流程。原理是把长事务拆成一串本地事务，每步都有一个补偿动作，任一步失败就反向执行已完成步骤的补偿。和 TCC 的核心区别：TCC 是"预留资源"（Try 先占住），SAGA 是"直接做 + 失败补偿"（没有预留，直接真扣库存，失败再补偿回去）。TCC 资源一直被预留，并发性差但强一致；SAGA 资源不被预留，并发好但中间态可见。所以 TCC 适合短链路强一致，SAGA 适合长链路最终一致。

**Q9：Seata AT 模式原理？和 TCC 的区别？为什么"无侵入"？**

AT 模式（Auto Transaction）核心是用 undo_log 自动反向补偿，业务代码只加 @GlobalTransactional 注解，不用写 Try/Confirm/Cancel。流程：执行业务 SQL 前 Seata 拦截并生成 undo_log（记录修改前后的快照）；任一服务失败，全局回滚时 Seata 根据 undo_log 自动执行反向 SQL 恢复数据。和 TCC 的区别：TCC 是业务层两阶段（自己写三个方法），AT 是框架层自动补偿（业务无感），所以叫"无侵入"。代价是 AT 只支持关系型数据库（要解析 SQL 生成 undo_log），且全局锁期间性能不如 TCC。

**Q10：生产怎么选型？强一致 vs 最终一致怎么权衡？**

就问一个问题：业务能不能容忍秒级不一致。能容忍就走最终一致（本地消息表/MQ 事务消息），解耦、性能好、可用性高；不能容忍（资金、库存、核心交易）就走 TCC。具体经验：核心交易链路（下单扣库存、支付扣余额）用 TCC；非核心异步动作（下单后发券、加积分、通知）用本地消息表 + MQ；长流程业务编排（旅游预订、跨多供应商）用 SAGA。绝少用 2PC/XA——性能太差。能用最终一致就不用强一致，强一致方案复杂度和故障率都高。无论哪种方案，消费端必须幂等、必须有监控告警、必须有人工补偿入口。

## 关联

- 接口幂等
- 分库分表后的查询
