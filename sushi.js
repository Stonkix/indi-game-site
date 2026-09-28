/* =============================================================================
   DUNGEON PUNK — sushi.js
   СУШИ-БАР «РОЛЛ-МАСТЕР» в правом верхнем углу шапки. Повар в бандане
   периодически метает роллы — они летят через весь экран по дуге и шлёпаются
   где-то слева. Рисуется кодом, звук синтезируется, холст общий с «ГРАДУСОМ»
   (см. overlay.js), так что лишнего requestAnimationFrame не появляется.

   Модуль ленивый: стартовая страница за него не платит.
   ========================================================================== */

import { getOverlay } from './overlay.js';

const KEY = 'dp.sushi.v1';
const INK = '#0a0a0a';
const PAPER = '#f2efe6';
const ACID = '#f5e400';
const RED = '#e10600';

const SHOP_W = 168;
const SHOP_H = 62;

const CSS = `
.sushi-shop {
  position: absolute; z-index: 6;
  right: 10px; bottom: -6px;
  display: none;
  background: none; border: 0; padding: 0;
  line-height: 0;
}
.sushi-shop canvas { display: block; width: 168px; height: 62px; }
/* Место в шапке есть только на широких экранах: правая часть занята навигацией
   и переключателем «Тише/Громче», поэтому ещё и поджимаем отступ. */
@media (min-width: 1400px) {
  .sushi-shop { display: block; }
  .site-header .header-inner { padding-right: 186px; }
}
.sushi-shop:hover canvas { filter: brightness(1.15); }
`;

let injected = false;
let actx = null;
let sushiNoise = null;

function inject() {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.id = 'dp-sushi-style';
  style.textContent = CSS;
  document.head.appendChild(style);
}

function readOn() {
  try { return localStorage.getItem(KEY) !== 'false'; } catch (err) { return true; }
}

function writeOn(v) {
  try { localStorage.setItem(KEY, String(v)); } catch (err) { /* ок */ }
}

function audio() {
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  if (!actx) {
    try { actx = new C(); } catch (err) { return null; }
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

function roundRect(g, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function ensureDock() {
  let dock = document.getElementById('railDock');
  if (!dock) {
    dock = document.createElement('div');
    dock.className = 'rail-dock';
    dock.id = 'railDock';
    document.body.appendChild(dock);
  }
  return dock;
}

export function createSushi() {
  if (document.getElementById('sushiShop')) return null;
  inject();

  let on = readOn();

  const shop = document.createElement('button');
  shop.type = 'button';
  shop.className = 'sushi-shop';
  shop.id = 'sushiShop';
  shop.title = 'Суши-бар «РОЛЛ-МАСТЕР». Ткни — метнут ролл.';
  shop.setAttribute('aria-label', 'Суши-бар РОЛЛ-МАСТЕР: ткнуть, чтобы метнули ролл');
  shop.innerHTML = '<canvas width="168" height="62" aria-hidden="true"></canvas>';

  const header = document.querySelector('.site-header');
  if (header) header.appendChild(shop);

  const dock = ensureDock();
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'rail-toggle';
  toggle.id = 'toggleSushi';
  toggle.setAttribute('aria-pressed', String(on));
  toggle.innerHTML = '<span aria-hidden="true">🍣</span> РОЛЛ-МАСТЕР';
  dock.appendChild(toggle);

  const sg = shop.querySelector('canvas').getContext('2d');
  const fx = getOverlay();

  let vw = 0;
  let vh = 0;
  let floor = 0;
  let t = 0;
  let throwAcc = 0;
  let nextThrow = 3200 + Math.random() * 4000;
  let chefSwing = 0;
  const rolls = [];
  const splats = [];
  const texts = [];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------ Звук ------------------------------- */
  function sfx(kind) {
    const ctx = audio();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (kind === 'throw') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(240, now);
      o.frequency.exponentialRampToValueAtTime(900, now + 0.16);
      g.gain.setValueAtTime(0.06, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now);
      o.stop(now + 0.2);
      return;
    }

    // шлёп
    if (!sushiNoise) {
      const len = Math.floor(ctx.sampleRate * 0.2);
      sushiNoise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = sushiNoise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = sushiNoise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, now);
    lp.frequency.exponentialRampToValueAtTime(220, now + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    src.connect(lp);
    lp.connect(g);
    g.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.22);
  }

  /* ----------------------------- Витрина ----------------------------- */
  function drawShop() {
    sg.clearRect(0, 0, SHOP_W, SHOP_H);

    // Корпус бара
    sg.fillStyle = PAPER;
    sg.fillRect(2, 12, SHOP_W - 4, SHOP_H - 14);
    sg.strokeStyle = INK;
    sg.lineWidth = 3;
    sg.strokeRect(2, 12, SHOP_W - 4, SHOP_H - 14);

    // Вывеска
    sg.fillStyle = INK;
    sg.fillRect(8, 2, SHOP_W - 16, 16);
    sg.strokeStyle = RED;
    sg.lineWidth = 2;
    sg.strokeRect(8, 2, SHOP_W - 16, 16);
    sg.fillStyle = ACID;
    sg.font = 'bold 11px "Permanent Marker", sans-serif';
    sg.textAlign = 'center';
    sg.textBaseline = 'middle';
    sg.fillText('РОЛЛ-МАСТЕР', SHOP_W / 2, 11);

    // Прилавок с роллами
    sg.fillStyle = 'rgba(10,10,10,.08)';
    sg.fillRect(8, 44, 64, 14);
    for (let i = 0; i < 3; i++) {
      const rx = 14 + i * 20;
      sg.fillStyle = INK;
      sg.beginPath();
      sg.arc(rx, 50, 6, 0, Math.PI * 2);
      sg.fill();
      sg.fillStyle = PAPER;
      sg.beginPath();
      sg.arc(rx, 50, 3, 0, Math.PI * 2);
      sg.fill();
      sg.fillStyle = RED;
      sg.beginPath();
      sg.arc(rx, 50, 1.4, 0, Math.PI * 2);
      sg.fill();
    }

    // Повар
    const swing = chefSwing > 0 ? -1.1 * chefSwing : 0;
    sg.save();
    sg.translate(116, 56);

    // Туловище
    roundRect(sg, -13, -22, 26, 24, 7);
    sg.fillStyle = PAPER;
    sg.fill();
    sg.strokeStyle = INK;
    sg.lineWidth = 2.5;
    sg.stroke();
    sg.fillStyle = INK;
    sg.fillRect(-13, -6, 26, 4);
    sg.fillStyle = RED;
    sg.fillRect(-4, -22, 8, 18);

    // Голова + бандана
    sg.beginPath();
    sg.arc(0, -30, 8, 0, Math.PI * 2);
    sg.fillStyle = PAPER;
    sg.fill();
    sg.stroke();
    sg.fillStyle = RED;
    sg.beginPath();
    sg.arc(0, -32, 8.4, Math.PI, Math.PI * 2);
    sg.fill();
    sg.fillRect(-11, -33, 12, 3);
    sg.strokeStyle = INK;
    sg.lineWidth = 2;
    sg.beginPath();
    sg.moveTo(-11, -33);
    sg.lineTo(-18, -30);
    sg.stroke();

    // Рука с роллом
    sg.save();
    sg.translate(-10, -14);
    sg.rotate(swing);
    sg.strokeStyle = INK;
    sg.lineWidth = 5;
    sg.lineCap = 'round';
    sg.beginPath();
    sg.moveTo(0, 0);
    sg.lineTo(-16, -6);
    sg.stroke();
    sg.translate(-18, -7);
    sg.fillStyle = INK;
    sg.beginPath();
    sg.arc(0, 0, 5, 0, Math.PI * 2);
    sg.fill();
    sg.fillStyle = PAPER;
    sg.beginPath();
    sg.arc(0, 0, 2.4, 0, Math.PI * 2);
    sg.fill();
    sg.fillStyle = RED;
    sg.beginPath();
    sg.arc(0, 0, 1, 0, Math.PI * 2);
    sg.fill();
    sg.restore();

    sg.restore();
  }

  /* ------------------------------ Метание ---------------------------- */
  function throwPoint() {
    if (shop.offsetParent === null) return { x: vw * 0.9, y: 70 };
    const r = shop.getBoundingClientRect();
    return { x: r.left + r.width * 0.58, y: r.top + 42 };
  }

  function throwRoll(strong) {
    const p = throwPoint();
    chefSwing = 1;
    rolls.push({
      x: p.x,
      y: p.y,
      vx: -(320 + Math.random() * 220) * (strong ? 1.35 : 1),
      vy: -140 - Math.random() * 130,
      rot: Math.random() * 6,
      vr: -(6 + Math.random() * 7),
      r: 7 + Math.random() * 3
    });
    sfx('throw');
  }

  function splatRoll(roll, idx) {
    rolls.splice(idx, 1);
    // Комок риса с нори: живёт сам по себе и сам убирается.
    for (let i = 0; i < 8; i++) {
      splats.push({
        x: roll.x + (Math.random() * 26 - 13),
        y: floor,
        r: 2 + Math.random() * 4,
        col: Math.random() < 0.6 ? PAPER : (Math.random() < 0.5 ? RED : INK),
        life: 1,
        fade: 0.14 + Math.random() * 0.08
      });
    }
    splats.push({ x: roll.x, y: floor, r: 13 + Math.random() * 5, col: INK, life: 1, fade: 0.09 });
    if (texts.length < 6) {
      texts.push({
        text: ['ШЛЁП!', 'ХЛОП!', 'ШМЯК!'][Math.floor(Math.random() * 3)],
        x: roll.x,
        y: floor - 16,
        life: 1.1,
        col: Math.random() < 0.5 ? PAPER : RED
      });
    }
    sfx('splat');
  }

  function stepFx(dt) {
    t += dt * 1000;
    chefSwing = Math.max(0, chefSwing - dt * 2.2);
    throwAcc += dt * 1000;

    if (throwAcc > nextThrow) {
      throwAcc = 0;
      nextThrow = 3000 + Math.random() * 5000;
      throwRoll(false);
    }

    for (let i = rolls.length - 1; i >= 0; i--) {
      const r = rolls[i];
      r.vy += 1250 * dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.rot += r.vr * dt;
      if (r.y >= floor) splatRoll(r, i);
      else if (r.x < -80) rolls.splice(i, 1);
    }

    for (let i = splats.length - 1; i >= 0; i--) {
      splats[i].life -= dt * splats[i].fade;
      if (splats[i].life <= 0) splats.splice(i, 1);
    }
    if (splats.length > 90) splats.splice(0, splats.length - 90);

    for (let i = texts.length - 1; i >= 0; i--) {
      texts[i].life -= dt * 0.75;
      texts[i].y -= dt * 24;
      if (texts[i].life <= 0) texts.splice(i, 1);
    }
  }

  function drawFxCtx(ctx, env) {
    for (const s of splats) {
      ctx.globalAlpha = Math.max(0, Math.min(0.85, s.life));
      ctx.fillStyle = s.col;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 3, s.r, s.r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    for (const r of rolls) {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.rot);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(0, 0, r.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(0, 0, r.r - 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = RED;
      ctx.beginPath();
      ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ACID;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, r.r + 1.4, 0.6, 2.4);
      ctx.stroke();
      ctx.restore();
    }

    for (const tx of texts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, tx.life);
      ctx.font = 'bold 20px "Permanent Marker", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeStyle = INK;
      ctx.strokeText(tx.text, tx.x, tx.y);
      ctx.fillStyle = tx.col;
      ctx.fillText(tx.text, tx.x, tx.y);
      ctx.restore();
    }
  }

  const drawer = {
    step(dt) {
      stepFx(dt);
    },
    draw(ctx, env) {
      vw = env.vw;
      vh = env.vh;
      floor = env.floor;
      drawShop();
      drawFxCtx(ctx, env);
    }
  };

  function start() {
    fx.measure();
    fx.add(drawer);
    fx.poke();
  }

  function stop() {
    fx.remove(drawer);
  }

  function apply(state) {
    on = state;
    toggle.setAttribute('aria-pressed', String(state));
    shop.hidden = !state;
    writeOn(state);
    if (state) start();
    else stop();
  }

  toggle.addEventListener('click', () => apply(!on));

  shop.addEventListener('click', () => {
    if (!on) return;
    throwRoll(true);
    start();
    fx.poke();
  });

  window.addEventListener('resize', () => {
    if (on) fx.measure();
  });

  shop.hidden = !on;
  toggle.setAttribute('aria-pressed', String(on));
  if (on) start();
  else drawShop();

  return { start, stop, apply, throwRoll };
}
