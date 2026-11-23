// Top-level game state: player actions (R1), wiring combat/AI together,
// win/lose and restart (R6, R7, R8). Pure JS — the renderer only reads this.
import {
  ARENA_RADIUS,
  ATTACKS,
  DEFLECT,
  END_SCREEN_DELAY,
  MAX_STEP_MS,
  MIN_DISTANCE,
  PLAYER,
  PLAYER_START,
} from './constants.js';
import { createHealth, isDead } from './health.js';
import { createPosture, recoverPosture, setPosture } from './posture.js';
import { createEnemy, updateEnemy } from './enemyAI.js';
import { applyIncoming, applyPlayerHit, judgeIncoming } from './combat.js';

export function createPlayer() {
  return {
    pos: { x: PLAYER_START.x, z: PLAYER_START.z },
    health: createHealth(),
    posture: createPosture(),
    // 'ready' | 'attacking' | 'dodging' | 'hitstun' | 'broken'
    status: 'ready',
    statusStart: 0,
    statusUntil: 0,
    attackPhase: null, // 'windup' | 'recovery' | null
    attackHitAt: 0,
    blocking: false,
    blockPressedAt: -Infinity,
    blockPressEligible: false,
    lastDodgeAt: -Infinity,
    dodgeDir: { x: 0, z: 0 },
  };
}

export function createGame({ rng = Math.random } = {}) {
  return {
    time: 0,
    status: 'playing', // 'playing' | 'won' | 'lost'
    endedAt: null,
    rng,
    player: createPlayer(),
    enemy: createEnemy(0, rng),
    events: [],
  };
}

export function resetGame(game) {
  const fresh = createGame({ rng: game.rng });
  Object.assign(game, fresh);
  game.events = [{ type: 'restart' }];
  return game;
}

export function distanceBetween(game) {
  const { player, enemy } = game;
  return Math.hypot(enemy.pos.x - player.pos.x, enemy.pos.z - player.pos.z);
}

/** Unit vector from player to enemy (x, z). */
export function facing(game) {
  const { player, enemy } = game;
  const dx = enemy.pos.x - player.pos.x;
  const dz = enemy.pos.z - player.pos.z;
  const d = Math.hypot(dx, dz) || 1;
  return { x: dx / d, z: dz / d };
}

export function endScreenVisible(game) {
  return game.status !== 'playing' && game.time - game.endedAt >= END_SCREEN_DELAY;
}

function canAct(player) {
  return player.status === 'ready' || (player.status === 'attacking' && player.attackPhase === 'recovery');
}

function clampPosition(game) {
  const { player, enemy } = game;
  // Keep minimum distance from the boss.
  let dx = player.pos.x - enemy.pos.x;
  let dz = player.pos.z - enemy.pos.z;
  let d = Math.hypot(dx, dz);
  if (d < MIN_DISTANCE) {
    if (d === 0) {
      dx = 0;
      dz = 1;
      d = 1;
    }
    player.pos.x = enemy.pos.x + (dx / d) * MIN_DISTANCE;
    player.pos.z = enemy.pos.z + (dz / d) * MIN_DISTANCE;
  }
  // Stay inside the arena.
  const r = Math.hypot(player.pos.x, player.pos.z);
  if (r > ARENA_RADIUS) {
    player.pos.x *= ARENA_RADIUS / r;
    player.pos.z *= ARENA_RADIUS / r;
  }
}

function move(game, dirX, dirZ, metres) {
  game.player.pos.x += dirX * metres;
  game.player.pos.z += dirZ * metres;
  clampPosition(game);
}

function endGame(game, result, at) {
  game.status = result;
  game.endedAt = at;
  game.events.push({ type: result === 'won' ? 'win' : 'lose' });
}

/** Handles input at the start of a step (time t0). */
function handleInput(game, intent, t0) {
  const { player, enemy } = game;

  // Block press edge: record time and anti-mash eligibility (R2).
  if (intent.blockPressed) {
    player.blockPressEligible = t0 - player.blockPressedAt >= DEFLECT.mashLockout;
    player.blockPressedAt = t0;
  }

  // Attack / finishing blow (R1, R6).
  if (intent.attack) {
    const inReach = distanceBetween(game) <= PLAYER.attackReach;
    if (enemy.state === 'broken' && inReach && canAct(player)) {
      game.events.push(...applyPlayerHit(enemy, t0));
      player.status = 'ready';
      player.attackPhase = null;
      endGame(game, 'won', t0);
      return;
    }
    if (player.status === 'ready') {
      player.status = 'attacking';
      player.statusStart = t0;
      player.attackPhase = 'windup';
      player.attackHitAt = t0 + PLAYER.attackWindup;
      player.statusUntil = player.attackHitAt + PLAYER.attackRecovery;
      player.blocking = false;
      game.events.push({ type: 'playerSwing' });
    }
  }

  // Dodge (R1).
  if (intent.dodge && canAct(player) && t0 - player.lastDodgeAt >= PLAYER.dodgeCooldown) {
    const f = facing(game);
    let dir;
    if (intent.right > 0) dir = { x: -f.z, z: f.x };
    else if (intent.right < 0) dir = { x: f.z, z: -f.x };
    else dir = { x: -f.x, z: -f.z };
    player.status = 'dodging';
    player.statusStart = t0;
    player.statusUntil = t0 + PLAYER.dodgeDuration;
    player.attackPhase = null;
    player.lastDodgeAt = t0;
    player.dodgeDir = dir;
    player.blocking = false;
    game.events.push({
      type: 'dodge',
      side: intent.right > 0 ? 'right' : intent.right < 0 ? 'left' : 'back',
    });
  }

  // Block: guard is up while held and free to act; raising it cancels attack recovery.
  if (intent.blockHeld && canAct(player)) {
    if (player.status === 'attacking') {
      player.status = 'ready';
      player.attackPhase = null;
    }
    player.blocking = true;
  } else {
    player.blocking = false;
  }
}

function stepPlayer(game, intent, dt, t1) {
  const { player } = game;

  // Status timers.
  if (player.status === 'attacking' && player.attackPhase === 'windup' && t1 >= player.attackHitAt) {
    player.attackPhase = 'recovery';
    if (distanceBetween(game) <= PLAYER.attackReach) {
      game.events.push(...applyPlayerHit(game.enemy, player.attackHitAt));
      if (game.enemy.state === 'dead') {
        endGame(game, 'won', player.attackHitAt);
        return;
      }
    } else {
      game.events.push({ type: 'whiff' });
    }
  }
  if (player.status === 'dodging') {
    const remaining = Math.max(0, Math.min(dt, player.statusUntil - (t1 - dt)));
    move(game, player.dodgeDir.x, player.dodgeDir.z, (PLAYER.dodgeSpeed * remaining) / 1000);
  }
  if (player.status !== 'ready' && t1 >= player.statusUntil) {
    if (player.status === 'broken') {
      setPosture(player.posture, PLAYER.postureAfterBreak);
      player.posture.lastGainAt = t1;
    }
    player.status = 'ready';
    player.attackPhase = null;
    player.blocking = intent.blockHeld;
  }

  // Movement while free (R1).
  if (player.status === 'ready' && (intent.forward || intent.right)) {
    const f = facing(game);
    const right = { x: -f.z, z: f.x };
    let mx = f.x * intent.forward + right.x * intent.right;
    let mz = f.z * intent.forward + right.z * intent.right;
    const len = Math.hypot(mx, mz);
    mx /= len;
    mz /= len;
    const speed = PLAYER.moveSpeed * (player.blocking ? PLAYER.blockMoveMultiplier : 1);
    move(game, mx, mz, (speed * dt) / 1000);
  }

  if (player.status !== 'broken') {
    recoverPosture(player.posture, dt, t1, PLAYER.postureRecoveryPerSec);
  }
}

function resolveStrikes(game, strikes) {
  const { player, enemy } = game;
  for (const s of strikes) {
    if (enemy.state === 'broken' || enemy.state === 'dead') break;
    const attack = ATTACKS[s.attack];
    game.events.push({ type: 'enemyStrike', attack: s.attack, strike: s.strike });
    if (distanceBetween(game) > attack.reach) {
      game.events.push({ type: 'miss', attack: s.attack });
      continue;
    }
    const outcome = judgeIncoming(player, s.attack, s.at);
    game.events.push(...applyIncoming(player, enemy, s.attack, outcome, s.at));
    if (isDead(player.health)) {
      endGame(game, 'lost', s.at);
      return;
    }
  }
}

function step(game, intent, dt) {
  const t0 = game.time;
  const t1 = t0 + dt;
  handleInput(game, intent, t0);
  game.time = t1;
  if (game.status !== 'playing') return;
  stepPlayer(game, intent, dt, t1);
  if (game.status !== 'playing') return;
  const strikes = updateEnemy(game.enemy, dt, t1, game.player.pos, game.rng);
  resolveStrikes(game, strikes);
}

/**
 * Advances the game by dt ms with this frame's intent.
 * Press edges in `intent` are applied on the first sub-step only.
 */
export function update(game, intent, dt) {
  game.events = [];
  if (game.status !== 'playing') {
    if (intent.restart) {
      resetGame(game);
      return game;
    }
    game.time += dt;
    return game;
  }
  let remaining = dt;
  let first = true;
  while (remaining > 0 && game.status === 'playing') {
    const sub = Math.min(MAX_STEP_MS, remaining);
    const subIntent = first
      ? intent
      : { ...intent, attack: false, blockPressed: false, dodge: false, restart: false };
    step(game, subIntent, sub);
    remaining -= sub;
    first = false;
  }
  if (remaining > 0) game.time += remaining;
  return game;
}
