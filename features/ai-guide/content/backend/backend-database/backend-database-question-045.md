## 问题

@Transactional 注解在项目实际使用中的坑点以及最佳实践。

## 考察点

- 事务静默失效的常见场景（同类调用、异常被吞、异常类型、引擎、代理等）
- 事务范围过大、锁顺序等问题与最佳实践

## 标准答案

### 实战中的“坑”与避坑指南

#### 事务“静默”失效的常见场景

这是最需要警惕的一类问题，注解加上去了，但事务根本没起作用。

1. 同类方法调用（Self-Invocation）：在一个 Service 类中，一个非事务方法直接调用另一个 @Transactional 方法，事务会失效。
   - 原因：这种调用走的是对象内部的 this 引用，绕过了 Spring 生成的代理对象。
   - 解决：
     - 最佳方案：将事务方法拆分到另一个独立的 Service 类中，然后通过依赖注入调用。
     - 代理方案：通过 `AopContext.currentProxy()` 获取当前对象的代理来调用。需要先在启动类上添加 `@EnableAspectJAutoProxy(exposeProxy = true)`。
   - 方法非 public：@Transactional 只能应用于 public 方法。Spring 的 AOP 代理默认只能拦截 public 方法。
2. 异常被“吞掉”：在事务方法里用 try-catch 捕获了异常却没有重新抛出。
   - 原因：Spring 只有收到未处理的异常信号才会回滚，被捕获的异常对它是“不可见”的。
   - 解决：在 catch 块中，要么重新抛出异常（`throw new RuntimeException(e);`），要么手动标记事务回滚（`TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();`）。
3. 异常类型不匹配：抛出了 Exception 或其子类（非 RuntimeException），但未配置 rollbackFor。
   - 原因：Spring 默认只对 RuntimeException 和 Error 回滚。
   - 解决：明确指定 `@Transactional(rollbackFor = Exception.class)`。
4. 数据库引擎不支持事务：例如 MySQL 的 MyISAM 引擎不支持事务，确保使用的是 InnoDB 引擎。
5. 类未被 Spring 管理：事务方法所在的类没有交给 Spring 容器管理（如未加 @Service 等注解）。
6. 方法被 final 修饰：final 方法无法被 CGLIB 代理重写，导致事务失效。
7. 错误的事务传播行为：配置了 `@Transactional(propagation = Propagation.NOT_SUPPORTED)` 等，会以非事务方式执行。

#### 事务范围过大

- 问题：在事务中调用了外部 RPC 接口、发送消息、进行文件 IO 等耗时操作。这会长时间占用数据库连接，在高并发下可能快速耗尽连接池。
- 解决：严格控制事务边界，仅将数据库的 CRUD 操作放在事务内，网络请求等操作放在事务外。

#### 分布式锁与事务顺序问题

- 问题：先加分布式锁，再开启事务。如果事务操作耗时较长，会长时间持有锁，降低系统吞吐量。
- 解决：建议先开启事务，再获取分布式锁，并在事务提交后尽快释放锁。

### 最佳实践总结

1. 明确指定 `rollbackFor = Exception.class`：这是一个非常稳健的习惯，确保所有异常都能触发回滚。
2. 事务方法必须是 public：这是 Spring AOP 代理机制的基本要求。
3. 避免同类调用：将事务方法拆分到不同的 Bean 中，确保调用能通过代理。
4. 缩小事务范围：仅在事务方法中编写核心的数据库操作代码，非 DB 操作（如调外部 API）应移出事务。
5. 合理使用 `readOnly = true`：对于纯粹的查询方法，设置该属性可提升性能。
6. 不要捕获异常后“吞掉”：要么让异常抛出，要么在 catch 后手动回滚。
7. 事务加在 Service 层：避免在 Controller 层直接使用 @Transactional，保持分层清晰。
8. 开启事务日志：在 application.yml 中配置 `logging.level.org.springframework.transaction.interceptor: TRACE`，方便调试和监控事务行为。

## 关联

- 解释下 springboot 项目中 Transactional 注解
- Transactional 注解常见传播行为选型
