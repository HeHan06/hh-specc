package com.aiguide.content.mapper;

import com.aiguide.admin.dto.AdminViews;
import com.aiguide.content.dto.CategoryView;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * 专题 MyBatis 数据访问接口。SQL 占位统一落在 resources/mapper 中。
 */
@Mapper
@Capability(req = "Req-1", name = "阅读站专题目录")
public interface CategoryMapper {

    @CapabilityPoint(task = "T-08", name = "查询某主题下可见专题")
    List<CategoryView> selectVisibleCategories(@Param("topicCode") String topicCode);

    @CapabilityPoint(task = "T-08", name = "判断专题是否可见（存在且启用）")
    Boolean isVisibleByCode(@Param("code") String code);

    @CapabilityPoint(task = "T-12", name = "分页查询后台专题")
    List<AdminViews.CategoryView> selectAdminCategories(@Param("topicCode") String topicCode,
                                                        @Param("offset") int offset,
                                                        @Param("limit") int limit,
                                                        @Param("keyword") String keyword,
                                                        @Param("enabled") Boolean enabled);

    @CapabilityPoint(task = "T-12", name = "统计后台专题")
    long countAdminCategories(@Param("topicCode") String topicCode,
                              @Param("keyword") String keyword,
                              @Param("enabled") Boolean enabled);

    @CapabilityPoint(task = "T-12", name = "创建专题")
    int insertCategory(@Param("code") String code,
                       @Param("topicCode") String topicCode,
                       @Param("name") String name,
                       @Param("description") String description,
                       @Param("sortOrder") int sortOrder,
                       @Param("enabled") boolean enabled);

    @CapabilityPoint(task = "T-12", name = "更新专题")
    int updateCategory(@Param("code") String code,
                       @Param("topicCode") String topicCode,
                       @Param("name") String name,
                       @Param("description") String description,
                       @Param("sortOrder") int sortOrder,
                       @Param("enabled") boolean enabled);

    @CapabilityPoint(task = "T-12", name = "判断专题编码是否存在")
    Boolean existsByCode(@Param("code") String code);
}
