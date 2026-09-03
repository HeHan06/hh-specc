## 问题

请详细阐述 InnoDB 中 MVCC 的实现原理及其核心工作流程。

## 考察点

- MVCC 三大核心组件（隐藏字段、Undo Log、Read View）
- 快照读的可见性算法
- RC 与 RR 在 Read View 生成时机上的差异

## 标准答案

### 核心组件

InnoDB 的 MVCC 用于解决读写冲突，实现读不加锁、读写不阻塞。其实现依赖三个核心组件：

- 隐藏字段：每行记录包含 DB_TRX_ID（最近修改该行的事务 ID）和 DB_ROLL_PTR（回滚指针，指向 Undo Log 中的旧版本）；
- Undo Log：存储修改前的旧数据，并通过 DB_ROLL_PTR 将各版本串联成版本链；
- Read View（读视图）：包含活跃事务 ID 列表 m_ids、其最小值 min_trx_id、下一个要分配的事务 ID max_trx_id 以及当前事务 ID creator_trx_id。

### 快照读（普通 SELECT）的核心流程

从版本链的最新版本开始，依据可见性算法判断：

- 若 DB_TRX_ID 等于 creator_trx_id 则可见；
- 若小于 min_trx_id 则可见（已提交）；
- 若大于等于 max_trx_id 则不可见（未来事务）；
- 若在两者之间则检查是否在 m_ids 中，在则不可见（未提交），不在则可见（已提交）。

若当前版本不可见，则通过 DB_ROLL_PTR 回溯至上一版本继续判断，直至找到可见版本或到达链尾。

### RC 与 RR 的关键差异

- RC：每次查询都重新生成 Read View，因此能读到最新已提交数据，产生不可重复读；
- RR：只在事务首次查询时生成并复用，确保事务内多次查询结果一致。

### 注意事项

MVCC 仅适用于快照读（普通 SELECT），而当前读（如 UPDATE、SELECT FOR UPDATE）会读取最新数据并加锁，防止写冲突。此外，RR 级别下当前读还依赖间隙锁彻底防止幻读，而不再被需要的旧版本则由后台 Purge 线程择机物理删除。

## 关联

- 并发的事务可能会导致哪些问题
- innodb 的锁有哪些
