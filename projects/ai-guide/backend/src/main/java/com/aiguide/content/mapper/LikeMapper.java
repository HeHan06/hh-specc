package com.aiguide.content.mapper;

import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * 点赞 MyBatis 数据访问接口。幂等由内容点赞唯一约束保证，SQL 占位落在 resources/mapper。
 */
@Mapper
@Capability(req = "Req-4", name = "内容点赞")
public interface LikeMapper {

    @CapabilityPoint(task = "T-08", name = "新增访客点赞记录并返回最新点赞数")
    int insertLike(@Param("contentCode") String contentCode, @Param("visitorId") String visitorId);

    @CapabilityPoint(task = "T-08", name = "查询内容当前点赞数")
    int countLike(@Param("contentCode") String contentCode, @Param("visitorId") String visitorId);
}
