package com.snakegame.service;

import com.snakegame.exception.InvalidScoreException;
import com.snakegame.model.ScoreEntry;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;

/**
 * In-memory score store for a single local session.
 *
 * <p>Scores live only for the lifetime of the process — restarting the backend
 * clears them. That is intentional for this first version; no database is
 * involved.
 *
 * <p>Thread safety: Tomcat serves requests on multiple threads, so a
 * {@link CopyOnWriteArrayList} guards the collection and an {@link AtomicLong}
 * assigns identifiers. Writes are rare and reads are small, which is exactly
 * the workload CopyOnWriteArrayList is suited to.
 */
@Service
public class ScoreService {

    /** Longest accepted player name, after trimming. */
    public static final int MAX_NAME_LENGTH = 20;

    /** Highest plausible score. Guards against absurd values from bad clients. */
    public static final int MAX_SCORE = 100_000;

    /** How many entries are retained; oldest are dropped once exceeded. */
    public static final int MAX_ENTRIES = 100;

    private final List<ScoreEntry> scores = new CopyOnWriteArrayList<>();
    private final AtomicLong idSequence = new AtomicLong(0);

    /**
     * Validates and stores a submission.
     *
     * @param playerName raw name from the client; may be null
     * @param score      raw score from the client; may be null
     * @return the stored entry with a server-assigned id and timestamp
     * @throws InvalidScoreException if any validation rule fails
     */
    public ScoreEntry submit(String playerName, Integer score) {
        String name = validateName(playerName);
        int value = validateScore(score);

        ScoreEntry entry = new ScoreEntry(idSequence.incrementAndGet(), name, value, Instant.now());
        scores.add(entry);
        trimToCapacity();
        return entry;
    }

    /** @return an immutable snapshot of all accepted scores, oldest first. */
    public List<ScoreEntry> findAll() {
        return List.copyOf(scores);
    }

    /** @return the number of stored scores. */
    public int count() {
        return scores.size();
    }

    /** Removes every stored score. Used by tests and the reset button. */
    public void clear() {
        scores.clear();
        idSequence.set(0);
    }

    // ---------------------------------------------------------------- helpers

    private String validateName(String playerName) {
        if (playerName == null || playerName.isBlank()) {
            throw new InvalidScoreException("playerName must not be blank");
        }
        String trimmed = playerName.trim();
        if (trimmed.length() > MAX_NAME_LENGTH) {
            throw new InvalidScoreException(
                    "playerName must be at most " + MAX_NAME_LENGTH + " characters");
        }
        return trimmed;
    }

    private int validateScore(Integer score) {
        if (score == null) {
            throw new InvalidScoreException("score must not be null");
        }
        if (score < 0) {
            throw new InvalidScoreException("score must not be negative");
        }
        if (score > MAX_SCORE) {
            throw new InvalidScoreException("score must not exceed " + MAX_SCORE);
        }
        return score;
    }

    /** Bounds memory if a client submits endlessly. */
    private void trimToCapacity() {
        while (scores.size() > MAX_ENTRIES) {
            scores.remove(0);
        }
    }
}
