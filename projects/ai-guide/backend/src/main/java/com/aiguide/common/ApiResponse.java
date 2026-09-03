package com.aiguide.common;

/**
 * 统一响应体。唯一源见 contracts/common.yaml 的 response-envelope：
 * code=0 成功，非 0 失败；message 面向开发者；data 为业务数据（失败可为 null）。
 */
public class ApiResponse<T> {

    private final int code;
    private final String message;
    private final T data;

    public ApiResponse(int code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(ApiErrorCode.SUCCESS.getCode(), ApiErrorCode.SUCCESS.getMessage(), data);
    }

    public static ApiResponse<Void> success() {
        return success(null);
    }

    public static <T> ApiResponse<T> error(ApiErrorCode errorCode) {
        return new ApiResponse<>(errorCode.getCode(), errorCode.getMessage(), null);
    }

    public static <T> ApiResponse<T> error(ApiErrorCode errorCode, String message) {
        return new ApiResponse<>(errorCode.getCode(), message, null);
    }

    public static <T> ApiResponse<T> error(int code, String message) {
        return new ApiResponse<>(code, message, null);
    }

    public int getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }

    public T getData() {
        return data;
    }
}
