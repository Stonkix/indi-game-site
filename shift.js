/* =============================================================================
   DUNGEON PUNK — shift.js
   «НОЧНАЯ СМЕНА»: сторож обходит камеры и охраняет ящик пива от панков.
   Жанр — ночной обход с камерами, реализация и персонажи свои. Никаких
   аниматроников и чужих логотипов: панки так панки.

   Секция вставляется под «Огород 13», в самый низ страницы. Модуль ленивый.
   ========================================================================== */

const W = 660;
const H = 372;
const INK = '#0a0a0a';
const PAPER = '#f2efe6';
const ACID = '#f5e400';
const RED = '#e10600';

const KEY = 'dp.shift.best.v1';

const ROOMS = [
  { id: 'yard', name: 'ДВОР', hint: 'забор и фонарь' },
  { id: 'garage', name: 'ГАРАЖ', hint: 'роллета в тегах' },
  { id: 'stash', name: 'СКЛАД', hint: 'ящики с пивом' },
  { id: 'booth', name: 'БУДКА', hint: 'тут сидим мы' }
];

const HOUR = 13;        // секунд на один час смены
const NIGHT_HOURS = 6;

const CSS = `
.shift-section { padding-block: 2rem 4rem; }
.shift-cab {
  background: var(--ink); color: var(--paper);
  border: var(--border-w) solid var(--ink);
  box-shadow: 8px 8px 0 var(--red);
  padding: .8rem;
}
.shift-screen {
  position: relative;
  background: var(--ink);
  border: 3px solid var(--paper);
  outline: 2px dashed rgba(242,239,230,.35);
  outline-offset: -9px;
  padding: .35rem;
  display: grid; place-items: center;
}
.shift-screen canvas {
  display: block; width: 100%; height: auto;
  max-width: 660px;
  touch-action: manipulation;
}
.shift-screen { perspective: 900px; }
.shift-screen canvas { transform: rotateX(2.4deg); transform-origin: center 60%; }
@media (prefers-reduced-motion: no-preference) {
  .shift-screen canvas { animation: shiftSway 9s ease-in-out infinite; }
}
@keyframes shiftSway {
  0%, 100% { transform: rotateX(2.4deg) translateX(0); }
  50% { transform: rotateX(1.4deg) translateX(4px); }
}
.shift-scare {
  position: fixed; inset: 0; z-index: 99000;
  width: 100%; height: 100%;
  pointer-events: none;
  background: #0a0a0a;
}
.shift-tray { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .7rem; }
.cam {
  font-family: var(--f-btn); font-size: 1rem; letter-spacing: .04em;
  background: var(--paper); color: var(--ink);
  border: 3px solid var(--paper); box-shadow: 3px 3px 0 var(--ink);
  padding: .3rem .6rem .26rem; text-align: left; line-height: 1.15;
}
.cam b { display: block; font-size: 1.05rem; }
.cam i { font-family: var(--f-type); font-size: .7rem; font-style: normal; opacity: .7; }
.cam[aria-pressed="true"] { background: var(--acid); border-color: var(--acid); }
.cam.is-alert { background: var(--red); border-color: var(--red); color: var(--paper); }
.shift-stats {
  display: flex; flex-wrap: wrap; gap: .4rem 1.2rem;
  font-family: var(--f-btn); font-size: 1.1rem; letter-spacing: .05em;
  margin: .7rem 0 .3rem;
}
.shift-stats b { color: var(--acid); }
.shift-msg { font-family: var(--f-marker); font-size: .95rem; margin: 0 0 .6rem; min-height: 1.4em; }
.shift-msg.is-bad { background: var(--red); color: var(--paper); padding: .15rem .4rem; }
.shift-msg.is-good { background: var(--acid); color: var(--ink); padding: .15rem .4rem; }
.shift-actions { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
.shift-keys { font-size: .78rem; opacity: .6; }
@media (max-width: 560px) {
  .cam i { display: none; }
  .cam { font-size: .85rem; }
}
`;

let injected = false;

function inject() {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.id = 'dp-shift-style';
  style.textContent = CSS;
  document.head.appendChild(style);
}

function read(key, fb) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fb : JSON.parse(raw);
  } catch (err) { return fb; }
}

function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (err) { /* ок */ }
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

export function createShift() {
  if (document.getElementById('shiftSection')) return null;
  inject();

  const main = document.querySelector('main') || document.body;
  const section = document.createElement('section');
  section.className = 'shift-section';
  section.id = 'shift';
  section.setAttribute('aria-labelledby', 'shift-title');
  section.innerHTML = `
    <div class="section-head">
      <h2 class="section-title" id="shift-title">
        <span class="ransom" data-ransom="НОЧНАЯ СМЕНА">НОЧНАЯ СМЕНА</span>
      </h2>
      <p class="section-sub">
        Шесть часов до утра. Четыре камеры, ящик пива и панки, которые очень хотят пить.
      </p>
    </div>

    <div class="shift-cab">
      <div class="shift-screen">
        <canvas id="shiftCanvas" width="${W}" height="${H}" tabindex="0" role="application"
                aria-label="Игра Ночная смена. Переключай камеры кнопками, ткни по панку, чтобы бросить бутылку. Дожить до шести утра."></canvas>
      </div>

      <p class="shift-stats">
        <span>Время: <b id="shiftClock">23:00</b></span>
        <span>Заряд: <b id="shiftPower">100%</b></span>
        <span>Бутылки: <b id="shiftBottles">6</b></span>
        <span>Ночей прожито: <b id="shiftBest">0</b></span>
      </p>

      <div class="shift-tray" role="group" aria-label="Камеры">
        <button type="button" class="cam" data-room="yard" aria-pressed="false"><b>1 · ДВОР</b><i>забор и фонарь</i></button>
        <button type="button" class="cam" data-room="garage" aria-pressed="false"><b>2 · ГАРАЖ</b><i>роллета в тегах</i></button>
        <button type="button" class="cam" data-room="stash" aria-pressed="false"><b>3 · СКЛАД</b><i>ящики с пивом</i></button>
        <button type="button" class="cam" data-room="booth" aria-pressed="false"><b>4 · БУДКА</b><i>тут сидим мы</i></button>
      </div>

      <p class="shift-msg" id="shiftMsg" role="status" aria-live="polite">
        Панки идут от двора к складу. Ткни по панку — прилетит бутылка.
      </p>

      <div class="shift-actions">
        <button type="button" class="btn btn--acid btn--sm" id="shiftStart">На смену</button>
        <span class="shift-keys">1 2 3 4 — камеры · клик по панку — бутылка · пробел — пауза</span>
      </div>
    </div>`;

  const garden = document.getElementById('garden');
  if (garden) garden.insertAdjacentElement('afterend', section);
  else main.appendChild(section);
  document.dispatchEvent(new CustomEvent('dp:ransom'));

  const canvas = document.getElementById('shiftCanvas');
  const g = canvas.getContext('2d');
  const msg = document.getElementById('shiftMsg');
  const camBtns = Array.from(section.querySelectorAll('.cam'));

  let actx = null;
  function sfx(kind) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    if (!actx) { try { actx = new C(); } catch (err) { return; } }
    if (actx.state === 'suspended') actx.resume();
    const ctx = actx;
    const now = ctx.currentTime;
    if (kind === 'hoy') {
      // Злой рёв: пила вниз плюс шумовая подушка.
      const saw = ctx.createOscillator();
      const sg = ctx.createGain();
      saw.type = 'sawtooth';
      saw.frequency.setValueAtTime(880, now);
      saw.frequency.exponentialRampToValueAtTime(90, now + 0.7);
      sg.gain.setValueAtTime(0.3, now);
      sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
      saw.connect(sg);
      sg.connect(ctx.destination);
      saw.start(now);
      saw.stop(now + 0.85);

      const len = Math.floor(ctx.sampleRate * 0.5);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const lp = ctx.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.value = 700;
      lp.Q.value = 0.6;
      const ng = ctx.createGain();
      ng.gain.value = 0.35;
      src.connect(lp);
      lp.connect(ng);
      ng.connect(ctx.destination);
      src.start(now);
      return;
    }

    const o = ctx.createOscillator();
    const gn = ctx.createGain();
    o.type = kind === 'hit' ? 'square' : 'triangle';
    const from = kind === 'hit' ? 700 : kind === 'alarm' ? 420 : 260;
    const to = kind === 'hit' ? 300 : kind === 'alarm' ? 180 : 120;
    o.frequency.setValueAtTime(from, now);
    o.frequency.exponentialRampToValueAtTime(to, now + 0.18);
    gn.gain.setValueAtTime(kind === 'alarm' ? 0.18 : 0.1, now);
    gn.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    o.connect(gn);
    gn.connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.22);
  }

  /* ------------------------------ СКРИМЕР ----------------------------
     Панк на весь экран с криком «ХОЙ». Это шарж, а не хоррор: рожица,
     ирокез и бутылка. Голос даём браузеру, а если его нет — остаётся
     синтезированный рёв. */
  let scareCanvas = null;
  let scareCtx = null;
  let scareRaf = 0;
  let scareState = null;

  function ensureScare() {
    if (scareCanvas) return;
    scareCanvas = document.createElement('canvas');
    scareCanvas.className = 'shift-scare';
    scareCanvas.id = 'shiftScare';
    scareCanvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(scareCanvas);
    scareCtx = scareCanvas.getContext('2d');
  }

  function shout() {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      const u = new SpeechSynthesisUtterance('Хой!');
      u.lang = 'ru-RU';
      u.rate = 0.85;
      u.pitch = 1.5;
      u.volume = 1;
      synth.cancel();
      synth.speak(u);
    } catch (err) { /* без голоса тоже сойдёт */ }
  }

  function scare(big) {
    ensureScare();
    const w = window.innerWidth;
    const h = window.innerHeight;
    scareCanvas.width = w;
    scareCanvas.height = h;
    scareCanvas.hidden = false;
    scareState = { t: 0, dur: big ? 1.9 : 0.8, big, w, h };
    S.lastScare = S.t;
    sfx('hoy');
    if (big) shout();
    if (scareRaf) cancelAnimationFrame(scareRaf);
    scareRaf = requestAnimationFrame(scareFrame);
  }

  function drawScareFace(p, big) {
    const c = scareCtx;
    const w = scareState.w;
    const h = scareState.h;
    const base = Math.min(w, h);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = INK;
    c.fillRect(0, 0, w, h);

    const k = big ? 0.5 + p * 1.15 : 0.7 + p * 0.45;
    const s = (k * base) / 320;
    const shake = big && !reduced ? (1 - p) * 20 : 0;

    c.save();
    c.translate(w / 2 + (Math.random() * 2 - 1) * shake, h / 2 + (Math.random() * 2 - 1) * shake);
    c.scale(s, s);

    // Рожа
    c.beginPath();
    c.arc(0, 0, 150, 0, Math.PI * 2);
    c.fillStyle = ACID;
    c.fill();
    c.lineWidth = 12;
    c.strokeStyle = INK;
    c.stroke();

    // Ирокез
    c.fillStyle = RED;
    c.beginPath();
    c.moveTo(-112, -92);
    c.lineTo(-72, -232);
    c.lineTo(-22, -92);
    c.lineTo(18, -252);
    c.lineTo(68, -92);
    c.lineTo(112, -214);
    c.lineTo(132, -86);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 10;
    c.stroke();

    // Глаза
    c.fillStyle = PAPER;
    c.beginPath();
    c.ellipse(-52, -22, 38, 34, 0, 0, Math.PI * 2);
    c.ellipse(52, -22, 38, 34, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 8;
    c.stroke();
    c.fillStyle = INK;
    c.beginPath();
    c.arc(-44, -20, 11, 0, Math.PI * 2);
    c.arc(60, -20, 11, 0, Math.PI * 2);
    c.fill();

    // Брови
    c.strokeStyle = INK;
    c.lineWidth = 13;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-92, -74);
    c.lineTo(-20, -50);
    c.moveTo(92, -74);
    c.lineTo(20, -50);
    c.stroke();

    // Рот
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(0, 74, 64, 48, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = PAPER;
    c.fillRect(-42, 34, 84, 11);

    // Бутылка в углу
    c.save();
    c.translate(118, 84);
    c.rotate(0.4);
    c.fillStyle = ACID;
    c.fillRect(-9, -34, 18, 34);
    c.fillStyle = INK;
    c.fillRect(-7, -44, 14, 12);
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.strokeRect(-9, -34, 18, 34);
    c.restore();

    c.restore();

    // Крик
    c.font = 'bold ' + Math.round(base * 0.2) + 'px "Permanent Marker", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.lineWidth = Math.max(6, base * 0.018);
    c.strokeStyle = INK;
    c.strokeText('ХОЙ!!', w / 2, h * 0.16);
    c.fillStyle = ACID;
    c.fillText('ХОЙ!!', w / 2, h * 0.16);

    // Красная вспышка на входе
    c.fillStyle = 'rgba(225,6,0,' + Math.max(0, 0.55 - p * 0.8) + ')';
    c.fillRect(0, 0, w, h);
  }

  function scareFrame(ts) {
    if (!scareState) return;
    if (!scareState.last) scareState.last = ts;
    const dt = Math.min(0.05, (ts - scareState.last) / 1000);
    scareState.last = ts;
    scareState.t += dt;
    const p = Math.min(1, scareState.t / scareState.dur);
    drawScareFace(p, scareState.big);
    if (p < 1) {
      scareRaf = requestAnimationFrame(scareFrame);
    } else {
      scareRaf = 0;
      scareState = null;
      scareCtx.setTransform(1, 0, 0, 1, 0, 0);
      scareCtx.clearRect(0, 0, scareCanvas.width, scareCanvas.height);
      scareCanvas.hidden = true;
    }
  }

  const S = {
    punks: [],
    room: 'yard',
    hour: 0,
    power: 100,
    bottles: 6,
    state: 'idle',
    t: 0,
    hourAcc: 0,
    spawnAcc: 0,
    nextSpawn: 4200,
    boothAcc: 0,
    flashlight: 0,
    glitch: 0,
    visible: true,
    autoPaused: false
  };

  S.best = Number(read(KEY, 0)) || 0;
  document.getElementById('shiftBest').textContent = String(S.best);

  function say(text, mood) {
    msg.textContent = text;
    msg.classList.remove('is-bad', 'is-good');
    if (mood) msg.classList.add(mood);
  }

  function clockText() {
    return String(S.hour % 24).padStart(2, '0') + ':00';
  }

  function hud() {
    document.getElementById('shiftClock').textContent = clockText();
    document.getElementById('shiftPower').textContent = Math.round(S.power) + '%';
    document.getElementById('shiftBottles').textContent = String(S.bottles);
    for (const btn of camBtns) {
      const r = btn.dataset.room;
      btn.setAttribute('aria-pressed', String(S.room === r));
      const danger = S.punks.some((p) => p.room === r && (r === 'booth' || r === 'stash'));
      btn.classList.toggle('is-alert', danger);
    }
  }

  function reset() {
    S.punks = [];
    S.room = 'yard';
    S.hour = 0;
    S.power = 100;
    S.bottles = 6;
    S.t = 0;
    S.hourAcc = 0;
    S.spawnAcc = 0;
    S.nextSpawn = 4200;
    S.boothAcc = 0;
    S.state = 'play';
    hud();
    say('Смена началась. Двор пустой — пока что.', 'is-good');
    loopStart();
  }

  function spawnPunk() {
    const heavy = Math.random() < Math.min(0.35, 0.08 + S.hour * 0.04);
    S.punks.push({
      room: 'yard',
      heavy,
      hp: heavy ? 2 : 1,
      phase: Math.random() * 6,
      lane: 0.24 + Math.random() * 0.52,
      z: 0.08,
      speedMul: heavy ? 0.7 : 1
    });
    say(heavy ? 'Во двор зашёл здоровый. В бутылку с первого раза не сядет.' : 'Во дворе кто-то ходит.', 'is-bad');
  }

  function step(dt) {
    S.t += dt;
    S.hourAcc += dt;
    S.hudAcc = (S.hudAcc || 0) + dt;
    S.power = Math.max(0, S.power - dt * 0.9);
    S.glitch = Math.max(0, S.glitch - dt * 2);
    S.flashlight = Math.max(0, S.flashlight - dt);

    if (S.hourAcc > HOUR) {
      S.hourAcc = 0;
      S.hour += 1;
      if (S.hour >= NIGHT_HOURS) { win(); return; }
      say(`Пробило ${clockText()}. Панки не спят.`, 'is-bad');
    }

    S.spawnAcc += dt * 1000;
    if (S.spawnAcc > S.nextSpawn) {
      S.spawnAcc = 0;
      S.nextSpawn = Math.max(2600, 5200 - S.hour * 380);
      if (S.punks.length < 7) spawnPunk();
    }

    const dark = S.power <= 0;
    for (const p of S.punks) {
      p.phase += dt * (dark ? 6 : 3.4);
      // Приближается к камере — отсюда и «объём».
      p.z = Math.min(1, p.z + dt * (0.055 + S.hour * 0.005) * (dark ? 1.7 : 1) * p.speedMul);
      p.advance = (p.advance || (4 + Math.random() * 6)) - dt * (dark ? 2 : 1) * p.speedMul;
      if (p.advance > 0) continue;
      p.advance = 6 + Math.random() * 8;
      const i = ROOMS.findIndex((r) => r.id === p.room);
      if (i < ROOMS.length - 1) {
        p.room = ROOMS[i + 1].id;
        p.z = 0.1;
        if (p.room === 'stash') say('Дошли до склада. Кидай бутылку!', 'is-bad');
        if (p.room === 'booth') {
          S.boothAcc = 0;
          sfx('alarm');
          say('ОН В БУДКЕ. Спасай пиво!', 'is-bad');
          // Мини-скример не чаще раза в три секунды, иначе это уже стробоскоп.
          if (S.t - (S.lastScare || -99) > 3) scare(false);
        }
      }
    }

    const inBooth = S.punks.filter((p) => p.room === 'booth');
    if (inBooth.length) {
      S.boothAcc += dt;
      if (S.boothAcc > 6) { lose(); return; }
    } else {
      S.boothAcc = 0;
    }

    // Интерфейс трогаем четыре раза в секунду, не каждый кадр.
    if (S.hudAcc > 0.25) { S.hudAcc = 0; hud(); }
  }

  function win() {
    S.state = 'won';
    S.best += 1;
    write(KEY, S.best);
    document.getElementById('shiftBest').textContent = String(S.best);
    say(`Дожил до шести утра. Ночей прожито: ${S.best}.`, 'is-good');
    draw();
  }

  function lose() {
    S.state = 'over';
    scare(true);
    const left = S.bottles;
    say(left > 0
      ? `Пиво выпито. Осталось бутылок: ${left} — надо было кидать.`
      : 'Пиво выпито. Бутылки кончились раньше панков.', 'is-bad');
    draw();
  }

  /* ------------------------------ Рисование -------------------------- */
  /* ------------------------ Псевдо-3D коридор ------------------------
     Настоящего 3D тут нет: есть точка схода в центре кадра и коэффициент
     глубины z. Всё, что дальше, стягивается к точке схода и мельчает.
     Этого хватает, чтобы комната читалась как коридор, а не как плакат. */
  const VP = { x: W / 2, y: H * 0.44 };

  function put(x, y, z) {
    return {
      x: VP.x + (x - VP.x) * z,
      y: VP.y + (y - VP.y) * z,
      s: z
    };
  }

  const FLOOR_Y = H - 18;
  const BACK_W = W * 0.44;
  const BACK_H = H * 0.44;

  function quad(g2, a, b, c, d, fill, stroke) {
    g2.beginPath();
    g2.moveTo(a.x, a.y);
    g2.lineTo(b.x, b.y);
    g2.lineTo(c.x, c.y);
    g2.lineTo(d.x, d.y);
    g2.closePath();
    if (fill) { g2.fillStyle = fill; g2.fill(); }
    if (stroke) { g2.strokeStyle = stroke; g2.stroke(); }
  }

  function backRect() {
    return {
      x: VP.x - BACK_W / 2,
      y: VP.y - BACK_H / 2,
      w: BACK_W,
      h: BACK_H
    };
  }

  function drawCorridor() {
    const b = backRect();

    // Потолок и пол
    quad(g, { x: 0, y: 0 }, { x: W, y: 0 }, { x: b.x + b.w, y: b.y }, { x: b.x, y: b.y },
      'rgba(242,239,230,.05)', 'rgba(242,239,230,.20)');
    quad(g, { x: 0, y: H }, { x: W, y: H }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h },
      'rgba(242,239,230,.09)', 'rgba(242,239,230,.20)');

    // Боковые стены
    quad(g, { x: 0, y: 0 }, { x: 0, y: H }, { x: b.x, y: b.y + b.h }, { x: b.x, y: b.y },
      'rgba(242,239,230,.03)', 'rgba(242,239,230,.16)');
    quad(g, { x: W, y: 0 }, { x: W, y: H }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x + b.w, y: b.y },
      'rgba(242,239,230,.03)', 'rgba(242,239,230,.16)');

    // Направляющие по полу — они и дают «объём»
    g.strokeStyle = 'rgba(245,228,0,.16)';
    g.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const zz = i / 4;
      const a = put(0, FLOOR_Y, zz);
      const c = put(W, FLOOR_Y, zz);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(c.x, c.y);
      g.stroke();
    }

    // Задняя стена
    g.fillStyle = 'rgba(10,10,10,.35)';
    g.fillRect(b.x, b.y, b.w, b.h);
    g.strokeStyle = 'rgba(242,239,230,.35)';
    g.lineWidth = 2;
    g.strokeRect(b.x, b.y, b.w, b.h);
    return b;
  }

  /* Реквизит каждой комнаты: ящики, сетка, полки. Всё через put(). */
  function drawPropBox(x, z, w, h, fill, label) {
    const base = put(x, FLOOR_Y, z);
    const bw = w * z;
    const bh = h * z;
    g.fillStyle = fill;
    g.fillRect(base.x - bw / 2, base.y - bh, bw, bh);
    g.strokeStyle = INK;
    g.lineWidth = Math.max(1, 3 * z);
    g.strokeRect(base.x - bw / 2, base.y - bh, bw, bh);
    if (label && z > 0.45) {
      g.fillStyle = INK;
      g.font = 'bold ' + Math.round(13 * z) + 'px "Bebas Neue", sans-serif';
      g.textAlign = 'center';
      g.fillText(label, base.x, base.y - bh * 0.45);
    }
  }

  function drawProps(id, b) {
    const cx = VP.x;
    if (id === 'yard') {
      // Забор на задней стене
      g.strokeStyle = PAPER;
      g.lineWidth = 2;
      for (let i = 0; i <= 8; i++) {
        const x = b.x + (b.w / 8) * i;
        g.beginPath();
        g.moveTo(x, b.y + b.h);
        g.lineTo(x, b.y + b.h * 0.35);
        g.stroke();
      }
      g.fillStyle = ACID;
      g.beginPath();
      g.arc(cx, b.y + b.h * 0.2, 9, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.stroke();
      drawPropBox(W * 0.24, 0.62, 46, 52, RED, '13');
      drawPropBox(W * 0.78, 0.42, 40, 44, PAPER, '');
    } else if (id === 'garage') {
      g.fillStyle = 'rgba(242,239,230,.10)';
      g.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      g.strokeStyle = PAPER;
      g.lineWidth = 2;
      for (let i = 1; i < 6; i++) {
        const y = b.y + 6 + ((b.h - 12) / 6) * i;
        g.beginPath();
        g.moveTo(b.x + 6, y);
        g.lineTo(b.x + b.w - 6, y);
        g.stroke();
      }
      g.fillStyle = RED;
      g.font = 'bold 34px "Permanent Marker", sans-serif';
      g.textAlign = 'center';
      g.fillText('13', cx, b.y + b.h * 0.62);
      drawPropBox(W * 0.2, 0.55, 52, 40, PAPER, 'кисти');
      drawPropBox(W * 0.82, 0.72, 58, 44, RED, '');
    } else if (id === 'stash') {
      // Полки с ящиками на задней стене
      for (let row = 0; row < 3; row++) {
        const y = b.y + b.h * (0.28 + row * 0.24);
        g.strokeStyle = PAPER;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(b.x + 8, y);
        g.lineTo(b.x + b.w - 8, y);
        g.stroke();
        for (let i = 0; i < 5; i++) {
          const x = b.x + 14 + i * ((b.w - 28) / 5);
          g.fillStyle = 'rgba(242,239,230,.9)';
          g.fillRect(x, y - 16, 20, 16);
          g.strokeStyle = INK;
          g.lineWidth = 1.5;
          g.strokeRect(x, y - 16, 20, 16);
          g.fillStyle = row % 2 ? RED : ACID;
          g.fillRect(x + 3, y - 11, 14, 4);
        }
      }
      drawPropBox(W * 0.28, 0.6, 60, 56, PAPER, 'ПИВО');
      drawPropBox(W * 0.72, 0.66, 60, 56, PAPER, 'ПИВО');
    } else {
      // Будка: окно и стол
      g.fillStyle = 'rgba(245,228,0,.10)';
      g.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
      g.strokeStyle = PAPER;
      g.lineWidth = 4;
      g.strokeRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
      const desk = put(cx, FLOOR_Y, 0.72);
      g.fillStyle = PAPER;
      g.fillRect(desk.x - 150 * 0.72, desk.y - 10, 300 * 0.72, 10);
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.strokeRect(desk.x - 150 * 0.72, desk.y - 10, 300 * 0.72, 10);
      drawPropBox(cx - 60, 0.78, 26, 40, ACID, '');
      drawPropBox(cx + 50, 0.8, 26, 40, RED, '');
    }
  }

  function drawRoom3D(id) {
    g.fillStyle = INK;
    g.fillRect(0, 0, W, H);

    const b = drawCorridor();
    drawProps(id, b);

    // Наложение «камеры»
    g.save();
    g.globalAlpha = 0.55;
    g.strokeStyle = 'rgba(242,239,230,.10)';
    g.lineWidth = 1;
    for (let y = 0; y < H; y += 3) {
      g.beginPath();
      g.moveTo(0, y + 0.5);
      g.lineTo(W, y + 0.5);
      g.stroke();
    }
    for (let i = 0; i < 60; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(242,239,230,.22)' : 'rgba(10,10,10,.4)';
      g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    g.restore();

    if (S.power <= 0 && id !== 'booth') {
      g.fillStyle = 'rgba(10,10,10,.88)';
      g.fillRect(0, 0, W, H);
      g.fillStyle = RED;
      g.font = 'bold 26px "Permanent Marker", sans-serif';
      g.textAlign = 'center';
      g.fillText('ЗАРЯД СЕЛ. КАМЕРЫ МЁРТВЫЕ.', W / 2, H / 2);
    }
  }

  function punkScreen(p) {
    const lane = p.lane;
    const pos = put(W * lane, FLOOR_Y, p.z);
    return { x: pos.x, y: pos.y, s: Math.max(0.18, p.z) };
  }

  function drawPunk3D(p) {
    const pos = punkScreen(p);
    const sc = pos.s * 1.45;
    const sway = Math.sin(p.phase) * 5 * sc;

    g.save();
    g.translate(pos.x, pos.y);
    g.scale(sc * (p.heavy ? 1.22 : 1), sc * (p.heavy ? 1.22 : 1));
    g.globalAlpha = 0.45 + pos.s * 0.55;

    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-4, 0);
    g.lineTo(-4 + sway, 22);
    g.moveTo(4, 0);
    g.lineTo(4 - sway, 22);
    g.stroke();

    roundRect(g, -16, -34, 32, 36, 8);
    g.fillStyle = p.heavy ? INK : RED;
    g.fill();
    g.strokeStyle = p.heavy ? PAPER : INK;
    g.lineWidth = 3;
    g.stroke();

    g.beginPath();
    g.arc(0, -46, 13, 0, Math.PI * 2);
    g.fillStyle = ACID;
    g.fill();
    g.strokeStyle = INK;
    g.stroke();
    g.fillStyle = INK;
    g.beginPath();
    g.arc(-4, -48, 2.6, 0, Math.PI * 2);
    g.arc(4, -48, 2.6, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(0, -56, 13.4, Math.PI, Math.PI * 2);
    g.fill();
    g.fillRect(-13, -58, 18, 4);

    g.save();
    g.translate(16, -22);
    g.rotate(-0.5 + Math.sin(p.phase) * 0.15);
    g.fillStyle = ACID;
    g.fillRect(-4, -12, 8, 14);
    g.fillStyle = INK;
    g.fillRect(-3, -17, 6, 6);
    g.restore();

    g.restore();
  }
  function drawHud() {
    g.fillStyle = 'rgba(10,10,10,.72)';
    g.fillRect(0, 0, W, 34);
    g.font = 'bold 18px "Bebas Neue", sans-serif';
    g.textAlign = 'left';
    g.fillStyle = ACID;
    g.fillText('КАМЕРА ' + (ROOMS.findIndex((r) => r.id === S.room) + 1) + ' · ' + ROOMS.find((r) => r.id === S.room).name, 12, 23);
    g.textAlign = 'right';
    g.fillStyle = S.power > 25 ? PAPER : RED;
    g.fillText('ЗАРЯД ' + Math.round(S.power) + '%', W - 12, 23);

    if (S.power <= 0) {
      g.textAlign = 'center';
      g.fillStyle = RED;
      g.fillText('СВЕТА НЕТ', W / 2, 23);
    }

    if (S.state === 'play' && S.punks.some((p) => p.room === 'booth')) {
      g.fillStyle = RED;
      g.globalAlpha = 0.25 + 0.2 * Math.sin(S.t * 12);
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
  }

  function drawOverlayText() {
    if (S.state === 'idle') {
      g.fillStyle = 'rgba(10,10,10,.82)';
      g.fillRect(0, H / 2 - 58, W, 116);
      g.fillStyle = ACID;
      g.font = 'bold 32px "Permanent Marker", sans-serif';
      g.textAlign = 'center';
      g.fillText('НОЧНАЯ СМЕНА', W / 2, H / 2 - 12);
      g.fillStyle = PAPER;
      g.font = '15px "Special Elite", monospace';
      g.fillText('шесть часов, четыре камеры, шесть бутылок', W / 2, H / 2 + 14);
      g.fillText('жми «НА СМЕНУ»', W / 2, H / 2 + 36);
    } else if (S.state === 'over') {
      g.fillStyle = 'rgba(10,10,10,.84)';
      g.fillRect(0, H / 2 - 52, W, 104);
      g.fillStyle = RED;
      g.font = 'bold 34px "Permanent Marker", sans-serif';
      g.textAlign = 'center';
      g.fillText('ПИВО ВЫПИТО', W / 2, H / 2 - 4);
      g.fillStyle = PAPER;
      g.font = '16px "Special Elite", monospace';
      g.fillText('смена провалена · ночей прожито: ' + S.best, W / 2, H / 2 + 26);
    } else if (S.state === 'won') {
      g.fillStyle = 'rgba(10,10,10,.84)';
      g.fillRect(0, H / 2 - 52, W, 104);
      g.fillStyle = ACID;
      g.font = 'bold 34px "Permanent Marker", sans-serif';
      g.textAlign = 'center';
      g.fillText('06:00. УТРО.', W / 2, H / 2 - 4);
      g.fillStyle = PAPER;
      g.font = '16px "Special Elite", monospace';
      g.fillText('пиво целое · ночей прожито: ' + S.best, W / 2, H / 2 + 26);
    } else if (S.state === 'paused') {
      g.fillStyle = 'rgba(10,10,10,.7)';
      g.fillRect(0, H / 2 - 26, W, 52);
      g.fillStyle = ACID;
      g.font = 'bold 26px "Permanent Marker", sans-serif';
      g.textAlign = 'center';
      g.fillText('ПАУЗА. ПАНКИ ТОЖЕ.', W / 2, H / 2 + 8);
    }
  }

  function draw() {
    drawRoom3D(S.room);
    if (S.power > 0 || S.room === 'booth') {
      // Рисуем от дальних к ближним, иначе перспектива ломается.
      S.punks
        .filter((p) => p.room === S.room)
        .sort((a, b) => a.z - b.z)
        .forEach((p) => drawPunk3D(p));
    }
    drawHud();
    drawOverlayText();
  }

  /* ------------------------------- Цикл ------------------------------ */
  let raf = 0;
  let last = 0;
  let lastDraw = 0;

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!last) last = ts;
    const dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;
    if (ts - lastDraw < 33) return;
    lastDraw = ts;
    if (S.state === 'play') step(dt);
    draw();
  }

  function loopStart() {
    if (raf || !S.visible) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { draw(); return; }
    last = 0;
    lastDraw = 0;
    raf = requestAnimationFrame(frame);
  }

  function loopStop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  /* ------------------------------- Ввод ------------------------------ */
  function switchRoom(id) {
    S.room = id;
    S.power = Math.max(0, S.power - 2.5);
    S.glitch = 1;
    hud();
    if (S.state === 'idle' || S.state === 'over' || S.state === 'won') reset();
    else draw();
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.focus({ preventScroll: true });
    if (S.state === 'idle' || S.state === 'over' || S.state === 'won') { reset(); return; }

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;

    if (S.bottles <= 0) { say('Бутылки кончились. Держись как можешь.', 'is-bad'); return; }

    // Чем панк дальше, тем он мельче и тем сложнее в него попасть.
    let hit = null;
    let bestD = 1;
    S.punks.filter((p) => p.room === S.room).forEach((p) => {
      const pos = punkScreen(p);
      const d = Math.hypot(pos.x - x, pos.y - 52 * pos.s - y) / (110 * pos.s);
      if (d < bestD) { bestD = d; hit = p; }
    });

    if (!hit) { S.power = Math.max(0, S.power - 0.6); say('Бутылка в молоко. Панка тут нет.', 'is-bad'); sfx('miss'); return; }

    S.bottles -= 1;
    hit.hp -= 1;
    S.flashlight = 0.4;
    sfx('hit');
    if (hit.hp <= 0) {
      const idx = S.punks.indexOf(hit);
      S.punks.splice(idx, 1);
      say('Панк вырублен бутылкой. Минус одна бутылка.', 'is-good');
    } else {
      const i = ROOMS.findIndex((r) => r.id === hit.room);
      hit.room = ROOMS[Math.max(0, i - 1)].id;
      say('Здоровый только пошатнулся — отступил на комнату назад.', 'is-good');
    }
    hud();
    draw();
  });

  canvas.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (S.state === 'play') { S.state = 'paused'; say('Пауза.'); }
      else if (S.state === 'paused') { S.state = 'play'; say('Смотрим дальше.'); }
      draw();
      return;
    }
    const n = Number(e.key);
    if (n >= 1 && n <= ROOMS.length) {
      e.preventDefault();
      e.stopPropagation();
      switchRoom(ROOMS[n - 1].id);
    }
  });

  section.querySelector('.shift-tray').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-room]');
    if (!btn) return;
    switchRoom(btn.dataset.room);
  });

  document.getElementById('shiftStart').addEventListener('click', () => { reset(); draw(); });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        S.visible = entry.isIntersecting;
        if (S.visible) {
          if (S.autoPaused) { S.autoPaused = false; S.state = 'play'; }
          if (S.state === 'play' || S.state === 'paused') loopStart();
        } else {
          loopStop();
          if (S.state === 'play') { S.state = 'paused'; S.autoPaused = true; draw(); }
        }
      }
    }, { threshold: 0.12 });
    io.observe(section);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) loopStop();
    else if (S.visible && S.state === 'play') loopStart();
  });

  window.addEventListener('resize', () => draw());

  hud();
  draw();

  return { reset, getState: () => S.state };
}
