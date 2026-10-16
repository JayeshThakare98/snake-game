/* ==========================================================================
   Snake - game logic + UI controller

   The file has two halves on purpose:

     1. SnakeGame - the pure game engine. It touches no DOM API, so it can be
        driven and asserted against directly from Node (see
        ../tests/game-engine.test.js). This is what makes the game logic
        automatically verifiable rather than "looks right in a browser".

     2. initUI() - the browser controller: canvas rendering, keyboard input,
        buttons, and the calls to the Spring Boot backend. It only runs when a
        real `document` exists.

   Everything is plain ES2020. No frameworks, no build step, no external assets.
   ========================================================================== */

'use strict';

/* -------------------------------------------------------------- constants */

const DIR = Object.freeze({
  UP:    Object.freeze({ x: 0,  y: -1 }),
  DOWN:  Object.freeze({ x: 0,  y: 1  }),
  LEFT:  Object.freeze({ x: -1, y: 0  }),
  RIGHT: Object.freeze({ x: 1,  y: 0  }),
});

const RULES = Object.freeze({
  COLS: 24,
  ROWS: 24,
  START_LENGTH: 3,
  POINTS_PER_FOOD: 10,
  /** Level 1 tick length in milliseconds; lower = faster. */
  BASE_TICK_MS: 140,
  /** Fastest the game is allowed to get, so it stays humanly playable. */
  MIN_TICK_MS: 62,
  /** Milliseconds shaved off the tick per level. */
  TICK_STEP_MS: 8,
  /** Food eaten required to advance one level. */
  FOODS_PER_LEVEL: 5,
});

/* ==========================================================================
   1. Engine
   ========================================================================== */

class SnakeGame {
  /**
   * @param {object} [options]
   * @param {number} [options.cols]
   * @param {number} [options.rows]
   * @param {() => number} [options.rng] injectable RNG - lets tests be deterministic
   */
  constructor(options = {}) {
    this.cols = options.cols ?? RULES.COLS;
    this.rows = options.rows ?? RULES.ROWS;
    this.rng = options.rng ?? Math.random;
    this.reset();
  }

  /** Restores a fresh game. Every piece of state is rebuilt from scratch. */
  reset() {
    const midY = Math.floor(this.rows / 2);
    const headX = Math.floor(this.cols / 2);

    // Index 0 is the head; the body trails behind it.
    this.snake = [];
    for (let i = 0; i < RULES.START_LENGTH; i++) {
      this.snake.push({ x: headX - i, y: midY });
    }

    this.direction = DIR.RIGHT;
    /** Buffered turns - absorbs fast key presses without allowing reversals. */
    this.queue = [];
    this.score = 0;
    this.foodEaten = 0;
    this.state = 'idle'; // idle | running | paused | over | won
    this.spawnFood();
  }

  /** Current difficulty level, starting at 1. */
  get level() {
    return 1 + Math.floor(this.foodEaten / RULES.FOODS_PER_LEVEL);
  }

  /** Milliseconds between ticks at the current level. */
  get tickMs() {
    const raw = RULES.BASE_TICK_MS - (this.level - 1) * RULES.TICK_STEP_MS;
    return Math.max(RULES.MIN_TICK_MS, raw);
  }

  get isOver() {
    return this.state === 'over' || this.state === 'won';
  }

  /**
   * Queues a direction change.
   *
   * Reversal is rejected against the last *already-queued* direction rather
   * than the current one, so rapid key presses cannot fold the snake back into
   * its own neck.
   *
   * @returns {boolean} true if the turn was accepted
   */
  setDirection(next) {
    if (!next) return false;
    const base = this.queue.length ? this.queue[this.queue.length - 1] : this.direction;

    if (next.x === -base.x && next.y === -base.y) return false; // 180-degree turn
    if (next.x === base.x && next.y === base.y) return false;   // no change
    if (this.queue.length >= 2) return false;                   // keep the buffer shallow

    this.queue.push(next);
    return true;
  }

  /** Picks a uniformly random empty cell for the next food. */
  spawnFood() {
    const occupied = new Set(this.snake.map((s) => `${s.x},${s.y}`));
    const free = [];
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (!occupied.has(`${x},${y}`)) free.push({ x, y });
      }
    }

    if (free.length === 0) {
      this.food = null;
      this.state = 'won';
      return null;
    }

    // Clamp guards against an rng that returns exactly 1.
    const idx = Math.min(free.length - 1, Math.floor(this.rng() * free.length));
    this.food = free[idx];
    return this.food;
  }

  /** Begins play. Safe to call on an already-running game. */
  start() {
    if (this.state === 'idle' || this.state === 'paused') this.state = 'running';
    return this.state;
  }

  pause() {
    if (this.state === 'running') this.state = 'paused';
    return this.state;
  }

  /** Toggles between running and paused. */
  togglePause() {
    if (this.state === 'running') return this.pause();
    if (this.state === 'paused' || this.state === 'idle') return this.start();
    return this.state;
  }

  /**
   * Advances the simulation by exactly one tick.
   *
   * @returns {'move'|'eat'|'dead'|null} what happened, or null if not running
   */
  step() {
    if (this.state !== 'running') return null;

    if (this.queue.length) this.direction = this.queue.shift();

    const head = this.snake[0];
    const next = { x: head.x + this.direction.x, y: head.y + this.direction.y };

    // --- wall collision ---
    if (next.x < 0 || next.x >= this.cols || next.y < 0 || next.y >= this.rows) {
      this.state = 'over';
      return 'dead';
    }

    const willEat = this.food !== null && next.x === this.food.x && next.y === this.food.y;

    // --- self collision ---
    // When the snake is not growing, the tail cell is vacated during this same
    // tick, so chasing your own tail is legal. Only the remaining segments block.
    const obstacles = willEat ? this.snake : this.snake.slice(0, this.snake.length - 1);
    if (obstacles.some((s) => s.x === next.x && s.y === next.y)) {
      this.state = 'over';
      return 'dead';
    }

    this.snake.unshift(next);

    if (willEat) {
      this.score += RULES.POINTS_PER_FOOD;
      this.foodEaten += 1;
      this.spawnFood();
      return 'eat';
    }

    this.snake.pop();
    return 'move';
  }
}

/* ==========================================================================
   2. Browser UI
   ========================================================================== */

function initUI() {
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');

  const els = {
    score: document.getElementById('score'),
    best: document.getElementById('best'),
    level: document.getElementById('level'),
    overlay: document.getElementById('overlay'),
    overlayTitle: document.getElementById('overlay-title'),
    overlayText: document.getElementById('overlay-text'),
    overlayFinal: document.getElementById('overlay-final'),
    start: document.getElementById('btn-start'),
    pause: document.getElementById('btn-pause'),
    restart: document.getElementById('btn-restart'),
    submit: document.getElementById('btn-submit'),
    refresh: document.getElementById('btn-refresh'),
    playerName: document.getElementById('player-name'),
    submitStatus: document.getElementById('submit-status'),
    scoreList: document.getElementById('scorelist'),
    backendDot: document.getElementById('backend-dot'),
    backendText: document.getElementById('backend-text'),
  };

  const game = new SnakeGame();
  let timerId = null;
  let bestScore = Number(localStorage.getItem('snake.best') || 0);
  let backendUp = false;
  let submittedThisRound = false;

  /* ------------------------------------------------------------ rendering */

  const THEME = {
    bgTop: '#0e151d',
    bgBottom: '#0a1017',
    grid: 'rgba(255,255,255,0.028)',
    snakeHead: '#5ef2a0',
    snakeBody: '#3ddc84',
    snakeTail: '#2aa563',
    food: '#ff6b6b',
  };

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    // Cap DPR at 2: beyond that the visual gain is negligible but the cost is not.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.max(240, Math.round(rect.width * dpr));
    if (canvas.width !== px) {
      canvas.width = px;
      canvas.height = px;
    }
  }

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function draw() {
    resizeCanvas();

    const size = canvas.width;
    const cell = size / game.cols;

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, THEME.bgTop);
    grad.addColorStop(1, THEME.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Grid
    ctx.strokeStyle = THEME.grid;
    ctx.lineWidth = Math.max(1, size / 960);
    for (let i = 1; i < game.cols; i++) {
      const p = i * cell;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
    }

    // Food
    if (game.food) {
      const cx = game.food.x * cell + cell / 2;
      const cy = game.food.y * cell + cell / 2;
      const r = cell * 0.28;

      ctx.save();
      ctx.shadowColor = 'rgba(255,107,107,0.55)';
      ctx.shadowBlur = cell * 0.8;
      ctx.fillStyle = THEME.food;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Snake - drawn tail first so the head paints on top
    const total = game.snake.length;
    for (let i = total - 1; i >= 0; i--) {
      const seg = game.snake[i];
      const t = total > 1 ? i / (total - 1) : 0;

      ctx.fillStyle = i === 0
        ? THEME.snakeHead
        : (t > 0.6 ? THEME.snakeTail : THEME.snakeBody);

      if (i === 0) {
        ctx.save();
        ctx.shadowColor = 'rgba(93,242,160,0.5)';
        ctx.shadowBlur = cell * 0.7;
      }

      const pad = cell * 0.08;
      roundRect(
        seg.x * cell + pad,
        seg.y * cell + pad,
        cell - pad * 2,
        cell - pad * 2,
        cell * 0.26,
      );
      ctx.fill();

      if (i === 0) ctx.restore();
    }

    // Eyes, oriented to the direction of travel
    const head = game.snake[0];
    if (head) {
      const hx = head.x * cell + cell / 2;
      const hy = head.y * cell + cell / 2;
      const off = cell * 0.17;
      const eyeR = Math.max(1.1, cell * 0.075);
      const d = game.direction;

      // Perpendicular offset places the eyes on either side of the snout
      const perp = { x: -d.y, y: d.x };
      const forward = cell * 0.15;

      ctx.fillStyle = '#06210f';
      for (const sign of [1, -1]) {
        ctx.beginPath();
        ctx.arc(
          hx + perp.x * off * sign + d.x * forward,
          hy + perp.y * off * sign + d.y * forward,
          eyeR, 0, Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  /* -------------------------------------------------------------- overlay */

  function setOverlay(visible, title, text, finalLine, isGameOver) {
    els.overlay.hidden = !visible;
    if (!visible) return;

    els.overlayTitle.textContent = title;
    els.overlayTitle.classList.toggle('overlay__title--over', Boolean(isGameOver));
    els.overlayText.innerHTML = text;

    if (finalLine) {
      els.overlayFinal.textContent = finalLine;
      els.overlayFinal.hidden = false;
    } else {
      els.overlayFinal.hidden = true;
    }
  }

  /* ---------------------------------------------------------------- stats */

  function syncStats() {
    els.score.textContent = String(game.score);
    els.best.textContent = String(bestScore);
    els.level.textContent = String(game.level);
  }

  function syncButtons() {
    const running = game.state === 'running';
    const playable = game.state === 'idle' || game.state === 'paused';

    els.start.disabled = running || game.isOver;
    els.start.textContent = game.state === 'paused' ? 'Resume' : 'Start';
    els.pause.disabled = !running && game.state !== 'paused';
    els.pause.textContent = game.state === 'paused' ? 'Resume' : 'Pause';
    els.submit.disabled = !game.isOver || submittedThisRound || !backendUp;

    // `playable` is intentionally unused for layout but documents intent:
    // Start is the only control enabled from a fresh board.
    void playable;
  }

  function showIdleOverlay() {
    setOverlay(true, 'Ready?', 'Press <kbd>Space</kbd> or the Start button.', null, false);
  }

  function showPausedOverlay() {
    setOverlay(true, 'Paused', 'Press <kbd>Space</kbd> or Resume to continue.', null, false);
  }

  function showGameOverOverlay() {
    const message = game.state === 'won'
      ? 'You filled the entire board. Remarkable.'
      : 'Press <kbd>R</kbd> or Restart to play again.';

    setOverlay(
      true,
      game.state === 'won' ? 'Board cleared!' : 'Game over',
      message,
      `Final score: ${game.score}  ·  Level ${game.level}`,
      game.state === 'over',
    );
  }

  /* ------------------------------------------------------------- game loop */

  function stopLoop() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  /** Schedules the next tick using the level-dependent interval. */
  function scheduleNextTick() {
    stopLoop();
    if (game.state !== 'running') return;
    timerId = window.setTimeout(() => {
      tick();
      scheduleNextTick();
    }, game.tickMs);
  }

  function tick() {
    const event = game.step();

    if (event === 'dead') {
      finishRound();
      return;
    }
    if (event === 'eat') {
      syncStats();
      // Speed changed -> reschedule at the new interval.
    }
    draw();
  }

  function finishRound() {
    stopLoop();
    draw();

    if (game.score > bestScore) {
      bestScore = game.score;
      try { localStorage.setItem('snake.best', String(bestScore)); } catch (_) { /* private mode */ }
    }

    submittedThisRound = false;
    syncStats();
    syncButtons();
    showGameOverOverlay();
  }

  /* ---------------------------------------------------------------- actions */

  function startGame() {
    if (game.state === 'idle' || game.state === 'paused') {
      game.start();
      setOverlay(false);
      syncButtons();
      draw();
      scheduleNextTick();
    }
  }

  function pauseGame() {
    if (game.state === 'running') {
      game.pause();
      stopLoop();
      syncButtons();
      showPausedOverlay();
    } else if (game.state === 'paused' || game.state === 'idle') {
      startGame();
    }
  }

  function restartGame() {
    stopLoop();
    game.reset();
    submittedThisRound = false;
    els.submitStatus.textContent = '';
    els.submitStatus.className = 'status';
    syncStats();
    syncButtons();
    draw();
    showIdleOverlay();
  }

  function togglePlay() {
    if (game.isOver) restartGame();
    else if (game.state === 'running') pauseGame();
    else startGame();
  }

  /* ----------------------------------------------------------- input */

  const KEY_MAP = {
    ArrowUp: DIR.UP,    w: DIR.UP,    W: DIR.UP,
    ArrowDown: DIR.DOWN, s: DIR.DOWN, S: DIR.DOWN,
    ArrowLeft: DIR.LEFT, a: DIR.LEFT, A: DIR.LEFT,
    ArrowRight: DIR.RIGHT, d: DIR.RIGHT, D: DIR.RIGHT,
  };

  function onKeyDown(e) {
    // Never hijack keys while the user is typing a player name.
    const target = e.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

    const dir = KEY_MAP[e.key];
    if (dir) {
      // Stop the page from scrolling while playing.
      e.preventDefault();
      if (game.state === 'idle') startGame();
      game.setDirection(dir);
      return;
    }

    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      togglePlay();
      return;
    }

    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      restartGame();
    }
  }

  /* -------------------------------------------------------- backend calls */

  const API = { health: '/api/health', scores: '/api/scores' };
  const REQUEST_TIMEOUT_MS = 4000;

  /** fetch with a hard timeout so a hung backend can never freeze the game. */
  async function request(url, options = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function setBackendStatus(up, text) {
    backendUp = up;
    els.backendDot.className = `dot dot--${up ? 'up' : 'down'}`;
    els.backendText.textContent = text;
    syncButtons();
  }

  async function checkBackend() {
    try {
      const res = await request(API.health, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const healthy = body && body.status === 'UP';
      setBackendStatus(healthy, healthy ? 'online' : 'unexpected reply');
    } catch (_) {
      setBackendStatus(false, 'offline');
    }
  }

  async function loadScores() {
    try {
      const res = await request(API.scores, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const scores = await res.json();
      renderScores(Array.isArray(scores) ? scores : []);
    } catch (_) {
      els.scoreList.innerHTML =
        '<li class="scorelist__empty">Backend unavailable.</li>';
    }
  }

  function renderScores(scores) {
    if (!scores.length) {
      els.scoreList.innerHTML = '<li class="scorelist__empty">No scores yet.</li>';
      return;
    }

    // Newest first for readability.
    const ordered = [...scores].reverse();
    els.scoreList.innerHTML = ordered.map((s, i) => {
      const name = String(s.playerName ?? '?');
      const score = Number(s.score ?? 0);
      return `<li>
        <span class="scorelist__rank">${i + 1}.</span>
        <span class="scorelist__name"></span>
        <span class="scorelist__score">${score}</span>
      </li>`.replace(
        '<span class="scorelist__name"></span>',
        `<span class="scorelist__name">${escapeHtml(name)}</span>`,
      );
    }).join('');
  }

  /** Scores come back from the server, so never interpolate them as raw HTML. */
  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function setStatus(text, kind) {
    els.submitStatus.textContent = text;
    els.submitStatus.className = kind ? `status status--${kind}` : 'status';
  }

  async function submitCurrentScore() {
    if (!game.isOver) return;

    const name = (els.playerName.value || 'Anonymous').trim().slice(0, 20);
    els.submit.disabled = true;
    setStatus('Submitting…');

    try {
      const res = await request(API.scores, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ playerName: name, score: game.score }),
      });

      if (res.status === 201) {
        submittedThisRound = true;
        setStatus('Score saved.', 'ok');
        loadScores();
      } else {
        let reason = `HTTP ${res.status}`;
        try {
          const err = await res.json();
          if (err && err.message) reason = err.message;
        } catch (_) { /* non-JSON error body */ }
        setStatus(`Rejected: ${reason}`, 'error');
        els.submit.disabled = false;
      }
    } catch (_) {
      // Network-level failure: the game itself is unaffected.
      setStatus('Backend unavailable — score not saved.', 'warn');
      setBackendStatus(false, 'offline');
      els.submit.disabled = false;
    }
  }

  /* ------------------------------------------------------------------ wire */

  els.start.addEventListener('click', startGame);
  els.pause.addEventListener('click', pauseGame);
  els.restart.addEventListener('click', restartGame);
  els.submit.addEventListener('click', submitCurrentScore);
  els.refresh.addEventListener('click', () => { checkBackend(); loadScores(); });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', draw);

  // Pause automatically when the tab loses focus, so the snake does not run
  // into a wall while the player is looking elsewhere.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'running') pauseGame();
  });

  document.addEventListener('DOMContentLoaded', () => { /* already fired below */ });

  restartGame();     // establishes the initial board + overlay
  checkBackend();
  loadScores();
}

/* ------------------------------------------------------------- bootstrap */

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
}

/* Expose the engine for Node-side tests and browser debugging. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SnakeGame, DIR, RULES };
}
