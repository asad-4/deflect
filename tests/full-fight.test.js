// Whole-fight simulations against the real logic with a seeded rng.
import { describe, expect, it } from 'vitest';
import { createGame, update } from '../src/logic/game.js';
import { emptyIntent } from '../src/logic/input.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A bot that deflects every glint, dodges the lunge, punishes the boss's
 * recovery with attacks (health damage slows its posture recovery) and
 * finishes when it can.
 */
function skilledBot(game, state) {
  const { enemy, player } = game;
  const intent = emptyIntent();
  if (enemy.state === 'broken') {
    intent.attack = true;
    intent.forward = 1;
    return intent;
  }
  const tg = enemy.telegraph;
  const key = tg ? `${enemy.stateStart}:${tg.strike}` : null;
  if (tg && tg.unblockable) {
    if (tg.msToImpact <= 150 && state.dodged !== key) {
      intent.dodge = true;
      intent.right = 1;
      state.dodged = key;
    }
    return intent;
  }
  if (tg && tg.msToImpact <= 100 && state.pressed !== key) {
    intent.blockPressed = true;
    state.pressed = key;
  }
  intent.blockHeld = Boolean(tg) && state.pressed === key;
  if (enemy.state === 'recovery' && player.status === 'ready') intent.attack = true;
  return intent;
}

function play(seed, bot, maxMs = 180000) {
  const game = createGame({ rng: mulberry32(seed) });
  const state = {};
  const counts = {};
  for (let t = 0; t < maxMs && game.status === 'playing'; t += 16) {
    update(game, bot(game, state), 16);
    for (const e of game.events) counts[e.type] = (counts[e.type] ?? 0) + 1;
  }
  return { game, counts };
}

describe('Full fight simulations', () => {
  it('R4/R7: a player who does nothing is defeated by the boss', () => {
    const { game, counts } = play(1, () => emptyIntent());
    expect(game.status).toBe('lost');
    expect(game.player.health.current).toBe(0);
    expect(counts.playerHit).toBeGreaterThan(0);
  });

  for (const seed of [1, 2, 3]) {
    it(`R2/R3/R5/R6: deflecting, dodging and punishing recovery wins (seed ${seed})`, () => {
      const { game, counts } = play(seed, skilledBot);
      expect(game.status).toBe('won');
      expect(game.player.health.current).toBe(100);
      expect(counts.deflect).toBeGreaterThan(0);
      expect(counts.finisher).toBe(1);
    });
  }
});
