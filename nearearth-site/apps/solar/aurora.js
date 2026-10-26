/* Solar — Aurora: the northern and southern lights right now, from NOAA's OVATION model.
   A ground-level sky whose curtains follow today's strength, and both polar ovals on globes
   you can spin, with real day and night, the Sun's direction and your place. */
(function () {
  'use strict';
  const { esc, Store, Fmt } = U;
  const rad = Math.PI / 180;
  const EV = () => window.EarthView;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

  // ---------------- data: OVATION grid → arrays and per-longitude oval profile ----------------
  const arrCache = new WeakMap(), profCache = new WeakMap();
  function arr(ov) {
    let a = arrCache.get(ov); if (a) return a;
    a = new Float32Array(360 * 181);
    for (const [k, p] of ov.grid) {
      const i = k.indexOf(','), lo = (((+k.slice(0, i)) % 360) + 360) % 360, la = +k.slice(i + 1);
      if (la >= -90 && la <= 90) a[(la + 90) * 360 + lo] = p;
    }
    arrCache.set(ov, a); return a;
  }
  function sample(a, lat, lon) {
    const x = ((lon % 360) + 360) % 360, y = clamp(lat + 90, 0, 180);
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, x1 = (x0 + 1) % 360, y1 = Math.min(180, y0 + 1);
    const r0 = y0 * 360, r1 = y1 * 360;
    return (a[r0 + x0] * (1 - fx) + a[r0 + x1] * fx) * (1 - fy) + (a[r1 + x0] * (1 - fx) + a[r1 + x1] * fx) * fy;
  }
  function smooth(src, k) {
    const out = new Float32Array(360);
    for (let i = 0; i < 360; i++) { let s = 0; for (let j = -k; j <= k; j++) s += src[(i + j + 360) % 360]; out[i] = s / (2 * k + 1); }
    return out;
  }
  function prof(a, sgn) {
    const c = new Float32Array(360), w = new Float32Array(360), I = new Float32Array(360);
    let edge = 90, maxP = 0, sum = 0, cs = 0, cn = 0;
    for (let lo = 0; lo < 360; lo++) {
      let sw = 0, sl = 0, sl2 = 0, mx = 0;
      for (let la = 35; la <= 89; la++) {
        const p = a[(sgn * la + 90) * 360 + lo];
        if (p > mx) mx = p;
        if (p >= 10 && la < edge) edge = la;
        if (p < 3) continue;
        sw += p; sl += p * la; sl2 += p * la * la;
      }
      if (sw > 0) { const m = sl / sw; c[lo] = m; w[lo] = clamp(Math.sqrt(Math.max(1, sl2 / sw - m * m)), 1.5, 6); cs += m; cn++; } else { c[lo] = 0; w[lo] = 2.5; }
      I[lo] = mx; if (mx > maxP) maxP = mx; sum += mx;
    }
    const avg = cn ? cs / cn : 67;
    for (let lo = 0; lo < 360; lo++) if (!c[lo]) c[lo] = avg;
    return { c: smooth(c, 5), w: smooth(w, 4), I: smooth(I, 2), edge: edge < 90 ? edge : null, maxP: Math.round(maxP), mean: sum / 360 };
  }
  function profile(ov) {
    let p = profCache.get(ov); if (p) return p;
    const a = arr(ov); p = { N: prof(a, 1), S: prof(a, -1) };
    profCache.set(ov, p); return p;
  }

  // ---------------- how strong is it? ----------------
  const LVN = ['Quiet', 'Active', 'Strong', 'Very strong', 'Extreme'];
  const LVC = ['#7fb6a0', '#5cf0a8', '#3dffb0', '#c6ff6b', '#ff6bd5'];
  function kpLevel(kp) { return kp == null ? 0 : kp >= 8 ? 4 : kp >= 7 ? 3 : kp >= 6 ? 2 : kp >= 5 ? 1 : 0; }
  function edgeLevel(e) { return e == null ? 0 : e <= 45 ? 4 : e <= 49 ? 3 : e <= 53 ? 2 : e <= 57 ? 1 : 0; }
  function summary(S, place) {
    const r = EV().reading ? EV().reading(S) : { kp: null, ss: EV()._subsolar(new Date()) };
    const kp = r.kp, out = { kp, ss: r.ss, obs: S.ovation ? S.ovation.obs : null, fc: S.ovation ? S.ovation.fc : null, ready: !!S.ovation };
    if (S.ovation) {
      const pr = profile(S.ovation);
      for (const h of ['N', 'S']) { const p = pr[h]; out[h] = { edge: p.edge, maxP: p.maxP, lvl: Math.max(kpLevel(kp), edgeLevel(p.edge)) }; }
    } else { out.N = out.S = { edge: null, maxP: 0, lvl: kpLevel(kp) }; }
    out.lvl = Math.max(out.N.lvl, out.S.lvl);
    if (place && S.ovation) {
      const a = S.ovation.at(place.lat, place.lon);
      out.place = { name: place.name, here: a.here, horizon: a.horizon, chance: Math.max(a.here, a.horizon), hemi: place.lat >= 0 ? 'N' : 'S', dark: sunAlt(place.lat, place.lon, r.ss) < -6 };
    }
    return out;
  }
  function sunAlt(lat, lon, ss) {
    const a = lat * rad, b = lon * rad, sl = ss.lat * rad, so = ss.lon * rad;
    return Math.asin(Math.cos(a) * Math.cos(b) * Math.cos(sl) * Math.cos(so) + Math.cos(a) * Math.sin(b) * Math.cos(sl) * Math.sin(so) + Math.sin(a) * Math.sin(sl)) / rad;
  }
  // the in-app alert: strong aurora anywhere, or a real chance at the user's place
  function threshold() { const n = Object.assign({ a: 0 }, Store.get('notif', {})); return n.a > 0 ? n.a : 10; }
  function alertOf(sum) {
    if (!sum || !sum.ready) return null;
    const pl = sum.place;
    if (pl && window.Pro && Pro.on() && pl.chance >= threshold()) return { key: 'p' + pl.chance, short: `Aurora alert · ${pl.chance}% at ${pl.name.split(',')[0]}`, title: `Aurora alert · ${esc(pl.name)}`, text: `${pl.chance}% chance ${pl.here >= threshold() ? 'overhead' : 'low on the ' + (pl.hemi === 'N' ? 'northern' : 'southern') + ' horizon'}${pl.dark ? ' — it\'s dark there, go and look!' : ' — wait for darkness'}` };
    if (sum.lvl >= 2) {
      const n = sum.N.edge, s = sum.S.edge;
      return { key: 'l' + sum.lvl, short: `Aurora alert · ${LVN[sum.lvl].toLowerCase()} aurora now`, title: `Aurora alert · ${LVN[sum.lvl].toLowerCase()} aurora`, text: `Reaching down to ${n != null ? n + '°N' : '--'} and ${s != null ? s + '°S' : '--'}${sum.kp != null ? ' · Kp ' + (+sum.kp).toFixed(1).replace(/\.0$/, '') : ''}` };
    }
    return null;
  }

  // ---------------- ground view: curtains over a lake ----------------
  // draw only while on screen
  function watchVis(cv) {
    const st = { on: true };
    if (window.IntersectionObserver) new IntersectionObserver((es) => { st.on = es[es.length - 1].isIntersecting; }, { rootMargin: '60px' }).observe(cv);
    return st;
  }
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function sprite(stops) {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 256, 0, 0);
    for (const [o, col] of stops) gr.addColorStop(o, col);
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256); return c;
  }
  const SPR = {};
  function sprites() {
    if (SPR.g) return SPR;
    SPR.g = sprite([[0, 'rgba(225,255,235,1)'], [0.05, 'rgba(110,255,170,.95)'], [0.25, 'rgba(50,240,140,.6)'], [0.55, 'rgba(40,200,150,.2)'], [1, 'rgba(30,120,160,0)']]);
    SPR.r = sprite([[0, 'rgba(255,60,140,0)'], [0.3, 'rgba(255,60,130,0)'], [0.6, 'rgba(255,70,150,.55)'], [0.82, 'rgba(190,70,255,.35)'], [1, 'rgba(120,60,255,0)']]);
    SPR.b = sprite([[0, 'rgba(160,120,255,.0)'], [0.05, 'rgba(200,120,255,.5)'], [0.2, 'rgba(255,90,200,0)'], [1, 'rgba(0,0,0,0)']]);
    return SPR;
  }
  function skyScene(cv, getSum) {
    const g = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0, fg = null, ridge = null;
    const R = rng(7), stars = Array.from({ length: 240 }, () => [R(), Math.pow(R(), 1.3) * 0.72, R() * 1.1 + 0.25, R() * 6.28]);
    const bands = [
      { y: 0.57, amp: 0.02, f: 1.3, s: 0.05, ph: 0.3, h: 0.20, a: 0.55, min: 0 },
      { y: 0.50, amp: 0.045, f: 1.0, s: -0.04, ph: 2.1, h: 0.34, a: 0.75, min: 1 },
      { y: 0.40, amp: 0.06, f: 0.8, s: 0.035, ph: 4.4, h: 0.48, a: 0.85, min: 2 },
      { y: 0.30, amp: 0.05, f: 1.6, s: -0.06, ph: 1.2, h: 0.36, a: 0.7, min: 3 },
    ];
    let inten = 0.3, red = 0.1, last = performance.now(), t0 = last, meteor = null, raf = 0;
    const vis = watchVis(cv);
    function size() {
      const r = cv.getBoundingClientRect(); W = Math.round(r.width * dpr); H = Math.round(r.height * dpr);
      if (!W || !H) return; cv.width = W; cv.height = H;
      const hz = H * 0.66, q = rng(11);
      // far mountains (a fractal ridge above the horizon)
      ridge = new Path2D(); ridge.moveTo(0, hz);
      let y = hz - H * 0.025;
      for (let x = 0; x <= W + 8; x += 6 * dpr) { y += (q() - 0.5) * H * 0.02; y = clamp(y, hz - H * 0.05, hz - H * 0.008); ridge.lineTo(x, y); }
      ridge.lineTo(W, hz); ridge.closePath();
      // foreground shore with spruce trees
      fg = new Path2D(); const sh = H * 0.95;
      fg.moveTo(0, H); fg.lineTo(0, sh - H * 0.02);
      for (let x = 0; x <= W; x += 10 * dpr) fg.lineTo(x, sh + Math.sin(x / W * 7) * H * 0.012 - (x < W * 0.3 ? (W * 0.3 - x) / W * H * 0.12 : 0) - (x > W * 0.78 ? (x - W * 0.78) / W * H * 0.18 : 0));
      fg.lineTo(W, H); fg.closePath();
      const tree = (x, base, h) => { const w = h * 0.32; fg.moveTo(x, base - h); for (let k = 0; k < 5; k++) { const yy = base - h + (k + 1) * h / 5.4, ww = w * (k + 1) / 5; fg.lineTo(x + ww, yy); fg.lineTo(x + ww * 0.35, yy); } fg.lineTo(x + w * 0.1, base); fg.lineTo(x - w * 0.1, base); for (let k = 4; k >= 0; k--) { const yy = base - h + (k + 1) * h / 5.4, ww = w * (k + 1) / 5; fg.lineTo(x - ww * 0.35, yy); fg.lineTo(x - ww, yy); } fg.closePath(); };
      for (let i = 0; i < 9; i++) { const x = W * (0.01 + i * 0.03 + q() * 0.02); tree(x, sh - (W * 0.3 - x) / W * H * 0.12 + H * 0.02, H * (0.16 + q() * 0.14) * (1 - i * 0.05)); }
      for (let i = 0; i < 11; i++) { const x = W * (0.8 + i * 0.022 + q() * 0.012); tree(x, sh - (x - W * 0.78) / W * H * 0.18 + H * 0.02, H * (0.14 + q() * 0.16) * (0.7 + i * 0.05)); }
    }
    size();
    function loop(now) {
      if (!cv.isConnected) { raf = 0; return; }
      raf = requestAnimationFrame(loop);
      if (document.hidden || !vis.on) { last = now; return; }
      const r = cv.getBoundingClientRect();
      if (Math.round(r.width * dpr) !== W) size();
      if (!W || !H) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const T = (now - t0) / 1000, sum = getSum(), lvl = sum ? sum.lvl : 0;
      const ti = [0.5, 0.72, 0.85, 0.95, 1][lvl], tr = [0.08, 0.18, 0.35, 0.6, 0.9][lvl];
      inten += (ti - inten) * Math.min(1, dt * 1.5); red += (tr - red) * Math.min(1, dt * 1.5);
      const hz = H * 0.66, sp = sprites();
      // night sky
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      const sky = g.createLinearGradient(0, 0, 0, hz);
      sky.addColorStop(0, '#02040c'); sky.addColorStop(0.55, '#061226'); sky.addColorStop(1, '#0b2a36');
      g.fillStyle = sky; g.fillRect(0, 0, W, hz + 2);
      // green airglow wash behind the curtains
      const wash = g.createRadialGradient(W * 0.5, hz, 0, W * 0.5, hz, H * 0.9);
      wash.addColorStop(0, `rgba(40,255,150,${0.16 * inten})`); wash.addColorStop(0.5, `rgba(30,180,140,${0.07 * inten})`); wash.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = wash; g.fillRect(0, 0, W, hz);
      if (red > 0.3) { const rw = g.createLinearGradient(0, 0, 0, hz * 0.6); rw.addColorStop(0, `rgba(200,40,120,${0.12 * red})`); rw.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rw; g.fillRect(0, 0, W, hz * 0.6); }
      // stars
      g.fillStyle = '#fff';
      for (const s of stars) { g.globalAlpha = (0.35 + 0.55 * (0.5 + 0.5 * Math.sin(T * 1.7 + s[3] * 3))) * (1 - inten * 0.35); g.beginPath(); g.arc(s[0] * W, s[1] * H, s[2] * dpr * 0.8, 0, 6.283); g.fill(); }
      // a shooting star now and then
      if (!meteor && Math.random() < dt / 9) meteor = { x: Math.random() * W * 0.8 + W * 0.1, y: Math.random() * H * 0.25, t: 0 };
      if (meteor) {
        meteor.t += dt; const k = meteor.t / 0.7, x = meteor.x + k * W * 0.25, y = meteor.y + k * H * 0.12;
        const mg = g.createLinearGradient(x, y, x - W * 0.08, y - H * 0.04); mg.addColorStop(0, 'rgba(255,255,255,.9)'); mg.addColorStop(1, 'rgba(255,255,255,0)');
        g.globalAlpha = Math.sin(Math.min(1, k) * Math.PI); g.strokeStyle = mg; g.lineWidth = 1.4 * dpr; g.beginPath(); g.moveTo(x, y); g.lineTo(x - W * 0.08, y - H * 0.04); g.stroke();
        if (k >= 1) meteor = null;
      }
      // the curtains: thousands of rays, rippling along each band
      g.globalCompositeOperation = 'lighter';
      const sx = 2.6 * dpr, wd = sx * 2.4;
      for (let bi = 0; bi < bands.length; bi++) {
        const b = bands[bi]; if (lvl < b.min) continue;
        const fade = lvl === b.min ? clamp(inten - [0, 0.5, 0.7, 0.88][b.min] + 0.25, 0.25, 1) : 1;
        const lowQ = lvl === 0 && bi === 0; // quiet: just a glow low on the horizon
        let i = 0;
        for (let x = -wd; x < W + wd; x += sx, i++) {
          const u = x / W;
          const base = H * ((lowQ ? 0.62 : b.y) + b.amp * Math.sin(u * b.f * 6.283 + T * b.s * 6 + b.ph) + b.amp * 0.45 * Math.sin(u * b.f * 15.7 - T * b.s * 11 + b.ph * 2));
          const fold = 0.5 + 0.5 * Math.sin(u * 23 + Math.sin(u * 5 + T * 0.3) * 3 + b.ph);
          const hgt = H * b.h * (lowQ ? 0.55 : 1) * (0.62 + 0.38 * Math.sin(u * 11 + T * 0.27 + b.ph)) * (0.65 + 0.35 * inten);
          const ripple = 0.5 + 0.5 * Math.sin(u * 60 - T * 2.6 + b.ph * 3);
          const flick = 0.75 + 0.25 * Math.sin(T * 7 + i * 2.399);
          const ends = clamp(Math.min(u + 0.15, 1.15 - u) * 3, 0, 1);
          const a = b.a * inten * fade * ends * (0.25 + 0.75 * fold) * (0.55 + 0.45 * ripple) * flick;
          if (a < 0.02) continue;
          g.globalAlpha = Math.min(1, a * 0.5);
          g.drawImage(sp.g, x, base - hgt, wd, hgt);
          if (red > 0.05) { g.globalAlpha = Math.min(1, a * red * 0.9); g.drawImage(sp.r, x, base - hgt * 1.75, wd, hgt * 1.75); }
          if (lvl >= 3) { g.globalAlpha = Math.min(1, a * 0.5); g.drawImage(sp.b, x, base - hgt * 0.12, wd, hgt * 0.3); }
        }
      }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      // far mountains
      g.fillStyle = '#050b14'; g.fill(ridge);
      // lake: the sky mirrored, darker and rippling
      const L = H - hz;
      g.save(); g.globalAlpha = 0.6; g.setTransform(1, 0, 0, -1, 0, 2 * hz);
      g.drawImage(cv, 0, hz - L, W, L, 0, hz - L, W, L); g.restore();
      const lake = g.createLinearGradient(0, hz, 0, H);
      lake.addColorStop(0, 'rgba(2,8,16,.15)'); lake.addColorStop(1, 'rgba(1,4,10,.7)');
      g.fillStyle = lake; g.fillRect(0, hz, W, L);
      g.globalAlpha = 0.18; g.fillStyle = '#9fe';
      for (let k = 0; k < 14; k++) { const yy = hz + (k + 1) * L / 15, xx = ((T * 12 * (k % 2 ? 1 : -1) + k * 97) % W + W) % W; g.fillRect(xx, yy, W * 0.12, dpr * 0.6); g.fillRect((xx + W * 0.5) % W, yy, W * 0.07, dpr * 0.6); }
      g.globalAlpha = 1; g.fillStyle = '#01040a'; g.fill(fg);
    }
    raf = requestAnimationFrame(loop);
  }

  // ---------------- polar globes ----------------
  function vec(lat, lon) { const a = lat * rad, b = lon * rad; return [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)]; }
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function poleScene(cv, sgn, getS, getPlace, noDrag) {
    const g = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0, R = 0, cx = 0, cy = 0;
    let base = null, baseKey = '', glow = null, halo = null, glowKey = '';
    let spin = 0, vel = 0, drag = null, lowUntil = 0, raf = 0;
    const vis = watchVis(cv);
    const q = rng(sgn > 0 ? 3 : 5), stars = Array.from({ length: 160 }, () => [q(), q(), q() * 1.1 + 0.2, q() * 6.28]);
    function size() {
      const r = cv.getBoundingClientRect(); W = Math.round(r.width * dpr); H = Math.round(r.height * dpr);
      if (!W || !H) return; cv.width = W; cv.height = H;
      R = W * 0.5; cx = W / 2; cy = H * 0.8; baseKey = glowKey = '';
    }
    size();
    function view() {
      const ss = EV()._subsolar(new Date());
      const lat0 = sgn * 27 * rad, lon0 = (ss.lon + 180 + spin) * rad;
      const C = [Math.cos(lat0) * Math.cos(lon0), Math.cos(lat0) * Math.sin(lon0), Math.sin(lat0)];
      let E = [-Math.sin(lon0), Math.cos(lon0), 0], N = [-Math.sin(lat0) * Math.cos(lon0), -Math.sin(lat0) * Math.sin(lon0), Math.cos(lat0)];
      if (sgn < 0) { E = E.map((x) => -x); N = N.map((x) => -x); } // turn the south view so its pole is on top too
      return { ss, C, E, N, Sv: vec(ss.lat, ss.lon) };
    }
    // the globe: dark night side, sunlit day side beyond the pole
    function drawBase(v, sc) {
      const w = Math.max(1, Math.round(W * sc)), h = Math.max(1, Math.round(H * sc)), r = R * sc, ox = cx * sc, oy = cy * sc;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const gg = c.getContext('2d'), img = gg.createImageData(w, h), px = img.data;
      const isLand = EV()._isLand;
      const y0 = Math.max(0, Math.floor(oy - r)), y1 = Math.min(h, Math.ceil(oy + r)), x0 = Math.max(0, Math.floor(ox - r)), x1 = Math.min(w, Math.ceil(ox + r));
      for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) {
        const nx = (i - ox + 0.5) / r, ny = -(j - oy + 0.5) / r, r2 = nx * nx + ny * ny;
        if (r2 > 1) continue;
        const nz = Math.sqrt(1 - r2);
        const P0 = nx * v.E[0] + ny * v.N[0] + nz * v.C[0], P1 = nx * v.E[1] + ny * v.N[1] + nz * v.C[1], P2 = nx * v.E[2] + ny * v.N[2] + nz * v.C[2];
        const lat = Math.asin(clamp(P2, -1, 1)) / rad, lon = Math.atan2(P1, P0) / rad;
        const sun = P0 * v.Sv[0] + P1 * v.Sv[1] + P2 * v.Sv[2];
        const day = clamp((sun + 0.1) / 0.25, 0, 1);
        const land = isLand(lat, lon), ice = lat > 75 || lat < -62 || (land && lat > 60 && lon > -75 && lon < -10);
        let R0, G0, B0;
        if (ice) { R0 = 205; G0 = 218; B0 = 232; } else if (land) { R0 = 92; G0 = 116; B0 = 84; } else { R0 = 18; G0 = 52; B0 = 104; }
        const lit = 0.75 * day * (0.5 + 0.5 * Math.max(0, sun)), limb = 0.55 + 0.45 * nz;
        // night colours: deep navy sea, slightly lighter land and pale snow
        const nr = ice ? 26 : land ? 16 : 5, ng = ice ? 34 : land ? 22 : 10, nb = ice ? 52 : land ? 34 : 24;
        const k = (j * w + i) * 4;
        px[k] = (R0 * lit + nr * (1 - day)) * limb; px[k + 1] = (G0 * lit + ng * (1 - day)) * limb; px[k + 2] = (B0 * lit + nb * (1 - day)) * limb; px[k + 3] = 255;
      }
      gg.putImageData(img, 0, 0);
      return c;
    }
    // the oval's glow, drawn small and scaled up so it comes out soft
    function drawGlow(v, a, sc, color) {
      const w = Math.max(1, Math.round(W * sc)), h = Math.max(1, Math.round(H * sc)), r = R * sc * 1.03, ox = cx * sc, oy = cy * sc;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const gg = c.getContext('2d'), img = gg.createImageData(w, h), px = img.data;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const nx = (i - ox + 0.5) / r, ny = -(j - oy + 0.5) / r, r2 = nx * nx + ny * ny;
        if (r2 > 1) continue;
        const nz = Math.sqrt(1 - r2);
        const P0 = nx * v.E[0] + ny * v.N[0] + nz * v.C[0], P1 = nx * v.E[1] + ny * v.N[1] + nz * v.C[1], P2 = nx * v.E[2] + ny * v.N[2] + nz * v.C[2];
        const lat = Math.asin(clamp(P2, -1, 1)) / rad;
        if (lat * sgn < 30) continue;
        const p = sample(a, lat, Math.atan2(P1, P0) / rad);
        if (p < 1.5) continue;
        const sun = P0 * v.Sv[0] + P1 * v.Sv[1] + P2 * v.Sv[2], dark = clamp((0.12 - sun) / 0.3, 0, 1);
        const al = Math.pow(Math.min(1, p / 50), 0.8) * (0.2 + 0.8 * dark) * 0.8, k = (j * w + i) * 4;
        if (color === 'g') { px[k] = 30 + 90 * clamp((p - 50) / 50, 0, 1); px[k + 1] = 235; px[k + 2] = 140; }
        else { px[k] = 255; px[k + 1] = 60; px[k + 2] = 180; }
        px[k + 3] = 255 * al;
      }
      gg.putImageData(img, 0, 0);
      return c;
    }
    // spin by dragging sideways; vertical drags still scroll the page
    if (!noDrag) cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, s: spin, on: false, lx: e.clientX, lt: performance.now() }; vel = 0; });
    cv.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.on) { if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) { drag.on = true; try { cv.setPointerCapture(e.pointerId); } catch (er) { } } else return; }
      const per = 57.3 / (R / dpr) * 0.9, now = performance.now();
      spin = drag.s - dx * per;
      vel = -(e.clientX - drag.lx) * per / Math.max(8, now - drag.lt) * 1000; drag.lx = e.clientX; drag.lt = now;
      lowUntil = now + 250;
    });
    const end = () => { if (drag && !drag.on) vel = 0; drag = null; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('dblclick', () => { spin = 0; vel = 0; baseKey = ''; });

    let last = performance.now(), t0 = last, lastV = null;
    function loop(now) {
      if (!cv.isConnected) { raf = 0; return; }
      raf = requestAnimationFrame(loop);
      if (document.hidden || !vis.on) { last = now; return; }
      const rr = cv.getBoundingClientRect();
      if (Math.round(rr.width * dpr) !== W) size();
      if (!W || !H) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const T = (now - t0) / 1000, S = getS(), ov = S.ovation;
      if (!drag && Math.abs(vel) > 0.5) { spin += vel * dt; vel *= Math.pow(0.04, dt); lowUntil = now + 200; } else if (!drag) vel = 0;
      const low = now < lowUntil;
      const v = view(); lastV = v;
      const minute = Math.floor(Date.now() / 60000);
      const bk = (low ? 'L' : 'H') + '|' + W + '|' + spin.toFixed(low ? 1 : 2) + '|' + minute;
      if (bk !== baseKey) { base = drawBase(v, low ? 0.4 : 1); baseKey = bk; }
      const gk = W + '|' + spin.toFixed(1) + '|' + minute + '|' + (ov ? +ov.obs : 0);
      if (ov && gk !== glowKey && (!low || !glow || now - (drawGlow.t || 0) > 60)) { const a = arr(ov); glow = drawGlow(v, a, 0.3, 'g'); halo = drawGlow(v, a, 0.1, 'r'); glowKey = gk; drawGlow.t = now; }
      // space
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.fillStyle = '#02050c'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff';
      for (const s of stars) { g.globalAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(T * 1.3 + s[3] * 4)); g.beginPath(); g.arc(s[0] * W, s[1] * H, s[2] * dpr * 0.7, 0, 6.283); g.fill(); }
      g.globalAlpha = 1;
      // sunlight coming from beyond the pole
      const sx = dot(v.Sv, v.E), sy = dot(v.Sv, v.N), sl = Math.hypot(sx, sy) || 1;
      const sunX = cx + sx / sl * R * 1.5, sunY = cy - sy / sl * R * 1.5;
      const sg = g.createRadialGradient(sunX, sunY, 0, sunX, sunY, R * 1.3);
      sg.addColorStop(0, 'rgba(255,230,170,.32)'); sg.addColorStop(0.4, 'rgba(255,200,120,.08)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sg; g.fillRect(0, 0, W, H);
      // atmosphere
      const at = g.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.12);
      at.addColorStop(0, 'rgba(90,160,255,.45)'); at.addColorStop(0.35, 'rgba(60,120,255,.14)'); at.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = at; g.beginPath(); g.arc(cx, cy, R * 1.12, 0, 6.283); g.fill();
      if (base) g.drawImage(base, 0, 0, W, H);
      if (!ov) { g.fillStyle = 'rgba(255,255,255,.6)'; g.font = `${13 * dpr}px system-ui,sans-serif`; g.textAlign = 'center'; g.fillText('Loading NOAA\'s aurora map…', cx, cy); return; }
      const pr = profile(ov)[sgn > 0 ? 'N' : 'S'];
      const lvl = Math.max(kpLevel(EV().reading ? EV().reading(S).kp : null), edgeLevel(pr.edge));
      // glow, breathing
      g.globalCompositeOperation = 'lighter';
      if (glow) { g.globalAlpha = 0.7 + 0.2 * Math.sin(T * 0.9); g.drawImage(glow, 0, 0, W, H); }
      if (halo && lvl >= 2) { g.globalAlpha = (0.12 + 0.1 * lvl) * (0.8 + 0.2 * Math.sin(T * 0.6 + 1)); g.drawImage(halo, 0, 0, W, H); }
      // curtains standing on the oval, rippling and flickering; they rise above the limb on the far side
      const NB = 8, segs = [[], [], []].map(() => Array.from({ length: NB }, () => []));
      const redness = clamp(0.2 + 0.18 * lvl, 0, 1);
      for (let i = 0; i < 480; i++) {
        const lonF = i * 0.75, li = Math.floor(lonF), fr = lonF - li, lj = (li + 1) % 360;
        const I = (pr.I[li] * (1 - fr) + pr.I[lj] * fr) / 100;
        if (I < 0.05) continue;
        const c = pr.c[li] * (1 - fr) + pr.c[lj] * fr, w = pr.w[li] * (1 - fr) + pr.w[lj] * fr;
        for (let k = 0; k < 3; k++) {
          const lat = c + w * (0.55 * Math.sin(lonF * rad * 7 + T * 0.22 + k * 2.1) + 0.25 * Math.sin(lonF * rad * 19 - T * 0.5 + k)) + (k - 1) * w * 0.55;
          const P = vec(sgn * lat, lonF), dark = clamp((0.1 - dot(P, v.Sv)) / 0.25, 0, 1);
          if (dark < 0.05) continue;
          const flick = 0.55 + 0.45 * Math.sin(T * (1.6 + k * 0.5) + i * 2.399 + k * 1.3);
          const surge = 0.6 + 0.4 * Math.sin(lonF * rad * 2 - T * 0.16 + sgn);
          const b = Math.min(1, I * 1.7) * dark * flick * surge;
          if (b < 0.05) continue;
          const px = dot(P, v.E), py = dot(P, v.N), pz = dot(P, v.C), m = Math.hypot(px, py) || 1e-6;
          const hb = 1.01, ht = hb + (0.03 + 0.08 * Math.min(1, I * 1.4)) * (0.7 + 0.3 * Math.sin(i * 0.37 + T * 0.45));
          let s0 = hb;
          if (pz <= 0) { if (ht * m <= 1.002) continue; s0 = 1.002 / m; }
          const sm = s0 + (ht - s0) * 0.45;
          const x0 = cx + R * px * s0, y0 = cy - R * py * s0, xm = cx + R * px * sm, ym = cy - R * py * sm, x1 = cx + R * px * ht, y1 = cy - R * py * ht;
          const qb = Math.min(NB - 1, Math.floor(b * NB));
          segs[0][qb].push(x0, y0, x0 + (xm - x0) * 0.35, y0 + (ym - y0) * 0.35);
          segs[1][qb].push(x0, y0, xm, ym);
          segs[2][Math.min(NB - 1, Math.floor(qb * redness + 0.5))].push(xm, ym, x1, y1);
        }
      }
      g.lineCap = 'round';
      const cols = ['rgb(170,255,200)', 'rgb(40,255,140)', 'rgb(255,60,150)'], ca = [0.3, 0.3, 0.26], lw = [1.4, 1.5, 1.6];
      for (let ci = 0; ci < 3; ci++) {
        g.strokeStyle = cols[ci]; g.lineWidth = Math.max(1, R / 170) * lw[ci];
        for (let qb = 0; qb < NB; qb++) {
          const s = segs[ci][qb]; if (!s.length) continue;
          g.globalAlpha = ca[ci] * (qb + 0.5) / NB;
          g.beginPath(); for (let k = 0; k < s.length; k += 4) { g.moveTo(s[k], s[k + 1]); g.lineTo(s[k + 2], s[k + 3]); } g.stroke();
        }
      }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      // the poles' names and the user's place
      const pole = vec(sgn * 90, 0), pz = dot(pole, v.C);
      if (pz > 0) { const x = cx + R * dot(pole, v.E), y = cy - R * dot(pole, v.N); g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(x, y, 2 * dpr, 0, 6.283); g.fill(); g.font = `${10 * dpr}px system-ui,sans-serif`; g.textAlign = 'center'; g.fillText(sgn > 0 ? 'North Pole' : 'South Pole', x, y - 6 * dpr); }
      const pl = getPlace();
      if (pl && (pl.lat >= 0) === (sgn > 0)) {
        const P = vec(pl.lat, pl.lon), z = dot(P, v.C);
        if (z > 0.05) {
          const x = cx + R * dot(P, v.E), y = cy - R * dot(P, v.N), pu = 0.5 + 0.5 * Math.sin(T * 3);
          g.strokeStyle = `rgba(255,214,90,${0.8 - pu * 0.6})`; g.lineWidth = 1.5 * dpr; g.beginPath(); g.arc(x, y, (5 + pu * 9) * dpr, 0, 6.283); g.stroke();
          g.fillStyle = '#ffd65a'; g.beginPath(); g.arc(x, y, 3.2 * dpr, 0, 6.283); g.fill();
          g.font = `600 ${11.5 * dpr}px system-ui,sans-serif`; g.textAlign = x > W * 0.7 ? 'right' : 'left';
          const tx = x + (x > W * 0.7 ? -9 : 9) * dpr, lbl = pl.name.split(',')[0];
          g.lineWidth = 3 * dpr; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(lbl, tx, y + 4 * dpr); g.fillStyle = '#ffe9a8'; g.fillText(lbl, tx, y + 4 * dpr);
        }
      }
    }
    raf = requestAnimationFrame(loop);
  }

  // ---------------- where it can be seen ----------------
  const SPOTS = {
    N: [['Tromsø', 69.65, 18.96], ['Fairbanks', 64.84, -147.72], ['Reykjavík', 64.15, -21.94], ['Yellowknife', 62.45, -114.37], ['Rovaniemi', 66.5, 25.73], ['Murmansk', 68.97, 33.08], ['Anchorage', 61.22, -149.9],
      ['Oslo', 59.91, 10.75], ['Stockholm', 59.33, 18.07], ['Helsinki', 60.17, 24.94], ['Edinburgh', 55.95, -3.19], ['Copenhagen', 55.68, 12.57], ['Moscow', 55.76, 37.62], ['Calgary', 51.05, -114.07],
      ['Berlin', 52.52, 13.4], ['Amsterdam', 52.37, 4.9], ['London', 51.51, -0.13], ['Seattle', 47.61, -122.33], ['Paris', 48.86, 2.35], ['Munich', 48.14, 11.58], ['Minneapolis', 44.98, -93.27], ['Toronto', 43.65, -79.38], ['Chicago', 41.88, -87.63], ['New York', 40.71, -74.01], ['Rome', 41.9, 12.5]],
    S: [['McMurdo', -77.85, 166.67], ['Macquarie Island', -54.5, 158.94], ['Ushuaia', -54.8, -68.3], ['Punta Arenas', -53.16, -70.91], ['Invercargill', -46.41, 168.35], ['Dunedin', -45.88, 170.5], ['Queenstown', -45.03, 168.66],
      ['Hobart', -42.88, 147.33], ['Christchurch', -43.53, 172.64], ['Wellington', -41.29, 174.78], ['Melbourne', -37.81, 144.96], ['Adelaide', -34.93, 138.6], ['Cape Town', -33.92, 18.42], ['Perth', -31.95, 115.86], ['Sydney', -33.87, 151.21]],
  };
  function spots(S, h, ss) {
    if (!S.ovation) return '';
    const out = [];
    for (const [n, la, lo] of SPOTS[h]) {
      const a = S.ovation.at(la, lo), how = a.here >= 10 ? 'overhead' : a.horizon >= 10 ? 'on the horizon' : null;
      if (!how) continue;
      const dark = sunAlt(la, lo, ss) < -6;
      out.push(`<span class="auspot${dark ? '' : ' day'}${a.here >= 10 ? ' up' : ''}"><b>${esc(n)}</b>${how}${dark ? '' : ' · daylight'}</span>`);
      if (out.length >= 9) break;
    }
    return out.length ? out.join('') : `<span class="auspot none">Only over the ${h === 'N' ? 'Arctic' : 'Antarctic'} right now</span>`;
  }


  // ---------------- Tonight: aurora chance × clear sky × darkness → go / maybe / stay in ----------------
  let wx = { key: '', data: null, err: null, at: 0, busy: false };
  function wxFor(pl, force) {
    if (!pl) return null;
    const key = pl.lat.toFixed(2) + ',' + pl.lon.toFixed(2);
    if (wx.key !== key) wx = { key, data: null, err: null, at: 0, busy: false };
    if (!wx.busy && (force || !wx.data || Date.now() - wx.at > 30 * 60e3) && !(wx.err && !force && Date.now() - wx.at < 5 * 60e3)) {
      wx.busy = true; wx.at = Date.now();
      const k = key;
      const pr = Data.clouds(pl.lat, pl.lon, force).then((d) => { if (wx.key === k) { wx.data = d; wx.err = null; } })
        .catch((e) => { if (wx.key === k) wx.err = e.message || 'No connection'; })
        .then(() => { if (wx.key === k) wx.busy = false; update(); });
      wx.pending = pr;
    }
    return wx;
  }
  // chance of seeing it at a magnetic latitude for a given Kp (same edge table as the history)
  function kpChance(kp, ml) {
    if (kp == null || !window.TabHist) return 0;
    const m = ml - TabHist._edge(kp);
    return Math.round(m >= 2 ? 60 + Math.min(30, (m - 2) * 5) : m >= -2 ? 15 + (m + 2) * 11 : Math.max(0, 15 + (m + 2) * 7));
  }
  function moonAt(t, obs) {
    try {
      const A = window.Astronomy, e = A.Equator(A.Body.Moon, t, obs, true, true), h = A.Horizon(t, obs, e.ra, e.dec, 'normal');
      return { alt: h.altitude, ill: A.Illumination(A.Body.Moon, t).phase_fraction };
    } catch (er) { return { alt: -90, ill: 0 }; }
  }
  function tonight(S, pl) {
    if (!pl) return null;
    const w = wxFor(pl);
    const ml = window.TabHist ? TabHist._mlat(pl.lat, pl.lon) : null;
    const obs = window.Astronomy ? new Astronomy.Observer(pl.lat, pl.lon, 0) : null;
    const now = Date.now(), h0 = Math.floor(now / 3600e3) * 3600e3;
    const ov = S.ovation ? S.ovation.at(pl.lat, pl.lon) : null, ovC = ov ? Math.max(ov.here, ov.horizon) : null;
    const fc = (S.kpFc || []).filter((r) => r.t && r.kp != null).sort((a, b) => a.t - b.t);
    const kpNow = EV().reading ? EV().reading(S).kp : null;
    const kpAt = (t) => { const r = fc.find((x) => +x.t <= t && t < +x.t + 3 * 3600e3); return r ? r.kp : kpNow; }; // NOAA's 3-hour forecast blocks
    const hours = [];
    let started = false;
    for (let i = 0; i < 30; i++) {
      const t = i === 0 ? now : h0 + i * 3600e3, d = new Date(t);
      const sa = sunAlt(pl.lat, pl.lon, EV()._subsolar(d));
      const dark = sa <= -12 ? 1 : sa <= -6 ? 0.4 + 0.6 * (-6 - sa) / 6 : 0;
      if (!dark) { if (started) break; continue; }
      started = true;
      const mo = obs ? moonAt(d, obs) : { alt: -90, ill: 0 }, moon = mo.alt > 0 ? 1 - 0.4 * mo.ill * Math.min(1, mo.alt / 20) : 1;
      const cw = w && w.data ? w.data.reduce((a, x) => (Math.abs(x.t - t) < Math.abs(a.t - t) ? x : a), w.data[0]) : null;
      const cl = cw && Math.abs(cw.t - t) < 2 * 3600e3 ? Math.min(100, Math.round(cw.lo != null ? Math.max(cw.lo, 0.8 * (cw.mid || 0), 0.4 * (cw.hi || 0)) : cw.c)) : null;
      const au = t - now < 90 * 60e3 && ovC != null ? ovC : kpChance(kpAt(t), ml);
      const clear = cl == null ? 0.6 : Math.pow(1 - cl / 100, 1.3);
      hours.push({ t, au, cl, dark, moon, moonUp: mo.alt > 0, moonIll: mo.ill, sun: sa, score: Math.round(100 * Math.min(1, au / 40) * clear * dark * moon) });
    }
    if (!hours.length) return { none: true, w };
    const best = hours.reduce((a, h) => (h.score > a.score ? h : a), hours[0]);
    const v = best.score >= 40 ? 'go' : best.score >= 18 ? 'maybe' : 'no';
    const darkFrom = hours[0].t > now + 5 * 60e3 ? hours[0].t : null;
    const auF = Math.min(1, best.au / 40), clF = best.cl == null ? 0.6 : 1 - best.cl / 100;
    let why;
    if (v === 'go') why = `Best around ${Fmt.time(new Date(best.t))} — look ${pl.lat >= 0 ? 'north' : 'south'}${best.cl != null && best.cl < 30 ? ', skies mostly clear' : ''}.`;
    else if (auF <= clF && auF <= best.dark) why = best.au < 5 ? `The aurora is too weak to reach ${esc(pl.name.split(',')[0])} tonight.` : `Only a small chance the aurora reaches this far${pl.lat >= 0 ? ' south' : ' north'}.`;
    else if (clF < best.dark) why = `Too cloudy — about ${best.cl}% cloud at the best time.`;
    else why = 'It won\'t be properly dark for long.';
    if (v !== 'go' && best.moonUp && best.moonIll > 0.6 && best.moon < 0.8) why += ' A bright Moon washes out faint aurora.';
    return { hours, best, v, why, darkFrom, w, ml };
  }
  const VERD = { go: ['GO', '#3dffb0', 'Go out tonight'], maybe: ['MAYBE', '#ffcf5a', 'Worth a look'], no: ['STAY IN', '#8a97ad', 'Not tonight'] };
  function tonightCard(S, pl) {
    if (!pl) return `<button class="card autn" data-auact="chplace"><div class="autn-h"><b>Tonight</b></div><p class="muted">Choose your city to get a go / no-go for tonight.</p></button>`;
    const x = tonight(S, pl);
    const city = esc(pl.name.split(',')[0]);
    if (!x || x.none) return `<div class="card autn"><div class="autn-h"><b>Tonight at ${city}</b></div><p class="muted">No real darkness at ${city} in the next day — the aurora can't be seen in daylight or bright twilight.</p></div>`;
    const [lbl, col, sub] = VERD[x.v], b = x.best;
    const loading = x.w && x.w.busy && !x.w.data;
    const strip = x.hours.map((h) => `<div class="autn-c${h === b ? ' best' : ''}"><i style="height:${Math.max(4, h.score)}%;background:${h.score >= 40 ? VERD.go[1] : h.score >= 18 ? VERD.maybe[1] : '#3b4659'}"></i><span>${Fmt.hour(new Date(h.t))}</span></div>`).join('');
    return `<button class="card autn" data-auact="tonight" style="--vc:${col}">
      <div class="autn-h"><b>Tonight at ${city}</b><span>${x.darkFrom ? 'Dark from ' + Fmt.time(new Date(x.darkFrom)) : 'Dark now'}</span></div>
      <div class="autn-top"><div class="autn-v"><em>${lbl}</em><small>${b.score}/100</small></div><div class="autn-t"><b>${sub}</b><span>${x.why}</span></div></div>
      <div class="autn-f"><span>✦ Aurora ${b.au}%</span><span>☁ ${loading ? '…' : b.cl == null ? 'no forecast' : b.cl + '% cloud'}</span><span>${b.moonUp ? '☾ Moon ' + Math.round(b.moonIll * 100) + '%' : '☾ Moon down'}</span></div>
      <div class="autn-s">${strip}</div></button>`;
  }
  function tonightSheet(host, S) {
    const pl = host.place(), x = tonight(S, pl); if (!x || x.none) return;
    host.openSheet(`<div class="stitle">${ic('aurora')} Tonight at ${esc(pl.name)}</div>
      <p class="lead">Each hour scores the chance of aurora at your city, how clear the sky is and how dark it is (Sun far enough below the horizon, Moon light). 40+ = go, 18–39 = maybe.</p>
      <div class="autn-tbl"><div class="hd"><span>Time</span><span>Aurora</span><span>Cloud</span><span>Sky</span><span>Score</span></div>
      ${x.hours.map((h) => `<div class="${h === x.best ? 'best' : ''}"><span>${Fmt.time(new Date(h.t))}</span><span>${h.au}%</span><span>${h.cl == null ? '--' : h.cl + '%'}</span><span>${h.dark < 1 ? 'twilight' : h.moonUp && h.moonIll > 0.5 ? 'moonlit' : 'dark'}</span><b style="color:${h.score >= 40 ? VERD.go[1] : h.score >= 18 ? VERD.maybe[1] : 'var(--muted)'}">${h.score}</b></div>`).join('')}</div>
      <p class="muted small">Aurora: NOAA's OVATION for the next ~90 minutes, after that NOAA's 3-day Kp forecast turned into a chance for your city (${x.ml != null ? Math.round(x.ml) + '° magnetic latitude' : ''}). Clouds: Open-Meteo forecast (low clouds count most). Moon and Sun: calculated on your phone.</p>`);
  }
  // ---------------- the page ----------------
  let page = null, hostRef = null, getSRef = null;
  function head(sum) {
    const l = sum.lvl;
    const t = ['Aurora is quiet', 'Aurora is active', 'Strong aurora now', 'Very strong aurora', 'Extreme aurora storm'][l];
    const kp = sum.kp != null ? 'Kp ' + (+sum.kp).toFixed(1).replace(/\.0$/, '') + ' · ' : '';
    const s = !sum.ready ? 'Loading NOAA\'s aurora map…' : l === 0 ? kp + 'a faint glow over the far north and south' : `${kp}reaching ${sum.N.edge != null ? sum.N.edge + '°N' : '--'} and ${sum.S.edge != null ? sum.S.edge + '°S' : '--'}`;
    return `<b>${t}</b><span>${s}</span><i class="aulvl" style="--al:${LVC[l]}">${[0, 1, 2, 3, 4].map((k) => `<em class="${k <= l ? 'on' : ''}"></em>`).join('')}${LVN[l]}</i>`;
  }
  function hemiStats(sum, h) {
    const x = sum[h];
    return `<div class="aust"><div><span>Reaches down to</span><b>${x.edge != null ? x.edge + '°' + h : '--'}</b></div><div><span>Brightest</span><b>${x.maxP ? x.maxP + '%' : '--'}</b></div><div><span>Strength</span><b style="color:${LVC[x.lvl]}">${LVN[x.lvl]}</b></div></div>`;
  }
  function alertRows(host) {
    const n = host.notif(), pl = host.place();
    if (!pl) return `<button class="row" data-auact="chplace">${ic('pin')}<span class="tx"><span class="t1">Choose your city for aurora alerts</span><span class="t2">Get a nudge when the aurora could be seen where you are</span></span></button>`;
    if (!Pro.on()) return `<button class="row prorow" data-pro="aurora">${ic('aurora')}<span class="tx"><span class="t1">Aurora alerts at ${esc(pl.name)}</span><span class="t2">A notification when it's worth heading outside</span></span>${Pro.pill(true)}</button>`;
    const on = n.on && n.a > 0;
    return `<div class="row static col"><span class="t1">${ic('aurora')} Notify me at ${esc(pl.name)} when the chance reaches</span>
      ${host.seg('aa', String(n.on ? n.a : 0), [['0', 'Off'], ['5', '5%'], ['10', '10%'], ['20', '20%'], ['40', '40%']])}
      <span class="t2" style="margin-top:6px">${on ? `On · Solar checks NOAA every 30 minutes, even when closed. 5% means low on the horizon; 20%+ means likely overhead.` : n.on ? 'Off — pick a level to switch aurora alerts on.' : 'Picking a level turns on Solar\'s notifications.'}</span></div>`;
  }
  function placeRow(pl, sum) {
    if (!pl) return `<button class="row auplace" data-auact="chplace">${ic('pin')}<span class="tx"><span class="t1">Choose your city</span><span class="t2">See the chance of aurora where you are</span></span><span class="auchg">Choose</span></button>`;
    const x = sum.place;
    return `<button class="row auplace" data-auact="chplace">${ic(pl.gps ? 'gps' : 'pin')}<span class="tx"><span class="t1">${esc(pl.name)}${x ? `: <b id="auplv" style="color:${x.chance >= 10 ? '#7cf0b0' : 'var(--text)'}">${x.chance}%</b>` : ''}</span><span class="t2" id="aupls">${x ? (x.here >= 10 ? 'May be overhead' : x.horizon >= 5 ? 'Look low toward the ' + (x.hemi === 'N' ? 'north' : 'south') : 'Unlikely right now') + (x.dark ? ' · dark now' : ' · daylight now') : 'Loading NOAA\'s aurora map…'}</span></span><span class="auchg">Change</span></button>`;
  }
  // pick the city: saved places with their live aurora chance, my location, or search
  function placeSheet(host, S) {
    const cur = host.place(), l = host.placesList();
    const same = (p) => cur && Math.abs(p.lat - cur.lat) < 0.03 && Math.abs(p.lon - cur.lon) < 0.03 && p.name === cur.name;
    const ss = EV()._subsolar(new Date());
    host.openSheet(`<div class="stitle">${ic('aurora')} Aurora at…</div>
      <div class="eplist">${l.map((p, i) => {
        const a = S.ovation ? S.ovation.at(p.lat, p.lon) : null, v = a ? Math.max(a.here, a.horizon) : null, dark = sunAlt(p.lat, p.lon, ss) < -6;
        return `<button class="row${same(p) ? ' on' : ''}" data-pi="${i}">${p.gps ? ic('gps') : ic('pin')}<span class="tx"><span class="t1">${esc(p.name)}</span><span class="t2">${v == null ? 'Loading…' : (a.here >= 10 ? 'May be overhead' : a.horizon >= 5 ? 'Low on the horizon' : 'Unlikely now') + (dark ? ' · dark' : ' · daylight')}</span></span><b class="aupct" style="color:${v >= 10 ? '#7cf0b0' : 'var(--muted)'}">${v == null ? '' : v + '%'}</b></button>`;
      }).join('') || '<p class="muted">No places yet.</p>'}</div>
      <div class="pacts"><button class="btn" data-pa3="gps">${ic('gps')} My location</button><button class="btn ghost" data-pa3="add">${ic('plus')} Add a city</button></div>
      <button class="card linkcard" data-pa3="manage"><span class="lc-ic">${ic('pin')}</span><span class="tx"><b>Manage places</b><small>Remove places · local time, Sun and aurora at each</small></span>${ic('right')}</button>
      <p class="muted small">Your aurora alerts follow the city you pick here.</p>`, (sh) => {
      sh.addEventListener('click', (e) => {
        const r = e.target.closest('[data-pi]');
        if (r) { const p = l[+r.dataset.pi]; host.closeSheet(); if (!same(p)) host.setPlace(p); return; }
        const b = e.target.closest('[data-pa3]');
        if (!b) return;
        host.closeSheet();
        if (b.dataset.pa3 === 'manage') host.setTab('places');
        else if (b.dataset.pa3 === 'gps') host.locate();
        else setTimeout(() => host.searchSheet(), 300);
      });
    });
  }
  // Free: the live sky, today's strength and the northern globe. Pro: everything else.
  const TONIGHT_PREVIEW = `<div class="card autn" style="--vc:#3dffb0"><div class="autn-h"><b>Tonight at your city</b><span>Dark from 18:40</span></div>
    <div class="autn-top"><div class="autn-v"><em>GO</em><small>72/100</small></div><div class="autn-t"><b>Go out tonight</b><span>Best around 23:00 — look north, skies mostly clear.</span></div></div>
    <div class="autn-s">${[20, 38, 55, 72, 70, 64, 52, 40, 30].map((v) => `<div class="autn-c"><i style="height:${v}%;background:${v >= 40 ? '#3dffb0' : '#ffcf5a'}"></i><span></span></div>`).join('')}</div></div>`;
  function freeBody(host, S) {
    const sum = summary(S, null), al = alertOf(sum);
    return `<div class="auhero"><canvas id="ausky" aria-label="Animated aurora over a lake"></canvas><div class="auhead" id="auhead">${head(sum)}</div></div>
      <div id="aualert">${al ? `<div class="aualert"><i></i><span><b>${al.title}</b>${al.text}</span></div>` : ''}</div>
      <div id="autonight">${Pro.lockCard(TONIGHT_PREVIEW, 'aurora', 'Tonight at your city', 'Go, maybe or stay in — aurora chance, clouds and darkness, hour by hour')}</div>
      <div class="sect-row ausect"><div class="sect">Northern lights right now</div></div>
      <div class="aupoles v-N">
        <div class="aupole" data-h="N"><canvas id="aucvN" aria-label="The northern aurora oval"></canvas><div class="aulbl"><b>Northern lights</b><span>Aurora borealis</span></div></div>
        <div class="aust-wrap" data-h="N" id="austN">${hemiStats(sum, 'N')}</div>
      </div>
      ${Pro.lockCard('<div style="height:120px;background:radial-gradient(60% 80% at 50% 100%,rgba(60,255,160,.35),transparent),#050a14"></div>', 'aurora', 'Southern lights, spinning globes and where to see it', 'Both poles on globes you can spin, and the cities that can see the aurora right now')}
      <div class="sect">Aurora alerts</div>
      <div class="card list" id="aualerts">${alertRows(host)}</div>
      <p class="attrib">Data: NOAA SWPC OVATION aurora model and Kp · Map: Natural Earth</p>`;
  }
  function body(host, S) {
    if (window.Pro && !Pro.on()) return freeBody(host, S);
    const pl = host.place(), sum = summary(S, pl), al = alertOf(sum);
    const view = Store.get('auView', 'both');
    return `<div class="auhero"><canvas id="ausky" aria-label="Animated aurora over a lake"></canvas><div class="auhead" id="auhead">${head(sum)}</div></div>
      <div id="aualert">${al ? `<div class="aualert"><i></i><span><b>${al.title}</b>${al.text}</span></div>` : ''}</div>
      ${placeRow(pl, sum)}
      <div id="autonight">${tonightCard(S, pl)}</div>
      <div class="sect-row ausect"><div class="sect">Both ovals right now</div>${host.seg('auv', view, [['both', 'Both'], ['N', 'North'], ['S', 'South']])}</div>
      <div class="aupoles v-${view}">
        <div class="aupole" data-h="N"><canvas id="aucvN" aria-label="The northern aurora oval"></canvas><div class="aulbl"><b>Northern lights</b><span>Aurora borealis</span></div></div>
        <div class="aust-wrap" data-h="N" id="austN">${hemiStats(sum, 'N')}<div class="auspots">${spots(S, 'N', sum.ss)}</div></div>
        <div class="aupole" data-h="S"><canvas id="aucvS" aria-label="The southern aurora oval"></canvas><div class="aulbl"><b>Southern lights</b><span>Aurora australis</span></div></div>
        <div class="aust-wrap" data-h="S" id="austS">${hemiStats(sum, 'S')}<div class="auspots">${spots(S, 'S', sum.ss)}</div></div>
      </div>
      <p class="muted small">NOAA forecast${sum.fc ? ' for ' + U.Fmt.time(sum.fc) : ''} · drag a globe to spin it · ⓘ at the top explains it all</p>
      <div class="sect">Aurora alerts</div>
      <div class="card list" id="aualerts">${alertRows(host)}</div>
      <p class="attrib">Data: NOAA SWPC OVATION aurora model and Kp · Map: Natural Earth</p>`;
  }
  // the Aurora tab
  function render(host, S) {
    hostRef = host; getSRef = () => S;
    const p = host.tabShell('aurora', `<div class="tab-title">Aurora</div>
      ${host.statRow('Northern & southern lights ·')}` + body(host, S));
    page = p;
    skyScene(p.querySelector('#ausky'), () => summary(S, host.place()));
    const pro = !window.Pro || Pro.on();
    poleScene(p.querySelector('#aucvN'), 1, () => S, pro ? host.place : () => null, !pro);
    if (pro) poleScene(p.querySelector('#aucvS'), -1, () => S, host.place);
    p.addEventListener('click', (e) => {
      const b = e.target.closest('[data-seg] button');
      if (b) {
        const k = b.parentNode.dataset.seg, v = b.dataset.v;
        b.parentNode.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        if (k === 'auv') { Store.set('auView', v); const w = p.querySelector('.aupoles'); w.className = 'aupoles v-' + v; }
        if (k === 'aa') {
          const n = host.notif(); n.a = +v;
          if (+v > 0 && !n.on) { host.saveNotif(n); host.toggleNotif(); } else host.saveNotif(n);
          refreshAlerts();
        }
        return;
      }
      const a = e.target.closest('[data-auact]');
      if (a && a.dataset.auact === 'place') host.setTab('places');
      if (a && a.dataset.auact === 'chplace') placeSheet(host, S);
      if (a && a.dataset.auact === 'tonight') tonightSheet(host, S);
    });
  }
  // the Earth tab's button, banner and card, and the alert toast, jump to the Aurora tab
  function open(host) { host.setTab('aurora'); }
  function refreshAlerts() { const el = page && page.querySelector('#aualerts'); if (el && hostRef) el.innerHTML = alertRows(hostRef); }
  // new data: refresh the text (the canvases read the data on every frame)
  function update() {
    if (!page || !page.isConnected || page.dataset.tab !== 'aurora' || !hostRef) return false;
    const S = getSRef(), pl = hostRef.place(), sum = summary(S, pl), al = alertOf(sum);
    const pro = !window.Pro || Pro.on();
    const set = (id, h) => { const el = page.querySelector('#' + id); if (el && el.innerHTML !== h) el.innerHTML = h; };
    set('auhead', head(sum));
    set('aualert', al ? `<div class="aualert"><i></i><span><b>${al.title}</b>${al.text}</span></div>` : '');
    set('austN', hemiStats(sum, 'N') + (pro ? `<div class="auspots">${spots(S, 'N', sum.ss)}</div>` : ''));
    set('austS', hemiStats(sum, 'S') + `<div class="auspots">${spots(S, 'S', sum.ss)}</div>`);
    if (pro) set('autonight', tonightCard(S, pl));
    const pr = page.querySelector('.auplace'); if (pr) { const h = placeRow(pl, sum); if (pr.outerHTML !== h) pr.outerHTML = h; }
    refreshAlerts();
    return true;
  }
  // Earth tab: the button and the banner
  function earthBits(S, place) {
    const sum = summary(S, place), al = alertOf(sum);
    return {
      btn: `<button class="aubtn${sum.lvl >= 1 || al ? ' live' : ''}" data-eact="auview" aria-label="Open the aurora view"><i></i>Aurora${sum.ready ? ` · ${LVN[sum.lvl]}` : ''}</button>`,
      banner: al ? `<button class="aualert tap" data-eact="auview"><i></i><span><b>${al.title}</b>${al.text}</span><em>Watch ›</em></button>` : '',
      sum, al,
    };
  }

  window.AuroraView = { refreshWx: () => { const p = hostRef && hostRef.place(); const w = wxFor(p, true); return w && w.pending; }, tonight, render, open, update, summary, alertOf, earthBits, isOpen: () => !!(page && page.isConnected && page.dataset.tab === 'aurora'), _profile: profile };
})();
