// Procedural canvas textures (generated at runtime, no external assets).
import * as THREE from 'three';

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function sprinkleNoise(ctx, size, rand, count, alpha) {
  for (let i = 0; i < count; i++) {
    const v = Math.floor(rand() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
  }
}

function finish(canvas, repeatX, repeatY) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Irregular flagstone floor. */
export function flagstoneTexture(repeat = 8) {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const rand = seeded(7);
  ctx.fillStyle = '#1b1a1a';
  ctx.fillRect(0, 0, size, size);
  const rows = 4;
  const rowH = size / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rand() * 60;
    while (x < size) {
      const w = 70 + rand() * 90;
      const g = 70 + Math.floor(rand() * 40);
      ctx.fillStyle = `rgb(${g},${g - 4},${g - 10})`;
      ctx.fillRect(x + 3, r * rowH + 3, w - 6, rowH - 6);
      // Worn edges / stains.
      ctx.fillStyle = `rgba(0,0,0,${0.15 + rand() * 0.2})`;
      ctx.fillRect(x + 3 + rand() * w * 0.5, r * rowH + 3 + rand() * rowH * 0.5, w * 0.4, rowH * 0.3);
      x += w;
    }
  }
  sprinkleNoise(ctx, size, rand, 9000, 0.12);
  // Cracks.
  ctx.strokeStyle = 'rgba(10,10,10,0.6)';
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    let cx = rand() * size;
    let cy = rand() * size;
    ctx.moveTo(cx, cy);
    for (let k = 0; k < 5; k++) {
      cx += (rand() - 0.5) * 50;
      cy += (rand() - 0.5) * 50;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }
  return finish(canvas, repeat, repeat);
}

/** Rough castle brick for walls and towers. */
export function brickTexture(repeatX = 4, repeatY = 2) {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const rand = seeded(13);
  ctx.fillStyle = '#151414';
  ctx.fillRect(0, 0, size, size);
  const rows = 10;
  const rowH = size / rows;
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 ? -40 : 0;
    for (let x = offset; x < size; x += 80) {
      const g = 60 + Math.floor(rand() * 35);
      ctx.fillStyle = `rgb(${g},${g - 3},${g - 8})`;
      ctx.fillRect(x + 2, r * rowH + 2, 76, rowH - 4);
      if (rand() < 0.25) {
        ctx.fillStyle = `rgba(20,30,15,${0.2 + rand() * 0.3})`; // moss
        ctx.fillRect(x + 2, r * rowH + rowH * 0.6, 76, rowH * 0.4 - 2);
      }
    }
  }
  sprinkleNoise(ctx, size, rand, 8000, 0.1);
  return finish(canvas, repeatX, repeatY);
}

/** Wood grain for beams and barrels. */
export function woodTexture() {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const rand = seeded(21);
  ctx.fillStyle = '#3a2615';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 70; i++) {
    const y = rand() * size;
    const shade = 30 + Math.floor(rand() * 40);
    ctx.strokeStyle = `rgba(${shade + 20},${shade},${shade - 15},0.5)`;
    ctx.lineWidth = 1 + rand() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + (rand() - 0.5) * 8, size * 0.6, y + (rand() - 0.5) * 8, size, y);
    ctx.stroke();
  }
  return finish(canvas, 1, 1);
}

/** Soft round sprite used for embers, sparks and glows. */
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const size = 64;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.6)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
