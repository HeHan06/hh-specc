package com.aiguide.content.service;

import com.aiguide.content.dto.TopicView;
import com.aiguide.content.mapper.TopicMapper;
import com.hhspecc.observability.Capability;
import com.hhspecc.observability.CapabilityPoint;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * 阅读站主题查询服务。仅向阅读站暴露已启用主题，不承载写操作。
 */
@Service
@Capability(req = "Req-1", name = "阅读站主题目录")
public class TopicService {

    private final TopicMapper topicMapper;

    public TopicService(TopicMapper topicMapper) {
        this.topicMapper = topicMapper;
    }

    @CapabilityPoint(task = "T-08", name = "查询阅读站可见主题")
    public List<TopicView> listVisibleTopics() {
        return topicMapper.selectVisibleTopics();
    }
}
