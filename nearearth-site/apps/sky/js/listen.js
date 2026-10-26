'use strict';
/* ---------- Listen (SETI) ---------- */
function cmapTeal(v) {   // 0..1 -> [r,g,b]
  const s = [[0, [0, 0, 6]], [.25, [6, 22, 60]], [.5, [8, 92, 120]], [.72, [40, 200, 180]], [.88, [170, 255, 230]], [1, [255, 255, 255]]];
  for (let i = 1; i < s.length; i++) if (v <= s[i][0]) { const t = (v - s[i - 1][0]) / (s[i][0] - s[i - 1][0]); return s[i - 1][1].map((c, j) => Math.round(lerp(c, s[i][1][j], t))); }
  return [255, 255, 255];
}
const CMAP = Array.from({ length: 256 }, (_, i) => cmapTeal(i / 255));

const Listen = (() => {
  const T = SETIDATA, YEAR = new Date().getFullYear(), BUB = YEAR - 1920;
  const idxOf = new Map(T.map((t, i) => [t, i]));
  const obsDates = (() => { const m = new Map(); for (const [d, l] of Object.entries(OBSDAYS)) for (const i of l) { if (!m.has(i)) m.set(i, []); m.get(i).push(d); } return m; })();

  /* ----- hero: simulated waterfall + dish ----- */
  const cv = $('#lsCanvas'), WF = 200, HF = 150;
  const wf = document.createElement('canvas'); wf.width = WF; wf.height = HF; const wx = wf.getContext('2d');
  const row = wx.createImageData(WF, 1);
  let rfi = [], cand = null, state = 'tune', stT = 0, cur = null, queue = [], last = 0, t0 = performance.now();
  const statusEl = $('#lsStatus');
  function setStatus(cls, txt) { statusEl.className = 'ls-status ' + cls; statusEl.querySelector('span').textContent = txt; }
  function nextTarget() {
    if (!queue.length) {
      const M = horMatrix(new Date(), place().lat, place().lon);
      queue = T.filter(t => t.k !== 'pulsar' && t.k !== 'object' && altAz(M, t.ra, t.dec).alt > 20).sort(() => Math.random() - .5).slice(0, 30);
      if (!queue.length) queue = T.slice().sort(() => Math.random() - .5).slice(0, 30);
    }
    cur = queue.shift();
    rfi = Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => ({ c: Math.random() * WF, w: Math.random() < .3 ? 2 : 1, a: .3 + Math.random() * .5 }));
    cand = null; state = 'tune'; stT = performance.now(); setStatus('', 'Tuning');
    $('#lsTarget').textContent = setiName(cur);
    const band = cur.b.includes('L') && cur.b.includes('S') ? '1.1–2.7 GHz' : cur.b.includes('S') ? '1.8–2.7 GHz' : '1.1–1.9 GHz';
    $('#lsMeta').textContent = [setiCode(cur) !== setiName(cur) ? setiCode(cur) : null, cur.ly ? cur.ly + ' ly' : cur.k === 'galaxy' ? 'galaxy' : null, cur.sp ? cur.sp.split(' ')[0] : null, band].filter(Boolean).join(' · ');
  }
  function stepState(now) {
    const dt = (now - stT) / 1000;
    if (state === 'tune' && dt > 1.6) { state = 'listen'; stT = now; setStatus('', 'Listening'); }
    else if (state === 'listen' && dt > 3 && !cand && Math.random() < .004) { cand = { c: 30 + Math.random() * (WF - 60), d: (Math.random() < .5 ? -1 : 1) * (.15 + Math.random() * .35), a: .8 }; state = 'cand'; stT = now; setStatus('cand', 'Candidate · drift ' + (cand.d * 2.4).toFixed(2) + ' Hz/s'); N.haptic(20); }
    else if (state === 'listen' && dt > 14) nextTarget();
    else if (state === 'cand' && dt > 4.5) { state = 'off'; stT = now; setStatus('cand', 'Checking OFF pointing…'); }
    else if (state === 'off' && dt > 3) { state = 'rej'; stT = now; setStatus('rej', 'Rejected · Earth interference'); }
    else if (state === 'rej' && dt > 4) nextTarget();
  }
  function addRow(now) {
    const d = row.data;
    for (let i = 0; i < WF; i++) {
      let v = -Math.log(Math.random() + 1e-6) * .16 + .14;        // exponential noise
      for (const r of rfi) if (Math.abs(i - r.c) < r.w) v += r.a * (.85 + Math.random() * .3);
      if (cand && (state === 'cand' || state === 'off' || state === 'rej')) { if (Math.abs(i - cand.c) < 1.2) v += cand.a * (state === 'off' ? .15 : 1); }
      if (state === 'tune') v *= .5 + Math.random() * .3;
      const c = CMAP[clamp(Math.round(v * 255), 0, 255)]; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    }
    if (cand) cand.c += cand.d;
    wx.drawImage(wf, 0, 0, WF, HF - 1, 0, 1, WF, HF - 1); wx.putImageData(row, 0, 0);
  }
  const stars = (() => { const r = rng(42); return Array.from({ length: 90 }, () => [r(), r(), r()]); })();
  function frame(now) {
    raf = requestAnimationFrame(frame); if (S.view !== 'listen') return;
    if (!cur) nextTarget();
    stepState(now); if (now - last > 55) { addRow(now); last = now; }
    const { x, w, h } = hidpi(cv), t = (now - t0) / 1000;
    x.fillStyle = '#01030a'; x.fillRect(0, 0, w, h);
    // waterfall panel
    const top = 58, wb = h * .7;
    x.imageSmoothingEnabled = false; x.globalAlpha = .95; x.drawImage(wf, 0, top, w, wb - top); x.globalAlpha = 1;
    x.strokeStyle = 'rgba(63,240,207,.1)'; x.lineWidth = 1; for (let i = 1; i < 8; i++) { x.beginPath(); x.moveTo(i * w / 8, top); x.lineTo(i * w / 8, wb); x.stroke(); }
    if (cand && state !== 'tune' && state !== 'listen') { const cx = cand.c / WF * w; x.strokeStyle = state === 'rej' ? 'rgba(255,93,115,.9)' : 'rgba(255,178,77,.95)'; x.setLineDash([4, 4]); x.lineWidth = 1.4; x.strokeRect(cx - 18, top + 22, 36, (wb - top) * .55); x.setLineDash([]);
      x.font = '600 10px Mono'; x.fillStyle = x.strokeStyle; x.fillText(state === 'rej' ? 'RFI' : 'CANDIDATE', cx - 18, top + 16); }
    const g = x.createLinearGradient(0, wb - 50, 0, h); g.addColorStop(0, 'rgba(1,3,10,0)'); g.addColorStop(.45, 'rgba(2,5,12,.9)'); g.addColorStop(1, 'rgba(4,6,13,1)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const tg = x.createLinearGradient(0, 0, 0, top + 40); tg.addColorStop(0, 'rgba(4,6,13,1)'); tg.addColorStop(1, 'rgba(4,6,13,0)'); x.fillStyle = tg; x.fillRect(0, 0, w, top + 40);
    for (const s of stars) { if (s[1] < .62) continue; x.globalAlpha = .25 + .35 * Math.sin(t * 1.4 + s[2] * 9); x.fillStyle = '#cfe8ff'; x.fillRect(s[0] * w, s[1] * h * .82, 1.2, 1.2); } x.globalAlpha = 1;
    // dish: pedestal, yoke, parabolic bowl, feed arm
    const ds = Math.min(w, 460) * .13, dx = w - ds * 1.25, dy = h - 26;
    x.save(); x.translate(dx, dy);
    x.fillStyle = '#0b1823'; x.beginPath(); x.moveTo(-ds * .5, 0); x.lineTo(-ds * .18, -ds * .9); x.lineTo(ds * .18, -ds * .9); x.lineTo(ds * .5, 0); x.closePath(); x.fill();
    x.translate(0, -ds * .95); x.rotate(-.62 + Math.sin(t * .12) * .06);
    const bowl = x.createLinearGradient(0, -ds * .2, 0, ds * .55); bowl.addColorStop(0, '#2b5a72'); bowl.addColorStop(1, '#07131c');
    x.fillStyle = bowl; x.beginPath(); x.moveTo(-ds, 0); x.quadraticCurveTo(0, ds * 1.05, ds, 0); x.closePath(); x.fill();
    const rim = x.createLinearGradient(-ds, 0, ds, 0); rim.addColorStop(0, '#9fe9ff'); rim.addColorStop(1, '#3a7f99');
    x.fillStyle = 'rgba(160,230,255,.14)'; x.strokeStyle = rim; x.lineWidth = 1.6; x.beginPath(); x.ellipse(0, 0, ds, ds * .16, 0, 0, 7); x.fill(); x.stroke();
    x.strokeStyle = '#4c8aa3'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(-ds * .82, -ds * .05); x.lineTo(0, -ds * .95); x.lineTo(ds * .82, -ds * .05); x.stroke();
    const fx = 0, fy = -ds * .98;
    for (let k = 0; k < 4; k++) { const p = ((t * .45) + k / 4) % 1; x.strokeStyle = `rgba(63,240,207,${p * .55})`; x.lineWidth = 1.2; x.beginPath(); x.arc(fx, fy, (1 - p) * ds * 1.6 + 3, -Math.PI * .95, -Math.PI * .05); x.stroke(); }
    x.fillStyle = state === 'cand' || state === 'off' ? '#ffb24d' : state === 'rej' ? '#ff5d73' : '#3ff0cf'; x.shadowColor = x.fillStyle; x.shadowBlur = 12; x.beginPath(); x.arc(fx, fy, 3, 0, 7); x.fill(); x.shadowBlur = 0;
    x.restore();
    x.font = '500 9.5px Mono'; x.fillStyle = 'rgba(63,240,207,.6)'; x.fillText('FREQUENCY →', 14, top + 12); x.fillText('TIME ↓', w - 58, top + 12);
  }
  let raf = 0;

  /* ----- stats ----- */
  function stats() {
    const st = T.filter(t => t.k === 'star').length, gl = T.filter(t => t.k === 'galaxy').length, rec = T.reduce((a, t) => a + t.n, 0), nights = Object.keys(OBSDAYS).length;
    const nr = T.filter(t => t.ly).sort((a, b) => a.ly - b.ly)[0];
    const items = [[st, 'stars listened to'], [gl, 'nearby galaxies'], [rec, 'on-target recordings'], [nights, 'days with observations'], [nr.ly, 'ly to the nearest: ' + nr.nm, 1], [0, 'confirmed signals', 0, 'zero']];
    $('#lsStats').innerHTML = items.map(i => `<div class="stat ${i[3] || ''}"><b data-to="${i[0]}" data-d="${i[2] || 0}">0</b><small>${esc(i[1])}</small></div>`).join('');
  }
  function countUp() { $$('#lsStats b').forEach(b => { const to = +b.dataset.to, dec = +b.dataset.d, t0 = performance.now(); const f = n => { const p = clamp((n - t0) / 1400, 0, 1), e = 1 - Math.pow(1 - p, 4); b.textContent = dec ? (to * e).toFixed(dec) : fmtN(Math.round(to * e)); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }); }

  /* ----- above you now ----- */
  let sortBy = 'near', showN = 8;
  function above() {
    const M = horMatrix(new Date(), place().lat, place().lon);
    let l = T.map(t => ({ t, h: altAz(M, t.ra, t.dec) })).filter(o => o.h.alt > 10 && o.t.k !== 'pulsar' && o.t.k !== 'object');
    $('#lsAboveN').textContent = fmtN(l.length) + ' targets up';
    l.sort(sortBy === 'near' ? (a, b) => (a.t.ly || 1e9) - (b.t.ly || 1e9) : sortBy === 'high' ? (a, b) => b.h.alt - a.h.alt : (a, b) => b.t.n - a.t.n);
    $('#lsAbove').innerHTML = l.slice(0, showN).map((o, i) => `<button class="tr2" data-i="${idxOf.get(o.t)}"><span class="ring" style="--sc:${o.t.k === 'galaxy' ? '#ffb24d' : spColor(o.t.sp)}"></span><div class="nm"><b>${esc(setiName(o.t))}</b><small>${o.t.k === 'galaxy' ? 'Galaxy' : spWord(o.t.sp)} · ${CONS(o.t.c) || ''} · ${o.t.n} recordings</small></div><div class="r"><b>${o.t.ly ? o.t.ly + ' ly' : o.t.k === 'galaxy' ? '—' : '?'}</b>${Math.round(o.h.alt)}° ${compassS(o.h.az)}</div></button>`).join('') + (l.length > showN ? `<button class="more" id="lsMore">Show ${Math.min(12, l.length - showN)} more</button>` : '');
    $$('#lsAbove .tr2').forEach(b => b.onclick = () => target(T[+b.dataset.i]));
    const m = $('#lsMore'); if (m) m.onclick = () => { showN += 12; above(); };
  }
  $$('#lsSort button').forEach(b => b.onclick = () => { sortBy = b.dataset.s; showN = 8; $$('#lsSort button').forEach(x => x.classList.toggle('on', x === b)); above(); N.haptic(8); });

  /* ----- target sheet ----- */
  function target(t) {
    const i = idxOf.get(t), dates = (obsDates.get(i) || []).sort(), M = horMatrix(new Date(), place().lat, place().lon), h = altAz(M, t.ra, t.dec);
    let con = ''; try { con = A.Constellation(t.ra / 15, t.dec).name; } catch (e) {}
    const heard = t.ly ? 1920 + t.ly : null, reply = t.ly ? 1920 + 2 * t.ly : null;
    const band = (t.b.includes('L') ? 'L-band 1.1–1.9 GHz' : '') + (t.b.includes('L') && t.b.includes('S') ? ' and ' : '') + (t.b.includes('S') ? 'S-band 1.8–2.7 GHz' : '');
    // next time above 20 degrees
    let nextUp = null; if (h.alt < 20) for (let k = 1; k < 24 * 6; k++) { const d = new Date(Date.now() + k * 6e5); if (altAz(horMatrix(d, place().lat, place().lon), t.ra, t.dec).alt > 20) { nextUp = d; break; } }
    const kind = t.k === 'galaxy' ? 'Galaxy' : t.k === 'pulsar' ? 'Pulsar' : spWord(t.sp);
    Sheet.open(`<div class="seti-hi"><canvas id="tgC"></canvas><div><div class="eyebrow cy">Listened to</div><h2 style="margin:2px 0 0">${esc(setiName(t))}</h2><p>${esc(setiCode(t))} · ${esc(kind)} in ${esc(con)}</p></div></div>
      <div class="sgd"><div class="facts">
        <div><small>Distance</small><b>${t.ly ? t.ly + ' light-years' : t.k === 'galaxy' ? 'Millions of ly' : 'Unknown'}</b></div>
        <div><small>Type</small><b>${t.sp ? esc(t.sp) : esc(kind)}</b></div>
        <div><small>Recordings</small><b>${t.n} at Green Bank</b></div>
        <div><small>Right now</small><b>${h.alt > 0 ? Math.round(h.alt) + '° up, ' + compassS(h.az) : 'Below horizon'}</b></div>
      </div>
      ${t.ly ? `<div class="verdict" style="border-color:var(--cy)"><small style="color:var(--cy)">Light & time</small>The starlight reaching you tonight left it in <b>${Math.round(YEAR - t.ly)}</b>. ${heard < YEAR ? `Our first radio broadcasts washed over it around <b>${Math.round(heard)}</b>. If anyone there answered straight away, the reply ${reply < YEAR ? 'would already have arrived, in ' + Math.round(reply) : 'would reach Earth around <b>' + Math.round(reply) + '</b>'}.` : `Our earliest broadcasts will not reach it until <b>${Math.round(heard)}</b>.`}</div>` : ''}
      <h3>Listening log</h3><p style="margin:0 0 8px;font-size:13.5px;color:var(--tx2)">Breakthrough Listen pointed the 100 m Green Bank Telescope here on ${dates.length} day${dates.length === 1 ? '' : 's'}, in ${band}. Each pointing is paired with "OFF" pointings at nearby empty sky, so a signal that also shows up there can be ruled out as Earth's own noise.</p>
      ${dates.slice(0, 12).map(d => `<div class="ev"><i style="background:var(--cy)"></i><div>${fDm(new Date(d + 'T12:00:00Z'))}<small>${OBSDAYS[d].length} targets observed that day</small></div></div>`).join('')}${dates.length > 12 ? `<p class="muted" style="font-size:12px;margin-top:6px">and ${dates.length - 12} more days</p>` : ''}
      <div class="verdict" style="border-color:var(--grn)"><small style="color:var(--grn)">Result</small>No signal from this target has been confirmed. Every candidate in the published Green Bank searches was traced to human-made interference.</div>
      ${nextUp ? `<p class="muted" style="font-size:13px">Climbs above 20° ${relDay(nextUp).toLowerCase() === 'today' ? 'today' : relDay(nextUp)} at ${fT(nextUp)}.</p>` : ''}
      <button class="btn cy" id="tgSky">Show in the sky</button> <button class="btn" id="tgShare">Share</button></div>`, el => {
      ringAnim($('#tgC', el), t.k === 'galaxy' ? '#ffb24d' : spColor(t.sp));
      $('#tgSky', el).onclick = () => { Sheet.close(); App.go('sky'); SkyMap.focus({ ra: t.ra, dec: t.dec, seti: t }); };
      $('#tgShare', el).onclick = () => N.share(`${setiName(t)}${t.ly ? ', ' + t.ly + ' light-years away,' : ''} was listened to ${t.n} times by Breakthrough Listen's search for alien signals. Found with Sky.`);
    });
  }

  /* ----- radio bubble 3D ----- */
  const bb = $('#bbC'); let bbPts = null, bbRaf = 0, bbT0 = performance.now(), bbDrag = null, bbYaw = 0, bbPitch = .9;
  function bubbleData() {
    const near = T.filter(t => t.ly && t.ly < 160).map(t => { const d = t.ly, r = t.ra * D2R, de = t.dec * D2R; return { t, p: [d * Math.cos(de) * Math.cos(r), d * Math.cos(de) * Math.sin(r), d * Math.sin(de)] }; });
    const inside = near.filter(o => o.t.ly < BUB);
    $('#bbYears').textContent = BUB + ' light-years and growing';
    const n1 = inside.sort((a, b) => a.t.ly - b.t.ly)[0];
    $('#bbTxt').innerHTML = `Our radio leakage started around 1920, so it is now about <b>${BUB} light-years</b> out. <b>${fmtN(T.filter(t => t.ly && t.ly < BUB).length)}</b> of the stars Breakthrough Listen checked sit inside that bubble, close enough to have heard us already. The nearest, <b>${esc(setiName(n1.t))}</b>, would have caught our first broadcasts around ${Math.round(1920 + n1.t.ly)}. Drag to turn it.`;
    bbPts = near;
  }
  function bubbleFrame(now) {
    bbRaf = requestAnimationFrame(bubbleFrame); if (S.view !== 'listen' || !bbPts) return;
    const r = bb.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
    const { x, w, h } = hidpi(bb), t = (now - bbT0) / 1000;
    if (!bbDrag) bbYaw += .0025;
    const sc = Math.min(w, h) / 2 / 165, cx = w / 2, cy = h / 2, cy1 = Math.cos(bbYaw), sy = Math.sin(bbYaw), cp = Math.cos(bbPitch), sp = Math.sin(bbPitch);
    const P = p => { const X = p[0] * cy1 - p[1] * sy, Y = p[0] * sy + p[1] * cy1, Z = p[2]; const y2 = Y * cp - Z * sp, z2 = Y * sp + Z * cp; const f = 600 / (600 + z2 * sc * .8); return [cx + X * sc * f, cy + y2 * sc * f * .95, z2, f]; };
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * .7); g.addColorStop(0, '#08142a'); g.addColorStop(1, '#02040b'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    // rings (galactic-ish plane grid)
    x.strokeStyle = 'rgba(120,150,220,.12)'; x.lineWidth = 1;
    for (const rr of [50, 100, 150]) { x.beginPath(); for (let a = 0; a <= 64; a++) { const q = P([rr * Math.cos(a / 64 * 6.283), rr * Math.sin(a / 64 * 6.283), 0]); a ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); } x.stroke(); const q = P([rr, 0, 0]); x.font = '400 9px Mono'; x.fillStyle = 'rgba(150,170,230,.4)'; x.fillText(rr + ' ly', q[0] + 3, q[1]); }
    // bubble sphere
    const bR = BUB * sc; const sg = x.createRadialGradient(cx, cy, bR * .2, cx, cy, bR); sg.addColorStop(0, 'rgba(63,240,207,.02)'); sg.addColorStop(.92, 'rgba(63,240,207,.09)'); sg.addColorStop(1, 'rgba(63,240,207,.28)');
    x.fillStyle = sg; x.beginPath(); x.arc(cx, cy, bR, 0, 7); x.fill();
    x.strokeStyle = 'rgba(63,240,207,.55)'; x.lineWidth = 1.2; x.beginPath(); x.arc(cx, cy, bR, 0, 7); x.stroke();
    for (let k = 0; k < 3; k++) { const p = ((t / 4) + k / 3) % 1; x.strokeStyle = `rgba(63,240,207,${(1 - p) * .35})`; x.beginPath(); x.arc(cx, cy, p * bR, 0, 7); x.stroke(); }
    // stars
    const q = bbPts.map(o => [P(o.p), o]).sort((a, b) => b[0][2] - a[0][2]);
    for (const [pp, o] of q) { const ins = o.t.ly < BUB; x.fillStyle = ins ? spColor(o.t.sp) : 'rgba(150,160,190,.5)'; x.globalAlpha = clamp(.35 + pp[3] * .5, .2, 1) * (ins ? 1 : .55); x.beginPath(); x.arc(pp[0], pp[1], (ins ? 1.6 : 1.1) * pp[3], 0, 7); x.fill(); }
    x.globalAlpha = 1;
    for (const [pp, o] of q) if (o.t.nm && o.t.ly < 12) { x.font = '500 9.5px Inter'; x.fillStyle = 'rgba(220,240,255,.8)'; x.fillText(o.t.nm, pp[0] + 4, pp[1] - 3); }
    // sun
    x.fillStyle = '#ffe9a8'; x.shadowColor = '#ffd27a'; x.shadowBlur = 14; x.beginPath(); x.arc(cx, cy, 3.5, 0, 7); x.fill(); x.shadowBlur = 0;
    x.font = '600 10px Inter'; x.fillStyle = '#ffe9a8'; x.fillText('Sun', cx + 6, cy + 12);
  }
  bb.addEventListener('pointerdown', e => { bbDrag = [e.clientX, e.clientY]; bb.setPointerCapture(e.pointerId); });
  bb.addEventListener('pointermove', e => { if (!bbDrag) return; bbYaw -= (e.clientX - bbDrag[0]) * .01; bbPitch = clamp(bbPitch + (e.clientY - bbDrag[1]) * .01, .1, 1.5); bbDrag = [e.clientX, e.clientY]; });
  bb.addEventListener('pointerup', () => bbDrag = null); bb.addEventListener('pointercancel', () => bbDrag = null);
  bb.style.touchAction = 'pan-y';

  /* ----- real recording ----- */
  const WFS = [
    { f: 'img/wf_z0.png', c: 1420.382, cap: '<b>The hydrogen line, 1420.4 MHz.</b> The bright band is real radio emission from cold hydrogen gas in our own Milky Way, caught behind the target star. It splits into two peaks because separate gas clouds are moving at different speeds. Hydrogen is the most common element there is, which is why the first SETI searches listened at exactly this frequency.' },
    { f: 'img/wf_z1.png', c: 1374.975, cap: '<b>A man-made line at 1374.97 MHz.</b> One razor-thin, perfectly vertical streak: it never drifts. A transmitter on another planet would slide across frequency as that planet spins and orbits. A signal that holds dead steady is moving with us, which means it is on or near Earth.' },
    { f: 'img/wf_z2.png', c: 1447.216, cap: '<b>Steady line on a noise hump, 1447.2 MHz.</b> Another zero-drift line sitting on a broad patch of interference. The horizontal stripes across every panel are the receiver itself changing gain during the five-minute recording.' },
    { f: 'img/wf_z3.png', c: 1426.613, cap: '<b>Two faint lines near 1426.6 MHz.</b> Just above the hydrogen line, two weak steady tones. Searches flag thousands of these per star; the pipeline throws out every one that also appears in the OFF pointings.' }];
  const imgs = WFS.map(w => { const i = new Image(); i.src = w.f; return i; });
  function paintWF(c, img, cfreq) {
    const big = c.id === 'wfMainC', W0 = big ? c.clientWidth : 64, H0 = big ? c.clientHeight : 64; const { x, w, h } = hidpi(c, W0, H0);
    const o = document.createElement('canvas'); o.width = img.naturalWidth || 256; o.height = img.naturalHeight || 256; const ox = o.getContext('2d'); ox.drawImage(img, 0, 0);
    const d = ox.getImageData(0, 0, o.width, o.height); for (let i = 0; i < d.data.length; i += 4) { const c3 = CMAP[d.data[i]]; d.data[i] = c3[0]; d.data[i + 1] = c3[1]; d.data[i + 2] = c3[2]; } ox.putImageData(d, 0, 0);
    x.imageSmoothingEnabled = true; x.drawImage(o, 0, 0, w, h);
    if (big) { x.font = '500 10px Mono'; x.fillStyle = 'rgba(200,255,240,.85)'; const half = 128 * .00286;
      x.fillText((cfreq + half).toFixed(3), 6, h - 8); x.textAlign = 'right'; x.fillText((cfreq - half).toFixed(3) + ' MHz', w - 6, h - 8); x.textAlign = 'left';
      x.fillText('0 s', 6, 14); x.fillText('↓ 293 s', 6, 28); }
  }
  let wfSel = 0;
  function realWF() {
    $('#wfThumbs').innerHTML = WFS.map((w, i) => `<button data-i="${i}" class="${i === wfSel ? 'on' : ''}"><canvas></canvas></button>`).join('');
    const draw = () => { $$('#wfThumbs canvas').forEach((c, i) => imgs[i].complete && paintWF(c, imgs[i], WFS[i].c)); if (imgs[wfSel].complete) paintWF($('#wfMainC'), imgs[wfSel], WFS[wfSel].c); $('#wfCap').innerHTML = WFS[wfSel].cap; };
    imgs.forEach(i => i.onload = draw); draw();
    $$('#wfThumbs button').forEach(b => b.onclick = () => { wfSel = +b.dataset.i; $$('#wfThumbs button').forEach(x => x.classList.toggle('on', x === b)); draw(); N.haptic(8); });
  }

  /* ----- Drake ----- */
  const DK = [
    ['R', 'New stars per year in the Milky Way', 0, 1.3, .01, v => Math.pow(10, v), v => v.toFixed(1), Math.log10(1.5)],
    ['fp', 'Share of stars with planets', 0, 1, .01, v => v, v => Math.round(v * 100) + '%', 1],
    ['ne', 'Habitable planets per system', -2, .7, .01, v => Math.pow(10, v), v => v.toFixed(2), Math.log10(.2)],
    ['fl', 'Where life starts', -4, 0, .01, v => Math.pow(10, v), v => pct(v), Math.log10(.1)],
    ['fi', 'Where life becomes intelligent', -4, 0, .01, v => Math.pow(10, v), v => pct(v), Math.log10(.01)],
    ['fc', 'Intelligence that builds radio', -2, 0, .01, v => Math.pow(10, v), v => pct(v), Math.log10(.1)],
    ['L', 'Years a civilisation keeps transmitting', 2, 8, .01, v => Math.pow(10, v), v => v >= 1e6 ? (v / 1e6).toFixed(v < 1e7 ? 1 : 0) + ' million' : fmtN(Math.round(v)), 4]];
  function pct(v) { return v >= .01 ? (v * 100).toFixed(v < .1 ? 1 : 0) + '%' : '1 in ' + fmtN(Math.round(1 / v)); }
  const PRE = { 'Drake, 1961': [0, .35, Math.log10(3), 0, 0, Math.log10(.15), 4], 'Optimist': [Math.log10(3), 1, Math.log10(.4), 0, Math.log10(.5), Math.log10(.5), 6], 'Pessimist': [0, .5, Math.log10(.05), -3, -3, -1, 2.7] };
  let dv = DK.map(d => d[7]);
  function drake() {
    $('#drake').innerHTML = `<div class="presets">${Object.keys(PRE).map(k => `<button data-p="${k}">${k}</button>`).join('')}</div>` + DK.map((d, i) => `<div class="dk"><label>${d[1]}<b id="dkv${i}"></b></label><input type="range" min="${d[2]}" max="${d[3]}" step="${d[4]}" value="${dv[i]}" data-i="${i}"></div>`).join('') + `<div class="dres"><div class="n" id="dkN"></div><p id="dkT"></p></div>`;
    $$('#drake input').forEach(r => r.oninput = () => { dv[+r.dataset.i] = +r.value; calc(); });
    $$('#drake [data-p]').forEach(b => b.onclick = () => { dv = PRE[b.dataset.p].slice(); $$('#drake input').forEach((r, i) => r.value = dv[i]); calc(); N.haptic(10); });
    calc();
  }
  function calc() {
    let n = 1; DK.forEach((d, i) => { const v = d[5](dv[i]); n *= v; $('#dkv' + i).textContent = d[6](v); });
    $('#dkN').textContent = n >= 100 ? fmtN(Math.round(n)) : n >= 1 ? n.toFixed(1) : n.toPrecision(2);
    const sp = 88600 / Math.sqrt(Math.max(n, 1e-9));
    $('#dkT').innerHTML = n < 1 ? `Fewer than one at a time: on these numbers we are most likely <b>alone in the galaxy right now</b>, even if others came before us or will come after.` :
      `civilisations transmitting in the Milky Way right now. The nearest would be roughly <b>${fmtN(Math.round(sp / 100) * 100)} light-years</b> away, so one hello and one reply would take <b>${fmtN(Math.round(sp * 2 / 100) * 100)} years</b>.${sp > BUB ? ' Our own signals have not reached them yet.' : ''}`;
  }

  let built = false;
  return {
    show() {
      if (!built) { built = true; stats(); realWF(); drake(); }
      countUp(); above(); bubbleData();
      if (!raf) raf = requestAnimationFrame(frame); if (!bbRaf) bbRaf = requestAnimationFrame(bubbleFrame);
    },
    placeChanged() { queue = []; cur = null; if (S.view === 'listen') above(); },
    target
  };
})();
