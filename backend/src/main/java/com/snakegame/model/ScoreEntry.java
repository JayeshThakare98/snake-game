package com.snakegame.model;

import java.time.Instant;

/**
 * An accepted score, as returned to clients.
 *
 * @param id          server-assigned sequential identifier
 * @param playerName  validated, already-trimmed player name
 * @param score       validated non-negative score
 * @param submittedAt server-side timestamp of acceptance
 */
public record ScoreEntry(long id, String playerName, int score, Instant submittedAt) {
}
