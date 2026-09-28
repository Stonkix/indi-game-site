/* =============================================================================
   DUNGEON PUNK — studio.js
   БИТ-МАШИНА: 16-шаговый секвенсор. Восемь «железок», синтез на месте
   (осцилляторы + шум + waveshaper). Ни сэмплов, ни библиотек, ни чужих сэмпл-паков.

   Это не FL Studio и не пытается им быть: это шаговый секвенсор из подвала.
   Зато честные 16 шагов, свинг, грязь, пресеты и сохранение в localStorage.
   ========================================================================== */

const S_STEPS = 16;
const S_KEY = 'dp.studio.v1';

const S_TRACKS = [
  { id: 'kick', name: 'БОЧКА', hot: false },
  { id: 'snare', name: 'ПЛАСТИК', hot: false },
  { id: 'hat', name: 'ТАРЕЛКА', hot: false },
  { id: 'clap', name: 'ХЛОПОК', hot: true },
  { id: 'tom', name: 'ТОМ', hot: false },
  { id: 'bass', name: 'БАС', hot: true },
  { id: 'chord', name: 'АККОРД', hot: false },
  { id: 'noise', name: 'ШУМ', hot: true }
];

/* Пресеты: 16 символов на дорожку. x — удар, . — тишина */
const S_PRESETS = {
  punk: {
    label: 'ПАНК',
    rows: {
      kick: 'x.......x.......',
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.x.',
      clap: '................',
      tom: '..............x.',
      bass: 'x.x.x.x.x.x.x.x.',
      chord: 'x...x...x...x...',
      noise: '................'
    }
  },
  hardcore: {
    label: 'ХАРДКОР',
    rows: {
      kick: 'x.x.x.x.x.x.x.x.',
      snare: '.x.x.x.x.x.x.x.x',
      hat: 'xxxxxxxxxxxxxxxx',
      clap: '................',
      tom: '..............x.',
      bass: 'xxxxxxxxxxxxxxxx',
      chord: 'x...x...x...x...',
      noise: '................'
    }
  },
  ska: {
    label: 'СКА-ПАНК',
    rows: {
      kick: 'x.......x.......',
      snare: '....x.......x...',
      hat: '.x.x.x.x.x.x.x.x',
      clap: '................',
      tom: '................',
      bass: 'x...x...x...x...',
      chord: '.x.x.x.x.x.x.x.x',
      noise: '................'
    }
  },
  oi: {
    label: 'OI!',
    rows: {
      kick: 'x.......x.......',
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.x.',
      clap: 'x.......x.......',
      tom: '..............x.',
      bass: 'x.x.x.x.x.x.x.x.',
      chord: 'x.x.x.x.x.x.x.x.',
      noise: '................'
    }
  },
  noise: {
    label: 'ПРОСТО ШУМ',
    rows: {
      kick: 'x...............',
      snare: '................',
      hat: '................',
      clap: '................',
      tom: '................',
      bass: '................',
      chord: '................',
      noise: 'x.......x.......'
    }
  }
};

const S_ROOTS = {
  E: 82.41,
  G: 98.00,
  A: 110.00,
  D: 146.83
};

/* ----------------------------------------------------------------------------- */
function sDistCurve(amount) {
  const n = 1024;
  const curve = new Float32Array(n);
  const k = Math.max(0.001, amount);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

function sClamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function sRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

function sWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) { /* ну и ладно */ }
}

function sEmptyGrid() {
  return S_TRACKS.map(() => Array.from({ length: S_STEPS }, () => 0));
}

/* -----------------------------------------------------------------------------
 * initStudio({ getTrackBpm }) — единственная точка входа.
 * Ползунок «грязь» — часть пульта, а вот сам разнос сайта (стили + анимация)
 * живёт в chaos.js и грузится только когда что-то реально сломали.
 * -------------------------------------------------------------------------- */
export function initStudio(opts = {}) {
  const getTrackBpm = typeof opts.getTrackBpm === 'function' ? opts.getTrackBpm : null;

  const root = document.getElementById('studioGrid');
  const playBtn = document.getElementById('studioPlay');
  const bpmRange = document.getElementById('studioBpm');
  const bpmOut = document.getElementById('studioBpmOut');
  const swingRange = document.getElementById('studioSwing');
  const swingOut = document.getElementById('studioSwingOut');
  const volRange = document.getElementById('studioVol');
  const dirtRange = document.getElementById('studioDirt');
  const rootSel = document.getElementById('studioRoot');
  const presetSel = document.getElementById('studioPreset');
  const msg = document.getElementById('studioMsg');
  if (!root || !playBtn) return;

  const saved = sRead(S_KEY, null);
  const st = {
    grid: saved && Array.isArray(saved.grid) ? saved.grid : sEmptyGrid(),
    bpm: saved && saved.bpm ? saved.bpm : 168,
    swing: saved && typeof saved.swing === 'number' ? saved.swing : 0.12,
    volume: saved && typeof saved.volume === 'number' ? saved.volume : 0.75,
    dirt: saved && typeof saved.dirt === 'number' ? saved.dirt : 0.25,
    root: saved && saved.root ? saved.root : 'E',
    playing: false,
    step: 0,
    nextTime: 0,
    timer: 0,
    raf: 0,
    queue: [],
    ctx: null,
    master: null,
    shaper: null,
    noise: null,
    trackGains: [],
    cols: []
  };

  if (st.grid.length !== S_TRACKS.length) st.grid = sEmptyGrid();
  // Перезагрузка — это тоже починка: аварийные 105% не восстанавливаем.
  if (!(st.dirt >= 0 && st.dirt < 1)) st.dirt = 0.25;

  function say(text, mood) {
    if (!msg) return;
    msg.textContent = text;
    msg.classList.remove('is-bad', 'is-good');
    if (mood) msg.classList.add(mood);
  }

  /* ------------------------------ Пульт ------------------------------- */
  function ensureCtx() {
    if (st.ctx) {
      if (st.ctx.state === 'suspended') st.ctx.resume();
      return st.ctx;
    }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    try {
      st.ctx = new C();
    } catch (err) {
      return null;
    }

    st.master = st.ctx.createGain();
    st.master.gain.value = st.volume;

    st.shaper = st.ctx.createWaveShaper();
    st.shaper.curve = sDistCurve(st.dirt * 40);

    const comp = st.ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 6;
    comp.ratio.value = 8;
    comp.attack.value = 0.003;
    comp.release.value = 0.18;

    st.master.connect(st.shaper);
    st.shaper.connect(comp);
    comp.connect(st.ctx.destination);

    st.trackGains = S_TRACKS.map(() => {
      const g = st.ctx.createGain();
      g.gain.value = 1;
      g.connect(st.master);
      return g;
    });

    const len = Math.floor(st.ctx.sampleRate * 0.7);
    st.noise = st.ctx.createBuffer(1, len, st.ctx.sampleRate);
    const chan = st.noise.getChannelData(0);
    for (let i = 0; i < len; i++) chan[i] = Math.random() * 2 - 1;

    return st.ctx;
  }

  function noiseSource(time, dur, gain, dest, hp) {
    const src = st.ctx.createBufferSource();
    src.buffer = st.noise;
    src.loop = true;
    const filter = st.ctx.createBiquadFilter();
    filter.type = hp ? 'highpass' : 'bandpass';
    filter.frequency.value = hp || 1200;
    const g = st.ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(time);
    src.stop(time + dur + 0.02);
  }

  function tone(time, freqFrom, freqTo, dur, gain, dest, type) {
    const o = st.ctx.createOscillator();
    const g = st.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freqFrom, time);
    if (freqTo !== freqFrom) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), time + dur * 0.7);
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g);
    g.connect(dest);
    o.start(time);
    o.stop(time + dur + 0.02);
  }

  const VOICES = {
    kick(time, dest) {
      tone(time, 165, 44, 0.34, 0.95, dest, 'sine');
      noiseSource(time, 0.03, 0.25, dest, 900);
    },
    snare(time, dest) {
      tone(time, 190, 150, 0.14, 0.28, dest, 'triangle');
      noiseSource(time, 0.17, 0.5, dest, 1400);
    },
    hat(time, dest) {
      noiseSource(time, 0.05, 0.24, dest, 7200);
    },
    clap(time, dest) {
      for (let i = 0; i < 3; i++) noiseSource(time + i * 0.011, 0.045, 0.32, dest, 1800);
      noiseSource(time + 0.03, 0.12, 0.22, dest, 1500);
    },
    tom(time, dest) {
      tone(time, 210, 120, 0.26, 0.5, dest, 'sine');
    },
    bass(time, dest) {
      const f = S_ROOTS[st.root] / 2;
      tone(time, f, f, 0.16, 0.5, dest, 'sawtooth');
      tone(time, f * 2, f * 2, 0.12, 0.16, dest, 'square');
    },
    chord(time, dest) {
      const f = S_ROOTS[st.root];
      [1, 1.5, 2].forEach((mult, i) => {
        tone(time, f * mult, f * mult, 0.2, 0.22 / (i + 1), dest, i === 0 ? 'sawtooth' : 'square');
      });
    },
    noise(time, dest) {
      noiseSource(time, 0.3, 0.3, dest, 400);
    }
  };

  /* ----------------------------- Секвенсор ---------------------------- */
  function schedule() {
    if (!st.ctx) return;
    const stepDur = 60 / st.bpm / 4;
    while (st.nextTime < st.ctx.currentTime + 0.12) {
      const s = st.step;
      const swing = s % 2 ? stepDur * st.swing : 0;
      const when = st.nextTime + swing;

      for (let t = 0; t < S_TRACKS.length; t++) {
        if (!st.grid[t] || !st.grid[t][s]) continue;
        const voice = VOICES[S_TRACKS[t].id];
        if (voice) voice(when, st.trackGains[t]);
      }

      st.queue.push({ s, t: when });
      st.nextTime += stepDur;
      st.step = (st.step + 1) % S_STEPS;
    }
  }

  function pumpVisuals() {
    if (!st.ctx) return;
    const now = st.ctx.currentTime;
    while (st.queue.length && st.queue[0].t <= now) {
      setPlayhead(st.queue.shift().s);
    }
    st.raf = requestAnimationFrame(pumpVisuals);
  }

  function setPlayhead(index) {
    for (let s = 0; s < S_STEPS; s++) {
      const cells = st.cols[s] || [];
      for (const cell of cells) cell.classList.toggle('is-now', s === index);
    }
  }

  function start() {
    const ctx = ensureCtx();
    if (!ctx) {
      say('Браузер не дал AudioContext. Бит остался в голове.', 'is-bad');
      return;
    }
    if (st.playing) return;
    st.playing = true;
    st.step = 0;
    st.queue = [];
    st.nextTime = ctx.currentTime + 0.06;
    st.timer = setInterval(schedule, 25);
    st.raf = requestAnimationFrame(pumpVisuals);
    playBtn.textContent = '■ СТОП';
    playBtn.setAttribute('aria-pressed', 'true');
    root.classList.add('is-running');
    say(`Погнали: ${st.bpm} BPM, свинг ${Math.round(st.swing * 100)}%, тоника ${st.root}.`);
  }

  function stop() {
    if (!st.playing) return;
    st.playing = false;
    clearInterval(st.timer);
    cancelAnimationFrame(st.raf);
    st.timer = 0;
    st.raf = 0;
    st.queue = [];
    setPlayhead(-1);
    playBtn.textContent = '▶ ДОЛБИТЬ';
    playBtn.setAttribute('aria-pressed', 'false');
    root.classList.remove('is-running');
  }

  /* ------------------------------- Сетка ------------------------------ */
  function buildGrid() {
    root.innerHTML = '';
    st.cols = Array.from({ length: S_STEPS }, () => []);

    const corner = document.createElement('span');
    corner.className = 'sgrid__corner';
    corner.textContent = 'СТЕП';
    root.appendChild(corner);

    for (let s = 0; s < S_STEPS; s++) {
      const head = document.createElement('span');
      head.className = 'sgrid__head' + (s % 4 === 0 ? ' is-bar' : '');
      head.textContent = String(s + 1);
      root.appendChild(head);
    }

    S_TRACKS.forEach((track, ti) => {
      const label = document.createElement('span');
      label.className = 'srow-head';
      label.textContent = track.name;
      root.appendChild(label);

      for (let s = 0; s < S_STEPS; s++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'step' + (s % 4 === 0 ? ' is-bar' : '') + (track.hot ? ' is-hot' : '');
        cell.dataset.t = String(ti);
        cell.dataset.s = String(s);
        cell.setAttribute('aria-pressed', st.grid[ti][s] ? 'true' : 'false');
        cell.setAttribute('aria-label', `${track.name}, шаг ${s + 1}`);
        root.appendChild(cell);
        st.cols[s].push(cell);
      }
    });
  }

  root.addEventListener('click', (e) => {
    const cell = e.target.closest('.step');
    if (!cell) return;
    const ti = Number(cell.dataset.t);
    const s = Number(cell.dataset.s);
    st.grid[ti][s] = st.grid[ti][s] ? 0 : 1;
    cell.setAttribute('aria-pressed', st.grid[ti][s] ? 'true' : 'false');
    persist();
  });

  function paintGrid() {
    st.cols.forEach((cells, s) => {
      cells.forEach((cell) => {
        const ti = Number(cell.dataset.t);
        cell.setAttribute('aria-pressed', st.grid[ti][s] ? 'true' : 'false');
      });
    });
  }

  function loadPreset(key) {
    const preset = S_PRESETS[key];
    if (!preset) return;
    S_TRACKS.forEach((track, ti) => {
      const pattern = preset.rows[track.id] || '';
      for (let s = 0; s < S_STEPS; s++) {
        st.grid[ti][s] = pattern.charAt(s) === 'x' ? 1 : 0;
      }
    });
    paintGrid();
    persist();
    say(`Пресет «${preset.label}» загружен. Подкрути под себя.`, 'is-good');
  }

  function randomBeat() {
    const density = [3, 2, 2, 1, 0.7, 2, 0.9, 0.6];
    S_TRACKS.forEach((track, ti) => {
      for (let s = 0; s < S_STEPS; s++) {
        const anchor = s % 4 === 0 ? 1.6 : 1;
        st.grid[ti][s] = Math.random() < density[ti] / S_STEPS * 4 * anchor * 0.35 ? 1 : 0;
      }
    });
    if (!st.grid[0].some(Boolean)) st.grid[0][0] = 1;
    if (!st.grid[1].some(Boolean)) st.grid[1][4] = 1;
    paintGrid();
    persist();
    say('Случайный бит. Если не зашло — жми ещё, тут всё честно.', 'is-good');
  }

  function persist() {
    sWrite(S_KEY, {
      grid: st.grid,
      bpm: st.bpm,
      swing: st.swing,
      volume: st.volume,
      dirt: st.dirt,
      root: st.root
    });
  }

  const debouncedPersist = (() => {
    let id = 0;
    return () => {
      clearTimeout(id);
      id = setTimeout(persist, 350);
    };
  })();

  /* ----------------------------- Контролы ----------------------------- */
  function syncBpm() {
    bpmOut.textContent = String(st.bpm);
    bpmRange.value = String(st.bpm);
  }
  function syncSwing() {
    swingOut.textContent = Math.round(st.swing * 100) + '%';
    swingRange.value = String(st.swing);
  }

  /* ----------------------- АВАРИЯ: грязь на 105% ----------------------
     Сам разнос сайта делает chaos.js (он же нужен драке на левой панели).
     Здесь только повод: ползунок у упора. */
  function overdrive() {
    stop();
    import('./chaos.js')
      .then((mod) => {
        const started = mod.trigger({
          code: 'ERR 105%',
          title: 'ВЫКРУТИЛ. СЛОМАЛ.',
          text: 'Грязь на 105% — это уже не звук, это преступление. Осыпались карточки, ' +
                'автоматы, плеер и манифест. Ремонтная бригада из гаража уже выехала.'
        });
        if (started) say('ГРЯЗЬ 105%. Всё посыпалось. Жми «ПОЧИНИТЬ».', 'is-bad');
      })
      .catch(() => say('Сломать не удалось. Ирония.', 'is-bad'));
  }

  // После ремонта возвращаем ползунок в разумное состояние.
  document.addEventListener('dp:repaired', () => {
    st.dirt = 0.25;
    dirtRange.value = '0.25';
    if (st.shaper) st.shaper.curve = sDistCurve(st.dirt * 40);
    paintDirt();
    persist();
    say('Починено. Инструменты целы, грязь снова 25%. Больше не выкручивай.', 'is-good');
  });

  playBtn.addEventListener('click', () => {
    if (st.playing) { stop(); say('Стоп. Тишина — тоже жанр.'); }
    else start();
  });

  bpmRange.addEventListener('input', () => {
    st.bpm = sClamp(Number(bpmRange.value), 50, 220);
    syncBpm();
    debouncedPersist();
  });

  swingRange.addEventListener('input', () => {
    st.swing = sClamp(Number(swingRange.value), 0, 0.6);
    syncSwing();
    debouncedPersist();
  });

  volRange.addEventListener('input', () => {
    st.volume = sClamp(Number(volRange.value), 0, 1);
    if (st.master) st.master.gain.value = st.volume;
    debouncedPersist();
  });

  const dirtPort = document.getElementById('dirtPort');
  const dirtOut = document.getElementById('studioDirtOut');

  function paintDirt() {
    if (dirtOut) dirtOut.textContent = Math.round(st.dirt * 100) + '%';
    if (dirtPort) {
      dirtPort.classList.toggle('is-hot', st.dirt >= 0.85 && st.dirt < 1.049);
      dirtPort.classList.toggle('is-over', st.dirt >= 1.049);
    }
  }

  dirtRange.addEventListener('input', () => {
    st.dirt = sClamp(Number(dirtRange.value), 0, 1.05);
    if (st.shaper) st.shaper.curve = sDistCurve(st.dirt * 40);
    paintDirt();
    debouncedPersist();
    if (st.dirt >= 1.049) overdrive();
  });

  rootSel.addEventListener('change', () => {
    st.root = rootSel.value;
    debouncedPersist();
  });

  presetSel.addEventListener('change', () => {
    if (presetSel.value) loadPreset(presetSel.value);
    presetSel.value = '';
  });

  document.getElementById('studioRandom').addEventListener('click', randomBeat);

  document.getElementById('studioClear').addEventListener('click', () => {
    st.grid = sEmptyGrid();
    paintGrid();
    persist();
    say('Чисто. Ни одного удара. Пока что.');
  });

  document.getElementById('studioSync').addEventListener('click', () => {
    const bpm = getTrackBpm ? getTrackBpm() : null;
    if (!bpm) {
      say('В плеере ничего не играет. Включи трек — и подхвачу его BPM.', 'is-bad');
      return;
    }
    st.bpm = sClamp(Math.round(bpm), 50, 220);
    syncBpm();
    persist();
    say(`Темп взят из трека: ${st.bpm} BPM. Соседи в курсе.`, 'is-good');
  });

  document.getElementById('studioDownload').addEventListener('click', () => {
    const payload = {
      app: 'DUNGEON PUNK — БИТ-МАШИНА',
      bpm: st.bpm,
      swing: st.swing,
      root: st.root,
      steps: S_STEPS,
      tracks: S_TRACKS.map((t) => t.id),
      patterns: S_TRACKS.map((t, i) =>
        st.grid[i].map((v) => (v ? 'x' : '.')).join('')
      )
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dungeon-punk-bit.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    say('Бит скачан как JSON. Передай другу, а не лейблу.', 'is-good');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && st.playing) stop();
  });

  /* ------------------------------ Старт ------------------------------- */
  buildGrid();
  syncBpm();
  syncSwing();
  volRange.value = String(st.volume);
  dirtRange.value = String(st.dirt);
  paintDirt();
  rootSel.value = st.root;
  playBtn.textContent = '▶ ДОЛБИТЬ';
  playBtn.setAttribute('aria-pressed', 'false');
  say('16 шагов, восемь железок. Жми по клеткам или возьми пресет.');
}
