package com.snakegame.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Translates exceptions into consistent JSON error responses.
 *
 * <p>Deliberately narrow: only the two cases we can describe precisely are
 * handled here. Everything else falls through to Spring's own handling, which
 * preserves correct behaviour for static resources (404), unsupported methods
 * (405), and unsupported media types (415).
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** Validation failure -> 400 Bad Request. */
    @ExceptionHandler(InvalidScoreException.class)
    public ResponseEntity<Map<String, Object>> handleInvalidScore(InvalidScoreException ex) {
        return errorResponse(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    /**
     * Malformed or absent JSON body -> 400 Bad Request.
     *
     * <p>The underlying parser message can echo fragments of the request, so it
     * is replaced with a generic description to avoid reflecting client input.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadableBody(HttpMessageNotReadableException ex) {
        return errorResponse(HttpStatus.BAD_REQUEST, "Malformed or missing JSON request body");
    }

    private ResponseEntity<Map<String, Object>> errorResponse(HttpStatus status, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);
        body.put("timestamp", Instant.now().toString());
        return ResponseEntity.status(status).body(body);
    }
}
