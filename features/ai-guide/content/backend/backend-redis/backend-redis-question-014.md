## 问题

基于 Spring Boot 和 Redis Pub/Sub 的极简示例，实现一个「订单状态更新」的通知功能。

## 考察点

- Spring Boot 集成 Redis Pub/Sub 的核心三步（监听器、容器、发布）
- 模式订阅与消息发布

## 标准答案

### 1、添加依赖

在 pom.xml 中添加 Spring Boot 的 Redis 依赖：

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

### 2、配置 Redis 连接

在 application.yml 文件中配置 Redis 服务信息：

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      # password: 你的密码 (如果没有密码则省略)
```

### 3、创建消息监听器（订阅者）

创建一个普通的 Spring Bean，其中的方法用于处理接收到的消息：

```java
package com.example.demo.listener;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class OrderEventListener {

    private static final Logger log = LoggerFactory.getLogger(OrderEventListener.class);

    // 注意：方法名是自定义的，后面配置时会用到
    public void handleOrderMessage(String message, String channel) {
        log.info("从频道 [{}] 收到消息: {}", channel, message);
        // 在这里编写你的业务逻辑，比如更新数据库、发送通知等
    }
}
```

### 4、配置消息监听容器（核心）

创建一个配置类，将上面的监听器注册到 Redis 的消息监听容器中：

```java
package com.example.demo.config;

import com.example.demo.listener.OrderEventListener;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.listener.adapter.MessageListenerAdapter;

@Configuration
public class PubSubConfig {

    @Bean
    public MessageListenerAdapter listenerAdapter(OrderEventListener listener) {
        // 第一个参数是监听器实例，第二个参数是处理消息的方法名
        return new MessageListenerAdapter(listener, "handleOrderMessage");
    }

    @Bean
    public RedisMessageListenerContainer container(RedisConnectionFactory factory,
                                                   MessageListenerAdapter listenerAdapter) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(factory);

        // 订阅所有以 "orders:" 开头的频道 (使用模式匹配)
        // 如果想订阅单个频道，可以使用 new ChannelTopic("orders:123")
        container.addMessageListener(listenerAdapter, new PatternTopic("orders:*"));

        return container;
    }
}
```

### 5、创建消息发布者（发布者）

创建一个 Service，用于向 Redis 频道发送消息：

```java
package com.example.demo.publisher;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class OrderPublisher {

    private final StringRedisTemplate template;

    public OrderPublisher(StringRedisTemplate template) {
        this.template = template;
    }

    public void publishOrderStatus(String orderId, String status) {
        String channel = "orders:" + orderId;
        // 可以发送任何字符串格式的消息，例如 JSON
        String message = String.format("{\"orderId\":\"%s\", \"status\":\"%s\"}", orderId, status);
        template.convertAndSend(channel, message);
        System.out.println("消息已发布到频道 " + channel + ": " + message);
    }
}
```

### 核心三步总结

这个例子展示了 Spring Boot 集成 Redis Pub/Sub 的核心三步：

1. 定义监听器：编写处理消息的业务逻辑。
2. 配置容器：将监听器和频道（或模式）绑定。
3. 发布消息：通过 StringRedisTemplate 的 convertAndSend 方法发送消息。

## 关联

- Redis Pub/Sub 机制原理
- 缓存失效广播
