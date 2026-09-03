## 问题

JVM 运行数据区域有哪些存储模块？

## 考察点

- JVM 运行时数据区五大模块的划分
- 线程共享区域与线程私有区域的区分及各区域异常

## 标准答案

JVM 运行时数据区分为 5 大块：

### 线程共享区域

- 堆（Heap）：存储几乎所有的对象实例和数组，是 GC 主要管理区域。异常：OutOfMemoryError
- 方法区（Method Area）/ 元空间（Metaspace）：存储类信息、常量、静态变量、JIT 编译后的代码缓存，位于直接内存（不在堆内）。异常：OutOfMemoryError

### 线程私有区域

- 虚拟机栈（VM Stack）：每个方法执行时创建栈帧，包含局部变量表、操作数栈、方法返回地址等。异常：StackOverflowError
- 本地方法栈（Native Stack）：为 Native 方法服务。异常：StackOverflowError
- 程序计数器（PC Register）：记录当前线程执行的字节码行号，是唯一不会抛 OutOfMemoryError 的区域

## 关联

- 逃逸分析与栈上分配
- OutOfMemoryError 与 StackOverflowError 的区别
