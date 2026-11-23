// Combat resolution: deflect vs block vs hit vs dodge (R2, R5), posture effects (R3),
// player hits on the boss and the finishing blow (R6), damage (R7).
import { ATTACKS, DEFLECT, ENEMY, PLAYER } from './constants.js';
import { applyDamage, isDead } from './health.js';
import { addPosture } from './posture.js';
import { breakEnemy, killEnemy, playerHitEffect } from './enemyAI.js';

export function isInvulnerable(player, at) {
  return player.status === 'dodging' && at - player.statusStart < PLAYER.dodgeInvulnerable;
}

export function isGuarding(player) {
  return player.blocking && player.status === 'ready';
}

/** True if a block press at pressAt is inside the deflect window for an impact at `at`. */
export function inDeflectWindow(pressAt, at) {
  const delta = at - pressAt;
  return delta >= 0 && delta <= DEFLECT.window;
}

/**
 * Judges a boss strike against the player at impact time `at`.
 * Returns 'dodged' | 'deflect' | 'block' | 'hit'. Reach is checked by the caller.
 */
export function judgeIncoming(player, attackId, at) {
  const attack = ATTACKS[attackId];
  if (isInvulnerable(player, at)) return 'dodged';
  if (attack.unblockable) return 'hit';
  if (!isGuarding(player)) return 'hit';
  if (player.blockPressEligible && inDeflectWindow(player.blockPressedAt, at)) return 'deflect';
  return 'block';
}

/** Puts the player into a timed status, cancelling attacks/dodges. */
export function setPlayerStatus(player, status, at, duration) {
  player.status = status;
  player.statusStart = at;
  player.statusUntil = at + duration;
  player.attackPhase = null;
  player.blocking = false;
}

/**
 * Applies the outcome of a boss strike. Returns a list of events.
 */
export function applyIncoming(player, enemy, attackId, outcome, at) {
  const attack = ATTACKS[attackId];
  const events = [];
  switch (outcome) {
    case 'deflect': {
      // A deflect can never break the player's own guard: cap at max - 1.
      const room = Math.max(0, player.posture.max - 1 - player.posture.current);
      addPosture(player.posture, Math.min(attack.deflectSelfPosture, room), at);
      events.push({ type: 'deflect', attack: attackId });
      if (addPosture(enemy.posture, attack.deflectEnemyPosture, at)) {
        breakEnemy(enemy, at);
        events.push({ type: 'enemyPostureBreak' });
      }
      break;
    }
    case 'block': {
      events.push({ type: 'block', attack: attackId });
      if (addPosture(player.posture, attack.blockPosture, at)) {
        setPlayerStatus(player, 'broken', at, PLAYER.postureBreakStun);
        events.push({ type: 'playerPostureBreak' });
      }
      break;
    }
    case 'hit': {
      applyDamage(player.health, attack.damage);
      events.push({ type: 'playerHit', attack: attackId, damage: attack.damage });
      if (player.status !== 'broken') setPlayerStatus(player, 'hitstun', at, PLAYER.hitStun);
      if (isDead(player.health)) events.push({ type: 'playerDied' });
      break;
    }
    case 'dodged':
      events.push({ type: 'dodged', attack: attackId });
      break;
    default:
      break;
  }
  return events;
}

/**
 * Applies the player's attack landing on the boss (already in reach) at time `at`.
 * Returns a list of events.
 */
export function applyPlayerHit(enemy, at) {
  const events = [];
  if (enemy.state === 'broken') {
    killEnemy(enemy, at);
    events.push({ type: 'finisher' });
    return events;
  }
  const effect = playerHitEffect(enemy);
  if (!effect) return events;
  if (effect.blocked) {
    events.push({ type: 'enemyBlocked' });
  } else {
    applyDamage(enemy.health, effect.damage);
    events.push({ type: 'enemyHit', damage: effect.damage });
    if (enemy.state === 'recovery') enemy.flinchAt = at;
  }
  if (isDead(enemy.health)) {
    breakEnemy(enemy, at, Infinity);
    events.push({ type: 'enemyPostureBreak', cause: 'health' });
  } else if (addPosture(enemy.posture, effect.posture, at)) {
    breakEnemy(enemy, at, ENEMY.brokenDuration);
    events.push({ type: 'enemyPostureBreak' });
  }
  return events;
}
