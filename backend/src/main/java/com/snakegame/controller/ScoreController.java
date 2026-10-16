package com.snakegame.controller;

import com.snakegame.exception.InvalidScoreException;
import com.snakegame.model.ScoreEntry;
import com.snakegame.model.ScoreSubmission;
import com.snakegame.service.ScoreService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Score endpoints.
 *
 * <p>The controller stays thin: it unwraps the request and delegates all
 * validation and storage to {@link ScoreService}.
 */
@RestController
@RequestMapping("/api")
public class ScoreController {

    private final ScoreService scoreService;

    public ScoreController(ScoreService scoreService) {
        this.scoreService = scoreService;
    }

    /**
     * {@code GET /api/scores}
     *
     * @return {@code 200 OK} with every score accepted in this session.
     */
    @GetMapping(value = "/scores", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<ScoreEntry> listScores() {
        return scoreService.findAll();
    }

    /**
     * {@code POST /api/scores}
     *
     * <p>{@code required = false} lets a completely absent body reach our own
     * validation and produce a clean 400 message, rather than a framework-level
     * deserialization error.
     *
     * @return {@code 201 Created} with the stored entry
     * @throws InvalidScoreException if the body is missing or fails validation
     */
    @PostMapping(
            value = "/scores",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ScoreEntry submitScore(@RequestBody(required = false) ScoreSubmission submission) {
        if (submission == null) {
            throw new InvalidScoreException("Request body is required");
        }
        return scoreService.submit(submission.playerName(), submission.score());
    }
}
