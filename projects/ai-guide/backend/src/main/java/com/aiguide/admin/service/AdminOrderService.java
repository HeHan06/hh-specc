package com.aiguide.admin.service;

import com.aiguide.admin.dto.AdminRequests.CancelRequest;
import com.aiguide.admin.dto.AdminRequests.ConfirmRequest;
import com.aiguide.admin.dto.AdminRequests.NoteRequest;
import com.aiguide.admin.dto.AdminRequests.NoteUpdateRequest;
import com.aiguide.admin.dto.AdminViews.ConsultationDetailView;
import com.aiguide.admin.dto.AdminViews.ConsultationListView;
import com.aiguide.admin.dto.AdminViews.TipDetailView;
import com.aiguide.admin.dto.AdminViews.TipListView;
import com.aiguide.common.ApiErrorCode;
import com.aiguide.common.ApiException;
import com.aiguide.common.PageResult;
import com.aiguide.operationlog.OperationLog;
import com.aiguide.operationlog.OperationLogService;
import com.aiguide.order.mapper.ConsultationOrderMapper;
import com.aiguide.order.mapper.TipOrderMapper;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 后台订单管理服务。打赏订单执行收款确认/关闭；咨询订单执行排期确认/完成/取消；
 * 咨询免费名额通过 {@code SELECT ... FOR UPDATE} 行级锁串行化，前 10 个确认订单免费，
 * 取消已确认的免费订单释放名额；敏感操作标注 {@link OperationLog} 留痕。
 */
@Service
@Capability(req = "Req-11", name = "后台订单管理")
public class AdminOrderService {

    private static final int CONSULTATION_PRICE_CENTS = 50000;
    private static final int FREE_QUOTA_LIMIT = 10;

    private final TipOrderMapper tipOrderMapper;
    private final ConsultationOrderMapper consultationOrderMapper;
    private final OperationLogService operationLogService;

    public AdminOrderService(TipOrderMapper tipOrderMapper,
                             ConsultationOrderMapper consultationOrderMapper,
                             OperationLogService operationLogService) {
        this.tipOrderMapper = tipOrderMapper;
        this.consultationOrderMapper = consultationOrderMapper;
        this.operationLogService = operationLogService;
    }

    @CapabilityPoint(task = "T-12", name = "分页查询打赏订单")
    public PageResult<TipListView> pageTips(int pageNum, int pageSize, String status, String keyword) {
        int offset = (pageNum - 1) * pageSize;
        return PageResult.of(
                tipOrderMapper.selectAdminTips(offset, pageSize, trimToNull(status), trimToNull(keyword)),
                tipOrderMapper.countAdminTips(trimToNull(status), trimToNull(keyword)),
                pageNum,
                pageSize);
    }

    @CapabilityPoint(task = "T-12", name = "获取打赏订单详情")
    public TipDetailView getTip(String orderNo) {
        TipDetailView detail = tipOrderMapper.selectAdminTipByOrderNo(orderNo);
        if (detail == null) {
            throw new ApiException(ApiErrorCode.TIP_ORDER_NOT_FOUND);
        }
        return detail;
    }

    @CapabilityPoint(task = "T-12", name = "确认打赏收款")
    @Transactional
    @OperationLog(action = "确认打赏收款", targetType = "tip", targetCode = "#p0", beforeState = "submitted", afterState = "received")
    public TipDetailView receiveTip(String orderNo) {
        ensureTipStatus(orderNo, "submitted");
        if (tipOrderMapper.receiveTip(orderNo) == 0) {
            throw new ApiException(ApiErrorCode.ORDER_STATE_INVALID);
        }
        return getTip(orderNo);
    }

    @CapabilityPoint(task = "T-12", name = "关闭打赏订单")
    @Transactional
    @OperationLog(action = "关闭打赏订单", targetType = "tip", targetCode = "#p0", beforeState = "submitted", afterState = "closed")
    public TipDetailView closeTip(String orderNo) {
        ensureTipStatus(orderNo, "submitted");
        if (tipOrderMapper.closeTip(orderNo) == 0) {
            throw new ApiException(ApiErrorCode.ORDER_STATE_INVALID);
        }
        return getTip(orderNo);
    }

    @CapabilityPoint(task = "T-12", name = "分页查询咨询订单")
    public PageResult<ConsultationListView> pageConsultations(int pageNum, int pageSize, String status, String keyword) {
        int offset = (pageNum - 1) * pageSize;
        return PageResult.of(
                consultationOrderMapper.selectAdminConsultations(offset, pageSize,
                        trimToNull(status), trimToNull(keyword)),
                consultationOrderMapper.countAdminConsultations(trimToNull(status), trimToNull(keyword)),
                pageNum,
                pageSize);
    }

    @CapabilityPoint(task = "T-12", name = "获取咨询订单详情")
    public ConsultationDetailView getConsultation(String orderNo) {
        ConsultationDetailView detail = consultationOrderMapper.selectAdminConsultationByOrderNo(orderNo);
        if (detail == null) {
            throw new ApiException(ApiErrorCode.CONSULTATION_ORDER_NOT_FOUND);
        }
        return detail;
    }

    @CapabilityPoint(task = "T-12", name = "确认咨询排期")
    @Transactional
    @OperationLog(action = "确认咨询排期", targetType = "consultation", targetCode = "#p0", beforeState = "submitted", afterState = "confirmed")
    public ConsultationDetailView confirmConsultation(String orderNo, ConfirmRequest request) {
        ensureConsultationStatus(orderNo, "submitted");

        // 行级锁串行化免费名额判定，避免并发确认超发（plan.md 第 3 节）。
        Integer usedCountValue = consultationOrderMapper.selectUsedCountForUpdate();
        int usedCount = usedCountValue == null ? 0 : usedCountValue;
        boolean freeQuotaUsed = usedCount < FREE_QUOTA_LIMIT;
        int priceCents = freeQuotaUsed ? 0 : CONSULTATION_PRICE_CENTS;

        if (freeQuotaUsed && consultationOrderMapper.incrementConsultationQuota() == 0) {
            throw new ApiException(ApiErrorCode.ORDER_STATE_INVALID);
        }

        String adminNote = note(request == null ? null : request.adminNote());
        if (consultationOrderMapper.confirmConsultation(orderNo, adminNote, priceCents, freeQuotaUsed) == 0) {
            // 业务更新失败时回滚事务，已占用的免费名额一并回滚。
            throw new ApiException(ApiErrorCode.ORDER_STATE_INVALID);
        }
        return getConsultation(orderNo);
    }

    @CapabilityPoint(task = "T-12", name = "完成咨询订单")
    @Transactional
    @OperationLog(action = "完成咨询订单", targetType = "consultation", targetCode = "#p0", beforeState = "confirmed", afterState = "completed")
    public ConsultationDetailView completeConsultation(String orderNo, NoteRequest request) {
        ensureConsultationStatus(orderNo, "confirmed");
        String adminNote = note(request == null ? null : request.adminNote());
        if (consultationOrderMapper.completeConsultation(orderNo, adminNote) == 0) {
            throw new ApiException(ApiErrorCode.ORDER_STATE_INVALID);
        }
        return getConsultation(orderNo);
    }

    @CapabilityPoint(task = "T-12", name = "取消咨询订单")
    @Transactional
    @OperationLog(action = "取消咨询订单", targetType = "consultation", targetCode = "#p0", afterState = "canceled")
    public ConsultationDetailView cancelConsultation(String orderNo, CancelRequest request) {
        ConsultationDetailView current = getConsultation(orderNo);
        if (!"submitted".equals(current.status()) && !"confirmed".equals(current.status())) {
            throw new ApiException(ApiErrorCode.ORDER_STATE_INVALID);
        }
        if (current.freeQuotaUsed()) {
            consultationOrderMapper.decrementConsultationQuota();
        }
        if (consultationOrderMapper.cancelConsultation(orderNo, request.adminNote().trim()) == 0) {
            throw new ApiException(ApiErrorCode.ORDER_STATE_INVALID);
        }
        return getConsultation(orderNo);
    }

    @CapabilityPoint(task = "T-12", name = "更新咨询订单备注")
    @Transactional
    public ConsultationDetailView updateConsultationNote(String orderNo, NoteUpdateRequest request) {
        if (request == null) {
            throw new ApiException(ApiErrorCode.PARAM_INVALID);
        }
        String adminNote = note(request.adminNote());
        if (consultationOrderMapper.updateConsultationNote(orderNo, adminNote) == 0) {
            throw new ApiException(ApiErrorCode.CONSULTATION_ORDER_NOT_FOUND);
        }
        return getConsultation(orderNo);
    }

    private void ensureTipStatus(String orderNo, String expectedStatus) {
        String status = tipOrderMapper.selectTipStatus(orderNo);
        if (!expectedStatus.equals(status)) {
            throw new ApiException(ApiErrorCode.ORDER_STATE_INVALID);
        }
    }

    private void ensureConsultationStatus(String orderNo, String expectedStatus) {
        String status = consultationOrderMapper.selectConsultationStatus(orderNo);
        if (!expectedStatus.equals(status)) {
            throw new ApiException(ApiErrorCode.ORDER_STATE_INVALID);
        }
    }

    private String note(String adminNote) {
        if (adminNote == null || adminNote.isBlank()) {
            return null;
        }
        return adminNote.trim();
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
