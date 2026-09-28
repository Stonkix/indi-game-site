/* =============================================================================
   DUNGEON PUNK — garden.js
   «ОГОРОД 13»: защита грядки от зомбаков. Жанр — башенная защита по дорожкам,
   но всё своё: растения, зомбаки, вывеска и графика оригинальные, нарисованы
   кодом. Никаких чужих персонажей и логотипов, никакой крови: зомбака
   попросту выкорчёвывают.

   Секция собирается в рантайме и вставляется в самый низ страницы.
   Модуль ленивый: стартовая страница за него не платит.
   ========================================================================== */

const W = 720;
const H = 400;
const HOUSE_X = 60;
const Y0 = 44;
const COLS = 8;
const LANES = 5;
const CW = 78;
const CH = 66;

const INK = '#0a0a0a';
const PAPER = '#f2efe6';
const ACID = '#f5e400';
const RED = '#e10600';
const SOIL = '#1a1712';

const KEY = 'dp.garden.best.v1';

const PLANTS = {
  thistle: {
    key: '1',
    name: 'ЧЕРТОПОЛОХ',
    hint: 'стреляет семечками',
    hp: 70,
    cool: 3800,
    fire: 1250,
    dmg: 14
  },
  cork: {
    key: '2',
    name: 'ПРОБКА',
    hint: 'просто стена',
    hp: 380,
    cool: 5200
  },
  mush: {
    key: '3',
    name: 'ГРИБ',
    hint: 'взрывается по площади',
    hp: 70,
    cool: 9000,
    fire: 2600,
    dmg: 26
  }
};

const CSS = `
.garden-section { padding-block: 2rem 4rem; }
.garden-cab {
  background: var(--ink); color: var(--paper);
  border: var(--border-w) solid var(--ink);
  box-shadow: 8px 8px 0 var(--acid);
  padding: .8rem;
}
.garden-screen {
  background: var(--ink);
  border: 3px solid var(--paper);
  outline: 2px dashed rgba(242,239,230,.35);
  outline-offset: -9px;
  padding: .35rem;
  display: grid; place-items: center;
}
.garden-screen canvas {
  display: block; width: 100%; height: auto;
  max-width: 720px;
  touch-action: manipulation;
}
.garden-tray {
  display: flex; flex-wrap: wrap; gap: .45rem; align-items: stretch;
  margin-top: .7rem;
}
.seed {
  position: relative; overflow: hidden;
  font-family: var(--f-btn); font-size: 1rem; letter-spacing: .04em;
  background: var(--paper); color: var(--ink);
  border: 3px solid var(--paper); box-shadow: 3px 3px 0 var(--red);
  padding: .3rem .6rem .26rem;
  text-align: left; line-height: 1.15;
}
.seed b { display: block; font-size: 1.08rem; }
.seed i { font-family: var(--f-type); font-size: .72rem; font-style: normal; opacity: .75; }
.seed::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: 0;
  height: var(--cd, 0%); background: rgba(10,10,10,.45);
  pointer-events: none;
}
.seed[aria-pressed="true"] { background: var(--acid); border-color: var(--acid); }
.seed[aria-pressed="true"]::after { background: rgba(10,10,10,.25); }
.seed--dig { background: var(--red); color: var(--paper); border-color: var(--red); box-shadow: 3px 3px 0 var(--ink); }
.seed--dig[aria-pressed="true"] { background: var(--acid); color: var(--ink); }
.garden-stats {
  display: flex; flex-wrap: wrap; gap: .4rem 1.2rem;
  font-family: var(--f-btn); font-size: 1.1rem; letter-spacing: .05em;
  margin: .7rem 0 .3rem;
}
.garden-stats b { color: var(--acid); }
.garden-msg { font-family: var(--f-marker); font-size: .95rem; margin: 0 0 .6rem; min-height: 1.4em; }
.garden-msg.is-bad { background: var(--red); color: var(--paper); padding: .15rem .4rem; }
.garden-msg.is-good { background: var(--acid); color: var(--ink); padding: .15rem .4rem; }
.garden-actions { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
.garden-keys { font-size: .78rem; opacity: .6; }
@media (max-width: 560px) {
  .seed { font-size: .85rem; padding: .25rem .45rem .2rem; }
  .seed b { font-size: .92rem; }
  .seed i { display: none; }
}
`;

let injected = false;

function inject() {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.id = 'dp-garden-style';
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

function cellX(col) { return HOUSE_X + col * CW + CW / 2; }
function cellY(row) { return Y0 + row * CH + CH / 2; }
function colAt(x) { return Math.floor((x - HOUSE_X) / CW); }
function rowAt(y) { return Math.floor((y - Y0) / CH); }

export function createGarden() {
  if (document.getElementById('gardenSection')) return null;
  inject();

  const main = document.querySelector('main') || document.body;
  const section = document.createElement('section');
  section.className = 'garden-section';
  section.id = 'garden';
  section.setAttribute('aria-labelledby', 'garden-title');
  section.innerHTML = `
    <div class="section-head">
      <h2 class="section-title" id="garden-title">
        <span class="ransom" data-ransom="ОГОРОД 13">ОГОРОД 13</span>
      </h2>
      <p class="section-sub">Растения против зомбаков. Дорожек пять, растения свои, зомбаки тоже.</p>
    </div>

    <div class="garden-cab">
      <div class="garden-screen">
        <canvas id="gardenCanvas" width="${W}" height="${H}" tabindex="0" role="application"
                aria-label="Игра Огород 13. Выбери растение кнопкой 1, 2, 3 или мышью, потом ткни по грядке. Зомбаки идут справа налево."></canvas>
      </div>

      <p class="garden-stats">
        <span>Волна: <b id="gardenWave">1</b></span>
        <span>Выкорчевано: <b id="gardenScore">0</b></span>
        <span>Рекорд: <b id="gardenBest">0</b></span>
      </p>

      <div class="garden-tray" role="group" aria-label="Растения">
        <button type="button" class="seed" id="seedThistle" data-plant="thistle" aria-pressed="false">
          <b>1 · ЧЕРТОПОЛОХ</b><i>стреляет семечками</i>
        </button>
        <button type="button" class="seed" id="seedCork" data-plant="cork" aria-pressed="false">
          <b>2 · ПРОБКА</b><i>просто стена</i>
        </button>
        <button type="button" class="seed" id="seedMush" data-plant="mush" aria-pressed="false">
          <b>3 · ГРИБ</b><i>взрывается по площади</i>
        </button>
        <button type="button" class="seed seed--dig" id="seedDig" data-plant="dig" aria-pressed="false">
          <b>4 · ВЫКОРЧЕВАТЬ</b><i>убрать растение</i>
        </button>
      </div>

      <p class="garden-msg" id="gardenMsg" role="status" aria-live="polite">
        Ставь растения на грядку. Зомбаки идут справа.
      </p>

      <div class="garden-actions">
        <button type="button" class="btn btn--acid btn--sm" id="gardenStart">Новая грядка</button>
        <span class="garden-keys">1 2 3 — растения · 4 — лопата · пробел — пауза</span>
      </div>
    </div>`;

  main.appendChild(section);
  document.dispatchEvent(new CustomEvent('dp:ransom'));

  const canvas = document.getElementById('gardenCanvas');
  const g = canvas.getContext('2d');
  const msg = document.getElementById('gardenMsg');
  const seedBtns = Array.from(section.querySelectorAll('.seed'));

  let actx = null;
  function sfx(kind) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    if (!actx) { try { actx = new C(); } catch (err) { return; } }
    if (actx.state === 'suspended') actx.resume();
    const ctx = actx;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const gn = ctx.createGain();
    o.type = kind === 'shoot' ? 'square' : 'triangle';
    const from = kind === 'shoot' ? 620 : kind === 'boom' ? 180 : 300;
    const to = kind === 'shoot' ? 320 : kind === 'boom' ? 50 : 90;
    o.frequency.setValueAtTime(from, now);
    o.frequency.exponentialRampToValueAtTime(to, now + (kind === 'boom' ? 0.35 : 0.12));
    gn.gain.setValueAtTime(kind === 'boom' ? 0.22 : 0.09, now);
    gn.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'boom' ? 0.4 : 0.14));
    o.connect(gn);
    gn.connect(ctx.destination);
    o.start(now);
    o.stop(now + (kind === 'boom' ? 0.42 : 0.16));
  }

  const G = {
    plants: [],
    zombies: [],
    seeds: [],
    fx: [],
    wave: 1,
    score: 0,
    selected: 'thistle',
    cooldown: { thistle: 0, cork: 0, mush: 0 },
    spawnAcc: 0,
    waveAcc: 0,
    waveGap: 9000,
    state: 'idle',
    t: 0,
    visible: true,
    startAt: 0
  };

  G.best = Number(read(KEY, 0)) || 0;
  document.getElementById('gardenBest').textContent = String(G.best);

  function say(text, mood) {
    msg.textContent = text;
    msg.classList.remove('is-bad', 'is-good');
    if (mood) msg.classList.add(mood);
  }

  function hud() {
    document.getElementById('gardenWave').textContent = String(Math.max(1, G.wave));
    document.getElementById('gardenScore').textContent = String(G.score);
  }

  function reset() {
    G.plants = [];
    G.zombies = [];
    G.seeds = [];
    G.fx = [];
    G.wave = 0;
    G.autoPaused = false;
    G.score = 0;
    G.cooldown = { thistle: 0, cork: 0, mush: 0 };
    G.spawnAcc = 0;
    G.waveAcc = 0;
    G.waveGap = 9000;
    G.t = 0;
    G.state = 'play';
    G.selected = 'thistle';
    hud();
    paintTray();
    say('Первая волна на подходе. Ставь чертополох в первый ряд.', 'is-good');
    loopStart();
  }

  function paintTray() {
    for (const btn of seedBtns) {
      const kind = btn.dataset.plant;
      btn.setAttribute('aria-pressed', String(G.selected === kind));
      const cool = G.cooldown[kind] || 0;
      const total = PLANTS[kind] ? PLANTS[kind].cool : 0;
      const pct = total ? Math.min(100, (cool / total) * 100) : 0;
      btn.style.setProperty('--cd', pct.toFixed(1) + '%');
      btn.disabled = cool > 0;
    }
  }

  function cellFree(col, row) {
    return !G.plants.some((p) => p.col === col && p.row === row);
  }

  function place(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= LANES) return;
    const kind = G.selected;

    if (kind === 'dig') {
      const i = G.plants.findIndex((p) => p.col === col && p.row === row);
      if (i === -1) { say('Тут и так пусто.', 'is-bad'); return; }
      G.plants.splice(i, 1);
      say('Выкорчевали. Грядка чистая.');
      return;
    }

    if (G.cooldown[kind] > 0) {
      say(`${PLANTS[kind].name} ещё не готов. Подожди.`, 'is-bad');
      return;
    }
    if (!cellFree(col, row)) {
      say('Тут уже растёт. Сначала лопата.', 'is-bad');
      return;
    }
    G.plants.push({
      kind, col, row,
      hp: PLANTS[kind].hp,
      maxHp: PLANTS[kind].hp,
      cd: PLANTS[kind].fire ? PLANTS[kind].fire * 0.6 : 0,
      born: G.t,
      hurt: 0
    });
    G.cooldown[kind] = PLANTS[kind].cool;
  }

  function spawnWave() {
    G.wave += 1;
    const kinds = ['normal'];
    if (G.wave >= 3) kinds.push('fast');
    if (G.wave >= 5) kinds.push('tank');
    const count = Math.min(10, 2 + Math.floor(G.wave * 0.8));
    let delay = 0;
    for (let i = 0; i < count; i++) {
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      G.zombies.push({
        kind,
        row: Math.floor(Math.random() * LANES),
        x: W + 30 + delay * 26,
        hp: kind === 'tank' ? 220 + G.wave * 12 : kind === 'fast' ? 45 + G.wave * 4 : 70 + G.wave * 6,
        maxHp: kind === 'tank' ? 220 + G.wave * 12 : kind === 'fast' ? 45 + G.wave * 4 : 70 + G.wave * 6,
        speed: kind === 'tank' ? 12 : kind === 'fast' ? 34 : 19,
        phase: Math.random() * 6,
        eating: null,
        dead: 0
      });
      delay += 0.55 + Math.random() * 0.7;
    }
    say(`Волна ${G.wave}. Зомбаков: ${count}. Держи грядку.`, 'is-bad');
  }

  function boom(x, y, r) {
    G.fx.push({ x, y, r: 6, max: r, life: 1, kind: 'ring' });
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      G.fx.push({
        x, y,
        vx: Math.cos(a) * (60 + Math.random() * 160),
        vy: Math.sin(a) * (60 + Math.random() * 120) - 60,
        r: 2 + Math.random() * 3,
        life: 1,
        kind: 'bit',
        col: Math.random() < 0.5 ? ACID : RED
      });
    }
    sfx('boom');
  }

  function killZombie(z) {
    z.dead = 1;
    G.score += z.kind === 'tank' ? 3 : 1;
    hud();
  }

  /* ------------------------------- Шаг ------------------------------- */
  function step(dt) {
    G.t += dt;

    for (const k in G.cooldown) {
      if (G.cooldown[k] > 0) G.cooldown[k] = Math.max(0, G.cooldown[k] - dt * 1000);
    }

    G.waveAcc += dt * 1000;
    if (G.waveAcc > G.waveGap) {
      G.waveAcc = 0;
      G.waveGap = Math.max(5200, 9000 - G.wave * 320);
      spawnWave();
      hud();
    }

    /* Растения */
    for (const p of G.plants) {
      p.hurt = Math.max(0, p.hurt - dt * 2);
      if (p.kind === 'cork') continue;
      p.cd -= dt * 1000;
      if (p.cd > 0) continue;

      if (p.kind === 'thistle') {
        const target = G.zombies.find((z) => !z.dead && z.row === p.row && z.x > cellX(p.col) - 10);
        if (!target) continue;
        G.seeds.push({ x: cellX(p.col) + 14, y: cellY(p.row) - 6, row: p.row, dmg: PLANTS.thistle.dmg });
        p.cd = PLANTS.thistle.fire;
        sfx('shoot');
      } else if (p.kind === 'mush') {
        const cx = cellX(p.col);
        const cy = cellY(p.row);
        const near = G.zombies.filter((z) => !z.dead && Math.abs(z.x - cx) < CW * 1.6 && Math.abs(cellY(z.row) - cy) < CH * 1.4);
        if (!near.length) continue;
        boom(cx, cy, CW * 1.7);
        for (const z of near) {
          z.hp -= PLANTS.mush.dmg;
          if (z.hp <= 0) killZombie(z);
        }
        G.plants.splice(G.plants.indexOf(p), 1);
        say('Гриб рванул. Грядка стала тише.', 'is-good');
        break;
      }
    }

    /* Семечки */
    for (let i = G.seeds.length - 1; i >= 0; i--) {
      const s = G.seeds[i];
      s.x += 300 * dt;
      const hit = G.zombies.find((z) => !z.dead && z.row === s.row && Math.abs(z.x - s.x) < 20);
      if (hit) {
        hit.hp -= s.dmg;
        G.fx.push({ x: s.x, y: s.y, r: 2, life: 1, kind: 'bit', col: ACID, vx: 0, vy: -40 });
        if (hit.hp <= 0) killZombie(hit);
        G.seeds.splice(i, 1);
        continue;
      }
      if (s.x > W + 20) G.seeds.splice(i, 1);
    }

    /* Зомбаки */
    for (let i = G.zombies.length - 1; i >= 0; i--) {
      const z = G.zombies[i];
      if (z.dead) {
        z.dead += dt * 1.6;
        if (z.dead > 1.6) G.zombies.splice(i, 1);
        continue;
      }
      z.phase += dt * (z.eating ? 9 : 4 + z.speed / 12);

      const col = colAt(z.x - 12);
      const plant = z.x - 12 < HOUSE_X + COLS * CW
        ? G.plants.find((p) => p.row === z.row && p.col === col)
        : null;

      if (plant) {
        z.eating = plant;
        plant.hp -= dt * 34;
        plant.hurt = 1;
        if (plant.hp <= 0) {
          G.plants.splice(G.plants.indexOf(plant), 1);
          z.eating = null;
          say('Зомбак сгрыз растение. Ставь пробку впереди.', 'is-bad');
        }
      } else {
        z.eating = null;
        z.x -= z.speed * dt;
      }

      if (z.x < HOUSE_X - 6) {
        gameOver();
        return;
      }
    }

    /* Эффекты */
    for (let i = G.fx.length - 1; i >= 0; i--) {
      const e = G.fx[i];
      e.life -= dt * (e.kind === 'ring' ? 1.6 : 1.4);
      if (e.kind === 'ring') e.r += (e.max - e.r) * Math.min(1, dt * 6);
      else {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.vy += 320 * dt;
      }
      if (e.life <= 0) G.fx.splice(i, 1);
    }

    paintTray();
  }

  function gameOver() {
    G.state = 'over';
    if (G.score > G.best) {
      G.best = G.score;
      write(KEY, G.best);
      document.getElementById('gardenBest').textContent = String(G.best);
      say(`Огород вытоптан. Но рекорд твой: ${G.score}.`, 'is-good');
    } else {
      say(`Огород вытоптан. Выкорчевано: ${G.score}, рекорд ${G.best}.`, 'is-bad');
    }
    draw();
  }

  /* ------------------------------ Отрисовка -------------------------- */
  function drawPlant(p) {
    const x = cellX(p.col);
    const y = cellY(p.row) + 12;
    const sway = G.state === 'play' ? Math.sin(G.t * 2.4 + p.col + p.row) * 1.6 : 0;

    g.save();
    g.translate(x + sway, y);

    // земля под растением
    g.fillStyle = 'rgba(242,239,230,.10)';
    g.beginPath();
    g.ellipse(0, 6, 24, 8, 0, 0, Math.PI * 2);
    g.fill();

    if (p.hurt > 0) {
      g.strokeStyle = RED;
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(0, 4, 26, 10, 0, 0, Math.PI * 2);
      g.stroke();
    }

    if (p.kind === 'thistle') {
      g.strokeStyle = INK;
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(0, 6);
      g.lineTo(0, -18);
      g.stroke();
      g.fillStyle = ACID;
      g.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (Math.PI / 6) * i;
        const rr = i % 2 ? 13 : 19;
        const px = Math.cos(a) * rr;
        const py = -30 + Math.sin(a) * rr * 0.8;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = INK;
      g.beginPath();
      g.arc(-5, -32, 2.6, 0, Math.PI * 2);
      g.arc(5, -32, 2.6, 0, Math.PI * 2);
      g.fill();
    } else if (p.kind === 'cork') {
      roundRect(g, -20, -34, 40, 42, 10);
      g.fillStyle = PAPER;
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 4;
      g.stroke();
      g.fillStyle = RED;
      g.fillRect(-20, -22, 40, 7);
      g.strokeStyle = 'rgba(10,10,10,.35)';
      g.lineWidth = 2;
      for (let i = -12; i <= 12; i += 12) {
        g.beginPath();
        g.moveTo(i, -16);
        g.lineTo(i, 4);
        g.stroke();
      }
    } else {
      g.strokeStyle = INK;
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(0, 6);
      g.lineTo(0, -10);
      g.stroke();
      g.fillStyle = RED;
      g.beginPath();
      g.ellipse(0, -20, 22, 14, 0, Math.PI, Math.PI * 2);
      g.closePath();
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = PAPER;
      g.beginPath();
      g.arc(-9, -22, 3.6, 0, Math.PI * 2);
      g.arc(7, -17, 2.8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = INK;
      g.beginPath();
      g.arc(-5, -4, 2, 0, Math.PI * 2);
      g.arc(5, -4, 2, 0, Math.PI * 2);
      g.fill();
    }

    // Полоска здоровья
    if (p.hp < p.maxHp) {
      const w = 34;
      g.fillStyle = 'rgba(10,10,10,.6)';
      g.fillRect(-w / 2, -46, w, 4);
      g.fillStyle = p.hp / p.maxHp > 0.4 ? ACID : RED;
      g.fillRect(-w / 2, -46, w * Math.max(0, p.hp / p.maxHp), 4);
    }
    g.restore();
  }

  function drawZombie(z) {
    const y = cellY(z.row) + 16;
    const big = z.kind === 'tank' ? 1.22 : z.kind === 'fast' ? 0.9 : 1;
    g.save();
    g.translate(z.x, y);

    if (z.dead) {
      g.rotate(-1.35 * Math.min(1, z.dead));
      g.globalAlpha = Math.max(0, 1 - z.dead / 1.6);
    } else {
      g.rotate(Math.sin(z.phase) * 0.05);
    }
    g.scale(big, big);

    const swing = z.eating ? Math.sin(z.phase * 1.4) * 7 : Math.sin(z.phase) * 9;

    // Ноги
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-3, 2);
    g.lineTo(-3 + swing, 20);
    g.moveTo(3, 2);
    g.lineTo(3 - swing, 20);
    g.stroke();

    // Куртка
    roundRect(g, -12, -26, 24, 30, 6);
    g.fillStyle = z.kind === 'tank' ? INK : RED;
    g.fill();
    g.strokeStyle = z.kind === 'tank' ? PAPER : INK;
    g.lineWidth = 3;
    g.stroke();

    // Руки вперёд
    g.strokeStyle = ACID;
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(-8, -18);
    g.lineTo(-24, -20 + Math.sin(z.phase) * 3);
    g.moveTo(-8, -12);
    g.lineTo(-26, -10 + Math.cos(z.phase) * 3);
    g.stroke();

    // Голова
    g.beginPath();
    g.arc(0, -36, 11, 0, Math.PI * 2);
    g.fillStyle = ACID;
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.stroke();

    // Ирокез у бегуна
    if (z.kind === 'fast') {
      g.fillStyle = RED;
      g.beginPath();
      g.moveTo(-9, -42);
      g.lineTo(-3, -56);
      g.lineTo(3, -42);
      g.lineTo(8, -54);
      g.lineTo(11, -40);
      g.closePath();
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.stroke();
    }

    // Глаза и рот
    g.fillStyle = INK;
    g.beginPath();
    g.arc(-4, -38, 2.4, 0, Math.PI * 2);
    g.arc(4, -38, 2.4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-5, -30);
    g.lineTo(-1, -27);
    g.lineTo(3, -30);
    g.lineTo(6, -27);
    g.stroke();

    // Булавка на куртке
    g.fillStyle = PAPER;
    g.beginPath();
    g.arc(6, -20, 2, 0, Math.PI * 2);
    g.fill();

    g.restore();

    // Полоска здоровья
    if (!z.dead && z.hp < z.maxHp) {
      const w = 30 * big;
      g.fillStyle = 'rgba(10,10,10,.6)';
      g.fillRect(z.x - w / 2, y - 60 * big, w, 4);
      g.fillStyle = z.hp / z.maxHp > 0.4 ? ACID : RED;
      g.fillRect(z.x - w / 2, y - 60 * big, w * Math.max(0, z.hp / z.maxHp), 4);
    }
  }

  function draw() {
    // Небо и земля
    g.fillStyle = INK;
    g.fillRect(0, 0, W, H);

    g.fillStyle = SOIL;
    g.fillRect(0, Y0 - 10, W, LANES * CH + 16);

    // Полосы грядки
    for (let r = 0; r < LANES; r++) {
      for (let c = 0; c < COLS; c++) {
        g.fillStyle = (r + c) % 2 ? 'rgba(242,239,230,.05)' : 'rgba(242,239,230,.02)';
        g.fillRect(HOUSE_X + c * CW, Y0 + r * CH, CW, CH);
      }
      g.strokeStyle = 'rgba(242,239,230,.16)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(HOUSE_X, Y0 + r * CH + 0.5);
      g.lineTo(HOUSE_X + COLS * CW, Y0 + r * CH + 0.5);
      g.stroke();
    }

    // Дом слева
    g.fillStyle = RED;
    g.fillRect(0, Y0 - 10, HOUSE_X, LANES * CH + 16);
    g.fillStyle = PAPER;
    g.fillRect(HOUSE_X - 6, Y0 - 10, 6, LANES * CH + 16);
    g.save();
    g.translate(14, Y0 + LANES * CH / 2);
    g.rotate(-Math.PI / 2);
    g.fillStyle = PAPER;
    g.font = 'bold 15px "Bebas Neue", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('ВАШ ГАРАЖ', 0, 0);
    g.restore();

    // Забор справа
    g.fillStyle = 'rgba(242,239,230,.14)';
    g.fillRect(HOUSE_X + COLS * CW, Y0 - 10, W - HOUSE_X - COLS * CW, LANES * CH + 16);

    // Выбранное растение — прицел
    g.font = 'bold 14px "Bebas Neue", sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = ACID;
    g.fillText(`ВОЛНА ${Math.max(1, G.wave)}`, 14, 26);
    g.fillStyle = PAPER;
    g.fillText(`ВЫКОРЧЕВАНО ${G.score}`, 110, 26);
    g.fillStyle = 'rgba(242,239,230,.5)';
    g.textAlign = 'right';
    g.fillText(G.selected === 'dig' ? 'ЛОПАТА' : (PLANTS[G.selected] ? PLANTS[G.selected].name : ''), W - 14, 26);

    // Земля под ногами
    g.strokeStyle = 'rgba(245,228,0,.35)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(HOUSE_X, Y0);
    g.lineTo(HOUSE_X, Y0 + LANES * CH);
    g.stroke();

    for (const p of G.plants) drawPlant(p);
    for (const z of G.zombies) drawZombie(z);

    for (const s of G.seeds) {
      g.fillStyle = ACID;
      g.beginPath();
      g.arc(s.x, s.y, 5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.stroke();
    }

    for (const e of G.fx) {
      g.save();
      g.globalAlpha = Math.max(0, e.life);
      if (e.kind === 'ring') {
        g.strokeStyle = RED;
        g.lineWidth = 4;
        g.beginPath();
        g.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        g.stroke();
      } else {
        g.fillStyle = e.col;
        g.beginPath();
        g.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }

    if (G.state === 'idle') {
      g.fillStyle = 'rgba(10,10,10,.8)';
      g.fillRect(0, H / 2 - 54, W, 108);
      g.fillStyle = ACID;
      g.font = 'bold 34px "Permanent Marker", sans-serif';
      g.textAlign = 'center';
      g.fillText('ОГОРОД 13', W / 2, H / 2 - 8);
      g.fillStyle = PAPER;
      g.font = '15px "Special Elite", monospace';
      g.fillText('выбери растение и ткни по грядке', W / 2, H / 2 + 18);
      g.fillText('зомбаки идут справа налево', W / 2, H / 2 + 40);
    } else if (G.state === 'over') {
      g.fillStyle = 'rgba(10,10,10,.82)';
      g.fillRect(0, H / 2 - 56, W, 112);
      g.fillStyle = RED;
      g.font = 'bold 34px "Permanent Marker", sans-serif';
      g.textAlign = 'center';
      g.fillText('ОГОРОД ВЫТОПТАН', W / 2, H / 2 - 4);
      g.fillStyle = PAPER;
      g.font = '16px "Special Elite", monospace';
      g.fillText(`выкорчевано ${G.score} · рекорд ${G.best}`, W / 2, H / 2 + 26);
      g.fillText('жми «НОВАЯ ГРЯДКА»', W / 2, H / 2 + 48);
    } else if (G.state === 'paused') {
      g.fillStyle = 'rgba(10,10,10,.7)';
      g.fillRect(0, H / 2 - 26, W, 52);
      g.fillStyle = ACID;
      g.font = 'bold 26px "Permanent Marker", sans-serif';
      g.textAlign = 'center';
      g.fillText('ПАУЗА. ГРЯДКА ЖДЁТ.', W / 2, H / 2 + 8);
    }
  }

  /* -------------------------------- Цикл ----------------------------- */
  let raf = 0;
  let last = 0;
  let lastDraw = 0;

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!last) last = ts;
    const dt = Math.min(0.04, (ts - last) / 1000);
    last = ts;
    if (ts - lastDraw < 33) return;
    lastDraw = ts;

    if (G.state === 'play') step(dt);
    draw();
  }

  function loopStart() {
    if (raf) return;
    if (!G.visible) return;
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
  function canvasCell(ev) {
    const rect = canvas.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * W;
    const y = ((ev.clientY - rect.top) / rect.height) * H;
    return { col: colAt(x), row: rowAt(y) };
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.focus({ preventScroll: true });
    if (G.state === 'idle' || G.state === 'over') { reset(); return; }
    const cell = canvasCell(e);
    place(cell.col, cell.row);
    draw();
  });

  canvas.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (G.state === 'play') { G.state = 'paused'; say('Пауза.'); }
      else if (G.state === 'paused') { G.state = 'play'; say('Продолжаем.'); }
      draw();
      return;
    }
    const map = { 1: 'thistle', 2: 'cork', 3: 'mush', 4: 'dig' };
    if (map[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      G.selected = map[e.key];
      paintTray();
      draw();
    }
  });

  section.querySelector('.garden-tray').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-plant]');
    if (!btn || btn.disabled) return;
    if (G.state === 'idle' || G.state === 'over') reset();
    G.selected = btn.dataset.plant;
    paintTray();
    say(G.selected === 'dig' ? 'Лопата. Ткни по растению.' : `${PLANTS[G.selected].name}. Ткни по свободной клетке.`);
    draw();
  });

  document.getElementById('gardenStart').addEventListener('click', () => {
    reset();
    draw();
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        G.visible = entry.isIntersecting;
        if (G.visible) {
          if (G.autoPaused) { G.autoPaused = false; G.state = 'play'; }
          if (G.state === 'play' || G.state === 'paused') loopStart();
        } else {
          loopStop();
          // Ушли со страницы — сами поставили на паузу, сами и снимем.
          if (G.state === 'play') { G.state = 'paused'; G.autoPaused = true; draw(); }
        }
      }
    }, { threshold: 0.12 });
    io.observe(section);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) loopStop();
    else if (G.visible && G.state === 'play') loopStart();
  });

  window.addEventListener('resize', () => draw());

  paintTray();
  draw();

  return { reset, getState: () => G.state };
}
