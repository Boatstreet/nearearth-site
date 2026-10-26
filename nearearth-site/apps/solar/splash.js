/* Solar — start screen. Plays for ~2.4 s each time the app is opened (tap to skip):
   stars drift, the Sun's corona flares, solar wind streams out, an aurora ripples over
   Earth's limb, the wordmark rises — then the Sun swells and fades into the app. */
(function () {
  'use strict';
  try { if (localStorage.getItem('sonne:splash:off')) return; } catch (e) { } // test builds only
  const root = document.createElement('div');
  root.className = 'splash';
  root.innerHTML = '<canvas></canvas><div class="sp-word"><b>SOLAR</b><span>Sun · Aurora · Eclipse</span></div>';
  document.body.appendChild(root);
  const cv = root.querySelector('canvas'), g = cv.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0;
  function size() { W = Math.round(innerWidth * dpr); H = Math.round(innerHeight * dpr); cv.width = W; cv.height = H; }
  size();
  const R = (a, b) => a + Math.random() * (b - a);
  const stars = Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), r: R(0.3, 1.4), p: R(0, 6.3), z: R(0.2, 1) }));
  const wind = Array.from({ length: 90 }, () => ({ a: R(0, 6.283), d: R(0, 1), v: R(0.25, 0.7), l: R(0.02, 0.07) }));

  // the Sun's face: limb-darkened disc with granulation and a couple of spots, drawn once
  const SZ = 512, face = document.createElement('canvas'); face.width = face.height = SZ;
  (function () {
    const f = face.getContext('2d'), c = SZ / 2;
    const base = f.createRadialGradient(c * 0.92, c * 0.9, 0, c, c, c);
    base.addColorStop(0, '#fff3c4'); base.addColorStop(0.45, '#ffc861'); base.addColorStop(0.8, '#f08a24'); base.addColorStop(1, '#a8420e');
    f.fillStyle = base; f.beginPath(); f.arc(c, c, c, 0, 6.283); f.fill();
    f.save(); f.beginPath(); f.arc(c, c, c, 0, 6.283); f.clip();
    for (let i = 0; i < 2600; i++) { // granulation
      const x = Math.random() * SZ, y = Math.random() * SZ, r = R(2, 6);
      f.fillStyle = Math.random() < 0.5 ? 'rgba(255,240,190,.10)' : 'rgba(150,60,10,.10)';
      f.beginPath(); f.arc(x, y, r, 0, 6.283); f.fill();
    }
    const spot = (x, y, r) => { f.fillStyle = 'rgba(120,45,8,.75)'; f.beginPath(); f.ellipse(x, y, r * 1.6, r * 1.1, 0.3, 0, 6.283); f.fill(); f.fillStyle = 'rgba(40,12,2,.9)'; f.beginPath(); f.ellipse(x, y, r * 0.8, r * 0.55, 0.3, 0, 6.283); f.fill(); };
    spot(c * 0.72, c * 0.82, 14); spot(c * 0.84, c * 0.9, 7); spot(c * 1.32, c * 1.18, 10);
    f.restore();
  })();

  const t0 = performance.now();
  let raf = 0, leaving = 0;
  const DUR = 2400, OUT = 520;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000, k = leaving ? Math.min(1, (now - leaving) / OUT) : 0;
    const cx = W / 2, cy = H * 0.4, rs = Math.min(W, H) * (0.16 + 0.015 * Math.sin(t * 1.3)) * (1 + k * 2.2);
    const intro = Math.min(1, t / 0.9), ease = 1 - Math.pow(1 - intro, 3);
    // deep space
    const bg = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H));
    bg.addColorStop(0, '#2a1608'); bg.addColorStop(0.35, '#0e1424'); bg.addColorStop(1, '#03050b');
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // stars, drifting slowly
    g.fillStyle = '#fff';
    for (const s of stars) {
      g.globalAlpha = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2 + s.p))) * s.z * ease;
      const x = ((s.x + t * 0.004 * s.z) % 1) * W, y = s.y * H;
      g.beginPath(); g.arc(x, y, s.r * dpr, 0, 6.283); g.fill();
    }
    g.globalCompositeOperation = 'lighter';
    // corona: soft halo plus slowly turning streamers
    g.globalAlpha = ease;
    const halo = g.createRadialGradient(cx, cy, rs * 0.8, cx, cy, rs * 4.2);
    halo.addColorStop(0, 'rgba(255,190,90,.55)'); halo.addColorStop(0.25, 'rgba(255,140,50,.18)'); halo.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = halo; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 22; i++) {
      const a = i / 22 * 6.283 + t * 0.07 * (i % 2 ? 1 : -1), len = rs * (1.9 + 0.9 * Math.sin(t * 0.9 + i * 1.7));
      const gr = g.createLinearGradient(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      gr.addColorStop(0, 'rgba(255,200,120,.2)'); gr.addColorStop(1, 'rgba(255,150,60,0)');
      g.fillStyle = gr; g.beginPath();
      g.moveTo(cx + Math.cos(a - 0.1) * rs * 0.95, cy + Math.sin(a - 0.1) * rs * 0.95);
      g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      g.lineTo(cx + Math.cos(a + 0.1) * rs * 0.95, cy + Math.sin(a + 0.1) * rs * 0.95); g.fill();
    }
    // solar wind streaming out
    g.lineCap = 'round';
    for (const p of wind) {
      p.d += p.v * 0.012; if (p.d > 1) { p.d = 0; p.a = R(0, 6.283); }
      const r0 = rs * (1.05 + p.d * 5), r1 = r0 + rs * p.l * 6;
      g.globalAlpha = ease * (1 - p.d) * 0.7; g.strokeStyle = '#ffd59a'; g.lineWidth = 1.3 * dpr;
      g.beginPath(); g.moveTo(cx + Math.cos(p.a) * r0, cy + Math.sin(p.a) * r0); g.lineTo(cx + Math.cos(p.a) * r1, cy + Math.sin(p.a) * r1); g.stroke();
    }
    // the Sun itself, slowly turning
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = ease;
    g.save(); g.translate(cx, cy); g.rotate(t * 0.03); g.drawImage(face, -rs, -rs, rs * 2, rs * 2); g.restore();
    // Earth's limb with an aurora rippling along it
    const ey = H * 0.86 + (1 - ease) * H * 0.2, er = W * 1.3;
    const limb = g.createRadialGradient(cx, ey + er, er * 0.96, cx, ey + er, er * 1.04);
    limb.addColorStop(0, '#0b2140'); limb.addColorStop(0.5, 'rgba(70,150,255,.55)'); limb.addColorStop(1, 'rgba(70,150,255,0)');
    g.fillStyle = limb; g.beginPath(); g.arc(cx, ey + er, er * 1.04, 0, 6.283); g.fill();
    g.fillStyle = '#050c1a'; g.beginPath(); g.arc(cx, ey + er, er, 0, 6.283); g.fill();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 120; i++) {
      const u = i / 119, ang = -Math.PI / 2 + (u - 0.5) * 0.9, bx = cx + Math.cos(ang) * er, by = ey + er + Math.sin(ang) * er;
      const amp = 0.5 + 0.5 * Math.sin(u * 22 - t * 2.4) * Math.sin(u * 7 + t * 0.8);
      const h = H * (0.04 + 0.08 * amp) * ease;
      const gr = g.createLinearGradient(bx, by, bx, by - h);
      gr.addColorStop(0, 'rgba(90,255,170,.55)'); gr.addColorStop(0.6, 'rgba(60,220,160,.18)'); gr.addColorStop(1, 'rgba(255,80,170,0)');
      g.globalAlpha = 0.5 + 0.5 * amp; g.strokeStyle = gr; g.lineWidth = W / 120 * 1.4;
      g.beginPath(); g.moveTo(bx, by); g.lineTo(bx, by - h); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    // fade out into the app
    if (leaving) {
      root.style.opacity = String(1 - k);
      if (k >= 1) { cancelAnimationFrame(raf); root.remove(); window.__splashDone = true; document.dispatchEvent(new Event('splashdone')); }
    }
  }
  function leave() { if (!leaving) { leaving = performance.now(); root.classList.add('leaving'); } }
  raf = requestAnimationFrame(frame);
  setTimeout(leave, DUR);
  root.addEventListener('click', leave);
  window.addEventListener('resize', size);
  window.Splash = { leave, active: () => document.body.contains(root) };
})();
