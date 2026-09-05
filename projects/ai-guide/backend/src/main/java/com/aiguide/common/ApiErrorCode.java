package com.aiguide.common;

/**
 * 统一错误码枚举。
 * 通用错误码（1000-1099）的唯一源为 contracts/common.yaml；
 * 业务模块错误码由其模块契约登记，本枚举按契约扩展。
 */
public enum ApiErrorCode {

    SUCCESS(0, "success", "success"),

    PARAM_INVALID(1000, "参数校验失败（类型/长度/边界/枚举不合法）", "请检查输入内容后重试"),
    UNAUTHORIZED(1001, "未登录或登录态失效", "请先登录后再操作"),
    FORBIDDEN(1002, "无权限访问当前资源", "暂无操作权限"),
    RESOURCE_NOT_FOUND(1003, "请求资源不存在", "资源不存在或已移除"),
    SYSTEM_ERROR(1004, "系统繁忙或下游服务暂不可用", "系统繁忙，请稍后重试"),

    CONTENT_NOT_PUBLISHED(2000, "内容不存在或非已发布状态，阅读站不可见", "内容不存在或已下架"),
    TOPIC_NOT_FOUND(2001, "主题不存在或已停用", "主题不存在或暂不可用"),
    CATEGORY_NOT_FOUND(2002, "专题不存在或已停用", "专题不存在或暂不可用"),
    SEARCH_UNAVAILABLE(2003, "搜索服务不可用或查询执行失败", "搜索暂不可用，请稍后重试"),
    VISITOR_ID_INVALID(2004, "点赞访客标识缺失或非法", "操作失败，请刷新页面后重试"),

    ADMIN_LOGIN_FAILED(2300, "管理员登录失败（账号或密码错误）", "账号或密码错误"),
    ADMIN_CODE_DUPLICATE(2301, "主题/专题/内容编码重复", "编码已存在，请更换后重试"),
    CONTENT_VERSION_CONFLICT(2302, "内容编辑并发冲突，version 不匹配", "内容已被他人更新，请重新加载后再编辑"),
    CONTENT_STATE_INVALID(2303, "内容状态流转不合法", "当前内容状态不支持该操作"),
    ADMIN_CONTENT_INVALID(2305, "内容类型/来源/状态非法或内容不存在", "内容参数非法或内容不存在"),
    OPERATION_LOG_FAILED(2306, "敏感操作日志写入失败", "操作未完成，请稍后重试"),
    ADMIN_DISABLED(2307, "管理员账号已停用", "账号不可用，请联系管理员");

    private final int code;
    private final String meaning;
    private final String userText;

    ApiErrorCode(int code, String meaning, String userText) {
        this.code = code;
        this.meaning = meaning;
        this.userText = userText;
    }

    public int getCode() {
        return code;
    }

    public String getMeaning() {
        return meaning;
    }

    public String getUserText() {
        return userText;
    }

    public String getMessage() {
        return meaning;
    }
}
