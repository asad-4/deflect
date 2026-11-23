import { describe, expect, it } from 'vitest';
import { breakEnemy } from '../src/logic/enemyAI.js';
import { endScreenVisible } from '../src/logic/game.js';
import { END_SCREEN_DELAY, PLAYER_START, ENEMY_START } from '../src/logic/constants.js';
import { bossAttacks, holdEnemy, newGame, run, runUntil, tap, types } from './helpers.js';

function lostGame() {
  const game = holdEnemy(newGame());
  game.player.health.current = 10;
  const impact = bossAttacks(game, 'slash');
  runUntil(game, impact + 10);
  return game;
}

function wonGame() {
  const game = holdEnemy(newGame());
  breakEnemy(game.enemy, 0);
  tap(game, { attack: true });
  return game;
}

describe('R8: win/lose screen and restart', () => {
  it('R8: the end screen appears 1500 ms after the fight ends', () => {
    const game = lostGame();
    expect(game.status).toBe('lost');
    expect(endScreenVisible(game)).toBe(false);
    run(game, END_SCREEN_DELAY - 20);
    expect(endScreenVisible(game)).toBe(false);
    run(game, 20);
    expect(endScreenVisible(game)).toBe(true);
  });

  it('R8: win and lose are distinct results', () => {
    expect(wonGame().status).toBe('won');
    expect(lostGame().status).toBe('lost');
  });

  it('R8: gameplay input is ignored once the fight is over', () => {
    const game = lostGame();
    const before = { ...game.player.pos };
    tap(game, { attack: true, dodge: true });
    run(game, 500, { forward: 1, blockHeld: true });
    expect(game.player.pos).toEqual(before);
    expect(game.player.status).not.toBe('attacking');
    expect(game.status).toBe('lost');
  });

  it('R8: restart after losing resets health, posture, positions and the boss', () => {
    const game = lostGame();
    game.player.posture.current = 40;
    run(game, 2000);
    const events = tap(game, { restart: true });
    expect(types(events)).toContain('restart');
    expect(game.status).toBe('playing');
    expect(game.time).toBe(0);
    expect(game.player.health.current).toBe(100);
    expect(game.player.posture.current).toBe(0);
    expect(game.player.pos).toEqual({ x: PLAYER_START.x, z: PLAYER_START.z });
    expect(game.enemy.pos).toEqual({ x: ENEMY_START.x, z: ENEMY_START.z });
    expect(game.enemy.health.current).toBe(100);
    expect(game.enemy.posture.current).toBe(0);
    expect(game.enemy.state).toBe('idle');
  });

  it('R8: restart after winning starts a new fight', () => {
    const game = wonGame();
    tap(game, { restart: true });
    expect(game.status).toBe('playing');
    expect(game.enemy.state).toBe('idle');
    expect(game.enemy.health.current).toBe(100);
  });

  it('R8: the restart key does nothing during the fight', () => {
    const game = holdEnemy(newGame());
    game.player.health.current = 50;
    tap(game, { restart: true });
    expect(game.player.health.current).toBe(50);
  });
});
