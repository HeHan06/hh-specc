## 问题

使用 Java 代码实现双重校验锁实现单例模式，解释为啥需要 volatile 校验？

## 考察点

- 双重校验锁单例的写法
- volatile 禁止指令重排的作用

## 标准答案

```java
public class Singleton {

    private volatile static Singleton uniqueInstance;

    private Singleton() {
    }

    public static Singleton getUniqueInstance() {
       // 先判断对象是否已经实例过，没有实例化过才进入加锁代码
        if (uniqueInstance == null) {
            // 类对象加锁
            synchronized (Singleton.class) {
                if (uniqueInstance == null) {
                    uniqueInstance = new Singleton();
                }
            }
        }
        return uniqueInstance;
    }
}
```

### volatile 的作用（防止指令重排）

`uniqueInstance = new Singleton()` 不是原子操作，JVM 分三步执行：

1. 分配内存空间
2. 调用构造方法初始化对象
3. 将指针指向内存地址

JIT 编译器可能将步骤 2、3 重排为 1→3→2。若线程 A 执行到步骤 3 时，线程 B 进入第一个 `if (uniqueInstance == null)` 判断，看到引用非 null 就直接返回了一个未初始化完的对象，导致程序错误。

volatile 通过内存屏障禁止这种指令重排：对 volatile 变量的写操作必须在读操作之前完成，确保构造方法完整执行后引用才对其他线程可见，这也是 JDK 5+ 后双重校验锁正确运行的保证。

## 关联

- synchronized 和 volatile 的区别
- JMM 主内存与工作内存
