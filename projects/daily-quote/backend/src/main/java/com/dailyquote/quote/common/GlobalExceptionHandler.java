package com.dailyquote.quote.common;

import com.dailyquote.quote.dto.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 全局异常处理器。
 *
 * 按契约把服务层异常映射为标准响应体；HTTP 状态码表达传输层结果，
 * 业务成败由响应体中的 code 表达，前端据此映射用户文案。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private static final int CODE_MISSING_FALLBACK_CONFIG = 2001;
    private static final int CODE_INVALID_QUOTE_FORMAT = 2002;
    private static final int CODE_SYSTEM_ERROR = 1999;

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiResponse<Void>> handleApiException(ApiException exception) {
        ApiResponse<Void> body = ApiResponse.error(exception.getCode(), exception.getMessage());
        return ResponseEntity.ok(body);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingFallbackConfig(IllegalStateException exception) {
        ApiResponse<Void> body = ApiResponse.error(CODE_MISSING_FALLBACK_CONFIG, exception.getMessage());
        return ResponseEntity.ok(body);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleInvalidQuoteFormat(IllegalArgumentException exception) {
        ApiResponse<Void> body = ApiResponse.error(CODE_INVALID_QUOTE_FORMAT, exception.getMessage());
        return ResponseEntity.ok(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpectedException(Exception exception) {
        // 宪法 7.3：禁止静默吞错。未预期异常必须打印堆栈，便于定位与上报。
        log.error("未预期异常：{}", exception.getMessage(), exception);
        ApiResponse<Void> body = ApiResponse.error(CODE_SYSTEM_ERROR, "系统繁忙，请稍后再试");
        return ResponseEntity.internalServerError().body(body);
    }
}
