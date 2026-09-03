package com.aiguide.config;

import org.apache.ibatis.annotations.Mapper;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Configuration;

/**
 * MyBatis 配置。仅扫描标注 @Mapper 的接口，避免误注册普通接口；
 * 下划线转驼峰统一在 application.yml 的 mybatis.configuration 中配置。
 */
@Configuration
@MapperScan(basePackages = "com.aiguide", annotationClass = Mapper.class)
public class MyBatisConfig {
}
