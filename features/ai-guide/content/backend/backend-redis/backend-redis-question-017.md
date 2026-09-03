## 问题

Redis 可以实现布隆过滤器吗？

## 考察点

- Redisson 布隆过滤器实现（Bitmap + 哈希 + 分片）
- 突破单 Key 内存限制的方案

## 标准答案

可以。Redisson 利用（Bitmap + 哈希）的思想，但做了极致优化。它内部采用「分片（Partitioning）」策略，将巨大的位数组分散存储在多个不同的 Redis Key 中（通过 RBitSet 实现），从而突破了单个 Key 的 512MB 内存限制。

## 关联

- 缓存穿透的布隆过滤器解决方案
- Redis 数据结构
