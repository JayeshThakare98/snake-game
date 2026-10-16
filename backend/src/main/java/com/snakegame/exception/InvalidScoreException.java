package com.snakegame.exception;

/**
 * Thrown when a score submission fails validation.
 *
 * <p>Mapped to HTTP 400 by {@code GlobalExceptionHandler}. The message is a
 * human-readable reason safe to return to the client (it never contains
 * internal state, stack details, or user secrets).
 */
public class InvalidScoreException extends RuntimeException {

    public InvalidScoreException(String message) {
        super(message);
    }
}
