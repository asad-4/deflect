import { describe, expect, it } from 'vitest';
import { breakEnemy } from '../src/logic/enemyAI.js';
import { ENEMY } from '../src/logic/constants.js';
import { freezeEnemy, holdEnemy, newGame, run, runUntil, tap, types } from './helpers.js';

function brokenBoss(distance = 2.5) {
  const game = holdEnemy(newGame({ distance }));
  breakEnemy(game.enemy, game.time);
  return game;
}

describe('R6: finishing blow', () => {
  it('R6: attacking a broken boss in reach performs the finishing blow and wins', () => {
    const game = brokenBoss();
    const events = tap(game, { attack: true });
    expect(types(events)).toContain('finisher');
    expect(types(events)).toContain('win');
    expect(game.enemy.state).toBe('dead');
    expect(game.status).toBe('won');
  });

  it('R6: the finishing blow needs the player within 3.0 m', () => {
    const game = brokenBoss(3.5);
    const events = tap(game, { attack: true });
    expect(types(events)).not.toContain('finisher');
    expect(game.status).toBe('playing');
  });

  it('R6: deflecting the boss into a posture break enables the finishing blow', () => {
    const game = holdEnemy(newGame());
    game.enemy.posture.current = 90;
    game.enemy.posture.lastGainAt = 0;
    game.enemy.impactAt = 0;
    game.enemy.state = 'idle';
    // Overhead deflect gives the boss +22 posture.
    game.enemy.idleUntil = 0;
    game.rng = () => 0.4; // choose overhead
    run(game, 10);
    expect(game.enemy.attack).toBe('overhead');
    const impact = game.enemy.impactAt;
    runUntil(game, impact - 100);
    tap(game, { blockPressed: true, blockHeld: true });
    runUntil(game, impact + 10, { blockHeld: true });
    expect(game.enemy.state).toBe('broken');
    tap(game, { attack: true });
    expect(game.status).toBe('won');
  });

  it('R6: after the 3000 ms break window passes, attacks are normal again', () => {
    const game = brokenBoss();
    runUntil(game, ENEMY.brokenDuration + 10);
    expect(game.enemy.state).toBe('idle');
    const events = tap(game, { attack: true });
    expect(types(events)).not.toContain('finisher');
    expect(game.status).toBe('playing');
  });

  it('R6: boss at 0 health is broken with no time limit and still needs the finishing blow', () => {
    const game = freezeEnemy(newGame());
    game.enemy.health.current = 10;
    tap(game, { attack: true });
    runUntil(game, 300);
    expect(game.enemy.health.current).toBe(0);
    expect(game.enemy.state).toBe('broken');
    expect(game.status).toBe('playing');
    run(game, 10000);
    expect(game.enemy.state).toBe('broken');
    tap(game, { attack: true });
    expect(game.status).toBe('won');
  });
});
