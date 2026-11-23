// Boss AI state machine (R4, R5): idle -> windup (one per strike) -> recovery -> idle,
// plus broken (posture break, R3/R6) and dead.
import { ATTACKS, ATTACK_WEIGHTS, ENEMY, ENEMY_START, PLAYER_HIT_ON_ENEMY } from './constants.js';
import { createHealth, healthFraction } from './health.js';
import { createPosture, recoverPosture, setPosture } from './posture.js';

export function createEnemy(now = 0, rng = Math.random) {
  const enemy = {
    pos: { x: ENEMY_START.x, z: ENEMY_START.z },
    health: createHealth(),
    posture: createPosture(),
    state: 'idle',
    stateStart: now,
    idleUntil: 0,
    attack: null,
    strike: 0,
    impactAt: Infinity,
    recoveryUntil: 0,
    brokenUntil: 0,
    lastAttack: null,
    flinchAt: -Infinity,
    telegraph: null,
  };
  enterIdle(enemy, now, rng);
  return enemy;
}

export function idleDuration(rng) {
  return ENEMY.idleBase + rng() * ENEMY.idleRandom;
}

function enterIdle(enemy, now, rng) {
  enemy.state = 'idle';
  enemy.stateStart = now;
  enemy.idleUntil = now + idleDuration(rng);
  enemy.attack = null;
  enemy.strike = 0;
  enemy.impactAt = Infinity;
  enemy.telegraph = null;
}

/** Chooses the next attack id, or null to keep waiting (R4 selection rules). */
export function chooseAttack(distance, lastAttack, rng) {
  if (distance <= ENEMY.meleeRange) {
    const r = rng();
    let acc = 0;
    let pick = ATTACK_WEIGHTS[ATTACK_WEIGHTS.length - 1][0];
    for (const [id, weight] of ATTACK_WEIGHTS) {
      acc += weight;
      if (r < acc) {
        pick = id;
        break;
      }
    }
    if (pick === 'lunge' && lastAttack === 'lunge') pick = 'slash';
    return pick;
  }
  if (distance <= ENEMY.lungeRange && lastAttack !== 'lunge') return 'lunge';
  return null;
}

export function startAttack(enemy, attackId, now) {
  const attack = ATTACKS[attackId];
  enemy.state = 'windup';
  enemy.stateStart = now;
  enemy.attack = attackId;
  enemy.strike = 0;
  enemy.impactAt = now + attack.windups[0];
  enemy.lastAttack = attackId;
  enemy.telegraph = computeTelegraph(enemy, now);
}

export function computeTelegraph(enemy, now) {
  if (enemy.state !== 'windup') return null;
  const attack = ATTACKS[enemy.attack];
  const msToImpact = Math.max(0, enemy.impactAt - now);
  return {
    attack: attack.id,
    strike: enemy.strike,
    msToImpact,
    unblockable: attack.unblockable,
    glint: !attack.unblockable && msToImpact <= ENEMY.glintLead,
  };
}

export function breakEnemy(enemy, now, duration = ENEMY.brokenDuration) {
  enemy.state = 'broken';
  enemy.stateStart = now;
  enemy.brokenUntil = now + duration;
  enemy.attack = null;
  enemy.strike = 0;
  enemy.impactAt = Infinity;
  enemy.telegraph = null;
}

export function killEnemy(enemy, now) {
  enemy.state = 'dead';
  enemy.stateStart = now;
  enemy.telegraph = null;
  enemy.attack = null;
  enemy.impactAt = Infinity;
}

/** How a player's attack that connects is treated, by boss state. */
export function playerHitEffect(enemy) {
  return PLAYER_HIT_ON_ENEMY[enemy.state] ?? null;
}

function distanceTo(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

/**
 * Advances the boss from (now - dt) to now.
 * Returns the strikes whose impact moment fell inside this step:
 * [{ attack, strike, at }]
 */
export function updateEnemy(enemy, dt, now, playerPos, rng = Math.random) {
  const strikes = [];
  const dist = distanceTo(enemy.pos, playerPos);

  switch (enemy.state) {
    case 'idle': {
      if (dist > ENEMY.preferredDistance) {
        const step = Math.min((ENEMY.walkSpeed * dt) / 1000, dist - ENEMY.preferredDistance);
        enemy.pos.x += ((playerPos.x - enemy.pos.x) / dist) * step;
        enemy.pos.z += ((playerPos.z - enemy.pos.z) / dist) * step;
      }
      if (now >= enemy.idleUntil) {
        const pick = chooseAttack(distanceTo(enemy.pos, playerPos), enemy.lastAttack, rng);
        if (pick) startAttack(enemy, pick, now);
      }
      break;
    }
    case 'windup': {
      const attack = ATTACKS[enemy.attack];
      while (enemy.state === 'windup' && now >= enemy.impactAt) {
        const at = enemy.impactAt;
        strikes.push({ attack: attack.id, strike: enemy.strike, at });
        if (enemy.strike < attack.windups.length - 1) {
          enemy.strike += 1;
          enemy.impactAt = at + attack.windups[enemy.strike];
        } else {
          enemy.state = 'recovery';
          enemy.stateStart = at;
          enemy.recoveryUntil = at + attack.recovery;
          enemy.impactAt = Infinity;
        }
      }
      break;
    }
    case 'recovery': {
      if (now >= enemy.recoveryUntil) enterIdle(enemy, now, rng);
      break;
    }
    case 'broken': {
      if (now >= enemy.brokenUntil) {
        setPosture(enemy.posture, ENEMY.postureAfterBreak);
        enemy.posture.lastGainAt = now;
        enemy.posture.holdUntil = -Infinity;
        enterIdle(enemy, now, rng);
      }
      break;
    }
    default:
      break;
  }

  if (enemy.state !== 'broken' && enemy.state !== 'dead') {
    const rate = Math.max(
      ENEMY.postureRecoveryMinPerSec,
      ENEMY.postureRecoveryPerSec * healthFraction(enemy.health),
    );
    recoverPosture(enemy.posture, dt, now, rate);
  }

  enemy.telegraph = computeTelegraph(enemy, now);
  return strikes;
}
