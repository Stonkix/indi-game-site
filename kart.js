/* =============================================================================
   DUNGEON PUNK — kart.js
   «САМОКАТ 13»: собери тачку из рам, колёс, моторов и баллонов, потом жми
   «ПОЕХАЛИ» и смотри, доедет ли она до флага. Физика — твёрдое тело на
   пружинных колёсах, честная: центр масс, момент инерции, сцепление с уклоном.

   Персонажи, вывеска и музыка — свои. Мелодия сочинена для этого модуля,
   ничьи темы не цитируются.

   Модуль ленивый: раздел вставляется после «Ночной смены».
   ========================================================================== */

const VW = 660;
const VH = 372;
const CELL = 20;
const GCOLS = 9;
const GROWS = 7;

const INK = '#0a0a0a';
const PAPER = '#f2efe6';
const ACID = '#f5e400';
const RED = '#e10600';

const KEY = 'dp.kart.best.v1';

const PARTS = {
  frame: { name: 'РАМА', short: 'Р', mass: 1.0, limit: 10 },
  wheel: { name: 'КОЛЕСО', short: 'О', mass: 0.7, limit: 5 },
  motor: { name: 'МОТОР', short: 'М', mass: 0.9, limit: 3 },
  balloon: { name: 'БАЛЛОН', short: 'Б', mass: 0.25, limit: 3 },
  weight: { name: 'ГРУЗ', short: 'Г', mass: 2.2, limit: 4 }
};

const LEVELS = [
  {
    name: 'ПРЯМАЯ',
    finish: 1120,
    ground: [[0, 324], [300, 324], [360, 300], [430, 324], [1200, 324]]
  },
  {
    name: 'ЯМА',
    finish: 1140,
    ground: [[0, 306], [250, 306], [330, 258], [410, 306], [470, 306],
             [486, 560], [624, 560], [640, 306], [1200, 306]]
  },
  {
    name: 'ГОРКА',
    finish: 1150,
    ground: [[0, 330], [180, 330], [300, 250], [430, 176], [560, 176],
             [700, 268], [900, 330], [1200, 330]]
  }
];

const CSS = `
.kart-section { padding-block: 2rem 4rem; }
.kart-cab {
  background: var(--ink); color: var(--paper);
  border: var(--border-w) solid var(--ink);
  box-shadow: 8px 8px 0 var(--paper);
  padding: .8rem;
}
.kart-screen {
  background: var(--ink);
  border: 3px solid var(--paper);
  outline: 2px dashed rgba(242,239,230,.35);
  outline-offset: -9px;
  padding: .35rem;
  display: grid; place-items: center;
  perspective: 1000px;
}
.kart-screen canvas {
  display: block; width: 100%; height: auto;
  max-width: ${VW}px;
  touch-action: manipulation;
  transform: rotateX(1.6deg);
}
.kart-palette { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .7rem; }
.kart-part {
  font-family: var(--f-btn); font-size: 1rem; letter-spacing: .04em;
  background: var(--paper); color: var(--ink);
  border: 3px solid var(--paper); box-shadow: 3px 3px 0 var(--ink);
  padding: .3rem .55rem .26rem; text-align: left; line-height: 1.1;
}
.kart-part b { display: block; }
.kart-part i { font-family: var(--f-type); font-size: .68rem; font-style: normal; opacity: .7; }
.kart-part[aria-pressed="true"] { background: var(--acid); border-color: var(--acid); }
.kart-part--wipe { background: var(--red); color: var(--paper); border-color: var(--red); }
.kart-part--wipe[aria-pressed="true"] { background: var(--acid); color: var(--ink); }
.kart-stats {
  display: flex; flex-wrap: wrap; gap: .4rem 1.1rem;
  font-family: var(--f-btn); font-size: 1.1rem; letter-spacing: .05em;
  margin: .7rem 0 .3rem;
}
.kart-stats b { color: var(--acid); }
.kart-msg { font-family: var(--f-marker); font-size: .95rem; margin: 0 0 .6rem; min-height: 1.4em; }
.kart-msg.is-bad { background: var(--red); color: var(--paper); padding: .15rem .4rem; }
.kart-msg.is-good { background: var(--acid); color: var(--ink); padding: .15rem .4rem; }
.kart-actions { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
.kart-keys { font-size: .78rem; opacity: .6; }
@media (max-width: 560px) {
  .kart-part i { display: none; }
  .kart-part { font-size: .85rem; }
}
`;

let injected = false;

function inject() {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.id = 'dp-kart-style';
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

/* ---------------------------------------------------------------------------
   Своя чиптюн-мелодия: простой марш в до-мажоре, 132 BPM, восемь тактов.
   Сочинялась под этот конструктор, никакие чужие темы не цитируются.
   ------------------------------------------------------------------------ */
const FREQ = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0
};

const MELODY = [
  ['C5', 0, 0.5], ['E5', 0.5, 0.5], ['G5', 1, 1], ['E5', 2, 0.5], ['C5', 2.5, 0.5], ['D5', 3, 1],
  ['E5', 4, 0.5], ['F5', 4.5, 0.5], ['G5', 5, 2],
  ['A5', 8, 0.5], ['G5', 8.5, 0.5], ['F5', 9, 1], ['E5', 10, 1], ['D5', 11, 1],
  ['C5', 12, 2],
  ['C5', 16, 0.5], ['D5', 16.5, 0.5], ['E5', 17, 1], ['G5', 18, 0.5], ['F5', 18.5, 0.5], ['E5', 19, 1],
  ['D5', 20, 0.5], ['C5', 20.5, 0.5], ['D5', 21, 2],
  ['F5', 24, 0.5], ['E5', 24.5, 0.5], ['D5', 25, 1], ['C5', 26, 1], ['B4', 27, 1],
  ['C5', 28, 3]
];

const BASS = [
  ['C3', 0], ['G3', 2], ['C3', 4], ['G3', 6],
  ['F3', 8], ['C3', 10], ['G3', 12], ['C3', 14],
  ['C3', 16], ['G3', 18], ['A3', 20], ['E3', 22],
  ['F3', 24], ['G3', 26], ['C3', 28], ['C3', 30]
];

const LOOP_BEATS = 32;
const BPM = 132;

export function createKart() {
  if (document.getElementById('kartSection')) return null;
  inject();

  const main = document.querySelector('main') || document.body;
  const section = document.createElement('section');
  section.className = 'kart-section';
  section.id = 'kart';
  section.setAttribute('aria-labelledby', 'kart-title');
  section.innerHTML = `
    <div class="section-head">
      <h2 class="section-title" id="kart-title">
        <span class="ransom" data-ransom="САМОКАТ 13">САМОКАТ 13</span>
      </h2>
      <p class="section-sub">
        Собери тачку, поставь мотор и доедь до флага. Физика честная — перевернёшься, поедешь заново.
      </p>
    </div>

    <div class="kart-cab">
      <div class="kart-screen">
        <canvas id="kartCanvas" width="${VW}" height="${VH}" tabindex="0" role="application"
                aria-label="Игра Самокат 13. Собирай тачку из деталей, потом жми поехали. Управление: стрелки или пробел."></canvas>
      </div>

      <p class="kart-stats">
        <span>Уровень: <b id="kartLevel">1</b></span>
        <span>Пройдено: <b id="kartWins">0</b></span>
        <span>Рекорд: <b id="kartBest">0</b></span>
      </p>

      <div class="kart-palette" role="group" aria-label="Детали">
        <button type="button" class="kart-part" data-part="frame" aria-pressed="true"><b>РАМА <span data-left="frame">10</span></b><i>скелет тачки</i></button>
        <button type="button" class="kart-part" data-part="wheel" aria-pressed="false"><b>КОЛЕСО <span data-left="wheel">5</span></b><i>катится</i></button>
        <button type="button" class="kart-part" data-part="motor" aria-pressed="false"><b>МОТОР <span data-left="motor">3</span></b><i>крутит колёса</i></button>
        <button type="button" class="kart-part" data-part="balloon" aria-pressed="false"><b>БАЛЛОН <span data-left="balloon">3</span></b><i>тянет вверх</i></button>
        <button type="button" class="kart-part" data-part="weight" aria-pressed="false"><b>ГРУЗ <span data-left="weight">4</span></b><i>прижимает</i></button>
        <button type="button" class="kart-part kart-part--wipe" id="kartWipe" aria-pressed="false"><b>ЛАСТИК</b><i>снять деталь</i></button>
      </div>

      <p class="kart-msg" id="kartMsg" role="status" aria-live="polite">
        Ставь детали в сетку. Основа — нижняя центральная клетка.
      </p>

      <div class="kart-actions">
        <button type="button" class="btn btn--acid btn--sm" id="kartGo">ПОЕХАЛИ</button>
        <button type="button" class="btn btn--ghost btn--sm" id="kartLevelBtn">Следующий уровень</button>
        <button type="button" class="btn btn--ghost btn--sm" id="kartClear">Разобрать</button>
        <button type="button" class="btn btn--ghost btn--sm" id="kartMute" aria-pressed="false">♪ Музыка</button>
        <span class="kart-keys">стрелки — подтолкнуть и наклонить · R — собрать заново</span>
      </div>
    </div>`;

  const shift = document.getElementById('shift');
  if (shift) shift.insertAdjacentElement('afterend', section);
  else main.appendChild(section);
  document.dispatchEvent(new CustomEvent('dp:ransom'));

  const canvas = document.getElementById('kartCanvas');
  const g = canvas.getContext('2d');
  const msg = document.getElementById('kartMsg');

  let actx = null;
  let musicOn = true;
  let musicTimer = 0;
  let musicStep = 0;
  let musicNext = 0;

  function sync() {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    if (!actx) { try { actx = new C(); } catch (err) { return null; } }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  function blip(freq, dur, type, gain, when) {
    const ctx = sync();
    if (!ctx) return;
    const t = when || ctx.currentTime;
    const o = ctx.createOscillator();
    const gn = ctx.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(gain, t + 0.012);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn);
    gn.connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function musicTick() {
    const ctx = sync();
    if (!ctx || !musicOn) return;
    const beat = 60 / BPM;
    const stepDur = beat / 2;   // сетка восьмыми
    const lastStep = LOOP_BEATS * 2;
    if (!musicNext || musicNext < ctx.currentTime) musicNext = ctx.currentTime + 0.08;

    while (musicNext < ctx.currentTime + 0.25) {
      const step = musicStep % lastStep;
      for (const [n, at, dur] of MELODY) {
        if (Math.abs(at - step) < 0.001) {
          blip(FREQ[n], Math.max(0.09, dur * beat * 0.85), 'square', 0.05, musicNext);
        }
      }
      for (const [n, at] of BASS) {
        if (Math.abs(at - step) < 0.001) blip(FREQ[n] / 2, beat * 1.7, 'triangle', 0.07, musicNext);
      }
      musicNext += stepDur;
      musicStep = (musicStep + 1) % lastStep;
    }
  }

  function musicStart() {
    if (!musicOn) return;
    stopMusic();
    const ctx = sync();
    if (!ctx) return;
    musicNext = ctx.currentTime + 0.1;
    musicStep = 0;
    musicTimer = setInterval(musicTick, 120);
  }

  function stopMusic() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = 0;
  }

  const K = {
    cells: [],
    selected: 'frame',
    level: 0,
    wins: 0,
    mode: 'build',
    visible: true,
    t: 0,
    body: null,
    camera: 0,
    finish: 0,
    ground: [],
    fail: 0
  };

  K.best = Number(read(KEY, 0)) || 0;
  document.getElementById('kartBest').textContent = String(K.best);

  function say(text, mood) {
    msg.textContent = text;
    msg.classList.remove('is-bad', 'is-good');
    if (mood) msg.classList.add(mood);
  }

  function hud() {
    document.getElementById('kartLevel').textContent = String(K.level + 1);
    document.getElementById('kartWins').textContent = String(K.wins);
    document.getElementById('kartBest').textContent = String(K.best);
    const used = {};
    for (const c of K.cells) used[c.part] = (used[c.part] || 0) + 1;
    for (const key in PARTS) {
      const el = section.querySelector(`[data-left="${key}"]`);
      if (el) el.textContent = String(Math.max(0, PARTS[key].limit - (used[key] || 0)));
    }
    section.querySelectorAll('.kart-part[data-part]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.part === K.selected));
    });
    document.getElementById('kartWipe').setAttribute('aria-pressed', String(K.selected === 'wipe'));
  }

  /* --------------------------- Сборка ------------------------------- */
  function key(cx, cy) { return cx + ':' + cy; }

  function baseCell() {
    return { cx: Math.floor(GCOLS / 2), cy: GROWS - 2 };
  }

  function resetCells() {
    K.cells = [];
    const b = baseCell();
    K.cells.push({ cx: b.cx, cy: b.cy, part: 'frame' });
  }

  function cellAt(cx, cy) {
    return K.cells.find((c) => c.cx === cx && c.cy === cy) || null;
  }

  function countOf(part) {
    return K.cells.filter((c) => c.part === part).length;
  }

  function connected(cells) {
    const set = new Set(cells.map((c) => key(c.cx, c.cy)));
    const start = baseCell();
    if (!set.has(key(start.cx, start.cy))) return false;
    const seen = new Set();
    const queue = [[start.cx, start.cy]];
    while (queue.length) {
      const [cx, cy] = queue.pop();
      const k = key(cx, cy);
      if (seen.has(k)) continue;
      seen.add(k);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = key(cx + dx, cy + dy);
        if (set.has(nk) && !seen.has(nk)) queue.push([cx + dx, cy + dy]);
      }
    }
    return seen.size === cells.length;
  }

  function place(cx, cy) {
    if (K.mode !== 'build') return;
    if (cx < 0 || cx >= GCOLS || cy < 0 || cy >= GROWS) return;

    if (K.selected === 'wipe') {
      const b = baseCell();
      const cur = cellAt(cx, cy);
      if (!cur) return;
      if (cur.cx === b.cx && cur.cy === b.cy) { say('Основа не снимается. Иначе тачка не соберётся.', 'is-bad'); return; }
      K.cells = K.cells.filter((c) => c !== cur);
      say('Деталь снята.');
      hud();
      draw();
      return;
    }

    if (PARTS[K.selected].limit - countOf(K.selected) <= 0) {
      say(`${PARTS[K.selected].name}: детали кончились.`, 'is-bad');
      return;
    }
    if (cellAt(cx, cy)) { say('Клетка занята. Возьми ластик.', 'is-bad'); return; }

    const candidate = K.cells.concat([{ cx, cy, part: K.selected }]);
    if (!connected(candidate)) {
      say('Деталь висит в воздухе — прикрути её к раме.', 'is-bad');
      return;
    }
    K.cells = candidate;
    hud();
    draw();
  }

  /* --------------------------- Физика -------------------------------- */
  function groundY(x, list) {
    const pts = list || K.ground;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      if (x >= x1 && x <= x2) {
        const k = x2 === x1 ? 0 : (x - x1) / (x2 - x1);
        return y1 + (y2 - y1) * k;
      }
    }
    return null;
  }

  function groundNormal(x) {
    const e = 3;
    const a = groundY(x - e);
    const b = groundY(x + e);
    if (a === null || b === null) return { x: 0, y: -1 };
    let nx = -(b - a);
    let ny = 2 * e;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    if (ny > 0) { nx = -nx; ny = -ny; }
    return { x: nx, y: ny };
  }

  function buildBody() {
    const b = baseCell();
    const parts = K.cells.map((c) => ({
      part: c.part,
      ox: (c.cx - b.cx) * CELL,
      oy: (c.cy - b.cy) * CELL,
      mass: PARTS[c.part].mass
    }));
    let mass = 0;
    let sx = 0;
    let sy = 0;
    let spanX = 0;
    let spanY = 0;
    for (const p of parts) {
      mass += p.mass;
      sx += p.ox * p.mass;
      sy += p.oy * p.mass;
      spanX = Math.max(spanX, Math.abs(p.ox));
      spanY = Math.max(spanY, Math.abs(p.oy));
    }
    const cx = sx / mass;
    const cy = sy / mass;
    for (const p of parts) { p.ox -= cx; p.oy -= cy; }

    const startX = 90;
    const gy = groundY(startX) || 300;

    K.body = {
      x: startX,
      y: gy - 40,
      a: 0,
      vx: 0,
      vy: 0,
      w: 0,
      mass,
      inertia: Math.max(1400, mass * (spanX * spanX + spanY * spanY) * 0.7),
      parts,
      motorOn: false
    };
  }

  function fail(text) {
    if (K.mode !== 'drive') return;
    K.mode = 'build';
    K.fail += 1;
    buildBody();
    say(text, 'is-bad');
    draw();
  }

  function stepPhysics(dt) {
    const b = K.body;
    if (!b) return;

    const R = Math.cos(b.a);
    const S = Math.sin(b.a);
    const toWorld = (ox, oy) => ({ x: b.x + ox * R - oy * S, y: b.y + ox * S + oy * R });

    let fx = 0;
    let fy = b.mass * 1500;
    let torque = 0;

    const apply = (px, py, ax, ay) => {
      fx += ax;
      fy += ay;
      torque += (px - b.x) * ay - (py - b.y) * ax;
    };

    const flipped = Math.abs(b.a) > 1.9;
    const motorForce = b.motorOn && !flipped ? 430 : 0;

    for (const p of b.parts) {
      const wp = toWorld(p.ox, p.oy);

      if (p.part === 'balloon') {
        apply(wp.x, wp.y, 0, -b.mass * 1500 * 0.42);
      }

      if (p.part === 'wheel') {
        const gy = groundY(wp.x);
        if (gy === null) continue;
        const pen = wp.y + 11 - gy;
        if (pen <= 0) continue;

        const n = groundNormal(wp.x);
        const rx = wp.x - b.x;
        const ry = wp.y - b.y;
        const vpx = b.vx - b.w * ry;
        const vpy = b.vy + b.w * rx;
        const vn = vpx * n.x + vpy * n.y;

        const fn = Math.max(0, pen * 2600 - vn * 45);
        apply(wp.x, wp.y, n.x * fn, n.y * fn);

        // Касательная — по ней и едет
        const tx = -n.y;
        const ty = n.x;
        const vt = vpx * tx + vpy * ty;
        let ft = motorForce;
        if (ft === 0) ft = -vt * 14;
        else ft -= vt * 6;
        ft = Math.max(-900, Math.min(900, ft));
        apply(wp.x, wp.y, tx * ft, ty * ft);
      }
    }

    b.vx += (fx / b.mass) * dt;
    b.vy += (fy / b.mass) * dt;
    b.w += (torque / b.inertia) * dt;

    b.vx *= 0.999;
    b.w *= 0.995;
    const cap = (v, m) => Math.max(-m, Math.min(m, v));
    b.vx = cap(b.vx, 900);
    b.vy = cap(b.vy, 900);
    b.w = cap(b.w, 12);
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.a += b.w * dt;

    if (b.y > 640) { fail('Улетел в яму. Собери тачку иначе.'); return; }
    if (b.x > K.finish - 30 && Math.abs(b.vy) < 400) {
      K.mode = 'won';
      K.wins += 1;
      if (K.wins > K.best) { K.best = K.wins; write(KEY, K.best); }
      stopMusic();
      say(`Уровень «${LEVELS[K.level].name}» пройден. Дальше — кнопка снизу.`, 'is-good');
      hud();
      draw();
      return;
    }
    if (b.x < -120) { fail('Уехал назад. Так тоже бывает.'); return; }
  }

  /* --------------------------- Рисование ----------------------------- */
  function drawSky() {
    g.fillStyle = INK;
    g.fillRect(0, 0, VW, VH);

    g.fillStyle = 'rgba(242,239,230,.07)';
    for (let y = 10; y < VH; y += 18) {
      for (let x = 10; x < VW; x += 18) {
        g.beginPath();
        g.arc(x, y, 1.1, 0, Math.PI * 2);
        g.fill();
      }
    }

    g.fillStyle = ACID;
    g.beginPath();
    g.arc(VW - 70, 60, 22, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.stroke();
  }

  function drawTerrain(cam) {
    g.beginPath();
    g.moveTo(K.ground[0][0] - cam, VH);
    for (const [x, y] of K.ground) g.lineTo(x - cam, y);
    const last = K.ground[K.ground.length - 1];
    g.lineTo(last[0] - cam, VH);
    g.closePath();
    g.fillStyle = 'rgba(242,239,230,.14)';
    g.fill();
    g.strokeStyle = PAPER;
    g.lineWidth = 3;
    g.stroke();

    // Флаг
    const fx = K.finish - cam;
    const fgy = groundY(K.finish) || 280;
    g.strokeStyle = PAPER;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(fx, fgy);
    g.lineTo(fx, fgy - 70);
    g.stroke();
    g.fillStyle = RED;
    g.beginPath();
    g.moveTo(fx, fgy - 70);
    g.lineTo(fx - 40, fgy - 58);
    g.lineTo(fx, fgy - 44);
    g.closePath();
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.stroke();
  }

  function drawBuildGrid() {
    const ox = (VW - GCOLS * CELL * 1.6) / 2;
    const oy = (VH - GROWS * CELL * 1.6) / 2 + 6;
    const cs = CELL * 1.6;

    g.fillStyle = 'rgba(10,10,10,.55)';
    g.fillRect(0, 0, VW, VH);

    for (let cy = 0; cy < GROWS; cy++) {
      for (let cx = 0; cx < GCOLS; cx++) {
        const x = ox + cx * cs;
        const y = oy + cy * cs;
        g.strokeStyle = 'rgba(242,239,230,.16)';
        g.lineWidth = 1;
        g.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
        const cell = cellAt(cx, cy);
        if (cell) drawPartIcon(cell.part, x + cs / 2, y + cs / 2, cs);
      }
    }

    const b = baseCell();
    g.strokeStyle = ACID;
    g.lineWidth = 3;
    g.strokeRect(ox + b.cx * cs - 2, oy + b.cy * cs - 2, cs + 4, cs + 4);
    g.fillStyle = ACID;
    g.font = 'bold 13px "Bebas Neue", sans-serif';
    g.textAlign = 'left';
    g.fillText('ОСНОВА', ox + b.cx * cs - 4, oy + b.cy * cs - 8);

    g.fillStyle = 'rgba(242,239,230,.6)';
    g.font = '14px "Special Elite", monospace';
    g.textAlign = 'center';
    g.fillText('клик — поставить · ластик — снять · деталь должна касаться рамы', VW / 2, oy - 10);
  }

  function drawPartIcon(part, x, y, size) {
    const s = size / 34;
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.lineWidth = 3;
    g.strokeStyle = INK;
    g.fillStyle = PAPER;
    if (part === 'frame') {
      g.fillStyle = PAPER;
      g.fillRect(-13, -13, 26, 26);
      g.strokeRect(-13, -13, 26, 26);
      g.beginPath();
      g.moveTo(-13, -13);
      g.lineTo(13, 13);
      g.moveTo(13, -13);
      g.lineTo(-13, 13);
      g.stroke();
    } else if (part === 'wheel') {
      g.beginPath();
      g.arc(0, 0, 12, 0, Math.PI * 2);
      g.fillStyle = INK;
      g.fill();
      g.strokeStyle = ACID;
      g.stroke();
      g.fillStyle = ACID;
      g.beginPath();
      g.arc(0, 0, 3.5, 0, Math.PI * 2);
      g.fill();
    } else if (part === 'motor') {
      g.fillStyle = RED;
      g.fillRect(-12, -9, 24, 18);
      g.strokeRect(-12, -9, 24, 18);
      g.fillStyle = ACID;
      g.fillRect(-4, -14, 8, 5);
    } else if (part === 'balloon') {
      g.fillStyle = ACID;
      g.beginPath();
      g.ellipse(0, -4, 11, 13, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(0, 9);
      g.lineTo(0, 15);
      g.stroke();
    } else {
      g.fillStyle = INK;
      g.fillRect(-11, -11, 22, 22);
      g.strokeStyle = PAPER;
      g.strokeRect(-11, -11, 22, 22);
      g.fillStyle = PAPER;
      g.font = 'bold 14px "Bebas Neue", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('Т', 0, 1);
    }
    g.restore();
  }

  function drawCart(cam) {
    const b = K.body;
    if (!b) return;
    g.save();
    g.translate(b.x - cam, b.y);
    g.rotate(b.a);
    for (const p of b.parts) drawPartIconAt(p.part, p.ox, p.oy);
    g.restore();
  }

  function drawPartIconAt(part, ox, oy) {
    g.save();
    g.translate(ox, oy);
    g.lineWidth = 3;
    g.strokeStyle = INK;
    if (part === 'frame') {
      g.fillStyle = PAPER;
      g.fillRect(-CELL / 2, -CELL / 2, CELL, CELL);
      g.strokeRect(-CELL / 2, -CELL / 2, CELL, CELL);
    } else if (part === 'wheel') {
      g.beginPath();
      g.arc(0, 0, 11, 0, Math.PI * 2);
      g.fillStyle = INK;
      g.fill();
      g.strokeStyle = ACID;
      g.stroke();
      g.fillStyle = ACID;
      g.beginPath();
      g.arc(0, 0, 3, 0, Math.PI * 2);
      g.fill();
    } else if (part === 'motor') {
      g.fillStyle = RED;
      g.fillRect(-10, -8, 20, 16);
      g.strokeRect(-10, -8, 20, 16);
      g.fillStyle = ACID;
      g.fillRect(-3, -12, 6, 4);
    } else if (part === 'balloon') {
      g.fillStyle = ACID;
      g.beginPath();
      g.ellipse(0, -4, 9, 11, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    } else {
      g.fillStyle = INK;
      g.fillRect(-9, -9, 18, 18);
      g.strokeStyle = PAPER;
      g.strokeRect(-9, -9, 18, 18);
    }
    g.restore();
  }

  function drawHud() {
    g.font = 'bold 17px "Bebas Neue", sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = ACID;
    g.fillText('УРОВЕНЬ ' + (K.level + 1) + ' · ' + LEVELS[K.level].name, 12, 24);
    g.fillStyle = PAPER;
    g.fillText(K.mode === 'drive' ? 'ЕДЕМ' : 'СБОРКА', 12, 44);
    g.textAlign = 'right';
    g.fillStyle = 'rgba(242,239,230,.6)';
    g.fillText('ДЕТАЛЕЙ ' + K.cells.length, VW - 12, 24);
  }

  function drawOverlay() {
    if (K.mode === 'won') {
      g.fillStyle = 'rgba(10,10,10,.82)';
      g.fillRect(0, VH / 2 - 50, VW, 100);
      g.fillStyle = ACID;
      g.font = 'bold 32px "Permanent Marker", sans-serif';
      g.textAlign = 'center';
      g.fillText('ДОЕХАЛИ!', VW / 2, VH / 2);
      g.fillStyle = PAPER;
      g.font = '15px "Special Elite", monospace';
      g.fillText('«Следующий уровень» внизу', VW / 2, VH / 2 + 28);
    } else if (K.mode === 'build') {
      drawBuildGrid();
    }
  }

  function draw() {
    const cam = K.mode === 'drive' || K.mode === 'won'
      ? Math.max(0, Math.min(1240 - VW, (K.body ? K.body.x : 200) - 240))
      : 0;
    K.camera = cam;

    drawSky();
    drawTerrain(cam);
    if (K.mode === 'drive' || K.mode === 'won') drawCart(cam);
    drawHud();
    drawOverlay();
  }

  /* ----------------------------- Цикл -------------------------------- */
  let raf = 0;
  let last = 0;
  let lastDraw = 0;
  let acc = 0;

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!last) last = ts;
    const dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;
    if (ts - lastDraw < 33) return;
    lastDraw = ts;

    if (K.mode === 'drive') {
      acc += dt;
      let guard = 0;
      while (acc > 1 / 200 && guard < 24) {
        stepPhysics(1 / 200);
        acc -= 1 / 200;
        guard += 1;
        if (K.mode !== 'drive') break;
      }
      if (acc > 0.25) acc = 0;
    }
    draw();
  }

  function loopStart() {
    if (raf || !K.visible) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { draw(); return; }
    last = 0;
    lastDraw = 0;
    raf = requestAnimationFrame(frame);
  }

  function loopStop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  /* ------------------------------ Ввод ------------------------------- */
  function go() {
    const hasWheel = countOf('wheel') > 0;
    const hasMotor = countOf('motor') > 0;
    const hasGround = countOf('wheel') >= 2 || countOf('balloon') > 0;

    if (!hasWheel || !hasMotor) {
      say('Нужны минимум одно колесо и один мотор.', 'is-bad');
      return;
    }
    if (!hasGround) {
      say('Одного колеса мало — поставь второе или баллон.', 'is-bad');
      return;
    }
    buildBody();
    K.mode = 'drive';
    K.body.motorOn = true;
    acc = 0;
    say('Погнали! Стрелки подталкивают тачку.', 'is-good');
    musicStart();
    loopStart();
    draw();
  }

  function toBuild() {
    K.mode = 'build';
    K.body = null;
    stopMusic();
    draw();
  }

  function nextLevel() {
    K.level = (K.level + 1) % LEVELS.length;
    K.ground = LEVELS[K.level].ground.map((p) => p.slice());
    K.finish = LEVELS[K.level].finish;
    K.mode = 'build';
    K.body = null;
    stopMusic();
    say(`Уровень ${K.level + 1}: «${LEVELS[K.level].name}». Собирай.`);
    hud();
    draw();
  }

  function selectPart(part) {
    K.selected = part;
    hud();
    if (part !== 'wipe') say(`${PARTS[part].name}. Клик по клетке — поставить.`);
    else say('Ластик. Клик по детали — снять.');
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.focus({ preventScroll: true });
    if (K.mode === 'drive') { K.body.motorOn = true; return; }
    if (K.mode === 'won') { toBuild(); return; }

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VW;
    const y = ((e.clientY - rect.top) / rect.height) * VH;
    const cs = CELL * 1.6;
    const ox = (VW - GCOLS * cs) / 2;
    const oy = (VH - GROWS * cs) / 2 + 6;
    place(Math.floor((x - ox) / cs), Math.floor((y - oy) / cs));
  });

  canvas.addEventListener('keydown', (e) => {
    if ([' ', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      if (K.mode !== 'drive' || !K.body) return;
      if (e.key === ' ') { K.body.motorOn = !K.body.motorOn; say(K.body.motorOn ? 'Мотор включён.' : 'Мотор заглушён.'); return; }
      if (e.key === 'ArrowRight') K.body.vx += 46;
      if (e.key === 'ArrowLeft') K.body.vx -= 46;
      if (e.key === 'ArrowUp') K.body.vy -= 40;
      if (e.key === 'ArrowDown') K.body.vy += 40;
      return;
    }
    if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
      e.preventDefault();
      e.stopPropagation();
      toBuild();
      say('Тачка разобрана. Собирай заново.');
    }
  });

  section.querySelector('.kart-palette').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-part]');
    if (btn) { selectPart(btn.dataset.part); return; }
    if (e.target.closest('#kartWipe')) selectPart('wipe');
  });

  document.getElementById('kartGo').addEventListener('click', go);
  document.getElementById('kartLevelBtn').addEventListener('click', nextLevel);
  document.getElementById('kartClear').addEventListener('click', () => {
    resetCells();
    K.mode = 'build';
    K.body = null;
    stopMusic();
    say('Разобрали до основы.');
    hud();
    draw();
  });
  document.getElementById('kartMute').addEventListener('click', (e) => {
    musicOn = !musicOn;
    e.currentTarget.setAttribute('aria-pressed', String(!musicOn));
    e.currentTarget.textContent = musicOn ? '♪ Музыка' : '♪ Выкл';
    if (musicOn && K.mode === 'drive') musicStart();
    else stopMusic();
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        K.visible = entry.isIntersecting;
        if (K.visible) { loopStart(); if (K.mode === 'drive') musicStart(); }
        else { loopStop(); stopMusic(); }
      }
    }, { threshold: 0.1 });
    io.observe(section);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { loopStop(); stopMusic(); }
    else if (K.visible) { loopStart(); if (K.mode === 'drive') musicStart(); }
  });

  K.ground = LEVELS[0].ground.map((p) => p.slice());
  K.finish = LEVELS[0].finish;
  resetCells();
  hud();
  draw();

  return { go, toBuild, nextLevel };
}
