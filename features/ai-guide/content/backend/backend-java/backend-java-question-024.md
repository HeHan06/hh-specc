## 问题

synchronized 关键字的实现原理。

## 考察点

- synchronized 的字节码级实现（monitorenter/monitorexit、ACC_SYNCHRONIZED）
- 同步代码块与同步方法的实现差异

## 标准答案

synchronized 关键字是 Java 提供的线程同步机制，用于在多线程环境下保护共享资源，防止并发访问导致的数据不一致问题。

- synchronized 同步语句块的实现使用的是 monitorenter 和 monitorexit 指令，其中 monitorenter 指令指向同步代码块的开始位置，monitorexit 指令则指明同步代码块的结束位置。
- synchronized 修饰的方法并没有 monitorenter 指令和 monitorexit 指令，取而代之的是 ACC_SYNCHRONIZED 标识，该标识指明了该方法是一个同步方法。

## 关联

- synchronized 和 ReentrantLock 的区别
- synchronized 和 volatile 的区别
