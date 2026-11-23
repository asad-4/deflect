import { createGame, update } from '../src/logic/game.js';
import { emptyIntent } from '../src/logic/input.js';
import { startAttack } from '../src/logic/enemyAI.js';

export const STEP = 10;

/** rng that returns the given values in order, then repeats the last one. */
export function seq(...values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

/** New game with the player placed `distance` m in front of the boss. */
export function newGame({ distance = 2.5, rng = seq(0) } = {}) {
  const game = createGame({ rng });
  game.player.pos.x = 0;
  game.player.pos.z = distance;
  return game;
}

/** Stops the boss from acting on its own (it stays in an endless idle). */
export function holdEnemy(game) {
  game.enemy.idleUntil = Infinity;
  game.enemy.pos.x = 0;
  game.enemy.pos.z = 0;
  return game;
}

/** Freezes the boss completely (no walking, no attacks). */
export function freezeEnemy(game) {
  game.enemy.state = 'recovery';
  game.enemy.recoveryUntil = Infinity;
  return game;
}

/** Makes the boss begin an attack right now. Returns the first impact time. */
export function bossAttacks(game, attackId) {
  startAttack(game.enemy, attackId, game.time);
  return game.enemy.impactAt;
}

/**
 * Advances `ms` in STEP increments holding `held` keys; returns all events.
 * `held` may contain forward/right/blockHeld.
 */
export function run(game, ms, held = {}) {
  const events = [];
  for (let t = 0; t < ms; t += STEP) {
    update(game, emptyIntent(held), STEP);
    events.push(...game.events);
  }
  return events;
}

/** One STEP with press edges (e.g. { attack: true }). Returns its events. */
export function tap(game, intent) {
  update(game, emptyIntent(intent), STEP);
  return [...game.events];
}

/** Advance until game.time === target (target must be on the STEP grid). */
export function runUntil(game, target, held = {}) {
  return run(game, target - game.time, held);
}

/** Presses block at the current time, then keeps it held until `until`. */
export function blockAt(game, until) {
  const events = tap(game, { blockPressed: true, blockHeld: true });
  events.push(...runUntil(game, until, { blockHeld: true }));
  return events;
}

export function types(events) {
  return events.map((e) => e.type);
}
