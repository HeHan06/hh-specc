package com.aiguide.content.service;

import com.aiguide.common.ApiErrorCode;
import com.aiguide.common.ApiException;
import com.aiguide.content.dto.CategoryView;
import com.aiguide.content.mapper.CategoryMapper;
import com.aiguide.content.mapper.TopicMapper;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * 阅读站专题查询服务。仅向阅读站暴露主题下已启用专题。
 */
@Service
@Capability(req = "Req-1", name = "阅读站专题目录")
public class CategoryService {

    private final CategoryMapper categoryMapper;
    private final TopicMapper topicMapper;

    public CategoryService(CategoryMapper categoryMapper, TopicMapper topicMapper) {
        this.categoryMapper = categoryMapper;
        this.topicMapper = topicMapper;
    }

    @CapabilityPoint(task = "T-08", name = "查询某主题下可见专题")
    public List<CategoryView> listVisibleCategories(String topicCode) {
        if (!Boolean.TRUE.equals(topicMapper.isVisibleByCode(topicCode))) {
            throw new ApiException(ApiErrorCode.TOPIC_NOT_FOUND);
        }
        return categoryMapper.selectVisibleCategories(topicCode);
    }
}
