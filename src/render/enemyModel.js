// The boss's visual model: an armored knight built from primitive shapes with
// procedural animation.
//
// Swap-out contract (so a CC0 animated glTF can replace this later):
//   createEnemyModel() -> {
//     object3D,                 // added to the scene; placed/rotated by the caller
//     bladeTip: Object3D,       // world-space point used for sparks
//     update(view, dt),         // view = { state, attack, strike, telegraph,
//                               //          stateStart, time, distance }
//     onEvent(event),           // game events: enemyStrike, enemyHit, enemyBlocked,
//                               //              deflect, block, finisher, ...
//   }
// The model only reads state. It never changes game rules.
import * as THREE from 'three';
import { glowTexture } from './textures.js';

// ---------- poses ----------
// Angles in radians. Knight faces +z; its right hand is on -x.
const BASE_POSE = {
  bodyZ: 0, // forward offset (lunge)
  hipsY: 0, // crouch (negative = lower)
  spine: [0.08, 0, 0],
  head: [0, 0, 0],
  shR: [-0.75, 0, -0.25],
  elR: [-0.9, 0, 0],
  wrR: [0.2, 0, 0],
  shL: [-0.6, 0, 0.35],
  elL: [-1.1, 0, 0],
  legL: [-0.15, 0, 0],
  kneeL: [0.25, 0, 0],
  legR: [0.25, 0, 0],
  kneeR: [0.2, 0, 0],
};

const POSES = {
  idle: {},
  recovery: {
    spine: [0.3, 0.15, 0],
    shR: [-0.35, 0, -0.2],
    elR: [-0.4, 0, 0],
    wrR: [0.6, 0, 0],
    shL: [-0.2, 0, 0.25],
    elL: [-0.5, 0, 0],
  },
  windup_slash: {
    spine: [0.0, -0.45, 0.1],
    shR: [-2.4, 0.2, -0.9],
    elR: [-1.3, 0, 0],
    wrR: [0.9, 0, 0.5],
    shL: [-1.0, 0, 0.5],
    elL: [-0.8, 0, 0],
  },
  strike_slash: {
    spine: [0.15, 0.8, -0.05],
    shR: [-1.4, 0, 0.9],
    elR: [-0.15, 0, 0],
    wrR: [-0.2, 0, 1.2],
    shL: [-0.3, 0, 0.5],
    elL: [-0.6, 0, 0],
  },
  windup_overhead: {
    spine: [-0.3, -0.1, 0],
    head: [-0.2, 0, 0],
    shR: [-3.0, 0, -0.15],
    elR: [-0.9, 0, 0],
    wrR: [1.0, 0, 0],
    shL: [-3.0, 0, 0.15],
    elL: [-0.9, 0, 0],
    legL: [-0.4, 0, 0],
    kneeL: [0.4, 0, 0],
  },
  strike_overhead: {
    hipsY: -0.15,
    spine: [0.55, 0, 0],
    shR: [-1.2, 0, -0.1],
    elR: [-0.1, 0, 0],
    wrR: [-0.5, 0, 0],
    shL: [-1.1, 0, 0.2],
    elL: [-0.2, 0, 0],
    legL: [-0.6, 0, 0],
    kneeL: [0.6, 0, 0],
  },
  windup_combo: {
    hipsY: -0.08,
    spine: [0.3, 0.55, 0],
    shR: [-0.5, 0, 0.7],
    elR: [-0.6, 0, 0],
    wrR: [0.4, 0, -0.9],
    shL: [-0.4, 0, 0.3],
    elL: [-0.9, 0, 0],
    legL: [-0.35, 0, 0],
    kneeL: [0.45, 0, 0],
  },
  windup_combo_alt: {
    hipsY: -0.08,
    spine: [0.2, -0.55, 0],
    shR: [-2.0, 0, -0.8],
    elR: [-0.9, 0, 0],
    wrR: [0.6, 0, 0.6],
    shL: [-0.5, 0, 0.3],
    elL: [-0.9, 0, 0],
    legL: [-0.35, 0, 0],
    kneeL: [0.45, 0, 0],
  },
  strike_combo: {
    hipsY: -0.1,
    spine: [0.3, -0.45, 0],
    shR: [-1.4, 0, -0.5],
    elR: [-0.2, 0, 0],
    wrR: [-0.3, 0, -0.8],
    shL: [-0.4, 0, 0.3],
    elL: [-0.8, 0, 0],
    legL: [-0.5, 0, 0],
    kneeL: [0.5, 0, 0],
  },
  strike_combo_alt: {
    hipsY: -0.1,
    spine: [0.3, 0.55, 0],
    shR: [-1.3, 0, 0.8],
    elR: [-0.1, 0, 0],
    wrR: [-0.3, 0, 1.0],
    shL: [-0.4, 0, 0.3],
    elL: [-0.8, 0, 0],
    legL: [-0.5, 0, 0],
    kneeL: [0.5, 0, 0],
  },
  windup_lunge: {
    hipsY: -0.32,
    spine: [0.45, -0.35, 0],
    head: [-0.35, 0, 0],
    shR: [0.15, 0, -0.35],
    elR: [-1.6, 0, 0],
    wrR: [1.5, 0, 0],
    shL: [-1.2, 0, 0.3],
    elL: [-0.3, 0, 0],
    legL: [-0.9, 0, 0],
    kneeL: [1.2, 0, 0],
    legR: [0.5, 0, 0],
    kneeR: [0.9, 0, 0],
  },
  strike_lunge: {
    bodyZ: 1.6,
    hipsY: -0.22,
    spine: [0.35, 0.2, 0],
    shR: [-1.55, 0, 0],
    elR: [0, 0, 0],
    wrR: [1.55, 0, 0],
    shL: [-0.2, 0, 0.6],
    elL: [-0.2, 0, 0],
    legL: [-1.0, 0, 0],
    kneeL: [0.7, 0, 0],
    legR: [0.7, 0, 0],
    kneeR: [0.2, 0, 0],
  },
  broken: {
    hipsY: -0.42,
    spine: [0.65, 0.1, 0.12],
    head: [0.45, 0, 0],
    shR: [0.05, 0, -0.3],
    elR: [-0.2, 0, 0],
    wrR: [0.9, 0, 0],
    shL: [-0.5, 0, 0.4],
    elL: [-0.6, 0, 0],
    legL: [-1.25, 0, 0],
    kneeL: [1.5, 0, 0],
    legR: [0.3, 0, 0],
    kneeR: [1.55, 0, 0],
  },
};

const JOINT_KEYS = ['spine', 'head', 'shR', 'elR', 'wrR', 'shL', 'elL', 'legL', 'kneeL', 'legR', 'kneeR'];

function pose(name) {
  return { ...BASE_POSE, ...POSES[name] };
}

function clonePose(p) {
  const out = { bodyZ: p.bodyZ, hipsY: p.hipsY };
  for (const k of JOINT_KEYS) out[k] = [...p[k]];
  return out;
}

function blendToward(cur, target, alpha) {
  cur.bodyZ += (target.bodyZ - cur.bodyZ) * alpha;
  cur.hipsY += (target.hipsY - cur.hipsY) * alpha;
  for (const k of JOINT_KEYS) {
    for (let i = 0; i < 3; i++) cur[k][i] += (target[k][i] - cur[k][i]) * alpha;
  }
}

// ---------- geometry ----------
function materials() {
  return {
    steel: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.8, roughness: 0.34 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: 0x4a4e56, metalness: 0.8, roughness: 0.45 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x9a7a3a, metalness: 0.9, roughness: 0.35 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x4a0f12, roughness: 0.9, side: THREE.DoubleSide }),
    leather: new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.8 }),
    visor: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff6a20).multiplyScalar(2.5) }),
    blade: new THREE.MeshStandardMaterial({
      color: 0xc9d0d8,
      metalness: 1,
      roughness: 0.18,
      emissive: 0xff1010,
      emissiveIntensity: 0,
    }),
  };
}

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function buildSword(mat) {
  const sword = new THREE.Group();
  // Built with the blade extending along local -y from the guard.
  const grip = mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.26, 8), mat.leather, 0, 0.02, 0);
  const pommel = mesh(new THREE.SphereGeometry(0.04, 8, 6), mat.trim, 0, 0.17, 0);
  const guard = mesh(new THREE.BoxGeometry(0.3, 0.035, 0.05), mat.trim, 0, -0.12, 0);
  const shape = new THREE.Shape();
  shape.moveTo(-0.035, 0);
  shape.lineTo(0.035, 0);
  shape.lineTo(0.028, -1.05);
  shape.lineTo(0, -1.2);
  shape.lineTo(-0.028, -1.05);
  shape.lineTo(-0.035, 0);
  const bladeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.008,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 1,
  });
  bladeGeo.translate(0, 0, -0.004);
  const blade = mesh(bladeGeo, mat.blade, 0, -0.135, 0);
  sword.add(grip, pommel, guard, blade);
  const tip = new THREE.Object3D();
  tip.position.set(0, -1.25, 0);
  sword.add(tip);
  const mid = new THREE.Object3D();
  mid.position.set(0, -0.85, 0);
  sword.add(mid);
  return { sword, tip, mid };
}

function buildLimb(parent, mat, upperLen, lowerLen, radius, side) {
  const upper = new THREE.Group();
  parent.add(upper);
  upper.add(mesh(new THREE.CylinderGeometry(radius, radius * 0.85, upperLen, 10), mat.steel, 0, -upperLen / 2, 0));
  const joint = new THREE.Group();
  joint.position.y = -upperLen;
  upper.add(joint);
  joint.add(mesh(new THREE.SphereGeometry(radius * 1.05, 10, 8), mat.darkSteel));
  joint.add(mesh(new THREE.CylinderGeometry(radius * 0.85, radius * 0.75, lowerLen, 10), mat.steel, 0, -lowerLen / 2, 0));
  const end = new THREE.Group();
  end.position.y = -lowerLen;
  joint.add(end);
  return { upper, joint, end, side };
}

export function createEnemyModel() {
  const mat = materials();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hips = new THREE.Group();
  hips.position.y = 1.05;
  body.add(hips);
  hips.add(mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.22, 12), mat.darkSteel, 0, 0, 0));
  // Tasset skirt plates.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const plate = mesh(new THREE.BoxGeometry(0.16, 0.3, 0.03), mat.steel, Math.sin(a) * 0.24, -0.17, Math.cos(a) * 0.24);
    plate.rotation.y = a;
    plate.rotation.x = 0.15;
    hips.add(plate);
  }

  const spine = new THREE.Group();
  spine.position.y = 0.1;
  hips.add(spine);
  spine.add(mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.25, 12), mat.darkSteel, 0, 0.12, 0));
  const chest = mesh(new THREE.CylinderGeometry(0.34, 0.24, 0.46, 16), mat.steel, 0, 0.42, 0);
  chest.scale.z = 0.75;
  spine.add(chest);
  const breast = mesh(new THREE.SphereGeometry(0.26, 16, 10), mat.steel, 0, 0.45, 0.06);
  breast.scale.set(1.15, 0.95, 0.75);
  spine.add(breast);
  spine.add(mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.06, 16), mat.leather, 0, 0.02, 0));
  const plackart = mesh(new THREE.BoxGeometry(0.05, 0.34, 0.05), mat.trim, 0, 0.45, 0.25);
  plackart.rotation.x = -0.12;
  spine.add(plackart);
  const gorget = mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.1, 12), mat.darkSteel, 0, 0.66, 0);
  spine.add(gorget);

  // Cape.
  const capeGeo = new THREE.PlaneGeometry(0.62, 1.15, 1, 6);
  const cape = new THREE.Mesh(capeGeo, mat.cloth);
  cape.position.set(0, 0.08, -0.2);
  cape.rotation.x = 0.12;
  cape.castShadow = true;
  spine.add(cape);

  // Head.
  const head = new THREE.Group();
  head.position.y = 0.72;
  spine.add(head);
  head.add(mesh(new THREE.CylinderGeometry(0.135, 0.14, 0.3, 14), mat.steel, 0, 0.13, 0));
  head.add(mesh(new THREE.SphereGeometry(0.137, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat.steel, 0, 0.28, 0));
  const visorSlit = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.022, 0.02), mat.visor);
  visorSlit.position.set(0, 0.18, 0.132);
  head.add(visorSlit);
  head.add(mesh(new THREE.BoxGeometry(0.02, 0.2, 0.03), mat.trim, 0, 0.12, 0.138));
  const crest = mesh(new THREE.BoxGeometry(0.03, 0.12, 0.34), mat.cloth, 0, 0.43, -0.02);
  head.add(crest);

  // Shoulders: knight's right is -x.
  const shoulderR = new THREE.Group();
  shoulderR.position.set(-0.4, 0.56, 0);
  spine.add(shoulderR);
  const shoulderL = new THREE.Group();
  shoulderL.position.set(0.4, 0.56, 0);
  spine.add(shoulderL);
  for (const [s, dir] of [[shoulderR, -1], [shoulderL, 1]]) {
    const pauldron = mesh(new THREE.SphereGeometry(0.19, 14, 10), mat.steel, dir * 0.02, 0.02, 0);
    pauldron.scale.set(1.05, 0.75, 1.05);
    s.add(pauldron);
    const rim = mesh(new THREE.TorusGeometry(0.17, 0.018, 6, 18), mat.trim, dir * 0.02, -0.02, 0);
    rim.rotation.x = Math.PI / 2;
    s.add(rim);
  }
  const armR = buildLimb(shoulderR, mat, 0.34, 0.32, 0.08, 'R');
  const armL = buildLimb(shoulderL, mat, 0.34, 0.32, 0.08, 'L');
  for (const arm of [armR, armL]) {
    arm.joint.add(mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.14, 10), mat.darkSteel, 0, -0.22, 0)); // vambrace flare
    arm.end.add(mesh(new THREE.BoxGeometry(0.1, 0.11, 0.1), mat.darkSteel, 0, -0.04, 0)); // gauntlet
  }

  const wristR = new THREE.Group();
  wristR.position.y = -0.06;
  armR.end.add(wristR);
  const { sword, tip, mid } = buildSword(mat);
  // Rotate so the blade lies along the hand's +z: with the arm hanging, it
  // points forward; with the forearm raised forward, it points up.
  sword.rotation.x = -Math.PI / 2;
  wristR.add(sword);

  // Legs.
  const legL = buildLimb(hips, mat, 0.5, 0.5, 0.1, 'L');
  const legR = buildLimb(hips, mat, 0.5, 0.5, 0.1, 'R');
  legL.upper.position.set(0.13, -0.05, 0);
  legR.upper.position.set(-0.13, -0.05, 0);
  for (const leg of [legL, legR]) {
    leg.joint.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), mat.trim, 0, 0, 0.03)); // poleyn
    leg.end.add(mesh(new THREE.BoxGeometry(0.13, 0.08, 0.28), mat.darkSteel, 0, -0.02, 0.06)); // sabaton
  }

  // Telegraph effects: glint sprite and red danger light.
  const glint = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
      color: new THREE.Color(1, 1, 1).multiplyScalar(3),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0,
    }),
  );
  glint.scale.set(0.3, 0.3, 1);
  mid.add(glint);
  const dangerLight = new THREE.PointLight(0xff1a0a, 0, 4, 2);
  dangerLight.position.set(0, 0, 0.15);
  mid.add(dangerLight);

  const joints = {
    spine,
    head,
    shR: shoulderR,
    elR: armR.joint,
    wrR: wristR,
    shL: shoulderL,
    elL: armL.joint,
    legL: legL.upper,
    kneeL: legL.joint,
    legR: legR.upper,
    kneeR: legR.joint,
  };
  const baseHipsY = hips.position.y;

  const cur = clonePose(pose('idle'));
  let strikeUntil = -Infinity;
  let strikeName = null;
  let flinchAt = -Infinity;
  let recoilAt = -Infinity;
  let lastTime = 0;

  function targetFor(view) {
    const { state, attack, strike, time } = view;
    if (time < strikeUntil && strikeName) return { name: strikeName, rate: 30 };
    if (state === 'windup') {
      const alt = attack === 'combo' && strike % 2 === 1 ? '_alt' : '';
      const total = view.telegraph ? view.telegraph.msToImpact + (time - view.stateStart) : 700;
      const windupMs = attack === 'combo' && strike > 0 ? 350 : Math.max(300, total);
      return { name: `windup_${attack}${alt}`, rate: 3.5 / ((windupMs * 0.8) / 1000) };
    }
    if (state === 'recovery') return { name: 'recovery', rate: 5 };
    if (state === 'broken' || state === 'dead') return { name: 'broken', rate: 6 };
    return { name: 'idle', rate: 5 };
  }

  function update(view, dt) {
    const time = view.time;
    lastTime = time;
    const { name, rate } = targetFor(view);
    const target = clonePose(pose(name));

    // Keep the lunge from passing through the player.
    target.bodyZ = Math.min(target.bodyZ, Math.max(0, (view.distance ?? 3) - 1.1));

    // Idle breathing and weight shift.
    if (name === 'idle') {
      const t = time / 1000;
      target.spine[0] += Math.sin(t * 1.8) * 0.03;
      target.hipsY += Math.sin(t * 1.8) * 0.015;
      target.shR[0] += Math.sin(t * 1.8 + 0.5) * 0.04;
    }
    if (name === 'broken' && view.state === 'broken') {
      const t = time / 1000;
      target.spine[2] += Math.sin(t * 2.3) * 0.12; // stagger sway
      target.head[2] += Math.sin(t * 2.3 + 0.6) * 0.15;
    }

    blendToward(cur, target, 1 - Math.exp(-rate * (dt / 1000)));

    // Additive reactions.
    const flinch = Math.max(0, 1 - (time - flinchAt) / 300);
    const recoil = Math.max(0, 1 - (time - recoilAt) / 380);
    for (const k of JOINT_KEYS) joints[k].rotation.set(cur[k][0], cur[k][1], cur[k][2]);
    joints.spine.rotation.x += -0.35 * flinch - 0.25 * recoil;
    joints.head.rotation.x += -0.3 * flinch;
    joints.shR.rotation.x += 0.9 * recoil;
    joints.elR.rotation.x += -0.4 * recoil;

    hips.position.y = baseHipsY + cur.hipsY;
    body.position.z = cur.bodyZ;

    // Death: topple forward after kneeling.
    if (view.state === 'dead') {
      const k = Math.min(1, Math.max(0, (time - view.stateStart - 250) / 900));
      const ease = k * k;
      body.rotation.x = ease * 1.45;
      body.position.y = -ease * 0.25;
    } else {
      body.rotation.x = 0;
      body.position.y = 0;
    }

    // Cape sway.
    cape.rotation.x = 0.12 + Math.sin(time / 600) * 0.04 + Math.max(0, cur.bodyZ) * 0.3;

    // Telegraph visuals.
    const tg = view.telegraph;
    const glintOn = tg && tg.glint;
    glint.material.opacity = glintOn ? 0.6 + 0.4 * Math.sin(time / 30) : Math.max(0, glint.material.opacity - dt / 120);
    glint.scale.setScalar(glintOn ? 0.2 + (1 - tg.msToImpact / 300) * 0.3 : 0.2);
    const danger = tg && tg.unblockable;
    mat.blade.emissiveIntensity = danger ? 1.2 + Math.sin(time / 60) * 0.4 : 0;
    dangerLight.intensity = danger ? 1.5 + Math.sin(time / 60) * 0.5 : 0;
  }

  function onEvent(e) {
    switch (e.type) {
      case 'enemyStrike': {
        const alt = e.attack === 'combo' && e.strike % 2 === 1 ? '_alt' : '';
        strikeName = `strike_${e.attack}${alt}`;
        strikeUntil = lastTime + (e.attack === 'lunge' ? 260 : 170);
        break;
      }
      case 'enemyHit':
      case 'enemyBlocked':
        flinchAt = lastTime;
        break;
      case 'deflect':
        recoilAt = lastTime;
        strikeUntil = -Infinity;
        break;
      default:
        break;
    }
  }

  return { object3D: root, bladeTip: tip, bladeMid: mid, update, onEvent };
}
