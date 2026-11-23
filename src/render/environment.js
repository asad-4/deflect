// Ruined castle courtyard at night, built entirely from code.
import * as THREE from 'three';
import { brickTexture, flagstoneTexture, glowTexture, woodTexture } from './textures.js';

const FIRE_SPOTS = [
  [-7.5, -6.5],
  [7.5, -6],
  [-8, 6.5],
  [8.5, 7],
  [0, -12.5],
];

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shadowed(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function buildSky(scene) {
  const skyGeo = new THREE.SphereGeometry(200, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x02040c) },
      horizon: { value: new THREE.Color(0x1a2850) },
    },
    vertexShader: `varying vec3 vPos;
      void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vPos;
      void main() {
        float h = clamp(normalize(vPos).y, 0.0, 1.0);
        gl_FragColor = vec4(mix(horizon, top, pow(h, 0.55)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // Stars.
  const rand = seeded(99);
  const starPos = [];
  for (let i = 0; i < 900; i++) {
    const theta = rand() * Math.PI * 2;
    const y = 0.15 + rand() * 0.85;
    const r = Math.sqrt(1 - y * y);
    starPos.push(Math.cos(theta) * r * 180, y * 180, Math.sin(theta) * r * 180);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xbfd0ff, size: 0.6, sizeAttenuation: true, fog: false }),
  );
  scene.add(stars);

  // Moon with halo.
  const moonDir = new THREE.Vector3(-0.45, 0.55, -0.7).normalize();
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(6, 32, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xe8eeff).multiplyScalar(1.6), fog: false }),
  );
  moon.position.copy(moonDir).multiplyScalar(170);
  scene.add(moon);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture('rgba(170,190,255,0.55)', 'rgba(60,80,160,0)'),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  halo.scale.set(55, 55, 1);
  halo.position.copy(moon.position);
  scene.add(halo);
  return moonDir;
}

function buildDistantTowers(scene) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x04060c, fog: false });
  const rand = seeded(5);
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + rand() * 0.2;
    const dist = 55 + rand() * 30;
    const h = 14 + rand() * 22;
    const r = 1.8 + rand() * 2.2;
    const tower = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, h, 10), mat);
    body.position.y = h / 2 - 2;
    tower.add(body);
    if (rand() < 0.6) {
      const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.3, r * 2.5, 10), mat);
      roof.position.y = h - 2 + r * 1.25;
      tower.add(roof);
    }
    tower.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
    scene.add(tower);
  }
  // A long ridge of curtain wall on the horizon.
  const ridge = new THREE.Mesh(
    new THREE.CylinderGeometry(70, 70, 8, 48, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x03050a, fog: false, side: THREE.BackSide }),
  );
  ridge.position.y = 2;
  scene.add(ridge);
}

function buildFloor(scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ map: flagstoneTexture(22), roughness: 0.92, metalness: 0.02 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Scattered rubble.
  const rand = seeded(42);
  const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 0.95 });
  for (let i = 0; i < 60; i++) {
    const a = rand() * Math.PI * 2;
    const d = 9 + rand() * 6;
    const s = 0.1 + rand() * 0.35;
    const rock = shadowed(new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rubbleMat));
    rock.position.set(Math.cos(a) * d, s * 0.5, Math.sin(a) * d);
    rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    scene.add(rock);
  }
}

function buildWalls(scene) {
  const tex = brickTexture(3, 2);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, color: 0xb0aaa4 });
  const rand = seeded(11);
  const half = 15;
  const segment = 3;
  const sides = [
    { axis: 'x', fixed: -half, rot: 0 },
    { axis: 'x', fixed: half, rot: Math.PI },
    { axis: 'z', fixed: -half, rot: Math.PI / 2 },
    { axis: 'z', fixed: half, rot: -Math.PI / 2 },
  ];
  for (const side of sides) {
    for (let t = -half; t < half; t += segment) {
      // Leave a few collapsed gaps.
      if (rand() < 0.12) {
        const low = shadowed(new THREE.Mesh(new THREE.BoxGeometry(segment, 0.8 + rand(), 1.2), mat));
        place(low, side, t + segment / 2, low.geometry.parameters.height / 2);
        scene.add(low);
        continue;
      }
      const h = 4.5 + rand() * 2.5;
      const block = shadowed(new THREE.Mesh(new THREE.BoxGeometry(segment, h, 1.2), mat));
      place(block, side, t + segment / 2, h / 2);
      scene.add(block);
      // Crenellations on intact segments.
      if (rand() < 0.6) {
        for (let k = 0; k < 2; k++) {
          const merlon = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.2), mat));
          place(merlon, side, t + 0.75 + k * 1.5, h + 0.4);
          scene.add(merlon);
        }
      }
    }
  }

  function place(mesh, side, along, y) {
    if (side.axis === 'z') mesh.position.set(along, y, side.fixed);
    else mesh.position.set(side.fixed, y, along);
    mesh.rotation.y = side.axis === 'z' ? 0 : Math.PI / 2;
  }
}

function buildBrokenTower(scene) {
  const mat = new THREE.MeshStandardMaterial({ map: brickTexture(6, 1), roughness: 0.9, color: 0xa8a29c });
  const tower = new THREE.Group();
  const radius = 3.2;
  const ringH = 1.2;
  const rand = seeded(77);
  for (let ring = 0; ring < 11; ring++) {
    const pieces = 12;
    for (let p = 0; p < pieces; p++) {
      // Upper rings lose more stones: a jagged broken top on one side.
      const broken = ring > 5 && (p < 3 + (ring - 5) * 1.3 || rand() < (ring - 5) * 0.08);
      if (broken) continue;
      const geo = new THREE.CylinderGeometry(radius, radius, ringH, 4, 1, true, (p / pieces) * Math.PI * 2, (Math.PI * 2) / pieces);
      const piece = shadowed(new THREE.Mesh(geo, mat));
      piece.material.side = THREE.DoubleSide;
      piece.position.y = ring * ringH + ringH / 2;
      tower.add(piece);
    }
  }
  // Fallen stones at the base.
  for (let i = 0; i < 10; i++) {
    const s = 0.4 + rand() * 0.6;
    const stone = shadowed(new THREE.Mesh(new THREE.BoxGeometry(s * 1.6, s, s), mat));
    stone.position.set(2 + rand() * 3, s / 2, 2 + rand() * 3);
    stone.rotation.set(rand(), rand() * 3, rand());
    tower.add(stone);
  }
  tower.position.set(-12.5, 0, -12.5);
  scene.add(tower);
}

function buildScaffolding(scene) {
  const mat = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.85, color: 0x8a6a4a });
  const group = new THREE.Group();
  const post = (x, z, h) => {
    const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.2, h, 0.2), mat));
    m.position.set(x, h / 2, z);
    group.add(m);
  };
  const beam = (x, y, z, len, rotY = 0, rotZ = 0) => {
    const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, 0.16), mat));
    m.position.set(x, y, z);
    m.rotation.set(0, rotY, rotZ);
    group.add(m);
  };
  for (const x of [0, 2.5, 5]) {
    post(x, 0, 5.5);
    post(x, 1.4, 5.5);
  }
  for (const y of [1.8, 3.6, 5.3]) {
    beam(2.5, y, 0, 5.4);
    beam(2.5, y, 1.4, 5.4);
    // Planks.
    const plank = shadowed(new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.06, 1.5), mat));
    plank.position.set(2.5, y + 0.1, 0.7);
    group.add(plank);
  }
  // Diagonal braces.
  beam(1.25, 2.7, -0.05, 3.2, 0, 0.62);
  beam(3.75, 2.7, -0.05, 3.2, 0, -0.62);
  // A broken beam leaning against the frame.
  beam(6.2, 1.4, 0.7, 3.2, 0.3, 1.1);
  group.position.set(6, 0, -13.2);
  scene.add(group);
}

function buildBarrels(scene) {
  const wood = woodTexture();
  const mat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.8, color: 0x7a5535 });
  const hoop = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.8, roughness: 0.4 });
  const profile = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    profile.push(new THREE.Vector2(0.32 + Math.sin(t * Math.PI) * 0.06, t * 0.9));
  }
  const barrelGeo = new THREE.LatheGeometry(profile, 16);
  const spots = [
    [11, -9, 0], [11.7, -8.3, 0.4], [11.2, -7.5, 0], [-11.5, 3, 0.2], [-11, 4, 0],
    [3, 12, 0], [12, 10.5, 0.9], [-4.5, -12.5, 0],
  ];
  for (const [x, z, tilt] of spots) {
    const barrel = new THREE.Group();
    barrel.add(shadowed(new THREE.Mesh(barrelGeo, mat)));
    for (const y of [0.15, 0.75]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.02, 6, 20), hoop);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      barrel.add(ring);
    }
    const lid = new THREE.Mesh(new THREE.CircleGeometry(0.33, 16), mat);
    lid.rotation.x = -Math.PI / 2;
    lid.position.y = 0.9;
    barrel.add(lid);
    barrel.position.set(x, tilt > 0.5 ? 0.35 : 0, z);
    if (tilt > 0.5) barrel.rotation.z = Math.PI / 2;
    else barrel.rotation.y = tilt;
    scene.add(barrel);
  }
}

function buildFire(scene, x, z, index) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  // Stone ring and logs.
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x3d3a37, roughness: 1 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const stone = shadowed(new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), stoneMat));
    stone.position.set(Math.cos(a) * 0.6, 0.1, Math.sin(a) * 0.6);
    group.add(stone);
  }
  const logMat = new THREE.MeshStandardMaterial({ color: 0x24160c, roughness: 1, emissive: 0x401000, emissiveIntensity: 0.6 });
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 6), logMat);
    log.rotation.z = Math.PI / 2 - 0.35;
    log.rotation.y = (i / 4) * Math.PI * 2;
    log.position.y = 0.2;
    group.add(log);
  }

  // Flames: additive cones, bright enough to bloom.
  const flames = [];
  const colors = [0xff5a10, 0xff8a20, 0xffd060];
  colors.forEach((c, i) => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(c).multiplyScalar(2.2 + i * 0.6),
      transparent: true,
      opacity: 0.8 - i * 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32 - i * 0.08, 1.1 - i * 0.25, 8, 1, true), mat);
    flame.position.y = 0.55 - i * 0.08;
    group.add(flame);
    flames.push(flame);
  });
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture('rgba(255,140,40,0.9)', 'rgba(255,60,0,0)'),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.scale.set(2.6, 2.6, 1);
  glow.position.y = 0.6;
  group.add(glow);

  const light = new THREE.PointLight(0xff7a2a, 26, 20, 1.5);
  light.position.y = 1.1;
  group.add(light);

  scene.add(group);
  return { group, flames, light, glow, phase: index * 1.7, base: 26 };
}

/**
 * Image-based lighting for metal: a tiny night sky with warm fire blobs,
 * prefiltered with PMREM so armor and blades have something to reflect.
 */
function buildEnvironmentMap(renderer) {
  const envScene = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(10, 16, 8),
    new THREE.MeshBasicMaterial({ color: 0x1a2648, side: THREE.BackSide }),
  );
  envScene.add(sky);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(10, 16),
    new THREE.MeshBasicMaterial({ color: 0x0c0907 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1;
  envScene.add(ground);
  const fireMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff7a2a).multiplyScalar(4) });
  for (const [x, z] of FIRE_SPOTS) {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), fireMat);
    const len = Math.hypot(x, z) || 1;
    blob.position.set((x / len) * 8, 0, (z / len) * 8);
    envScene.add(blob);
  }
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 8, 6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xdde6ff).multiplyScalar(3) }),
  );
  moon.position.set(-4, 5, -6);
  envScene.add(moon);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  return target.texture;
}

/**
 * Builds the whole environment. Returns { fires, update(dt, time) }.
 * fires[].group.position is used by the ember system.
 */
export function buildEnvironment(scene, renderer) {
  scene.background = new THREE.Color(0x0b1226);
  if (renderer) {
    scene.environment = buildEnvironmentMap(renderer);
    scene.environmentIntensity = 1.0;
  }
  scene.fog = new THREE.FogExp2(0x0b1226, 0.032);

  const moonDir = buildSky(scene);
  buildDistantTowers(scene);
  buildFloor(scene);
  buildWalls(scene);
  buildBrokenTower(scene);
  buildScaffolding(scene);
  buildBarrels(scene);

  // Cold moonlight with soft shadows, plus dim ambient fill.
  scene.add(new THREE.HemisphereLight(0x3a4a80, 0x120c08, 0.8));
  const moon = new THREE.DirectionalLight(0x9fb4ff, 1.1);
  moon.position.copy(moonDir).multiplyScalar(30);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -20;
  moon.shadow.camera.right = 20;
  moon.shadow.camera.top = 20;
  moon.shadow.camera.bottom = -20;
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 80;
  moon.shadow.radius = 4;
  moon.shadow.bias = -0.0008;
  moon.shadow.normalBias = 0.02;
  scene.add(moon);

  const fires = FIRE_SPOTS.map(([x, z], i) => buildFire(scene, x, z, i));

  function update(dt, time) {
    const t = time / 1000;
    for (const f of fires) {
      const flicker =
        0.75 + 0.15 * Math.sin(t * 11 + f.phase) + 0.1 * Math.sin(t * 23.7 + f.phase * 2) + 0.08 * Math.random();
      f.light.intensity = f.base * flicker;
      f.glow.material.opacity = 0.6 + 0.4 * flicker;
      f.flames.forEach((flame, i) => {
        const s = 0.85 + 0.25 * Math.sin(t * (9 + i * 3) + f.phase + i);
        flame.scale.set(1 + 0.1 * Math.sin(t * 7 + i), s, 1 + 0.1 * Math.cos(t * 6 + i));
        flame.rotation.y = t * (1 + i * 0.6);
      });
    }
  }

  return { fires, update };
}
