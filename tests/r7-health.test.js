import { describe, expect, it } from 'vitest';
import { applyDamage, createHealth, isDead } from '../src/logic/health.js';
import { PLAYER } from '../src/logic/constants.js';
import { bossAttacks, freezeEnemy, holdEnemy, newGame, runUntil, tap, types } from './helpers.js';

describe('R7: health and damage', () => {
  it('R7: player and boss both start with 100 health', () => {
    const game = newGame();
    expect(game.player.health).toMatchObject({ current: 100, max: 100 });
    expect(game.enemy.health).toMatchObject({ current: 100, max: 100 });
  });

  it('R7: damage lowers health and never goes below 0', () => {
    const h = createHealth();
    applyDamage(h, 30);
    expect(h.current).toBe(70);
    applyDamage(h, 500);
    expect(h.current).toBe(0);
    expect(isDead(h)).toBe(true);
  });

  it('R7: an unblocked slash costs the player 15 health', () => {
    const game = holdEnemy(newGame());
    const impact = bossAttacks(game, 'slash');
    const events = runUntil(game, impact + 10);
    expect(types(events)).toContain('playerHit');
    expect(game.player.health.current).toBe(85);
  });

  it('R7: an unblocked hit causes 300 ms hit-stun', () => {
    const game = holdEnemy(newGame());
    const impact = bossAttacks(game, 'slash');
    runUntil(game, impact);
    expect(game.player.status).toBe('hitstun');
    tap(game, { attack: true });
    expect(game.player.status).toBe('hitstun');
    runUntil(game, impact + PLAYER.hitStun);
    expect(game.player.status).toBe('ready');
  });

  it('R7: a player hit costs the boss 10 health', () => {
    const game = freezeEnemy(newGame());
    tap(game, { attack: true });
    runUntil(game, 300);
    expect(game.enemy.health.current).toBe(90);
  });

  it('R7: player loses when health reaches 0', () => {
    const game = holdEnemy(newGame());
    game.player.health.current = 15;
    const impact = bossAttacks(game, 'slash');
    const events = runUntil(game, impact + 10);
    expect(game.player.health.current).toBe(0);
    expect(types(events)).toContain('lose');
    expect(game.status).toBe('lost');
    expect(game.endedAt).toBe(impact);
  });

  it('R7: player survives with health above 0', () => {
    const game = holdEnemy(newGame());
    game.player.health.current = 16;
    const impact = bossAttacks(game, 'slash');
    runUntil(game, impact + 10);
    expect(game.player.health.current).toBe(1);
    expect(game.status).toBe('playing');
  });
});
