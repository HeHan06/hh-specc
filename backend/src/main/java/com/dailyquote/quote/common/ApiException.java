package com.dailyquote.quote.common;

/**
 * 业务异常基类：携带契约中的业务错误码，由统一异常处理器转成标准响应体。
 *
 * 服务层只关心“发生了什么业务问题”，不直接依赖 HTTP 响应细节；
 * code 的取值范围与 contracts/quote.yaml 保持一致。
 */
public class ApiException extends RuntimeException {

    private final int code;

    public ApiException(int code, String message) {
        super(message);
        this.code = code;
    }

    public ApiException(int code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public int getCode() {
        return code;
    }
}
