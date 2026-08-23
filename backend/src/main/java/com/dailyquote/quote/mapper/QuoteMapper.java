package com.dailyquote.quote.mapper;

import com.dailyquote.quote.dto.QuoteView;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;

/**
 * 语录数据访问接口。
 * 占位阶段仅定义方法签名，SQL 在 T-07 通过 XML Mapper 落地。
 */
@Mapper
public interface QuoteMapper {

    /**
     * 查询指定展示日期的已上架语录；同一日期最多一条已上架记录。
     */
    QuoteView selectPublishedByDisplayDate(@Param("displayDate") LocalDate displayDate);
}
