## 问题

MyISAM 和 InnoDB 有什么区别？

## 考察点

- 两个引擎在锁、事务、外键、崩溃恢复、索引实现上的差异

## 标准答案

- InnoDB 支持行级别的锁粒度和 MVCC，MyISAM 不支持，只支持表级别的锁粒度。
- MyISAM 不提供事务支持。InnoDB 提供事务支持，实现了 SQL 标准定义的四个隔离级别。
- MyISAM 不支持外键，而 InnoDB 支持。
- 虽然 MyISAM 引擎和 InnoDB 引擎都是使用 B+Tree 作为索引结构，但是两者的实现方式不太一样。
- MyISAM 不支持数据库异常崩溃后的安全恢复，而 InnoDB 支持。
- InnoDB 的性能比 MyISAM 更强大。随着 CPU 核数的增加，InnoDB 的读写能力呈线性增长。

## 关联

- InnoDB 与 PostgreSQL 索引结构差异
- 事务与隔离级别
