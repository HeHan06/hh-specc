## 问题

mysql 数据库事务如何实现持久性？

## 考察点

- 脏页问题的由来
- redo Log 与 WAL 机制

## 标准答案

### 问题由来

之所以有持久性问题，是由于 mysql 数据修改时，不会直接将数据直接写入磁盘，而是将数据页加载到内存里的 buffer pool 里，等事务提交后，再刷新到磁盘。这就导致了脏页的存在，因此需要有持久化机制来解决这个问题，mysql 通过 redo Log 和 WAL（Write-Ahead Logging）机制实现持久性。

### redo Log

数据修改操作，会以物理日志的形式记录在 redo Log Buffer 中，等事务提交后，再将 redo Log Buffer 中的日志刷新到磁盘。只有当日志被刷新到磁盘后，才会认为事务提交成功。

### WAL

WAL（Write-Ahead Logging）的核心思想就是：日志先行。即在修改数据页之前，必须确保对应的修改日志已经写入磁盘。

## 关联

- 数据库事务操作流程
- 简单说说什么是 double write
