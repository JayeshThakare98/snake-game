/* ==========================================================================
   Automated tests for the Snake game engine (frontend/game.js).

   The engine is deliberately DOM-free, so it can be exercised directly in
   Node - no browser, no headless Chrome, no testing framework to download.
   Run with:  node --test tests/

   These assert real behaviour: movement, growth, scoring, both collision
   types, reversal blocking, pause semantics, speed progression, and reset.
   ========================================================================== */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { SnakeGame, DIR, RULES } = require('../frontend/game.js');

/* ------------------------------------------------------------------ helpers */

/** A deterministic RNG so food positions are reproducible. */
function seededRng(seed = 42) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Builds a game with a hand-placed snake, bypassing the normal start state. */
function gameWith(snake, direction, extra = {}) {
  const game = new SnakeGame({ cols: 10, rows: 10, rng: seededRng(7) });
  game.snake = snake.map((s) => ({ ...s }));
  game.direction = direction;
  game.queue = [];
  game.score = 0;
  game.foodEaten = 0;
  game.state = 'running';
  game.food = extra.food ?? { x: 9, y: 9 }; // far away unless overridden
  return game;
}

const at = (snake, x, y) => snake.some((s) => s.x === x && s.y === y);

/* ------------------------------------------------------- initial conditions */

test('a fresh game starts idle with a valid board', () => {
  const game = new SnakeGame({ rng: seededRng(1) });

  assert.equal(game.state, 'idle');
  assert.equal(game.score, 0);
  assert.equal(game.snake.length, RULES.START_LENGTH);
  assert.equal(game.level, 1);
  assert.ok(game.food, 'food should be placed on reset');
});

test('food never spawns on top of the snake', () => {
  const game = new SnakeGame({ rng: seededRng(3) });

  for (let i = 0; i < 500; i++) {
    game.spawnFood();
    const head = game.snake[0];
    assert.ok(
      !at(game.snake, game.food.x, game.food.y),
      `food spawned on the snake at ${game.food.x},${game.food.y}`,
    );
    // Nudge the snake so the occupied set changes between iterations.
    game.snake.unshift({ x: (head.x + 1) % game.cols, y: head.y });
    game.snake.pop();
  }
});

test('food always lands inside the board bounds', () => {
  const game = new SnakeGame({ rng: seededRng(11) });

  for (let i = 0; i < 300; i++) {
    game.spawnFood();
    assert.ok(game.food.x >= 0 && game.food.x < game.cols);
    assert.ok(game.food.y >= 0 && game.food.y < game.rows);
  }
});

/* ---------------------------------------------------------------- movement */

test('a running game advances one cell per step', () => {
  const game = gameWith([{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }], DIR.RIGHT);

  const event = game.step();

  assert.equal(event, 'move');
  assert.deepEqual(game.snake[0], { x: 5, y: 4 });
  assert.equal(game.snake.length, 3, 'length is unchanged when no food is eaten');
});

test('stepping a paused game does nothing', () => {
  const game = gameWith([{ x: 4, y: 4 }, { x: 3, y: 4 }], DIR.RIGHT);
  game.pause();

  assert.equal(game.step(), null);
  assert.deepEqual(game.snake[0], { x: 4, y: 4 }, 'the head must not move');
});

test('stepping an idle game does nothing', () => {
  const game = new SnakeGame({ rng: seededRng(5) });
  assert.equal(game.step(), null);
});

test('moving up and left works', () => {
  const game = gameWith([{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 }], DIR.UP);
  game.step();
  assert.deepEqual(game.snake[0], { x: 5, y: 4 });
});

/* ------------------------------------------------------------------ eating */

test('eating food scores 10, grows the snake, and respawns food', () => {
  const game = gameWith(
    [{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }],
    DIR.RIGHT,
    { food: { x: 5, y: 4 } },
  );

  const event = game.step();

  assert.equal(event, 'eat');
  assert.equal(game.score, 10);
  assert.equal(game.snake.length, 4, 'the tail is retained when growing');
  assert.deepEqual(game.snake[0], { x: 5, y: 4 });
  assert.ok(!at(game.snake, game.food.x, game.food.y), 'new food must avoid the snake');
});

test('score accumulates across multiple meals', () => {
  const game = gameWith([{ x: 2, y: 5 }], DIR.RIGHT, { food: { x: 3, y: 5 } });

  game.step(); // eat at 3,5 -> score 10
  game.food = { x: 4, y: 5 };
  game.step(); // eat at 4,5 -> score 20
  game.food = { x: 5, y: 5 };
  game.step(); // eat at 5,5 -> score 30

  assert.equal(game.score, 30);
  assert.equal(game.foodEaten, 3);
  assert.equal(game.snake.length, 4);
});

/* -------------------------------------------------------------- collisions */

test('hitting a wall ends the game', () => {
  const game = gameWith([{ x: 0, y: 5 }, { x: 1, y: 5 }], DIR.LEFT);

  assert.equal(game.step(), 'dead');
  assert.equal(game.state, 'over');
});

test('hitting the far wall ends the game', () => {
  const game = gameWith([{ x: 9, y: 5 }, { x: 8, y: 5 }], DIR.RIGHT);

  assert.equal(game.step(), 'dead');
  assert.equal(game.state, 'over');
});

test('hitting your own body ends the game', () => {
  // A hook shape: moving up drives the head straight into its own middle.
  const game = gameWith(
    [{ x: 4, y: 4 }, { x: 4, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 4 }, { x: 2, y: 4 }],
    DIR.UP,
  );

  assert.equal(game.step(), 'dead');
  assert.equal(game.state, 'over');
});

test('chasing your own tail is legal when not growing', () => {
  // The tail vacates its cell during this tick, so entering it must not kill you.
  const game = gameWith(
    [{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 3, y: 5 }, { x: 4, y: 5 }],
    DIR.DOWN,
  );

  const event = game.step();

  assert.equal(event, 'move');
  assert.equal(game.state, 'running');
  assert.deepEqual(game.snake[0], { x: 4, y: 5 });
});

test('the game stops responding to steps once it is over', () => {
  const game = gameWith([{ x: 0, y: 5 }], DIR.LEFT);
  game.step();

  assert.equal(game.state, 'over');
  assert.equal(game.step(), null);
});

/* ---------------------------------------------------- reversal prevention */

test('an immediate 180-degree turn is rejected', () => {
  const game = gameWith([{ x: 4, y: 4 }, { x: 3, y: 4 }], DIR.RIGHT);

  assert.equal(game.setDirection(DIR.LEFT), false, 'RIGHT -> LEFT must be refused');
  assert.equal(game.queue.length, 0);
});

test('a legal turn is accepted and applied on the next step', () => {
  const game = gameWith([{ x: 4, y: 4 }, { x: 3, y: 4 }], DIR.RIGHT);

  assert.equal(game.setDirection(DIR.UP), true);
  game.step();

  assert.deepEqual(game.snake[0], { x: 4, y: 3 });
});

test('a reversal is rejected even when queued after a legal turn', () => {
  const game = gameWith([{ x: 4, y: 4 }, { x: 3, y: 4 }], DIR.RIGHT);

  assert.equal(game.setDirection(DIR.UP), true);
  // UP -> DOWN would be an instant reversal of the queued turn, and would
  // fold the snake back into its own neck.
  assert.equal(game.setDirection(DIR.DOWN), false);

  game.step();
  assert.deepEqual(game.snake[0], { x: 4, y: 3 });
});

test('repeating the current direction is a no-op', () => {
  const game = gameWith([{ x: 4, y: 4 }, { x: 3, y: 4 }], DIR.RIGHT);

  assert.equal(game.setDirection(DIR.RIGHT), false);
  assert.equal(game.queue.length, 0);
});

test('rapid key presses cannot fold the snake into itself', () => {
  const game = new SnakeGame({ cols: 24, rows: 24, rng: seededRng(2) });
  game.start();

  // Hammer opposing directions, as a panicking player would.
  for (let i = 0; i < 40; i++) {
    game.setDirection(DIR.UP);
    game.setDirection(DIR.DOWN);
    game.setDirection(DIR.LEFT);
    game.step();

    if (game.isOver) break;
    const head = game.snake[0];
    const body = game.snake.slice(1);
    assert.ok(
      !body.some((s) => s.x === head.x && s.y === head.y),
      'the snake collided with itself while only turning',
    );
  }
});

/* ------------------------------------------------------ speed progression */

test('level advances every 5 pieces of food', () => {
  const game = new SnakeGame({ rng: seededRng(4) });

  assert.equal(game.level, 1);
  game.foodEaten = 4;
  assert.equal(game.level, 1);
  game.foodEaten = 5;
  assert.equal(game.level, 2);
  game.foodEaten = 10;
  assert.equal(game.level, 3);
});

test('the tick gets faster with each level but never below the floor', () => {
  const game = new SnakeGame({ rng: seededRng(6) });

  assert.equal(game.tickMs, RULES.BASE_TICK_MS);

  game.foodEaten = 5;
  const level2 = game.tickMs;
  assert.ok(level2 < RULES.BASE_TICK_MS, 'level 2 must be faster than level 1');

  game.foodEaten = 500;
  assert.equal(game.tickMs, RULES.MIN_TICK_MS, 'speed must clamp at the playable floor');
});

/* -------------------------------------------------------- pause / resume */

test('pause and resume preserve state', () => {
  const game = gameWith([{ x: 4, y: 4 }, { x: 3, y: 4 }], DIR.RIGHT);

  game.pause();
  assert.equal(game.state, 'paused');
  game.step();
  assert.deepEqual(game.snake[0], { x: 4, y: 4 }, 'a paused game must not move');

  game.start();
  assert.equal(game.state, 'running');
  game.step();
  assert.deepEqual(game.snake[0], { x: 5, y: 4 }, 'play resumes where it left off');
});

test('togglePause flips between running and paused', () => {
  const game = new SnakeGame({ rng: seededRng(8) });

  assert.equal(game.togglePause(), 'running');
  assert.equal(game.togglePause(), 'paused');
  assert.equal(game.togglePause(), 'running');
});

test('pausing an over game does not resurrect it', () => {
  const game = gameWith([{ x: 0, y: 5 }], DIR.LEFT);
  game.step();

  game.togglePause();
  assert.equal(game.state, 'over');
});

/* ------------------------------------------------------------------- reset */

test('reset restores score, length, direction, food and state', () => {
  const game = gameWith([{ x: 2, y: 2 }, { x: 1, y: 2 }], DIR.LEFT);
  game.score = 240;
  game.foodEaten = 12;
  game.state = 'over';

  const before = game.food;
  game.reset();

  assert.equal(game.score, 0);
  assert.equal(game.foodEaten, 0);
  assert.equal(game.snake.length, RULES.START_LENGTH);
  assert.equal(game.state, 'idle');
  assert.deepEqual(game.direction, DIR.RIGHT);
  assert.equal(game.queue.length, 0);
  assert.ok(game.food, 'food exists after a reset');
  assert.ok(before === null || game.food !== null);
});

test('restarting makes the game playable again after a loss', () => {
  const game = gameWith([{ x: 0, y: 5 }], DIR.LEFT);
  game.step();
  assert.equal(game.state, 'over');

  game.reset();
  game.start();
  const event = game.step();

  assert.equal(event, 'move');
  assert.equal(game.state, 'running');
});

/* -------------------------------------------------------------- win state */

test('a full board produces a win instead of food', () => {
  const game = new SnakeGame({ cols: 2, rows: 2, rng: seededRng(9) });
  // Occupy every cell.
  game.snake = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
  ];

  const food = game.spawnFood();

  assert.equal(food, null);
  assert.equal(game.food, null);
  assert.equal(game.state, 'won');
});
