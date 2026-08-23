package com.dailyquote.quote.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * 系统配置数据访问接口，用于读取兜底语录等运营预置内容。
 */
@Mapper
public interface SystemConfigMapper {

    /**
     * 按配置键查询配置值；不存在时返回 null。
     */
    String selectValueByKey(@Param("configKey") String configKey);
}
