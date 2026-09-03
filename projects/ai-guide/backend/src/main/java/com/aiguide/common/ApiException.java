package com.aiguide.common;

/**
 * 业务异常。携带统一错误码，由全局异常处理器转换为标准响应体。
 */
public class ApiException extends RuntimeException {

    private final ApiErrorCode errorCode;

    public ApiException(ApiErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public ApiException(ApiErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public ApiErrorCode getErrorCode() {
        return errorCode;
    }

    public static ApiException of(ApiErrorCode errorCode) {
        return new ApiException(errorCode);
    }
}
