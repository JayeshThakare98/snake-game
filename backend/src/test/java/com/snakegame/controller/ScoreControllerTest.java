package com.snakegame.controller;

import com.snakegame.service.ScoreService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end HTTP tests for the REST layer, exercised through the real Spring
 * context and the real filter/serialization stack.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ScoreControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ScoreService scoreService;

    @BeforeEach
    void resetStore() {
        scoreService.clear();
    }

    // ------------------------------------------------------------------ health

    @Test
    @DisplayName("GET /api/health returns 200 with an unambiguous UP status")
    void healthReturnsUp() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").value("snake-game-backend"))
                .andExpect(jsonPath("$.timestamp").isNotEmpty());
    }

    // ------------------------------------------------------------ list scores

    @Test
    @DisplayName("GET /api/scores returns an empty JSON array when nothing was submitted")
    void listIsEmptyInitially() throws Exception {
        mockMvc.perform(get("/api/scores"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("GET /api/scores returns previously accepted scores")
    void listReturnsAcceptedScores() throws Exception {
        mockMvc.perform(post("/api/scores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerName\":\"Alice\",\"score\":42}"))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/scores"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].playerName").value("Alice"))
                .andExpect(jsonPath("$[0].score").value(42))
                .andExpect(jsonPath("$[0].id").isNumber())
                .andExpect(jsonPath("$[0].submittedAt").isNotEmpty());
    }

    // ---------------------------------------------------------- post scores

    @Test
    @DisplayName("POST /api/scores accepts a valid submission with 201 Created")
    void acceptsValidSubmission() throws Exception {
        mockMvc.perform(post("/api/scores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerName\":\"Alice\",\"score\":100}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.playerName").value("Alice"))
                .andExpect(jsonPath("$.score").value(100));
    }

    @Test
    @DisplayName("POST /api/scores accepts a score of zero")
    void acceptsZeroScore() throws Exception {
        mockMvc.perform(post("/api/scores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerName\":\"Rookie\",\"score\":0}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.score").value(0));
    }

    @Test
    @DisplayName("POST /api/scores rejects a negative score with 400")
    void rejectsNegativeScore() throws Exception {
        mockMvc.perform(post("/api/scores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerName\":\"Alice\",\"score\":-5}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("score must not be negative"));
    }

    @Test
    @DisplayName("POST /api/scores rejects a missing score field with 400")
    void rejectsMissingScore() throws Exception {
        mockMvc.perform(post("/api/scores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerName\":\"Alice\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("score must not be null"));
    }

    @Test
    @DisplayName("POST /api/scores rejects a blank player name with 400")
    void rejectsBlankName() throws Exception {
        mockMvc.perform(post("/api/scores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerName\":\"   \",\"score\":10}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    @DisplayName("POST /api/scores rejects an oversized score with 400")
    void rejectsOversizedScore() throws Exception {
        mockMvc.perform(post("/api/scores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerName\":\"Cheater\",\"score\":999999}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    @DisplayName("POST /api/scores rejects malformed JSON with 400")
    void rejectsMalformedJson() throws Exception {
        mockMvc.perform(post("/api/scores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not valid json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    @DisplayName("A rejected submission leaves the store untouched")
    void rejectedSubmissionIsNotStored() throws Exception {
        mockMvc.perform(post("/api/scores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerName\":\"Alice\",\"score\":-1}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/scores"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    // ------------------------------------------------------- error handling

    @Test
    @DisplayName("An unsupported method on /api/scores returns 405")
    void unsupportedMethodReturns405() throws Exception {
        mockMvc.perform(delete("/api/scores"))
                .andExpect(status().isMethodNotAllowed());
    }

    @Test
    @DisplayName("POST without a JSON content type returns 415")
    void wrongContentTypeReturns415() throws Exception {
        mockMvc.perform(post("/api/scores")
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("playerName=Alice&score=10"))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    @DisplayName("An unknown API path returns 404")
    void unknownPathReturns404() throws Exception {
        mockMvc.perform(get("/api/does-not-exist"))
                .andExpect(status().isNotFound());
    }
}
