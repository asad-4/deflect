// Browser entry point: forwards input to the logic, steps the game, and lets
// the renderer and HUD draw the resulting state. No game rules live here.
import * as THREE from 'three';
import { createGame, update as updateGame, facing, distanceBetween } from './logic/game.js';
import {
  consumeIntent,
  createInputState,
  mapKey,
  mapMouseButton,
  pressAction,
  releaseAction,
  releaseAll,
} from './logic/input.js';
import { createStage } from './render/scene.js';
import { buildEnvironment } from './render/environment.js';
import { createEnemyModel } from './render/enemyModel.js';
import { createPlayerView } from './render/playerView.js';
import { createEmbers, createShake, createSparks } from './render/effects.js';
import { createHud } from './hud/hud.js';
import './style.css';

const game = createGame();
const input = createInputState();
let restartClicked = false;

// ---------- input ----------
const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
window.addEventListener('keydown', (e) => {
  if (PREVENT.has(e.code)) e.preventDefault();
  if (e.repeat) return;
  pressAction(input, mapKey(e.code));
});
window.addEventListener('keyup', (e) => releaseAction(input, mapKey(e.code)));
window.addEventListener('mousedown', (e) => {
  if (e.target.closest && e.target.closest('#restart-btn')) return;
  pressAction(input, mapMouseButton(e.button));
});
window.addEventListener('mouseup', (e) => releaseAction(input, mapMouseButton(e.button)));
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('blur', () => releaseAll(input));

// ---------- scene ----------
const stage = createStage(document.getElementById('app'));
const env = buildEnvironment(stage.scene, stage.renderer);
const knight = createEnemyModel();
stage.scene.add(knight.object3D);
const playerView = createPlayerView(stage.camera);
const sparks = createSparks(stage.scene);
const embers = createEmbers(stage.scene, env.fires);
const shake = createShake();
const hud = createHud({ onRestart: () => (restartClicked = true) });

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

/** Point in front of the player's eyes where blades meet. */
function clashPoint() {
  const f = facing(game);
  const reach = Math.min(0.9, Math.max(0.5, distanceBetween(game) - 0.9));
  return tmp.set(game.player.pos.x + f.x * reach, 1.42, game.player.pos.z + f.z * reach);
}

function bossChest() {
  const f = facing(game);
  return tmp.set(game.enemy.pos.x - f.x * 0.3, 1.45, game.enemy.pos.z - f.z * 0.3);
}

function handleEvent(e) {
  knight.onEvent(e);
  playerView.onEvent(e);
  hud.onEvent(e);
  const f = facing(game);
  const back = tmp2.set(-f.x, 0.15, -f.z);
  switch (e.type) {
    case 'deflect':
      sparks.burst(clashPoint(), 60, { speed: 5, color: new THREE.Color(4, 3, 1.4), dir: back, light: 14 });
      shake.add(0.25);
      break;
    case 'block':
      sparks.burst(clashPoint(), 18, { speed: 2.5, color: new THREE.Color(3, 1.6, 0.5), light: 4 });
      shake.add(0.35);
      break;
    case 'enemyBlocked':
      sparks.burst(clashPoint(), 14, { speed: 2.5, color: new THREE.Color(3, 1.8, 0.6), light: 3 });
      shake.add(0.12);
      break;
    case 'enemyHit':
      sparks.burst(bossChest(), 22, { speed: 3, color: new THREE.Color(3.5, 1.2, 0.4), dir: tmp2.set(f.x, 0.2, f.z) });
      shake.add(0.15);
      break;
    case 'playerHit':
      shake.add(e.damage >= 25 ? 0.85 : 0.6);
      break;
    case 'playerPostureBreak':
      shake.add(0.7);
      break;
    case 'enemyPostureBreak':
      sparks.burst(bossChest(), 40, { speed: 4, color: new THREE.Color(4, 2.2, 0.6), light: 10 });
      shake.add(0.3);
      break;
    case 'finisher':
      sparks.burst(bossChest(), 90, { speed: 6, color: new THREE.Color(4, 1.4, 0.5), light: 18 });
      shake.add(0.6);
      break;
    case 'restart':
      shake.reset();
      break;
    default:
      break;
  }
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(100, Math.max(0, now - last));
  last = now;

  const intent = consumeIntent(input);
  if (restartClicked) {
    intent.restart = true;
    restartClicked = false;
  }
  updateGame(game, intent, dt);
  for (const e of game.events) handleEvent(e);

  const { player, enemy } = game;
  const root = knight.object3D;
  root.position.set(enemy.pos.x, 0, enemy.pos.z);
  root.rotation.y = Math.atan2(player.pos.x - enemy.pos.x, player.pos.z - enemy.pos.z);
  knight.update(
    {
      state: enemy.state,
      attack: enemy.attack,
      strike: enemy.strike,
      telegraph: enemy.telegraph,
      stateStart: enemy.stateStart,
      time: game.time,
      distance: distanceBetween(game),
    },
    dt,
  );

  playerView.update({ player, enemyPos: enemy.pos, time: game.time, shake: shake.sample(dt) }, dt);
  env.update(dt, now);
  embers.update(dt, now);
  sparks.update(dt);
  hud.update(game, dt);
  stage.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
