// Entry point: renders the courtyard. Gameplay is wired up in later commits.
import { createStage } from './render/scene.js';
import { buildEnvironment } from './render/environment.js';
import './style.css';

const stage = createStage(document.getElementById('app'));
const env = buildEnvironment(stage.scene);
stage.camera.lookAt(0, 1.4, 0);

let last = performance.now();
function frame(now) {
  const dt = Math.min(100, now - last);
  last = now;
  env.update(dt, now);
  stage.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
