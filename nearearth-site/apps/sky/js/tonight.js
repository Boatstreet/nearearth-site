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
  let night = null, moon = null, planets = [], best = null, scn = null, raf = 0;
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
    renderMoon(n);
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
    $('#tnPlanets').innerHTML = planets.map(p => `<button class="pl ${p.vis ? '' : 'dim'}" data-b="${p.b}"><i class="dot" style="background:radial-gradient(circle at 35% 30%,#fff,${p.c} 55%,#3a2c1c)"></i><div class="nm"><b>${p.b}</b><small>${p.vis ? 'Best ' + fT(p.bt) + ' · ' + Math.round(p.best) + '° ' + compassS(p.az) + ' · ' + esc(p.con) : 'Not up in the dark'}</small></div><div class="r">${p.vis ? 'mag ' + p.mag.toFixed(1) : ''}</div><span class="chev">›</span></button>`).join('');
    $$('#tnPlanets .pl').forEach(b => b.onclick = () => { N.haptic(8); Planets.open(b.dataset.b); });
    renderSoon(); scene(); Pro.renderBest(); Pro.pushWidgets();
    $('#tnFoot').textContent = (S.wx ? 'Cloud forecast Open-Meteo · ' : 'No cloud forecast yet · ') + 'Positions computed on your phone';
  }

  function renderMoon(n) {
    const now = new Date(), obs = observer(), mNow = moonInfo(now, n), pos = mNow.pos, ph = A.MoonPhase(now);
    const mc = $('#tnMoon'), mx = hidpi(mc, 132, 132).x; mx.clearRect(0, 0, 132, 132); drawMoon(mx, 66, 66, 64, ph, { dark: '#1a2036' });
    const age = ph / 360 * 29.53, km = Math.round(pos.dist * 149597870.7), waxing = ph < 180;
    let con = ''; try { con = A.Constellation(pos.ra / 15, pos.dec).name; } catch (e) {}
    const next = d => { try { return asDate(A.SearchRiseSet('Moon', obs, d, now, 1.2)); } catch (e) { return null; } };
    const rise = next(+1), set = next(-1);
    const size = km < 362000 ? 'Supermoon distance' : km > 404000 ? 'Far away, looks small' : km < 384400 ? 'Closer than average' : 'Further than average';
    $('#tnMoonEm').textContent = 'Day ' + Math.floor(age) + ' of 29.5';
    $('#tnMoonTxt').innerHTML = `<b>${mNow.name}</b><div class="pct">${Math.round(mNow.frac * 100)}%</div><span>lit · ${waxing ? 'growing' : 'shrinking'} each night</span><span>${pos.alt > 0 ? Math.round(pos.alt) + '° up in the ' + compass(pos.az) + ' now' : 'Below the horizon now'}</span>`;
    const dh = n.darkS ? Math.round(mNow.upFrac * 100) : null;
    $('#tnMoonFacts').innerHTML = [
      ['Moonrise', fT(rise), rise ? relDay(rise) : ''], ['Moonset', fT(set), set ? relDay(set) : ''], ['Dark hours', dh == null ? '–' : dh + '%', dh == null ? '' : dh < 15 ? 'moon down, dark skies' : dh > 70 ? 'moon up, bright skies' : 'moon up part of it'],
      ['Distance', fmtN(Math.round(km / 100) * 100) + ' km', size], ['In', con || '–', 'constellation'], ['Light takes', (km / 299792.458).toFixed(2) + ' s', 'to reach you']
    ].map(f => `<div><small>${f[0]}</small><b>${esc(f[1])}</b><i>${esc(f[2])}</i></div>`).join('');
    const p0 = partsIn(now); let strip = '';
    for (let d = 0; d < 7; d++) { const md = new Date(+zMidnight(p0.y, p0.m, p0.d) + d * 864e5 + 21 * 36e5); strip += `<div class="${d ? '' : 't'}"><canvas data-p="${A.MoonPhase(md)}"></canvas>${d ? dtf({ weekday: 'short' }).format(md) : 'Today'}</div>`; }
    $('#tnMoonStrip').innerHTML = strip;
    $$('#tnMoonStrip canvas').forEach(c => { const { x } = hidpi(c, 28, 28); drawMoon(x, 14, 14, 11, +c.dataset.p, { dark: '#1a2036' }); });
    const qn = ['New Moon', 'First quarter', 'Full Moon', 'Last quarter']; let q = null, out = [];
    try { q = A.SearchMoonQuarter(now); for (let k = 0; k < 4; k++) { out.push([qn[q.quarter], q.time.date]); q = A.NextMoonQuarter(q); } } catch (e) {}
    $('#tnMoonNext').innerHTML = out.map(o => `<div><span>${o[0]}</span><b>${fD(o[1])}</b></div>`).join('');
  }

  function renderSoon() {
    const now = Date.now(), ev = events().filter(e => +e.t > now - 6 * 36e5 && (e.k !== 'moon') && (e.k !== 'ecl' || e.vis || e.big)).slice(0, 5);
    const ic = { met: ['☄', 'rgba(255,210,122,.15)'], ecl: ['◐', 'rgba(255,93,115,.15)'], pl: ['✦', 'rgba(143,166,255,.16)'] };
    if (S.pro) { try { Pro.conjunctions(30).slice(0, 3).forEach(c => ev.push({ t: c.t, k: 'conj', n: c.a + ' meets ' + c.b, d: c.s.toFixed(1) + '° apart · look ' + compass(bodyPos(c.b, c.t, observer()).az) + ' in the evening' })); ev.sort((a, b) => a.t - b.t); ev.splice(6); } catch (er) {} }
    ic.conj = ['☌', 'rgba(63,240,207,.14)'];
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
    // planets
    for (const p of PLANETS) { const ps = bodyPos(p.b, date, obs); if (ps.alt < 0) continue; const [px, py] = proj(ps.az, ps.alt); if (px < -10 || px > w + 10) continue;
      x.globalAlpha = 1; x.fillStyle = p.c; x.shadowColor = p.c; x.shadowBlur = 8; x.beginPath(); x.arc(px, py, 2.2, 0, 7); x.fill(); x.shadowBlur = 0;
      x.font = '600 11.5px Inter'; x.shadowColor = 'rgba(0,0,0,.8)'; x.shadowBlur = 4; x.fillStyle = '#fff'; x.fillText(p.b, px + 6, py + 4); x.shadowBlur = 0; x.globalAlpha = 1; }
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
    x.rotate(-.5 + Math.sin(t * .16) * .38);   // slow sweep back and forth, one full sweep about every 40 s
    x.beginPath(); x.ellipse(0, -ds * .85, ds * .9, ds * .32, 0, Math.PI, 0); x.fill();
    x.beginPath(); x.moveTo(0, -ds * .9); x.lineTo(0, -ds * 1.55); x.stroke();
    const bl = .5 + .5 * Math.sin(t * 3); x.fillStyle = `rgba(63,240,207,${.6 + .4 * bl})`; x.shadowColor = '#3ff0cf'; x.shadowBlur = 12; x.beginPath(); x.arc(0, -ds * 1.6, 2.6, 0, 7); x.fill(); x.shadowBlur = 0;
    // radio waves beaming out: bold and bright day or night (dark halo underneath keeps them visible against a bright sky)
    { const day = 1 - dark, fy = -ds * 1.6, ph = (t % 3.2) / 3.2, reach = ds * 8, a0 = -2.35, a1 = -.79;
      // faint beam cone
      const cg = x.createRadialGradient(0, fy, 0, 0, fy, reach); cg.addColorStop(0, `rgba(63,240,207,${.22 + .1 * day})`); cg.addColorStop(1, 'rgba(63,240,207,0)');
      x.fillStyle = cg; x.beginPath(); x.moveTo(0, fy); x.arc(0, fy, reach, a0, a1); x.closePath(); x.fill();
      x.lineCap = 'round';
      for (let k = 0; k < 6; k++) {
        const pp = (((ph + k / 6) % 1) + 1) % 1, a = Math.pow(1 - pp, .85), r = 5 + pp * reach;
        if (day > .05) { x.strokeStyle = `rgba(0,45,60,${a * .6 * day})`; x.lineWidth = 8 - pp * 4; x.beginPath(); x.arc(0, fy, r, a0, a1); x.stroke(); }
        x.shadowColor = 'rgba(63,240,207,1)'; x.shadowBlur = 16;
        x.strokeStyle = `rgba(${Math.round(lerp(63, 120, day))},255,${Math.round(lerp(207, 230, day))},${a})`; x.lineWidth = 4.6 - pp * 2.6; x.beginPath(); x.arc(0, fy, r, a0, a1); x.stroke();
        x.shadowBlur = 0; x.strokeStyle = `rgba(255,255,255,${a * .8})`; x.lineWidth = 1.2; x.beginPath(); x.arc(0, fy, r, a0, a1); x.stroke();
      }
      x.lineCap = 'butt'; }
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
