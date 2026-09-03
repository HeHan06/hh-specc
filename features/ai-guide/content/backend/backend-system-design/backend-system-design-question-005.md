## 问题

如何设计并实现一个 RPC 框架。

## 考察点

- 动态代理、序列化、反射三大核心
- 协议帧设计、注册中心、负载均衡、超时重试幂等、连接管理、粘包拆包、IO 模型

## 标准答案

### 核心思路

RPC 框架本质上解决一个问题：把“调用远程方法”伪装成“调用本地方法”。最小实现只需要三块：动态代理（拦截调用）、序列化（传输数据）、反射（服务端执行）。

### SpringBoot 最小编码实例

```java
// 1. 共享接口：服务端和客户端都依赖，这是"契约"
public interface UserService {
    User getUser(Long id);
}
```

```java
// 2. 请求/响应协议体
public class RpcRequest {
    private String className;      // 接口名，如 com.xxx.UserService
    private String methodName;     // 方法名
    private String[] paramTypes;   // 参数类型名
    private Object[] args;         // 实参
}
public class RpcResponse {
    private Object result;
    private String error;          // 异常信息
}
```

```java
// 3. 服务端：暴露 HTTP 端点，按类名+方法名反射调用本地实现
@RestController
public class RpcServerController {
    @Autowired
    private Map<String, Object> serviceBeans;

    @PostMapping("/rpc")
    public RpcResponse invoke(@RequestBody RpcRequest req) {
        RpcResponse resp = new RpcResponse();
        try {
            Object service = serviceBeans.get(req.getClassName());
            Class<?>[] types = resolveTypes(req.getParamTypes());
            Method method = service.getClass().getMethod(req.getMethodName(), types);
            resp.setResult(method.invoke(service, req.getArgs()));
        } catch (Exception e) {
            resp.setError(e.getMessage());
        }
        return resp;
    }
}
```

```java
// 4. 客户端：JDK 动态代理，把接口方法调用拦截成一次 HTTP 请求
public class RpcClient {
    public static <T> T create(Class<T> clazz) {
        return (T) Proxy.newProxyInstance(
            clazz.getClassLoader(),
            new Class[]{clazz},
            (proxy, method, args) -> {
                RpcRequest req = new RpcRequest(
                    clazz.getName(), method.getName(),
                    Arrays.stream(method.getParameterTypes()).map(Class::getName).toArray(String[]::new),
                    args);
                return httpPost("http://localhost:8080/rpc", req).getResult();
            });
    }
}
```

### 高频面试问题与口述答案

**Q1：RPC 和普通 HTTP 接口调用有什么区别？**

HTTP 是传输协议，RPC 是“远程调用”的完整解决方案，两者不在一个层面。关键区别在三点：第一是语义，RPC 的目标是让远程调用看起来像本地方法调用；第二是效率，RPC 通常用更紧凑的二进制协议和长连接复用；第三是治理能力，RPC 框架天然带注册发现、负载均衡、超时熔断、链路追踪。HTTP/2 出来后两者边界在模糊，gRPC 就是用 HTTP/2 做传输的 RPC。

**Q2：为什么要用动态代理？JDK Proxy 和 CGLIB 的区别？**

核心目的就一个：无侵入地拦截方法调用。JDK Proxy 基于接口，要求目标必须有接口；CGLIB 基于字节码生成目标类的子类来拦截，能代理没有接口的类，但 `final` 类和方法代理不了。Dubbo 默认用 Javassist 生成代理，Spring AOP 默认 JDK 接口代理、没有接口时才用 CGLIB。

**Q3：序列化协议怎么选？JSON、Hessian、Protobuf、Kryo 的取舍？**

取舍维度是四个：跨语言、性能、体积、易用性。JSON 可读性好、天然跨语言，但冗余大、反序列化慢；Hessian 是二进制、Java 生态久经考验、Dubbo 默认，但跨语言一般；Protobuf 跨语言、体积小、性能最好，代价是要写 .proto 并生成代码；Kryo 在 Java 内性能顶尖但不跨语言。工程上内部服务用 Hessian/Kryo 追求性能，对外的开放接口用 JSON/Protobuf 追求跨语言。

**Q4：自定义协议帧（协议头）里一般要设计哪些字段？为什么？**

一是魔数，几个固定字节，用来快速识别协议、拦截脏数据；二是版本号，协议演进时做兼容；三是消息类型，区分请求、响应、心跳；四是请求 ID，请求和响应靠它关联，也是支持异步的关键；五是序列化类型；六是消息体长度，这个最关键，它解决 TCP 粘包拆包。另外会预留扩展字段。

**Q5：注册中心是干嘛的？服务注册与发现、心跳、节点变更推送的流程？**

它解决“消费者怎么知道提供者在哪”这个动态问题。三个核心：注册、发现、通知。提供者启动时把 `IP:端口+接口名` 注册上去，并定期发心跳续约；消费者启动时拉取服务列表，并订阅变更；提供者宕机时心跳超时被剔除，注册中心把变更推给消费者。选型上 ZooKeeper 是 CP，Eureka 是 AP，Nacos 两者兼顾。注册中心通常用本地缓存兜底——即使注册中心挂了，消费者也能用缓存里的地址继续调用。

**Q6：负载均衡有哪些策略？各适合什么场景？**

随机最简单；轮询均匀；加权轮询适合机器配置不均；最少活跃数把请求发给当前负载最轻的机器；一致性哈希让同一个 key 总是落到同一台机器，适合有状态或需要缓存亲和的情况。实际我会默认加权随机，配合动态权重来做。

**Q7：超时、重试、幂等怎么设计？哪些请求不能重试？**

这三者要放一起看，因为重试的代价是可能重复执行。读请求可以重试，写请求默认不重试，因为“钱转两次”是灾难。真要重试，必须保证幂等：给请求带一个唯一 ID，服务端用唯一约束去重。超时上要分层设置，且超时时间要顺着调用链递减。重试要配退避和最大次数，防止雪崩。

**Q8：长连接还是短连接？连接池和心跳保活怎么设计？**

RPC 高频调用场景一定用长连接 + 连接池。短连接每次握手、慢启动、挥手，开销巨大。但长连接带来两个新问题：一是空闲断连，网络中间设备会踢掉长时间不活跃的连接，所以要有心跳保活；二是连接数控制，需要连接池限制单机连接数。传输层用 Netty 的 NIO + Reactor 模型。

**Q9：粘包/拆包是什么？怎么解决？**

根因是 TCP 是字节流，没有消息边界。解法有三种：定长消息、用分隔符、以及最常用的长度字段法——在协议头里声明本次消息体长度，接收方按长度精确切分。Netty 里直接用 `LengthFieldBasedFrameDecoder`。

**Q10：服务端 BIO / NIO 怎么选？Netty 的 Reactor 模型为什么好？**

核心是连接数和线程数的关系。BIO 一个连接一个线程，连接一多线程就爆了；NIO 用 Selector 多路复用，一个线程就能监听成千上万个 Channel。Netty 封装了 Reactor 模型——主 Reactor 负责 accept，从 Reactor 负责读写，线程池负责业务，把 IO 和业务解耦。

## 关联

- 消息队列组件设计
- 接口幂等
