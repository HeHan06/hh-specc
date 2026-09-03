## 问题

解释下 springboot 项目中 Transactional 注解。

## 考察点

- @Transactional 的 AOP 原理
- propagation、isolation、rollbackFor 等核心属性

## 标准答案

### 原理

@Transactional 是 Spring 框架中实现声明式事务管理的核心注解，它让开发者能通过简单的配置来保证数据操作的原子性。

它的原理是通过 AOP（面向切面编程）动态代理来实现的。Spring 会为添加了该注解的类创建一个代理对象，在调用目标方法前后自动完成开启、提交或回滚事务的操作。

### 核心属性

- propagation (传播行为)：定义了事务方法被另一个事务方法调用时，该如何处理事务。默认是 Propagation.REQUIRED。
  - REQUIRED (默认)：如果当前已有事务，则加入；否则新建一个事务。
  - REQUIRES_NEW：始终新建一个独立的事务。如果当前已有事务，则将其挂起。
  - SUPPORTS：如果当前有事务则加入，否则以非事务方式执行。
  - MANDATORY：如果当前有事务则加入，否则抛出异常。
  - NOT_SUPPORTED：以非事务方式执行，如果当前有事务则将其挂起。
  - NEVER：以非事务方式执行。如果当前有事务，则抛出异常。
  - NESTED：如果当前有事务，则在嵌套事务（保存点）中执行；否则新建一个事务。
- isolation (隔离级别)：定义了事务的隔离程度，用于解决并发问题，如脏读、不可重复读、幻读。默认是 Isolation.DEFAULT，即使用数据库默认的隔离级别，通常 MySQL 的默认级别是 REPEATABLE_READ。
  - READ_UNCOMMITTED：最低级别，允许读取未提交的数据。
  - READ_COMMITTED：只能读取已提交的数据。
  - REPEATABLE_READ：确保同一事务中多次读取结果一致。
  - SERIALIZABLE：最高级别，事务串行执行，性能开销大。
- rollbackFor / rollbackForClassName：指定哪些异常触发事务回滚。默认只对 RuntimeException 和 Error 回滚。
- noRollbackFor / noRollbackForClassName：指定哪些异常不触发事务回滚。
- readOnly：标记事务为只读，可提示数据库或 ORM 框架进行性能优化。
- timeout：设置事务的超时时间（秒），超时则自动回滚。
- transactionManager：指定要使用的事务管理器 Bean 名称。

## 关联

- @Transactional 注解在项目实际使用中的坑点以及最佳实践
- Transactional 注解常见传播行为选型
