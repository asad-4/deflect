// Posture (R3): rises on blocks/deflects, recovers after a delay, breaks at max.
import { MAX_POSTURE, POSTURE_RECOVERY_DELAY } from './constants.js';

export function createPosture(max = MAX_POSTURE) {
  return { current: 0, max, lastGainAt: -Infinity };
}

/** Adds posture. Returns true if this gain filled the bar (a break). */
export function addPosture(posture, amount, now) {
  if (amount <= 0) return false;
  const wasFull = posture.current >= posture.max;
  posture.current = Math.min(posture.max, posture.current + amount);
  posture.lastGainAt = now;
  return !wasFull && posture.current >= posture.max;
}

export function isPostureFull(posture) {
  return posture.current >= posture.max;
}

/**
 * Recovers posture over dt ms at ratePerSec, but only once
 * POSTURE_RECOVERY_DELAY ms have passed since the last gain.
 */
export function recoverPosture(posture, dt, now, ratePerSec) {
  if (now - posture.lastGainAt < POSTURE_RECOVERY_DELAY) return;
  posture.current = Math.max(0, posture.current - (ratePerSec * dt) / 1000);
}

export function setPosture(posture, value) {
  posture.current = Math.max(0, Math.min(posture.max, value));
}
