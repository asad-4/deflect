// First-person view: camera at eye height locked on to the boss, plus the
// player's sword and gloved hand in the lower right, animated from player state.
import * as THREE from 'three';
import { EYE_HEIGHT } from './scene.js';

// Sword-hand poses in camera space (camera looks down -z, +x right, +y up).
// Euler order XYZ: the hand is rolled about z first (blade direction), then
// turned about y, then pitched about x. The forearm runs along the hand's +z.
const POSES = {
  rest: { pos: [0.3, -0.3, -0.62], rot: [-0.3, 0.05, 0.35] },
  block: { pos: [0.06, -0.1, -0.58], rot: [0.12, 0.1, 1.45] },
  windup: { pos: [0.42, -0.08, -0.5], rot: [0.75, 0.1, -0.7] },
  swing: { pos: [-0.2, -0.35, -0.6], rot: [-0.3, -0.6, 1.5] },
  hit: { pos: [0.36, -0.45, -0.55], rot: [0.4, 0, 0.9] },
  broken: { pos: [0.3, -0.55, -0.5], rot: [0.1, 0, 2.2] },
  finisher: { pos: [0.12, -0.22, -0.8], rot: [0.05, 1.5, -1.57] },
  // R9 Ember Strike: sword hauled high over the shoulder, then a full diagonal cut.
  specialWindup: { pos: [0.38, 0.05, -0.42], rot: [1.1, 0.25, -1.0] },
  specialSwing: { pos: [-0.28, -0.4, -0.66], rot: [-0.45, -0.8, 1.75] },
  dodge: { pos: [0.33, -0.36, -0.6], rot: [-0.15, 0.05, 0.55] },
};

function buildSword() {
  const steel = new THREE.MeshStandardMaterial({ color: 0xd6dce4, metalness: 1, roughness: 0.2 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x3a3d44, metalness: 0.9, roughness: 0.4 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xa8843f, metalness: 0.9, roughness: 0.35 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x3b2618, roughness: 0.85 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.75 });
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x1d2230, roughness: 0.9 });

  const hand = new THREE.Group();

  // Sword: grip through the fist along +y, blade above the guard.
  const sword = new THREE.Group();
  hand.add(sword);
  sword.add(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.22, 10), leather));
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), gold);
  pommel.position.y = -0.13;
  sword.add(pommel);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.028, 0.04), gold);
  guard.position.y = 0.12;
  sword.add(guard);
  for (const side of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), gold);
    cap.position.set(side * 0.12, 0.12, 0);
    sword.add(cap);
  }
  const shape = new THREE.Shape();
  shape.moveTo(-0.028, 0);
  shape.lineTo(0.028, 0);
  shape.lineTo(0.022, 0.86);
  shape.lineTo(0, 0.98);
  shape.lineTo(-0.022, 0.86);
  shape.lineTo(-0.028, 0);
  const bladeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.006,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.005,
    bevelSegments: 1,
  });
  bladeGeo.translate(0, 0, -0.003);
  const blade = new THREE.Mesh(bladeGeo, steel);
  blade.position.y = 0.134;
  sword.add(blade);
  const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.7, 0.014), darkSteel);
  fuller.position.y = 0.52;
  sword.add(fuller);
  const tip = new THREE.Object3D();
  tip.position.y = 1.0;
  sword.add(tip);
  const mid = new THREE.Object3D();
  mid.position.y = 0.6;
  sword.add(mid);

  // Gloved fist wrapped around the grip.
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.09, 0.07), glove);
  palm.position.set(0.035, 0, 0);
  hand.add(palm);
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.03, 4, 8), glove);
    finger.rotation.z = Math.PI / 2;
    finger.position.set(0.0, 0.032 - i * 0.022, 0.035);
    hand.add(finger);
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.035, 4, 8), glove);
  thumb.position.set(-0.012, 0.035, -0.02);
  thumb.rotation.set(0.3, 0, 0.9);
  hand.add(thumb);
  // The forearm runs back toward the camera (+z) and slightly down.
  const arm = new THREE.Group();
  arm.position.set(0.03, -0.02, 0.03);
  arm.rotation.x = -0.35;
  hand.add(arm);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.08, 12), glove);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.z = 0.06;
  arm.add(cuff);
  const bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.14, 12), darkSteel);
  bracer.rotation.x = Math.PI / 2;
  bracer.position.z = 0.16;
  arm.add(bracer);
  const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.072, 0.45, 12), sleeve);
  forearm.rotation.x = Math.PI / 2;
  forearm.position.z = 0.44;
  arm.add(forearm);

  hand.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  return { hand, tip, mid };
}

export function createPlayerView(camera) {
  const { hand, tip, mid } = buildSword();
  const rig = new THREE.Group();
  hand.scale.setScalar(0.65); // shrink the model, not its distance from the eye
  rig.add(hand);
  camera.add(rig);

  // A small warm fill light near the hand so the blade stays readable.
  const fill = new THREE.PointLight(0xffb070, 0.6, 2.5, 2);
  fill.position.set(0.2, 0.1, -0.2);
  camera.add(fill);

  const cur = { pos: new THREE.Vector3(...POSES.rest.pos), rot: new THREE.Vector3(...POSES.rest.rot) };
  const lookTarget = new THREE.Vector3();
  let lookInit = false;
  let deflectAt = -Infinity;
  let blockAt = -Infinity;
  let finisherAt = -Infinity;
  let dodgeAt = -Infinity;
  let dodgeSide = 0;
  let bobPhase = 0;
  let lastPos = null;
  let lastTime = 0;

  function choosePose(view) {
    const { player, time } = view;
    if (time - finisherAt < 900) return { name: 'finisher', rate: 18 };
    if (player.status === 'broken') return { name: 'broken', rate: 8 };
    if (player.status === 'hitstun') return { name: 'hit', rate: 20 };
    if (player.status === 'attacking' && player.attackKind === 'special') {
      const t = time - player.statusStart;
      if (t < 240) return { name: 'specialWindup', rate: 16 };
      if (t < 520) return { name: 'specialSwing', rate: 34 };
      return { name: 'rest', rate: 8 };
    }
    if (player.status === 'attacking') {
      const t = time - player.statusStart;
      if (t < 170) return { name: 'windup', rate: 22 };
      if (t < 400) return { name: 'swing', rate: 38 };
      return { name: 'rest', rate: 9 };
    }
    if (player.status === 'dodging') return { name: 'dodge', rate: 14 };
    if (player.blocking) return { name: 'block', rate: 24 };
    return { name: 'rest', rate: 10 };
  }

  /**
   * view = { player, enemyPos, time, shake: {x, y, roll}, over }
   */
  function update(view, dt) {
    const { player, enemyPos, time } = view;
    lastTime = time;
    const sec = dt / 1000;

    // Head bob from actual movement.
    let speed = 0;
    if (lastPos) speed = Math.hypot(player.pos.x - lastPos.x, player.pos.z - lastPos.z) / Math.max(sec, 1e-3);
    lastPos = { x: player.pos.x, z: player.pos.z };
    const moving = player.status === 'ready' && speed > 0.3;
    if (moving) bobPhase += sec * 9;
    const bob = moving ? Math.sin(bobPhase) * 0.035 : 0;
    const sway = moving ? Math.cos(bobPhase * 0.5) * 0.02 : 0;

    // Camera placement and lock-on.
    const crouch = player.status === 'broken' ? -0.25 : 0;
    camera.position.set(player.pos.x, EYE_HEIGHT + bob + crouch, player.pos.z);
    const desired = new THREE.Vector3(enemyPos.x, 1.45, enemyPos.z);
    if (!lookInit) {
      lookTarget.copy(desired);
      lookInit = true;
    }
    lookTarget.lerp(desired, 1 - Math.exp(-12 * sec));
    camera.up.set(0, 1, 0);
    camera.lookAt(lookTarget);

    // Dodge roll and lean, deflect/hit shake.
    const dodgeT = (time - dodgeAt) / 400;
    const dodgeRoll = dodgeT >= 0 && dodgeT < 1 ? Math.sin(dodgeT * Math.PI) * 0.09 * dodgeSide : 0;
    const dodgeDip = dodgeT >= 0 && dodgeT < 1 ? Math.sin(dodgeT * Math.PI) * 0.08 : 0;
    camera.position.y -= dodgeDip;
    const shake = view.shake ?? { x: 0, y: 0, roll: 0 };
    camera.rotateZ(-dodgeRoll + shake.roll);
    camera.rotateX(shake.x + (player.status === 'broken' ? Math.sin(time / 300) * 0.02 - 0.12 : 0));
    camera.rotateY(shake.y);

    // Sword pose blend.
    const { name, rate } = choosePose(view);
    const target = POSES[name];
    const a = 1 - Math.exp(-rate * sec);
    cur.pos.x += (target.pos[0] - cur.pos.x) * a;
    cur.pos.y += (target.pos[1] - cur.pos.y) * a;
    cur.pos.z += (target.pos[2] - cur.pos.z) * a;
    cur.rot.x += (target.rot[0] - cur.rot.x) * a;
    cur.rot.y += (target.rot[1] - cur.rot.y) * a;
    cur.rot.z += (target.rot[2] - cur.rot.z) * a;

    // Deflect: sharp snap of the blade; block: heavier shove back.
    const d = Math.max(0, 1 - (time - deflectAt) / 220);
    const b = Math.max(0, 1 - (time - blockAt) / 300);
    const idle = Math.sin(time / 700) * 0.006;
    hand.position.set(cur.pos.x + sway + d * 0.05, cur.pos.y + bob * 0.5 + idle + d * 0.06 - b * 0.05, cur.pos.z + b * 0.12);
    hand.rotation.set(cur.rot.x - d * 0.35, cur.rot.y, cur.rot.z + d * 0.25 - b * 0.15);
  }

  function onEvent(e) {
    switch (e.type) {
      case 'deflect':
        deflectAt = lastTime;
        break;
      case 'block':
        blockAt = lastTime;
        break;
      case 'finisher':
      case 'execution':
        finisherAt = lastTime;
        break;
      case 'dodge':
        dodgeAt = lastTime;
        dodgeSide = e.side === 'left' ? -1 : e.side === 'right' ? 1 : 0;
        break;
      case 'restart':
        deflectAt = blockAt = finisherAt = dodgeAt = -Infinity;
        lastPos = null;
        lookInit = false;
        break;
      default:
        break;
    }
  }

  return { update, onEvent, swordTip: tip, swordMid: mid };
}
