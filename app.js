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
   15.1. ДВОРОВЫЕ АВТОМАТЫ
   Два оригинальных мини-гейма: слева «Шахта 13» (копатель), справа «Панк-птица».
   Всё своё: ни чужих ассетов, ни чужих названий. Луп крутится только когда
   блок видим и игра идёт — чтобы не жечь батарею и Lighthouse.
   -------------------------------------------------------------------------- */
const BEST_KEY = 'dp.arcade.best.v1';

function makeLoop(game, step, draw) {
  let raf = 0;
  let last = 0;
  game.raf = 0;
  game.visible = true;

  const tick = (ts) => {
    if (!last) last = ts;
    const dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;
    step(dt);
    draw();
    if (game.visible && game.state === 'play') {
      raf = requestAnimationFrame(tick);
      game.raf = raf;
    } else {
      raf = 0;
      game.raf = 0;
      last = 0;
    }
  };

  game.start = () => {
    if (raf || !game.visible || game.state !== 'play') return;
    last = 0;
    raf = requestAnimationFrame(tick);
    game.raf = raf;
  };
  game.stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    game.raf = 0;
    last = 0;
  };
}

function watchVisibility(el, game) {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      game.visible = entry.isIntersecting;
      if (!game.visible) game.stop();
      else if (typeof game.resume === 'function') game.resume();
    }
  }, { threshold: 0.15 });
  io.observe(el);
}

function say(el, text, mood) {
  el.textContent = text;
  el.classList.remove('is-bad', 'is-good');
  if (mood) el.classList.add(mood);
}

/* ---------------------------- ЛЕВО: ШАХТА 13 ------------------------------ */
const DIG = {
  canvas: qs('#diggerCanvas'),
  cols: 14, rows: 9, cell: 28,
  grid: [], px: 0, py: 0,
  got: 0, total: 0, score: 0, level: 1,
  state: 'idle', rockAcc: 0
};

const T_EMPTY = 0, T_DIRT = 1, T_ROCK = 2, T_ORE = 3, T_EXIT = 4;

function digHud() {
  qs('#diggerOre').textContent = `${DIG.got}/${DIG.total}`;
  qs('#diggerScore').textContent = String(DIG.score);
  qs('#diggerLevel').textContent = String(DIG.level);
}

function digBuild() {
  const { rows, cols } = DIG;
  DIG.grid = Array.from({ length: rows }, () => Array(cols).fill(T_DIRT));
  DIG.px = 0;
  DIG.py = 0;
  DIG.grid[0][0] = T_EMPTY;
  DIG.grid[0][1] = T_EMPTY;
  DIG.grid[1][0] = T_EMPTY;

  const taken = new Set(['0,0', '0,1', '1,0']);
  const freeCell = () => {
    for (let tries = 0; tries < 200; tries++) {
      const x = 1 + Math.floor(Math.random() * (cols - 1));
      const y = 1 + Math.floor(Math.random() * (rows - 1));
      const key = x + ',' + y;
      if (taken.has(key)) continue;
      taken.add(key);
      return { x, y };
    }
    return null;
  };

  DIG.total = Math.min(9, 4 + DIG.level);
  DIG.got = 0;
  for (let i = 0; i < DIG.total; i++) {
    const c = freeCell();
    if (c) DIG.grid[c.y][c.x] = T_ORE;
  }
  const rocks = Math.min(16, 7 + DIG.level * 2);
  for (let i = 0; i < rocks; i++) {
    const c = freeCell();
    if (c) DIG.grid[c.y][c.x] = T_ROCK;
  }

  DIG.grid[rows - 1][cols - 1] = T_EXIT;
  taken.add((cols - 1) + ',' + (rows - 1));
  digHud();
}

function digRestart(hard) {
  if (hard) {
    DIG.level = 1;
    DIG.score = 0;
  }
  digBuild();
  DIG.state = 'play';
  DIG.rockAcc = 0;
  qs('#diggerMsg').classList.remove('is-bad', 'is-good');
  say(qs('#diggerMsg'), 'Стрелки — копать. Камни падают. Люк — внизу справа.');
  qs('.cab--digger').classList.add('is-live');
  DIG.draw();
  DIG.start();
}

function digFail(text) {
  if (DIG.state === 'dead') return;
  DIG.state = 'dead';
  DIG.score = Math.max(0, DIG.score - 40);
  digHud();
  say(qs('#diggerMsg'), text, 'is-bad');
  DIG.draw();
  setTimeout(() => {
    if (DIG.state !== 'dead') return;
    DIG.level = 1;
    DIG.score = 0;
    digRestart(true);
  }, 1500);
}

function digMove(dx, dy) {
  if (DIG.state === 'idle') digRestart(false);
  if (DIG.state !== 'play') return;
  const nx = DIG.px + dx;
  const ny = DIG.py + dy;
  if (nx < 0 || ny < 0 || nx >= DIG.cols || ny >= DIG.rows) return;

  const tile = DIG.grid[ny][nx];
  if (tile === T_ROCK) {
    say(qs('#diggerMsg'), 'Камень не копается. Обойди или подкопай снизу.', 'is-bad');
    return;
  }
  if (tile === T_EXIT) {
    if (DIG.got < DIG.total) {
      say(qs('#diggerMsg'), `Люк заперт. Осталось медяков: ${DIG.total - DIG.got}.`, 'is-bad');
      return;
    }
    DIG.score += 100;
    DIG.level += 1;
    digBuild();
    say(qs('#diggerMsg'), `Уровень ${DIG.level}. Глубже, темнее, злее.`, 'is-good');
    DIG.draw();
    return;
  }

  if (tile === T_ORE) {
    DIG.got += 1;
    DIG.score += 25;
    say(qs('#diggerMsg'), 'Медяк в кармане. +25.');
  } else {
    DIG.score += 5;
  }
  DIG.grid[ny][nx] = T_EMPTY;
  DIG.px = nx;
  DIG.py = ny;
  digHud();
  DIG.draw();
}

function digStep(dt) {
  DIG.rockAcc += dt;
  if (DIG.rockAcc < 0.28) return;
  DIG.rockAcc = 0;

  for (let y = DIG.rows - 2; y >= 0; y--) {
    for (let x = 0; x < DIG.cols; x++) {
      if (DIG.grid[y][x] !== T_ROCK) continue;
      if (x === DIG.px && y + 1 === DIG.py) {
        DIG.grid[y][x] = T_EMPTY;
        digFail('Камнем по ирокезу. Шахта завалена.');
        return;
      }
      if (DIG.grid[y + 1][x] === T_EMPTY) {
        DIG.grid[y][x] = T_EMPTY;
        DIG.grid[y + 1][x] = T_ROCK;
      }
    }
  }
}

function digStar(g, cx, cy, r, color) {
  g.save();
  g.translate(cx, cy);
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.45 : r;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    if (i === 0) g.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.strokeStyle = '#0a0a0a';
  g.lineWidth = 2;
  g.stroke();
  g.restore();
}

function digDraw() {
  const g = DIG.canvas.getContext('2d');
  const c = DIG.cell;
  const w = DIG.cols * c;
  const h = DIG.rows * c;

  g.fillStyle = '#f2efe6';
  g.fillRect(0, 0, w, h);

  for (let y = 0; y < DIG.rows; y++) {
    for (let x = 0; x < DIG.cols; x++) {
      const t = DIG.grid[y][x];
      const px = x * c;
      const py = y * c;

      if (t === T_DIRT) {
        g.fillStyle = '#0a0a0a';
        g.fillRect(px + 1, py + 1, c - 1.5, c - 1.5);
        g.fillStyle = 'rgba(242,239,230,.18)';
        g.fillRect(px + 4, py + 5, 2, 2);
        g.fillRect(px + c - 8, py + c - 9, 2, 2);
      } else if (t === T_ROCK) {
        g.strokeStyle = 'rgba(10,10,10,.15)';
        g.lineWidth = 1;
        g.strokeRect(px + 0.5, py + 0.5, c - 1, c - 1);
        g.beginPath();
        g.arc(px + c / 2, py + c / 2, c / 2 - 4, 0, Math.PI * 2);
        g.fillStyle = '#e10600';
        g.fill();
        g.strokeStyle = '#0a0a0a';
        g.lineWidth = 2;
        g.stroke();
      } else if (t === T_ORE) {
        g.strokeStyle = 'rgba(10,10,10,.15)';
        g.lineWidth = 1;
        g.strokeRect(px + 0.5, py + 0.5, c - 1, c - 1);
        digStar(g, px + c / 2, py + c / 2, c / 2 - 3, '#f5e400');
      } else if (t === T_EXIT) {
        g.fillStyle = '#f5e400';
        g.fillRect(px + 1, py + 1, c - 2, c - 2);
        g.strokeStyle = '#0a0a0a';
        g.lineWidth = 2;
        for (let i = -c; i < c; i += 6) {
          g.beginPath();
          g.moveTo(px + i, py + c);
          g.lineTo(px + i + c, py);
          g.stroke();
        }
        g.strokeRect(px + 1, py + 1, c - 2, c - 2);
      } else {
        g.strokeStyle = 'rgba(10,10,10,.10)';
        g.lineWidth = 1;
        g.strokeRect(px + 0.5, py + 0.5, c - 1, c - 1);
      }
    }
  }

  const bx = DIG.px * c;
  const by = DIG.py * c;
  g.fillStyle = '#0a0a0a';
  g.fillRect(bx + 7, by + 12, c - 14, c - 14);
  g.fillStyle = '#f5e400';
  g.beginPath();
  g.moveTo(bx + c / 2 - 6, by + 12);
  g.lineTo(bx + c / 2, by + 2);
  g.lineTo(bx + c / 2 + 6, by + 12);
  g.closePath();
  g.fill();
  g.fillStyle = '#f2efe6';
  g.fillRect(bx + 10, by + 15, 3, 3);
  g.fillRect(bx + c - 13, by + 15, 3, 3);
  g.fillRect(bx + 10, by + c - 8, 3, 3);
  g.fillRect(bx + c - 13, by + c - 8, 3, 3);

  if (DIG.state === 'dead') {
    g.fillStyle = 'rgba(10,10,10,.72)';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e10600';
    g.font = 'bold 34px "Permanent Marker", sans-serif';
    g.textAlign = 'center';
    g.fillText('ЗАВАЛИЛО', w / 2, h / 2 - 4);
    g.fillStyle = '#f2efe6';
    g.font = '16px "Special Elite", monospace';
    g.fillText('новая шахта через секунду…', w / 2, h / 2 + 26);
  } else if (DIG.state === 'idle') {
    g.fillStyle = 'rgba(10,10,10,.78)';
    g.fillRect(0, h / 2 - 42, w, 84);
    g.fillStyle = '#f5e400';
    g.font = 'bold 30px "Permanent Marker", sans-serif';
    g.textAlign = 'center';
    g.fillText('ШАХТА 13', w / 2, h / 2 - 4);
    g.fillStyle = '#f2efe6';
    g.font = '15px "Special Elite", monospace';
    g.fillText('жми ← ↓ → (или W A S D) и копай', w / 2, h / 2 + 24);
  }
}

makeLoop(DIG, digStep, digDraw);
DIG.draw = digDraw;
DIG.resume = () => { if (DIG.state === 'play') DIG.start(); };

/* --------------------------- ПРАВО: ПАНК-ПТИЦА ---------------------------- */
const FLY = {
  canvas: qs('#flyerCanvas'),
  w: 360, h: 252,
  birdX: 86, r: 12,
  y: 120, vy: 0,
  pipes: [],
  score: 0, state: 'idle', acc: 0
};

FLY.best = Number(read(BEST_KEY, 0)) || 0;
qs('#flyerBest').textContent = String(FLY.best);

function flyReset() {
  FLY.y = FLY.h * 0.42;
  FLY.vy = -220;
  FLY.pipes = [];
  FLY.score = 0;
  FLY.acc = 0;
  FLY.state = 'play';
  qs('#flyerScore').textContent = '0';
  qs('.cab--flyer').classList.add('is-live');
  say(qs('#flyerMsg'), 'Пробел / ↑ — взмах. Не влети в усилители.');
}

function flyFlap() {
  if (FLY.state === 'idle' || FLY.state === 'dead') {
    flyReset();
    FLY.draw();
    FLY.start();
    return;
  }
  FLY.vy = -430;
}

function flyFail() {
  if (FLY.state !== 'play') return;
  FLY.state = 'dead';
  if (FLY.score > FLY.best) {
    FLY.best = FLY.score;
    write(BEST_KEY, FLY.best);
    qs('#flyerBest').textContent = String(FLY.best);
    say(qs('#flyerMsg'), `Новый рекорд: ${FLY.best}! Но усилители сильнее.`, 'is-good');
  } else {
    say(qs('#flyerMsg'), `Влетел в усилитель. Счёт ${FLY.score}. Пробел — заново.`, 'is-bad');
  }
  FLY.draw();
}

function flyStep(dt) {
  FLY.vy += 1500 * dt;
  FLY.y += FLY.vy * dt;

  if (FLY.y < FLY.r) { FLY.y = FLY.r; FLY.vy = 0; }
  if (FLY.y > FLY.h - FLY.r - 14) { FLY.y = FLY.h - FLY.r - 14; flyFail(); return; }

  FLY.acc += dt;
  const gapH = 92;
  if (FLY.acc > 1.35) {
    FLY.acc = 0;
    const gapY = 34 + Math.random() * (FLY.h - gapH - 78);
    FLY.pipes.push({ x: FLY.w + 20, gapY, scored: false });
  }

  const speed = 158 * dt;
  for (const p of FLY.pipes) p.x -= speed;
  FLY.pipes = FLY.pipes.filter((p) => p.x > -60);

  for (const p of FLY.pipes) {
    if (p.x + 48 < FLY.birdX - FLY.r && !p.scored) {
      p.scored = true;
      FLY.score += 1;
      qs('#flyerScore').textContent = String(FLY.score);
    }
    const hitX = FLY.birdX + FLY.r > p.x && FLY.birdX - FLY.r < p.x + 48;
    const inGap = FLY.y > p.gapY && FLY.y < p.gapY + gapH;
    if (hitX && !inGap) { flyFail(); return; }
  }
}

function flyDraw() {
  const g = FLY.canvas.getContext('2d');
  const w = FLY.w;
  const h = FLY.h;

  g.fillStyle = '#0a0a0a';
  g.fillRect(0, 0, w, h);

  g.strokeStyle = 'rgba(242,239,230,.10)';
  g.lineWidth = 1;
  for (let x = 0; x < w; x += 24) {
    g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, h); g.stroke();
  }
  for (let y = 0; y < h; y += 24) {
    g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); g.stroke();
  }

  for (const p of FLY.pipes) {
    const gapH = 92;
    const drawStack = (px, py, ph) => {
      g.fillStyle = '#f5e400';
      g.fillRect(px, py, 48, ph);
      g.strokeStyle = '#0a0a0a';
      g.lineWidth = 3;
      g.strokeRect(px + 1.5, py + 1.5, 45, ph - 3);
      g.fillStyle = '#e10600';
      g.fillRect(px - 4, py === 0 ? py + ph - 12 : py, 56, 12);
      g.fillStyle = 'rgba(10,10,10,.55)';
      for (let dy = py + 16; dy < py + ph - 8; dy += 12) {
        for (let dx = px + 8; dx < px + 42; dx += 12) {
          g.beginPath(); g.arc(dx, dy, 2.2, 0, Math.PI * 2); g.fill();
        }
      }
    };
    if (p.gapY > 0) drawStack(p.x, 0, p.gapY);
    const bottomY = p.gapY + gapH;
    if (bottomY < h) drawStack(p.x, bottomY, h - bottomY);
  }

  const bx = FLY.birdX;
  const by = FLY.y;
  g.save();
  g.translate(bx, by);
  g.rotate(Math.max(-0.4, Math.min(0.9, FLY.vy / 900)));
  g.fillStyle = '#f2efe6';
  g.beginPath(); g.arc(0, 0, FLY.r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#0a0a0a';
  g.lineWidth = 2.5;
  g.stroke();
  g.fillStyle = '#e10600';
  g.beginPath();
  g.moveTo(-8, -10); g.lineTo(-1, -22); g.lineTo(3, -10);
  g.lineTo(8, -20); g.lineTo(9, -8);
  g.closePath(); g.fill();
  g.fillStyle = '#f5e400';
  g.beginPath(); g.moveTo(9, -2); g.lineTo(20, 3); g.lineTo(9, 7); g.closePath(); g.fill();
  g.strokeStyle = '#0a0a0a'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#0a0a0a';
  g.beginPath(); g.arc(5, -3, 2.4, 0, Math.PI * 2); g.fill();
  g.restore();

  g.fillStyle = '#f5e400';
  g.font = 'bold 26px "Permanent Marker", sans-serif';
  g.textAlign = 'left';
  g.fillText(String(FLY.score), 12, 32);

  if (FLY.state === 'idle') {
    g.fillStyle = 'rgba(10,10,10,.78)';
    g.fillRect(0, h / 2 - 44, w, 88);
    g.fillStyle = '#f5e400';
    g.font = 'bold 28px "Permanent Marker", sans-serif';
    g.textAlign = 'center';
    g.fillText('ПАНК-ПТИЦА', w / 2, h / 2 - 6);
    g.fillStyle = '#f2efe6';
    g.font = '15px "Special Elite", monospace';
    g.fillText('пробел / тап по экрану — взмах', w / 2, h / 2 + 24);
  } else if (FLY.state === 'dead') {
    g.fillStyle = 'rgba(10,10,10,.75)';
    g.fillRect(0, h / 2 - 40, w, 80);
    g.fillStyle = '#e10600';
    g.font = 'bold 30px "Permanent Marker", sans-serif';
    g.textAlign = 'center';
    g.fillText('ШЛЁП', w / 2, h / 2 + 2);
    g.fillStyle = '#f2efe6';
    g.font = '15px "Special Elite", monospace';
    g.fillText('пробел — заново', w / 2, h / 2 + 28);
  }
}

makeLoop(FLY, flyStep, flyDraw);
FLY.draw = flyDraw;
FLY.resume = () => { if (FLY.state === 'play') FLY.start(); };

/* --------------------------- В ТАКТ: БАРАБАНЫ ----------------------------- */
const DRUMS_BEST = 'dp.arcade.drums.v1';

const DRUMS = {
  canvas: qs('#drumsCanvas'),
  w: 440, h: 252,
  laneW: 110,
  hitY: 196,
  fall: 1750,
  beat: 400,
  bpm: 150,
  chart: [],
  t: -1600,
  score: 0, combo: 0, maxCombo: 0,
  perfect: 0, good: 0, miss: 0,
  grade: '-',
  state: 'idle',
  flash: [0, 0, 0, 0],
  judge: '',
  judgeAt: -99999,
  lastBeat: 99999,
  endT: 0,
  laneColor: ['#f5e400', '#f2efe6', '#e10600', '#f5e400']
};

function drumsChart(bpm) {
  const beat = 60000 / bpm;
  const notes = [];
  for (let b = 0; b < 64; b++) {
    const t = b * beat;
    const inBar = b % 4;
    if (inBar === 0 || inBar === 2) notes.push({ t, lane: 0, hit: 0 });
    if (inBar === 1 || inBar === 3) notes.push({ t, lane: 2, hit: 0 });
    notes.push({ t: t + beat / 2, lane: 1, hit: 0 });
    if (Math.random() < 0.3) notes.push({ t: t + beat / 2, lane: 3, hit: 0 });
    if (Math.random() < 0.16) notes.push({ t, lane: 3, hit: 0 });
  }
  notes.sort((a, b2) => a.t - b2.t);
  return notes;
}

let drumsCtx = null;
let drumsNoise = null;

function getDrumsCtx() {
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  if (!drumsCtx) {
    try { drumsCtx = new C(); } catch (err) { return null; }
  }
  if (drumsCtx.state === 'suspended') drumsCtx.resume();
  return drumsCtx;
}

function drumsSfx(kind) {
  if (kind === 'air') return;
  const ctx = getDrumsCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  if (kind === 'good' || kind === 'perfect') {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = kind === 'perfect' ? 880 : 660;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.22, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    o.connect(g).connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.15);
    return;
  }

  if (kind === 'hat') {
    if (!drumsNoise) {
      const len = Math.floor(ctx.sampleRate * 0.2);
      drumsNoise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = drumsNoise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6000;
    src.buffer = drumsNoise;
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    src.connect(hp).connect(g).connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.08);
    return;
  }

  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  const from = kind === 'count' ? 520 : 150;
  const to = kind === 'count' ? 380 : 48;
  o.frequency.setValueAtTime(from, now);
  o.frequency.exponentialRampToValueAtTime(to, now + 0.11);
  g.gain.setValueAtTime(kind === 'count' ? 0.28 : 0.5, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
  o.connect(g).connect(ctx.destination);
  o.start(now);
  o.stop(now + 0.19);
}

function drumsHud() {
  const total = DRUMS.perfect + DRUMS.good + DRUMS.miss;
  qs('#drumsScore').textContent = String(DRUMS.score);
  qs('#drumsCombo').textContent = String(DRUMS.combo);
  qs('#drumsAcc').textContent = total
    ? Math.round(((DRUMS.perfect + DRUMS.good * 0.6) / total) * 100) + '%'
    : '—';
  const best = read(DRUMS_BEST, { score: 0 });
  qs('#drumsBest').textContent = String(best.score || 0);
}

function drumsStart() {
  const track = getTrack(state.currentId);
  DRUMS.bpm = track ? track.bpm : 150;
  DRUMS.beat = 60000 / DRUMS.bpm;
  DRUMS.chart = drumsChart(DRUMS.bpm);
  DRUMS.endT = DRUMS.chart[DRUMS.chart.length - 1].t + 900;
  DRUMS.t = -DRUMS.beat * 4;
  DRUMS.lastBeat = 99999;
  DRUMS.score = 0;
  DRUMS.combo = 0;
  DRUMS.maxCombo = 0;
  DRUMS.perfect = 0;
  DRUMS.good = 0;
  DRUMS.miss = 0;
  DRUMS.grade = '-';
  DRUMS.judge = '';
  DRUMS.judgeAt = -99999;
  DRUMS.state = 'play';
  qs('.cab--drums').classList.add('is-live');
  say(qs('#drumsMsg'),
    `Темп ${DRUMS.bpm} BPM` + (track ? ` — из трека «${track.title}».` : ' (демо-темп).') + ' D F J K!');
  drumsHud();
  DRUMS.draw();
  DRUMS.start();
}

function drumsHit(lane) {
  DRUMS.flash[lane] = 1;
  if (DRUMS.state !== 'play') return;

  let target = null;
  let bestDelta = Infinity;
  for (const n of DRUMS.chart) {
    if (n.lane !== lane || n.hit) continue;
    const delta = n.t - DRUMS.t;
    if (Math.abs(delta) <= 150 && Math.abs(delta) < Math.abs(bestDelta)) {
      target = n;
      bestDelta = delta;
    }
  }
  if (!target) { drumsSfx('hat'); return; }

  target.hit = 1;
  const abs = Math.abs(bestDelta);
  let gain = 150;
  if (abs <= 60) {
    DRUMS.perfect += 1;
    DRUMS.judge = 'В ТОЧКУ';
    gain = 300;
    drumsSfx('perfect');
  } else {
    DRUMS.good += 1;
    DRUMS.judge = 'НОРМ';
    drumsSfx('good');
  }
  DRUMS.combo += 1;
  DRUMS.maxCombo = Math.max(DRUMS.maxCombo, DRUMS.combo);
  DRUMS.score += gain + Math.min(50, DRUMS.combo) * 2;
  DRUMS.judgeAt = DRUMS.t;
  drumsHud();
}

function drumsFinish() {
  DRUMS.state = 'done';
  const total = DRUMS.perfect + DRUMS.good + DRUMS.miss || 1;
  const acc = (DRUMS.perfect + DRUMS.good * 0.6) / total;
  DRUMS.grade = acc >= 0.95 ? 'S' : acc >= 0.88 ? 'A' : acc >= 0.72 ? 'B' : 'C';

  const best = read(DRUMS_BEST, { score: 0 });
  if (DRUMS.score > (best.score || 0)) {
    write(DRUMS_BEST, { score: DRUMS.score, grade: DRUMS.grade });
    say(qs('#drumsMsg'), `Новый рекорд: ${DRUMS.score}, оценка ${DRUMS.grade}. Катушки довольны.`, 'is-good');
  } else {
    say(qs('#drumsMsg'),
      `Оценка ${DRUMS.grade}, счёт ${DRUMS.score}. Рекорд пока ${best.score || 0}.`,
      acc >= 0.72 ? 'is-good' : 'is-bad');
  }
  drumsHud();
  DRUMS.draw();
}

function drumsStep(dt) {
  DRUMS.t += dt * 1000;

  const beatIdx = Math.floor(DRUMS.t / DRUMS.beat);
  if (beatIdx !== DRUMS.lastBeat) {
    DRUMS.lastBeat = beatIdx;
    drumsSfx(DRUMS.t < 0 ? 'count' : 'hat');
  }

  for (const n of DRUMS.chart) {
    if (n.hit) continue;
    if (n.t + 150 < DRUMS.t) {
      n.hit = 2;
      DRUMS.miss += 1;
      DRUMS.combo = 0;
      DRUMS.judge = 'МИМО';
      DRUMS.judgeAt = DRUMS.t;
    }
  }

  for (let i = 0; i < 4; i++) {
    DRUMS.flash[i] = Math.max(0, DRUMS.flash[i] - dt * 3);
  }

  if (DRUMS.t > DRUMS.endT) drumsFinish();
}

function drumsDraw() {
  const g = DRUMS.canvas.getContext('2d');
  const w = DRUMS.w;
  const h = DRUMS.h;
  const lw = DRUMS.laneW;
  const hy = DRUMS.hitY;

  g.fillStyle = '#0a0a0a';
  g.fillRect(0, 0, w, h);

  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? 'rgba(242,239,230,.05)' : 'rgba(242,239,230,.02)';
    g.fillRect(i * lw, 0, lw, h);
    g.strokeStyle = 'rgba(242,239,230,.18)';
    g.lineWidth = 1;
    g.setLineDash([6, 6]);
    g.beginPath();
    g.moveTo(i * lw + 0.5, 0);
    g.lineTo(i * lw + 0.5, h);
    g.stroke();
    g.setLineDash([]);
  }

  g.fillStyle = 'rgba(245,228,0,.22)';
  g.fillRect(0, hy - 2, w, 28);
  g.fillStyle = '#f5e400';
  g.fillRect(0, hy, w, 3);

  if (DRUMS.state === 'play' || DRUMS.state === 'done') {
    for (const n of DRUMS.chart) {
      if (n.hit) continue;
      const y = hy - ((n.t - DRUMS.t) / DRUMS.fall) * (hy + 20);
      if (y < -24 || y > h + 24) continue;
      g.fillStyle = DRUMS.laneColor[n.lane];
      g.fillRect(n.lane * lw + 6, y - 8, lw - 12, 15);
      g.strokeStyle = '#0a0a0a';
      g.lineWidth = 2;
      g.strokeRect(n.lane * lw + 6, y - 8, lw - 12, 15);
    }
  }

  for (let i = 0; i < 4; i++) {
    g.globalAlpha = Math.min(1, 0.14 + DRUMS.flash[i] * 0.8);
    g.fillStyle = DRUMS.laneColor[i];
    g.fillRect(i * lw + 6, hy + 5, lw - 12, 38);
    g.globalAlpha = 1;
  }

  g.fillStyle = 'rgba(10,10,10,.7)';
  g.textAlign = 'center';
  g.font = 'bold 15px "Bebas Neue", sans-serif';
  g.fillStyle = '#f2efe6';
  const labels = ['D', 'F', 'J', 'K'];
  for (let i = 0; i < 4; i++) g.fillText(labels[i], i * lw + lw / 2, hy + 33);

  if (DRUMS.state === 'play') {
    if (DRUMS.combo > 1) {
      g.fillStyle = '#f2efe6';
      g.font = 'bold 36px "Permanent Marker", sans-serif';
      g.fillText(String(DRUMS.combo), w / 2, 64);
      g.fillStyle = '#f5e400';
      g.font = '14px "Special Elite", monospace';
      g.fillText('комбо', w / 2, 82);
    }
    if (DRUMS.judge && DRUMS.t - DRUMS.judgeAt < 520) {
      g.fillStyle = DRUMS.judge === 'В ТОЧКУ' ? '#f5e400' : DRUMS.judge === 'МИМО' ? '#e10600' : '#f2efe6';
      g.font = 'bold 24px "Permanent Marker", sans-serif';
      g.fillText(DRUMS.judge, w / 2, 122);
    }
    if (DRUMS.t < 0) {
      g.fillStyle = 'rgba(10,10,10,.62)';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#f5e400';
      g.font = 'bold 96px "Permanent Marker", sans-serif';
      g.fillText(String(Math.ceil(-DRUMS.t / DRUMS.beat)), w / 2, h / 2 + 24);
    }
  } else if (DRUMS.state === 'idle') {
    g.fillStyle = 'rgba(10,10,10,.8)';
    g.fillRect(0, h / 2 - 46, w, 92);
    g.fillStyle = '#f5e400';
    g.font = 'bold 32px "Permanent Marker", sans-serif';
    g.fillText('БАРАБАНЫ', w / 2, h / 2 - 6);
    g.fillStyle = '#f2efe6';
    g.font = '15px "Special Elite", monospace';
    g.fillText('D F J K или стрелки — лови такт', w / 2, h / 2 + 22);
  } else if (DRUMS.state === 'done') {
    g.fillStyle = 'rgba(10,10,10,.82)';
    g.fillRect(0, h / 2 - 58, w, 116);
    g.fillStyle = '#f5e400';
    g.font = 'bold 64px "Permanent Marker", sans-serif';
    g.fillText(DRUMS.grade, w / 2, h / 2 + 12);
    g.fillStyle = '#f2efe6';
    g.font = '16px "Special Elite", monospace';
    g.fillText(`счёт ${DRUMS.score} · макс. комбо ${DRUMS.maxCombo}`, w / 2, h / 2 + 40);
  }
}

makeLoop(DRUMS, drumsStep, drumsDraw);
DRUMS.draw = drumsDraw;
DRUMS.resume = () => { if (DRUMS.state === 'play') DRUMS.start(); };

/* -------------------------- Общие контролы -------------------------------- */
function initArcade() {
  const diggerKeys = {
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], 'ф': [-1, 0], 'Ф': [-1, 0],
    ArrowRight: [1, 0], d: [1, 0], D: [1, 0], 'в': [1, 0], 'В': [1, 0],
    ArrowDown: [0, 1], s: [0, 1], S: [0, 1], 'ы': [0, 1], 'Ы': [0, 1]
  };

  DIG.canvas.addEventListener('pointerdown', () => {
    DIG.canvas.focus({ preventScroll: true });
  });

  DIG.canvas.addEventListener('keydown', (e) => {
    const move = diggerKeys[e.key];
    if (!move) return;
    e.preventDefault();
    e.stopPropagation();
    digMove(move[0], move[1]);
  });

  const flyKeys = [' ', 'ArrowUp', 'w', 'W', 'ц', 'Ц'];
  FLY.canvas.addEventListener('keydown', (e) => {
    if (!flyKeys.includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    flyFlap();
  });

  FLY.canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    FLY.canvas.focus({ preventScroll: true });
    flyFlap();
  });

  qs('.dpad').addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('[data-dir]');
    if (!btn) return;
    e.preventDefault();
    const map = { left: [-1, 0], right: [1, 0], down: [0, 1] };
    const move = map[btn.dataset.dir];
    btn.classList.add('is-down');
    digMove(move[0], move[1]);
  });
  qs('.dpad').addEventListener('pointerup', () => {
    qsa('.dbtn').forEach((b) => b.classList.remove('is-down'));
  });

  qs('#diggerStart').addEventListener('click', () => digRestart(true));
  qs('#flyerStart').addEventListener('click', flyFlap);

  /* Барабаны */
  const drumArrows = { ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 };
  const drumLetters = {
    d: 0, D: 0, 'в': 0, 'В': 0,
    f: 1, F: 1, 'а': 1, 'А': 1,
    j: 2, J: 2, 'о': 2, 'О': 2,
    k: 3, K: 3, 'л': 3, 'Л': 3
  };

  DRUMS.canvas.addEventListener('pointerdown', () => {
    DRUMS.canvas.focus({ preventScroll: true });
  });
  DRUMS.canvas.addEventListener('keydown', (e) => {
    const lane = drumArrows[e.key];
    if (lane === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    drumsHit(lane);
  });
  document.addEventListener('keydown', (e) => {
    if (DRUMS.state !== 'play') return;
    if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    const lane = drumLetters[e.key];
    if (lane === undefined) return;
    e.preventDefault();
    drumsHit(lane);
  });

  qs('.pads').addEventListener('pointerdown', (e) => {
    const pad = e.target.closest('[data-lane]');
    if (!pad) return;
    e.preventDefault();
    const lane = Number(pad.dataset.lane);
    pad.classList.add('is-down');
    drumsHit(lane);
  });
  qs('.pads').addEventListener('pointerup', () => {
    qsa('.pad').forEach((p) => p.classList.remove('is-down'));
  });

  qs('#drumsStart').addEventListener('click', drumsStart);

  watchVisibility(qs('.cab--digger'), DIG);
  watchVisibility(qs('.cab--flyer'), FLY);
  watchVisibility(qs('.cab--drums'), DRUMS);

  digBuild();
  DIG.draw();
  FLY.draw();
  DRUMS.draw();
  drumsHud();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { DIG.draw(); FLY.draw(); DRUMS.draw(); });
  }
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
  initArcade();
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
