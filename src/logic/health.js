// Health (R7).
import { MAX_HEALTH } from './constants.js';

export function createHealth(max = MAX_HEALTH) {
  return { current: max, max };
}

export function applyDamage(health, amount) {
  health.current = Math.max(0, health.current - Math.max(0, amount));
  return health.current;
}

export function isDead(health) {
  return health.current <= 0;
}

export function healthFraction(health) {
  return health.current / health.max;
}
