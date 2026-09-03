## 问题

SQL 的逻辑执行顺序大致如下（简略版）。

## 考察点

- SQL 各子句的逻辑执行顺序（区别于书写顺序）
- 窗口函数、HAVING、DISTINCT、ORDER BY、LIMIT 的执行位置

## 标准答案

SQL 的逻辑执行顺序（简略版）：

```text
FROM / JOIN

WHERE （筛选原始行）

GROUP BY （分组压缩行）

HAVING （筛选分组后的行）

窗口函数（OVER） （在分组后的结果集上计算） ← 此时执行

SELECT （投影）

DISTINCT

ORDER BY （对最终结果集进行排序） ← 最后执行

LIMIT
```

## 关联

- 组合查询（分组 + 排序 + 筛选）
- 窗口函数
