## 问题

购物车信息用 String 还是 Hash 存储更好呢？

## 考察点

- 购物车场景下数据结构选型
- Hash 存储的字段设计

## 标准答案

由于购物车中的商品频繁修改和变动，购物车信息建议使用 Hash 存储：

- 用户 id 为 key
- 商品 id 为 field，商品数量为 value

## 关联

- Redis 数据结构
- Redis 排行榜 ZSet
