// Particle effects (deflect/block sparks, drifting embers) and camera shake.
import * as THREE from 'three';
import { glowTexture } from './textures.js';

const GRAVITY = -9.8;

function pointsMaterial(size, map) {
  return new THREE.PointsMaterial({
    size,
    map,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
}

/** Pooled spark bursts. Colors are pushed above 1.0 so they bloom. */
export function createSparks(scene, capacity = 400) {
  const positions = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);
  const vel = new Float32Array(capacity * 3);
  const life = new Float32Array(capacity);
  const maxLife = new Float32Array(capacity);
  const base = new Float32Array(capacity * 3);
  for (let i = 0; i < capacity; i++) positions[i * 3 + 1] = -100;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(geo, pointsMaterial(0.06, glowTexture()));
  points.frustumCulled = false;
  scene.add(points);

  const flash = new THREE.PointLight(0xffc070, 0, 6, 2);
  scene.add(flash);
  let flashLevel = 0;
  let next = 0;

  /**
   * Emits `count` sparks at `origin`.
   * opts: { speed, color: THREE.Color, spread, dir: Vector3, light }
   */
  function burst(origin, count, opts = {}) {
    const speed = opts.speed ?? 4;
    const color = opts.color ?? new THREE.Color(3, 2, 0.8);
    const dir = opts.dir ?? new THREE.Vector3(0, 0.5, 0);
    for (let n = 0; n < count; n++) {
      const i = next;
      next = (next + 1) % capacity;
      positions[i * 3] = origin.x;
      positions[i * 3 + 1] = origin.y;
      positions[i * 3 + 2] = origin.z;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const s = speed * (0.35 + Math.random() * 0.65);
      vel[i * 3] = Math.sin(phi) * Math.cos(theta) * s + dir.x * speed;
      vel[i * 3 + 1] = Math.abs(Math.cos(phi)) * s * 0.8 + dir.y * speed;
      vel[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * s + dir.z * speed;
      maxLife[i] = life[i] = 0.2 + Math.random() * 0.4;
      const w = 0.6 + Math.random() * 0.4;
      base[i * 3] = color.r * w;
      base[i * 3 + 1] = color.g * w;
      base[i * 3 + 2] = color.b * w;
    }
    if (opts.light) {
      flash.position.copy(origin);
      flashLevel = Math.max(flashLevel, opts.light);
    }
  }

  function update(dt) {
    const sec = dt / 1000;
    for (let i = 0; i < capacity; i++) {
      if (life[i] <= 0) continue;
      life[i] -= sec;
      if (life[i] <= 0) {
        positions[i * 3 + 1] = -100;
        colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0;
        continue;
      }
      vel[i * 3 + 1] += GRAVITY * sec;
      positions[i * 3] += vel[i * 3] * sec;
      positions[i * 3 + 1] += vel[i * 3 + 1] * sec;
      positions[i * 3 + 2] += vel[i * 3 + 2] * sec;
      if (positions[i * 3 + 1] < 0.02) {
        positions[i * 3 + 1] = 0.02;
        vel[i * 3 + 1] *= -0.3;
        vel[i * 3] *= 0.6;
        vel[i * 3 + 2] *= 0.6;
      }
      const k = life[i] / maxLife[i];
      colors[i * 3] = base[i * 3] * k;
      colors[i * 3 + 1] = base[i * 3 + 1] * k * k;
      colors[i * 3 + 2] = base[i * 3 + 2] * k * k * k;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    flashLevel = Math.max(0, flashLevel - sec * 60);
    flash.intensity = flashLevel;
  }

  return { burst, update };
}

/** Embers rising from each fire and drifting across the courtyard. */
export function createEmbers(scene, fires, perFire = 50, ambient = 80) {
  const sources = fires.map((f) => f.group.position);
  const count = sources.length * perFire + ambient;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const life = new Float32Array(count);
  const maxLife = new Float32Array(count);
  const phase = new Float32Array(count);

  function spawn(i, initial) {
    let x;
    let y;
    let z;
    if (i < sources.length * perFire) {
      const src = sources[Math.floor(i / perFire)];
      x = src.x + (Math.random() - 0.5) * 0.5;
      y = 0.4 + Math.random() * 0.4;
      z = src.z + (Math.random() - 0.5) * 0.5;
      vel[i * 3 + 1] = 0.6 + Math.random() * 0.9;
    } else {
      x = (Math.random() - 0.5) * 24;
      y = Math.random() * 1.5;
      z = (Math.random() - 0.5) * 24;
      vel[i * 3 + 1] = 0.2 + Math.random() * 0.4;
    }
    vel[i * 3] = 0.15 + Math.random() * 0.25; // light wind toward +x
    vel[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
    maxLife[i] = 2.5 + Math.random() * 3.5;
    life[i] = initial ? Math.random() * maxLife[i] : maxLife[i];
    if (initial) {
      const age = maxLife[i] - life[i];
      x += vel[i * 3] * age;
      y += vel[i * 3 + 1] * age;
    }
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    phase[i] = Math.random() * Math.PI * 2;
  }
  for (let i = 0; i < count; i++) spawn(i, true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(geo, pointsMaterial(0.07, glowTexture()));
  points.frustumCulled = false;
  scene.add(points);

  function update(dt, time) {
    const sec = dt / 1000;
    const t = time / 1000;
    for (let i = 0; i < count; i++) {
      life[i] -= sec;
      if (life[i] <= 0) spawn(i, false);
      const sway = Math.sin(t * 1.7 + phase[i]) * 0.3;
      positions[i * 3] += (vel[i * 3] + sway) * sec;
      positions[i * 3 + 1] += vel[i * 3 + 1] * sec;
      positions[i * 3 + 2] += (vel[i * 3 + 2] + Math.cos(t * 1.3 + phase[i]) * 0.2) * sec;
      const k = life[i] / maxLife[i];
      const fade = Math.min(1, k * 3) * Math.min(1, (1 - k) * 8);
      const flicker = 0.7 + 0.3 * Math.sin(t * 13 + phase[i] * 5);
      colors[i * 3] = 3.2 * fade * flicker;
      colors[i * 3 + 1] = 1.1 * fade * flicker * k;
      colors[i * 3 + 2] = 0.15 * fade;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  return { update };
}

/** Trauma-based camera shake: add(amount) on impacts; sample() each frame. */
export function createShake() {
  let trauma = 0;
  let t = 0;
  return {
    add(amount) {
      trauma = Math.min(1, trauma + amount);
    },
    sample(dt) {
      t += dt / 1000;
      trauma = Math.max(0, trauma - (dt / 1000) * 1.8);
      const s = trauma * trauma;
      return {
        x: s * 0.05 * Math.sin(t * 47.3),
        y: s * 0.05 * Math.sin(t * 39.1 + 1.3),
        roll: s * 0.06 * Math.sin(t * 31.7 + 2.1),
      };
    },
    reset() {
      trauma = 0;
    },
  };
}
