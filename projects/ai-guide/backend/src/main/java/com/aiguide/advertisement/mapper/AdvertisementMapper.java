package com.aiguide.advertisement.mapper;

import com.aiguide.advertisement.dto.AdvertisementView;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * 广告位 MyBatis 数据访问接口。SQL 占位统一落在 resources/mapper 中，禁止 JPA。
 */
@Mapper
public interface AdvertisementMapper {

    /** 查询阅读站可见（已启用）的广告位；无配置或未启用时返回 null。 */
    AdvertisementView selectEnabled();

    /** 查询当前槽位（id=1），无论是否启用；用于后台编辑。 */
    AdvertisementView selectCurrent();

    /** 以单行槽位（id=1）写入或覆盖广告位。 */
    int upsert(@Param("title") String title,
               @Param("description") String description,
               @Param("link") String link,
               @Param("enabled") boolean enabled);
}
