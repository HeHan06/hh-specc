package com.aiguide.content.mapper;

import com.aiguide.admin.dto.AdminViews;
import com.aiguide.content.dto.ContentDetailView;
import com.aiguide.content.dto.ContentStatsView;
import com.aiguide.content.dto.ContentSummaryView;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * 内容 MyBatis 数据访问接口。只读取已发布内容；所有动态条件均由 MyBatis 参数化占位处理。
 */
@Mapper
@Capability(req = "Req-1", name = "阅读站内容")
public interface ContentMapper {

    @CapabilityPoint(task = "T-08", name = "分页查询专题已发布内容")
    List<ContentSummaryView> selectPublishedByCategory(@Param("categoryCode") String categoryCode,
                                                       @Param("offset") int offset,
                                                       @Param("limit") int limit);

    @CapabilityPoint(task = "T-08", name = "统计专题已发布内容")
    long countPublishedByCategory(@Param("categoryCode") String categoryCode);

    @CapabilityPoint(task = "T-08", name = "分页查询最新已发布内容")
    List<ContentSummaryView> selectLatestPublished(@Param("offset") int offset, @Param("limit") int limit);

    @CapabilityPoint(task = "T-08", name = "统计最新已发布内容")
    long countLatestPublished();

    @CapabilityPoint(task = "T-08", name = "分页查询推荐已发布内容")
    List<ContentSummaryView> selectRecommendedPublished(@Param("offset") int offset, @Param("limit") int limit);

    @CapabilityPoint(task = "T-08", name = "统计推荐已发布内容")
    long countRecommendedPublished();

    @CapabilityPoint(task = "T-08", name = "分页搜索已发布内容")
    List<ContentSummaryView> searchPublished(@Param("keyword") String keyword,
                                             @Param("offset") int offset,
                                             @Param("limit") int limit);

    @CapabilityPoint(task = "T-08", name = "统计搜索结果")
    long countSearchPublished(@Param("keyword") String keyword);

    @CapabilityPoint(task = "T-08", name = "查询已发布内容详情")
    ContentDetailView selectPublishedDetail(@Param("contentCode") String contentCode);

    @CapabilityPoint(task = "T-08", name = "聚合已发布内容的浏览与点赞总数")
    ContentStatsView selectPublishedStats();

    @CapabilityPoint(task = "T-08", name = "查询已发布内容详情（含点赞状态）")
    ContentDetailView selectPublishedDetailWithVisitor(@Param("contentCode") String contentCode,
                                                       @Param("visitorId") String visitorId);

    @CapabilityPoint(task = "T-08", name = "累计内容浏览数")
    int incrementViewCount(@Param("contentCode") String contentCode);

    @CapabilityPoint(task = "T-12", name = "分页查询后台内容")
    List<AdminViews.ContentListView> selectAdminContents(@Param("offset") int offset,
                                                         @Param("limit") int limit,
                                                         @Param("status") String status,
                                                         @Param("type") String type,
                                                         @Param("categoryCode") String categoryCode,
                                                         @Param("keyword") String keyword);

    @CapabilityPoint(task = "T-12", name = "统计后台内容")
    long countAdminContents(@Param("status") String status,
                            @Param("type") String type,
                            @Param("categoryCode") String categoryCode,
                            @Param("keyword") String keyword);

    @CapabilityPoint(task = "T-12", name = "查询后台内容详情")
    AdminViews.ContentDetailView selectAdminDetailByCode(@Param("contentCode") String contentCode);

    @CapabilityPoint(task = "T-12", name = "查询内容版本")
    Integer selectVersionByCode(@Param("contentCode") String contentCode);

    @CapabilityPoint(task = "T-12", name = "查询内容状态")
    String selectStatusByCode(@Param("contentCode") String contentCode);

    @CapabilityPoint(task = "T-12", name = "创建内容草稿")
    int insertContent(@Param("code") String code,
                      @Param("categoryCode") String categoryCode,
                      @Param("type") String type,
                      @Param("title") String title,
                      @Param("summary") String summary,
                      @Param("body") String body,
                      @Param("tags") java.util.List<String> tags,
                      @Param("source") String source);

    @CapabilityPoint(task = "T-12", name = "编辑内容")
    int updateContent(@Param("contentCode") String contentCode,
                      @Param("categoryCode") String categoryCode,
                      @Param("type") String type,
                      @Param("title") String title,
                      @Param("summary") String summary,
                      @Param("body") String body,
                      @Param("tags") java.util.List<String> tags,
                      @Param("source") String source,
                      @Param("recommended") boolean recommended,
                      @Param("version") int version);

    @CapabilityPoint(task = "T-12", name = "变更内容状态")
    int transitionContentStatus(@Param("contentCode") String contentCode,
                                @Param("fromStatus") String fromStatus,
                                @Param("toStatus") String toStatus,
                                @Param("version") int version);
}
