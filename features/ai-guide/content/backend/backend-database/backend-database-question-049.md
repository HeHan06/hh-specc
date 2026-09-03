## 问题

Orders 订单表（order_num、order_date）。编写 SQL 语句，返回 2020 年 1 月的所有订单的订单号（order_num）和订单日期（order_date），并按订单日期升序排序。

## 考察点

- 日期函数（month / year）过滤与 ORDER BY 排序

## 标准答案

```sql
SELECT order_num, order_date
FROM Orders
WHERE month(order_date) = '01' AND YEAR(order_date) = '2020'
ORDER BY order_date
```

## 关联

- sql 语法基础（查询语句 / 排序）
