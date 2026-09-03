package com.aiguide.order.mapper;

import com.aiguide.admin.dto.AdminViews;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import com.aiguide.order.dto.ConsultationStatusView;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * 咨询订单 MyBatis 数据访问接口。
 */
@Mapper
@Capability(req = "Req-6", name = "付费咨询订单")
public interface ConsultationOrderMapper {

    @CapabilityPoint(task = "T-10", name = "创建咨询订单")
    int insertConsultationOrder(@Param("orderNo") String orderNo,
                                @Param("contactName") String contactName,
                                @Param("contactType") String contactType,
                                @Param("contactValue") String contactValue,
                                @Param("topicText") String topicText,
                                @Param("requestText") String requestText,
                                @Param("expectedTime") String expectedTime,
                                @Param("priceCents") int priceCents);

    @CapabilityPoint(task = "T-10", name = "查询咨询订单公开状态")
    ConsultationStatusView selectStatusByOrderNo(@Param("orderNo") String orderNo);

    @CapabilityPoint(task = "T-12", name = "分页查询后台咨询订单")
    List<AdminViews.ConsultationListView> selectAdminConsultations(@Param("offset") int offset,
                                                                   @Param("limit") int limit,
                                                                   @Param("status") String status,
                                                                   @Param("keyword") String keyword);

    @CapabilityPoint(task = "T-12", name = "统计后台咨询订单")
    long countAdminConsultations(@Param("status") String status, @Param("keyword") String keyword);

    @CapabilityPoint(task = "T-12", name = "查询后台咨询订单详情")
    AdminViews.ConsultationDetailView selectAdminConsultationByOrderNo(@Param("orderNo") String orderNo);

    @CapabilityPoint(task = "T-12", name = "查询咨询订单状态")
    String selectConsultationStatus(@Param("orderNo") String orderNo);

    @CapabilityPoint(task = "T-12", name = "锁定免费名额并读取已用数量")
    Integer selectUsedCountForUpdate();

    @CapabilityPoint(task = "T-12", name = "占用免费名额")
    int incrementConsultationQuota();

    @CapabilityPoint(task = "T-12", name = "释放免费名额")
    int decrementConsultationQuota();

    @CapabilityPoint(task = "T-12", name = "确认咨询排期")
    int confirmConsultation(@Param("orderNo") String orderNo,
                            @Param("adminNote") String adminNote,
                            @Param("priceCents") int priceCents,
                            @Param("freeQuotaUsed") boolean freeQuotaUsed);

    @CapabilityPoint(task = "T-12", name = "完成咨询订单")
    int completeConsultation(@Param("orderNo") String orderNo, @Param("adminNote") String adminNote);

    @CapabilityPoint(task = "T-12", name = "取消咨询订单")
    int cancelConsultation(@Param("orderNo") String orderNo, @Param("adminNote") String adminNote);

    @CapabilityPoint(task = "T-12", name = "更新咨询订单备注")
    int updateConsultationNote(@Param("orderNo") String orderNo, @Param("adminNote") String adminNote);
}
