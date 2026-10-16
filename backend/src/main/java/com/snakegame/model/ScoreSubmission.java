package com.snakegame.model;

/**
 * Incoming payload for {@code POST /api/scores}.
 *
 * <p>Fields are boxed types on purpose: a JSON body that omits {@code score}
 * or {@code playerName} deserializes to {@code null} rather than a silent
 * default, so the service layer can reject it with a clear 400 instead of
 * quietly recording a zero.
 *
 * <p>This is an untrusted-input boundary. Nothing here is persisted, but it is
 * still validated before use.
 */
public record ScoreSubmission(String playerName, Integer score) {
}
