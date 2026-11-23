// Every tunable number from spec.md. Times in ms, distances in m, speeds in m/s.

export const MAX_STEP_MS = 50;

export const ARENA_RADIUS = 11;
export const PLAYER_START = Object.freeze({ x: 0, z: 4 });
export const ENEMY_START = Object.freeze({ x: 0, z: 0 });
export const MIN_DISTANCE = 1.2;

export const MAX_HEALTH = 100;
export const MAX_POSTURE = 100;

export const PLAYER = Object.freeze({
  moveSpeed: 3.0,
  blockMoveMultiplier: 0.5,
  attackWindup: 250,
  attackRecovery: 300,
  attackReach: 3.0,
  attackDamage: 10,
  dodgeDuration: 400,
  dodgeInvulnerable: 300,
  dodgeCooldown: 700,
  dodgeSpeed: 4.0,
  hitStun: 300,
  postureBreakStun: 1500,
  postureAfterBreak: 50,
  postureRecoveryPerSec: 15,
});

export const DEFLECT = Object.freeze({
  window: 180,
  mashLockout: 300,
});

export const POSTURE_RECOVERY_DELAY = 1200;

export const ENEMY = Object.freeze({
  walkSpeed: 2.2,
  preferredDistance: 2.5,
  idleBase: 800,
  idleRandom: 600,
  brokenDuration: 3000,
  postureAfterBreak: 50,
  postureRecoveryPerSec: 12,
  postureRecoveryMinPerSec: 3,
  meleeRange: 3.0,
  lungeRange: 5.0,
  glintLead: 300,
});

// Boss posture/health changes when the player's attack connects, by boss state.
export const PLAYER_HIT_ON_ENEMY = Object.freeze({
  idle: { damage: 0, posture: 8, blocked: true },
  windup: { damage: 10, posture: 4, blocked: false },
  recovery: { damage: 10, posture: 6, blocked: false },
});

export const ATTACKS = Object.freeze({
  slash: Object.freeze({
    id: 'slash',
    windups: [700],
    recovery: 700,
    damage: 15,
    reach: 3.0,
    unblockable: false,
    blockPosture: 15,
    deflectSelfPosture: 5,
    deflectEnemyPosture: 15,
  }),
  overhead: Object.freeze({
    id: 'overhead',
    windups: [1100],
    recovery: 900,
    damage: 25,
    reach: 3.0,
    unblockable: false,
    blockPosture: 25,
    deflectSelfPosture: 6,
    deflectEnemyPosture: 22,
  }),
  combo: Object.freeze({
    id: 'combo',
    windups: [600, 350, 350],
    recovery: 1000,
    damage: 10,
    reach: 3.0,
    unblockable: false,
    blockPosture: 10,
    deflectSelfPosture: 3,
    deflectEnemyPosture: 12,
  }),
  lunge: Object.freeze({
    id: 'lunge',
    windups: [900],
    recovery: 1200,
    damage: 30,
    reach: 5.0,
    unblockable: true,
    blockPosture: 0,
    deflectSelfPosture: 0,
    deflectEnemyPosture: 0,
  }),
});

// Cumulative weights for attack choice at melee range (R4).
export const ATTACK_WEIGHTS = Object.freeze([
  ['slash', 0.35],
  ['overhead', 0.25],
  ['combo', 0.25],
  ['lunge', 0.15],
]);

export const END_SCREEN_DELAY = 1500;
