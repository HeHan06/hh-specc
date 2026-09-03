## 问题

订单状态机消息处理项目代码实践题。背景：你负责开发电商系统的订单履约消费者服务，该服务需要消费 order-topic 中的订单状态变更消息，并更新数据库中的订单状态。Topic 共有 4 个分区；状态机规则不可逆，必须严格按顺序流转：CREATED(1) -> PAID(2) -> SHIPPED(3) -> COMPLETED(4)，CREATED(1) -> CANCELLED(4)。需求：保证同一订单消息严格按顺序消费、高吞吐多线程并行、幂等、失败隔离、失败补偿。请用 Spring Boot + Kafka 实现。

## 考察点

- Kafka 按 Key 路由与顺序保证（max.in.flight）
- 内存队列分拣兼顾顺序与吞吐、幂等（Redis + 唯一索引）、异常隔离与补偿

## 标准答案

### 消息体（JSON 格式）

```json
{
  "orderId": "ORD_123456",
  "eventType": "PAID",  // 枚举: CREATED, PAID, SHIPPED, COMPLETED, CANCELLED
  "timestamp": 1698765432000,
  "operator": "system"
}
```

状态机规则（不可逆，必须严格按顺序流转）：

- `CREATED(1) -> PAID(2) -> SHIPPED(3) -> COMPLETED(4)`
- `CREATED(1) -> CANCELLED(4)`（取消可在创建后随时发生，但必须保证取消前的状态 < 取消状态，即状态码从 1 跳到 4 是合法的；但如果已经是 PAID，不能回退到 CREATED，也不能从 PAID 跳转到 COMPLETED）

### 1）生产者配置（确保按 Key 路由）

为保证同一个订单进入同一分区，生产者发送时必须指定 orderId 作为 Key。

```java
@Service
public class OrderEventProducer {
    @Autowired
    private KafkaTemplate<String, String> kafkaTemplate;

    public void sendOrderEvent(OrderEvent event) {
        // 关键：用 orderId 作为 Key，保证同一订单消息进同一分区
        kafkaTemplate.send("order-topic", event.getOrderId(), JSON.toJSONString(event));
    }
}
```

生产端配置（application.yml）：为防重试导致乱序，必须限制 max.in.flight 为 1。

```yaml
spring:
  kafka:
    producer:
      retries: 3
      properties:
        max.in.flight.requests.per.connection: 1  # 关键！防止重试导致消息顺序颠倒
```

### 2）消费者配置与核心监听器

#### 2.1）配置消费并发（Concurrency）

为了高吞吐，设置并发数等于分区数（4 个线程）。

```yaml
spring:
  kafka:
    consumer:
      group-id: order-履约-group
      auto-offset-reset: earliest
      enable-auto-commit: false  # 手动提交
    listener:
      concurrency: 4  # 4个消费者线程，对应4个分区
      ack-mode: manual  # 手动确认
```

#### 2.2）核心消费者逻辑（包含幂等 + 异常隔离 + 内存队列分拣）

关键设计：虽然 Kafka 保证同一个分区只分配给一个消费者线程，但为了高吞吐，通常消费者内部会启用业务线程池。此时必须使用内存队列分拣，保证同一订单被同一个单线程处理器串行处理。如果直接丢给业务线程池，顺序必乱。

```java
@Component
public class OrderEventConsumer {

    // 内存队列分拣：每个订单号绑定一个独立的阻塞队列
    private final Map<String, BlockingQueue<OrderEvent>> orderQueueMap = new ConcurrentHashMap<>();
    // 每个订单号绑定一个单线程处理器（实际生产中使用线程池管理，这里简化为Map<订单号, 单线程Executor>）
    private final Map<String, ExecutorService> orderExecutorMap = new ConcurrentHashMap<>();

    private final OrderService orderService;

    @Autowired
    public OrderEventConsumer(OrderService orderService) {
        this.orderService = orderService;
    }

    @KafkaListener(topics = "order-topic", groupId = "order-履约-group")
    public void onMessage(ConsumerRecord<String, String> record, Acknowledgment ack) {
        // 1. 解析消息
        OrderEvent event = JSON.parseObject(record.value(), OrderEvent.class);
        String orderId = event.getOrderId();

        // 2. 幂等性快速过滤（Redis去重，短窗口防重）
        if (orderService.isDuplicate(orderId, event.getEventType())) {
            ack.acknowledge();  // 直接确认，跳过
            return;
        }

        // 3. 路由到内存队列（保证同一订单串行，不同订单并行）
        BlockingQueue<OrderEvent> queue = orderQueueMap.computeIfAbsent(orderId,
            k -> new LinkedBlockingQueue<>());

        // 4. 提交到该订单专属的消费线程（懒加载）
        ExecutorService executor = orderExecutorMap.computeIfAbsent(orderId,
            k -> Executors.newSingleThreadExecutor(r -> new Thread(r, "order-process-" + orderId)));

        // 将任务放入队列，让单线程拉取处理
        executor.submit(() -> {
            try {
                // 实际处理业务（带状态机校验 + 幂等插入）
                orderService.processOrderEvent(event);

                // 处理成功后，记录幂等标记（Redis/DB）
                orderService.recordIdempotent(event);

            } catch (Exception e) {
                log.error("订单 {} 处理失败: {}", orderId, e.getMessage());
                // ⚠️ 关键：异常隔离，不抛出异常，不影响后续消息消费
                // 将失败消息发送到 死信/重试 Topic 或存入本地补偿表
                orderService.sendToCompensate(event);
            }
        });

        // 5. 提交Offset（手动确认）
        // 注意：这里立即提交offset可能会导致消息丢失？不会，因为如果业务未完成服务重启，内存队列里的任务会丢失。
        // 实际生产需结合本地事务表或采用"先处理业务再提交offset"的策略。
        // 但为了高吞吐且不阻塞顺序，通常依赖下游补偿表兜底。
        ack.acknowledge();
    }
}
```

⚠️ 踩坑警告：上面的 executor.submit 提交后立即 ack.acknowledge()，如果服务在这时重启，内存队列中的任务会丢失。生产级优化：必须在业务处理成功后才提交 Offset，或者在处理前先持久化本地任务表（本地消息表），结合定时任务补偿。

### 3）幂等实现（Redis + 数据库唯一索引双保险）

```java
@Service
public class OrderServiceImpl implements OrderService {

    @Autowired
    private OrderMapper orderMapper;
    @Autowired
    private StringRedisTemplate redisTemplate;

    @Override
    public boolean isDuplicate(String orderId, String eventType) {
        // 快速去重：利用 Redis SETNX，过期时间设为 1小时（业务重试窗口）
        String key = "idempotent:" + orderId + ":" + eventType;
        Boolean set = redisTemplate.opsForValue().setIfAbsent(key, "1", 1, TimeUnit.HOURS);
        // 如果已存在，说明是重复消息
        return Boolean.FALSE.equals(set);
    }

    @Override
    @Transactional
    public void processOrderEvent(OrderEvent event) {
        // 1. 查询当前订单状态（加行锁 SELECT FOR UPDATE）
        Order order = orderMapper.selectForUpdate(event.getOrderId());

        // 2. 状态机校验（确保流转合法）
        if (!isValidTransition(order.getStatus(), event.getEventType())) {
            throw new IllegalStateException("非法状态流转: " + order.getStatus() + " -> " + event.getEventType());
        }

        // 3. 更新状态
        order.setStatus(event.getEventType());
        order.setUpdateTime(new Date());
        orderMapper.update(order);
    }

    @Override
    public void recordIdempotent(OrderEvent event) {
        // 存入幂等记录表（唯一键：order_id + event_type）
        // INSERT INTO idempotent_record (order_id, event_type, processed_time) VALUES (..., ..., ...)
        // 利用数据库唯一索引做最后的兜底拦截
    }

    @Override
    public void sendToCompensate(OrderEvent event) {
        // 存入本地补偿表或发送到 order-retry-topic 供重试
        kafkaTemplate.send("order-retry-topic", event.getOrderId(), JSON.toJSONString(event));
    }
}
```

幂等表 SQL：

```sql
CREATE TABLE idempotent_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id VARCHAR(32) NOT NULL,
    event_type VARCHAR(20) NOT NULL,
    processed_time DATETIME,
    UNIQUE KEY uk_order_event (order_id, event_type)  -- 核心：唯一索引
);
```

### 4）异常隔离与补偿机制

- 隔离：processOrderEvent 抛异常时，不向上抛出，而是截获后发送到重试 Topic 或存入数据库补偿表，主消费线程继续处理下一条消息。
- 补偿定时任务：每分钟扫描补偿表或消费 order-retry-topic，重试次数超过 3 次则告警人工介入。

```java
@Component
public class CompensateJob {
    @Scheduled(fixedDelay = 60000)
    public void retryFailedOrders() {
        List<OrderEvent> retryList = compensateMapper.selectRetryList();
        for (OrderEvent event : retryList) {
            try {
                orderService.processOrderEvent(event);
                compensateMapper.delete(event.getId());
            } catch (Exception e) {
                // 增加重试次数，达到上限发钉钉告警
            }
        }
    }
}
```

### 给面试官的满分总结话术

“针对这个需求，我采取了四层防护策略：

- 顺序保证：生产端用 orderId 作为 Key 路由到同一分区，消费端利用内存队列+单线程 Executor 确保同一订单串行处理，不同订单并发处理，兼顾顺序与吞吐。
- 幂等拦截：前置用 Redis SETNX 做快速防重，数据库用 (order_id, event_type) 唯一索引做最终兜底，双重保障。
- 异常隔离：消费者捕获业务异常不抛出，防止该订单后续消息被阻塞，将失败消息转入重试队列或补偿表。
- 最终一致性：通过定时任务或重试 Topic 进行异步补偿，配合监控告警，确保所有异常数据最终被修复。”

## 关联

- 消息队列如何保证消息有序消费
- 消息队列如何处理重复消费和幂等
