import { describe, expect, it } from 'vitest';
import { mapKey, createInputState, pressAction, consumeIntent } from '../src/logic/input.js';
import { breakEnemy } from '../src/logic/enemyAI.js';
import { ENEMY, SPECIAL } from '../src/logic/constants.js';
import { update } from '../src/logic/game.js';
import { emptyIntent } from '../src/logic/input.js';
import {
  bossAttacks,
  freezeEnemy,
  holdEnemy,
  newGame,
  run,
  runUntil,
  STEP,
  tap,
  types,
} from './helpers.js';

/** Frozen boss in recovery (takes full hits), player with a full Focus meter. */
function ready({ distance = 2.5, focus = SPECIAL.focusMax } = {}) {
  const game = freezeEnemy(newGame({ distance }));
  game.player.focus = focus;
  return game;
}

/** Presses J, J, L with `gap` ms between presses. Returns all events. */
function jjl(game, gap = 100) {
  const events = tap(game, { attack: true });
  events.push(...run(game, gap - STEP));
  events.push(...tap(game, { attack: true }));
  events.push(...run(game, gap - STEP));
  events.push(...tap(game, { special: true }));
  return events;
}

describe('R9: Ember Strike input', () => {
  it('R9: L maps to the special action', () => {
    expect(mapKey('KeyL')).toBe('special');
  });

  it('R9: an L press shows up in the frame intent', () => {
    const input = createInputState();
    pressAction(input, 'special');
    expect(consumeIntent(input).special).toBe(true);
    expect(consumeIntent(input).special).toBe(false);
  });

  it('R9: J, J, L with a full Focus meter starts the Ember Strike', () => {
    const game = ready();
    const events = jjl(game);
    expect(types(events)).toContain('specialStart');
    expect(game.player.attackKind).toBe('special');
    expect(game.player.focus).toBe(0);
  });

  it('R9: L alone does nothing', () => {
    const game = ready();
    const events = tap(game, { special: true });
    expect(types(events)).not.toContain('specialStart');
    expect(game.player.focus).toBe(SPECIAL.focusMax);
  });

  it('R9: J, L (only one J) does nothing', () => {
    const game = ready();
    tap(game, { attack: true });
    run(game, 100);
    const events = tap(game, { special: true });
    expect(types(events)).not.toContain('specialStart');
  });

  it('R9: the sequence must fit in 800 ms from the first J to L', () => {
    const fits = ready();
    jjl(fits, SPECIAL.inputWindow / 2);
    expect(fits.player.attackKind).toBe('special');

    const tooSlow = ready();
    const events = jjl(tooSlow, SPECIAL.inputWindow / 2 + STEP);
    expect(types(events)).not.toContain('specialStart');
    expect(tooSlow.player.focus).toBe(SPECIAL.focusMax);
  });

  it('R9: a block press between J, J and L breaks the sequence', () => {
    const game = ready();
    tap(game, { attack: true });
    run(game, 90);
    tap(game, { attack: true });
    run(game, 500); // let the swing finish
    tap(game, { blockPressed: true, blockHeld: true });
    const events = tap(game, { special: true });
    expect(types(events)).not.toContain('specialStart');
  });

  it('R9: each L press clears the sequence, so J, J, L, L gives one strike', () => {
    const game = ready();
    jjl(game);
    game.player.focus = SPECIAL.focusMax;
    const events = tap(game, { special: true });
    expect(types(events)).not.toContain('specialStart');
  });
});

describe('R9: Focus meter', () => {
  it('R9: Focus starts at 0', () => {
    expect(newGame().player.focus).toBe(0);
  });

  it('R9: each perfect deflect adds 1 Focus', () => {
    const game = holdEnemy(newGame());
    const impact = bossAttacks(game, 'slash');
    runUntil(game, impact - 100);
    tap(game, { blockPressed: true, blockHeld: true });
    const events = runUntil(game, impact + STEP, { blockHeld: true });
    expect(types(events)).toContain('deflect');
    expect(game.player.focus).toBe(1);
  });

  it('R9: a normal block and a hit add no Focus', () => {
    const blocked = holdEnemy(newGame());
    const impact = bossAttacks(blocked, 'slash');
    tap(blocked, { blockPressed: true, blockHeld: true });
    expect(types(runUntil(blocked, impact + STEP, { blockHeld: true }))).toContain('block');
    expect(blocked.player.focus).toBe(0);

    const hit = holdEnemy(newGame());
    const impact2 = bossAttacks(hit, 'slash');
    expect(types(runUntil(hit, impact2 + STEP))).toContain('playerHit');
    expect(hit.player.focus).toBe(0);
  });

  it('R9: Focus never goes above 3', () => {
    const game = holdEnemy(newGame());
    game.player.focus = SPECIAL.focusMax;
    const impact = bossAttacks(game, 'slash');
    runUntil(game, impact - 100);
    tap(game, { blockPressed: true, blockHeld: true });
    runUntil(game, impact + STEP, { blockHeld: true });
    expect(game.player.focus).toBe(SPECIAL.focusMax);
  });

  it('R9: with less than a full meter J, J, L is just normal attacks', () => {
    const game = ready({ focus: SPECIAL.focusMax - 1 });
    const events = jjl(game);
    expect(types(events)).toContain('specialNotReady');
    expect(types(events)).not.toContain('specialStart');
    expect(game.player.focus).toBe(SPECIAL.focusMax - 1);
    expect(game.player.attackKind).toBe('normal');
  });

  it('R9: restart resets Focus to 0', () => {
    const game = ready();
    game.status = 'lost';
    game.endedAt = game.time;
    update(game, emptyIntent({ restart: true }), STEP);
    expect(game.player.focus).toBe(0);
  });
});

describe('R9: Ember Strike effect', () => {
  it('R9: the strike lands 300 ms after it starts for 20 damage and +20 posture', () => {
    const game = ready();
    jjl(game);
    const start = game.player.statusStart;
    const healthBefore = game.enemy.health.current;
    const postureBefore = game.enemy.posture.current;
    runUntil(game, start + SPECIAL.windup - STEP);
    expect(game.enemy.health.current).toBe(healthBefore);
    const events = runUntil(game, start + SPECIAL.windup + STEP);
    expect(types(events)).toContain('specialHit');
    expect(game.enemy.health.current).toBe(healthBefore - SPECIAL.damage);
    expect(game.enemy.posture.current).toBeCloseTo(postureBefore + SPECIAL.posture, 0);
  });

  it('R9: the strike breaks through the guard of an idle boss', () => {
    const game = holdEnemy(newGame());
    game.player.focus = SPECIAL.focusMax;
    run(game, 600); // first-swing hit on idle boss is blocked; finish it first
    jjl(game);
    const before = game.enemy.health.current;
    const events = run(game, SPECIAL.windup + STEP);
    expect(types(events)).toContain('specialHit');
    expect(types(events)).not.toContain('enemyBlocked');
    expect(game.enemy.health.current).toBe(before - SPECIAL.damage);
  });

  it('R9: it replaces the normal swing in progress', () => {
    const game = ready();
    const events = jjl(game, 50); // L lands during the first swing's wind-up
    events.push(...run(game, 1000));
    expect(types(events).filter((t) => t === 'enemyHit')).toHaveLength(0);
    expect(types(events).filter((t) => t === 'specialHit')).toHaveLength(1);
  });

  it('R9: out of reach it misses and Focus is still spent', () => {
    const game = ready({ distance: 3.5 });
    jjl(game);
    const events = run(game, SPECIAL.windup + STEP);
    expect(types(events)).not.toContain('specialHit');
    expect(events.find((e) => e.type === 'whiff')?.special).toBe(true);
    expect(game.player.focus).toBe(0);
  });

  it('R9: it cannot start during hit-stun or a dodge', () => {
    const stunned = ready();
    tap(stunned, { attack: true });
    run(stunned, 50);
    tap(stunned, { attack: true });
    stunned.player.status = 'hitstun';
    stunned.player.statusUntil = Infinity;
    expect(types(tap(stunned, { special: true }))).not.toContain('specialStart');

    const dodging = ready();
    tap(dodging, { attack: true });
    run(dodging, 50);
    tap(dodging, { attack: true });
    dodging.player.status = 'dodging';
    dodging.player.statusUntil = Infinity;
    expect(types(tap(dodging, { special: true }))).not.toContain('specialStart');
  });

  it('R9: filling the boss posture breaks it for 3000 ms', () => {
    const game = ready();
    game.enemy.posture.current = 85;
    game.enemy.posture.lastGainAt = Infinity; // no recovery during the test
    jjl(game);
    const events = run(game, SPECIAL.windup + STEP);
    expect(types(events)).toContain('enemyPostureBreak');
    expect(game.enemy.state).toBe('broken');
    expect(game.enemy.brokenUntil - game.enemy.stateStart).toBe(ENEMY.brokenDuration);
  });

  it('R9: bringing the boss to 0 health breaks it with no time limit', () => {
    const game = ready();
    game.enemy.health.current = 15;
    jjl(game);
    run(game, SPECIAL.windup + STEP);
    expect(game.enemy.health.current).toBe(0);
    expect(game.enemy.state).toBe('broken');
    expect(game.enemy.brokenUntil).toBe(Infinity);
    expect(game.status).toBe('playing');
  });

  it('R9: on an already broken boss it is the finishing blow and wins', () => {
    const game = holdEnemy(newGame());
    game.player.focus = SPECIAL.focusMax;
    breakEnemy(game.enemy, game.time, Infinity);
    // J on a broken boss is the finisher itself, so build the sequence first.
    game.player.attackPresses = [game.time, game.time];
    tap(game, { special: true });
    const events = run(game, SPECIAL.windup + STEP);
    expect(types(events)).toContain('finisher');
    expect(game.status).toBe('won');
  });

  it('R9: block can cancel the recovery after the strike', () => {
    const game = ready();
    jjl(game);
    run(game, SPECIAL.windup + 50);
    expect(game.player.attackPhase).toBe('recovery');
    tap(game, { blockPressed: true, blockHeld: true });
    expect(game.player.status).toBe('ready');
    expect(game.player.blocking).toBe(true);
  });
});
