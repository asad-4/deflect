import { describe, expect, it } from 'vitest';
import {
  consumeIntent,
  createInputState,
  mapKey,
  mapMouseButton,
  pressAction,
  releaseAction,
} from '../src/logic/input.js';
import { distanceBetween } from '../src/logic/game.js';
import { ARENA_RADIUS, MIN_DISTANCE, PLAYER } from '../src/logic/constants.js';
import { freezeEnemy, newGame, run, runUntil, tap, types } from './helpers.js';

describe('R1: input-to-action mapping', () => {
  it('R1: W/S/A/D and arrow keys map to movement actions', () => {
    expect(mapKey('KeyW')).toBe('forward');
    expect(mapKey('ArrowUp')).toBe('forward');
    expect(mapKey('KeyS')).toBe('back');
    expect(mapKey('ArrowDown')).toBe('back');
    expect(mapKey('KeyA')).toBe('left');
    expect(mapKey('ArrowLeft')).toBe('left');
    expect(mapKey('KeyD')).toBe('right');
    expect(mapKey('ArrowRight')).toBe('right');
  });

  it('R1: J attacks, K blocks, Space dodges, R and Enter restart', () => {
    expect(mapKey('KeyJ')).toBe('attack');
    expect(mapKey('KeyK')).toBe('block');
    expect(mapKey('Space')).toBe('dodge');
    expect(mapKey('KeyR')).toBe('restart');
    expect(mapKey('Enter')).toBe('restart');
  });

  it('R1: unmapped keys map to no action', () => {
    expect(mapKey('KeyQ')).toBeNull();
    expect(mapKey('Escape')).toBeNull();
  });

  it('R1: mouse left button attacks and right button blocks', () => {
    expect(mapMouseButton(0)).toBe('attack');
    expect(mapMouseButton(2)).toBe('block');
    expect(mapMouseButton(1)).toBeNull();
  });

  it('R1: press edges are reported once, held keys every frame', () => {
    const input = createInputState();
    pressAction(input, mapKey('KeyK'));
    pressAction(input, mapKey('KeyJ'));
    const first = consumeIntent(input);
    expect(first.blockPressed).toBe(true);
    expect(first.blockHeld).toBe(true);
    expect(first.attack).toBe(true);
    const second = consumeIntent(input);
    expect(second.blockPressed).toBe(false);
    expect(second.blockHeld).toBe(true);
    expect(second.attack).toBe(false);
    releaseAction(input, 'block');
    expect(consumeIntent(input).blockHeld).toBe(false);
  });

  it('R1: key auto-repeat does not create new press edges', () => {
    const input = createInputState();
    pressAction(input, 'block');
    consumeIntent(input);
    pressAction(input, 'block'); // repeat while still held
    expect(consumeIntent(input).blockPressed).toBe(false);
  });

  it('R1: opposite movement keys cancel out', () => {
    const input = createInputState();
    pressAction(input, 'forward');
    pressAction(input, 'back');
    pressAction(input, 'left');
    const intent = consumeIntent(input);
    expect(intent.forward).toBe(0);
    expect(intent.right).toBe(-1);
  });
});

describe('R1: movement', () => {
  it('R1: moving forward closes distance at 3.0 m/s', () => {
    const game = freezeEnemy(newGame({ distance: 8 }));
    run(game, 1000, { forward: 1 });
    expect(distanceBetween(game)).toBeCloseTo(8 - PLAYER.moveSpeed, 5);
  });

  it('R1: moving back opens distance at 3.0 m/s', () => {
    const game = freezeEnemy(newGame({ distance: 3 }));
    run(game, 1000, { forward: -1 });
    expect(distanceBetween(game)).toBeCloseTo(6, 5);
  });

  it('R1: strafing moves sideways around the boss', () => {
    const game = freezeEnemy(newGame({ distance: 4 }));
    run(game, 100, { right: 1 });
    // Player at (0, 4) facing -z: right is +x.
    expect(game.player.pos.x).toBeGreaterThan(0.25);
    expect(distanceBetween(game)).toBeGreaterThan(3.9);
  });

  it('R1: blocking halves movement speed', () => {
    const game = freezeEnemy(newGame({ distance: 8 }));
    run(game, 1000, { forward: 1, blockHeld: true });
    expect(distanceBetween(game)).toBeCloseTo(8 - PLAYER.moveSpeed * PLAYER.blockMoveMultiplier, 5);
  });

  it('R1: player cannot get closer than 1.2 m to the boss', () => {
    const game = freezeEnemy(newGame({ distance: 2 }));
    run(game, 2000, { forward: 1 });
    expect(distanceBetween(game)).toBeCloseTo(MIN_DISTANCE, 5);
  });

  it('R1: player cannot leave the arena', () => {
    const game = freezeEnemy(newGame({ distance: 9 }));
    run(game, 3000, { forward: -1 });
    expect(Math.hypot(game.player.pos.x, game.player.pos.z)).toBeLessThanOrEqual(ARENA_RADIUS + 1e-9);
  });
});

describe('R1: attack, block, dodge actions', () => {
  it('R1: attack lands after 250 ms wind-up and ends after 550 ms', () => {
    const game = freezeEnemy(newGame({ distance: 2.5 }));
    const swing = tap(game, { attack: true });
    expect(types(swing)).toContain('playerSwing');
    expect(game.player.attackPhase).toBe('windup');
    let events = runUntil(game, 240);
    expect(types(events)).not.toContain('enemyHit');
    events = runUntil(game, 250);
    expect(types(events)).toContain('enemyHit');
    expect(game.player.status).toBe('attacking');
    runUntil(game, 550);
    expect(game.player.status).toBe('ready');
  });

  it('R1: attack out of reach whiffs', () => {
    const game = freezeEnemy(newGame({ distance: 3.5 }));
    tap(game, { attack: true });
    expect(types(runUntil(game, 300))).toContain('whiff');
  });

  it('R1: block and dodge cannot start during attack wind-up', () => {
    const game = freezeEnemy(newGame());
    tap(game, { attack: true });
    tap(game, { blockPressed: true, blockHeld: true, dodge: true });
    expect(game.player.blocking).toBe(false);
    expect(game.player.status).toBe('attacking');
  });

  it('R1: raising the guard cancels attack recovery', () => {
    const game = freezeEnemy(newGame());
    tap(game, { attack: true });
    runUntil(game, 300);
    expect(game.player.attackPhase).toBe('recovery');
    tap(game, { blockPressed: true, blockHeld: true });
    expect(game.player.status).toBe('ready');
    expect(game.player.blocking).toBe(true);
  });

  it('R1: holding block keeps the guard up; releasing drops it', () => {
    const game = freezeEnemy(newGame());
    tap(game, { blockPressed: true, blockHeld: true });
    run(game, 500, { blockHeld: true });
    expect(game.player.blocking).toBe(true);
    run(game, 10);
    expect(game.player.blocking).toBe(false);
  });

  it('R1: dodge with right held sidesteps 1.6 m to the right over 400 ms', () => {
    const game = freezeEnemy(newGame({ distance: 4 }));
    const events = tap(game, { dodge: true, right: 1 });
    expect(events.find((e) => e.type === 'dodge').side).toBe('right');
    expect(game.player.status).toBe('dodging');
    runUntil(game, 400);
    expect(game.player.status).toBe('ready');
    expect(game.player.pos.x).toBeCloseTo(1.6, 5);
  });

  it('R1: dodge with left held sidesteps left; with no direction it steps back', () => {
    const left = freezeEnemy(newGame({ distance: 4 }));
    tap(left, { dodge: true, right: -1 });
    runUntil(left, 400);
    expect(left.player.pos.x).toBeCloseTo(-1.6, 5);

    const back = freezeEnemy(newGame({ distance: 4 }));
    tap(back, { dodge: true });
    runUntil(back, 400);
    expect(back.player.pos.z).toBeCloseTo(5.6, 5);
  });

  it('R1: a second dodge needs the 700 ms cooldown', () => {
    const game = freezeEnemy(newGame({ distance: 4 }));
    tap(game, { dodge: true });
    runUntil(game, 600);
    tap(game, { dodge: true });
    expect(game.player.status).toBe('ready');
    runUntil(game, 700);
    tap(game, { dodge: true });
    expect(game.player.status).toBe('dodging');
  });
});
