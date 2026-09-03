## 问题

设计一个任务需要依赖另外两个任务执行完之后再执行，怎么设计？使用两种方法实现。

## 考察点

- CompletableFuture 的 allOf 与 thenCombine 用法
- 任务依赖编排能力

## 标准答案

### 方法 1：CompletableFuture.allOf() 等待全部完成

```java
CompletableFuture<String> f1 = CompletableFuture.supplyAsync(() -> "A");
CompletableFuture<String> f2 = CompletableFuture.supplyAsync(() -> "B");
CompletableFuture<Void> f3 = CompletableFuture.allOf(f1, f2)
    .thenRun(() -> System.out.println(f1.join() + f2.join() + " done"));
```

### 方法 2：CompletableFuture.thenCombine() 合并两个结果后执行

```java
f1.thenCombine(f2, (r1, r2) -> r1 + r2)
    .thenAccept(result -> System.out.println(result + " done"));
```

也可用 CountDownLatch：主任务 await() 等待 latch 归零，两个前置任务完成后各自 countDown()。

## 关联

- CompletableFuture 常用方法
- 线程池
