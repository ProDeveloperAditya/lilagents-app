/* ───────────────────────────────────────────────────────────────
   lil agents — landing interactions
   1. Companions walk back and forth along the taskbar (sprite walk
      cycle + horizontal patrol + edge turns)
   2. Cursor reaction — they stop and turn to look when you come close
   3. Magnetic download button
   4. Live download count
   ─────────────────────────────────────────────────────────────── */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── 1 + 2. Walking companions ───────────────────────────────────
   The sprite art faces LEFT, so face = +1 when walking left and -1
   (mirrored) when walking right. The CSS handles the leg animation;
   here we only move them horizontally and flip/scale them. */
class Walker {
  constructor(el, { x, dir, speed }) {
    this.el = el;
    this.x = x;
    this.dir = dir;            // +1 → walking right, -1 → walking left
    this.speed = speed;        // px/sec
    this.pop = 1;              // scale; eases up when "noticing" the cursor
    this.popTarget = 1;
    this.noticing = false;
    // Art's native orientation faces RIGHT, so face = +1 walking right,
    // -1 (mirrored) walking left.
    this.face = dir < 0 ? -1 : 1;
  }

  get w() { return this.el.offsetWidth || 90; }
  get center() { return this.x + this.w / 2; }
  bounds() { return { min: 4, max: Math.max(4, window.innerWidth - this.w - 4) }; }

  update(dt, mouse) {
    const b = this.bounds();

    // Does the cursor come close? (horizontal proximity, low on the page)
    const lowBand = window.innerHeight - 340;
    const near = mouse.active &&
                 mouse.y > lowBand &&
                 Math.abs(mouse.x - this.center) < 90;

    this.noticing = near;
    this.popTarget = near ? 1.1 : 1;

    if (near) {
      // Stop and turn to look at the cursor (keeps marching in place).
      this.face = mouse.x < this.center ? -1 : 1;
    } else {
      // Patrol: advance, turn around at the edges.
      this.x += this.dir * this.speed * dt / 1000;
      if (this.x <= b.min) { this.x = b.min; this.dir = 1; }
      if (this.x >= b.max) { this.x = b.max; this.dir = -1; }
      this.face = this.dir < 0 ? -1 : 1;
    }

    // Ease the "notice" pop for a soft, springy feel.
    const k = 1 - Math.exp(-dt / 70);
    this.pop += (this.popTarget - this.pop) * k;

    this.el.style.transform =
      `translateX(${this.x.toFixed(1)}px) scale(${this.pop.toFixed(3)}) scaleX(${this.face})`;
    this.el.style.animationPlayState = near ? 'paused' : 'running';
  }

  park() {
    this.el.style.transform = `translateX(${this.x.toFixed(1)}px) scaleX(${this.face})`;
    this.el.style.animationPlayState = 'paused';
  }
}

(function initWalkers() {
  const bruceEl = document.getElementById('bruce');
  const jazzEl  = document.getElementById('jazz');
  if (!bruceEl || !jazzEl) return;

  const W = window.innerWidth;
  const walkers = [
    new Walker(bruceEl, { x: W * 0.18, dir:  1, speed: 50 }),
    new Walker(jazzEl,  { x: W * 0.74, dir: -1, speed: 56 }),
  ];

  if (reduceMotion) { walkers.forEach(w => w.park()); return; }

  const mouse = { x: 0, y: 0, active: false };
  window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; });
  window.addEventListener('mouseleave', () => { mouse.active = false; });

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(now - last, 50);   // clamp tab-switch jumps
    last = now;
    for (const w of walkers) w.update(dt, mouse);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener('resize', () => {
    for (const w of walkers) {
      const b = w.bounds();
      w.x = Math.min(Math.max(w.x, b.min), b.max);
    }
  });
})();

/* ── 3. Magnetic download button ─────────────────────────────── */
(function magnetize() {
  const btn = document.getElementById('dl');
  if (!btn || reduceMotion) return;
  const RANGE = 130, PULL = 0.3;

  window.addEventListener('mousemove', (e) => {
    const r = btn.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < RANGE + r.width / 2) {
      btn.style.transform = `translate(${dx * PULL}px, ${dy * PULL}px)`;
    } else {
      btn.style.transform = '';
    }
  });
  btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
})();

/* ── 4. Live download count (GitHub's real release download tally) ──
   No backend: GitHub counts every release-asset download. We read that
   public number and sum it across all releases/assets. */
(async function loadCount() {
  const el = document.getElementById('count');
  if (!el) return;
  try {
    const res = await fetch(
      'https://api.github.com/repos/ProDeveloperAditya/lilagents-app/releases',
      { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return;
    const releases = await res.json();
    let total = 0;
    for (const r of releases) for (const a of (r.assets || [])) total += a.download_count || 0;
    el.textContent = total.toLocaleString();
  } catch (_) { /* rate-limited / offline — leave the placeholder */ }
})();
