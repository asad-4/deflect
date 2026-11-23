import { describe, expect, it } from 'vitest';
import { inDeflectWindow } from '../src/logic/combat.js';
import { ATTACKS, DEFLECT } from '../src/logic/constants.js';
import { blockAt, bossAttacks, holdEnemy, newGame, runUntil, tap, types } from './helpers.js';

function setup() {
  const game = holdEnemy(newGame({ distance: 2.5 }));
  const impact = bossAttacks(game, 'slash'); // impact at 700 ms
  return { game, impact };
}

describe('R2: deflect timing window vs normal block', () => {
  it('R2: deflect window is 180 ms and the anti-mash lockout is 300 ms', () => {
    expect(DEFLECT.window).toBe(180);
    expect(DEFLECT.mashLockout).toBe(300);
  });

  it('R2: window check includes 0 and 180 ms, excludes 181 ms and late presses', () => {
    expect(inDeflectWindow(1000, 1000)).toBe(true);
    expect(inDeflectWindow(820, 1000)).toBe(true);
    expect(inDeflectWindow(819, 1000)).toBe(false);
    expect(inDeflectWindow(1001, 1000)).toBe(false);
  });

  it('R2: perfect deflect inside window', () => {
    const { game, impact } = setup();
    runUntil(game, impact - 100);
    const events = blockAt(game, impact + 20);
    expect(types(events)).toContain('deflect');
    expect(types(events)).not.toContain('block');
    expect(game.player.health.current).toBe(100);
  });

  it('R2: perfect deflect at exactly 180 ms before impact', () => {
    const { game, impact } = setup();
    runUntil(game, impact - 180);
    expect(types(blockAt(game, impact + 20))).toContain('deflect');
  });

  it('R2: pressing block 190 ms early is only a normal block', () => {
    const { game, impact } = setup();
    runUntil(game, impact - 190);
    const events = blockAt(game, impact + 20);
    expect(types(events)).toContain('block');
    expect(types(events)).not.toContain('deflect');
  });

  it('R2: pressing block in the same step as the impact still deflects', () => {
    const { game, impact } = setup();
    runUntil(game, impact - 10);
    expect(types(blockAt(game, impact + 20))).toContain('deflect');
  });

  it('R2: holding block from long before the attack gives a normal block', () => {
    const game = holdEnemy(newGame({ distance: 2.5 }));
    tap(game, { blockPressed: true, blockHeld: true });
    const impact = bossAttacks(game, 'slash');
    const events = runUntil(game, impact + 20, { blockHeld: true });
    expect(types(events)).toContain('block');
  });

  it('R2: deflect rewards: boss gains 15 posture, player only 5, no damage', () => {
    const { game, impact } = setup();
    runUntil(game, impact - 100);
    blockAt(game, impact + 20);
    expect(game.enemy.posture.current).toBe(ATTACKS.slash.deflectEnemyPosture);
    expect(game.player.posture.current).toBe(ATTACKS.slash.deflectSelfPosture);
    expect(game.player.health.current).toBe(100);
  });

  it('R2: normal block penalty: player gains full 15 posture, boss none, no damage', () => {
    const { game, impact } = setup();
    runUntil(game, impact - 400);
    blockAt(game, impact + 20);
    expect(game.player.posture.current).toBe(15);
    expect(game.enemy.posture.current).toBe(0);
    expect(game.player.health.current).toBe(100);
  });

  it('R2: pressing block after the impact is too late and the player is hit', () => {
    const { game, impact } = setup();
    const events = runUntil(game, impact);
    events.push(...blockAt(game, impact + 50));
    expect(types(events)).toContain('playerHit');
    expect(game.player.health.current).toBe(100 - ATTACKS.slash.damage);
  });

  it('R2: mashing block (re-press within 300 ms) cannot deflect', () => {
    const { game, impact } = setup();
    runUntil(game, impact - 300);
    tap(game, { blockPressed: true, blockHeld: true });
    runUntil(game, impact - 100); // released in between
    const events = blockAt(game, impact + 20); // second press 200 ms after the first
    expect(types(events)).toContain('block');
    expect(types(events)).not.toContain('deflect');
  });

  it('R2: a press 300 ms or more after the previous one can deflect again', () => {
    const { game, impact } = setup();
    runUntil(game, impact - 400);
    tap(game, { blockPressed: true, blockHeld: true });
    runUntil(game, impact - 100);
    expect(types(blockAt(game, impact + 20))).toContain('deflect');
  });

  it('R2: each combo strike can be deflected separately', () => {
    const game = holdEnemy(newGame({ distance: 2.5 }));
    const first = bossAttacks(game, 'combo'); // impacts at 600, 950, 1300
    const impacts = [first, first + 350, first + 700];
    let deflects = 0;
    for (const at of impacts) {
      runUntil(game, at - 100);
      deflects += types(blockAt(game, at + 10)).filter((t) => t === 'deflect').length;
    }
    expect(deflects).toBe(3);
    expect(game.enemy.posture.current).toBe(36);
  });
});
