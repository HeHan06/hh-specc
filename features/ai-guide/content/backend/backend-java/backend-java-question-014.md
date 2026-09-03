## 问题

Spring AOP 中，通过 @Autowired 注入的 Service 为什么是代理对象，而不是原始实现类？

## 考察点

- Spring 容器的「对象替换」机制
- BeanPostProcessor 在 AOP 中的作用

## 标准答案

根本原因是 Spring 容器的「对象替换」机制。

Spring 在启动时会先实例化原始 Bean，但在初始化完成后，BeanPostProcessor（具体是 AOP 的后置处理器）会介入。如果发现该 Bean 匹配了切点（比如有 @Transactional），Spring 会动态生成一个代理对象，并用这个代理对象覆盖掉容器中原本存储的原始对象。

因此，@Autowired 根据类型去容器里查找时，拿到的早就被替换成了代理对象，所以后续调用都会自动触发增强逻辑。

## 关联

- JDK 动态代理和 CGLIB 动态代理
- 动态代理相比静态代理的优势
