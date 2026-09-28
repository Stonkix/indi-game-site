/* =============================================================================
   DUNGEON PUNK — chaos.js
   Общий «разнос сайта». Срабатывает, когда:
     • ползунок «Грязь» в бит-машине уходит на 105%  (studio.js);
     • на левой панели дерутся 67 и ТУН-ТУН          (rails.js).

   Отдельный ленивый модуль, потому что нужен сразу двум фичам, а стартовой
   странице — не нужен вообще. Стили тоже здесь: пока ничего не сломано,
   браузер за них не платит.
   ========================================================================== */

const CSS = `
.crash {
  position: fixed; inset: auto 0 0 0; z-index: 100000;
  display: flex; flex-direction: column; align-items: center; gap: .5rem;
  text-align: center;
  background: var(--ink); color: var(--paper);
  border-top: 6px solid var(--red);
  padding: 1.1rem 1rem calc(1.1rem + env(safe-area-inset-bottom));
  box-shadow: 0 -12px 0 rgba(225,6,0,.35);
}
.crash__code {
  font-family: var(--f-btn); font-size: 1rem; letter-spacing: .3em;
  color: var(--acid); margin: 0;
}
.crash__title { font-family: var(--f-marker); font-size: clamp(1.4rem, 1rem + 3vw, 2.6rem); margin: 0; }
.crash__text { max-width: 62ch; font-size: .95rem; margin: 0; opacity: .9; }
.crash .btn { margin-top: .3rem; }

body.is-broken main,
body.is-broken .site-header,
body.is-broken .site-footer,
body.is-broken .player,
body.is-broken .marquee,
body.is-broken .caution-stripe,
body.is-broken .rail-dock { pointer-events: none; }

body.is-broken .scanlines { opacity: .5; }
body.is-broken .grain { opacity: .62; animation-duration: .22s; mix-blend-mode: hard-light; }
body.is-broken .marquee__track { animation-duration: 3s; }
body.is-broken .caution-stripe span { animation-duration: 3s; background: var(--acid); }
body.is-broken .caution-stripe { background: var(--acid); color: var(--ink); }

@media (prefers-reduced-motion: no-preference) {
  body.is-broken main section > *,
  body.is-broken .site-header .header-inner > *,
  body.is-broken .site-footer .footer-inner > *,
  body.is-broken .player,
  body.is-broken .marquee,
  body.is-broken .torn-edge,
  body.is-broken .soap-rail,
  body.is-broken .fight-rail {
    animation: fallAway var(--fall-d, 1.6s) cubic-bezier(.4, 0, .9, .55) forwards;
    animation-delay: calc(var(--fall-i, 0) * 55ms);
  }
  body.is-broken .tport--dirt { animation: dirtDive 1.3s cubic-bezier(.5, 0, 1, .6) forwards; }
  body.is-broken { animation: chaosShake .13s steps(2) infinite; }
  body.is-broken .machine { animation: machineHop .28s steps(2) 6; }
}

@keyframes fallAway {
  0%   { transform: translate(0, 0) rotate(0deg); }
  15%  { transform: translate(calc(var(--fall-x, 10vw) * -.2), -1.5vh) rotate(calc(var(--fall-r, 40deg) * -.15)); }
  100% { transform: translate(var(--fall-x, 10vw), 125vh) rotate(var(--fall-r, 40deg)); opacity: .85; }
}
@keyframes dirtDive {
  0%   { transform: translate(0, 0) rotate(0deg); }
  20%  { transform: translate(0, -14px) rotate(-3deg); }
  100% { transform: translate(-6vw, 120vh) rotate(-28deg); opacity: .4; }
}
@keyframes chaosShake {
  0%   { transform: translate(0, 0); }
  50%   { transform: translate(-2px, 1px); }
  100% { transform: translate(2px, -1px); }
}
@keyframes machineHop {
  0%   { transform: translate(0, 0) rotate(0deg); }
  50%  { transform: translate(-3px, -4px) rotate(-1deg); }
  100% { transform: translate(3px, 2px) rotate(1deg); }
}
`;

let broken = false;
let banner = null;
let actx = null;
let noiseBuf = null;

function inject() {
  if (document.getElementById('dp-chaos-style')) return;
  const style = document.createElement('style');
  style.id = 'dp-chaos-style';
  style.textContent = CSS;
  document.head.appendChild(style);
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

function smashSound() {
  const ctx = audio();
  if (!ctx) return;
  const now = ctx.currentTime;

  if (!noiseBuf) {
    const len = Math.floor(ctx.sampleRate * 1.8);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(6500, now);
  lp.frequency.exponentialRampToValueAtTime(110, now + 1.4);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.4, now);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
  noise.connect(lp);
  lp.connect(ng);
  ng.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 1.7);

  const boom = ctx.createOscillator();
  const bg = ctx.createGain();
  boom.type = 'sawtooth';
  boom.frequency.setValueAtTime(230, now);
  boom.frequency.exponentialRampToValueAtTime(26, now + 1.5);
  bg.gain.setValueAtTime(0.45, now);
  bg.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
  boom.connect(bg);
  bg.connect(ctx.destination);
  boom.start(now);
  boom.stop(now + 1.9);
}

function scatter() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const victims = document.querySelectorAll([
    'main section > *',
    '.site-header .header-inner > *',
    '.site-footer .footer-inner > *',
    '.player',
    '.marquee',
    '.torn-edge',
    '.soap-rail',
    '.fight-rail',
    '.gradus-shop'
  ].join(','));
  victims.forEach((el, i) => {
    el.style.setProperty('--fall-i', String(i % 12));
    el.style.setProperty('--fall-x', (Math.random() * 60 - 30).toFixed(1) + 'vw');
    el.style.setProperty('--fall-r', (Math.random() * 240 - 120).toFixed(0) + 'deg');
    el.style.setProperty('--fall-d', (1.2 + Math.random() * 1.1).toFixed(2) + 's');
  });
}

function showBanner({ code, title, text }) {
  if (banner) banner.remove();
  banner = document.createElement('div');
  banner.className = 'crash';
  banner.id = 'crash';
  banner.setAttribute('role', 'alert');
  banner.innerHTML = `
    <p class="crash__code" aria-hidden="true"></p>
    <h2 class="crash__title"></h2>
    <p class="crash__text"></p>
    <button type="button" class="btn btn--acid" id="crashFix">ПОЧИНИТЬ</button>`;
  banner.querySelector('.crash__code').textContent = code;
  banner.querySelector('.crash__title').textContent = title;
  banner.querySelector('.crash__text').textContent = text;
  banner.querySelector('#crashFix').addEventListener('click', repair);
  document.body.appendChild(banner);
  const fix = banner.querySelector('#crashFix');
  if (fix) fix.focus({ preventScroll: true });
}

export function isBroken() {
  return broken;
}

export function trigger(opts = {}) {
  if (broken) return false;
  broken = true;
  inject();
  document.body.classList.add('is-broken');
  document.dispatchEvent(new CustomEvent('dp:overdrive'));
  scatter();
  smashSound();
  showBanner({
    code: opts.code || 'ERR 105%',
    title: opts.title || 'ВЫКРУТИЛ. СЛОМАЛ.',
    text: opts.text || 'Что-то пошло не так, и сайт осыпался.'
  });
  return true;
}

export function repair() {
  if (!broken) return;
  broken = false;
  document.body.classList.remove('is-broken');
  document.querySelectorAll('[style*="--fall-"]').forEach((el) => {
    el.style.removeProperty('--fall-i');
    el.style.removeProperty('--fall-x');
    el.style.removeProperty('--fall-r');
    el.style.removeProperty('--fall-d');
  });
  if (banner) {
    banner.hidden = true;
    banner.remove();
    banner = null;
  }
  document.dispatchEvent(new CustomEvent('dp:repaired'));
}
