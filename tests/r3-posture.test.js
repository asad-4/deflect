import { describe, expect, it } from 'vitest';
import { addPosture, createPosture, recoverPosture } from '../src/logic/posture.js';
import { updateEnemy } from '../src/logic/enemyAI.js';
import { ENEMY, PLAYER, POSTURE_RECOVERY_DELAY } from '../src/logic/constants.js';
import {
  blockAt,
  bossAttacks,
  freezeEnemy,
  holdEnemy,
  newGame,
  run,
  runUntil,
  tap,
  types,
} from './helpers.js';

describe('R3: posture increase and recovery', () => {
  it('R3: posture starts at 0 and caps at 100', () => {
    const p = createPosture();
    expect(p.current).toBe(0);
    expect(p.max).toBe(100);
    addPosture(p, 70, 0);
    addPosture(p, 70, 0);
    expect(p.current).toBe(100);
  });

  it('R3: addPosture reports a break only when the bar fills', () => {
    const p = createPosture();
    expect(addPosture(p, 99, 0)).toBe(false);
    expect(addPosture(p, 1, 0)).toBe(true);
    expect(addPosture(p, 5, 0)).toBe(false); // already full
  });

  it('R3: recovery waits 1200 ms after the last gain', () => {
    const p = createPosture();
    addPosture(p, 50, 0);
    recoverPosture(p, 100, 1199, 15);
    expect(p.current).toBe(50);
    recoverPosture(p, 1000, POSTURE_RECOVERY_DELAY + 1000, 15);
    expect(p.current).toBe(35);
  });

  it('R3: player posture recovers 15 per second after the delay', () => {
    const game = freezeEnemy(newGame());
    game.player.posture.current = 60;
    game.player.posture.lastGainAt = 0;
    runUntil(game, POSTURE_RECOVERY_DELAY - 10);
    expect(game.player.posture.current).toBe(60);
    run(game, 1000);
    expect(game.player.posture.current).toBeCloseTo(60 - PLAYER.postureRecoveryPerSec, 5);
  });

  it('R3: boss recovers 12/s at full health, 6/s at half health, never below 3/s', () => {
    const rates = [];
    for (const health of [100, 50, 10]) {
      const game = holdEnemy(newGame());
      const enemy = game.enemy;
      enemy.health.current = health;
      enemy.posture.current = 80;
      enemy.posture.lastGainAt = -POSTURE_RECOVERY_DELAY;
      updateEnemy(enemy, 1000, 1000, game.player.pos, () => 0);
      rates.push(80 - enemy.posture.current);
    }
    expect(rates[0]).toBeCloseTo(12, 5);
    expect(rates[1]).toBeCloseTo(6, 5);
    expect(rates[2]).toBeCloseTo(ENEMY.postureRecoveryMinPerSec, 5);
  });

  it('R3: player attacks into the guarding boss are blocked: +8 posture, no damage', () => {
    const game = holdEnemy(newGame());
    tap(game, { attack: true });
    const events = runUntil(game, 300);
    expect(types(events)).toContain('enemyBlocked');
    expect(game.enemy.posture.current).toBe(8);
    expect(game.enemy.health.current).toBe(100);
  });

  it('R3: hitting the boss during wind-up: -10 health, +4 posture', () => {
    const game = holdEnemy(newGame());
    bossAttacks(game, 'overhead');
    tap(game, { attack: true });
    runUntil(game, 300);
    expect(game.enemy.health.current).toBe(90);
    expect(game.enemy.posture.current).toBe(4);
    expect(game.enemy.state).toBe('windup'); // no interruption
  });

  it('R3: hitting the boss during recovery: -10 health, +6 posture', () => {
    const game = freezeEnemy(newGame());
    tap(game, { attack: true });
    runUntil(game, 300);
    expect(game.enemy.health.current).toBe(90);
    expect(game.enemy.posture.current).toBe(6);
  });
});

describe('R3: posture break', () => {
  it('R3: a block that fills player posture breaks the guard for 1500 ms', () => {
    const game = holdEnemy(newGame());
    game.player.posture.current = 80;
    game.player.posture.lastGainAt = 0;
    const impact = bossAttacks(game, 'overhead'); // +25 on block
    runUntil(game, impact - 500);
    const events = blockAt(game, impact + 10);
    expect(types(events)).toContain('playerPostureBreak');
    expect(game.player.status).toBe('broken');
    expect(game.player.health.current).toBe(100);
    // Stunned: cannot attack or block.
    tap(game, { attack: true, blockPressed: true, blockHeld: true });
    expect(game.player.blocking).toBe(false);
    expect(game.player.status).toBe('broken');
    runUntil(game, impact + PLAYER.postureBreakStun - 10);
    expect(game.player.status).toBe('broken');
    runUntil(game, impact + PLAYER.postureBreakStun + 10);
    expect(game.player.status).toBe('ready');
    expect(game.player.posture.current).toBe(50);
  });

  it('R3: while guard-broken, a held block does not stop hits', () => {
    const game = holdEnemy(newGame());
    game.player.posture.current = 90;
    game.player.posture.lastGainAt = 0;
    const impact = bossAttacks(game, 'slash');
    runUntil(game, impact - 500);
    blockAt(game, impact + 10);
    expect(game.player.status).toBe('broken');
    const second = bossAttacks(game, 'slash');
    const events = runUntil(game, second + 10, { blockHeld: true });
    expect(types(events)).toContain('playerHit');
    expect(game.player.health.current).toBe(85);
  });

  it('R3: a deflect never breaks the player\'s own guard', () => {
    const game = holdEnemy(newGame());
    game.player.posture.current = 98;
    game.player.posture.lastGainAt = 0;
    const impact = bossAttacks(game, 'slash');
    runUntil(game, impact - 100);
    const events = blockAt(game, impact + 10);
    expect(types(events)).toContain('deflect');
    expect(game.player.status).toBe('ready');
    expect(game.player.posture.current).toBe(99);
  });

  it('R3: filling boss posture breaks it, cancelling its attack', () => {
    const game = holdEnemy(newGame());
    game.enemy.posture.current = 90;
    game.enemy.posture.lastGainAt = 0;
    const impact = bossAttacks(game, 'combo');
    runUntil(game, impact - 100);
    const events = blockAt(game, impact + 10);
    expect(types(events)).toContain('enemyPostureBreak');
    expect(game.enemy.state).toBe('broken');
    expect(game.enemy.telegraph).toBeNull();
    // Remaining combo strikes never land.
    const later = runUntil(game, impact + 1000, { blockHeld: true });
    expect(types(later)).not.toContain('enemyStrike');
  });

  it('R3: boss break lasts 3000 ms, then posture resets to 50 and it returns to idle', () => {
    const game = holdEnemy(newGame());
    game.enemy.posture.current = 95;
    game.enemy.posture.lastGainAt = 0;
    const impact = bossAttacks(game, 'slash');
    runUntil(game, impact - 100);
    blockAt(game, impact + 10);
    expect(game.enemy.state).toBe('broken');
    runUntil(game, impact + ENEMY.brokenDuration - 10);
    expect(game.enemy.state).toBe('broken');
    expect(game.enemy.posture.current).toBe(100); // no recovery while broken
    runUntil(game, impact + ENEMY.brokenDuration + 10);
    expect(game.enemy.state).toBe('idle');
    expect(game.enemy.posture.current).toBe(50);
  });
});
