import { describe, expect, it } from 'vitest';
import { createInputState, consumeIntent, mapKey, pressAction } from '../src/logic/input.js';
import { breakEnemy, startAttack } from '../src/logic/enemyAI.js';
import { canExecute } from '../src/logic/game.js';
import { EXECUTION, ATTACKS } from '../src/logic/constants.js';
import { bossAttacks, freezeEnemy, holdEnemy, newGame, run, runUntil, tap, types } from './helpers.js';

/** Idle boss at `health`, player `distance` m away. */
function lowBoss({ health = EXECUTION.healthThreshold, distance = 2.5 } = {}) {
  const game = holdEnemy(newGame({ distance }));
  game.enemy.health.current = health;
  return game;
}

describe('R10: execution', () => {
  it('R10: F maps to the execute action', () => {
    expect(mapKey('KeyF')).toBe('execute');
    const input = createInputState();
    pressAction(input, 'execute');
    expect(consumeIntent(input).execute).toBe(true);
  });

  it('R10: F at 30 health (70% lost) on an idle boss in reach kills it and wins', () => {
    const game = lowBoss();
    const events = tap(game, { execute: true });
    expect(types(events)).toContain('execution');
    expect(types(events)).toContain('win');
    expect(game.enemy.state).toBe('dead');
    expect(game.status).toBe('won');
  });

  it('R10: F does nothing above 30 health', () => {
    const game = lowBoss({ health: EXECUTION.healthThreshold + 1 });
    const events = tap(game, { execute: true });
    expect(types(events)).not.toContain('execution');
    expect(game.status).toBe('playing');
    expect(game.enemy.health.current).toBe(EXECUTION.healthThreshold + 1);
  });

  it('R10: F does nothing while the boss is winding up an attack', () => {
    for (const id of Object.keys(ATTACKS)) {
      const game = lowBoss();
      bossAttacks(game, id);
      expect(types(tap(game, { execute: true })), id).not.toContain('execution');
      expect(game.status).toBe('playing');
    }
  });

  it('R10: F does nothing between combo strikes', () => {
    const game = lowBoss();
    const first = bossAttacks(game, 'combo');
    runUntil(game, first + 20, { blockHeld: true });
    expect(game.enemy.state).toBe('windup');
    expect(game.enemy.strike).toBe(1);
    expect(types(tap(game, { execute: true }))).not.toContain('execution');
  });

  it('R10: F works during the boss recovery', () => {
    const game = freezeEnemy(lowBoss());
    expect(game.enemy.state).toBe('recovery');
    tap(game, { execute: true });
    expect(game.status).toBe('won');
  });

  it('R10: F works on a broken boss', () => {
    const game = lowBoss();
    breakEnemy(game.enemy, game.time);
    tap(game, { execute: true });
    expect(game.status).toBe('won');
  });

  it('R10: F needs the player within 3.0 m', () => {
    const far = lowBoss({ distance: 3.5 });
    expect(types(tap(far, { execute: true }))).not.toContain('execution');
    expect(far.status).toBe('playing');
  });

  it('R10: F does nothing while the player is stunned or winding up an attack', () => {
    const stunned = lowBoss();
    stunned.player.status = 'hitstun';
    stunned.player.statusUntil = Infinity;
    expect(canExecute(stunned)).toBe(false);
    tap(stunned, { execute: true });
    expect(stunned.status).toBe('playing');

    const swinging = freezeEnemy(lowBoss());
    tap(swinging, { attack: true });
    expect(swinging.player.attackPhase).toBe('windup');
    tap(swinging, { execute: true });
    expect(swinging.status).toBe('playing');
  });

  it('R10: a failed F can be retried once the conditions hold', () => {
    const game = lowBoss();
    startAttack(game.enemy, 'slash', game.time);
    tap(game, { execute: true });
    expect(game.status).toBe('playing');
    run(game, ATTACKS.slash.windups[0] + ATTACKS.slash.recovery, { blockHeld: true });
    expect(['recovery', 'idle']).toContain(game.enemy.state);
    tap(game, { execute: true });
    expect(game.status).toBe('won');
  });

  it('R10: canExecute reports availability for the HUD prompt', () => {
    expect(canExecute(lowBoss())).toBe(true);
    expect(canExecute(lowBoss({ health: 31 }))).toBe(false);
  });
});
