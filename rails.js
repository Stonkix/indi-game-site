/* =============================================================================
   DUNGEON PUNK — rails.js
   Боковые панели, по одной на каждую сторону:

     справа — «режем мыло»: нож, брусок, стружка, отвалившийся кусок;
     слева  — «67 vs ТУН-ТУН»: двое стоят, ткнёшь — начинают драться
              и в финале разносят сайт (через chaos.js).

   Всё рисуется кодом на канвасе, ни одной картинки. Персонажи — оригинальные:
   цифры-наклейка и бревно с битой, а не чужие герои.

   Модуль ленивый: пока панели не включены, стартовая страница за них не платит.
   ========================================================================== */

const INK = '#0a0a0a';
const PAPER = '#f2efe6';
const ACID = '#f5e400';
const RED = '#e10600';

const RAIL_KEY = 'dp.rails.v1';

const CSS = `
.rail {
  position: fixed; z-index: 40; width: 214px;
  background: var(--paper);
  border: var(--border-w) solid var(--ink);
  padding: .45rem;
}
.rail canvas {
  display: block; width: 100%; height: 404px;
  background: var(--ink);
  border: 2px solid var(--ink);
}
.rail__cap {
  font-family: var(--f-btn); font-size: .95rem; letter-spacing: .1em;
  text-align: center; margin: .35rem 0 0;
}
.rail__hint { font-family: var(--f-marker); font-size: .68rem; opacity: .65; text-align: center; margin: .1rem 0 0; }

.rail--soap { right: 1rem; top: 50%; transform: translateY(-50%) rotate(1.2deg); box-shadow: 7px 7px 0 var(--red); }
.rail--fight { left: 1rem; top: 50%; transform: translateY(-50%) rotate(-1.2deg); box-shadow: 7px 7px 0 var(--ink); }

.fight-btn {
  display: block; width: 100%; margin-top: .35rem;
  font-family: var(--f-btn); font-size: 1.05rem; letter-spacing: .06em;
  background: var(--red); color: var(--paper);
  border: 2px solid var(--ink); box-shadow: 3px 3px 0 var(--ink);
  padding: .25rem .4rem .2rem;
}
.fight-btn:hover { background: var(--acid); color: var(--ink); }
.fight-btn:disabled { background: var(--paper); color: var(--ink); opacity: .6; }

@media (max-width: 1559px) {
  .rail {
    width: 142px; top: auto;
    bottom: calc(var(--player-h) + 3rem);
    padding: .35rem;
  }
  .rail canvas { height: 252px; }
  .rail__cap { font-size: .7rem; letter-spacing: .04em; }
  .rail__hint { font-size: .6rem; }
  .rail--soap { transform: rotate(1.2deg); box-shadow: 5px 5px 0 var(--red); }
  .rail--fight { transform: rotate(-1.2deg); box-shadow: 5px 5px 0 var(--ink); }
}
@media (max-width: 560px) {
  .rail { width: 112px; }
  .rail canvas { height: 196px; }
  .rail__cap { font-size: .6rem; }
  .rail__hint { display: none; }
  .fight-btn { font-size: .8rem; letter-spacing: .02em; }
}
@media (prefers-reduced-motion: reduce) {
  .fight-btn { transition: none; }
}
`;

let injected = false;
let actx = null;

function inject() {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.id = 'dp-rails-style';
  style.textContent = CSS;
  document.head.appendChild(style);
}

function readRails() {
  try {
    const raw = localStorage.getItem(RAIL_KEY);
    const val = raw ? JSON.parse(raw) : null;
    return {
      soap: !val || val.soap !== false,
      fight: !val || val.fight !== false
    };
  } catch (err) {
    return { soap: true, fight: true };
  }
}

function writeRails(val) {
  try { localStorage.setItem(RAIL_KEY, JSON.stringify(val)); } catch (err) { /* ок */ }
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

function star(g, cx, cy, r, fill, points) {
  const n = points || 5;
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 ? r * 0.45 : r;
    const a = (Math.PI / n) * i - Math.PI / 2;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 2;
  g.stroke();
}

/* =============================================================================
   ПРАВАЯ ПАНЕЛЬ: РЕЖЕМ МЫЛО
   ========================================================================== */
const W = 200;
const H = 400;
const CYCLE = 4600;

const BAR = { x: 22, y: 150, w: 156, h: 118, r: 12 };
const CUT_X = BAR.x + BAR.w * 0.42;
const KNIFE_TOP = -70;
const KNIFE_BOTTOM = BAR.y + BAR.h + 44;

function easeInOut(p) {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

function createSoap(canvas) {
  const g = canvas.getContext('2d');
  let raf = 0;
  let last = 0;
  let lastDraw = 0;
  let elapsed = 0;
  let acc = 0;
  let parts = [];
  let scaleX = 1;
  let scaleY = 1;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fit() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    scaleX = (rect.width * dpr) / W;
    scaleY = (rect.height * dpr) / H;
    return true;
  }

  function spawnShaving(cutY) {
    if (parts.length > 110) return;
    const colors = [PAPER, PAPER, ACID, RED];
    parts.push({
      x: CUT_X + (Math.random() * 10 - 5),
      y: cutY + (Math.random() * 14 - 7),
      vx: -30 - Math.random() * 70,
      vy: -40 - Math.random() * 60,
      rot: Math.random() * 6,
      vr: (Math.random() * 8 - 4),
      len: 5 + Math.random() * 9,
      thick: 1.6 + Math.random() * 1.6,
      life: 1,
      col: colors[Math.floor(Math.random() * colors.length)]
    });
  }

  function stepParts(dt) {
    for (const p of parts) {
      p.vy += 420 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.y > H - 26) {
        p.y = H - 26;
        p.vy *= -0.22;
        p.vx *= 0.6;
        p.vr *= 0.5;
      }
      p.life -= dt * 0.22;
    }
    parts = parts.filter((p) => p.life > 0 && p.x > -40 && p.x < W + 40);
  }

  function drawParts() {
    for (const p of parts) {
      g.save();
      g.globalAlpha = Math.max(0, Math.min(1, p.life));
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.strokeStyle = INK;
      g.lineWidth = p.thick + 2;
      g.beginPath();
      g.arc(0, 0, p.len, 0.4, 4.2);
      g.stroke();
      g.strokeStyle = p.col;
      g.lineWidth = p.thick;
      g.beginPath();
      g.arc(0, 0, p.len, 0.4, 4.2);
      g.stroke();
      g.restore();
    }
  }

  function drawBackdrop() {
    g.fillStyle = INK;
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(242,239,230,.07)';
    for (let y = 8; y < H; y += 16) {
      for (let x = 8; x < W; x += 16) {
        g.beginPath();
        g.arc(x, y, 1.3, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.strokeStyle = 'rgba(242,239,230,.28)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(12.5, 20);
    g.lineTo(12.5, H - 20);
    g.stroke();
    for (let y = 24; y < H - 20; y += 18) {
      const long = (y - 24) % 90 < 18;
      g.beginPath();
      g.moveTo(12.5, y);
      g.lineTo(12.5 + (long ? 12 : 6), y);
      g.stroke();
    }
    star(g, W - 26, 30, 9, ACID);
    star(g, 34, H - 34, 7, RED);
  }

  function drawStamp(cx, cy, w) {
    g.save();
    g.translate(cx, cy);
    g.rotate(-0.06);
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.strokeRect(-w / 2, -9, w, 18);
    g.fillStyle = INK;
    g.font = 'bold 12px "Special Elite", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('DUNGEON PUNK', 0, 1);
    g.restore();
  }

  function drawBarPiece(x, y, w, h) {
    if (w <= 0.5) return;
    g.save();
    g.translate(x, y);
    roundRect(g, 0, 0, w, h, BAR.r);
    g.fillStyle = PAPER;
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.stroke();

    g.save();
    roundRect(g, 0, 0, w, h, BAR.r);
    g.clip();
    g.fillStyle = RED;
    g.fillRect(0, h - 26, w, 26);
    g.fillStyle = ACID;
    g.fillRect(0, h - 34, w, 8);
    g.fillStyle = 'rgba(10,10,10,.10)';
    for (let i = -h; i < w; i += 14) {
      g.beginPath();
      g.moveTo(i, h);
      g.lineTo(i + h, 0);
      g.lineTo(i + h + 5, 0);
      g.lineTo(i + 5, h);
      g.closePath();
      g.fill();
    }
    g.restore();

    if (w > 60) drawStamp(w / 2, h * 0.42, Math.min(w - 26, 130));
    g.restore();
  }

  function drawKnife(x, y) {
    g.save();
    g.translate(x, y);
    g.beginPath();
    g.moveTo(-3, -74);
    g.lineTo(15, -74);
    g.lineTo(15, -8);
    g.lineTo(-3, 0);
    g.closePath();
    g.fillStyle = '#d8d4c8';
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 2.5;
    g.stroke();
    g.strokeStyle = 'rgba(10,10,10,.35)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(-1, -66);
    g.lineTo(-1, -8);
    g.stroke();
    roundRect(g, -8, -116, 28, 44, 6);
    g.fillStyle = INK;
    g.fill();
    g.strokeStyle = PAPER;
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = ACID;
    g.fillRect(-4, -110, 20, 6);
    g.fillRect(-4, -98, 20, 4);
    g.fillRect(-4, -90, 20, 4);
    g.restore();
  }

  function sceneAt(t) {
    let knifeY = KNIFE_TOP;
    let barSlide = 0;
    let cutting = false;
    let fallen = false;
    if (t < 500) {
      barSlide = -190 * (1 - easeInOut(t / 500));
    } else if (t < 2100) {
      cutting = true;
      knifeY = KNIFE_TOP + easeInOut((t - 500) / 1600) * (KNIFE_BOTTOM - KNIFE_TOP);
    } else if (t < 2900) {
      knifeY = KNIFE_BOTTOM;
      fallen = true;
    } else {
      fallen = true;
      knifeY = KNIFE_BOTTOM - easeInOut((t - 2900) / 1700) * (KNIFE_BOTTOM - KNIFE_TOP);
    }
    return { knifeY, barSlide, cutting, fallen };
  }

  function draw() {
    g.setTransform(scaleX, 0, 0, scaleY, 0, 0);

    const t = elapsed % CYCLE;
    const scene = sceneAt(t);
    const knifeY = scene.knifeY;
    const bx = BAR.x + scene.barSlide;
    const fallT = scene.fallen ? Math.max(0, (t - 2100) / 1000) : 0;
    const offY = scene.fallen ? 350 * fallT * fallT : 0;
    const offRot = scene.fallen ? fallT * 0.9 : 0;
    const offAlpha = scene.fallen ? Math.max(0, 1 - Math.max(0, fallT - 0.5) * 1.6) : 1;

    g.fillStyle = INK;
    g.fillRect(0, 0, W, H);
    drawBackdrop();

    g.save();
    g.globalAlpha = 0.25;
    roundRect(g, bx + 6, BAR.y + 8, BAR.w, BAR.h, BAR.r);
    g.fillStyle = INK;
    g.fill();
    g.restore();

    if (!scene.fallen) {
      drawBarPiece(bx, BAR.y, BAR.w, BAR.h);
    } else {
      const pivotX = (CUT_X + bx + BAR.w) / 2;
      const pivotY = BAR.y + BAR.h / 2;
      g.save();
      g.globalAlpha = offAlpha;
      g.translate(pivotX, pivotY);
      g.rotate(offRot);
      g.translate(-pivotX, -pivotY + offY);
      g.beginPath();
      g.rect(CUT_X, BAR.y - 30, bx + BAR.w - CUT_X, BAR.h + 60);
      g.clip();
      drawBarPiece(bx, BAR.y, BAR.w, BAR.h);
      g.restore();
    }

    if (scene.cutting) {
      g.strokeStyle = 'rgba(10,10,10,.45)';
      g.lineWidth = 2;
      g.setLineDash([5, 5]);
      g.beginPath();
      g.moveTo(CUT_X, BAR.y);
      g.lineTo(CUT_X, Math.min(knifeY, BAR.y + BAR.h));
      g.stroke();
      g.setLineDash([]);
    }

    g.save();
    g.beginPath();
    g.rect(bx, BAR.y - 30, CUT_X - bx, BAR.h + 60);
    g.clip();
    drawBarPiece(bx, BAR.y, BAR.w, BAR.h);
    g.restore();

    if (t > 560) {
      g.strokeStyle = 'rgba(242,239,230,.55)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(CUT_X, BAR.y + 2);
      g.lineTo(CUT_X, BAR.y + BAR.h - 2);
      g.stroke();
    }

    drawParts();
    drawKnife(CUT_X, knifeY);

    g.fillStyle = 'rgba(242,239,230,.35)';
    g.font = '10px "Bebas Neue", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillText('нарезка №' + (Math.floor(elapsed / CYCLE) + 1), W / 2, H - 8);
  }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!last) last = ts;
    const dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;
    if (ts - lastDraw < 33) return;
    lastDraw = ts;

    elapsed += dt * 1000;
    acc += dt * 1000;

    const scene = sceneAt(elapsed % CYCLE);
    if (scene.cutting && acc > 40) {
      acc = 0;
      spawnShaving(scene.knifeY);
    }
    stepParts(dt);
    draw();
  }

  function start() {
    if (raf) return;
    fit();
    if (reduced) { draw(); return; }
    last = 0;
    lastDraw = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function resize() {
    fit();
    draw();
  }

  return { start, stop, resize };
}

/* =============================================================================
   ЛЕВАЯ ПАНЕЛЬ: 67 vs ТУН-ТУН
   ========================================================================== */
const FIGHT_SFX = ['БАМ', 'ХРЯСЬ', 'ТУН', '67!', 'БУМ', 'ШМЯК', 'ТУН-ТУН'];

function createFight(canvas) {
  const g = canvas.getContext('2d');
  let raf = 0;
  let last = 0;
  let lastDraw = 0;
  let t = 0;
  let state = 'idle';
  let shake = 0;
  let nextHit = 0;
  let hitCount = 0;
  let particles = [];
  let sfx = [];
  let scaleX = 1;
  let scaleY = 1;
  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const A_IDLE = 120;
  const B_IDLE = 300;
  const A_MEET = 172;
  const B_MEET = 248;
  const CROSS = 210;

  function fit() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    scaleX = (rect.width * dpr) / W;
    scaleY = (rect.height * dpr) / H;
    return true;
  }

  function hitSound(pitch) {
    const ctx = audio();
    if (!ctx) return;
    const now = ctx.currentTime;

    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(pitch, now);
    o.frequency.exponentialRampToValueAtTime(70, now + 0.16);
    og.gain.setValueAtTime(0.28, now);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    o.connect(og);
    og.connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.2);

    const n = ctx.createBufferSource();
    const len = Math.floor(ctx.sampleRate * 0.06);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    n.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.value = 0.16;
    n.connect(ng);
    ng.connect(ctx.destination);
    n.start(now);
  }

  function burst(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 190;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        r: 2 + Math.random() * 4,
        rot: Math.random() * 6,
        vr: Math.random() * 9 - 4.5,
        life: 1,
        col: Math.random() < 0.5 ? ACID : RED
      });
    }
  }

  function stepParticles(dt) {
    for (const p of particles) {
      p.vy += 520 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.life -= dt * 1.5;
    }
    particles = particles.filter((p) => p.life > 0 && p.y < H + 40);
    for (const s of sfx) s.life -= dt * 1.2;
    sfx = sfx.filter((s) => s.life > 0);
  }

  function drawParticles() {
    for (const p of particles) {
      g.save();
      g.globalAlpha = Math.max(0, Math.min(1, p.life));
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      star(g, 0, 0, p.r + 3, p.col, 4);
      g.restore();
    }
    for (const s of sfx) {
      g.save();
      g.globalAlpha = Math.max(0, Math.min(1, s.life));
      g.translate(s.x, s.y);
      g.rotate(s.rot);
      g.font = 'bold ' + s.size + 'px "Permanent Marker", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 5;
      g.strokeStyle = INK;
      g.strokeText(s.text, 0, 0);
      g.fillStyle = s.col;
      g.fillText(s.text, 0, 0);
      g.restore();
    }
  }

  /* Цифры-наклейка «67» */
  function drawSixtySeven(x, y, angry, squash) {
    g.save();
    g.translate(x, y);
    g.scale(1, squash);

    // Руки
    g.strokeStyle = INK;
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-30, 6);
    g.lineTo(-46, angry ? -14 : 18);
    g.moveTo(30, 6);
    g.lineTo(46, angry ? -14 : 18);
    g.stroke();

    roundRect(g, -36, -32, 72, 64, 12);
    g.fillStyle = PAPER;
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 4;
    g.stroke();

    // Кусок скотча
    g.save();
    g.fillStyle = 'rgba(245,228,0,.85)';
    g.translate(-30, -34);
    g.rotate(-0.4);
    g.fillRect(0, 0, 34, 10);
    g.restore();

    g.fillStyle = INK;
    g.font = 'bold 42px "Permanent Marker", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('6', -17, 6);
    g.fillText('7', 17, 6);

    // Брови и глаза
    g.strokeStyle = angry ? RED : INK;
    g.lineWidth = 4;
    if (angry) {
      g.beginPath();
      g.moveTo(-28, -22);
      g.lineTo(-12, -14);
      g.moveTo(28, -22);
      g.lineTo(12, -14);
      g.stroke();
    }
    g.restore();
  }

  /* Бревно с битой */
  function drawLog(x, y, angry, swing) {
    g.save();
    g.translate(x, y);

    // Бита
    g.save();
    g.translate(-26, -10);
    g.rotate(swing);
    g.strokeStyle = INK;
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-38, angry ? -26 : -14);
    g.stroke();
    g.save();
    g.translate(-38, angry ? -26 : -14);
    g.rotate(angry ? -0.6 : -0.2);
    roundRect(g, -7, -22, 14, 46, 7);
    g.fillStyle = ACID;
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.stroke();
    g.restore();
    g.restore();

    roundRect(g, -28, -46, 56, 92, 16);
    g.fillStyle = PAPER;
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 4;
    g.stroke();

    // Годовые кольца
    g.strokeStyle = 'rgba(10,10,10,.25)';
    g.lineWidth = 2;
    for (let i = 1; i <= 3; i++) {
      g.beginPath();
      g.ellipse(0, 20, 20 - i * 2, 8 - i * 1.5, 0, 0, Math.PI * 2);
      g.stroke();
    }

    // Ирокез
    g.fillStyle = RED;
    g.beginPath();
    g.moveTo(-24, -46);
    g.lineTo(-16, -70);
    g.lineTo(-6, -46);
    g.lineTo(2, -74);
    g.lineTo(12, -46);
    g.lineTo(22, -64);
    g.lineTo(26, -46);
    g.closePath();
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.stroke();

    // Лицо
    g.fillStyle = INK;
    g.beginPath();
    g.arc(-10, -8, 4, 0, Math.PI * 2);
    g.arc(10, -8, 4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = angry ? RED : INK;
    g.lineWidth = 3;
    g.beginPath();
    if (angry) {
      g.moveTo(-18, -18);
      g.lineTo(-4, -13);
      g.moveTo(18, -18);
      g.lineTo(4, -13);
      g.moveTo(-12, 8);
      g.lineTo(-4, 14);
      g.lineTo(4, 6);
      g.lineTo(12, 14);
    } else {
      g.moveTo(-10, 10);
      g.quadraticCurveTo(0, 16, 10, 10);
    }
    g.stroke();

    g.restore();
  }

  function scene() {
    let aY = A_IDLE;
    let bY = B_IDLE;
    let angry = false;
    let squash = 1;
    let swing = -0.2;

    if (state === 'idle') {
      const s = Math.sin(t / 520);
      aY += s * 3;
      bY -= Math.abs(Math.sin(t / 420)) * 4;
      swing = -0.2 + Math.sin(t / 420) * 0.25;
      squash = 1 + Math.sin(t / 520) * 0.02;
    } else if (state === 'charge') {
      const p = Math.min(1, t / 700);
      const e = easeInOut(p);
      aY = A_IDLE + (A_MEET - A_IDLE) * e;
      bY = B_IDLE + (B_MEET - B_IDLE) * e;
      angry = p > 0.25;
      swing = -0.2 - e * 1.2;
      squash = 1 - Math.sin(p * Math.PI) * 0.06;
      shake = p * 0.5;
    } else if (state === 'brawl') {
      angry = true;
      const j = Math.sin(t / 40);
      aY = A_MEET + j * 4;
      bY = B_MEET - j * 4;
      swing = -1.5 + Math.sin(t / 70) * 1.1;
      squash = 1 + Math.sin(t / 55) * 0.04;
      shake = 1;
    } else if (state === 'done') {
      const s = Math.sin(t / 700);
      aY = A_IDLE + 26 + s * 2;
      bY = B_IDLE - 22 - s * 2;
      squash = 0.94;
      shake = Math.max(0, shake - 0.02);
    }
    return { aY, bY, angry, squash, swing };
  }

  function draw() {
    g.setTransform(scaleX, 0, 0, scaleY, 0, 0);

    const s = scene();
    const jx = shake > 0 ? (Math.random() * 6 - 3) * shake : 0;
    const jy = shake > 0 ? (Math.random() * 6 - 3) * shake : 0;

    g.fillStyle = INK;
    g.fillRect(0, 0, W, H);

    // Растр + разметка
    g.fillStyle = 'rgba(242,239,230,.06)';
    for (let y = 8; y < H; y += 16) {
      for (let x = 8; x < W; x += 16) {
        g.beginPath();
        g.arc(x, y, 1.2, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.strokeStyle = 'rgba(245,228,0,.18)';
    g.lineWidth = 2;
    g.setLineDash([10, 8]);
    g.beginPath();
    g.moveTo(14, CROSS);
    g.lineTo(W - 14, CROSS);
    g.stroke();
    g.setLineDash([]);

    g.save();
    g.translate(jx, jy);
    drawSixtySeven(100, s.aY, s.angry, s.squash);
    drawLog(100, s.bY, s.angry, s.swing);
    drawParticles();
    g.restore();

    g.fillStyle = 'rgba(242,239,230,.4)';
    g.font = '10px "Bebas Neue", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillText(state === 'idle' ? 'ткни — начнётся' : 'тун-тун-тун…', W / 2, H - 8);
  }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!last) last = ts;
    const dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;
    if (ts - lastDraw < 33) return;
    lastDraw = ts;

    t += dt * 1000;
    stepParticles(dt);

    if (state === 'charge' && t >= 700) {
      state = 'brawl';
      t = 0;
      nextHit = 0;
      hitCount = 0;
    } else if (state === 'brawl') {
      if (t >= nextHit) {
        nextHit = t + 130 + Math.random() * 90;
        hitCount += 1;
        burst(100 + (Math.random() * 36 - 18), CROSS + (Math.random() * 26 - 13));
        sfx.push({
          text: FIGHT_SFX[Math.floor(Math.random() * FIGHT_SFX.length)],
          x: 100 + (Math.random() * 60 - 30),
          y: CROSS - 10 + (Math.random() * 40 - 20),
          rot: (Math.random() * 0.5 - 0.25),
          size: 20 + Math.random() * 14,
          col: Math.random() < 0.5 ? ACID : RED,
          life: 1
        });
        hitSound(180 + Math.random() * 120);
      }
      if (t > 2100) {
        state = 'done';
        t = 0;
        sfx.push({ text: 'БАБАХ!', x: 100, y: CROSS, rot: -0.08, size: 40, col: RED, life: 1.4 });
        burst(100, CROSS);
        burst(60, CROSS + 20);
        burst(140, CROSS - 20);
        import('./chaos.js')
          .then((mod) => mod.trigger({
            code: 'CHAOS 67',
            title: 'ДРАКА! САЙТ РАЗОБРАЛИ',
            text: '67 и ТУН-ТУН не поделили левую панель. Разнесли карточки, автоматы, ' +
                  'бит-машину и плеер. Жми «ПОЧИНИТЬ» — и не подпускай их больше.'
          }))
          .catch(() => { /* ну не сломали — и ладно */ });
      }
    }
    draw();
  }

  function resize() {
    fit();
    draw();
  }

  function start() {
    if (raf) return;
    if (!fit()) return;
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { draw(); return; }
    last = 0;
    lastDraw = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function begin() {
    if (state === 'charge' || state === 'brawl') return;
    state = 'charge';
    t = 0;
    shake = 0;
    particles = [];
    sfx = [];
    start();
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    begin();
  });

  document.addEventListener('dp:repaired', () => {
    state = 'idle';
    t = 0;
    shake = 0;
    particles = [];
    sfx = [];
    start();
  });

  return { start, stop, resize, begin, getState: () => state };
}

/* =============================================================================
   Сборка панелей
   ========================================================================== */
/* Док общий: его может создать и rails.js, и gradus.js — кто первый. */
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

export function createRails() {
  if (document.getElementById('soapRail')) return null;
  inject();

  const prefers = readRails();

  const dock = ensureDock();
  const fightToggle = document.createElement('button');
  fightToggle.type = 'button';
  fightToggle.className = 'rail-toggle';
  fightToggle.id = 'toggleFight';
  fightToggle.setAttribute('aria-pressed', 'true');
  fightToggle.innerHTML = '<span aria-hidden="true">🥊</span> 67 vs ТУН-ТУН';

  const soapToggle = document.createElement('button');
  soapToggle.type = 'button';
  soapToggle.className = 'rail-toggle';
  soapToggle.id = 'toggleSoap';
  soapToggle.setAttribute('aria-pressed', 'true');
  soapToggle.innerHTML = '<span aria-hidden="true">🧼</span> РЕЖЕМ МЫЛО';

  dock.appendChild(fightToggle);
  dock.appendChild(soapToggle);

  const fightRail = document.createElement('aside');
  fightRail.className = 'rail rail--fight';
  fightRail.id = 'fightRail';
  fightRail.setAttribute('aria-label', 'Левая панель: 67 против ТУН-ТУН');
  fightRail.innerHTML = `
    <p class="rail__cap">67 vs ТУН-ТУН</p>
    <canvas id="fightCanvas" width="200" height="400" aria-hidden="true"></canvas>
    <p class="rail__hint">ткни по панели — начнут пиздиться</p>
    <button type="button" class="fight-btn" id="fightStart">🥊 НАЧАТЬ ДРАКУ</button>`;

  const soapRail = document.createElement('aside');
  soapRail.className = 'rail rail--soap';
  soapRail.id = 'soapRail';
  soapRail.setAttribute('aria-hidden', 'true');
  soapRail.innerHTML = `
    <p class="rail__cap">РЕЖЕМ МЫЛО · ASMR</p>
    <canvas id="soapCanvas" width="200" height="400" aria-hidden="true"></canvas>`;

  document.body.appendChild(fightRail);
  document.body.appendChild(soapRail);

  const soap = createSoap(document.getElementById('soapCanvas'));
  const fight = createFight(document.getElementById('fightCanvas'));

  const setSoap = (on) => {
    soapRail.hidden = !on;
    const btn = document.getElementById('toggleSoap');
    btn.setAttribute('aria-pressed', String(on));
    if (on) { soap.resize(); soap.start(); } else { soap.stop(); }
    prefers.soap = on;
    writeRails(prefers);
  };

  const setFight = (on) => {
    fightRail.hidden = !on;
    const btn = document.getElementById('toggleFight');
    btn.setAttribute('aria-pressed', String(on));
    if (on) { fight.resize(); fight.start(); } else { fight.stop(); }
    prefers.fight = on;
    writeRails(prefers);
  };

  document.getElementById('toggleSoap').addEventListener('click', () => setSoap(soapRail.hidden));
  document.getElementById('toggleFight').addEventListener('click', () => setFight(fightRail.hidden));
  document.getElementById('fightStart').addEventListener('click', () => fight.begin());

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      soap.stop();
      fight.stop();
    } else {
      if (!soapRail.hidden) soap.start();
      if (!fightRail.hidden) fight.start();
    }
  });

  window.addEventListener('resize', () => {
    if (!soapRail.hidden) soap.resize();
    if (!fightRail.hidden) fight.resize();
  });

  setSoap(prefers.soap);
  setFight(prefers.fight);

  return { soap, fight, setSoap, setFight };
}
