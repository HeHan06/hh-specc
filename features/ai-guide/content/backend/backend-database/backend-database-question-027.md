## 问题

构建一个最简单的 MySQL 读写分离集群的完整操作流程。

## 考察点

- 主从复制的搭建步骤
- Spring Boot 动态数据源（dynamic-datasource）的配置与自动路由
- 强制读主库的场景处理

## 标准答案

### 选型说明

选择应用层动态数据源自动路由（Spring Boot + dynamic-datasource）作为最佳实践，因为它无需部署独立中间件，配置简单，且对代码几乎零侵入。

### 最佳实践流程（极简版）

1. 搭建 MySQL 主从复制
   - 主库开启 binlog，设置 server-id=1；从库分别设置 server-id=2、3。
   - 主库创建复制账号并授权，记录 `SHOW MASTER STATUS` 的日志文件名和位置。
   - 各从库执行 `CHANGE MASTER TO` 指向主库，然后 `START SLAVE`，检查 Slave_IO_Running 和 Slave_SQL_Running 均为 Yes。

2. Spring Boot 项目配置
   - 引入依赖：dynamic-datasource-spring-boot-starter。
   - 在 application.yml 中配置多数据源：

   ```yaml
   master：主库地址
   slave_1、slave_2：两个从库地址
   ```

   - 设置 `primary: master`，并启用 mybatis 插件自动识别 SQL（默认开启）。

3. 自动路由生效
   - 框架内置 SQL 解析器，自动将 INSERT/UPDATE/DELETE 路由到 master，将 SELECT 路由到 slave 组（轮询负载均衡）。
   - 业务代码无需任何注解或额外逻辑，就像使用单数据源一样。

4. 特殊场景处理
   - 若需强制读主库（如避免主从延迟），在方法上添加 `@DS("master")` 即可覆盖自动规则。

## 关联

- mysql 主从复制的详细流程
- 出现主从延迟的原因
