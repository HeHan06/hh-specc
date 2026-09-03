1. 插入语句
- 插入所有数据：INSERT INTO 表名
VALUES (值1, 值2, ...);
-  插入部分数据：INSERT INTO 表名 (列1, 列2, ...)
VALUES (值1, 值2, ...);

2. 更新语句
- 更新所有数据：UPDATE 表名
SET 列1 = 值1, 列2 = 值2, ...
WHERE 条件;
- 更新部分数据：UPDATE 表名
SET 列1 = 值1, 列2 = 值2, ...
WHERE 条件;

3. 删除语句（delete）
DELETE FROM 表名
WHERE 条件;

4. 查询语句
- 查询所有数据：SELECT * FROM 表名
- 查询部分数据：SELECT 列1, 列2, ... FROM 表名
- 查询条件数据：SELECT * FROM 表名 WHERE 条件
- 查询分组数据：SELECT * FROM 表名 GROUP BY 列1, 列2, ...
- 查询排序数据：SELECT * FROM 表名 ORDER BY 列1, 列2, ...
- 组合查询
  - 分组+排序：SELECT * FROM 表名 GROUP BY 列1, 列2, ... ORDER BY 列1, 列2, ...
  - 条件+分组+排序：SELECT * FROM 表名 WHERE 条件 GROUP BY 列1, 列2, ... ORDER BY 列1, 列2, ...
  - 分组+筛选：SELECT * FROM 表名 GROUP BY 列1, 列2, ... HAVING 条件
- 分页查询
  - LIMIT 页码, 每页数量
- 子查询
  - 简单子查询：SELECT * FROM (SELECT * FROM 子表名 WHERE 子条件) AS 子查询名
  - 复杂子查询：SELECT * FROM (SELECT * FROM 子表名 WHERE 子条件) AS 子查询名 WHERE 子查询名.列1 = 表名.列1
  - 子查询+联合查询：SELECT * FROM (SELECT * FROM 子表名 WHERE 子条件) AS 子查询名 UNION ALL (SELECT * FROM 子表名 WHERE 子条件) AS 子查询名
- 连接查询
  - 内连接：SELECT * FROM 表名1 JOIN 表名2 ON 表名1.列1 = 表名2.列1
  - 外连接：SELECT * FROM 表名1 LEFT JOIN 表名2 ON 表名1.列1 = 表名2.列1
  - 右连接：SELECT * FROM 表名1 RIGHT JOIN 表名2 ON 表名1.列1 = 表名2.列1
  - 全连接：SELECT * FROM 表名1 FULL JOIN 表名2 ON 表名1.列1 = 表名2.列1
  - using/on连接：SELECT * FROM 表名1 JOIN 表名2 USING/on(列1)
- 组合查询
    - 联合查询：SELECT * FROM 表名1 UNION ALL (SELECT * FROM 表名2)
    - 交叉查询：SELECT * FROM 表名1 CROSS JOIN 表名2
    - 并集查询：SELECT * FROM 表名1 UNION ALL (SELECT * FROM 表名2)

5. 函 数	说 明
    - AVG()	返回某列的平均值
    - COUNT()	返回某列的行数
    - MAX()	返回某列的最大值
    - MIN()	返回某列的最小值
    - SUM()	返回某列值之和

6. 事务处理
-- 开始事务
START TRANSACTION;

-- 插入操作 A
INSERT INTO `user`
VALUES (1, 'root1', 'root1', 'xxxx@163.com');

-- 创建保留点 updateA
SAVEPOINT updateA;

-- 插入操作 B
INSERT INTO `user`
VALUES (2, 'root2', 'root2', 'xxxx@163.com');

-- 回滚到保留点 updateA
ROLLBACK TO updateA;

-- 提交事务，只有操作 A 生效
COMMIT;

7. case when 语句
答：
① 简单 CASE（适合“等值判断”）
类似 switch，只用于判断某个字段是否等于某个特定值。

sql
CASE 列名
    WHEN 值1 THEN 结果1
    WHEN 值2 THEN 结果2
    ELSE 默认结果
END
② 搜索型 CASE（适合“范围/逻辑判断”，最常用）
类似 if-else if-else，可以写复杂的布尔逻辑表达式（>, <, LIKE, IS NULL, AND, OR 等）。

sql
CASE
    WHEN 条件1 THEN 结果1
    WHEN 条件2 THEN 结果2
    ELSE 默认结果
END