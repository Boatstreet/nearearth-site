'use strict';
/* ---------- Tonight ---------- */
function drawMoon(x, cx, cy, r, phase, opts = {}) {
  const flip = place().lat < 0 ? -1 : 1;
  x.save(); x.translate(cx, cy); x.scale(flip, 1);
  if (opts.glow) { const g = x.createRadialGradient(0, 0, r * .8, 0, 0, r * 3.2); g.addColorStop(0, `rgba(255,248,225,${.22 * opts.glow})`); g.addColorStop(1, 'rgba(255,248,225,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, r * 3.2, 0, 7); x.fill(); }
  x.beginPath(); x.arc(0, 0, r, 0, 7); x.fillStyle = opts.dark || '#1b2238'; x.fill();
  const waxing = phase < 180, k = Math.cos(phase * D2R), lit = '#f5efdc';
  x.save(); x.beginPath(); x.arc(0, 0, r, 0, 7); x.clip();
  x.fillStyle = lit; x.beginPath();
  const side = waxing ? 1 : -1;
  x.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, side < 0); // lit half
  x.closePath(); x.fill();
  x.beginPath(); x.ellipse(0, 0, Math.abs(k) * r, r, 0, 0, 7);
  x.fillStyle = k > 0 ? (opts.dark || '#1b2238') : lit; x.fill();
  // maria texture
  x.globalCompositeOperation = 'multiply'; x.fillStyle = 'rgba(150,150,160,.35)';
  [[-.25, -.3, .28], [.2, -.15, .2], [.05, .25, .24], [-.35, .2, .15], [.35, .3, .12]].forEach(([a, b, s]) => { x.beginPath(); x.arc(a * r, b * r, s * r, 0, 7); x.fill(); });
  x.restore();
  x.globalCompositeOperation = 'source-over';
  const sh = x.createRadialGradient(-r * .3, -r * .3, r * .2, 0, 0, r); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.28)');
  x.fillStyle = sh; x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill();
  x.restore();
}

const Tonight = (() => {
  let night = null, moon = null, planets = [], best = null, scn = null, raf = 0, aur = null;
  const cvs = $('#tnCanvas');

  function cloudsFor(t0, t1) {
    const w = S.wx; if (!w || !w.hourly) return null;
    let s = 0, n = 0; w.hourly.time.forEach((tt, i) => { const t = tt * 1000; if (t >= +t0 - 18e5 && t <= +t1) { s += w.hourly.cloud_cover[i]; n++; } });
    return n ? s / n / 100 : null;
  }

  function compute() {
    night = nightOf(); moon = moonInfo(night.mid, night); planets = planetsTonight(night);
    const cl = night.darkS ? cloudsFor(night.darkS, night.darkE) : cloudsFor(night.start, night.end);
    night.cloud = cl; night.sc = nightScore(night, moon, cl);
    // best listened-to star for tonight
    const t = night.darkS && Date.now() > +night.darkS && Date.now() < +night.darkE ? new Date() : night.mid;
    const m = horMatrix(t, place().lat, place().lon); let cand = [];
    for (const s of SETIDATA) { if (s.k !== 'star' || !s.ly) continue; const h = altAz(m, s.ra, s.dec); if (h.alt > 35) cand.push([s, h]); }
    cand.sort((a, b) => a[0].ly - b[0].ly);
    best = cand.length ? { t: cand[0][0], h: cand[0][1], when: t } : null;
  }

  function render() {
    compute();
    const n = night, sc = n.sc;
    $('#tnWhen').textContent = (Date.now() > +n.start ? 'Tonight' : 'This evening') + ' · ' + fD(n.start);
    animateNum($('#tnScore'), sc.score); $('#tnVerdict').textContent = verdict(sc.score); $('#tnWhy').textContent = sc.why;
    // darkness bar
    const span = n.end - n.start, pct = t => clamp((t - n.start) / span * 100, 0, 100);
    const segs = [[n.start, n.civD || n.end, '#4a6bc0'], [n.civD, n.nauD || n.civA, '#2c4892'], [n.nauD, n.astD || n.nauA, '#1b2f6c'], [n.astD, n.astA, '#070d27'], [n.astA, n.nauA, '#1b2f6c'], [n.nauA, n.civA, '#2c4892'], [n.civA, n.end, '#4a6bc0']];
    let h = segs.filter(s => s[0] && s[1] && s[1] > s[0]).map(s => `<i class="bs" style="left:${pct(s[0])}%;width:${pct(s[1]) - pct(s[0])}%;background:${s[2]}"></i>`).join('');
    if (S.wx && S.wx.hourly) S.wx.hourly.time.forEach((tt, i) => { const t = tt * 1000; if (t >= +n.start && t < +n.end) { const c = S.wx.hourly.cloud_cover[i] / 100; if (c > .05) h += `<i class="cl" style="left:${pct(t)}%;width:${100 * 36e5 / span}%;opacity:${c.toFixed(2)};height:${(30 + 70 * c).toFixed(0)}%"></i>`; } });
    if (Date.now() > +n.start && Date.now() < +n.end) h += `<i class="now" style="left:${pct(Date.now())}%"></i>`;
    $('#tnDbar').innerHTML = h;
    $('#tnDlbl').innerHTML = `<span>Dusk</span><span>${fT(n.mid)}</span><span>Dawn</span>`;
    $('#tnDarkLen').textContent = n.darkS ? n.darkH.toFixed(1) + ' h ' + (n.trueDark ? 'true dark' : 'nautical dark') : 'twilight only';
    $('#tnHours').innerHTML = [['Dark from', n.darkS], ['Dark until', n.darkE]].map(([a, b]) => `<div><small>${a}</small><b>${fT(b)}</b></div>`).join('');
    // moon
    const mc = $('#tnMoon'), mx = hidpi(mc, 76, 76).x; mx.clearRect(0, 0, 76, 76); drawMoon(mx, 38, 38, 32, A.MoonPhase(new Date()), { dark: '#1a2036' });
    const mNow = moonInfo(new Date(), n);
    $('#tnMoonTxt').innerHTML = `<b>${mNow.name}</b>${Math.round(mNow.frac * 100)}% lit<br>${mNow.rise ? '↑ ' + fT(mNow.rise) : ''} ${mNow.set ? ' ↓ ' + fT(mNow.set) : ''}`;
    renderAurora();
    // seti
    if (best) {
      const s = best.t, yr = new Date().getFullYear();
      $('#tnSeti').innerHTML = `<div class="seti-hi"><canvas id="tnSetiC"></canvas><div><b>${esc(setiName(s))}</b><p>${s.ly} light-years · ${spWord(s.sp)} in ${CONS(s.c)}<br>${Math.round(best.h.alt)}° up in the ${compass(best.h.az)} ${best.when > Date.now() ? 'at ' + fT(best.when) : 'now'}</p>
        <div class="q">${s.ly < yr - 1920 ? 'Inside our radio bubble: it could have heard us since ' + Math.round(1920 + s.ly) : 'The light you see left it in ' + Math.round(yr - s.ly)}</div></div></div>
        <button class="btn cy" id="tnSetiGo">Find it in the sky</button> <button class="btn" id="tnSetiMore">Listening log</button>`;
      ringAnim($('#tnSetiC'), spColor(s.sp));
      $('#tnSetiGo').onclick = () => { App.go('sky'); SkyMap.focus({ ra: s.ra, dec: s.dec, seti: s }); };
      $('#tnSetiMore').onclick = () => Listen.target(s);
    } else $('#tnSeti').innerHTML = '<p class="muted">No listened-to stars climb high tonight.</p>';
    // planets
    $('#tnPlanets').innerHTML = planets.map(p => `<div class="pl ${p.vis ? '' : 'dim'}"><i class="dot" style="background:radial-gradient(circle at 35% 30%,#fff,${p.c} 55%,#3a2c1c)"></i><div class="nm"><b>${p.b}</b><small>${p.vis ? 'Best ' + fT(p.bt) + ' · ' + Math.round(p.best) + '° ' + compassS(p.az) + ' · ' + esc(p.con) : 'Not up in the dark'}</small></div><div class="r">${p.vis ? 'mag ' + p.mag.toFixed(1) : ''}</div></div>`).join('');
    renderSoon(); scene();
    $('#tnFoot').textContent = (S.wx ? 'Cloud forecast Open-Meteo · ' : 'No cloud forecast yet · ') + 'Positions computed on your phone';
  }

  function renderAurora() {
    const el = $('#tnAur');
    if (!S.kp) { el.innerHTML = '<div class="kp muted">–</div><span>Kp index loading</span>'; return; }
    const now = Date.now(), next = S.kp.filter(k => k.t > now - 3 * 36e5 && k.t < now + 24 * 36e5);
    const mx = next.length ? Math.max(...next.map(k => k.kp)) : S.kp[S.kp.length - 1].kp;
    aur = auroraFor(mx);
    const col = mx >= 7 ? 'var(--red)' : mx >= 5 ? 'var(--amb)' : 'var(--grn)';
    el.innerHTML = `<div class="kp" style="color:${col}">Kp ${mx.toFixed(mx % 1 ? 1 : 0)}</div><b>${['Unlikely', 'Camera only', 'Possible', 'Likely overhead'][aur.lvl]}</b><span>${aur.lvl ? aur.t : 'Needs Kp ' + kpNeeded() + ' here'}</span><div class="aurbar">${next.slice(0, 9).map(k => `<i style="height:${4 + k.kp * 2}px;background:${k.kp >= 7 ? 'var(--red)' : k.kp >= 5 ? 'var(--amb)' : 'var(--grn)'};opacity:${k.t < now ? .45 : 1}"></i>`).join('')}</div>`;
  }

  function renderSoon() {
    const now = Date.now(), ev = events().filter(e => +e.t > now - 6 * 36e5 && (e.k !== 'moon') && (e.k !== 'ecl' || e.vis || e.big)).slice(0, 5);
    const ic = { met: ['☄', 'rgba(255,210,122,.15)'], ecl: ['◐', 'rgba(255,93,115,.15)'], pl: ['✦', 'rgba(143,166,255,.16)'] };
    $('#tnSoon').innerHTML = ev.map(e => `<div class="si"><i style="background:${ic[e.k][1]}">${ic[e.k][0]}</i><div><b>${esc(e.n)}</b><small>${esc(e.d)}</small></div><em>${relDay(e.t)}</em></div>`).join('');
  }

  function tick() {}


  /* hero scene */
  function scene() {
    const r = rng(7); const stars = []; for (let i = 0; i < 260; i++) stars.push({ x: r(), y: r() * .82, s: Math.pow(r(), 4) * 1.8 + .3, p: r() * 7, c: ['#fff', '#cfe0ff', '#ffe9c4', '#ffd0b0'][Math.floor(r() * 4)] });
    const hills = []; for (let i = 0; i <= 60; i++) hills.push(Math.sin(i * .21) * .025 + Math.sin(i * .07 + 2) * .04 + Math.sin(i * .5) * .008);
    const trees = []; for (let i = 0; i < 26; i++) trees.push({ x: r(), h: .02 + r() * .045 });
    scn = { stars, hills, trees, met: [], sat: null, t0: performance.now() };
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (S.view !== 'tonight' || !scn) return;
    const { x, w, h } = hidpi(cvs), t = (now - scn.t0) / 1000, obs = observer(), date = new Date();
    const sun = bodyPos('Sun', date, obs), dark = clamp((-sun.alt - 0) / 14, 0, 1);
    const g = x.createLinearGradient(0, 0, 0, h);
    const top = mix([70, 130, 210], [3, 6, 20], dark), mid = mix([140, 180, 230], [12, 20, 52], dark), low = mix([250, 200, 160], [28, 34, 78], Math.pow(dark, .7));
    g.addColorStop(0, rgb(top)); g.addColorStop(.55, rgb(mid)); g.addColorStop(.86, rgb(low)); g.addColorStop(1, rgb(low));
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const hz = h * .86, south = place().lat >= 0 ? 180 : 0;
    const proj = (az, alt) => { let d = ((az - south + 540) % 360) - 180; return [w / 2 + d / 100 * w / 2, hz - Math.sin(clamp(alt, -5, 90) * D2R) * hz * .95]; };
    // milky glow + stars
    if (dark > .05) {
      for (const s of scn.stars) { const tw = .55 + .45 * Math.sin(t * 1.7 + s.p * 3) * Math.sin(t * .6 + s.p); x.globalAlpha = dark * tw * (s.y < .75 ? 1 : 1 - (s.y - .75) * 6); x.fillStyle = s.c; x.beginPath(); x.arc(s.x * w, s.y * hz, s.s, 0, 7); x.fill(); }
      x.globalAlpha = 1;
    }
    // aurora
    if (aur && aur.lvl >= 2 && dark > .3) {
      for (let k = 0; k < 3; k++) { x.beginPath(); for (let i = 0; i <= 40; i++) { const px = i / 40 * w, py = hz - (hz * (.25 + .08 * k)) * (.6 + .4 * Math.sin(i * .35 + t * .5 + k)); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.lineTo(w, hz); x.lineTo(0, hz); x.closePath();
        const ag = x.createLinearGradient(0, hz * .45, 0, hz); ag.addColorStop(0, 'rgba(80,255,170,0)'); ag.addColorStop(1, `rgba(80,255,170,${.12 * dark * (aur.lvl - 1)})`); x.fillStyle = ag; x.fill(); }
    }
    // planets
    for (const p of PLANETS) { const ps = bodyPos(p.b, date, obs); if (ps.alt < 0) continue; const [px, py] = proj(ps.az, ps.alt); if (px < -10 || px > w + 10) continue;
      x.globalAlpha = Math.max(dark, .25); x.fillStyle = p.c; x.shadowColor = p.c; x.shadowBlur = 8; x.beginPath(); x.arc(px, py, 2.2, 0, 7); x.fill(); x.shadowBlur = 0;
      x.font = '500 10px Inter'; x.fillStyle = 'rgba(230,235,255,.75)'; x.fillText(p.b, px + 6, py + 3); x.globalAlpha = 1; }
    // seti target ring
    if (best && dark > .2) { const h2 = altAz(horMatrix(date, place().lat, place().lon), best.t.ra, best.t.dec); if (h2.alt > 0) { const [px, py] = proj(h2.az, h2.alt);
      if (px > 0 && px < w) { const ph = (t % 2.4) / 2.4; x.strokeStyle = `rgba(63,240,207,${.9 * (1 - ph)})`; x.lineWidth = 1.4; x.beginPath(); x.arc(px, py, 5 + ph * 16, 0, 7); x.stroke(); x.fillStyle = '#3ff0cf'; x.beginPath(); x.arc(px, py, 2, 0, 7); x.fill(); } } }
    // moon
    const mp = bodyPos('Moon', date, obs); if (mp.alt > -3) { const [px, py] = proj(mp.az, mp.alt); if (px > -30 && px < w + 30) drawMoon(x, px, py, 13, A.MoonPhase(date), { glow: 1, dark: rgb(mix(top, [20, 26, 48], .5)) }); }
    // sun glow
    if (sun.alt > -12) { const [px] = proj(sun.az, 0); const sg = x.createRadialGradient(px, hz, 0, px, hz, w * .6); sg.addColorStop(0, `rgba(255,170,100,${clamp((sun.alt + 12) / 14, 0, .7)})`); sg.addColorStop(1, 'rgba(255,170,100,0)'); x.fillStyle = sg; x.fillRect(0, 0, w, h); }
    // satellite drifting
    if (!scn.sat && dark > .5 && Math.random() < .002) scn.sat = { x: -10, y: hz * (.2 + Math.random() * .4), v: 18 + Math.random() * 14 };
    if (scn.sat) { scn.sat.x += scn.sat.v / 60; x.fillStyle = 'rgba(255,240,200,.9)'; x.beginPath(); x.arc(scn.sat.x, scn.sat.y - scn.sat.x * .05, 1.3, 0, 7); x.fill(); if (scn.sat.x > w + 10) scn.sat = null; }
    // ground: hills, trees, radio dish
    x.fillStyle = '#03050c'; x.beginPath(); x.moveTo(0, h);
    scn.hills.forEach((v, i) => x.lineTo(i / 60 * w, hz + v * h)); x.lineTo(w, h); x.closePath(); x.fill();
    for (const tr of scn.trees) { const bx = tr.x * w, by = hz + scn.hills[Math.round(tr.x * 60)] * h + 2; x.beginPath(); x.moveTo(bx - tr.h * h * .32, by); x.lineTo(bx, by - tr.h * h); x.lineTo(bx + tr.h * h * .32, by); x.fill(); }
    // dish
    const dx = w * .78, dy = hz + scn.hills[47] * h + 1, ds = Math.min(w, 420) * .06;
    x.save(); x.translate(dx, dy); x.strokeStyle = '#03050c'; x.fillStyle = '#03050c'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(-ds * .35, 0); x.lineTo(0, -ds * .7); x.lineTo(ds * .35, 0); x.stroke();
    x.rotate(-.55 + Math.sin(t * .08) * .08); x.beginPath(); x.ellipse(0, -ds * .85, ds * .9, ds * .32, 0, Math.PI, 0); x.fill();
    x.beginPath(); x.moveTo(0, -ds * .9); x.lineTo(0, -ds * 1.55); x.stroke();
    const bl = .5 + .5 * Math.sin(t * 3); x.fillStyle = `rgba(255,80,80,${.4 + .6 * bl})`; x.beginPath(); x.arc(0, -ds * 1.6, 1.8, 0, 7); x.fill();
    if (dark > .3) { const ph = (t % 3) / 3; x.strokeStyle = `rgba(63,240,207,${(1 - ph) * .5})`; x.lineWidth = 1; for (let k = 0; k < 2; k++) { const pp = (ph + k * .5) % 1; x.beginPath(); x.arc(0, -ds * 1.6, 6 + pp * ds * 2.2, -2.4, -.7); x.stroke(); } }
    x.restore();
    const fade = x.createLinearGradient(0, h * .82, 0, h); fade.addColorStop(0, 'rgba(4,6,13,0)'); fade.addColorStop(1, 'rgba(4,6,13,1)'); x.fillStyle = fade; x.fillRect(0, h * .82, w, h * .18);
    const tg = x.createLinearGradient(0, 0, 0, 90); tg.addColorStop(0, 'rgba(4,6,13,.85)'); tg.addColorStop(1, 'rgba(4,6,13,0)'); x.fillStyle = tg; x.fillRect(0, 0, w, 90);
  }
  const mix = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));
  const rgb = a => `rgb(${a[0]},${a[1]},${a[2]})`;
  function start() { if (!raf) raf = requestAnimationFrame(frame); }
  return { render, tick, start, get night() { return night; }, get best() { return best; }, get moon() { return moon; } };
})();

function animateNum(el, to) {
  const from = +el.dataset.v || 0; el.dataset.v = to; const t0 = performance.now();
  const step = n => { const p = clamp((n - t0) / 900, 0, 1), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(lerp(from, to, e)); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function ringAnim(c, col) {
  if (!c) return; const { x } = hidpi(c, 74, 74); const t0 = performance.now();
  const f = n => { if (!c.isConnected) return; const t = (n - t0) / 1000; x.clearRect(0, 0, 74, 74);
    for (let k = 0; k < 3; k++) { const p = ((t / 2.4) + k / 3) % 1; x.strokeStyle = `rgba(63,240,207,${(1 - p) * .8})`; x.lineWidth = 1.3; x.beginPath(); x.arc(37, 37, 6 + p * 30, 0, 7); x.stroke(); }
    const g = x.createRadialGradient(37, 37, 0, 37, 37, 12); g.addColorStop(0, '#fff'); g.addColorStop(.3, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(37, 37, 12, 0, 7); x.fill();
    requestAnimationFrame(f); };
  requestAnimationFrame(f);
}
