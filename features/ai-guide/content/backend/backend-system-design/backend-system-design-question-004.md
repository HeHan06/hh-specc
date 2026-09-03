## 问题

如何设计一个消息队列组件。

## 考察点

- 消息不丢失（生产、存储、消费三环节）、重复、顺序、堆积、推拉、延迟、事务、高可用、底层存储
- Redis List 手写极简 MQ 与真实 MQ 的差距

## 标准答案

### 基于 Spring Boot 的最简编码实践

用 Redis 的 List 手写一个极简的 MQ，目的是让你直观看到「Topic、FIFO、阻塞消费」长什么样，同时暴露和真实 MQ 的差距。

#### 生产者组件

```java
@Component
public class MqProducer {
    private final StringRedisTemplate redis;

    public MqProducer(StringRedisTemplate redis) {
        this.redis = redis;
    }

    // LPUSH 左侧入队，配合消费者 BRPOP 右侧出队 → 实现 FIFO
    public void send(String topic, String message) {
        // 生产端给每条消息加唯一 ID，方便消费端做幂等去重
        String msgId = UUID.randomUUID().toString();
        String body = msgId + "|" + message;
        redis.opsForList().leftPush("mq:" + topic, body);
    }
}
```

#### 消费者组件

```java
@Component
public class MqConsumer {
    private final StringRedisTemplate redis;

    public MqConsumer(StringRedisTemplate redis) {
        this.redis = redis;
    }

    // BRPOP 阻塞式拉取：队列为空时阻塞挂起，不会空轮询打爆 CPU
    public String poll(String topic, long timeoutSec) {
        return redis.opsForList().rightPop("mq:" + topic, timeoutSec, TimeUnit.SECONDS);
    }
}
```

#### 对外入口和后台消费线程

```java
@RestController
public class MqDemoController {
    private final MqProducer producer;
    private final MqConsumer consumer;

    public MqDemoController(MqProducer producer, MqConsumer consumer) {
        this.producer = producer;
        this.consumer = consumer;
    }

    @PostMapping("/send")
    public String send(@RequestParam String topic, @RequestParam String msg) {
        producer.send(topic, msg);
        return "sent";
    }

    @PostConstruct
    public void startConsumer() {
        new Thread(() -> {
            while (true) {
                String msg = consumer.poll("order", 5); // 5 秒长轮询
                if (msg != null) {
                    System.out.println("消费到消息: " + msg);
                    // 真实 MQ 这里要「业务成功后才 ack/提交 offset」
                }
            }
        }, "mq-consumer").start();
    }
}
```

这段代码暴露的致命缺陷：rightpop 是取一条删一条，一旦消费者进程“取到信息后、处理完成前崩溃”，这条消息就永远丢失了；而且多条信息无法被多个消费者按消费组共享、也没有 offset 记录进度。真实 MQ 用「日志型存储 + offset 游标 + 手动 ack」解决这些问题。

### 高频面试追问与标准口述答案

**Q1：消息不丢失，怎么保证？（生产、存储、消费三个环节分别说）**

分三个环节看。生产端：要等 Broker 确认落盘成功才算发送成功，失败就重试，对应 Kafka 的 acks=all，或 RocketMQ 的「同步刷盘 + 主从同步复制」。Broker 存储端：消息必须持久化到磁盘，同步刷盘是写入后执行 fsync 才返回，可靠性最高但吞吐低；异步刷盘是写进 page cache 就返回，性能高但宕机可能丢最近几毫秒的消息。消费端：必须手动 ack——业务处理成功后再提交 offset，处理失败就不提交。

**Q2：消息重复了怎么办？为什么 MQ 不能保证“恰好一次”？**

MQ 本身只能保证「至少一次」（at least once），因为网络重试、消费者 rebalance、offset 提交失败都可能导致一条消息被投递多次。正确做法是消费端做幂等，把“至少一次”补成“恰好一次”的效果。常用三招：① 消息唯一 ID + 数据库唯一索引去重；② Redis setnx 做消费标记；③ 状态机，比如 `UPDATE ... WHERE status='待支付'` 天然幂等。

**Q3：消息顺序性怎么保证？全局有序和局部有序怎么选？**

全局有序几乎不现实，因为多分区必然并行，代价是要退化成单分区单消费者，吞吐会崩。工程上都是做局部有序：把同一业务实体的消息（比如同一个订单 id）通过哈希路由到同一个分区，分区内部严格有序，一个分区只配一个消费者。Kafka 用 key 做分区，RocketMQ 用 MessageQueueSelector 选队列。

**Q4：消费端堆积了怎么排查和解决？**

本质是消费速度 < 生产速度。分两步走：先排查瓶颈，是不是消费逻辑里有慢 SQL、同步调用了下游慢接口；再扩容，增加消费者数量，但消费者数量受分区数限制，分区数不够要先扩分区。还可以临时把积压消息转存到一个分区更多的新 topic。最后如果确实处理不过来，在生产端限流或降级。

**Q5：推模式（Push）和拉模式（Pull）怎么选？RocketMQ 的 push 是真 push 吗？**

纯 Push 的缺点是 Broker 不管消费者死活一直推，消费者处理慢就会被压垮；纯 Pull 的问题是消费者不知道什么时候有消息，只能空轮询。工程上的最佳实践是长轮询（Long Polling）：消费者发拉取请求，Broker 没有消息就先把请求挂住一段时间。RocketMQ 的“push 模式”本质上就是长轮询的 pull，只是 API 封装得像 push。

**Q6：延迟消息怎么实现？**

典型做法是延迟等级 + 定时投递。以 RocketMQ 为例：消息先不投给消费者，而是放进一个延迟队列（按延迟等级存），Broker 内部有一个定时器（时间轮）到期后，再把消息从延迟队列搬回真实的 topic 投递。底层常用时间轮（TimeWheel）算法，而不是简单 sleep 或定时扫全表。Kafka 本身不支持延迟消息，需要自己用时间轮 + 内部延迟队列实现。

**Q7：事务消息怎么实现？**

这是 RocketMQ 的招牌能力。流程是：先发一条半消息（Half Message）到 Broker，这条消息消费者暂时不可见；然后执行本地事务；本地事务成功就向 Broker 发 commit，失败就发 rollback。如果本地事务执行后进程崩溃一直没提交，Broker 会定时回查生产者的本地事务状态，决定这条半消息最终是投递还是丢弃。核心就三个词：半消息、本地事务、回查。

**Q8：Broker 怎么保证高可用？主从同步复制和异步复制的取舍？**

靠主从复制 + 故障切换。同步复制：主节点必须等从节点确认后才返回，强一致、不丢消息，但延迟高、吞吐低；异步复制：主节点写完就返回，性能好，但主挂的瞬间可能丢最后几条。Kafka 的做法是 ISR（in-sync replica）机制：维护一个“和主节点保持同步的副本集合”，acks=all 要求 ISR 里所有副本都确认。主从切换以前靠 Zookeeper，新版 Kafka 用 KRaft（Raft 协议）自管理元数据。

**Q9：底层存储为什么快？顺序写、零拷贝、分区是什么关系？**

三个关键词。顺序写：MQ 用的是 append-only 日志（RocketMQ 的 CommitLog），只追加、不修改、不随机写，磁盘顺序写速度接近内存。零拷贝：消息从磁盘到网卡，用 mmap 或 sendfile 直接从 page cache 到网卡，省掉两次上下文切换和两次拷贝。分区（Partition）：把一个 topic 的数据拆成多个分区，分布在不同磁盘和机器上，实现水平扩展和并行读写。顺序写保证单分区快，分区保证整体能横向扩展。

## 关联

- 消息队列面试问题集合（backend-mq）
- 分布式事务
