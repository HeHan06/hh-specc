## 问题

OutOfMemoryError 异常和 StackOverflowError 异常的区别？

## 考察点

- 两类错误的产生区域与本质
- 常见触发场景与排查方向

## 标准答案

OutOfMemoryError 是堆或元空间等共享内存区域空间耗尽；StackOverflowError 是线程私有栈空间耗尽（如无限递归）。OOM 可通过 `-Xmx` 等参数调整大小恢复，SOF 必须检查递归逻辑或栈帧大小。

### 常见场景

- OOM：大集合不断 add 未释放、线程池无界队列积压、大量类动态加载、内存泄漏（ThreadLocal 未 remove、静态集合持有引用等）
- SOF：递归无终止条件、循环依赖调用、JSON 序列化双向引用未处理

## 关联

- JVM 运行时数据区域
- ThreadLocal 内存泄漏
