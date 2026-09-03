## 问题

OrderItems 表含有：订单号 order_num，quantity 产品数量。从 OrderItems 表中检索出所有不同且不重复的订单号（order_num），其中每个订单都要包含 100 个或更多的产品。

## 考察点

- GROUP BY 与 HAVING 对分组后聚合条件的过滤

## 标准答案

```sql
SELECT order_num
FROM OrderItems
GROUP BY order_num
HAVING SUM(quantity) >= 100
```

## 关联

- sql 语法基础（查询语句 / 分组查询）
- SQL 逻辑执行顺序
