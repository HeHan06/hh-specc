## 问题

String 为什么不可变的？

## 考察点

- String 不可变的设计细节（final 类、final 字符数组）
- 修改操作返回新对象的原因

## 标准答案

String 类被 final 修饰不可继承，内部字符数组（JDK 9+ 为 byte[]）被 private final 修饰且不在任何方法中暴露或修改，所有修改操作都返回新 String 对象，所以不可变。

## 关联

- equals 和 == 的区别
- 字符串常量池
