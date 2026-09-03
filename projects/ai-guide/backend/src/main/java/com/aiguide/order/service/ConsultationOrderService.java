package com.aiguide.order.service;

import com.aiguide.common.ApiErrorCode;
import com.aiguide.common.ApiException;
import com.aiguide.config.SiteConfigProperties;
import com.aiguide.order.mapper.ConsultationOrderMapper;
import com.aiguide.order.dto.ConsultationCreateRequest;
import com.aiguide.order.dto.ConsultationCreateResultView;
import com.aiguide.order.dto.ConsultationStatusView;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 付费咨询订单服务。必填项、联系方式类型与格式、期望时间必须通过校验；
 * 计价固定为 500 元/半小时（50000 分），最终免费与否由管理员确认排期时判定。
 */
@Service
@Capability(req = "Req-6", name = "付费咨询订单")
public class ConsultationOrderService {

    private static final int CONSULTATION_PRICE_CENTS = 50000;
    private static final Pattern PHONE_PATTERN = Pattern.compile("^1[3-9]\\d{9}$");
    private static final Pattern WECHAT_PATTERN = Pattern.compile("^[A-Za-z][A-Za-z0-9_-]{5,19}$");

    private final ConsultationOrderMapper consultationOrderMapper;
    private final SiteConfigProperties siteConfigProperties;

    public ConsultationOrderService(ConsultationOrderMapper consultationOrderMapper,
                                    SiteConfigProperties siteConfigProperties) {
        this.consultationOrderMapper = consultationOrderMapper;
        this.siteConfigProperties = siteConfigProperties;
    }

    @CapabilityPoint(task = "T-10", name = "创建咨询订单")
    @Transactional
    public ConsultationCreateResultView create(ConsultationCreateRequest request) {
        validate(request);

        String orderNo = newOrderNo();
        consultationOrderMapper.insertConsultationOrder(
                orderNo,
                request.contactName().trim(),
                request.contactType(),
                request.contactValue().trim(),
                request.topicText().trim(),
                request.requestText().trim(),
                request.expectedTime(),
                CONSULTATION_PRICE_CENTS);

        return new ConsultationCreateResultView(
                orderNo,
                CONSULTATION_PRICE_CENTS,
                "submitted",
                siteConfigProperties.getWechatId());
    }

    @CapabilityPoint(task = "T-10", name = "查询咨询订单状态")
    public ConsultationStatusView getByOrderNo(String orderNo) {
        ConsultationStatusView view = consultationOrderMapper.selectStatusByOrderNo(orderNo);
        if (view == null) {
            throw new ApiException(ApiErrorCode.CONSULTATION_ORDER_NOT_FOUND);
        }
        return new ConsultationStatusView(
                view.orderNo(),
                view.priceCents(),
                view.freeQuotaUsed(),
                view.status(),
                siteConfigProperties.getWechatId(),
                view.confirmedAt());
    }

    private void validate(ConsultationCreateRequest request) {
        if (request.contactName() == null || request.contactName().trim().length() < 1
                || request.contactName().trim().length() > 50) {
            throw paramInvalid();
        }
        if (!"phone".equals(request.contactType()) && !"wechat".equals(request.contactType())) {
            throw paramInvalid();
        }
        if (!isValidContact(request.contactValue(), request.contactType())) {
            throw paramInvalid();
        }
        if (request.topicText() == null || request.topicText().trim().length() < 1
                || request.topicText().trim().length() > 200) {
            throw paramInvalid();
        }
        if (request.requestText() == null || request.requestText().trim().length() < 1
                || request.requestText().trim().length() > 2000) {
            throw paramInvalid();
        }
        validateExpectedTime(request.expectedTime());
    }

    private void validateExpectedTime(String expectedTime) {
        if (expectedTime == null) {
            throw paramInvalid();
        }
        try {
            Instant expected = Instant.parse(expectedTime);
            if (!expected.isAfter(Instant.now())) {
                throw paramInvalid();
            }
        } catch (DateTimeParseException ex) {
            throw paramInvalid();
        }
    }

    private boolean isValidContact(String value, String type) {
        if (value == null) {
            return false;
        }
        if ("phone".equals(type)) {
            return PHONE_PATTERN.matcher(value).matches();
        }
        return WECHAT_PATTERN.matcher(value).matches();
    }

    private ApiException paramInvalid() {
        return new ApiException(ApiErrorCode.CONSULTATION_PARAM_INVALID);
    }

    private String newOrderNo() {
        // UUID v4 使用安全随机数，32 位十六进制不可猜测
        return UUID.randomUUID().toString().replace("-", "");
    }
}
