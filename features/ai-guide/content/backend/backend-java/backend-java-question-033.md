## 问题

CompletableFuture 是什么？它的作用是啥？常用方法是什么？

## 考察点

- CompletableFuture 的定位与作用
- 常用方法

## 标准答案

- CompletableFuture 是一个异步任务容器，用于处理异步操作的结果。
- 它的作用是异步处理任务，避免阻塞主线程，提高程序的并发性和响应性。
- 常用方法有：supplyAsync()、runAsync()、thenApply()、thenAccept()、thenCompose() 等。

## 关联

- 任务依赖编排（allOf/thenCombine）
- 线程池
