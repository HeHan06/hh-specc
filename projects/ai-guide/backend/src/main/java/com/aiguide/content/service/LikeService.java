package com.aiguide.content.service;

import com.aiguide.common.ApiErrorCode;
import com.aiguide.common.ApiException;
import com.aiguide.content.mapper.LikeMapper;
import com.aiguide.content.dto.LikeResultView;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 内容点赞服务。通过数据库唯一约束保证幂等，冲突时不产生重复计数。
 */
@Service
@Capability(req = "Req-4", name = "内容点赞")
public class LikeService {

    private final LikeMapper likeMapper;

    public LikeService(LikeMapper likeMapper) {
        this.likeMapper = likeMapper;
    }

    @CapabilityPoint(task = "T-08", name = "点赞内容")
    @Transactional
    public LikeResultView like(String contentCode, String visitorId) {
        if (visitorId == null || visitorId.length() < 8 || visitorId.length() > 64) {
            throw new ApiException(ApiErrorCode.VISITOR_ID_INVALID);
        }
        int likeCount;
        try {
            likeCount = likeMapper.insertLike(contentCode, visitorId);
        } catch (DuplicateKeyException ex) {
            // 唯一约束冲突说明该访客已点赞，读取当前点赞数并幂等返回
            likeCount = likeMapper.countLike(contentCode, visitorId);
        }
        if (likeCount <= 0) {
            throw new ApiException(ApiErrorCode.CONTENT_NOT_PUBLISHED);
        }
        return new LikeResultView(true, likeCount);
    }
}
