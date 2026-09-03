## 问题

mysql 主从复制的详细流程是什么。

## 考察点

- 主从复制从 binlog 到 relay log 再应用的完整链路

## 标准答案

1. 主库将数据库中数据的变化写入到 binlog。
2. 从库连接主库，请求 binlog 中的更新事件。
3. 主库创建 binlog dump 线程，将 binlog 内容发送给从库。
4. 从库的 I/O receiver 线程接收更新事件，并写入 relay log。
5. 从库的 applier 线程读取 relay log，把其中的事件应用到本地。若使用 statement-based logging，可以理解成重放 SQL；若使用 row-based logging，则主要是应用行变更事件。

## 关联

- 构建一个最简单的 MySQL 读写分离集群
- Binlog 到底记录什么
