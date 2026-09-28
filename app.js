/* =============================================================================
   DUNGEON PUNK — app.js
   Чистый ES-модуль. Никаких зависимостей, никакой сборки.
   Секции: утилиты, ransom-note, обложки, загрузка данных, каталог, фильтры,
           голосование, плейлист, топ недели, форма, плеер, визуализатор,
           Media Session, горячие клавиши, режим «Громче».
   ========================================================================== */

const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const STORE = {
  votes: 'dp.votes.v1',
  playlist: 'dp.playlist.v1',
  player: 'dp.player.v1',
  submissions: 'dp.submissions.v1',
  loud: 'dp.loud.v1'
};

const TAGS = ['punk', 'hardcore', 'pop-punk', 'ska-punk', 'oi!'];
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    /* приватный режим / переполнение — молча живём дальше */
  }
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry(seed) {
  let t = seed + 0x6d2b79f5;
  return function () {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

/* -----------------------------------------------------------------------------
   1. RANSOM NOTE — каждая буква в своей плашке
   -------------------------------------------------------------------------- */
const RANSOM_FONTS = ['var(--f-logo)', 'var(--f-glitch)', 'var(--f-marker)', 'var(--f-btn)', 'var(--f-type)'];

function buildRansom(el) {
  const text = el.dataset.ransom || el.textContent;
  if (el.dataset.built === '1') return;
  el.dataset.built = '1';
  el.textContent = '';

  const seed = hash(text);
  const rnd = mulberry(seed);
  const frag = document.createDocumentFragment();

  for (const ch of text) {
    const span = document.createElement('span');
    span.className = 'r';
    if (ch === ' ') {
      span.classList.add('is-space');
      span.setAttribute('aria-hidden', 'true');
      span.innerHTML = '&nbsp;';
      frag.appendChild(span);
      continue;
    }
    span.textContent = ch;
    const rot = (rnd() * 8 - 4).toFixed(2);
    const dy = (rnd() * 4 - 2).toFixed(2);
    span.style.setProperty('--rot', rot + 'deg');
    span.style.setProperty('--dy', dy + 'px');
    span.style.fontFamily = RANSOM_FONTS[Math.floor(rnd() * RANSOM_FONTS.length)];
    const schemes = [
      ['var(--ink)', 'var(--paper)'],
      ['var(--ink)', 'var(--acid)'],
      ['var(--red)', 'var(--paper)'],
      ['var(--paper)', 'var(--ink)'],
      ['var(--acid)', 'var(--ink)']
    ];
    const pick = schemes[Math.floor(rnd() * schemes.length)];
    span.style.setProperty('--bg', pick[0]);
    span.style.setProperty('--fg', pick[1]);
    frag.appendChild(span);
  }
  el.appendChild(frag);
}

function ransomAll() {
  qsa('[data-ransom]').forEach(buildRansom);
}

/* -----------------------------------------------------------------------------
   2. ОБЛОЖКИ — оригинальная векторная графика, детерминированная по id
   -------------------------------------------------------------------------- */
function coverMarkup(track) {
  const uid = 'c' + track.id;
  const h = hash(track.id + '|' + track.title + '|' + track.artist);
  const rnd = mulberry(h);
  const variant = h % 6;
  const rot = (rnd() * 8 - 4).toFixed(1);

  const defs = `
    <defs>
      <pattern id="st-${uid}" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <rect width="24" height="24" fill="#0a0a0a"/>
        <rect width="10" height="24" fill="#f5e400"/>
      </pattern>
      <pattern id="dt-${uid}" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
        <circle cx="8" cy="8" r="3.4" fill="#e10600"/>
      </pattern>
      <pattern id="ht-${uid}" width="13" height="13" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="2.1" fill="#f2efe6" opacity=".55"/>
      </pattern>
    </defs>`;

  let art = '';

  if (variant === 0) {
    art = `
      <rect width="300" height="300" fill="url(#st-${uid})"/>
      <circle cx="150" cy="150" r="86" fill="url(#ht-${uid})"/>
      <circle cx="150" cy="150" r="86" fill="none" stroke="#0a0a0a" stroke-width="10"/>
      <path d="M172 34 96 168h46l-24 98 96-140h-52z" fill="#e10600" stroke="#0a0a0a" stroke-width="6"/>`;
  } else if (variant === 1) {
    art = `
      <rect width="300" height="300" fill="#0a0a0a"/>
      <rect x="14" y="14" width="272" height="272" fill="none" stroke="#f2efe6" stroke-width="6" stroke-dasharray="18 10"/>
      <path d="M196 18 78 176h54L108 288 232 112h-64z" fill="#f5e400" stroke="#0a0a0a" stroke-width="7"/>
      <path d="M40 250l14-14M62 250l14-14M84 250l14-14" stroke="#e10600" stroke-width="8"/>`;
  } else if (variant === 2) {
    art = `
      <rect width="300" height="300" fill="#0a0a0a"/>
      <rect x="34" y="70" width="232" height="170" rx="8" fill="#f2efe6" stroke="#0a0a0a" stroke-width="8"/>
      <rect x="52" y="90" width="140" height="130" fill="url(#ht-${uid})" stroke="#0a0a0a" stroke-width="6"/>
      <g fill="#e10600" stroke="#0a0a0a" stroke-width="4">
        <circle cx="228" cy="106" r="12"/><circle cx="228" cy="146" r="12"/><circle cx="228" cy="186" r="12"/>
      </g>
      <rect x="60" y="236" width="60" height="12" fill="#f5e400"/>
      <rect x="130" y="236" width="60" height="12" fill="#f5e400"/>`;
  } else if (variant === 3) {
    art = `
      <rect width="300" height="300" fill="#0a0a0a"/>
      <g fill="none" stroke="#f2efe6" stroke-width="14">
        <ellipse cx="70" cy="90" rx="34" ry="22"/><ellipse cx="70" cy="132" rx="34" ry="22"/>
      </g>
      <g fill="none" stroke="#f5e400" stroke-width="14">
        <ellipse cx="150" cy="150" rx="34" ry="22"/><ellipse cx="150" cy="192" rx="34" ry="22"/>
      </g>
      <g fill="none" stroke="#e10600" stroke-width="14">
        <ellipse cx="230" cy="210" rx="34" ry="22"/><ellipse cx="230" cy="252" rx="34" ry="22"/>
      </g>`;
  } else if (variant === 4) {
    art = `
      <rect width="300" height="300" fill="#0a0a0a"/>
      <path d="M78 300v-88a72 72 0 0 1 144 0v88z" fill="#f2efe6"/>
      <path d="M108 66l12-46 14 30 12-52 14 44 14-34 12 40" fill="none"
            stroke="#e10600" stroke-width="14" stroke-linejoin="miter"/>
      <circle cx="126" cy="180" r="9" fill="#0a0a0a"/>
      <circle cx="176" cy="180" r="9" fill="#0a0a0a"/>
      <path d="M124 224h52" stroke="#0a0a0a" stroke-width="10"/>`;
  } else {
    art = `
      <rect width="300" height="300" fill="#0a0a0a"/>
      <rect x="30" y="88" width="240" height="140" rx="10" fill="#f5e400" stroke="#f2efe6" stroke-width="8"/>
      <circle cx="106" cy="158" r="34" fill="#0a0a0a" stroke="#f2efe6" stroke-width="6"/>
      <circle cx="194" cy="158" r="34" fill="#0a0a0a" stroke="#f2efe6" stroke-width="6"/>
      <circle cx="106" cy="158" r="9" fill="#e10600"/><circle cx="194" cy="158" r="9" fill="#e10600"/>
      <rect x="30" y="70" width="240" height="18" fill="#e10600"/>`;
  }

  return `<svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    ${defs}
    ${art}
    <g transform="rotate(${rot} 244 54)">
      <polygon points="244,26 252,48 275,48 256,62 264,84 244,71 224,84 232,62 213,48 236,48"
               fill="#f2efe6" stroke="#0a0a0a" stroke-width="3"/>
    </g>
  </svg>`;
}

const coverObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const holder = entry.target;
        const track = state.tracks.find((t) => t.id === holder.dataset.coverFor);
        if (track) holder.innerHTML = coverMarkup(track);
        obs.unobserve(holder);
      }
    }, { rootMargin: '250px 0px' })
  : null;

/* -----------------------------------------------------------------------------
   3. СОСТОЯНИЕ
   -------------------------------------------------------------------------- */
const state = {
  tracks: [],
  filtered: [],
  query: '',
  tags: new Set(),
  bpmMax: 210,
  sort: 'new',
  votes: new Set(read(STORE.votes, [])),
  playlist: new Set(read(STORE.playlist, [])),
  queue: [],
  qIndex: -1,
  shuffle: false,
  repeat: 'off',
  currentId: null,
  loud: read(STORE.loud, false),
  unavailable: new Set()
};

const getTrack = (id) => state.tracks.find((t) => t.id === id) || null;
const voteCount = (track) => track.votes + (state.votes.has(track.id) ? 1 : 0);

/* -----------------------------------------------------------------------------
   4. ЗАГРУЗКА ДАННЫХ
   -------------------------------------------------------------------------- */
function skeletonGrid(n = 6) {
  const grid = qs('#trackGrid');
  grid.innerHTML = Array.from({ length: n }, () => `
    <article class="skeleton-card" aria-hidden="true">
      <div class="sk sk--cover"></div>
      <div class="sk sk--line"></div>
      <div class="sk sk--line short"></div>
      <div class="sk sk--line"></div>
    </article>`).join('');
}

async function loadTracks() {
  const grid = qs('#trackGrid');
  skeletonGrid(6);
  try {
    const res = await fetch('tracks.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) throw new Error('Пустой каталог');
    state.tracks = data
      .filter((t) => t && t.id && t.title)
      .map((t) => ({
        id: String(t.id),
        title: String(t.title),
        artist: String(t.artist || 'Неизвестный панк'),
        bpm: Number(t.bpm) || 120,
        duration: Number(t.duration) || 0,
        tags: Array.isArray(t.tags) ? t.tags.map(String) : [],
        src: String(t.src || 'assets/audio/demo.wav'),
        added: String(t.added || ''),
        votes: Number(t.votes) || 0
      }));
  } catch (err) {
    state.tracks = [];
    grid.innerHTML = '';
    grid.setAttribute('aria-busy', 'false');
    const p = qs('#resultCount');
    p.textContent = 'Каталог порвало. Обновите страницу — или тряхните монитор.';
    return;
  }

  const maxBpm = Math.max(...state.tracks.map((t) => t.bpm));
  const bpmRange = qs('#bpmRange');
  bpmRange.max = String(Math.ceil(maxBpm / 2) * 2);
  bpmRange.value = bpmRange.max;
  state.bpmMax = Number(bpmRange.max);
  qs('#bpmOut').textContent = String(state.bpmMax);

  renderTagChips();
  applyFilters();
  renderChart();
  restorePlayerState();
}

/* -----------------------------------------------------------------------------
   5. ФИЛЬТРЫ
   -------------------------------------------------------------------------- */
function renderTagChips() {
  const box = qs('#tagChips');
  box.innerHTML = TAGS.map((tag) => `
    <button type="button" class="chip" data-tag="${esc(tag)}"
            aria-pressed="${state.tags.has(tag) ? 'true' : 'false'}">${esc(tag)}</button>`).join('');
}

function sortTracks(list) {
  const arr = list.slice();
  const byVotes = (t) => voteCount(t);
  switch (state.sort) {
    case 'top': arr.sort((a, b) => byVotes(b) - byVotes(a)); break;
    case 'bpm': arr.sort((a, b) => a.bpm - b.bpm); break;
    case 'duration': arr.sort((a, b) => a.duration - b.duration); break;
    default: arr.sort((a, b) => (a.added < b.added ? 1 : a.added > b.added ? -1 : 0));
  }
  return arr;
}

function applyFilters() {
  const q = state.query.trim().toLowerCase();
  const tags = Array.from(state.tags);

  state.filtered = sortTracks(state.tracks.filter((t) => {
    if (q && !(t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))) return false;
    if (t.bpm > state.bpmMax) return false;
    if (tags.length && !tags.every((tag) => t.tags.includes(tag))) return false;
    return true;
  }));

  renderGrid(state.filtered);
  const out = qs('#resultCount');
  out.textContent = state.filtered.length
    ? `Найдено треков: ${state.filtered.length} из ${state.tracks.length}. Можно громче.`
    : 'Ноль. Тишина.';
  qs('#emptyState').hidden = state.filtered.length > 0;
}

/* -----------------------------------------------------------------------------
   6. КАТАЛОГ
   -------------------------------------------------------------------------- */
function cardMarkup(track) {
  const tags = track.tags.map((t) => `<li class="tag">${esc(t)}</li>`).join('');
  const voted = state.votes.has(track.id);
  const inPlaylist = state.playlist.has(track.id);
  const dead = state.unavailable.has(track.id);
  return `
    <article class="card${state.currentId === track.id ? ' is-playing' : ''}${dead ? ' is-unavailable' : ''}"
             data-id="${esc(track.id)}">
      <span class="card__pin" aria-hidden="true"></span>
      <div class="card__cover" data-cover-for="${esc(track.id)}" aria-hidden="true"></div>
      <span class="card__bpm-badge">${track.bpm} BPM</span>
      ${dead ? '<span class="badge-dead">кассета зажёвана</span>' : ''}
      <div class="card__body">
        <h3 class="card__title">${esc(track.title)}</h3>
        <p class="card__artist">ремикс: <span>${esc(track.artist)}</span></p>
        <ul class="card__meta" aria-label="Характеристики">
          <li>${fmtTime(track.duration)}</li>
          <li>${esc(track.added)}</li>
        </ul>
        <ul class="tags" aria-label="Теги">${tags}</ul>
        <div class="card__actions">
          <button type="button" class="btn btn--acid btn--sm card__play"
                  data-action="play" aria-label="Играть ${esc(track.title)}">
            ${state.currentId === track.id && !audioEl.paused ? '⏸ Пауза' : '▶ Играть'}
          </button>
          <button type="button" class="vote-btn" data-action="vote"
                  aria-pressed="${voted ? 'true' : 'false'}"
                  aria-label="Голосовать за ${esc(track.title)}" title="Один голос на устройство">
            🤘 <span class="vote-btn__count">${voteCount(track)}</span>
          </button>
          <button type="button" class="add-btn" data-action="add"
                  aria-pressed="${inPlaylist ? 'true' : 'false'}"
                  aria-label="Добавить ${esc(track.title)} в плейлист">
            ${inPlaylist ? '✓' : '+'}
          </button>
        </div>
      </div>
    </article>`;
}

function renderGrid(list) {
  const grid = qs('#trackGrid');
  grid.innerHTML = list.map(cardMarkup).join('');
  grid.setAttribute('aria-busy', 'false');

  qsa('.card__cover', grid).forEach((holder) => {
    if (coverObserver) coverObserver.observe(holder);
    else holder.innerHTML = coverMarkup(getTrack(holder.dataset.coverFor));
  });
}

/* Делегирование кликов по каталогу */
function bindGrid() {
  qs('#trackGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const card = btn.closest('.card');
    const id = card && card.dataset.id;
    if (!id) return;
    const action = btn.dataset.action;
    if (action === 'play') {
      if (state.currentId === id && !audioEl.paused) pause();
      else playTrack(id, { fromCatalog: true });
    } else if (action === 'vote') {
      vote(id, btn);
    } else if (action === 'add') {
      togglePlaylist(id, btn);
    }
  });
}

/* -----------------------------------------------------------------------------
   7. ГОЛОСОВАНИЕ (один голос на трек на устройство)
   -------------------------------------------------------------------------- */
function vote(id, btn) {
  if (state.votes.has(id)) {
    btn.classList.remove('hit');
    void btn.offsetWidth;
    btn.classList.add('hit');
    announce('Вы уже ударили по барабану за этот трек. Один голос на устройство.');
    return;
  }
  state.votes.add(id);
  write(STORE.votes, Array.from(state.votes));

  btn.setAttribute('aria-pressed', 'true');
  btn.classList.remove('hit');
  void btn.offsetWidth;
  btn.classList.add('hit');
  const counter = qs('.vote-btn__count', btn);
  if (counter) counter.textContent = String(voteCount(getTrack(id)));
  announce('Голос принят. Барабан цел.');
  renderChart();
}

/* -----------------------------------------------------------------------------
   8. ПЛЕЙЛИСТ
   -------------------------------------------------------------------------- */
function togglePlaylist(id, btn) {
  if (state.playlist.has(id)) {
    state.playlist.delete(id);
    announce('Убрано из плейлиста.');
  } else {
    state.playlist.add(id);
    announce('Добавлено в плейлист.');
  }
  write(STORE.playlist, Array.from(state.playlist));
  if (btn) {
    const on = state.playlist.has(id);
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? '✓' : '+';
  }
  renderQueuePanel();
  if (!state.queue.length) state.queue = Array.from(state.playlist);
}

/* -----------------------------------------------------------------------------
   9. ТОП НЕДЕЛИ
   -------------------------------------------------------------------------- */
function renderChart() {
  const chart = qs('#weekChart');
  const top = state.tracks.slice().sort((a, b) => voteCount(b) - voteCount(a)).slice(0, 10);
  if (!top.length) {
    chart.innerHTML = '<li class="chart__empty">Афиша пустая. Панки ещё спят.</li>';
    return;
  }
  chart.innerHTML = top.map((t) => `
    <li class="chart__row">
      <span class="chart__rank" aria-hidden="true">${top.indexOf(t) + 1}</span>
      <span>
        <span class="chart__name">${esc(t.title)}</span>
        <span class="chart__artist">${esc(t.artist)} · ${t.bpm} BPM · ${t.tags.join(', ')}</span>
      </span>
      <span class="chart__right">
        <span class="chart__votes" aria-label="Голосов: ${voteCount(t)}">🤘 ${voteCount(t)}</span>
        <button type="button" class="chart__play" data-id="${esc(t.id)}"
                aria-label="Играть ${esc(t.title)}">играть</button>
      </span>
    </li>`).join('');
}

function bindChart() {
  qs('#weekChart').addEventListener('click', (e) => {
    const btn = e.target.closest('.chart__play');
    if (btn) playTrack(btn.dataset.id, { fromCatalog: true });
  });
}

/* -----------------------------------------------------------------------------
   10. ФОРМА «ОТПРАВИТЬ РЕМИКС»
   -------------------------------------------------------------------------- */
function bindSubmitForm() {
  const form = qs('#submitForm');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fields = {
      title: qs('#fTitle'),
      artist: qs('#fArtist'),
      url: qs('#fUrl'),
      tags: qs('#fTags')
    };
    const errors = {};
    const title = fields.title.value.trim();
    const artist = fields.artist.value.trim();
    const url = fields.url.value.trim();
    const rights = qs('#fRights').checked;

    if (title.length < 2) errors['fTitle'] = 'Название минимум 2 символа.';
    if (artist.length < 2) errors['fArtist'] = 'Автор минимум 2 символа.';
    let urlOk = false;
    try {
      const u = new URL(url);
      urlOk = /^https?:$/.test(u.protocol);
    } catch (err) { urlOk = false; }
    if (!urlOk) errors['fUrl'] = 'Нужна рабочая ссылка http(s)://…';

    qs('#fTitleErr').textContent = errors.fTitle || '';
    qs('#fArtistErr').textContent = errors.fArtist || '';
    qs('#fUrlErr').textContent = errors.fUrl || '';
    qs('#fRightsErr').textContent = rights ? '' : 'Без этого чекбокса никак: авторы важнее трафика.';

    const firstError = ['fTitle', 'fArtist', 'fUrl'].find((k) => errors[k]) || (rights ? null : 'fRights');
    if (firstError) {
      const el = firstError === 'fRights' ? qs('#fRights') : qs('#' + firstError);
      el.focus();
      qs('#formStatus').textContent = '';
      qs('#formStatus').classList.remove('ok');
      return;
    }

    submitTrack({
      id: 'u' + Date.now().toString(36),
      title,
      artist,
      url,
      tags: fields.tags.value.split(',').map((s) => s.trim()).filter(Boolean),
      rights: true,
      sentAt: new Date().toISOString()
    });

    form.reset();
    qs('#formStatus').textContent = 'Принято! Заявка в ящике. Проверяем вручную, без ботов.';
    qs('#formStatus').classList.add('ok');
    announce('Заявка сохранена локально.');
  });

  qs('#resetFilters').addEventListener('click', () => {
    state.query = '';
    state.tags.clear();
    qs('#bpmRange').value = qs('#bpmRange').max;
    state.bpmMax = Number(qs('#bpmRange').max);
    qs('#bpmOut').textContent = qs('#bpmRange').max;
    state.sort = 'new';
    qs('#sortSelect').value = 'new';
    renderTagChips();
    applyFilters();
  });
}

/*
 * ЗАГЛУШКА ОТПРАВКИ.
 * BACKEND: замените тело функции на реальный запрос, например:
 *   await fetch('/api/tracks', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(payload)
 *   });
 * Тогда localStorage-хранилище ниже можно убрать вместе с renderSubmissions().
 */
function submitTrack(payload) {
  const list = read(STORE.submissions, []);
  list.unshift(payload);
  write(STORE.submissions, list.slice(0, 50));
  renderSubmissions();
}

function renderSubmissions() {
  const list = read(STORE.submissions, []);
  const box = qs('#submittedList');
  const empty = qs('#submittedEmpty');
  empty.hidden = list.length > 0;
  box.innerHTML = list.map((s) => `
    <li>
      <strong>${esc(s.title)}</strong>
      <span class="sub-meta">${esc(s.artist)} · ${esc((s.tags || []).join(', ') || 'без тегов')}</span>
      <span class="sub-meta"><a href="${esc(s.url)}" rel="noopener noreferrer nofollow" target="_blank">${esc(s.url)}</a></span>
    </li>`).join('');
}

/* -----------------------------------------------------------------------------
   11. ПЛЕЕР
   -------------------------------------------------------------------------- */
const audioEl = qs('#audio');
const player = qs('#player');
let audioGraph = null;
let vizData = null;
let vizRaf = null;

function announce(text) {
  qs('#playerStatus').textContent = text;
}

function setupAudioGraph() {
  if (audioGraph) return audioGraph;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try {
    const ctx = new Ctx();
    const source = ctx.createMediaElementSource(audioEl);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.78;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    vizData = new Uint8Array(analyser.frequencyBinCount);
    audioGraph = { ctx, analyser };
  } catch (err) {
    audioGraph = { ctx: null, analyser: null };
  }
  return audioGraph;
}

function setQueueFrom(list, startId) {
  const ids = list.map((t) => t.id);
  if (state.shuffle) {
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
  }
  state.queue = ids;
  state.qIndex = Math.max(0, ids.indexOf(startId));
  renderQueuePanel();
}

function playTrack(id, opts = {}) {
  const track = getTrack(id);
  if (!track) return;

  if (opts.fromCatalog) {
    const base = state.filtered.length ? state.filtered : state.tracks;
    if (!state.queue.includes(id)) setQueueFrom(base, id);
    else state.qIndex = state.queue.indexOf(id);
  }
  if (!state.queue.length) {
    setQueueFrom(state.filtered.length ? state.filtered : state.tracks, id);
  }

  state.currentId = id;
  qs('#playerError').hidden = true;

  if (audioEl.dataset.id !== id) {
    audioEl.dataset.id = id;
    audioEl.src = track.src;
    audioEl.load();
  }

  const graph = setupAudioGraph();
  if (graph && graph.ctx && graph.ctx.state === 'suspended') graph.ctx.resume();

  const attempt = audioEl.play();
  if (attempt && attempt.catch) {
    attempt.catch(() => {
      showPlayerError('Кассету зажевало: браузер не дал запустить звук. Ткните в плеер ещё раз.');
    });
  }
  updateNowPlaying(track);
  updateMediaSession(track);
  refreshPlayingCards();
  renderQueuePanel();
}

function updateNowPlaying(track) {
  qs('#playerTitle').textContent = track.title;
  qs('#playerTitle').title = track.title;
  qs('#playerArtist').textContent = `${track.artist} · ${track.bpm} BPM · ${track.tags.join(', ')}`;
  qs('#playerStatus').textContent = 'Играет: ' + track.title;
}

function refreshPlayingCards() {
  qsa('.card.is-playing').forEach((c) => { if (c.dataset.id !== state.currentId) c.classList.remove('is-playing'); });
  qsa('.card').forEach((c) => {
    if (c.dataset.id === state.currentId) c.classList.add('is-playing');
    const playBtn = qs('.card__play', c);
    if (playBtn) {
      const active = c.dataset.id === state.currentId && !audioEl.paused;
      playBtn.textContent = active ? '⏸ Пауза' : '▶ Играть';
    }
  });
}

function togglePlay() {
  if (!state.currentId) {
    const base = state.filtered.length ? state.filtered : state.tracks;
    if (base.length) playTrack(base[0].id, { fromCatalog: true });
    return;
  }
  if (audioEl.paused) playTrack(state.currentId, {});
  else pause();
}

function pause() {
  audioEl.pause();
}

function step(delta) {
  if (state.queue.length === 0) {
    if (state.currentId) state.queue = [state.currentId];
    else return;
  }
  const dir = delta > 0 ? 1 : -1;
  let next = state.qIndex + dir;
  if (next >= state.queue.length) {
    if (state.repeat === 'all') next = 0;
    else { pause(); return; }
  }
  if (next < 0) next = 0;
  state.qIndex = next;
  playTrack(state.queue[next], { fromCatalog: false });
}

function nextTrack() { step(1); }
function prevTrack() {
  if (audioEl.currentTime > 3) { audioEl.currentTime = 0; return; }
  step(-1);
}

function showPlayerError(msg) {
  const box = qs('#playerError');
  box.hidden = false;
  box.textContent = msg;
  announce(msg);
  if (state.currentId) {
    state.unavailable.add(state.currentId);
    const card = qs(`.card[data-id="${state.currentId}"]`);
    if (card && !qs('.badge-dead', card)) {
      const badge = document.createElement('span');
      badge.className = 'badge-dead';
      badge.textContent = 'кассета зажёвана';
      card.appendChild(badge);
      card.classList.add('is-unavailable');
    }
  }
}

function playerUi() {
  const playing = !audioEl.paused && !audioEl.ended;
  player.classList.toggle('is-playing', playing);

  const playBtn = qs('#playBtn');
  playBtn.textContent = playing ? '⏸' : '▶';
  playBtn.setAttribute('aria-label', playing ? 'Пауза' : 'Играть');

  const muteBtn = qs('#muteBtn');
  const muted = audioEl.muted || audioEl.volume === 0;
  muteBtn.textContent = muted ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-pressed', String(muted));
  muteBtn.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');

  if (playing) startViz();
  else stopViz();

  refreshPlayingCards();
}

function tickProgress() {
  const dur = Number.isFinite(audioEl.duration) ? audioEl.duration : 0;
  const cur = audioEl.currentTime || 0;
  const pct = dur ? (cur / dur) * 100 : 0;
  qs('#seekFill').style.width = pct + '%';
  qs('#seekThumb').style.left = pct + '%';
  qs('#curTime').textContent = fmtTime(cur);
  qs('#durTime').textContent = dur ? fmtTime(dur) : '0:00';
  const seek = qs('#seek');
  seek.setAttribute('aria-valuenow', String(Math.round(pct)));
  seek.setAttribute('aria-valuetext', `${fmtTime(cur)} из ${fmtTime(dur)}`);
}

function seekTo(clientX) {
  const rect = qs('#seek').getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  if (Number.isFinite(audioEl.duration)) {
    audioEl.currentTime = ratio * audioEl.duration;
    tickProgress();
  }
}

function bindPlayer() {
  qs('#playBtn').addEventListener('click', togglePlay);
  qs('#nextBtn').addEventListener('click', nextTrack);
  qs('#prevBtn').addEventListener('click', prevTrack);

  qs('#shuffleBtn').addEventListener('click', (e) => {
    state.shuffle = !state.shuffle;
    e.currentTarget.setAttribute('aria-pressed', String(state.shuffle));
    if (state.currentId) setQueueFrom(state.filtered.length ? state.filtered : state.tracks, state.currentId);
    announce(state.shuffle ? 'Перемешано. Порядок — хаос.' : 'Порядок вернулся.');
  });

  qs('#repeatBtn').addEventListener('click', (e) => {
    state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off';
    const btn = e.currentTarget;
    btn.setAttribute('aria-pressed', String(state.repeat !== 'off'));
    btn.textContent = state.repeat === 'one' ? '↻1' : '↻';
    btn.setAttribute('aria-label',
      state.repeat === 'off' ? 'Повтор выключен' : state.repeat === 'all' ? 'Повтор плейлиста' : 'Повтор одного трека');
    announce('Повтор: ' + (state.repeat === 'off' ? 'выкл' : state.repeat === 'all' ? 'всё подряд' : 'один трек'));
  });

  qs('#muteBtn').addEventListener('click', () => {
    audioEl.muted = !audioEl.muted;
    playerUi();
  });

  const volume = qs('#volume');
  volume.value = String(read('dp.volume.v1', 0.8));
  audioEl.volume = Number(volume.value);
  volume.addEventListener('input', () => {
    audioEl.volume = Number(volume.value);
    audioEl.muted = false;
    write('dp.volume.v1', audioEl.volume);
    playerUi();
  });

  const seek = qs('#seek');
  seek.addEventListener('pointerdown', (e) => {
    seek.setPointerCapture(e.pointerId);
    seekTo(e.clientX);
    const move = (ev) => seekTo(ev.clientX);
    const up = () => {
      seek.removeEventListener('pointermove', move);
      seek.removeEventListener('pointerup', up);
    };
    seek.addEventListener('pointermove', move);
    seek.addEventListener('pointerup', up);
  });
  seek.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { audioEl.currentTime = Math.max(0, audioEl.currentTime - 5); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { audioEl.currentTime += 5; e.preventDefault(); }
    else if (e.key === 'Home') { audioEl.currentTime = 0; e.preventDefault(); }
    else if (e.key === 'End') { if (Number.isFinite(audioEl.duration)) audioEl.currentTime = audioEl.duration; e.preventDefault(); }
    tickProgress();
  });

  qs('#listBtn').addEventListener('click', (e) => {
    const panel = qs('#queuePanel');
    const open = panel.hidden;
    panel.hidden = !open;
    e.currentTarget.setAttribute('aria-expanded', String(open));
  });

  qs('#playerCollapse').addEventListener('click', (e) => {
    const expanded = player.classList.toggle('is-expanded');
    document.body.classList.toggle('player-expanded', expanded);
    e.currentTarget.setAttribute('aria-expanded', String(expanded));
    qs('.player__collapse-icon', e.currentTarget).textContent = expanded ? '▼' : '▲';
    e.currentTarget.querySelector('.sr-only').textContent = expanded ? 'Свернуть плеер' : 'Развернуть плеер';
  });

  qs('#queuePanel').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-play-id]');
    if (!btn) return;
    const id = btn.dataset.playId;
    if (!state.queue.includes(id)) state.queue = state.queue.concat(id);
    state.qIndex = state.queue.indexOf(id);
    playTrack(id, {});
  });

  audioEl.addEventListener('play', playerUi);
  audioEl.addEventListener('pause', () => { playerUi(); savePlayerState(); });
  audioEl.addEventListener('ended', () => {
    if (state.repeat === 'one') { audioEl.currentTime = 0; audioEl.play(); return; }
    nextTrack();
  });
  audioEl.addEventListener('timeupdate', () => {
    tickProgress();
    if (Math.floor(audioEl.currentTime) % 5 === 0) savePlayerState();
  });
  audioEl.addEventListener('loadedmetadata', () => {
    const saved = read(STORE.player, {});
    if (saved.id === state.currentId && saved.time > 1 && saved.time < audioEl.duration - 2) {
      audioEl.currentTime = saved.time;
    }
    tickProgress();
  });
  audioEl.addEventListener('error', () => {
    if (!audioEl.dataset.id) return;
    showPlayerError('Трек не открылся: файл не найден или формат не тот. Проверьте путь в tracks.json.');
  });
  window.addEventListener('beforeunload', savePlayerState);
}

function renderQueuePanel() {
  const qBox = qs('#queueList');
  const pBox = qs('#playlistList');

  qBox.innerHTML = state.queue.length
    ? state.queue.map((id, i) => {
        const t = getTrack(id);
        if (!t) return '';
        return `<li><button type="button" data-play-id="${esc(id)}"
          class="link-btn" ${i === state.qIndex ? 'aria-current="true"' : ''}>
          ${i + 1}. ${esc(t.title)} <span class="sub-meta">${esc(t.artist)}</span></button></li>`;
      }).join('')
    : '<li class="sub-meta">Очередь пустая. Нажми play на любой карточке.</li>';

  const list = Array.from(state.playlist).map(getTrack).filter(Boolean);
  pBox.innerHTML = list.length
    ? list.map((t, i) => `<li><button type="button" data-play-id="${esc(t.id)}" class="link-btn">
        ${i + 1}. ${esc(t.title)} <span class="sub-meta">${esc(t.artist)}</span></button></li>`).join('')
    : '<li class="sub-meta">Плейлист пуст. Жми «+» на карточке.</li>';
}

function savePlayerState() {
  write(STORE.player, { id: state.currentId, time: audioEl.currentTime || 0 });
}

function restorePlayerState() {
  const saved = read(STORE.player, null);
  if (!saved || !saved.id) return;
  const track = getTrack(saved.id);
  if (!track) return;
  state.currentId = track.id;
  audioEl.dataset.id = track.id;
  audioEl.src = track.src;
  qs('#playerTitle').textContent = track.title;
  qs('#playerArtist').textContent = `${track.artist} · ${track.bpm} BPM · нажми ▶, чтобы продолжить`;
  qs('#playerStatus').textContent = 'Последний трек: ' + track.title;
  renderQueuePanel();
}

/* -----------------------------------------------------------------------------
   12. ВИЗУАЛИЗАТОР («штрихи маркером»)
   -------------------------------------------------------------------------- */
const vizCanvas = qs('#viz');

function drawVizStatic() {
  const g = vizCanvas.getContext('2d');
  const w = vizCanvas.width;
  const h = vizCanvas.height;
  g.fillStyle = '#0a0a0a';
  g.fillRect(0, 0, w, h);
  const bars = 44;
  for (let i = 0; i < bars; i++) {
    const bh = 6 + 10 * Math.abs(Math.sin(i * 0.42));
    const x = (i + 0.5) * (w / bars);
    g.save();
    g.translate(x, h - 4);
    g.rotate((i % 2 ? 1 : -1) * 0.05);
    g.fillStyle = i % 3 === 0 ? '#e10600' : '#f5e400';
    g.fillRect(-2, -bh, 4, bh);
    g.restore();
  }
}

function drawVizFrame() {
  const g = vizCanvas.getContext('2d');
  const w = vizCanvas.width;
  const h = vizCanvas.height;
  g.fillStyle = '#0a0a0a';
  g.fillRect(0, 0, w, h);

  const analyser = audioGraph && audioGraph.analyser;
  if (analyser && vizData) analyser.getByteFrequencyData(vizData);

  const bars = 44;
  for (let i = 0; i < bars; i++) {
    let v = 0.04;
    if (analyser && vizData) {
      const idx = Math.floor((i / bars) * vizData.length * 0.72);
      v = vizData[idx] / 255;
    }
    const bh = Math.max(3, v * (h - 10));
    const x = (i + 0.5) * (w / bars);
    g.save();
    g.translate(x, h - 5);
    g.rotate((i % 2 ? 1 : -1) * 0.05);
    g.fillStyle = i % 3 === 0 ? '#e10600' : (v > 0.6 ? '#f2efe6' : '#f5e400');
    g.fillRect(-2.2, -bh, 4.4, bh);
    g.restore();
  }
}

function startViz() {
  if (REDUCED) { drawVizStatic(); return; }
  if (vizRaf) return;
  const loop = () => {
    drawVizFrame();
    if (audioGraph && audioGraph.analyser) vizRaf = requestAnimationFrame(loop);
    else vizRaf = null;
  };
  vizRaf = requestAnimationFrame(loop);
}

function stopViz() {
  if (vizRaf) cancelAnimationFrame(vizRaf);
  vizRaf = null;
  drawVizStatic();
}

/* -----------------------------------------------------------------------------
   13. MEDIA SESSION
   -------------------------------------------------------------------------- */
function artworkDataUrl(track) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const h = hash(track.id);
  const rnd = mulberry(h);
  g.fillStyle = '#0a0a0a';
  g.fillRect(0, 0, 256, 256);
  for (let i = -256; i < 256; i += 26) {
    g.save();
    g.translate(0, 0);
    g.rotate(35 * Math.PI / 180);
    g.fillStyle = h % 3 === 0 ? '#f5e400' : '#e10600';
    g.fillRect(i, -300, 11, 700);
    g.restore();
  }
  g.fillStyle = '#0a0a0a';
  g.fillRect(24, 24, 208, 208);
  g.fillStyle = '#f2efe6';
  g.font = 'bold 92px Impact, sans-serif';
  g.textAlign = 'center';
  g.fillText('DP', 128, 130);
  g.strokeStyle = '#f5e400';
  g.lineWidth = 8;
  g.strokeRect(28 + Math.round(rnd() * 8), 168, 200, 22);
  return c.toDataURL('image/png');
}

function updateMediaSession(track) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: 'DUNGEON PUNK — гаражный каталог',
      artwork: [
        { src: artworkDataUrl(track), sizes: '256x256', type: 'image/png' }
      ]
    });
    navigator.mediaSession.setActionHandler('play', togglePlay);
    navigator.mediaSession.setActionHandler('pause', pause);
    navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
    navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
    navigator.mediaSession.setActionHandler('seekbackward', () => { audioEl.currentTime = Math.max(0, audioEl.currentTime - 10); });
    navigator.mediaSession.setActionHandler('seekforward', () => { audioEl.currentTime += 10; });
  } catch (err) {
    /* некоторые браузеры капризны — не критично */
  }
}

/* -----------------------------------------------------------------------------
   14. ГОРЯЧИЕ КЛАВИШИ
   -------------------------------------------------------------------------- */
function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function bindHotkeys() {
  document.addEventListener('keydown', (e) => {
    if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('#seek')) return;
    // На кнопках и ссылках пробел должен работать по-родному (клик), не перехватываем.
    if (e.key === ' ' && e.target.closest && e.target.closest('button, a, summary, [role="button"]')) return;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft': audioEl.currentTime = Math.max(0, audioEl.currentTime - 5); tickProgress(); e.preventDefault(); break;
      case 'ArrowRight': audioEl.currentTime += 5; tickProgress(); e.preventDefault(); break;
      case 'ArrowUp':
        audioEl.volume = Math.min(1, audioEl.volume + 0.05);
        audioEl.muted = false;
        qs('#volume').value = String(audioEl.volume);
        playerUi(); e.preventDefault(); break;
      case 'ArrowDown':
        audioEl.volume = Math.max(0, audioEl.volume - 0.05);
        qs('#volume').value = String(audioEl.volume);
        playerUi(); e.preventDefault(); break;
      case 'n': case 'N': case 'ш': case 'Ш': nextTrack(); break;
      case 'p': case 'P': case 'з': case 'З': prevTrack(); break;
      case 'm': case 'M': case 'ь': case 'Ь':
        audioEl.muted = !audioEl.muted;
        playerUi();
        announce(audioEl.muted ? 'Звук выключен.' : 'Звук включён.');
        break;
      default: break;
    }
  });
}

/* -----------------------------------------------------------------------------
   15. РЕЖИМ «ТИШЕ / ГРОМЧЕ» (только визуальный эффект)
   -------------------------------------------------------------------------- */
function applyLoud() {
  document.body.classList.toggle('is-loud', state.loud);
  const sw = qs('#loudSwitch');
  sw.setAttribute('aria-pressed', String(state.loud));
  sw.title = state.loud
    ? 'Сейчас: громче (визуальный режим). Нажми, чтобы утихомирить.'
    : 'Сейчас: тише (визуальный режим). Нажми, чтобы стало громче.';
}

function bindLoud() {
  applyLoud();
  qs('#loudSwitch').addEventListener('click', () => {
    state.loud = !state.loud;
    write(STORE.loud, state.loud);
    applyLoud();
    announce(state.loud ? 'Режим «Громче» включён. Громкость звука не изменилась.' : 'Режим «Тише».');
  });
}

/* -----------------------------------------------------------------------------
   16. ИНИЦИАЛИЗАЦИЯ
   -------------------------------------------------------------------------- */
function bindFilters() {
  qs('#searchInput').addEventListener('input', debounce((e) => {
    state.query = e.target.value;
    applyFilters();
  }, 160));

  qs('#tagChips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const tag = chip.dataset.tag;
    if (state.tags.has(tag)) state.tags.delete(tag);
    else state.tags.add(tag);
    chip.setAttribute('aria-pressed', String(state.tags.has(tag)));
    applyFilters();
  });

  const bpmRange = qs('#bpmRange');
  const onBpm = () => {
    state.bpmMax = Number(bpmRange.value);
    qs('#bpmOut').textContent = bpmRange.value;
    applyFilters();
  };
  bpmRange.addEventListener('input', onBpm);
  bpmRange.addEventListener('change', onBpm);

  qs('#sortSelect').addEventListener('change', (e) => {
    state.sort = e.target.value;
    applyFilters();
  });
}

/*
 * Бит-машина подгружается лениво: модуль ~18 КБ и нужен только тем, кто доскроллит.
 * Так основная страница остаётся в рамках бюджета, а секвенсор приезжает заранее —
 * за 400 px до появления блока на экране.
 */
function lazyLoadStudio() {
  const section = qs('#studio');
  const boot = () => {
    import('./studio.js')
      .then((mod) => mod.initStudio({
        getTrackBpm: () => {
          const track = getTrack(state.currentId);
          return track ? track.bpm : null;
        }
      }))
      .catch(() => {
        const msg = qs('#studioMsg');
        if (msg) msg.textContent = 'Бит-машина не загрузилась. Обновите страницу — или сыграйте руками.';
      });
  };

  if (!section || !('IntersectionObserver' in window)) { boot(); return; }
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    boot();
  }, { rootMargin: '400px 0px' });
  io.observe(section);
}

/* Аркада: три автомата, ~30 КБ. Тянем, когда читатель подошёл к блоку. */
function lazyLoadArcade() {
  const boot = () => import('./arcade.js')
    .then((mod) => mod.createArcade({
      read, write, getTrack, isTypingTarget,
      getState: () => state
    }))
    .catch(() => { /* автоматы сломались, бывает */ });

  const anchor = qs('#arcade');
  if (!anchor || !('IntersectionObserver' in window)) { boot(); return; }
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    boot();
  }, { rootMargin: '500px 0px' });
  io.observe(anchor);
}

/* Декор и игры — отдельными модулями, по требованию: панели, заведения
   в шапке, игры внизу. Нижние ждём до подвала, остальное тянем сразу. */
function lazyLoadDecor() {
  const go = (file, fn) => import(file).then((mod) => mod[fn]()).catch(() => { /* декор, не критично */ });

  go('./rails.js', 'createRails');
  go('./gradus.js', 'createGradus');
  go('./sushi.js', 'createSushi');

  // Огород и «Ночная смена» под ним — строго по порядку, чтобы не поменялись местами.
  // Три нижних раздела — строго по очереди, чтобы не путались местами.
  const bootGarden = () => go('./garden.js', 'createGarden')
    .then(() => go('./shift.js', 'createShift'))
    .then(() => go('./kart.js', 'createKart'));
  const footer = qs('.site-footer');
  if (!footer || !('IntersectionObserver' in window)) { bootGarden(); return; }
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    bootGarden();
  }, { rootMargin: '800px 0px' });
  io.observe(footer);
}

function init() {
  ransomAll();
  qs('#year').textContent = String(new Date().getFullYear());

  bindFilters();
  bindGrid();
  bindChart();
  bindSubmitForm();
  bindPlayer();
  bindHotkeys();
  bindLoud();
  lazyLoadArcade();
  lazyLoadStudio();
  lazyLoadDecor();
  renderSubmissions();
  renderQueuePanel();
  drawVizStatic();
  playerUi();

  audioEl.addEventListener('volumechange', playerUi);

  const setRandom = () => {
    const base = state.filtered.length ? state.filtered : state.tracks;
    if (!base.length) return;
    let pick = base[Math.floor(Math.random() * base.length)];
    if (base.length > 1 && pick.id === state.currentId) pick = base[(base.indexOf(pick) + 1) % base.length];
    setQueueFrom(base, pick.id);
    playTrack(pick.id, { fromCatalog: false });
  };
  qs('#randomTrackBtn').addEventListener('click', setRandom);

  window.addEventListener('resize', debounce(drawVizStatic, 250));

  // Ленивые модули добавляют заголовки сами — режем им буквы по запросу.
  document.addEventListener('dp:ransom', ransomAll);

  // Пасхалка: «Грязь 105%» в бит-машине роняет сайт. Гасим звук, пока не починили.
  document.addEventListener('dp:overdrive', () => {
    pause();
    announce('Авария: грязь 105%. Ремонт в процессе.');
    DIG.stop();
    FLY.stop();
    DRUMS.stop();
  });
  document.addEventListener('dp:repaired', () => {
    announce('Техника в строю. Можно снова шуметь.');
  });

  loadTracks();
}

init();
