package com.snakegame.service;

import com.snakegame.exception.InvalidScoreException;
import com.snakegame.model.ScoreEntry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Pure unit tests for {@link ScoreService}. No Spring context is started, so
 * these are fast and isolate validation logic exactly.
 */
class ScoreServiceTest {

    private ScoreService service;

    @BeforeEach
    void setUp() {
        service = new ScoreService();
    }

    @Nested
    @DisplayName("valid submissions")
    class ValidSubmissions {

        @Test
        void storesEntryWithServerAssignedIdAndTimestamp() {
            ScoreEntry entry = service.submit("Alice", 42);

            assertThat(entry.id()).isPositive();
            assertThat(entry.playerName()).isEqualTo("Alice");
            assertThat(entry.score()).isEqualTo(42);
            assertThat(entry.submittedAt()).isNotNull();
        }

        @Test
        void trimsSurroundingWhitespaceFromName() {
            ScoreEntry entry = service.submit("   Bob   ", 7);

            assertThat(entry.playerName()).isEqualTo("Bob");
        }

        @Test
        void acceptsScoreOfZero() {
            assertThat(service.submit("Zero", 0).score()).isZero();
        }

        @Test
        void acceptsScoreAtExactMaximum() {
            assertThat(service.submit("Max", ScoreService.MAX_SCORE).score())
                    .isEqualTo(ScoreService.MAX_SCORE);
        }

        @Test
        void acceptsNameAtExactMaximumLength() {
            String name = "x".repeat(ScoreService.MAX_NAME_LENGTH);

            assertThat(service.submit(name, 5).playerName()).hasSize(ScoreService.MAX_NAME_LENGTH);
        }

        @Test
        void assignsStrictlyIncreasingIds() {
            long first = service.submit("A", 1).id();
            long second = service.submit("B", 2).id();

            assertThat(second).isGreaterThan(first);
        }
    }

    @Nested
    @DisplayName("rejected submissions")
    class RejectedSubmissions {

        @Test
        void rejectsNullName() {
            assertThatThrownBy(() -> service.submit(null, 10))
                    .isInstanceOf(InvalidScoreException.class)
                    .hasMessageContaining("playerName");
        }

        @Test
        void rejectsBlankName() {
            assertThatThrownBy(() -> service.submit("   ", 10))
                    .isInstanceOf(InvalidScoreException.class)
                    .hasMessageContaining("playerName");
        }

        @Test
        void rejectsNameLongerThanMaximum() {
            String tooLong = "x".repeat(ScoreService.MAX_NAME_LENGTH + 1);

            assertThatThrownBy(() -> service.submit(tooLong, 10))
                    .isInstanceOf(InvalidScoreException.class)
                    .hasMessageContaining("at most");
        }

        @Test
        void rejectsNullScore() {
            assertThatThrownBy(() -> service.submit("Alice", null))
                    .isInstanceOf(InvalidScoreException.class)
                    .hasMessageContaining("score");
        }

        @Test
        void rejectsNegativeScore() {
            assertThatThrownBy(() -> service.submit("Alice", -1))
                    .isInstanceOf(InvalidScoreException.class)
                    .hasMessageContaining("negative");
        }

        @Test
        void rejectsScoreAboveMaximum() {
            assertThatThrownBy(() -> service.submit("Alice", ScoreService.MAX_SCORE + 1))
                    .isInstanceOf(InvalidScoreException.class)
                    .hasMessageContaining("exceed");
        }

        @Test
        void rejectedSubmissionsAreNotStored() {
            assertThatThrownBy(() -> service.submit("Alice", -5))
                    .isInstanceOf(InvalidScoreException.class);

            assertThat(service.findAll()).isEmpty();
        }
    }

    @Nested
    @DisplayName("retrieval and lifecycle")
    class RetrievalAndLifecycle {

        @Test
        void returnsEmptyListInitially() {
            assertThat(service.findAll()).isEmpty();
            assertThat(service.count()).isZero();
        }

        @Test
        void returnsAllScoresOldestFirst() {
            service.submit("First", 1);
            service.submit("Second", 2);
            service.submit("Third", 3);

            List<ScoreEntry> all = service.findAll();

            assertThat(all).hasSize(3);
            assertThat(all).extracting(ScoreEntry::playerName)
                    .containsExactly("First", "Second", "Third");
        }

        @Test
        void snapshotIsImmutable() {
            service.submit("Alice", 1);
            List<ScoreEntry> snapshot = service.findAll();

            assertThatThrownBy(() -> snapshot.add(new ScoreEntry(99, "X", 0, null)))
                    .isInstanceOf(UnsupportedOperationException.class);
        }

        @Test
        void clearRemovesEverythingAndResetsIds() {
            service.submit("Alice", 1);
            service.submit("Bob", 2);

            service.clear();

            assertThat(service.findAll()).isEmpty();
            assertThat(service.submit("Carol", 3).id()).isEqualTo(1);
        }

        @Test
        void capsStoredEntriesAtCapacity() {
            for (int i = 0; i < ScoreService.MAX_ENTRIES + 25; i++) {
                service.submit("Player", i);
            }

            List<ScoreEntry> all = service.findAll();

            assertThat(all).hasSize(ScoreService.MAX_ENTRIES);
            // Oldest entries were dropped; the newest submission survives.
            assertThat(all.get(all.size() - 1).score()).isEqualTo(ScoreService.MAX_ENTRIES + 24);
        }
    }
}
