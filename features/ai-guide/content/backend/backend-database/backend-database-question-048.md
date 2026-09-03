## 问题

给出 Customers 表（cust_id、cust_name、cust_contact、cust_city）。编写 SQL 语句，返回顾客 ID（cust_id）、顾客名称（cust_name）和登录名（user_login），其中登录名全部为大写字母，并由顾客联系人的前两个字符（cust_contact）和其所在城市的前三个字符（cust_city）组成。提示：需要使用函数、拼接和别名。

## 考察点

- 字符串函数（UPPER、CONCAT、SUBSTRING）与别名的综合使用

## 标准答案

```sql
SELECT cust_id, cust_name, UPPER(CONCAT(SUBSTRING(cust_contact, 1, 2), SUBSTRING(cust_city, 1, 3))) AS user_login
FROM Customers
```

## 关联

- sql 语法基础（函数）
