## 问题

数据库事务操作流程？

## 考察点

- 事务执行的内存、日志落盘、异步清理三阶段
- WAL + 2PC（redo/binlog 提交）流程

## 标准答案

```text
用户发起 UPDATE
    │
    ▼ 【第一阶段：内存】
1. 加载数据页至 Buffer Pool
2. 生成 Undo Log（回滚用）
3. 修改 Buffer Pool 中的行数据（变脏页）
4. 生成 Redo Log 记录（放入 Redo Log Buffer）
    │
    ▼ 执行 COMMIT
    │
    ▼ 【第二阶段：日志落盘（WAL + 2PC）】
5. Redo Log Buffer 刷盘（Prepare）  ──→  磁盘 ib_logfile
6. Binlog Cache 刷盘（Write & Flush） ──→  磁盘 binlog
7. 写入 Redo Commit 标记并刷盘 ──→  磁盘 ib_logfile（此时事务正式成功，返回客户端）
    │
    ▼ 【第三阶段：异步清理（后台线程）】
8. Page Cleaner 将脏页写入 Double Write Buffer ──→  磁盘 共享表空间
9. Double Write 将页写入最终数据文件 ──→  磁盘 .ibd 文件
10. 推进 Checkpoint，释放旧的 Redo Log 空间
```

## 关联

- mysql 数据库事务如何实现持久性
- 简单说说什么是 double write
