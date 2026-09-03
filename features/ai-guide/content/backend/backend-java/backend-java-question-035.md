## 问题

Java 8 垃圾回收器有哪些，垃圾回收流程？

## 考察点

- Java 8 七种回收器及其特点
- Minor GC、Major GC、Metaspace GC 与三种核心算法

## 标准答案

Java 8 共 7 种回收器，新生代有 3 种是因为不同场景目标不同：单线程低内存（Serial）、低延迟配合老年代 CMS（ParNew）、高吞吐量批处理（Parallel Scavenge）。

| 回收器 | 作用区域 | 算法 | 特点 |
|--------|---------|------|------|
| Serial | 新生代 | 复制 | 单线程，Client 模式默认 |
| ParNew | 新生代 | 复制 | 多线程并行收集，唯一能配合 CMS 的新生代回收器 |
| Parallel Scavenge | 新生代 | 复制 | 多线程并行，吞吐量优先（吞吐量 = 用户代码时间 / 总时间） |
| Serial Old | 老年代 | 标记-整理 | 单线程，配合 Serial 或 CMS 失败后备 |
| Parallel Old | 老年代 | 标记-整理 | 多线程，配合 Parallel Scavenge |
| CMS | 老年代 | 标记-清除 | 并发低停顿，大部分工作与用户线程并发 |
| G1 | 全部 | 标记-整理(局部复制) | 可控停顿时间（`-XX:MaxGCPauseMillis`），JDK9 默认 |

经典组合：Serial + Serial Old（桌面应用）| ParNew + CMS（低延迟 Web 服务）| Parallel Scavenge + Parallel Old（批处理/后台计算）

### 1. 新生代 GC（Minor GC）

Eden 满时触发。活对象从 Eden + 一个 Survivor 区复制到另一个 Survivor 区，年龄 +1；超过 `-XX:MaxTenuringThreshold`（默认 15）的对象晋升老年代；Survivor 放不下时直接进老年代（分配担保：当 Survivor 无法容纳本次 Minor GC 存活对象时，由老年代担保直接存放这些对象）。复制算法，快但会 STW。

### 2. 老年代 GC（Major GC / Full GC）

触发条件：老年代空间不足、晋升失败、System.gc()、CMS 并发失败等。CMS 流程：初始标记（STW）→ 并发标记 → 重新标记（STW）→ 并发清除。Serial/Parallel Old 用标记-整理，CMS 用标记-清除（会产生碎片，碎片化严重时回退 Serial Old 做 Full GC）。

### 3. 元空间 GC（Metaspace，Java 8 替代永久代）

存储在直接内存，存储类元数据。类卸载时机：该类的所有实例已回收、ClassLoader 已回收、Class 对象无引用。`-XX:MetaspaceSize` 设初始值，满时触发 Full GC 回收无用类元数据，`-XX:MaxMetaspaceSize` 设上限防 OOM。

### 4. 三种核心 GC 算法流程

- 标记-清除：标记存活对象 → 统一清除未标记对象。产生内存碎片，CMS 使用。
- 复制：内存分两块，只使用一块。GC 时将存活对象复制到另一块，原块一次清空。无碎片、速度快，但浪费一半内存。新生代用，按 8:1:1 分 Eden 和两个 Survivor。
- 标记-整理：标记存活对象 → 将存活对象向一端移动 → 清理边界外内存。无碎片，但移动对象耗时，老年代用。

## 关联

- GC 死亡对象分析方法
- JVM 运行时数据区域
