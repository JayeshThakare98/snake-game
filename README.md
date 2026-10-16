# Snake Game — HTML/CSS/JS frontend + Java Spring Boot backend

[![CI](https://github.com/JayeshThakare98/snake-game/actions/workflows/ci.yml/badge.svg)](https://github.com/JayeshThakare98/snake-game/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A complete, playable Snake game that runs entirely on your own machine.
The frontend is plain HTML, CSS and JavaScript; the backend is a small
Java 21 / Spring Boot service that serves the frontend and stores scores
in memory.

**No database, no API keys, no external accounts, no cloud services, no tracking.**

---

## Quick start

```bash
cd ~/Documents/HermesWorkspace/Projects/SnakeGame/backend
mvn spring-boot:run
```

Then open **<http://127.0.0.1:8080>**

To stop the server press `Ctrl+C` in that terminal.

---

## Project layout

```
SnakeGame/
├── frontend/                        # the game the browser runs
│   ├── index.html                   # markup, scoreboard, controls
│   ├── style.css                    # styling, responsive layout, dark theme
│   └── game.js                      # game engine + canvas rendering + API calls
│
├── backend/                         # Java Spring Boot service
│   ├── pom.xml                      # Maven build, Java 21, Spring Boot 3.3.5
│   └── src/
│       ├── main/
│       │   ├── java/com/snakegame/
│       │   │   ├── SnakeGameApplication.java    # entry point
│       │   │   ├── controller/
│       │   │   │   ├── HealthController.java    # GET /api/health
│       │   │   │   └── ScoreController.java     # GET/POST /api/scores
│       │   │   ├── service/
│       │   │   │   └── ScoreService.java        # in-memory store + validation
│       │   │   ├── model/
│       │   │   │   ├── ScoreSubmission.java     # incoming payload
│       │   │   │   └── ScoreEntry.java          # stored/returned record
│       │   │   └── exception/
│       │   │       ├── InvalidScoreException.java
│       │   │       └── GlobalExceptionHandler.java
│       │   └── resources/
│       │       └── application.properties       # port, host, logging
│       └── test/java/com/snakegame/             # 32 JUnit tests
│           ├── controller/ScoreControllerTest.java
│           └── service/ScoreServiceTest.java
│
├── tests/
│   └── game-engine.test.js          # 27 Node tests for the game engine
│
├── README.md
└── .gitignore
```

### Why the frontend lives in `frontend/` but is served by the backend

`backend/pom.xml` declares `../frontend` as an extra Maven resource directory
with `targetPath` = `static`. At build time those files land in
`target/classes/static/`, and Spring Boot serves `classpath:/static/`
automatically.

This keeps the sources in the layout you asked for, while giving the browser a
**single origin** (`http://127.0.0.1:8080`). Single origin means **no CORS
configuration and no second dev server** to manage.

---

## Playing

| Action | Keys |
|---|---|
| Move | `↑` `←` `↓` `→` or `W` `A` `S` `D` |
| Start / Pause / Resume | `Space` |
| Restart | `R` |

- Food is worth **10 points**. Every 5 pieces eaten raises the speed one level.
- Speed starts at 140 ms per step and stops accelerating at 62 ms, so it stays
  playable rather than becoming impossible.
- Hitting a wall or your own body ends the run.
- The snake cannot reverse into itself — a 180° turn is ignored even if you
  mash keys.
- The game auto-pauses when you switch browser tabs, so you don't die while
  looking away.

---

## API

| Method | Path | Behaviour |
|---|---|---|
| `GET` | `/api/health` | `200` `{"status":"UP","service":"snake-game-backend","timestamp":...}` |
| `GET` | `/api/scores` | `200` — JSON array of accepted scores, oldest first |
| `POST` | `/api/scores` | `201` with the stored entry on success, `400` on invalid input |

### Validation rules (`POST /api/scores`)

| Rule | Failure response |
|---|---|
| `playerName` present and not blank | `400 playerName must not be blank` |
| `playerName` ≤ 20 characters (after trimming) | `400 playerName must be at most 20 characters` |
| `score` present | `400 score must not be null` |
| `score` ≥ 0 | `400 score must not be negative` |
| `score` ≤ 100000 | `400 score must not exceed 100000` |
| body is valid JSON | `400 Malformed or missing JSON request body` |

Example:

```bash
curl -X POST http://127.0.0.1:8080/api/scores \
  -H 'Content-Type: application/json' \
  -d '{"playerName":"Alice","score":120}'
```

```json
{"id":1,"playerName":"Alice","score":120,"submittedAt":"2026-10-16T13:44:36.812436Z"}
```

### Behaviour when the backend is unavailable

The game is designed to degrade cleanly. If the API cannot be reached the
header indicator turns red and reads **offline**, the score list shows
*"Backend unavailable."*, the submit button disables itself, and **the game
itself keeps working normally** — you just can't post a score.

---

## Testing

### Backend — 32 JUnit tests

```bash
cd backend
mvn test
```

Covers: health endpoint, valid/zero/negative/oversized/missing/blank score
submissions, malformed JSON, score retrieval, store ordering and capacity,
snapshot immutability, reset behaviour, `405` on unsupported methods, `415` on
wrong content type, and `404` on unknown paths.

### Frontend engine — 27 Node tests

```bash
node --test tests/game-engine.test.js
```

The engine (`SnakeGame` in `frontend/game.js`) is deliberately free of DOM
calls, so it runs directly under Node. This covers movement, growth, scoring,
wall and self collisions, tail-chasing legality, reversal blocking, pause
semantics, speed progression and its floor, food placement bounds, and reset.

### Package

```bash
cd backend
mvn package            # -> target/snake-game-backend-1.0.0.jar (runs tests too)

# or run the built jar directly
java -jar target/snake-game-backend-1.0.0.jar
```

---

## Requirements

- **Java 21 LTS** (Eclipse Temurin) — installed at
  `~/Library/Java/JavaVirtualMachines/jdk-21.0.12.1+1/Contents/Home`
- **Maven 3.9.16** — installed at `~/.local/opt/apache-maven-3.9.16`,
  linked at `~/.local/bin/mvn`
- **Git** (not used by this project yet — no repository has been initialised)
- Node.js is only needed to run the optional frontend engine tests

Verify the toolchain:

```bash
java -version      # openjdk version "21.0.12.1" ... Temurin
javac -version     # javac 21.0.12.1
mvn -v             # Apache Maven 3.9.16
```

---

## Security notes

- The server binds to **`server.address=127.0.0.1`**, so it listens on
  loopback only and is not reachable from other machines on your network.
- No credentials, API keys, or secrets are used or stored anywhere in this project.
- Player names are escaped before being rendered into the DOM, so a submitted
  name cannot inject HTML.
- Nothing is deployed, published, or pushed anywhere.

---

## Current limitations

- **Scores are in-memory only.** Restarting the backend clears them. There is
  no database by design in this version.
- **No authentication.** Anyone who can reach the port could post a score —
  acceptable here because the port is loopback-only.
- **No persistence between sessions** and no shared/online leaderboard.
- The game engine tests cover logic, not pixels. Visual polish was confirmed by
  loading the real page in a browser, not by automated screenshot comparison.

---

## Continuous integration

`.github/workflows/ci.yml` runs both suites on every push and pull request to `main`:

| Job | What it runs |
|---|---|
| **Backend (Java 21 / Maven)** | `mvn -B -ntp test` on Temurin 21, with Maven dependency caching. Surefire reports are uploaded as an artifact. |
| **Frontend engine (Node)** | `node --test tests/game-engine.test.js` |

The badge at the top reflects the real status of that workflow — it is not a
hand-written or decorative label, so if a test breaks the badge turns red.

---

## License

[MIT](LICENSE) — Copyright (c) 2026 Jayesh Thakare.

You are free to use, modify, and distribute this project, including commercially,
provided the copyright notice and permission notice are retained.

