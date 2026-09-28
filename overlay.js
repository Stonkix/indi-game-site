/* =============================================================================
   DUNGEON PUNK — overlay.js
   Один общий полноэкранный канвас для всего уличного мусора: бутылки «ГРАДУСА»,
   люди-фарфор, роллы из суши-бара. Один холст, один цикл на всех — вместо
   трёх полноэкранных канвасов с тремя requestAnimationFrame.

   Модуль не самостоятельный: его импортируют gradus.js и sushi.js.
   Каждый регистрирует «отрисовщика»: { step(dt), draw(ctx, env) }.

   env = { vw, vh, floor, dpr } — общая геометрия: floor это линия над плеером,
   о которую всё бьётся.
   ========================================================================== */

const CSS = `
.fx-overlay {
  position: fixed; inset: 0; z-index: 9000;
  width: 100%; height: 100%;
  pointer-events: none;
}
`;

const env = { vw: 0, vh: 0, floor: 0, dpr: 1 };

let canvas = null;
let ctx = null;
let raf = 0;
let last = 0;
let lastDraw = 0;
let reduced = false;
const drawers = new Set();

function measure() {
  const player = document.querySelector('.player');
  const ph = player ? player.getBoundingClientRect().height : 0;
  env.dpr = Math.min(1.25, window.devicePixelRatio || 1);
  env.vw = window.innerWidth;
  env.vh = window.innerHeight;
  env.floor = Math.max(120, env.vh - ph - 10);

  if (!canvas) return;
  canvas.width = Math.round(env.vw * env.dpr);
  canvas.height = Math.round(env.vh * env.dpr);
  ctx.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
}

function renderOnce() {
  if (!ctx) return;
  ctx.clearRect(0, 0, env.vw, env.vh);
  for (const d of drawers) d.draw(ctx, env);
}

function frame(ts) {
  raf = requestAnimationFrame(frame);
  if (!last) last = ts;
  const dt = Math.min(0.05, (ts - last) / 1000);
  last = ts;
  if (ts - lastDraw < 33) return;
  lastDraw = ts;

  for (const d of drawers) if (d.step) d.step(dt);
  renderOnce();
}

function start() {
  if (raf || !drawers.size) return;
  if (reduced) { renderOnce(); return; }
  last = 0;
  lastDraw = 0;
  raf = requestAnimationFrame(frame);
}

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function ensure() {
  if (canvas) return;
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const style = document.createElement('style');
  style.id = 'dp-overlay-style';
  style.textContent = CSS;
  document.head.appendChild(style);

  canvas = document.createElement('canvas');
  canvas.className = 'fx-overlay';
  canvas.id = 'fxOverlay';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');

  measure();

  window.addEventListener('resize', () => {
    measure();
    if (reduced) renderOnce();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });
}

export function getOverlay() {
  ensure();
  return {
    env,
    measure,
    add(drawer) {
      drawers.add(drawer);
      start();
    },
    remove(drawer) {
      drawers.delete(drawer);
      if (!drawers.size) stop();
    },
    poke() {
      if (reduced) renderOnce();
      else start();
    }
  };
}
