package com.aiguide.order.mapper;

import com.aiguide.admin.dto.AdminViews;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import com.aiguide.order.dto.TipStatusView;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * 打赏订单 MyBatis 数据访问接口。所有动态值均由 MyBatis 参数化占位处理。
 */
@Mapper
@Capability(req = "Req-5", name = "打赏订单")
public interface TipOrderMapper {

    @CapabilityPoint(task = "T-10", name = "创建打赏留资单")
    int insertTipOrder(@Param("orderNo") String orderNo,
                       @Param("contentCode") String contentCode,
                       @Param("amountCents") int amountCents,
                       @Param("contactName") String contactName,
                       @Param("contactValue") String contactValue,
                       @Param("message") String message);

    @CapabilityPoint(task = "T-10", name = "查询打赏订单公开状态")
    TipStatusView selectStatusByOrderNo(@Param("orderNo") String orderNo);

    @CapabilityPoint(task = "T-12", name = "分页查询后台打赏订单")
    List<AdminViews.TipListView> selectAdminTips(@Param("offset") int offset,
                                                 @Param("limit") int limit,
                                                 @Param("status") String status,
                                                 @Param("keyword") String keyword);

    @CapabilityPoint(task = "T-12", name = "统计后台打赏订单")
    long countAdminTips(@Param("status") String status, @Param("keyword") String keyword);

    @CapabilityPoint(task = "T-12", name = "查询后台打赏订单详情")
    AdminViews.TipDetailView selectAdminTipByOrderNo(@Param("orderNo") String orderNo);

    @CapabilityPoint(task = "T-12", name = "查询打赏订单状态")
    String selectTipStatus(@Param("orderNo") String orderNo);

    @CapabilityPoint(task = "T-12", name = "确认打赏收款")
    int receiveTip(@Param("orderNo") String orderNo);

    @CapabilityPoint(task = "T-12", name = "关闭打赏订单")
    int closeTip(@Param("orderNo") String orderNo);
}
