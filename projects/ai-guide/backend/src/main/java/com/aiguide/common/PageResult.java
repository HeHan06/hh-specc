package com.aiguide.common;

import java.util.List;

/**
 * 分页响应数据。分页四要素的唯一源为 contracts/common.yaml，
 * 所有列表接口复用该结构，禁止各模块自行定义分页响应。
 */
public record PageResult<T>(List<T> list, long total, int pageNum, int pageSize) {

    public static <T> PageResult<T> of(List<T> list, long total, int pageNum, int pageSize) {
        return new PageResult<>(list, total, pageNum, pageSize);
    }

    public static <T> PageResult<T> empty(int pageNum, int pageSize) {
        return of(List.of(), 0L, pageNum, pageSize);
    }
}
