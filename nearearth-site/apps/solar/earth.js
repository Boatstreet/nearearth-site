/* Solar — Earth tab: the Earth right now, with everything the Sun is throwing at it.
   Live inputs: solar wind (speed, density, Bz), X-ray flux, proton flux, Kp, NOAA R/S/G scales,
   OVATION aurora, and CMEs heading for Earth (NASA DONKI model arrivals).
   The globe is drawn to scale with real day/night; the magnetic shield and distances are schematic. */
(function () {
  'use strict';
  const { Fmt, esc, $ } = U;
  const rad = Math.PI / 180;

  // ---------------- the Sun's position over Earth (subsolar point) ----------------
  function subsolar(d) {
    const jd = d.getTime() / 864e5 + 2440587.5, n = jd - 2451545;
    const L = (280.46 + 0.9856474 * n) % 360, g = ((357.528 + 0.9856003 * n) % 360) * rad;
    const lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad, eps = 23.439 * rad;
    const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
    const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
    const gmst = (280.46061837 + 360.98564736629 * n) % 360;
    let lon = (ra / rad - gmst) % 360; if (lon > 180) lon -= 360; if (lon < -180) lon += 360;
    return { lat: dec / rad, lon };
  }

  // ---------------- land mask from the bundled Natural Earth outlines ----------------
  let mask = null;
  function landMask() {
    if (mask) return mask;
    const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff';
    for (const [, polys] of window.WORLD || []) for (const p of polys) {
      g.beginPath(); let prev = null;
      for (let i = 0; i < p.length; i += 2) {
        let x = ((p[i] / 10 + 180) / 360) * W; const y = ((90 - p[i + 1] / 10) / 180) * H;
        if (prev != null && Math.abs(x - prev) > W / 2) x += x < prev ? W : -W; // keep shapes that cross 180° together
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); prev = x;
      }
      g.closePath(); g.fill();
      g.save(); g.translate(-W, 0); g.fill(); g.translate(2 * W, 0); g.fill(); g.restore();
    }
    const d = g.getImageData(0, 0, W, H).data, m = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) m[i] = d[i * 4] > 127 ? 1 : 0;
    mask = { m, W, H }; return mask;
  }
  const isLand = (lat, lon) => { const k = landMask(); const x = Math.floor(((lon + 180) / 360) * k.W) % k.W, y = Math.min(k.H - 1, Math.floor(((90 - lat) / 180) * k.H)); return k.m[y * k.W + (x < 0 ? x + k.W : x)]; };

  // ---------------- the globe (re-drawn once a minute) ----------------
  function drawGlobe(R, ss, ov) {
    const size = Math.ceil(R * 2) + 2, c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), img = g.createImageData(size, size), px = img.data;
    // Look at Earth from a point 90° east of the noon point, tilted to show the north:
    // the noon side then faces left, towards the Sun.
    const lat0 = 28 * rad, lon0 = (ss.lon + 90) * rad;
    const C = [Math.cos(lat0) * Math.cos(lon0), Math.cos(lat0) * Math.sin(lon0), Math.sin(lat0)];
    const E = [-Math.sin(lon0), Math.cos(lon0), 0];
    const N = [-Math.sin(lat0) * Math.cos(lon0), -Math.sin(lat0) * Math.sin(lon0), Math.cos(lat0)];
    const sl = ss.lat * rad, so = ss.lon * rad, Sv = [Math.cos(sl) * Math.cos(so), Math.cos(sl) * Math.sin(so), Math.sin(sl)];
    landMask();
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const nx = (i - size / 2 + 0.5) / R, ny = -(j - size / 2 + 0.5) / R, r2 = nx * nx + ny * ny;
      if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2);
      const P = [nx * E[0] + ny * N[0] + nz * C[0], nx * E[1] + ny * N[1] + nz * C[1], nx * E[2] + ny * N[2] + nz * C[2]];
      const lat = Math.asin(P[2]) / rad, lon = Math.atan2(P[1], P[0]) / rad;
      const sun = P[0] * Sv[0] + P[1] * Sv[1] + P[2] * Sv[2];
      const day = Math.max(0, Math.min(1, (sun + 0.08) / 0.22)); // soft twilight band
      const land = isLand(lat, lon), ice = Math.abs(lat) > 72 || (lat < -60);
      let r, gg, b;
      if (ice) { r = 222; gg = 232; b = 240; } else if (land) { r = 96 + 40 * (1 - Math.abs(lat) / 90); gg = 128; b = 82; } else { r = 22; gg = 70; b = 132; }
      const lit = 0.18 + 0.82 * day * (0.55 + 0.45 * Math.max(0, sun)), limb = 0.75 + 0.25 * nz;
      r = r * lit * limb; gg = gg * lit * limb; b = b * lit * limb;
      if (day < 0.5) { const nb = (0.5 - day) * 2; r = r * (1 - nb) + 8 * nb; gg = gg * (1 - nb) + 14 * nb; b = b * (1 - nb) + 34 * nb; if (land && !ice) { r += 6 * nb; gg += 8 * nb; b += 10 * nb; } }
      // aurora: NOAA OVATION probability, glowing on the dark and twilight side
      if (ov) {
        const p = ov.grid.get(((Math.round(lon) % 360) + 360) % 360 + ',' + Math.round(lat)) || 0;
        if (p > 3) {
          const a = Math.min(1, p / 45) * (1 - day * 0.75);
          gg += 210 * a; b += 90 * a; r += 40 * a;
          if (p > 30) r += 160 * (p - 30) / 70 * a;
        }
      }
      const k = (j * size + i) * 4;
      px[k] = Math.min(255, r); px[k + 1] = Math.min(255, gg); px[k + 2] = Math.min(255, b); px[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  // ---------------- physics helpers ----------------
  // Shue et al. (1998) magnetopause stand-off distance in Earth radii
  function standoff(n, v, bz) {
    if (!(n > 0) || !(v > 0)) return 10;
    const p = 1.6726e-6 * n * v * v;
    const b = bz == null ? 0 : bz;
    return (10.22 + 1.29 * Math.tanh(0.184 * (b + 8.14))) * Math.pow(p, -1 / 6.6);
  }
  const clsOf = (f) => (f >= 1e-4 ? 'X' : f >= 1e-5 ? 'M' : f >= 1e-6 ? 'C' : f >= 1e-7 ? 'B' : 'A');

  function reading(S) {
    const w = S.wind || {}, ss = subsolar(new Date());
    const v = w.v && w.v.v, n = w.n && w.n.n, bz = w.bz && w.bz.bz, bt = w.bt && w.bt.bt;
    const kpRow = S.kp && S.kp.rows && S.kp.rows.length ? S.kp.rows[S.kp.rows.length - 1] : null;
    const kp = kpRow ? kpRow.kp : null;
    const flux = S.xray && S.xray.now ? S.xray.now.f : null;
    const sc = S.scales && S.scales.now ? S.scales.now : { r: 0, s: 0, g: 0 };
    const pr = S.protons && S.protons.now ? S.protons.now.f : null;
    const cmes = window.CmeAnim ? CmeAnim.active(S.events) : [];
    const coming = cmes.filter((e) => +e.arrival > Date.now()), landed = cmes.filter((e) => +e.arrival <= Date.now());
    const r0 = standoff(n, v, bz);
    let ovalLat = null;
    if (S.ovation) { let lo = 90; for (const [k, p] of S.ovation.grid) { if (p < 10) continue; const la = +k.split(',')[1]; if (la > 0 && la < lo) lo = la; } ovalLat = lo < 90 ? lo : null; }
    return { ss, v, n, bz, bt, kp, flux, sc, pr, coming, landed, r0, ovalLat, pdyn: n && v ? 1.6726e-6 * n * v * v : null };
  }

  // ---------------- the animated scene ----------------
  let raf = 0, globe = null, globeAt = 0, globeKey = '';
  function scene(cv, getS) {
    const g = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let Wc = 0, Hc = 0;
    function size() { const r = cv.getBoundingClientRect(); Wc = Math.round(r.width * dpr); Hc = Math.round(r.height * dpr); cv.width = Wc; cv.height = Hc; }
    size();
    const stars = Array.from({ length: 140 }, () => [Math.random(), Math.random(), Math.random() * 1.2 + 0.2, Math.random()]);
    let parts = [], protons = [], flashT = -1e9, last = performance.now(), t0 = last;
    function loop(now) {
      if (!cv.isConnected) { raf = 0; return; }
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const S = getS(), R0 = reading(S), T = (now - t0) / 1000;
      const W = Wc, H = Hc, ex = W * 0.62, ey = H * 0.5, Re = Math.min(W, H) * 0.112; // zoomed out: whole shield and more of the Sun in view
      // globe image, refreshed every minute or when the aurora data changes
      const key = Math.round(Re) + '|' + (S.ovation ? +S.ovation.obs : 0);
      if (!globe || key !== globeKey || Date.now() - globeAt > 60000) { globe = drawGlobe(Re, R0.ss, S.ovation); globeKey = key; globeAt = Date.now(); }
      // shield size on screen: compressed when the wind pushes harder (schematic, not to scale)
      const mp = Re * (1.55 + Math.max(-0.35, Math.min(0.9, (R0.r0 - 6) * 0.13)));
      const bow = mp * 1.38;
      const storm = R0.kp != null ? Math.max(0, Math.min(1, (R0.kp - 3.5) / 4)) : 0;
      const wob = R0.landed.length ? Math.sin(T * 3) * Re * 0.04 : 0;
      const shape = (r0, a) => (th) => r0 * Math.pow(2 / (1 + Math.cos(th)), a);
      const mpR = shape(mp + wob, 0.62), bowR = shape(bow + wob, 0.85);

      g.clearRect(0, 0, W, H);
      // space
      const bg = g.createLinearGradient(0, 0, W, 0); bg.addColorStop(0, '#1a0f0a'); bg.addColorStop(0.35, '#070b16'); bg.addColorStop(1, '#03060d');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      for (const s of stars) { g.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(T * 0.6 + s[3] * 9)); g.fillStyle = '#fff'; g.fillRect(s[0] * W, s[1] * H, s[2] * dpr, s[2] * dpr); }
      g.globalAlpha = 1;

      // the Sun, off the left edge; brighter and redder with the X-ray level
      const xl = R0.flux ? Math.max(0, Math.min(1, (Math.log10(R0.flux) + 7) / 3)) : 0.2;
      const sr = H * (0.3 + 0.08 * xl), sx = -sr * 0.5, sy = ey;
      let sg = g.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 1.9);
      sg.addColorStop(0, 'rgba(255,240,200,1)'); sg.addColorStop(0.32, `rgba(255,${190 - 60 * xl},${90 - 50 * xl},.95)`); sg.addColorStop(0.55, `rgba(255,${120 - 40 * xl},40,${0.25 + 0.25 * xl})`); sg.addColorStop(1, 'rgba(255,90,30,0)');
      g.fillStyle = sg; g.beginPath(); g.arc(sx, sy, sr * 1.9, 0, 7); g.fill();
      g.fillStyle = '#ffd9a0'; g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill();

      // incoming CMEs: clouds on their way, at NASA's modelled position
      R0.coming.forEach((e, k) => {
        const f = Math.max(0, Math.min(1, (Date.now() - +e.t) / (+e.arrival - +e.t || 1)));
        const x0 = sx + sr * 0.9, x1 = ex - bow;
        const cx = x0 + (x1 - x0) * f, rr = H * (0.12 + 0.3 * f);
        const col = CmeAnim.colorFor(e, S.events);
        const cg = g.createRadialGradient(cx - rr * 0.3, ey, rr * 0.2, cx, ey, rr);
        cg.addColorStop(0, hexA(col, 0)); cg.addColorStop(0.7, hexA(col, 0.18)); cg.addColorStop(0.92, hexA(col, 0.5)); cg.addColorStop(1, hexA(col, 0));
        g.fillStyle = cg; g.beginPath(); g.ellipse(cx, ey + (k % 2 ? 1 : -1) * k * H * 0.03, rr * 0.55, rr, 0, -Math.PI / 2, Math.PI / 2); g.fill();
        g.fillStyle = col; g.font = `600 ${11 * dpr}px Roboto, system-ui`; g.textAlign = 'center';
        g.fillText('CME ' + CmeAnim.until(e.arrival), cx, Math.max(14 * dpr, ey - rr - 6 * dpr));
      });

      // solar wind particles flowing around the bow shock
      const want = Math.round(Math.max(40, Math.min(260, (R0.n || 5) * 14)));
      while (parts.length < want) parts.push({ x: Math.random() * W, y: Math.random() * H, j: Math.random() });
      if (parts.length > want) parts.length = want;
      const vs = (R0.v || 400) / 400 * W * 0.12, tail = Math.max(6, Math.min(26, (R0.v || 400) / 400 * 12)) * dpr;
      g.lineCap = 'round';
      for (const p of parts) {
        const ox = p.x, oy = p.y;
        p.x += vs * dt * (0.8 + p.j * 0.4);
        let dx = p.x - ex, dy = p.y - ey, rr = Math.hypot(dx, dy), th = Math.atan2(dy, -dx);
        const rb = Math.abs(th) < 2.6 ? bowR(Math.abs(th)) : 1e9;
        if (rr < rb) { // slide along the shock front, away from the Sun–Earth line
          const s2 = th >= 0 ? 1 : -1, th2 = th + s2 * 0.9 * dt * (1 + vs / W * 6);
          p.x = ex - Math.cos(th2) * rb; p.y = ey + Math.sin(th2) * rb;
        }
        let ux = p.x - ox, uy = p.y - oy; const m = Math.hypot(ux, uy);
        if (m > 0 && m < W * 0.05) { p.ux = ux / m; p.uy = uy / m; }
        if (p.x > W + 10 || p.y < -10 || p.y > H + 10) { p.x = sx + sr * (0.9 + Math.random() * 0.4); p.y = Math.random() * H; p.ux = 1; p.uy = 0; }
        const ux2 = p.ux == null ? 1 : p.ux, uy2 = p.uy || 0, a = 0.35 + 0.45 * p.j;
        const lg = g.createLinearGradient(p.x - ux2 * tail, p.y - uy2 * tail, p.x, p.y);
        lg.addColorStop(0, 'rgba(255,200,140,0)'); lg.addColorStop(1, `rgba(255,215,160,${a})`);
        g.strokeStyle = lg; g.lineWidth = (1 + p.j) * dpr;
        g.beginPath(); g.moveTo(p.x - ux2 * tail, p.y - uy2 * tail); g.lineTo(p.x, p.y); g.stroke();
      }

      // bow shock
      g.lineWidth = 1.5 * dpr; g.setLineDash([4 * dpr, 5 * dpr]);
      g.strokeStyle = `rgba(255,190,120,${0.35 + 0.3 * storm})`; curve(g, ex, ey, bowR, 2.3); g.stroke(); g.setLineDash([]);
      // magnetopause (the edge of Earth's magnetic shield)
      const sh = g.createLinearGradient(ex - mp, 0, ex + mp * 2.5, 0);
      sh.addColorStop(0, `rgba(${110 + 120 * storm},${170 - 60 * storm},255,.32)`); sh.addColorStop(1, 'rgba(110,170,255,0)');
      g.fillStyle = sh; curve(g, ex, ey, mpR, 2.55); g.closePath(); g.fill();
      g.strokeStyle = `rgba(${130 + 120 * storm},${190 - 70 * storm},255,.75)`; g.lineWidth = 2 * dpr; curve(g, ex, ey, mpR, 2.55); g.stroke();

      // field lines: squeezed on the day side, stretched into a tail on the night side
      g.lineWidth = 1 * dpr;
      for (const L of [1.55, 2.1, 2.8]) {
        for (const s of [1, -1]) {
          g.strokeStyle = `rgba(${150 + 105 * storm},${200 - 90 * storm},255,${0.22 + 0.25 * storm})`;
          g.beginPath();
          for (let k = 0; k <= 60; k++) {
            const lam = (-70 + (140 * k) / 60) * rad, r = Re * L * Math.cos(lam) ** 2;
            const day = s > 0, squeeze = day ? Math.min(1, (mp * 0.92) / (Re * 2.8)) : 1 + 0.25 * L;
            const x = ex - s * r * Math.cos(lam) * squeeze, y = ey - r * Math.sin(lam);
            if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
          }
          g.stroke();
        }
      }
      // open tail lines
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(ex + Re * 0.3, ey + s * Re * 0.9); g.bezierCurveTo(ex + Re * 2, ey + s * Re * 1.6, ex + Re * 3.5, ey + s * mp * 0.9, W + 5, ey + s * mp * 0.95); g.stroke(); }

      // ring current during storms
      if (storm > 0.05) {
        g.strokeStyle = `rgba(255,140,70,${0.25 + 0.5 * storm})`; g.lineWidth = (2 + 4 * storm) * dpr;
        g.beginPath(); g.ellipse(ex, ey, Re * 1.95, Re * 0.5, 0, 0, 7); g.stroke();
      }

      // atmosphere glow and the globe
      const ag = g.createRadialGradient(ex, ey, Re * 0.95, ex, ey, Re * 1.18);
      ag.addColorStop(0, 'rgba(120,190,255,.55)'); ag.addColorStop(1, 'rgba(120,190,255,0)');
      g.fillStyle = ag; g.beginPath(); g.arc(ex, ey, Re * 1.18, 0, 7); g.fill();
      g.drawImage(globe, ex - globe.width / 2, ey - globe.height / 2);

      // flare X-rays: flashes over the day side (radio blackout)
      const rLvl = Math.max(R0.sc.r || 0, R0.flux >= 1e-5 ? 1 : 0);
      if (rLvl > 0) {
        if (now - flashT > 2600 - 300 * rLvl) flashT = now;
        const a = Math.max(0, 1 - (now - flashT) / 900) * (0.3 + 0.12 * rLvl);
        g.save(); g.beginPath(); g.arc(ex, ey, Re * 1.04, Math.PI / 2, Math.PI * 1.5); g.closePath(); g.clip();
        const fg = g.createLinearGradient(ex - Re, 0, ex, 0); fg.addColorStop(0, `rgba(255,120,60,${a})`); fg.addColorStop(1, 'rgba(255,120,60,0)');
        g.fillStyle = fg; g.fillRect(ex - Re * 1.1, ey - Re * 1.1, Re * 1.1, Re * 2.2); g.restore();
        g.strokeStyle = `rgba(255,170,90,${a * 1.4})`; g.lineWidth = 1.5 * dpr;
        for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(sx + sr, ey + k * H * 0.06); g.lineTo(ex - Re * 1.02, ey + k * Re * 0.25); g.stroke(); }
      }

      // radiation storm: protons pouring into the polar caps
      const sLvl = Math.max(R0.sc.s || 0, R0.pr >= 10 ? 1 : 0);
      if (sLvl > 0) {
        while (protons.length < 30 * sLvl) protons.push({ k: Math.random(), s: Math.random() < 0.5 ? 1 : -1, d: Math.random() < 0.5 ? 1 : -1, o: Math.random() * 6 });
        g.fillStyle = 'rgba(255,90,140,.9)';
        for (const p of protons) {
          // slide down a field line from the equator to where it meets the ground near the pole
          const ph = ((T * 0.3 + p.o) % 1), L = 2 + p.k * 1.6, end = Math.acos(Math.sqrt(1 / L));
          const lam = ph * end * p.s, r = Re * L * Math.cos(lam) ** 2;
          const x = ex - p.d * r * Math.cos(lam) * (p.d > 0 ? Math.min(1, (mp * 0.92) / (Re * 2.8)) : 1), y = ey - r * Math.sin(lam);
          g.globalAlpha = 0.4 + 0.6 * ph; g.beginPath(); g.arc(x, y, 1.7 * dpr, 0, 7); g.fill();
        }
        g.globalAlpha = 1;
      } else protons.length = 0;

      // labels
      g.font = `500 ${10.5 * dpr}px Roboto, system-ui`; g.textAlign = 'left'; g.fillStyle = 'rgba(255,220,180,.85)';
      g.fillText('Solar wind →', 8 * dpr, H - 10 * dpr);
      g.textAlign = 'center'; g.fillStyle = 'rgba(170,205,255,.85)';
      g.fillText('Magnetic shield', ex - mp * 0.2, ey - mpR(1.2) * Math.sin(1.2) - 8 * dpr);
      g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,.35)'; g.fillText('Shield not to scale', W - 8 * dpr, H - 10 * dpr);
    }
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    window.addEventListener('resize', size, { once: true });
  }
  function curve(g, ex, ey, rf, maxTh) {
    g.beginPath();
    for (let k = 0; k <= 80; k++) { const th = -maxTh + (2 * maxTh * k) / 80, r = rf(Math.abs(th)); const x = ex - r * Math.cos(th), y = ey + r * Math.sin(th); if (k === 0) g.moveTo(x, y); else g.lineTo(x, y); }
  }
  function hexA(hex, a) { const n = parseInt(String(hex).slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

  // ---------------- the page ----------------
  const LV = ['var(--ok)', '#e8d454', '#ffb13d', '#ff8f3d', '#ff6b4a', '#ff4d6d'];
  function card(icon, title, value, sub, lvl, act) {
    return `<button class="row eatk" ${act ? `data-eact="${act}"` : ''} style="--lc:${LV[Math.max(0, Math.min(5, lvl))]}"><span class="edot"></span><span class="evic">${ic(icon)}</span><span class="tx"><span class="t1">${title}</span><span class="t2">${sub}</span></span><b class="eval">${value}</b></button>`;
  }
  function cards(S, place) {
    const r = reading(S), out = [];
    // solar wind & the shield
    const pushed = r.r0 < 7 ? 'squeezed hard' : r.r0 < 9 ? 'pushed in' : r.r0 < 11.5 ? 'normal' : 'relaxed';
    out.push(card('wind', 'Solar wind', r.v ? Math.round(r.v) + '<small> km/s</small>' : '--',
      r.v ? `${r.n != null ? r.n.toFixed(1) + ' particles/cm³ · ' : ''}shield ${pushed} to ${r.r0.toFixed(1)} Earth radii (normal ≈ 10)` : 'Waiting for NOAA', r.v >= 700 ? 3 : r.v >= 550 ? 2 : r.v >= 480 ? 1 : 0, 'wind'));
    out.push(card('magnet', 'Magnetic field Bz', r.bz != null ? r.bz.toFixed(1) + '<small> nT</small>' : '--',
      r.bz == null ? '' : r.bz <= -10 ? 'Pointing strongly south — the shield is wide open to the wind' : r.bz <= -3 ? 'Pointing south — energy is getting in' : r.bz < 3 ? 'Near zero — little energy getting in' : 'Pointing north — the shield is mostly closed', r.bz == null ? 0 : r.bz <= -15 ? 4 : r.bz <= -10 ? 3 : r.bz <= -5 ? 2 : r.bz < 0 ? 1 : 0, 'bz'));
    const xc = r.flux ? Data.flareClass(r.flux) : '--', rl = r.sc.r || 0;
    out.push(card('bolt', 'Flare X-rays · radio', xc, rl ? `R${rl} radio blackout on the day side — shortwave radio fading` : r.flux >= 1e-5 ? 'M-class flare in progress — day-side radio may fade' : 'No radio blackout', rl || (r.flux >= 1e-5 ? 1 : 0), 'xray'));
    const sl = r.sc.s || 0;
    out.push(card('alert', 'Radiation storm', sl ? 'S' + sl : r.pr != null ? (r.pr < 1 ? '<1' : Math.round(r.pr)) + '<small> pfu</small>' : 'S0',
      sl ? 'Fast protons pouring into the polar regions — higher dose on polar flights, satellite glitches' : 'Protons at background level — no radiation storm', sl, 'scale:S'));
    const g = r.sc.g || (r.kp >= 5 ? Math.min(5, Math.floor(r.kp + 0.34) - 4) : 0);
    out.push(card('pulse', 'Geomagnetic storm', r.kp != null ? 'Kp ' + (r.kp % 1 ? r.kp.toFixed(1) : r.kp) : '--', g ? `G${g} storm — the shield is shaking, currents in power lines, GPS errors` : r.kp >= 4 ? 'Unsettled — close to storm level' : 'Quiet', g || (r.kp >= 4 ? 1 : 0), 'kp'));
    out.push(card('aurora', 'Aurora', r.ovalLat != null ? r.ovalLat + '°<small>N</small>' : '--',
      r.ovalLat == null ? 'Loading NOAA\'s aurora map' : `Northern lights reaching down to ${r.ovalLat}°N right now` + (place ? ` · ${esc(place.name)} is at ${place.lat.toFixed(0)}°N` : '') + ' · tap to watch', r.ovalLat == null ? 0 : r.ovalLat <= 50 ? 4 : r.ovalLat <= 55 ? 3 : r.ovalLat <= 60 ? 2 : 1, 'aurora'));
    const nx = r.coming[0];
    out.push(card('cme', 'CMEs heading for Earth', r.coming.length ? String(r.coming.length) : '0',
      nx ? `Next ${CmeAnim.until(nx.arrival)} (${Fmt.dayTime(nx.arrival)})${nx.speed ? ' · ' + Math.round(nx.speed) + ' km/s' : ''}` : r.landed.length ? 'One hit Earth in the last 18 hours' : 'Nothing on its way', r.coming.length ? 2 + (nx && nx.kpMax >= 7 ? 1 : 0) : r.landed.length ? 1 : 0, 'cme'));
    return out.join('');
  }

  let lastCards = '', lastAu = '';
  function render(host, S) {
    const place = host.place ? host.place() : null;
    const r = reading(S);
    const worst = Math.max(r.sc.r || 0, r.sc.s || 0, r.sc.g || 0, r.coming.length ? 1 : 0, r.kp >= 5 ? 1 : 0);
    const head = worst >= 3 ? 'Earth is under attack' : worst >= 1 || (r.bz != null && r.bz <= -5) ? 'Earth is taking hits' : 'Earth is calm';
    lastCards = cards(S, place);
    const au = window.AuroraView ? AuroraView.earthBits(S, place) : { btn: '', banner: '' };
    lastAu = au.btn + au.banner;
    const p = host.tabShell('earth', `
      <div class="tab-title">Earth</div>
      ${host.statRow('What the Sun is sending our way ·')}
      <div id="eaual">${au.banner}</div>
      <div class="earthbox"><canvas id="earthcv" aria-label="Earth, its magnetic shield and the solar wind"></canvas><div class="ehead">${head}</div><span id="eaubtn">${au.btn}</span></div>
      <div class="sect-row"><div class="sect">Hitting Earth now</div></div>
      <div id="ecards">${window.Pro && !Pro.on() ? Pro.lockCard(lastCards, 'earth', 'Everything hitting Earth, explained', 'Solar wind, the magnetic shield, flares, radiation and storms — live, with what each one means') : lastCards}</div>
      <p class="muted small">The globe shows real day and night and NOAA's live aurora. The magnetic shield's size follows the live solar wind pressure (Shue model) but distances are not to scale — in reality it sits about 10 Earth radii out.</p>
      <p class="attrib">Data: NOAA SWPC (solar wind, X-rays, protons, Kp, scales, OVATION aurora), NASA DONKI (CMEs) · Map: Natural Earth</p>`);
    const cv = $('#earthcv', p);
    scene(cv, () => S);
    p.addEventListener('click', (e) => {
      const b = e.target.closest('[data-eact]'); if (!b) return;
      const a = b.dataset.eact;
      if ((a === 'auview' || a === 'aurora') && window.AuroraView) AuroraView.open(host, S);
      else if (a.startsWith('scale:')) host.scaleSheet(a.slice(6));
      else if (a === 'cme') host.setTab('incoming');
      else if (host.tileSheet) host.tileSheet(a);
    });
  }
  // refresh only the cards (keeps the animation running) when new data arrives
  function update(host, S) {
    const el = document.getElementById('ecards'); if (!el) return false;
    if (window.Pro && !Pro.on()) return true; // free: the cards stay behind the Pro preview
    const html = cards(S, host.place ? host.place() : null);
    if (html !== lastCards) { el.innerHTML = html; lastCards = html; }
    if (window.AuroraView) {
      const au = AuroraView.earthBits(S, host.place ? host.place() : null);
      if (au.btn + au.banner !== lastAu) { lastAu = au.btn + au.banner; const b = document.getElementById('eaubtn'), c = document.getElementById('eaual'); if (b) b.innerHTML = au.btn; if (c) c.innerHTML = au.banner; }
    }
    return true;
  }

  window.EarthView = { render, update, reading, _standoff: standoff, _subsolar: subsolar, _isLand: isLand };
})();
