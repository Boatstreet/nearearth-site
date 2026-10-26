/* Solar — "Heading for Earth": CMEs on their way, drawn as expanding clouds travelling from the Sun to Earth.
   Positions come from NASA's model arrival time (DONKI / WSA-ENLIL): how far along the trip each CME is right now. */
(function () {
  'use strict';
  const { Fmt, esc } = U;
  const COLORS = ['#ff8f3d', '#ff5c8a', '#ffd166', '#c39bff'];
  const seen = new Set(); // CMEs whose launch animation already played this session

  // CMEs aimed at Earth that are on their way or arrived in the last 18 hours
  function active(events) {
    const now = Date.now();
    return (events || []).filter((e) => e.kind === 'cme' && e.earth && e.arrival && +e.arrival > now - 18 * 3600e3 && +e.t < now)
      .sort((a, b) => a.arrival - b.arrival);
  }
  // Each CME keeps one colour everywhere: its place among the CMEs on their way (soonest arrival first).
  function colorFor(e, events) {
    const i = active(events).findIndex((x) => +x.t === +e.t);
    return COLORS[(i >= 0 ? i : Math.floor(+e.t / 60000)) % COLORS.length];
  }
  const frac = (e, now) => Math.max(0, Math.min(1.08, (now - +e.t) / (+e.arrival - +e.t || 1)));
  const gOf = (k) => (k >= 5 ? 'G' + Math.min(5, Math.floor(k) - 4) : '');
  function until(t) {
    const h = Math.round((+t - Date.now()) / 3600e3);
    if (h <= 0) return h > -1 ? 'arriving now' : -h + ' h ago';
    return h < 48 ? 'in ' + h + ' h' : 'in ' + Math.round(h / 24) + ' days';
  }

  function rows(list) {
    const now = Date.now();
    return list.map((e, i) => {
      const f = frac(e, now), arrived = +e.arrival <= now;
      const bits = [e.speed ? Math.round(e.speed) + ' km/s' : '', e.kpMax != null ? 'expected Kp up to ' + e.kpMax + (gOf(e.kpMax) ? ' (' + gOf(e.kpMax) + ')' : '') : '', e.glancing ? 'glancing blow' : ''].filter(Boolean);
      return `<button class="row cmerow" data-cmeev="${+e.t}" style="--cc:${colorFor(e, list)}">
        <span class="cmedot"></span>
        <span class="tx"><span class="t1">${arrived ? 'Arrived' : 'Arrives'} ${Fmt.dayTime(e.arrival)} · ${until(e.arrival)}</span>
          <span class="t2">Left the Sun ${Fmt.dayTime(e.t)}${e.loc ? ' from ' + esc(e.loc) : ''}</span>
          ${bits.length ? `<span class="t2">${esc(bits.join(' · '))}</span>` : ''}
          <span class="cmebar"><i style="width:${Math.min(100, Math.round(f * 100))}%"></i></span></span>
        <em>${Math.min(100, Math.round(f * 100))}%</em></button>`;
    }).join('');
  }

  // The whole box for the Activity tab (empty when nothing is on its way)
  function box(events, err) {
    const list = active(events);
    if (!list.length) {
      // nothing on its way: keep the box, with a calm Sun–Earth scene and the last CME aimed at Earth
      const lastHit = (events || []).filter((e) => e.kind === 'cme' && e.earth && e.arrival && +e.arrival < Date.now()).sort((a, b) => b.arrival - a.arrival)[0];
      const status = !events ? (err ? `Couldn't reach NASA right now (${esc(err)}) — Solar will try again shortly.` : 'Checking NASA\'s CME model…') :
        'NASA\'s model shows no CMEs heading for Earth right now. Solar checks every hour and will show one here as soon as it is launched.';
      return `<div class="card cmebox calm">
        <div class="cmehead"><span class="cmetag calm">${ic('cme')} Heading for Earth</span><span>NASA model</span></div>
        <b class="cmetitle">${events ? 'Nothing on its way' : 'Checking…'}</b>
        <canvas class="cmecv" data-cme-anim></canvas>
        <p class="muted small">${status}${lastHit ? ` The last one reached Earth ${Fmt.dayTime(lastHit.arrival)}${lastHit.kpMax != null ? ' (expected Kp up to ' + lastHit.kpMax + ')' : ''}.` : ''}</p>
      </div>`;
    }
    const next = list.find((e) => +e.arrival > Date.now()) || list[list.length - 1];
    return `<div class="card cmebox">
      <div class="cmehead"><span class="cmetag">${ic('cme')} Heading for Earth</span><span>${list.length === 1 ? '1 CME' : list.length + ' CMEs'} · NASA model</span></div>
      <b class="cmetitle">${+next.arrival > Date.now() ? 'Arrives ' + until(next.arrival) : 'Arrived ' + until(next.arrival)}</b>
      <canvas class="cmecv" data-cme-anim></canvas>
      <div class="cmelist">${rows(list)}</div>
      <p class="muted small">A CME is a cloud of solar material thrown out by the Sun. When one reaches Earth it can set off a geomagnetic storm and aurora. Arrival times are NASA model estimates and are usually right to within about ±7 hours.</p>
    </div>`;
  }

  // ---------------- the animation ----------------
  function start(root, events) {
    const list = active(events);
    root.querySelectorAll('canvas[data-cme-anim]').forEach((cv) => animate(cv, cv.dataset.only ? list.filter((e) => String(+e.t) === cv.dataset.only) : list, events));
  }
  function animate(cv, list, all) {
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const Wc = cv.clientWidth || 340, Hc = 170;
    cv.width = Wc * dpr; cv.height = Hc * dpr; cv.style.height = Hc + 'px';
    const c = cv.getContext('2d'); c.scale(dpr, dpr);
    const sx = 40, sy = Hc / 2, ex = Wc - 34, D = ex - sx;
    const t0 = performance.now();
    const clouds = list.map((e, i) => {
      const key = String(+e.t), intro = !seen.has(key); seen.add(key);
      const half = Math.max(15, Math.min(60, e.half || 35)) * Math.PI / 180;
      const dir = -Math.max(-45, Math.min(45, e.dir || 0)) * Math.PI / 180; // solar west drawn upwards
      const parts = Array.from({ length: 70 }, () => ({ a: (Math.random() * 2 - 1) * half, r: Math.random(), v: 0.15 + Math.random() * 0.25, s: 0.6 + Math.random() * 1.4 }));
      return { e, half, dir, parts, intro, color: colorFor(e, all || list) };
    });
    const stars = Array.from({ length: 40 }, () => ({ x: Math.random() * Wc, y: Math.random() * Hc, a: Math.random() * 0.5 + 0.1 }));
    const wind = Array.from({ length: list.length ? 0 : 70 }, () => ({ a: (Math.random() * 2 - 1) * 0.9, r: Math.random(), v: 0.08 + Math.random() * 0.1 }));
    let last = t0;
    function frame(now) {
      if (!cv.isConnected) return; // the tab or sheet was closed
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const time = (now - t0) / 1000;
      c.clearRect(0, 0, Wc, Hc);
      for (const st of stars) { c.fillStyle = `rgba(255,255,255,${st.a})`; c.fillRect(st.x, st.y, 1, 1); }
      // Earth's orbit
      c.strokeStyle = 'rgba(120,160,220,.18)'; c.setLineDash([3, 5]); c.lineWidth = 1;
      c.beginPath(); c.arc(sx, sy, D, -0.5, 0.5); c.stroke(); c.setLineDash([]);
      // the everyday solar wind, when no CME is on its way
      for (const w of wind) {
        w.r += w.v * dt; if (w.r > 1) { w.r = 0; w.a = (Math.random() * 2 - 1) * 0.9; }
        const rr = 26 + D * 1.15 * w.r;
        c.fillStyle = `rgba(255,205,150,${0.75 * (1 - w.r * 0.85)})`;
        c.beginPath(); c.arc(sx + Math.cos(w.a) * rr, sy + Math.sin(w.a) * rr, 1.5, 0, 6.283); c.fill();
      }
      // CMEs
      let hitEarth = false;
      for (const cl of clouds) {
        const fNow = frac(cl.e, Date.now());
        const f = cl.intro ? Math.min(fNow, fNow * easeOut(Math.min(1, time / 2.2))) : fNow;
        if (fNow >= 0.98) hitEarth = true;
        const R = Math.max(26, D * f * (1 + 0.012 * Math.sin(time * 2.4)));
        // once it has passed Earth it fades over ~18 hours, so CMEs still on their way stand out
        const gone = Math.max(0, (Date.now() - +cl.e.arrival) / 3600e3), k = gone > 0 ? Math.max(0.18, 0.55 - gone / 40) : 1;
        c.globalAlpha = k;
        const a0 = cl.dir - cl.half, a1 = cl.dir + cl.half;
        // the cloud: a widening fan, brightest at its front
        const g = c.createRadialGradient(sx, sy, 20, sx, sy, R);
        g.addColorStop(0, hexA(cl.color, 0)); g.addColorStop(0.75, hexA(cl.color, 0.10)); g.addColorStop(1, hexA(cl.color, 0.32));
        c.fillStyle = g; c.beginPath(); c.moveTo(sx, sy); c.arc(sx, sy, R, a0, a1); c.closePath(); c.fill();
        // particles streaming out behind the front
        for (const pt of cl.parts) {
          pt.r += pt.v * dt * 0.6; if (pt.r > 1) { pt.r = 0.05; pt.a = (Math.random() * 2 - 1) * cl.half; }
          const rr = 22 + (R - 22) * pt.r, an = cl.dir + pt.a;
          c.fillStyle = hexA(cl.color, 0.25 + 0.6 * pt.r);
          c.beginPath(); c.arc(sx + Math.cos(an) * rr, sy + Math.sin(an) * rr, pt.s, 0, 6.283); c.fill();
        }
        // the shock front
        c.save(); c.shadowColor = cl.color; c.shadowBlur = 12; c.strokeStyle = cl.color; c.lineWidth = 3; c.lineCap = 'round';
        c.beginPath(); c.arc(sx, sy, R, a0, a1); c.stroke(); c.restore();
        c.globalAlpha = 1;
        if (cl.e.speed && R > 60 && gone === 0) { c.fillStyle = 'rgba(255,255,255,.75)'; c.font = '600 10px Roboto, sans-serif'; c.textAlign = 'center'; c.fillText(Math.round(cl.e.speed) + ' km/s', sx + Math.cos(a0) * R, sy + Math.sin(a0) * R - 7); }
      }
      // the Sun
      const sg = c.createRadialGradient(sx, sy, 4, sx, sy, 34);
      sg.addColorStop(0, '#fff3c4'); sg.addColorStop(0.45, '#ffb347'); sg.addColorStop(0.62, 'rgba(255,140,40,.55)'); sg.addColorStop(1, 'rgba(255,120,30,0)');
      c.fillStyle = sg; c.beginPath(); c.arc(sx, sy, 34, 0, 6.283); c.fill();
      // Earth (with an aurora glow once a CME reaches it)
      if (hitEarth) { const pulse = 0.5 + 0.5 * Math.sin(time * 3); c.fillStyle = `rgba(124,240,176,${0.18 + 0.2 * pulse})`; c.beginPath(); c.arc(ex, sy, 14 + 3 * pulse, 0, 6.283); c.fill(); }
      const eg = c.createRadialGradient(ex - 2, sy - 2, 1, ex, sy, 8);
      eg.addColorStop(0, '#9fd8ff'); eg.addColorStop(1, '#2a6fd6');
      c.fillStyle = eg; c.beginPath(); c.arc(ex, sy, 7.5, 0, 6.283); c.fill();
      c.fillStyle = 'rgba(255,255,255,.6)'; c.font = '500 10.5px Roboto, sans-serif'; c.textAlign = 'center';
      c.fillText('Sun', sx, sy + 46); c.fillText('Earth', ex, sy + 24);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

  window.CmeAnim = { active, box, start, until, colorFor };
})();
