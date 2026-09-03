package com.aiguide.order.service;

import com.aiguide.common.ApiErrorCode;
import com.aiguide.common.ApiException;
import com.aiguide.config.SiteConfigProperties;
import com.aiguide.order.mapper.TipOrderMapper;
import com.aiguide.order.dto.TipCreateRequest;
import com.aiguide.order.dto.TipCreateResultView;
import com.aiguide.order.dto.TipStatusView;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 打赏订单服务。金额单位为分且仅接受预设枚举；
 * 联系方式可选，填写时必须通过手机或微信格式校验；
 * 订单号使用随机 UUID，避免可猜测枚举。
 */
@Service
@Capability(req = "Req-5", name = "打赏订单")
public class TipOrderService {

    private static final Set<Integer> TIP_AMOUNT_CENTS = Set.of(10, 100, 500, 1000, 5000, 10000);
    private static final Pattern PHONE_PATTERN = Pattern.compile("^1[3-9]\\d{9}$");
    private static final Pattern WECHAT_PATTERN = Pattern.compile("^[A-Za-z][A-Za-z0-9_-]{5,19}$");

    private final TipOrderMapper tipOrderMapper;
    private final SiteConfigProperties siteConfigProperties;

    public TipOrderService(TipOrderMapper tipOrderMapper, SiteConfigProperties siteConfigProperties) {
        this.tipOrderMapper = tipOrderMapper;
        this.siteConfigProperties = siteConfigProperties;
    }

    @CapabilityPoint(task = "T-10", name = "创建打赏留资单")
    @Transactional
    public TipCreateResultView create(TipCreateRequest request, String visitorId) {
        if (request.amount() == null || !TIP_AMOUNT_CENTS.contains(request.amount())) {
            throw new ApiException(ApiErrorCode.TIP_AMOUNT_INVALID);
        }

        String contactValue = normalize(request.contactValue());
        if (contactValue != null && !isValidContact(contactValue)) {
            throw new ApiException(ApiErrorCode.TIP_CONTACT_INVALID);
        }

        String orderNo = newOrderNo();
        tipOrderMapper.insertTipOrder(
                orderNo,
                normalize(request.contentCode()),
                request.amount(),
                normalize(request.contactName()),
                contactValue,
                normalize(request.message()));

        return new TipCreateResultView(
                orderNo,
                request.amount(),
                "submitted",
                siteConfigProperties.getWechatId());
    }

    @CapabilityPoint(task = "T-10", name = "查询打赏订单状态")
    public TipStatusView getByOrderNo(String orderNo) {
        TipStatusView view = tipOrderMapper.selectStatusByOrderNo(orderNo);
        if (view == null) {
            throw new ApiException(ApiErrorCode.TIP_ORDER_NOT_FOUND);
        }
        return new TipStatusView(
                view.orderNo(),
                view.amountCents(),
                view.status(),
                siteConfigProperties.getWechatId(),
                view.receivedAt());
    }

    private String newOrderNo() {
        // UUID v4 使用安全随机数，32 位十六进制不可猜测，无需额外维护订单号序列
        return UUID.randomUUID().toString().replace("-", "");
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private boolean isValidContact(String value) {
        return PHONE_PATTERN.matcher(value).matches()
                || WECHAT_PATTERN.matcher(value).matches();
    }
}
