package com.aiguide.content.mapper;

import com.aiguide.admin.dto.AdminViews;
import com.aiguide.content.dto.TopicView;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * 主题 MyBatis 数据访问接口。SQL 占位统一落在 resources/mapper 中，禁止 JPA。
 */
@Mapper
@Capability(req = "Req-1", name = "阅读站主题目录")
public interface TopicMapper {

    @CapabilityPoint(task = "T-08", name = "查询阅读站可见主题")
    List<TopicView> selectVisibleTopics();

    @CapabilityPoint(task = "T-08", name = "判断主题是否可见（存在且启用）")
    Boolean isVisibleByCode(@Param("code") String code);

    @CapabilityPoint(task = "T-12", name = "分页查询后台主题")
    List<AdminViews.TopicView> selectAdminTopics(@Param("offset") int offset,
                                                 @Param("limit") int limit,
                                                 @Param("keyword") String keyword,
                                                 @Param("enabled") Boolean enabled);

    @CapabilityPoint(task = "T-12", name = "统计后台主题")
    long countAdminTopics(@Param("keyword") String keyword, @Param("enabled") Boolean enabled);

    @CapabilityPoint(task = "T-12", name = "创建主题")
    int insertTopic(@Param("code") String code,
                    @Param("name") String name,
                    @Param("description") String description,
                    @Param("sortOrder") int sortOrder,
                    @Param("enabled") boolean enabled);

    @CapabilityPoint(task = "T-12", name = "更新主题")
    int updateTopic(@Param("code") String code,
                    @Param("name") String name,
                    @Param("description") String description,
                    @Param("sortOrder") int sortOrder,
                    @Param("enabled") boolean enabled);

    @CapabilityPoint(task = "T-12", name = "判断主题编码是否存在")
    Boolean existsByCode(@Param("code") String code);
}
