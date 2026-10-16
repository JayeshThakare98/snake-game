package com.snakegame.controller;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Liveness endpoint used to confirm the backend is up and to let the frontend
 * decide whether to attempt score submission.
 */
@RestController
@RequestMapping("/api")
public class HealthController {

    /**
     * {@code GET /api/health}
     *
     * @return {@code 200 OK} with an unambiguous healthy status, the service
     *         name, and a server-side timestamp.
     */
    @GetMapping(value = "/health", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> health() {
        // LinkedHashMap keeps field order stable in the JSON output, which
        // makes responses easier to read and diff.
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "UP");
        body.put("service", "snake-game-backend");
        body.put("timestamp", Instant.now().toString());
        return body;
    }
}
