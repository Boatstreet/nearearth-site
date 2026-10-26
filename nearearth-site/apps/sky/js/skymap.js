'use strict';
/* ---------- Sky map ---------- */
const SkyMap = (() => {
  const c = $('#skyC');
  const SD = window.SKYDATA;
  const stars = SD.stars.map(s => ({ v: eqVec(s[0], s[1]), ra: s[0], dec: s[1], m: s[2], col: bvColor(s[3]), hip: s[4], nm: SD.names[s[4]] }));
  const hipSeti = {}; SETIDATA.forEach(t => { const m = t.id.match(/^HIP_?(\d+)$/i); if (m) hipSeti[+m[1]] = t; });
  stars.forEach(s => s.seti = hipSeti[s.hip]);
  const seti = SETIDATA.filter(t => t.k !== 'object').map(t => ({ t, v: eqVec(t.ra, t.dec) }));
  const lines = SD.lines.map(([id, segs]) => segs.map(seg => seg.map(p => eqVec(p[0], p[1]))));
  const conLbl = Object.entries(SD.cons).map(([k, o]) => ({ n: o.n, v: eqVec((o.c[0] + 360) % 360, o.c[1]) }));
  const mw = SD.mw.map((lvl, i) => ({ a: [.035, .03, .028, .025][i] || .02, polys: lvl.map(poly => poly.map(p => eqVec(p[0], p[1]))) }));

  let mode = 'dome', cam = { az: 180, alt: 90, fov: 182 }, tgt = null, vel = { az: 0, alt: 0 };
  let tOff = 0, sel = null, compassOn = false, orient = null, pts = [], dirty = true, t0 = performance.now();
  const W = () => c.clientWidth, H = () => c.clientHeight;

  function basis() {
    const az = cam.az * D2R, al = cam.alt * D2R;
    const f = [Math.cos(al) * Math.sin(az), Math.cos(al) * Math.cos(az), Math.sin(al)], r = [Math.cos(az), -Math.sin(az), 0];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const w = W(), h = H(), cx = w / 2, cy = mode === 'dome' ? h * .47 : h / 2;
    const rad = mode === 'dome' ? Math.min(w, h * .82) / 2 - 6 : Math.hypot(w, h) / 2;
    const sc = rad / (2 * Math.tan(cam.fov / 4 * D2R));
    return { f, r, u, cx, cy, sc, rad };
  }
  function proj(B, v) {
    const X = v[0] * B.r[0] + v[1] * B.r[1] + v[2] * B.r[2], Y = v[0] * B.u[0] + v[1] * B.u[1] + v[2] * B.u[2], Z = v[0] * B.f[0] + v[1] * B.f[1] + v[2] * B.f[2];
    if (Z < -.92) return null; const s = 2 / (1 + Z);
    return [B.cx + X * s * B.sc, B.cy - Y * s * B.sc, Z];
  }
  function hv(az, alt) { const a = az * D2R, l = alt * D2R; return [Math.cos(l) * Math.sin(a), Math.cos(l) * Math.cos(a), Math.sin(l)]; }
  const now = () => new Date(Date.now() + tOff * 6e4);

  function draw() {
    const { x, w, h } = hidpi(c), B = basis(), date = now(), p = place(), M = horMatrix(date, p.lat, p.lon), obs = observer();
    const t = (performance.now() - t0) / 1000, zoom = clamp(120 / cam.fov, .8, 4);
    const sun = bodyPos('Sun', date, obs), day = clamp((sun.alt + 12) / 12, 0, 1);
    // sky background
    x.fillStyle = '#02040b'; x.fillRect(0, 0, w, h);
    const zen = proj(B, [0, 0, 1]);
    const bg = x.createRadialGradient(zen ? zen[0] : w / 2, zen ? zen[1] : -h, 0, zen ? zen[0] : w / 2, zen ? zen[1] : -h, Math.max(w, h) * 1.1);
    const dc = (a, b) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], day))).join(',')})`;
    bg.addColorStop(0, dc([5, 9, 24], [46, 98, 180])); bg.addColorStop(1, dc([14, 24, 56], [130, 170, 225]));
    x.save();
    if (mode === 'dome') { x.beginPath(); x.arc(B.cx, B.cy, B.rad, 0, 7); x.clip(); }
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    const sa = 1 - day * .95;
    // milky way
    if (sa > .1) for (const L of mw) { x.fillStyle = `rgba(170,190,255,${L.a * sa})`; for (const poly of L.polys) { x.beginPath(); let ok = 0; for (const v of poly) { const q = proj(B, applyM(M, v)); if (!q) { ok = 0; break; } ok++ ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); } if (ok) x.fill(); } }
    // alt-az grid
    x.lineWidth = .6; x.strokeStyle = `rgba(140,160,230,${.1 + .05 * day})`;
    for (const al of [30, 60]) { x.beginPath(); for (let az = 0; az <= 360; az += 6) { const q = proj(B, hv(az, al)); if (q) az ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); } x.stroke(); }
    // constellations
    if (S.prefs.lines) { x.strokeStyle = `rgba(130,160,255,${.32 * sa + .05})`; x.lineWidth = 1;
      for (const segs of lines) for (const seg of segs) { x.beginPath(); let prev = null; for (const v of seg) { const hvv = applyM(M, v), q = proj(B, hvv); if (q && prev) x.lineTo(q[0], q[1]); else if (q) x.moveTo(q[0], q[1]); prev = q; } x.stroke(); }
      if (S.prefs.labels) { x.font = `500 ${10 + zoom}px Inter`; x.fillStyle = `rgba(150,175,255,${.45 * sa + .1})`; x.textAlign = 'center';
        for (const cl of conLbl) { const hvv = applyM(M, cl.v); if (hvv[2] < .05) continue; const q = proj(B, hvv); if (q) x.fillText(cl.n.toUpperCase(), q[0], q[1]); } x.textAlign = 'left'; } }
    pts = [];
    // stars
    const lim = 4.6 + zoom * .9;
    for (const s of stars) { if (s.m > lim) break; const hvv = applyM(M, s.v); if (hvv[2] < -.02) continue; const q = proj(B, hvv); if (!q || q[0] < -5 || q[0] > w + 5 || q[1] < -5 || q[1] > h + 5) continue;
      const ext = clamp(hvv[2] * 6, .35, 1), r = Math.max(.45, (6.4 - s.m) * .52) * Math.sqrt(zoom), a = clamp((7 - s.m) / 5, .25, 1) * ext * sa;
      if (a < .03) continue;
      if (s.m < 1.8) { x.globalAlpha = a * .35; const g = x.createRadialGradient(q[0], q[1], 0, q[0], q[1], r * 4); g.addColorStop(0, s.col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(q[0], q[1], r * 4, 0, 7); x.fill(); }
      x.globalAlpha = a * (s.m < 2.5 ? .85 + .15 * Math.sin(t * 2 + s.hip) : 1); x.fillStyle = s.col; x.beginPath(); x.arc(q[0], q[1], r, 0, 7); x.fill();
      if (s.m < 4.2 || s.seti) pts.push({ q, k: 'star', o: s, r: r + 10 });
      if (S.prefs.labels && s.nm && s.m < (1.7 + zoom * .8)) { x.globalAlpha = a * .8; x.font = `400 ${10.5 + zoom * .4}px Inter`; x.fillStyle = '#d9e2ff'; x.fillText(s.nm, q[0] + r + 4, q[1] + 3); }
    }
    x.globalAlpha = 1;
    // SETI layer
    if (S.prefs.setiLayer) {
      const pulse = (t % 2.6) / 2.6, yr = new Date().getFullYear();
      for (const o of seti) { const hvv = applyM(M, o.v); if (hvv[2] < 0) continue; const q = proj(B, hvv); if (!q || q[0] < -8 || q[0] > w + 8 || q[1] < -8 || q[1] > h + 8) continue;
        const inB = o.t.ly && o.t.ly < yr - 1920, gal = o.t.k === 'galaxy', psr = o.t.k === 'pulsar', near = o.t.ly && o.t.ly < 25;
        if (!inB && !gal) { x.fillStyle = psr ? 'rgba(166,139,255,.55)' : 'rgba(63,240,207,.38)'; x.fillRect(q[0] - .9, q[1] - .9, 1.8, 1.8); pts.push({ q, k: 'seti', o: o.t, r: 8 }); continue; }
        const rr = (near ? 4.6 : gal ? 3.2 : 2.6) * Math.sqrt(zoom);
        x.strokeStyle = gal ? 'rgba(255,178,77,.7)' : near ? 'rgba(63,240,207,.95)' : 'rgba(63,240,207,.6)'; x.lineWidth = near ? 1.4 : 1;
        x.beginPath(); if (gal) x.ellipse(q[0], q[1], rr * 1.5, rr * .8, .6, 0, 7); else x.arc(q[0], q[1], rr, 0, 7); x.stroke();
        if (near) { x.strokeStyle = `rgba(63,240,207,${.6 * (1 - pulse)})`; x.beginPath(); x.arc(q[0], q[1], rr + pulse * 14, 0, 7); x.stroke();
          if (S.prefs.labels && o.t.nm) { x.font = '500 10.5px Inter'; x.fillStyle = 'rgba(140,255,230,.85)'; x.fillText(o.t.nm, q[0] + rr + 4, q[1] - 4); } }
        pts.push({ q, k: 'seti', o: o.t, r: 12 });
      }
    }
    // meteor radiants
    for (const s of showerActive(date)) { const hvv = applyM(M, eqVec(s.ra, s.dec)); if (hvv[2] < 0) continue; const q = proj(B, hvv); if (!q) continue;
      x.strokeStyle = 'rgba(255,210,122,.7)'; x.lineWidth = 1; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + t * .1; x.beginPath(); x.moveTo(q[0] + Math.cos(a) * 6, q[1] + Math.sin(a) * 6); x.lineTo(q[0] + Math.cos(a) * 14, q[1] + Math.sin(a) * 14); x.stroke(); }
      x.fillStyle = 'rgba(255,210,122,.9)'; x.font = '500 11px Inter'; x.fillText(s.n, q[0] + 16, q[1] - 6); pts.push({ q, k: 'shower', o: s, r: 22 }); }
    // planets, moon, sun
    for (const pl of PLANETS) { const bp = bodyPos(pl.b, date, obs); if (bp.alt < -1) continue; const q = proj(B, hv(bp.az, bp.alt)); if (!q) continue;
      const r = 3.2 * Math.sqrt(zoom); x.shadowColor = pl.c; x.shadowBlur = 12; x.fillStyle = pl.c; x.beginPath(); x.arc(q[0], q[1], r, 0, 7); x.fill(); x.shadowBlur = 0;
      if (pl.b === 'Saturn') { x.strokeStyle = pl.c; x.lineWidth = 1; x.beginPath(); x.ellipse(q[0], q[1], r * 2.2, r * .7, -.35, 0, 7); x.stroke(); }
      x.font = '600 12px Inter'; x.fillStyle = '#fff3d6'; x.fillText(pl.b, q[0] + r + 5, q[1] + 4); pts.push({ q, k: 'planet', o: pl, r: 22 }); }
    const mp = bodyPos('Moon', date, obs); if (mp.alt > -2) { const q = proj(B, hv(mp.az, mp.alt)); if (q) { drawMoon(x, q[0], q[1], 9 * Math.sqrt(zoom), A.MoonPhase(date), { glow: .8 }); pts.push({ q, k: 'moon', r: 26 }); } }
    if (sun.alt > -1) { const q = proj(B, hv(sun.az, sun.alt)); if (q) { const g = x.createRadialGradient(q[0], q[1], 0, q[0], q[1], 40); g.addColorStop(0, '#fff'); g.addColorStop(.25, '#ffe9a8'); g.addColorStop(1, 'rgba(255,200,100,0)'); x.fillStyle = g; x.beginPath(); x.arc(q[0], q[1], 40, 0, 7); x.fill(); } }
    // selection beam
    if (sel && sel.v) { const hvv = sel.hor ? sel.v : applyM(M, sel.v); const q = proj(B, hvv); if (q) { const p2 = (t % 1.8) / 1.8;
      x.strokeStyle = sel.k === 'seti' ? '#3ff0cf' : '#ffd27a'; x.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + t * .8; x.beginPath(); x.arc(q[0], q[1], 16, a, a + .9); x.stroke(); }
      x.globalAlpha = 1 - p2; x.beginPath(); x.arc(q[0], q[1], 16 + p2 * 30, 0, 7); x.stroke(); x.globalAlpha = 1; } }
    // ground
    groundAndHorizon(x, B, w, h, day);
    x.restore();
    if (mode === 'dome') { x.strokeStyle = 'rgba(150,175,255,.25)'; x.lineWidth = 1.5; x.beginPath(); x.arc(B.cx, B.cy, B.rad, 0, 7); x.stroke(); }
    // cardinal labels
    x.font = '600 13px Sora'; x.textAlign = 'center';
    ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].forEach((l, i) => { const q = proj(B, hv(i * 45, mode === 'dome' ? 0 : -2)); if (!q) return;
      let px = q[0], py = q[1]; if (mode === 'dome') { const dx = px - B.cx, dy = py - B.cy, d = Math.hypot(dx, dy) || 1; if (d > B.rad + 2) return; px = B.cx + dx / d * (B.rad - 14); py = B.cy + dy / d * (B.rad - 14) + 4; } else py += 18;
      if (px < 0 || px > w) return; x.fillStyle = l === 'N' ? '#ff7a7a' : l.length > 1 ? 'rgba(200,210,240,.55)' : 'rgba(230,236,255,.9)'; x.font = l.length > 1 ? '500 10px Sora' : '600 13px Sora'; x.fillText(l, px, py); });
    x.textAlign = 'left';
    // horizon readout in look mode
    if (mode === 'look') { x.font = '500 11px Mono'; x.fillStyle = 'rgba(200,210,240,.7)'; x.fillText(`${compassS(cam.az)} ${Math.round(cam.az)}° · ${Math.round(cam.alt)}° up`, 14, h - (S.tabh || 0) - 160); }
  }
  function groundAndHorizon(x, B, w, h, day) {
    // stereographic maps the horizon (a great circle) to a circle, or a line when it passes the antipode
    const a = proj(B, hv(cam.az, 0)), b = proj(B, hv(cam.az + 90, 0)), c2 = proj(B, hv(cam.az - 90, 0));
    const nad = proj(B, [0, 0, -1]); if (!a || !b || !c2) return;
    const gcol = day > .5 ? 'rgba(18,30,28,.97)' : 'rgba(5,9,14,.97)';
    const ax = a[0], ay = a[1], bx = b[0], by = b[1], cx = c2[0], cy = c2[1];
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    x.beginPath();
    if (Math.abs(d) < 1e-3) {   // straight horizon through the view
      const dx = cx - bx, dy = cy - by, L = Math.hypot(dx, dy) || 1, ux = dx / L * 1e4, uy = dy / L * 1e4;
      let nx = -uy, ny = ux; if (nad && (nad[0] - bx) * nx + (nad[1] - by) * ny < 0) { nx = -nx; ny = -ny; }
      x.moveTo(bx - ux, by - uy); x.lineTo(bx + ux, by + uy); x.lineTo(bx + ux + nx, by + uy + ny); x.lineTo(bx - ux + nx, by - uy + ny); x.closePath();
      x.fillStyle = gcol; x.fill();
      x.strokeStyle = 'rgba(120,150,200,.5)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(bx - ux, by - uy); x.lineTo(bx + ux, by + uy); x.stroke(); return;
    }
    const sa = ax * ax + ay * ay, sb = bx * bx + by * by, sc2 = cx * cx + cy * cy;
    const ox = (sa * (by - cy) + sb * (cy - ay) + sc2 * (ay - by)) / d, oy = (sa * (cx - bx) + sb * (ax - cx) + sc2 * (bx - ax)) / d, R = Math.hypot(ax - ox, ay - oy);
    const inside = nad && Math.hypot(nad[0] - ox, nad[1] - oy) < R;
    x.arc(ox, oy, R, 0, 7); if (!inside) x.rect(-1e4, -1e4, 2e4, 2e4);
    x.fillStyle = gcol; x.fill('evenodd');
    x.strokeStyle = 'rgba(120,150,200,.5)'; x.lineWidth = 1.2; x.beginPath(); x.arc(ox, oy, R, 0, 7); x.stroke();
  }

  /* loop */
  let raf = 0;
  function loop() {
    raf = requestAnimationFrame(loop); if (S.view !== 'sky') return;
    if (tgt) { const k = .12; let da = ((tgt.az - cam.az + 540) % 360) - 180; cam.az = (cam.az + da * k + 360) % 360; cam.alt += (tgt.alt - cam.alt) * k; cam.fov += (tgt.fov - cam.fov) * k; if (Math.abs(da) < .05 && Math.abs(tgt.alt - cam.alt) < .05 && Math.abs(tgt.fov - cam.fov) < .1) tgt = null; }
    else if (compassOn && orient) { let da = ((orient.az - cam.az + 540) % 360) - 180; cam.az = (cam.az + da * .18 + 360) % 360; cam.alt += (clamp(orient.alt, -10, 90) - cam.alt) * .18; }
    else if (!drag && (Math.abs(vel.az) > .01 || Math.abs(vel.alt) > .01)) { cam.az = (cam.az + vel.az + 360) % 360; if (mode === 'look') cam.alt = clamp(cam.alt + vel.alt, -10, 90); vel.az *= .93; vel.alt *= .93; }
    draw();
  }

  /* gestures */
  let drag = null, pinch = null, tapT = 0; const ptrs = new Map();
  c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); tgt = null; vel = { az: 0, alt: 0 };
    if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), moved: 0 };
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), fov: cam.fov }; drag = null; } });
  c.addEventListener('pointermove', e => { if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); cam.fov = clamp(pinch.fov * pinch.d / d, mode === 'dome' ? 60 : 20, mode === 'dome' ? 186 : 130); return; }
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy);
    if (compassOn && drag.moved > 12) setCompass(false);
    if (mode === 'dome') { const B = basis(); const a0 = Math.atan2(drag.y - B.cy, drag.x - B.cx), a1 = Math.atan2(e.clientY - B.cy, e.clientX - B.cx); let d = (a1 - a0) * R2D; if (d > 180) d -= 360; if (d < -180) d += 360; cam.az = (cam.az + d + 360) % 360; vel.az = d * .6; }
    else { const k = cam.fov / W() * 1.1; cam.az = (cam.az - dx * k + 360) % 360; cam.alt = clamp(cam.alt + dy * k, -10, 90); vel = { az: -dx * k * .6, alt: dy * k * .6 }; }
    drag.x = e.clientX; drag.y = e.clientY; });
  const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
    if (drag && drag.moved < 10 && performance.now() - drag.t < 400) { const n = performance.now(); if (n - tapT < 300) { tgt = { az: cam.az, alt: cam.alt, fov: clamp(cam.fov * .6, mode === 'dome' ? 60 : 20, 186) }; } else tap(e.clientX, e.clientY); tapT = n; }
    if (ptrs.size === 0) drag = null; };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  c.addEventListener('wheel', e => { cam.fov = clamp(cam.fov * (1 + e.deltaY * .001), mode === 'dome' ? 60 : 20, mode === 'dome' ? 186 : 130); e.preventDefault(); }, { passive: false });

  function tap(px, py) {
    const r = c.getBoundingClientRect(); px -= r.left; py -= r.top;
    let bestP = null, bd = 1e9; const pri = { planet: 0, moon: 0, seti: 2, star: 3, shower: 1 };
    for (const p of pts) { const d = Math.hypot(p.q[0] - px, p.q[1] - py) - (pri[p.k] === 0 ? 8 : 0); if (d < p.r && d < bd) { bd = d; bestP = p; } }
    if (!bestP) { select(null); return; }
    N.haptic(10); select(bestP);
  }
  function select(p) {
    const box = $('#skyInfo');
    if (!p) { sel = null; box.classList.remove('on'); return; }
    const date = now(), obs = observer(), M = horMatrix(date, place().lat, place().lon); let h = '';
    if (p.k === 'seti' || (p.k === 'star' && p.o.seti)) {
      const t = p.k === 'seti' ? p.o : p.o.seti, hz = altAz(M, t.ra, t.dec);
      sel = { k: 'seti', v: eqVec(t.ra, t.dec) };
      h = `<span class="tag">${t.k === 'galaxy' ? 'Galaxy · listened to' : t.k === 'pulsar' ? 'Pulsar · test target' : 'Listened to by Breakthrough Listen'}</span><b>${esc(setiName(t))}</b><p>${t.ly ? t.ly + ' light-years · ' + spWord(t.sp) + ' · ' : ''}${t.n} recordings, ${t.f.slice(0, 4)}${t.l.slice(0, 4) !== t.f.slice(0, 4) ? '–' + t.l.slice(0, 4) : ''}<br>${Math.round(hz.alt)}° up in the ${compass(hz.az)}</p><button class="btn cy" id="siMore">Listening log</button>`;
      box.innerHTML = h; $('#siMore').onclick = () => Listen.target(t);
    } else if (p.k === 'star') {
      const s = p.o, hz = altAz(M, s.ra, s.dec); sel = { k: 'star', v: s.v };
      let con = ''; try { con = A.Constellation(s.ra / 15, s.dec).name; } catch (e) {}
      box.innerHTML = `<b>${esc(s.nm || 'HIP ' + s.hip)}</b><p>Star in ${con} · magnitude ${s.m.toFixed(1)}<br>${Math.round(hz.alt)}° up in the ${compass(hz.az)}</p>`;
    } else if (p.k === 'planet' || p.k === 'moon' || p.k === 'sun') {
      const b = p.k === 'planet' ? p.o.b : p.k === 'moon' ? 'Moon' : 'Sun', bp = bodyPos(b, date, obs), il = A.Illumination(b, date);
      sel = { k: 'body', hor: true, v: hv(bp.az, bp.alt), body: b };
      const rs = d => { try { return asDate(A.SearchRiseSet(b, obs, d, date, 1)); } catch (e) { return null; } };
      const dist = b === 'Moon' ? fmtN(Math.round(bp.dist * 149597870.7)) + ' km' : bp.dist.toFixed(2) + ' AU · light takes ' + Math.round(bp.dist * 8.317) + ' min';
      box.innerHTML = `<b>${b}</b><p>${b === 'Sun' ? '' : 'Magnitude ' + il.mag.toFixed(1) + ' · '}${dist}<br>${Math.round(bp.alt)}° up in the ${compass(bp.az)} · rises ${fT(rs(+1))} · sets ${fT(rs(-1))}</p>`;
      sel.track = b;
    } else if (p.k === 'shower') {
      const s = p.o; sel = { k: 'star', v: eqVec(s.ra, s.dec) };
      box.innerHTML = `<b>${s.n}</b><p>Meteor shower radiant · peak ${s.pk[1]} ${['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][s.pk[0]]} · up to ${s.z} an hour<br>Dust from ${s.p}. Look anywhere; trails point back here.</p>`;
    }
    box.classList.add('on');
  }
  function focus(o) {
    if (mode !== 'look') setMode('look');
    let az, alt;
    if (o.body) { const bp = bodyPos(o.body, now(), observer()); az = bp.az; alt = bp.alt; }
    else { const h = altAz(horMatrix(now(), place().lat, place().lon), o.ra, o.dec); az = h.az; alt = h.alt; }
    setCompass(false); tgt = { az, alt: clamp(alt, 5, 80), fov: o.fov || 70 };
    setTimeout(() => {
      if (o.seti) select({ k: 'seti', o: o.seti }); else if (o.body) select({ k: o.body === 'Moon' ? 'moon' : 'planet', o: PLANETS.find(p => p.b === o.body) });
      else if (o.label) { sel = { k: 'seti', v: eqVec(o.ra, o.dec) }; $('#skyInfo').innerHTML = `<span class="tag">${esc(o.tag || 'Signal')}</span><b>${esc(o.label)}</b><p>${esc(o.sub || '')}<br>${alt > 0 ? Math.round(alt) + '° up in the ' + compass(az) : 'Below your horizon right now'}</p>`; $('#skyInfo').classList.add('on'); }
      if (alt < 0) toast('Below your horizon right now');
    }, 250);
  }

  function setMode(m) {
    mode = m; $$('#skyMode button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    if (m === 'dome') { setCompass(false); tgt = { az: place().lat >= 0 ? 180 : 0, alt: 90, fov: 182 }; } else tgt = { az: place().lat >= 0 ? 180 : 0, alt: 35, fov: 80 };
  }
  function setCompass(on) {
    compassOn = on; $('#skyCompass').classList.toggle('on', on); N.compass(on); N.awake(on);
    if (on) { if (mode !== 'look') { mode = 'look'; $$('#skyMode button').forEach(b => b.classList.toggle('on', b.dataset.m === 'look')); } tgt = null; cam.fov = Math.min(cam.fov, 75); if (!N.has) webOrient(); toast('Hold your phone up to the sky'); }
  }
  window.onOrient = (az, alt) => { orient = { az, alt }; };
  let webOri = false;
  function webOrient() {
    if (webOri) return; webOri = true;
    const h = e => { if (e.alpha == null) return; const az = e.webkitCompassHeading != null ? e.webkitCompassHeading : (360 - e.alpha) % 360; orient = { az, alt: clamp((e.beta || 0) - 90, -10, 90) }; };
    window.addEventListener('deviceorientationabsolute', h); window.addEventListener('deviceorientation', h);
  }

  function chips() {
    const date = now(), obs = observer(), M = horMatrix(date, place().lat, place().lon), out = [];
    const mp = bodyPos('Moon', date, obs); if (mp.alt > 0) out.push(['Moon', () => focus({ body: 'Moon' })]);
    PLANETS.forEach(p => { if (bodyPos(p.b, date, obs).alt > 3) out.push([p.b, () => focus({ body: p.b })]); });
    let nb = null; for (const t of SETIDATA) if (t.ly && t.k === 'star' && altAz(M, t.ra, t.dec).alt > 15 && (!nb || t.ly < nb.ly)) nb = t;
    if (nb) out.unshift(['Nearest listened star', () => focus({ ra: nb.ra, dec: nb.dec, seti: nb }), 'cy']);
    out.push(['Wow! signal', () => focus({ ra: 291.38, dec: -26.95, label: 'Wow! signal', tag: 'Case file · 1977', sub: 'Where the 72-second signal came from, in Sagittarius' }), 'cy']);
    showerActive(date).forEach(s => out.push([s.n, () => focus({ ra: s.ra, dec: s.dec })]));
    $('#skyFind').innerHTML = out.map((o, i) => `<button data-i="${i}" class="${o[2] || ''}">${esc(o[0])}</button>`).join('');
    $$('#skyFind button').forEach(b => b.onclick = () => { N.haptic(8); out[+b.dataset.i][1](); });
  }
  function timeLabel() { const v = tOff; $('#skyTl').textContent = v === 0 ? fT(new Date()) : (v > 0 ? '+' : '−') + Math.floor(Math.abs(v) / 60) + 'h' + String(Math.abs(v) % 60).padStart(2, '0'); }

  $$('#skyMode button').forEach(b => b.onclick = () => { N.haptic(8); setMode(b.dataset.m); });
  $('#skyCompass').onclick = () => { N.haptic(10); setCompass(!compassOn); };
  $('#skySeti').onclick = () => { S.prefs.setiLayer = !S.prefs.setiLayer; savePrefs(); syncBtns(); N.haptic(8); toast(S.prefs.setiLayer ? 'Showing ' + fmtN(SETIDATA.length) + ' listened-to targets' : 'SETI layer off'); };
  $('#skyLines').onclick = () => { S.prefs.lines = !S.prefs.lines; savePrefs(); syncBtns(); N.haptic(8); };
  $('#skyT').oninput = e => { tOff = +e.target.value; timeLabel(); };
  $('#skyNow').onclick = () => { tOff = 0; $('#skyT').value = 0; timeLabel(); };
  function syncBtns() { $('#skySeti').classList.toggle('on', S.prefs.setiLayer); $('#skyLines').classList.toggle('on', S.prefs.lines); }

  return {
    show() { syncBtns(); chips(); timeLabel(); if (!raf) raf = requestAnimationFrame(loop); },
    hide() { if (compassOn) setCompass(false); },
    focus, tick() { if (S.view === 'sky' && tOff === 0) timeLabel(); },
    reset() { cam = { az: place().lat >= 0 ? 180 : 0, alt: 90, fov: 182 }; },
    get cam() { return cam; }, setMode, select
  };
})();
