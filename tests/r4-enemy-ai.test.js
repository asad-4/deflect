import { describe, expect, it } from 'vitest';
import { chooseAttack, computeTelegraph, createEnemy, idleDuration } from '../src/logic/enemyAI.js';
import { ATTACKS, ENEMY } from '../src/logic/constants.js';
import { createGame, distanceBetween } from '../src/logic/game.js';
import { bossAttacks, holdEnemy, newGame, run, runUntil, seq, types } from './helpers.js';

describe('R4: attack choice', () => {
  it('R4: idle lasts 800 + rng x 600 ms', () => {
    expect(idleDuration(() => 0)).toBe(800);
    expect(idleDuration(() => 0.5)).toBe(1100);
    expect(idleDuration(() => 1)).toBe(1400);
  });

  it('R4: weighted choice at melee range: slash 35%, overhead 25%, combo 25%, lunge 15%', () => {
    expect(chooseAttack(2.5, null, () => 0)).toBe('slash');
    expect(chooseAttack(2.5, null, () => 0.349)).toBe('slash');
    expect(chooseAttack(2.5, null, () => 0.35)).toBe('overhead');
    expect(chooseAttack(2.5, null, () => 0.599)).toBe('overhead');
    expect(chooseAttack(2.5, null, () => 0.6)).toBe('combo');
    expect(chooseAttack(2.5, null, () => 0.849)).toBe('combo');
    expect(chooseAttack(2.5, null, () => 0.85)).toBe('lunge');
    expect(chooseAttack(2.5, null, () => 0.999)).toBe('lunge');
  });

  it('R4: lunge is never chosen twice in a row', () => {
    expect(chooseAttack(2.5, 'lunge', () => 0.9)).toBe('slash');
    expect(chooseAttack(4, 'lunge', () => 0.9)).toBeNull();
  });

  it('R4: between 3 and 5 m the boss lunges; beyond 5 m it does not attack', () => {
    expect(chooseAttack(3.01, 'slash', () => 0)).toBe('lunge');
    expect(chooseAttack(5, null, () => 0)).toBe('lunge');
    expect(chooseAttack(5.01, null, () => 0)).toBeNull();
  });

  it('R4: boss walks toward a distant player at 2.2 m/s and stops at 2.5 m', () => {
    const game = holdEnemy(newGame({ distance: 8 }));
    run(game, 1000);
    expect(distanceBetween(game)).toBeCloseTo(8 - ENEMY.walkSpeed, 5);
    run(game, 5000);
    expect(distanceBetween(game)).toBeCloseTo(ENEMY.preferredDistance, 5);
  });

  it('R4: from a fresh game the boss starts attacking after its idle time', () => {
    const game = createGame({ rng: seq(0) });
    game.player.pos.z = 2.5;
    runUntil(game, 790);
    expect(game.enemy.state).toBe('idle');
    runUntil(game, 800);
    expect(game.enemy.state).toBe('windup');
    expect(game.enemy.attack).toBe('slash');
  });

  it('R4: boss AI cycles through recognisable attacks with an injected rng', () => {
    // rng order: idle, choice, idle, choice, ...
    const game = createGame({ rng: seq(0, 0.1, 0, 0.4, 0, 0.7, 0, 0.9) });
    game.player.pos.z = 2.5;
    const picks = [];
    for (let i = 0; i < 1000 && picks.length < 4; i++) {
      run(game, 10);
      const e = game.enemy;
      if (e.state === 'windup' && e.stateStart === game.time) picks.push(e.attack);
      game.player.health.current = 100; // keep the player alive
    }
    expect(picks).toEqual(['slash', 'overhead', 'combo', 'lunge']);
  });
});

describe('R4: attack timing and telegraphs', () => {
  function timeline(attackId, totalMs) {
    const game = holdEnemy(newGame());
    game.player.health.current = 1000; // survive every hit
    game.player.health.max = 1000;
    bossAttacks(game, attackId);
    const strikes = [];
    let recoveryEnd = null;
    for (let t = 0; t < totalMs; t += 10) {
      const events = run(game, 10);
      for (const e of events) if (e.type === 'enemyStrike') strikes.push(game.time);
      if (recoveryEnd === null && game.enemy.state === 'idle') recoveryEnd = game.time;
    }
    return { strikes, recoveryEnd };
  }

  it('R4: slash: 700 ms wind-up, 700 ms recovery, 15 damage', () => {
    expect(ATTACKS.slash.damage).toBe(15);
    expect(timeline('slash', 2000)).toEqual({ strikes: [700], recoveryEnd: 1400 });
  });

  it('R4: overhead: 1100 ms wind-up, 900 ms recovery, 25 damage', () => {
    expect(ATTACKS.overhead.damage).toBe(25);
    expect(timeline('overhead', 2500)).toEqual({ strikes: [1100], recoveryEnd: 2000 });
  });

  it('R4: combo: strikes at 600, 950, 1300 ms then 1000 ms recovery, 10 damage each', () => {
    expect(ATTACKS.combo.damage).toBe(10);
    expect(timeline('combo', 2500)).toEqual({ strikes: [600, 950, 1300], recoveryEnd: 2300 });
  });

  it('R4: lunge: 900 ms wind-up, 1200 ms recovery, 30 damage', () => {
    expect(ATTACKS.lunge.damage).toBe(30);
    expect(timeline('lunge', 2500)).toEqual({ strikes: [900], recoveryEnd: 2100 });
  });

  it('R4: telegraph exposes attack, strike and time to impact during wind-up', () => {
    const game = holdEnemy(newGame());
    bossAttacks(game, 'overhead');
    runUntil(game, 300);
    expect(game.enemy.telegraph).toEqual({
      attack: 'overhead',
      strike: 0,
      msToImpact: 800,
      unblockable: false,
      glint: false,
    });
  });

  it('R4: blockable strikes glint only in the last 300 ms before impact', () => {
    const game = holdEnemy(newGame());
    bossAttacks(game, 'slash');
    runUntil(game, 390);
    expect(game.enemy.telegraph.glint).toBe(false);
    runUntil(game, 400);
    expect(game.enemy.telegraph.glint).toBe(true);
  });

  it('R4: telegraph follows each combo strike', () => {
    const game = holdEnemy(newGame());
    bossAttacks(game, 'combo');
    runUntil(game, 700);
    expect(game.enemy.telegraph.strike).toBe(1);
    expect(game.enemy.telegraph.msToImpact).toBe(250);
  });

  it('R4: no telegraph while idle or recovering', () => {
    const game = holdEnemy(newGame());
    expect(computeTelegraph(game.enemy, 0)).toBeNull();
    bossAttacks(game, 'slash');
    runUntil(game, 800);
    expect(game.enemy.state).toBe('recovery');
    expect(game.enemy.telegraph).toBeNull();
  });

  it('R4: a strike misses if the player is out of reach at impact', () => {
    const game = holdEnemy(newGame({ distance: 2.5 }));
    const impact = bossAttacks(game, 'overhead');
    const events = runUntil(game, impact + 10, { forward: -1 });
    expect(types(events)).toContain('miss');
    expect(game.player.health.current).toBe(100);
  });

  it('R4: a new boss starts idle with full health and no posture', () => {
    const enemy = createEnemy(0, () => 0);
    expect(enemy.state).toBe('idle');
    expect(enemy.idleUntil).toBe(800);
    expect(enemy.health.current).toBe(100);
    expect(enemy.posture.current).toBe(0);
  });
});
