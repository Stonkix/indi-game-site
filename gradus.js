/* =============================================================================
   DUNGEON PUNK — gradus.js
   Алкошоп «ГРАДУС» в шапке сайта. Оттуда двое граждан нетрезвого вида
   периодически плюют и роняют бутылки — прямо на страницу.

   Это шарж из зина, а не реклама: вывеска вымышленная, «18+» на месте,
   за собой можно подмести кнопкой. Всё нарисовано кодом, звук — синтезом.

   Модуль ленивый: пока не загрузился, стартовая страница за него не платит.
   ========================================================================== */

import { getOverlay } from './overlay.js';

const KEY = 'dp.gradus.v1';
const INK = '#0a0a0a';
const PAPER = '#f2efe6';
const ACID = '#f5e400';
const RED = '#e10600';

const SHOP_W = 196;
const SHOP_H = 62;

const CSS = `
.gradus-shop {
  position: absolute; z-index: 6;
  left: 50%; transform: translateX(-50%);
  bottom: -6px;
  display: none;
  background: none; border: 0; padding: 0;
  line-height: 0;
}
@media (min-width: 940px) { .gradus-shop { display: block; } }
.gradus-shop canvas { display: block; width: 196px; height: 62px; }
.gradus-shop:hover canvas { filter: brightness(1.15); }

`;

let injected = false;
let actx = null;

function inject() {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.id = 'dp-gradus-style';
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

export function createGradus() {
  if (document.getElementById('gradusShop')) return null;
  inject();

  let on = readOn();

  const shop = document.createElement('button');
  shop.type = 'button';
  shop.className = 'gradus-shop';
  shop.id = 'gradusShop';
  shop.title = 'Алкошоп «ГРАДУС». Ткни — нальют ещё.';
  shop.setAttribute('aria-label', 'Алкошоп ГРАДУС: ткнуть, чтобы уронили бутылку');
  shop.innerHTML = '<canvas width="196" height="62" aria-hidden="true"></canvas>';

  const header = document.querySelector('.site-header');
  if (header) header.appendChild(shop);

  const dock = ensureDock();
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'rail-toggle';
  toggle.id = 'toggleGradus';
  toggle.setAttribute('aria-pressed', String(on));
  toggle.innerHTML = '<span aria-hidden="true">🍾</span> ГРАДУС';

  const broom = document.createElement('button');
  broom.type = 'button';
  broom.className = 'rail-toggle';
  broom.id = 'gradusBroom';
  broom.innerHTML = '<span aria-hidden="true">🧹</span> ПОДМЕСТИ';

  dock.appendChild(toggle);
  dock.appendChild(broom);

  const sg = shop.querySelector('canvas').getContext('2d');
  const fx = getOverlay();
  let og = null; // общий холст: приходит в draw(ctx, env) из overlay.js

  let vw = 0;
  let vh = 0;
  let floor = 0;
  let t = 0;
  let spawnAcc = 0;
  let nextSpawn = 900;
  let spitAcc = 0;
  let nextSpit = 2600;
  let count = 0;
  let drunk = 0;
  let runY = 80;
  let chaseAcc = 0;
  let nextChase = 14000 + Math.random() * 16000;
  let catAcc = 0;
  let nextCat = 4200 + Math.random() * 4000;
  let catSwat = 0;
  let fallAcc = 0;
  let nextFall = 4200 + Math.random() * 5000;
  const bottles = [];
  const shards = [];
  const puddles = [];
  const spit = [];
  const texts = [];
  const runners = [];
  const puffs = [];
  const fallers = [];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --------------------------- Геометрия ---------------------------- */
  function measure() {
    fx.measure();
    const header = document.querySelector('.site-header');
    const hb = header ? header.getBoundingClientRect().bottom : 60;
    vw = fx.env.vw;
    vh = fx.env.vh;
    floor = fx.env.floor;
    runY = Math.max(40, hb + 22);
  }

  function doorPoint() {
    if (shop.offsetParent === null) return { x: vw * 0.86, y: 70 };
    const r = shop.getBoundingClientRect();
    return { x: r.left + r.width * 0.72, y: r.bottom - 2 };
  }

  /* ----------------------------- Звук ------------------------------- */
  function sfx(kind) {
    const ctx = audio();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (kind === 'break') {
      const len = Math.floor(ctx.sampleRate * 0.3);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2600;
      bp.Q.value = 0.9;
      const g = ctx.createGain();
      g.gain.value = 0.35;
      src.connect(bp);
      bp.connect(g);
      g.connect(ctx.destination);
      src.start(now);
      for (let i = 0; i < 3; i++) {
        const o = ctx.createOscillator();
        const og2 = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = 1800 + Math.random() * 2600;
        og2.gain.setValueAtTime(0.14, now + i * 0.01);
        og2.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.01 + 0.09);
        o.connect(og2);
        og2.connect(ctx.destination);
        o.start(now + i * 0.01);
        o.stop(now + i * 0.01 + 0.1);
      }
      return;
    }

    if (kind === 'spit') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(900, now);
      o.frequency.exponentialRampToValueAtTime(240, now + 0.12);
      g.gain.setValueAtTime(0.08, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now);
      o.stop(now + 0.16);
      return;
    }

    // «бульк» для витрины
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(320, now);
    o.frequency.exponentialRampToValueAtTime(120, now + 0.18);
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.22);
  }

  /* ---------------------------- Витрина ----------------------------- */
  const SIGN = 'ГРАДУС';

  function drawCat(cx, baseY) {
    const sway = reduced ? 0 : Math.sin(t / 420 + cx) * 1.2;
    sg.save();
    sg.translate(cx + sway, baseY);

    sg.strokeStyle = INK;
    sg.lineWidth = 3;
    sg.lineCap = 'round';
    sg.beginPath();
    sg.moveTo(6, -5);
    sg.quadraticCurveTo(14, -9, 11 + (reduced ? 0 : Math.sin(t / 300) * 3), -16);
    sg.stroke();

    sg.fillStyle = INK;
    roundRect(sg, -7, -9, 14, 9, 4);
    sg.fill();
    sg.beginPath();
    sg.arc(0, -12, 4, 0, Math.PI * 2);
    sg.fill();
    sg.beginPath();
    sg.moveTo(-4, -14);
    sg.lineTo(-3, -15.5);
    sg.lineTo(-2, -14);
    sg.moveTo(4, -14);
    sg.lineTo(3, -15.5);
    sg.lineTo(2, -14);
    sg.fill();

    sg.fillStyle = ACID;
    sg.beginPath();
    sg.arc(-1.6, -12.5, 1, 0, Math.PI * 2);
    sg.arc(1.6, -12.5, 1, 0, Math.PI * 2);
    sg.fill();

    if (catSwat > 0) {
      sg.strokeStyle = INK;
      sg.lineWidth = 3;
      sg.beginPath();
      sg.moveTo(5, -7);
      sg.lineTo(5 + catSwat * 9, -2 - catSwat * 4);
      sg.stroke();
    }
    sg.restore();
  }

  function drawShop() {
    sg.clearRect(0, 0, SHOP_W, SHOP_H);

    // Корпус
    sg.fillStyle = PAPER;
    sg.fillRect(2, 14, SHOP_W - 4, SHOP_H - 16);
    sg.strokeStyle = INK;
    sg.lineWidth = 3;
    sg.strokeRect(2, 14, SHOP_W - 4, SHOP_H - 16);

    // Козырёк
    sg.fillStyle = RED;
    sg.beginPath();
    sg.moveTo(0, 14);
    sg.lineTo(SHOP_W, 14);
    sg.lineTo(SHOP_W - 12, 2);
    sg.lineTo(12, 2);
    sg.closePath();
    sg.fill();
    sg.strokeStyle = INK;
    sg.lineWidth = 2.5;
    sg.stroke();
    sg.fillStyle = PAPER;
    for (let x = 14; x < SHOP_W - 10; x += 22) sg.fillRect(x, 4, 11, 8);

    // Вывеска с мигающей неоновой рамой
    const flick = reduced ? 1 : (Math.sin(t / 120) > -0.4 ? 1 : 0.35);
    sg.fillStyle = INK;
    sg.fillRect(30, 20, SHOP_W - 60, 20);
    sg.globalAlpha = flick;
    sg.strokeStyle = ACID;
    sg.lineWidth = 2;
    sg.strokeRect(30, 20, SHOP_W - 60, 20);
    sg.fillStyle = ACID;
    sg.font = 'bold 15px "Permanent Marker", sans-serif';
    sg.textAlign = 'center';
    sg.textBaseline = 'middle';
    sg.fillText(SIGN, SHOP_W / 2, 31);
    sg.globalAlpha = 1;

    // Витрина с бутылками
    sg.fillStyle = 'rgba(10,10,10,.08)';
    sg.fillRect(34, 42, 78, 16);
    for (let i = 0; i < 5; i++) {
      const bx = 38 + i * 15;
      sg.fillStyle = i % 2 ? ACID : RED;
      sg.fillRect(bx, 44, 7, 12);
      sg.fillStyle = INK;
      sg.fillRect(bx + 2, 40, 3, 5);
    }

    // Дверь и оба гражданина
    sg.fillStyle = INK;
    sg.fillRect(126, 34, 54, 24);
    sg.strokeStyle = INK;
    sg.lineWidth = 2.5;
    sg.strokeRect(126, 34, 54, 24);

    for (let i = 0; i < 2; i++) {
      const bx = 138 + i * 26;
      const sway = reduced ? 0 : Math.sin(t / 320 + i * 1.7) * 1.6;
      const lean = drunk > 0 && i === 0 ? 3 : 0;

      sg.save();
      sg.translate(bx, 58 + sway);
      sg.rotate((i ? 0.08 : -0.08) + lean * 0.03);

      // Туловище
      roundRect(sg, -9, -20, 18, 22, 6);
      sg.fillStyle = i ? PAPER : RED;
      sg.fill();
      sg.strokeStyle = INK;
      sg.lineWidth = 2.5;
      sg.stroke();

      // Голова и кепка
      sg.beginPath();
      sg.arc(0, -28, 8, 0, Math.PI * 2);
      sg.fillStyle = PAPER;
      sg.fill();
      sg.stroke();
      sg.fillStyle = INK;
      sg.beginPath();
      sg.arc(0, -30, 8.4, Math.PI, Math.PI * 2);
      sg.fill();
      sg.fillRect(-9, -31, 12, 3);

      // Бутылка в руке
      sg.save();
      sg.translate(10, -12);
      sg.rotate(i ? 0.5 : -0.4);
      sg.fillStyle = ACID;
      sg.fillRect(-3, -10, 6, 12);
      sg.fillStyle = INK;
      sg.fillRect(-2, -14, 4, 5);
      sg.restore();

      sg.restore();
    }

    // Коты на козырьке: сидят, машут хвостом и иногда скидывают бутылку
    drawCat(58, 15);
    drawCat(150, 15);

    // Наклейка 18+
    sg.fillStyle = RED;
    sg.beginPath();
    sg.arc(20, 50, 8, 0, Math.PI * 2);
    sg.fill();
    sg.strokeStyle = INK;
    sg.lineWidth = 2;
    sg.stroke();
    sg.fillStyle = PAPER;
    sg.font = 'bold 9px "Bebas Neue", sans-serif';
    sg.textAlign = 'center';
    sg.textBaseline = 'middle';
    sg.fillText('18', 20, 51);
  }

  /* --------------------------- Физика мусора ------------------------- */
  function spawnBottle(force) {
    const p = doorPoint();
    bottles.push({
      x: p.x + (Math.random() * 16 - 8),
      y: p.y,
      vx: (Math.random() * 90 - 45) + (force ? 40 : 0),
      vy: -60 - Math.random() * 90,
      rot: Math.random() * 0.6 - 0.3,
      vr: Math.random() * 5 - 2.5,
      col: Math.random() < 0.34 ? ACID : (Math.random() < 0.5 ? RED : PAPER)
    });
  }

  function spawnSpit() {
    const p = doorPoint();
    spit.push({
      x: p.x + (Math.random() * 30 - 15),
      y: p.y - 6,
      vx: (Math.random() * 120 - 60),
      vy: -40 - Math.random() * 40,
      r: 2 + Math.random() * 1.6
    });
  }

  function breakBottle(b, idx) {
    bottles.splice(idx, 1);
    count += 1;
    for (let i = 0; i < 7; i++) {
      shards.push({
        x: b.x,
        y: floor,
        vx: (Math.random() * 260 - 130),
        vy: -90 - Math.random() * 170,
        rot: Math.random() * 6,
        vr: Math.random() * 12 - 6,
        s: 3 + Math.random() * 5,
        col: Math.random() < 0.5 ? PAPER : b.col
      });
    }
    if (puddles.length < 14) {
      puddles.push({ x: b.x, r: 10 + Math.random() * 16, a: 0.5 });
    }
    if (texts.length < 8) {
      texts.push({
        text: ['ЗВЯК!', 'ДЗЫНЬ!', 'ХРУСТЬ!', 'БУЛЬК!'][Math.floor(Math.random() * 4)],
        x: b.x,
        y: floor - 14,
        life: 1,
        col: Math.random() < 0.5 ? ACID : PAPER
      });
    }
    sfx('break');
  }

  function spawnSplat(y) {
    if (puddles.length < 16) puddles.push({ x: y.x, r: 6 + Math.random() * 8, a: 0.35, spit: true });
    if (texts.length < 8) {
      texts.push({ text: 'ТЬФУ!', x: y.x, y: floor - 10, life: 1, col: RED });
    }
    sfx('spit');
  }

  /* --------------------- Погоня и «фарфор» --------------------------
     Граждане выбегают из лавки и носятся друг за другом. Тот, что впереди,
     спотыкается, задний в него влетает — и оба разбиваются. Они фарфоровые,
     так что это звон, осколки и подпись «ФАРФОР!», без всякой чернухи. */
  function makeRunner(x, dir, col, ahead) {
    return {
      x, y: runY, vy: 0, dir, col, ahead,
      phase: Math.random() * 6,
      tripped: false,
      tripAt: 0.32 + Math.random() * 0.3
    };
  }

  function startChase() {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const startX = dir > 0 ? -46 : vw + 46;
    runY = Math.max(40, runY);
    runners.push(makeRunner(startX, dir, RED, true));
    runners.push(makeRunner(startX - dir * 52, dir, ACID, false));
    texts.push({ text: 'ДОГОНЯЙ!', x: vw / 2, y: runY - 30, life: 1.5, col: ACID });
  }

  function shatterRunners() {
    const mid = runners.length
      ? runners.reduce((a, r) => a + r.x, 0) / runners.length
      : vw / 2;
    for (let i = 0; i < 20; i++) {
      shards.push({
        x: mid + (Math.random() * 40 - 20),
        y: runY,
        vx: Math.random() * 320 - 160,
        vy: -140 - Math.random() * 220,
        rot: Math.random() * 6,
        vr: Math.random() * 14 - 7,
        s: 4 + Math.random() * 7,
        col: Math.random() < 0.5 ? PAPER : (Math.random() < 0.5 ? ACID : INK),
        porcelain: true
      });
    }
    texts.push({ text: 'ФАРФОР!', x: mid, y: runY - 34, life: 1.8, col: PAPER });
    sfx('break');
    runners.length = 0;
    chaseAcc = 0;
    nextChase = 22000 + Math.random() * 24000;
  }

  function stepRunners(dt) {
    const base = 210;
    for (const r of runners) {
      const speed = r.ahead ? base : base * 1.09;
      r.x += r.dir * speed * (r.tripped ? 0.28 : 1) * dt;
      r.phase += dt * (r.tripped ? 4 : 13);

      r.vy += 1100 * dt;
      r.y += r.vy * dt;
      if (r.y >= runY) { r.y = runY; r.vy = 0; }
      if (!r.tripped && Math.random() < dt * 2.4) r.vy = -150;

      const progress = r.dir > 0 ? (r.x + 46) / (vw + 92) : (vw + 46 - r.x) / (vw + 92);
      if (r.ahead && !r.tripped && progress > r.tripAt) {
        r.tripped = true;
        r.vy = -190;
      }

      if (Math.random() < dt * 14) {
        puffs.push({ x: r.x - r.dir * 10, y: runY + 2, r: 3 + Math.random() * 4, life: 1 });
      }
    }

    if (runners.length === 2) {
      const lead = runners.find((r) => r.ahead);
      const chase = runners.find((r) => !r.ahead);
      if (lead && chase && lead.tripped && Math.abs(chase.x - lead.x) < 20) {
        shatterRunners();
        return;
      }
    }

    for (let i = runners.length - 1; i >= 0; i--) {
      const r = runners[i];
      if (r.x < -80 || r.x > vw + 80) runners.splice(i, 1);
    }
    if (runners.length === 0) {
      chaseAcc = 0;
      nextChase = 20000 + Math.random() * 22000;
    }
  }

  function drawRunner(r) {
    og.save();
    og.translate(r.x, r.y);
    og.scale(r.dir, 1);
    if (r.tripped) og.rotate(0.5);

    const swing = Math.sin(r.phase) * (r.tripped ? 4 : 11);
    og.strokeStyle = INK;
    og.lineWidth = 4;
    og.lineCap = 'round';
    og.beginPath();
    og.moveTo(-3, -2);
    og.lineTo(-3 + swing, 14);
    og.moveTo(3, -2);
    og.lineTo(3 - swing, 14);
    og.stroke();

    roundRect(og, -9, -24, 18, 24, 6);
    og.fillStyle = r.col;
    og.fill();
    og.strokeStyle = INK;
    og.lineWidth = 2.5;
    og.stroke();

    og.beginPath();
    og.arc(0, -30, 8, 0, Math.PI * 2);
    og.fillStyle = PAPER;
    og.fill();
    og.stroke();
    og.fillStyle = INK;
    og.beginPath();
    og.arc(0, -32, 8.4, Math.PI, Math.PI * 2);
    og.fill();
    og.fillRect(-9, -33, 12, 3);

    og.save();
    og.translate(11, -18);
    og.rotate(r.ahead ? -0.8 : 0.4);
    og.fillStyle = ACID;
    og.fillRect(-3, -9, 6, 11);
    og.fillStyle = INK;
    og.fillRect(-2, -13, 4, 5);
    og.restore();

    og.restore();
  }

  /* ------------------- Люди падают, как бутылки ---------------------
     Иногда из лавки выходит гражданин, перегибается через край — и летит вниз
     ровно по той же физике, что и бутылки. Внизу, конечно, бьётся: они
     фарфоровые. Звон, черепки, подпись «ФАРФОР!» — и никакой крови. */
  function spawnFaller() {
    const p = doorPoint();
    fallers.push({
      x: p.x + (Math.random() * 26 - 13),
      y: p.y,
      vx: Math.random() * 110 - 55,
      vy: -60 - Math.random() * 80,
      rot: Math.random() * 0.5 - 0.25,
      vr: Math.random() * 5 - 2.5,
      col: Math.random() < 0.5 ? RED : ACID
    });
  }

  function shatterFaller(f, idx) {
    fallers.splice(idx, 1);
    for (let i = 0; i < 18; i++) {
      shards.push({
        x: f.x,
        y: floor,
        vx: Math.random() * 320 - 160,
        vy: -120 - Math.random() * 230,
        rot: Math.random() * 6,
        vr: Math.random() * 14 - 7,
        s: 4 + Math.random() * 7,
        col: Math.random() < 0.5 ? PAPER : (Math.random() < 0.5 ? f.col : INK),
        porcelain: true
      });
    }
    if (puddles.length < 14) puddles.push({ x: f.x, r: 12 + Math.random() * 16, a: 0.45 });
    if (texts.length < 8) {
      texts.push({
        text: ['ФАРФОР!', 'ХРУСТЬ!', 'ОЙ!', 'ДЗЫНЬ!'][Math.floor(Math.random() * 4)],
        x: f.x,
        y: floor - 16,
        life: 1.2,
        col: Math.random() < 0.5 ? PAPER : ACID
      });
    }
    sfx('break');
  }

  function drawFaller(f) {
    og.save();
    og.translate(f.x, f.y);
    og.rotate(f.rot);

    og.strokeStyle = INK;
    og.lineWidth = 4;
    og.lineCap = 'round';
    og.beginPath();
    og.moveTo(-3, -2);
    og.lineTo(-9, 13);
    og.moveTo(3, -2);
    og.lineTo(9, 13);
    og.stroke();

    roundRect(og, -9, -24, 18, 24, 6);
    og.fillStyle = f.col;
    og.fill();
    og.strokeStyle = INK;
    og.lineWidth = 2.5;
    og.stroke();

    og.beginPath();
    og.arc(0, -30, 8, 0, Math.PI * 2);
    og.fillStyle = PAPER;
    og.fill();
    og.stroke();
    og.fillStyle = INK;
    og.beginPath();
    og.arc(0, -32, 8.4, Math.PI, Math.PI * 2);
    og.fill();
    og.fillRect(-9, -33, 12, 3);

    og.save();
    og.translate(11, -18);
    og.rotate(0.6);
    og.fillStyle = ACID;
    og.fillRect(-3, -9, 6, 11);
    og.fillStyle = INK;
    og.fillRect(-2, -13, 4, 5);
    og.restore();

    og.restore();
  }

  function spawnBottleFromCat(shopX) {
    const p = shop.offsetParent === null
      ? { x: vw * 0.8, y: 60 }
      : (() => {
          const r = shop.getBoundingClientRect();
          return { x: r.left + r.width * shopX, y: r.top + 4 };
        })();
    bottles.push({
      x: p.x,
      y: p.y,
      vx: (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 70),
      vy: -30 - Math.random() * 40,
      rot: Math.random() * 0.6 - 0.3,
      vr: Math.random() * 5 - 2.5,
      col: Math.random() < 0.5 ? ACID : PAPER
    });
    texts.push({ text: 'МЯУ!', x: p.x, y: Math.max(24, p.y - 12), life: 1.2, col: PAPER });
  }

  function step(dt) {
    spawnAcc += dt * 1000;
    spitAcc += dt * 1000;
    chaseAcc += dt * 1000;
    catAcc += dt * 1000;
    fallAcc += dt * 1000;

    if (fallAcc > nextFall) {
      fallAcc = 0;
      nextFall = 4200 + Math.random() * 6000;
      spawnFaller();
    }

    if (runners.length === 0 && chaseAcc > nextChase) startChase();
    if (runners.length) stepRunners(dt);

    if (catAcc > nextCat) {
      catAcc = 0;
      nextCat = 4200 + Math.random() * 5200;
      catSwat = 1;
      spawnBottleFromCat(Math.random() < 0.5 ? 0.24 : 0.78);
    }
    catSwat = Math.max(0, catSwat - dt * 1.6);

    for (let i = puffs.length - 1; i >= 0; i--) {
      puffs[i].life -= dt * 2.4;
      puffs[i].r += dt * 12;
      if (puffs[i].life <= 0) puffs.splice(i, 1);
    }

    if (spawnAcc > nextSpawn) {
      spawnAcc = 0;
      nextSpawn = (drunk > 0 ? 420 : 1400) + Math.random() * 1400;
      spawnBottle(false);
    }
    if (spitAcc > nextSpit) {
      spitAcc = 0;
      nextSpit = 2600 + Math.random() * 3600;
      spawnSpit();
    }
    if (drunk > 0) drunk -= dt;

    for (let i = bottles.length - 1; i >= 0; i--) {
      const b = bottles[i];
      b.vy += 1250 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.vr * dt;
      if (b.y >= floor) breakBottle(b, i);
    }

    for (let i = fallers.length - 1; i >= 0; i--) {
      const f = fallers[i];
      f.vy += 1250 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
      if (f.y >= floor) shatterFaller(f, i);
    }

    for (let i = spit.length - 1; i >= 0; i--) {
      const s = spit[i];
      s.vy += 900 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y >= floor) {
        spawnSplat(s);
        spit.splice(i, 1);
      }
    }

    for (let i = shards.length - 1; i >= 0; i--) {
      const s = shards[i];
      s.vy += 1500 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += s.vr * dt;
      if (s.y > floor) {
        s.y = floor;
        s.vy *= -0.28;
        s.vx *= 0.7;
        s.vr *= 0.6;
      }
      if (Math.abs(s.vy) < 12 && Math.abs(s.vx) < 12) s.vx = s.vy = 0;
    }
    if (shards.length > 70) shards.splice(0, shards.length - 70);

    for (let i = texts.length - 1; i >= 0; i--) {
      texts[i].life -= dt * 0.75;
      texts[i].y -= dt * 26;
      if (texts[i].life <= 0) texts.splice(i, 1);
    }
  }

  function drawOverlay() {
    for (const p of puffs) {
      og.globalAlpha = Math.max(0, p.life) * 0.35;
      og.fillStyle = PAPER;
      og.beginPath();
      og.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      og.fill();
      og.globalAlpha = 1;
    }

    for (const r of runners) drawRunner(r);
    for (const f of fallers) drawFaller(f);

    for (const p of puddles) {
      og.globalAlpha = p.a;
      og.fillStyle = p.spit ? 'rgba(245,228,0,.5)' : 'rgba(242,239,230,.28)';
      og.beginPath();
      og.ellipse(p.x, floor + 3, p.r, p.r * 0.34, 0, 0, Math.PI * 2);
      og.fill();
      og.globalAlpha = 1;
    }

    for (const s of shards) {
      og.save();
      og.globalAlpha = 0.9;
      og.translate(s.x, s.y);
      og.rotate(s.rot);
      og.fillStyle = s.col;
      og.beginPath();
      og.moveTo(-s.s / 2, s.s / 2);
      og.lineTo(s.s / 2, s.s / 3);
      og.lineTo(0, -s.s / 2);
      og.closePath();
      og.fill();
      og.strokeStyle = INK;
      og.lineWidth = 1.5;
      og.stroke();
      og.restore();
    }

    for (const b of bottles) {
      og.save();
      og.translate(b.x, b.y);
      og.rotate(b.rot);
      og.fillStyle = b.col;
      roundRect(og, -7, -22, 14, 30, 5);
      og.fill();
      og.strokeStyle = INK;
      og.lineWidth = 2;
      og.stroke();
      og.fillStyle = b.col;
      og.fillRect(-3, -32, 6, 12);
      og.fillStyle = ACID;
      og.fillRect(-4, -35, 8, 5);
      og.fillStyle = INK;
      og.font = 'bold 6px "Bebas Neue", sans-serif';
      og.textAlign = 'center';
      og.fillText('18+', 0, -9);
      og.restore();
    }

    for (const s of spit) {
      og.beginPath();
      og.ellipse(s.x, s.y, s.r, s.r * 1.5, 0, 0, Math.PI * 2);
      og.fillStyle = 'rgba(245,228,0,.55)';
      og.fill();
      og.strokeStyle = 'rgba(10,10,10,.5)';
      og.lineWidth = 1;
      og.stroke();
    }

    for (const tx of texts) {
      og.save();
      og.globalAlpha = Math.max(0, tx.life);
      og.font = 'bold 20px "Permanent Marker", sans-serif';
      og.textAlign = 'center';
      og.textBaseline = 'middle';
      og.lineWidth = 5;
      og.strokeStyle = INK;
      og.strokeText(tx.text, tx.x, tx.y);
      og.fillStyle = tx.col;
      og.fillText(tx.text, tx.x, tx.y);
      og.restore();
    }
  }

  /* Один «отрисовщик» для общего холста: физика мусора + анимация витрины. */
  const drawer = {
    step(dt) {
      t += dt * 1000;
      step(dt);
    },
    draw(ctx, env) {
      og = ctx;
      vw = env.vw;
      vh = env.vh;
      floor = env.floor;
      drawShop();
      drawOverlay();
    }
  };

  function start() {
    measure();
    fx.add(drawer);
    fx.poke();
  }

  function stop() {
    fx.remove(drawer);
  }

  function sweep() {
    shards.length = 0;
    puddles.length = 0;
    spit.length = 0;
    bottles.length = 0;
    fallers.length = 0;
    puffs.length = 0;
    texts.push({ text: 'ПОДМЕТЕНО!', x: vw / 2, y: floor - 40, life: 1.4, col: ACID });
    sfx('bulk');
    fx.poke();
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
  broom.addEventListener('click', sweep);

  shop.addEventListener('click', () => {
    drunk = 2.2;
    for (let i = 0; i < 3; i++) spawnBottle(true);
    sfx('bulk');
    if (!on) return;
    start();
    fx.poke();
  });

  window.addEventListener('resize', () => {
    if (on) measure();
  });

  shop.hidden = !on;
  toggle.setAttribute('aria-pressed', String(on));
  if (on) start();
  else { measure(); drawShop(); }

  return { start, stop, sweep, apply, getCount: () => count };
}
