package com.snakegame;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for the Snake game backend.
 *
 * <p>This is deliberately a very small Spring Boot application: an in-memory
 * score store, a couple of REST endpoints, and static hosting for the
 * frontend. No database, no security layer, no external services.
 */
@SpringBootApplication
public class SnakeGameApplication {

    public static void main(String[] args) {
        SpringApplication.run(SnakeGameApplication.class, args);
    }
}
