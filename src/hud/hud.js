// HTML/CSS HUD. Reads game state; the only thing it sends back is the
// Restart button click (forwarded as a restart input by main.js).
import { PLAYER } from '../logic/constants.js';
import { distanceBetween, endScreenVisible } from '../logic/game.js';

const $ = (sel) => document.querySelector(sel);

export function createHud({ onRestart }) {
  const el = {
    bossHealth: $('#boss-panel .health .fill'),
    bossTrail: $('#boss-panel .health .trail'),
    bossPosture: $('#boss-panel .posture'),
    bossPostureFill: $('#boss-panel .posture .fill'),
    playerHealth: $('#player-panel .health .fill'),
    playerTrail: $('#player-panel .health .trail'),
    playerPosture: $('#player-panel .posture'),
    playerPostureFill: $('#player-panel .posture .fill'),
    warning: $('#warning'),
    finisher: $('#finisher-prompt'),
    vignette: $('#vignette'),
    flash: $('#flash'),
    controls: $('#controls'),
    end: $('#end-screen'),
    endTitle: $('#end-title'),
    endSub: $('#end-sub'),
    restart: $('#restart-btn'),
  };
  el.restart.addEventListener('click', () => onRestart());

  let hurt = 0;
  let flash = 0;

  function setBar(fill, trail, fraction) {
    fill.style.transform = `scaleX(${fraction})`;
    trail.style.transform = `scaleX(${fraction})`;
  }

  function setPosture(wrap, fill, posture, broken) {
    const f = posture.current / posture.max;
    fill.style.transform = `scaleX(${f})`;
    wrap.classList.toggle('danger', f >= 0.75 && !broken);
    wrap.classList.toggle('broken', broken);
  }

  function onEvent(e) {
    if (e.type === 'playerHit') hurt = 1;
    if (e.type === 'deflect') flash = 1;
    if (e.type === 'restart') hurt = flash = 0;
  }

  function update(game, dt) {
    const { player, enemy } = game;
    setBar(el.bossHealth, el.bossTrail, enemy.health.current / enemy.health.max);
    setBar(el.playerHealth, el.playerTrail, player.health.current / player.health.max);
    setPosture(el.bossPosture, el.bossPostureFill, enemy.posture, enemy.state === 'broken' || enemy.state === 'dead');
    setPosture(el.playerPosture, el.playerPostureFill, player.posture, player.status === 'broken');

    const unblockable = Boolean(enemy.telegraph && enemy.telegraph.unblockable);
    el.warning.classList.toggle('show', unblockable && game.status === 'playing');

    const canFinish =
      game.status === 'playing' && enemy.state === 'broken' && distanceBetween(game) <= PLAYER.attackReach;
    el.finisher.classList.toggle('show', canFinish);
    el.finisher.textContent =
      enemy.state === 'broken' && !canFinish ? 'Get closer for the finishing blow' : 'J — Finishing Blow';
    if (enemy.state === 'broken' && game.status === 'playing') el.finisher.classList.add('show');

    hurt = Math.max(0, hurt - dt / 450);
    flash = Math.max(0, flash - dt / 180);
    const lowHealth = player.health.current / player.health.max < 0.3 ? 0.25 + 0.1 * Math.sin(game.time / 250) : 0;
    el.vignette.style.opacity = Math.max(hurt, lowHealth).toFixed(3);
    el.flash.style.opacity = flash.toFixed(3);

    el.controls.classList.toggle('faded', game.time > 12000 && game.status === 'playing');

    const showEnd = endScreenVisible(game);
    el.end.classList.toggle('hidden', !showEnd);
    if (showEnd) {
      const won = game.status === 'won';
      el.end.classList.toggle('won', won);
      el.end.classList.toggle('lost', !won);
      el.endTitle.textContent = won ? 'VICTORY' : 'YOU DIED';
      el.endSub.textContent = won ? 'The Ashen Warden falls.' : 'The Warden stands unbroken.';
    }
  }

  return { update, onEvent };
}
