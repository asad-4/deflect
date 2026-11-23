import { describe, expect, it } from 'vitest';
import { ATTACKS, PLAYER } from '../src/logic/constants.js';
import { judgeIncoming } from '../src/logic/combat.js';
import { blockAt, bossAttacks, holdEnemy, newGame, runUntil, tap, types } from './helpers.js';

function lungeGame(distance = 2.5) {
  const game = holdEnemy(newGame({ distance }));
  const impact = bossAttacks(game, 'lunge'); // impact at 900 ms
  return { game, impact };
}

describe('R5: unblockable lunge', () => {
  it('R5: lunge is the unblockable attack with 30 damage and 5 m reach', () => {
    expect(ATTACKS.lunge.unblockable).toBe(true);
    expect(ATTACKS.lunge.damage).toBe(30);
    expect(ATTACKS.lunge.reach).toBe(5);
    expect(Object.values(ATTACKS).filter((a) => a.unblockable)).toHaveLength(1);
  });

  it('R5: red warning (unblockable telegraph) shows from the start of the wind-up, no glint', () => {
    const { game, impact } = lungeGame();
    expect(game.enemy.telegraph.unblockable).toBe(true);
    runUntil(game, impact - 10);
    expect(game.enemy.telegraph.unblockable).toBe(true);
    expect(game.enemy.telegraph.glint).toBe(false);
    runUntil(game, impact + 10);
    expect(game.enemy.telegraph).toBeNull();
  });

  it('R5: block fails against the lunge: full 30 damage, no posture change', () => {
    const { game, impact } = lungeGame();
    runUntil(game, impact - 500);
    const events = blockAt(game, impact + 10);
    expect(types(events)).toContain('playerHit');
    expect(types(events)).not.toContain('block');
    expect(game.player.health.current).toBe(70);
    expect(game.player.posture.current).toBe(0);
  });

  it('R5: a perfectly timed deflect also fails against the lunge', () => {
    const { game, impact } = lungeGame();
    runUntil(game, impact - 100);
    const events = blockAt(game, impact + 10);
    expect(types(events)).toContain('playerHit');
    expect(types(events)).not.toContain('deflect');
    expect(game.enemy.posture.current).toBe(0);
  });

  it('R5: dodge succeeds when its i-frames cover the impact', () => {
    const { game, impact } = lungeGame();
    runUntil(game, impact - 200);
    tap(game, { dodge: true, right: 1 });
    const events = runUntil(game, impact + 10);
    expect(types(events)).toContain('dodged');
    expect(game.player.health.current).toBe(100);
  });

  it('R5: dodging at the very start of i-frames (impact in same step) succeeds', () => {
    const { game, impact } = lungeGame();
    runUntil(game, impact - 10);
    tap(game, { dodge: true, right: 1 });
    expect(game.player.health.current).toBe(100);
  });

  it('R5: dodge too early (impact in last 100 ms of the dodge) is hit', () => {
    const { game, impact } = lungeGame();
    runUntil(game, impact - PLAYER.dodgeInvulnerable - 50);
    tap(game, { dodge: true, right: 1 });
    const events = runUntil(game, impact + 10);
    expect(types(events)).toContain('playerHit');
    expect(game.player.health.current).toBe(70);
  });

  it('R5: i-frames cover 0 to 300 ms of the dodge only', () => {
    const player = { status: 'dodging', statusStart: 1000, blocking: false };
    expect(judgeIncoming(player, 'lunge', 1000)).toBe('dodged');
    expect(judgeIncoming(player, 'lunge', 1299)).toBe('dodged');
    expect(judgeIncoming(player, 'lunge', 1300)).toBe('hit');
  });

  it('R5: lunge reaches 4.5 m but misses beyond 5 m', () => {
    const near = lungeGame(4.5);
    runUntil(near.game, near.impact + 10);
    expect(near.game.player.health.current).toBe(70);

    const far = lungeGame(5.5);
    const events = runUntil(far.game, far.impact + 10);
    expect(types(events)).toContain('miss');
    expect(far.game.player.health.current).toBe(100);
  });

  it('R5: dodge also avoids blockable attacks', () => {
    const game = holdEnemy(newGame());
    const impact = bossAttacks(game, 'overhead');
    runUntil(game, impact - 100);
    tap(game, { dodge: true });
    expect(types(runUntil(game, impact + 10))).toContain('dodged');
  });
});
