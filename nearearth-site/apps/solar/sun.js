/* Solar — solar geometry and the live sun disk with region markers */
(function () {
  'use strict';
  const rad = Math.PI / 180, deg = 180 / Math.PI;

  // Low-precision solar ephemeris (Meeus ch. 25 & 29) — plenty for placing markers on a disk.
  function geom(date) {
    const jd = date.getTime() / 864e5 + 2440587.5;
    const T = (jd - 2451545) / 36525;
    const L0 = (280.46646 + 36000.76983 * T) % 360;
    const M = (357.52911 + 35999.05029 * T) * rad;
    const e = 0.016708634 - 0.000042037 * T;
    const C = (1.914602 - 0.004817 * T) * Math.sin(M) + 0.019993 * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
    const nu = M + C * rad;
    const R = 1.000001018 * (1 - e * e) / (1 + e * Math.cos(nu));
    const lam = (L0 + C - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * T) * rad)) * rad;
    const I = 7.25 * rad, K = (73.6667 + 1.3958333 * (jd - 2396758) / 36525) * rad;
    const B0 = Math.asin(Math.sin(lam - K) * Math.sin(I)) * deg;
    return { B0, R, rsun: 959.63 / R };
  }

  // Heliographic (lat, lon from central meridian, degrees) → disk coords in units of solar radius, north up, west right.
  function project(lat, lon, B0) {
    const b = lat * rad, l = lon * rad, b0 = B0 * rad;
    const x = Math.cos(b) * Math.sin(l);
    const y = Math.sin(b) * Math.cos(b0) - Math.cos(b) * Math.cos(l) * Math.sin(b0);
    const z = Math.sin(b) * Math.sin(b0) + Math.cos(b) * Math.cos(l) * Math.cos(b0);
    return { x, y, z };
  }

  // The sun rotates ~13.2°/day; move a region from its observation time to now.
  function rotate(lon, observedDate, lat, to) {
    if (!observedDate) return lon;
    const t0 = observedDate instanceof Date ? observedDate : U.utc(observedDate);
    if (!t0) return lon;
    const days = ((to ? +to : Date.now()) - t0.getTime()) / 864e5;
    const s = Math.sin((lat || 0) * rad);
    const rate = 14.713 - 2.396 * s * s - 1.787 * s * s * s * s - 0.9856; // synodic, deg/day
    return lon + rate * Math.max(-3, Math.min(days, 3));
  }

  function regionColor(r) {
    const m = (r.mag || '').toUpperCase();
    if (r.xEv || /D/.test(m) || (r.x || 0) >= 10) return 'var(--x)';
    if (r.mEv || /G/.test(m) || (r.m || 0) >= 30) return 'var(--m)';
    return 'var(--c)';
  }

  // Build the disk widget. Returns { el, setChannel(id), setRegions(list,date), onRegion(cb) }
  function disk(opts) {
    const el = document.createElement('div');
    el.className = 'disk';
    el.innerHTML = '<div class="glow"></div><div class="halo"></div>' +
      '<div class="frame"><img class="sunimg" alt="Live image of the Sun" decoding="async"><div class="ph"><div class="phs"></div></div><svg class="ovl" viewBox="-1 -1 2 2" preserveAspectRatio="xMidYMid meet"></svg></div>' +
      '<div class="dstamp"></div>';
    const img = el.querySelector('.sunimg'), ovl = el.querySelector('.ovl'), stamp = el.querySelector('.dstamp');
    let ch = opts.channel, src = 'sdo', regs = [], regDate = null, onReg = null, showMarks = opts.marks !== false;
    const g = geom(new Date());

    function scaleFor() { return Data.diskFrac(ch, src, g.rsun) * 2; } // disk diameter / image width
    function layout() {
      // scale the overlay so 1 unit = one solar radius on the image
      const f = scaleFor();
      ovl.setAttribute('viewBox', [-1 / f, -1 / f, 2 / f, 2 / f].join(' '));
    }
    // Loading: try SDO, then Helioviewer; give each a time limit so a stalled
    // download can't leave the placeholder pulsing forever.
    let timer = null, attempt = 0;
    function setState(state, msg) {
      el.classList.toggle('loading', state === 'loading');
      el.classList.toggle('failed', state === 'failed');
      el.classList.toggle('ok', state === 'ok');
      stamp.textContent = msg;
    }
    function tryLoad(which) {
      clearTimeout(timer);
      src = which;
      const my = ++attempt;
      setState('loading', which === 'sdo' ? 'Loading picture…' : 'Loading picture from Helioviewer…');
      img.src = which === 'sdo' ? Data.sdoUrl(ch, opts.res || 1024) : Data.hvUrl(ch, opts.res || 1024);
      layout(); draw();
      timer = setTimeout(() => { if (my === attempt) fail(); }, which === 'sdo' ? 20000 : 45000);
    }
    function fail() {
      clearTimeout(timer);
      if (src === 'sdo') { tryLoad('hv'); return; }
      img.removeAttribute('src');
      setState('failed', 'Picture unavailable · tap the sun to try again');
    }
    function load() { tryLoad('sdo'); }
    img.addEventListener('load', () => {
      if (!img.naturalWidth) { fail(); return; }
      clearTimeout(timer);
      setState('ok', (src === 'hv' ? 'Helioviewer' : 'NASA SDO') + ' · updated every 15 min');
    });
    img.addEventListener('error', () => { if (img.getAttribute('src')) fail(); });
    el.querySelector('.frame').addEventListener('click', (e) => { if (el.classList.contains('failed') && !e.target.closest('.mk')) load(); });

    function draw() {
      if (!showMarks) { ovl.innerHTML = ''; return; }
      let h = '';
      for (const r of regs) {
        if (r.lat == null || r.lon == null) continue;
        const lon = rotate(r.lon, regDate, r.lat);
        const p = project(r.lat, lon, g.B0);
        if (p.z < 0.05) continue; // rotated off the visible side
        const size = 0.035 + Math.min(0.05, Math.sqrt(Math.max(r.area || 10, 10)) / 900);
        const lx = p.x > 0.55 ? -1 : 1;
        h += `<g class="mk" data-r="${r.region}" transform="translate(${p.x.toFixed(4)},${(-p.y).toFixed(4)})" style="--mc:${regionColor(r)}">` +
          `<circle r="${(size + 0.035).toFixed(3)}" class="hit"/>` +
          `<circle r="${size.toFixed(3)}" class="ring"/>` +
          `<text x="${(lx * (size + 0.018)).toFixed(3)}" y="${(-size - 0.006).toFixed(3)}" text-anchor="${lx > 0 ? 'start' : 'end'}">${r.region % 10000}</text></g>`;
      }
      ovl.innerHTML = h;
    }
    ovl.addEventListener('click', (e) => {
      const m = e.target.closest('.mk'); if (!m || !onReg) return;
      const r = regs.find((x) => String(x.region) === m.dataset.r); if (r) onReg(r);
    });

    load();
    return {
      el,
      setChannel(c) { if (c === ch) return; ch = c; load(); },
      setRegions(list, date) { regs = list || []; regDate = date; draw(); },
      setMarks(v) { showMarks = v; draw(); },
      reload() { load(); },
      onRegion(cb) { onReg = cb; },
    };
  }

  window.Sun = { geom, project, rotate, disk, regionColor };
})();
