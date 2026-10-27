'use strict';
/* ---------- Planet pages: rendered globe + photo, facts, live data, live orbit map ---------- */
const Planets = (() => {
  const INFO = {
    Mercury: { wiki: 'Mercury_(planet)', tag: 'The smallest planet and the closest to the Sun', diam: '4,879 km', day: '176 Earth days', dayNote: 'sunrise to sunrise', year: '88 days', moons: '0', temp: '−173 to 427 °C', sunDist: '58 million km', period: 87.97, col: '#b8aea3',
      blurb: 'A scorched, cratered world barely bigger than our Moon. It races around the Sun faster than any other planet, so it never strays far from the Sun in our sky: look low in the west just after sunset or low in the east just before sunrise.' },
    Venus: { wiki: 'Venus', tag: 'The brightest planet, wrapped in acid clouds', diam: '12,104 km', day: '117 Earth days', dayNote: 'and it spins backwards', year: '225 days', moons: '0', temp: '464 °C', sunDist: '108 million km', period: 224.7, col: '#f3dfb0',
      blurb: 'Almost Earth\'s twin in size, but its thick carbon dioxide air traps so much heat that the surface is hot enough to melt lead. The bright clouds reflect sunlight so well that Venus outshines everything in the night sky except the Moon.' },
    Mars: { wiki: 'Mars', tag: 'The red planet, rusted iron dust', diam: '6,779 km', day: '24 h 40 min', dayNote: 'almost like ours', year: '687 days', moons: '2', moonNote: 'Phobos and Deimos', temp: '−63 °C average', sunDist: '228 million km', period: 686.98, col: '#e2733f',
      blurb: 'A cold desert world with the tallest volcano in the solar system, Olympus Mons, and a canyon long enough to stretch across the United States. Rovers are still driving across it today, looking for signs that it once had life.' },
    Jupiter: { wiki: 'Jupiter', tag: 'The giant: more than twice as massive as all the other planets together', diam: '139,820 km', day: '9 h 56 min', dayNote: 'the fastest spin', year: '11.9 years', moons: '101', moonNote: 'confirmed, March 2026', temp: '−110 °C at the cloud tops', sunDist: '778 million km', period: 4332.6, col: '#f0d2a4',
      blurb: 'A ball of hydrogen and helium with no solid surface. Its Great Red Spot is a storm wider than Earth that has been raging for centuries. Even small binoculars show its four largest moons as tiny stars lined up beside it.' },
    Saturn: { wiki: 'Saturn', tag: 'The ringed planet', diam: '116,460 km', day: '10 h 33 min', dayNote: '', year: '29.4 years', moons: '285', moonNote: 'confirmed, March 2026, the most of any planet', temp: '−140 °C at the cloud tops', sunDist: '1.43 billion km', period: 10759.2, col: '#ead9a0',
      blurb: 'Its rings are made of countless chunks of ice, from grains of dust to pieces as big as a house, spread 280,000 km wide but mostly only about ten metres thick. Saturn is so light for its size that it would float in a big enough bath.' },
  };
  const OBL = 23.4393 * D2R;

  /* ---------------- procedural textures (equirectangular) ---------------- */
  function noise2(seed) {
    const p = new Uint8Array(512), r = rng(seed); for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 256; i++) p[i + 256] = p[i];
    const g = (h, x, y) => ((h & 1) ? x : -x) + ((h & 2) ? y : -y), f = t => t * t * t * (t * (t * 6 - 15) + 10);
    const n = (x, y) => { const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y); const u = f(x), v = f(y), A = p[X] + Y, B = p[X + 1] + Y;
      return lerp(lerp(g(p[A], x, y), g(p[B], x - 1, y), u), lerp(g(p[A + 1], x, y - 1), g(p[B + 1], x - 1, y - 1), u), v); };
    return (x, y, oct = 4) => { let s = 0, a = .5, fr = 1; for (let o = 0; o < oct; o++) { s += a * n(x * fr, y * fr); a *= .5; fr *= 2; } return s; };
  }
  const TW = 360, TH = 180, texCache = {};
  function texture(name) {
    if (texCache[name]) return texCache[name];
    const d = new Uint8ClampedArray(TW * TH * 3), N = noise2(name.length * 97 + 13), N2 = noise2(name.length * 31 + 7);
    const put = (i, c) => { d[i * 3] = clamp(c[0], 0, 255); d[i * 3 + 1] = clamp(c[1], 0, 255); d[i * 3 + 2] = clamp(c[2], 0, 255); };
    const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    // wrap noise horizontally: sample on a cylinder
    const cyl = (fn, x, y, s, o) => { const f = s / TH * 2, t = x / TW; return lerp(fn(x * f + 11, y * f + 7, o), fn((x - TW) * f + 11, y * f + 7, o), t); };   // seamless around the globe
    const craters = name === 'Mercury' ? Array.from({ length: 70 }, (_, k) => { const r = rng(k * 7 + 3); return [r() * TW, 12 + r() * (TH - 24), 1.2 + Math.pow(r(), 4) * 20]; }) : [];
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      const i = y * TW + x, lat = 90 - (y + .5) / TH * 180; let c;
      if (name === 'Mercury') {
        const n = cyl(N, x, y, 5, 5); c = mixc([156, 148, 140], [104, 98, 92], clamp(.5 + n * 1.6, 0, 1));
        for (const [cx, cy, cr] of craters) { let dx = Math.abs(x - cx); if (dx > TW / 2) dx = TW - dx; const dd = Math.hypot(dx, y - cy) / cr; if (dd < 1.15) { if (dd < .85) c = mixc(c, [92, 88, 84], .3 * (1 - dd * dd)); else c = mixc(c, [186, 178, 168], .32 * (1.15 - dd) / .3); } }
      } else if (name === 'Venus') {
        const n = cyl(N, x, y, 3, 5), sw = Math.sin(lat * .09 + n * 4);
        c = mixc([246, 226, 182], [214, 178, 118], clamp(.45 + .3 * sw + n * .8, 0, 1));
      } else if (name === 'Mars') {
        const n = cyl(N, x, y, 4, 6), n2 = cyl(N2, x, y, 9, 3);
        c = mixc([214, 110, 58], [128, 52, 26], clamp(.55 + n * 2.2, 0, 1)); c = mixc(c, [236, 160, 110], clamp(n2 * 1.5, 0, .35));
        if (Math.abs(lat + 8) < 3 && x > 80 && x < 150) c = mixc(c, [90, 36, 18], .55 * (1 - Math.abs(lat + 8) / 3));   // Valles Marineris
        const cap = Math.abs(lat) - (lat > 0 ? 76 : 80) + n * 9; if (cap > 0) c = mixc(c, [250, 248, 244], clamp(cap / 3, 0, 1));
      } else if (name === 'Jupiter') {
        const tb = cyl(N, x, y, 6, 4) * 2.6, L = lat + tb, band = Math.sin(L * .19) + .5 * Math.sin(L * .43 + 1);
        const pal = [[244, 230, 206], [206, 160, 112], [232, 206, 168], [176, 120, 82], [250, 240, 222]];
        const k = clamp(Math.floor((band + 1.5) / 3 * pal.length), 0, pal.length - 1), fr = ((band + 1.5) / 3 * pal.length) % 1;
        c = mixc(pal[k], pal[Math.min(k + 1, pal.length - 1)], fr * .5); if (Math.abs(lat) > 62) c = mixc(c, [170, 150, 132], (Math.abs(lat) - 62) / 28);
        let dx = Math.abs(x - 180); if (dx > TW / 2) dx = TW - dx; const gr = Math.hypot(dx / 15, (lat + 22) / 7.5);
        if (gr < 1) c = mixc(c, [196, 92, 60], (1 - gr) * .95 + .05); else if (gr < 1.3) c = mixc(c, [246, 232, 210], (1.3 - gr) * 1.6);
      } else {
        const tb = cyl(N, x, y, 2.4, 3) * 3, L = lat + tb, band = Math.sin(L * .16) + .35 * Math.sin(L * .5);
        c = mixc([240, 222, 172], [206, 176, 120], clamp(.5 + band * .35, 0, 1)); if (Math.abs(lat) > 66) c = mixc(c, [168, 170, 150], (Math.abs(lat) - 66) / 24);
      }
      put(i, c);
    }
    return texCache[name] = d;
  }

  /* ---------------- rotating globe ---------------- */
  let globe = null;
  function startGlobe(cv, name) {
    const R = 128, S = R * 2 + (name === 'Saturn' ? 0 : 0), dpr = 1, tex = texture(name);
    const o = document.createElement('canvas'); o.width = S; o.height = S; const ox = o.getContext('2d'), img = ox.createImageData(S, S);
    // precompute sphere mapping (tilted axis)
    const tilt = { Mercury: .03, Venus: .05, Mars: .44, Jupiter: .05, Saturn: .47 }[name], ct = Math.cos(tilt), st = Math.sin(tilt);
    const map = [], L = [-.55, -.45, .7], ll = Math.hypot(...L); L[0] /= ll; L[1] /= ll; L[2] /= ll;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const nx = (x + .5 - R) / R, ny = (y + .5 - R) / R, r2 = nx * nx + ny * ny; if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2), yy = ny * ct - nx * st, xx = nx * ct + ny * st;   // rotate image plane by axial tilt
      const lat = Math.asin(clamp(-yy, -1, 1)), lon = Math.atan2(xx, nz);
      const dif = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]), shade = clamp(.08 + dif * 1.05, 0, 1.1) * (1 - Math.pow(1 - nz, 3) * .35);
      const edge = r2 > .97 ? (1 - (r2 - .97) / .03) : 1;
      map.push([(y * S + x) * 4, lon, (lat * R2D + 90) / 180 * (TH - 1), shade, edge]);
    }
    const t0 = performance.now(), spin = { Mercury: .03, Venus: .015, Mars: .07, Jupiter: .16, Saturn: .14 }[name];
    function frame(n) {
      if (!cv.isConnected || globe !== g) return; g.raf = requestAnimationFrame(frame);
      const t = (n - t0) / 1000, off = t * spin, d = img.data;
      for (const [p, lon, ty, sh, e] of map) {
        let u = ((lon + off) / 6.2832 + .5) % 1; if (u < 0) u += 1; const ti = (Math.floor(ty) * TW + Math.floor(u * TW)) * 3;
        d[p] = tex[ti] * sh; d[p + 1] = tex[ti + 1] * sh; d[p + 2] = tex[ti + 2] * sh; d[p + 3] = 255 * e;
      }
      ox.putImageData(img, 0, 0);
      const { x, w, h } = hidpi(cv); x.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, rr = Math.min(w, h) * (name === 'Saturn' ? .27 : .38);
      // atmosphere glow
      const ag = x.createRadialGradient(cx, cy, rr * .9, cx, cy, rr * 1.35); ag.addColorStop(0, hexA(INFO[name].col, .28)); ag.addColorStop(1, hexA(INFO[name].col, 0));
      x.fillStyle = ag; x.beginPath(); x.arc(cx, cy, rr * 1.35, 0, 7); x.fill();
      if (name === 'Saturn') rings(x, cx, cy, rr, tilt, false);
      x.drawImage(o, cx - rr, cy - rr, rr * 2, rr * 2);
      if (name === 'Saturn') rings(x, cx, cy, rr, tilt, true);
    }
    const g = { raf: requestAnimationFrame(frame) }; globe = g;
  }
  function rings(x, cx, cy, rr, tilt, front) {
    x.save(); x.translate(cx, cy); x.rotate(-tilt * .9);
    x.beginPath(); if (front) x.rect(-rr * 3, 0, rr * 6, rr * 3); else x.rect(-rr * 3, -rr * 3, rr * 6, rr * 3); x.clip();
    const bands = [[1.24, 1.52, 'rgba(190,170,130,.45)'], [1.53, 1.95, 'rgba(236,220,180,.9)'], [2.0, 2.04, 'rgba(0,0,0,0)'], [2.04, 2.27, 'rgba(214,196,156,.75)']];
    for (const [a, b, c] of bands) { x.strokeStyle = c; x.lineWidth = (b - a) * rr; x.beginPath(); x.ellipse(0, 0, (a + b) / 2 * rr, (a + b) / 2 * rr * .3, 0, 0, 7); x.stroke(); }
    if (!front) { x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(rr * .25, rr * .05, rr * .95, rr * .2, 0, 0, Math.PI); x.fill(); }
    x.restore();
  }
  const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  /* ---------------- orbit map ---------------- */
  const ORB = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn'], PER = { Mercury: 87.97, Venus: 224.7, Earth: 365.256, Mars: 686.98, Jupiter: 4332.6, Saturn: 10759.2 };
  const COL = { Mercury: '#b8aea3', Venus: '#f3dfb0', Earth: '#5aa6ff', Mars: '#e2733f', Jupiter: '#f0d2a4', Saturn: '#ead9a0' };
  const paths = {};
  function helio(b, d) { const v = A.HelioVector(b, d); return [v.x, v.y * Math.cos(OBL) + v.z * Math.sin(OBL)]; }
  function orbitPath(b) { if (paths[b]) return paths[b]; const t0 = new Date(), pts = []; for (let i = 0; i <= 180; i++) pts.push(helio(b, new Date(+t0 + i / 180 * PER[b] * 864e5))); return paths[b] = pts; }
  let orb = null;
  function startOrbit(cv, name) {
    const st = { name, play: 0, playT0: 0, t0: performance.now() }; orb = st;
    const sc = (p, R) => { const r = Math.hypot(p[0], p[1]), k = Math.sqrt(r) / Math.sqrt(11.2) * R / (r || 1); return [p[0] * k, -p[1] * k]; };
    function frame(n) {
      if (!cv.isConnected || orb !== st) return; requestAnimationFrame(frame);
      const r = cv.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
      const { x, w, h } = hidpi(cv), t = (n - st.t0) / 1000, cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 14;
      let days = 0;
      if (st.play) { const p = (n - st.playT0) / 9000; if (p >= 1) { st.play = 0; $('#plPlay') && ($('#plPlay').textContent = '▶ Play one orbit'); } else days = p * PER[name]; }
      const date = new Date(Date.now() + days * 864e5);
      const bg = x.createRadialGradient(cx, cy, 0, cx, cy, R * 1.2); bg.addColorStop(0, '#0b1530'); bg.addColorStop(1, '#03050c'); x.fillStyle = bg; x.fillRect(0, 0, w, h);
      // orbits
      for (const b of ORB) { const P = orbitPath(b), sel = b === name || b === 'Earth';
        x.strokeStyle = b === name ? 'rgba(63,240,207,.85)' : b === 'Earth' ? 'rgba(90,166,255,.55)' : 'rgba(150,170,220,.16)'; x.lineWidth = b === name ? 1.8 : 1;
        x.beginPath(); P.forEach((p, i) => { const q = sc(p, R); i ? x.lineTo(cx + q[0], cy + q[1]) : x.moveTo(cx + q[0], cy + q[1]); }); x.stroke(); }
      // sun
      const sg = x.createRadialGradient(cx, cy, 0, cx, cy, 18); sg.addColorStop(0, '#fff'); sg.addColorStop(.3, '#ffd27a'); sg.addColorStop(1, 'rgba(255,170,60,0)'); x.fillStyle = sg; x.beginPath(); x.arc(cx, cy, 18, 0, 7); x.fill();
      // bodies
      const pos = {}; for (const b of ORB) pos[b] = sc(helio(b, date), R);
      const E = pos.Earth, Pp = pos[name];
      x.setLineDash([4, 5]); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(cx + E[0], cy + E[1]); x.lineTo(cx + Pp[0], cy + Pp[1]); x.stroke(); x.setLineDash([]);
      for (const b of ORB) { const q = pos[b], big = b === name, rad = big ? 7 : b === 'Earth' ? 5 : 3.2;
        if (big) { const ph = (t % 1.6) / 1.6; x.strokeStyle = `rgba(63,240,207,${1 - ph})`; x.lineWidth = 1.5; x.beginPath(); x.arc(cx + q[0], cy + q[1], rad + ph * 16, 0, 7); x.stroke(); }
        x.fillStyle = COL[b]; x.shadowColor = COL[b]; x.shadowBlur = big || b === 'Earth' ? 10 : 0; x.beginPath(); x.arc(cx + q[0], cy + q[1], rad, 0, 7); x.fill(); x.shadowBlur = 0;
        if (big || b === 'Earth') { x.font = '600 12px Inter'; x.fillStyle = big ? '#bffff0' : '#bcd8ff'; const lb = b === 'Earth' ? 'Earth (you)' : b, tw = x.measureText(lb).width; if (cx + q[0] + rad + 5 + tw > w - 6) x.fillText(lb, clamp(cx + q[0] - tw / 2, 6, w - 6 - tw), cy + q[1] + rad + 15); else x.fillText(lb, cx + q[0] + rad + 5, cy + q[1] - rad); }
        else { x.font = '500 9.5px Inter'; x.fillStyle = 'rgba(200,210,240,.5)'; x.fillText(b, cx + q[0] + 5, cy + q[1] + 3); } }
      const d = A.GeoVector(name, date, true).Length();
      x.font = '500 11px Mono'; x.fillStyle = 'rgba(220,235,255,.85)'; x.fillText(st.play ? fDm(date) : 'Now · ' + fDm(date), 12, 20);
      x.fillText((d * 149.5978707).toFixed(0) + ' million km apart', 12, h - 12);
      x.textAlign = 'right'; x.fillStyle = 'rgba(160,175,210,.55)'; x.font = '400 9.5px Inter'; x.fillText('Distances squeezed to fit', w - 12, h - 12); x.textAlign = 'left';
    }
    requestAnimationFrame(frame);
    return st;
  }

  /* ---------------- live numbers ---------------- */
  let liveT = 0;
  function live(name) {
    const now = new Date(), obs = observer(), bp = bodyPos(name, now, obs), il = A.Illumination(name, now);
    const km = bp.dist * 149597870.7, km2 = A.GeoVector(name, new Date(+now + 6e4), true).Length() * 149597870.7, v = (km2 - km) / 60;
    let con = ''; try { con = A.Constellation(bp.ra / 15, bp.dec).name; } catch (e) {}
    const el = A.Elongation(name, now), lt = km / 299792.458;
    const rs = d => { try { return asDate(A.SearchRiseSet(name, obs, d, new Date(+now - 12 * 36e5), 1.5)); } catch (e) { return null; } };
    const rise = rs(+1), set = rs(-1);
    const set1 = (id, h) => { const e = document.getElementById(id); if (e) e.innerHTML = h; };
    set1('plDist', fmtN(Math.round(km / 1000) * 1000) + ' km');
    set1('plDistN', `${v < 0 ? 'getting closer' : 'moving away'} at <b>${Math.abs(v).toFixed(1)} km/s</b>`);
    set1('plLight', lt < 3600 ? `${Math.floor(lt / 60)} min ${Math.round(lt % 60)} s` : `${Math.floor(lt / 3600)} h ${Math.round(lt % 3600 / 60)} min`);
    set1('plAlt', bp.alt > 0 ? Math.round(bp.alt) + '° up, ' + compassS(bp.az) : 'Below horizon');
    set1('plAltN', bp.alt > 0 ? 'look ' + compass(bp.az) : rise ? 'rises ' + fT(rise) : '');
    set1('plMag', il.mag.toFixed(1)); set1('plMagN', il.mag < -3 ? 'dazzling' : il.mag < -1 ? 'very bright' : il.mag < 1 ? 'bright' : il.mag < 3 ? 'easy to see' : 'faint');
    set1('plCon', esc(con)); set1('plElong', Math.round(el.elongation) + '° from Sun'); set1('plElongN', el.elongation < 15 ? 'lost in the glare' : el.visibility === 'evening' ? 'evening sky' : 'morning sky');
    set1('plPhase', Math.round(il.phase_fraction * 100) + '% lit');
    set1('plRS', `↑ ${fT(rise)}  ↓ ${fT(set)}`);
  }

  /* ---------------- sheet ---------------- */
  function open(name) {
    const I = INFO[name]; if (!I) return;
    Sheet.open(`<div class="pl-sheet">
      <div class="pl-hero"><canvas id="plGlobe"></canvas><img id="plPhoto" alt=""><div class="pl-seg" id="plSeg" hidden><button data-v="g" class="on">Globe</button><button data-v="p">Photo</button></div><div class="pl-cred" id="plCred"></div></div>
      <div class="eyebrow" style="color:${I.col}">Planet</div><h2 style="margin:2px 0 4px">${name}</h2><p class="pl-tag">${esc(I.tag)}</p>
      <button class="live-btn" id="plLive"><i></i><span>LIVE</span>Where is it now?</button>
      <div class="pl-live">
        <div><small>Distance from you</small><b id="plDist">…</b><i id="plDistN"></i></div>
        <div><small>Light takes</small><b id="plLight">…</b><i>to reach your eyes</i></div>
        <div><small>Right now</small><b id="plAlt">…</b><i id="plAltN"></i></div>
        <div><small>Brightness</small><b>mag <span id="plMag"></span></b><i id="plMagN"></i></div>
        <div><small>In</small><b id="plCon"></b><i>constellation</i></div>
        <div><small>Position</small><b id="plElong"></b><i id="plElongN"></i></div>
        <div><small>Rises · sets</small><b id="plRS"></b><i>today</i></div>
        <div><small>Phase</small><b id="plPhase"></b><i>of the face we see</i></div>
      </div>
      ${name === 'Jupiter' ? `<h3>Jupiter's moons ${S.pro ? 'tonight' : ''} <span class="pro-b">PRO</span></h3><div id="jmBox"></div>` : ''}
      <h3>Its orbit, live</h3>
      <canvas id="plOrbit"></canvas>
      <button class="btn" id="plPlay">▶ Play one orbit</button>
      <h3>About ${name}</h3>
      <p class="pl-blurb">${esc(I.blurb)}</p>
      <div class="pl-facts">
        <div><small>Diameter</small><b>${I.diam}</b></div><div><small>Day</small><b>${I.day}</b>${I.dayNote ? `<i>${I.dayNote}</i>` : ''}</div>
        <div><small>Year</small><b>${I.year}</b></div><div><small>Moons</small><b>${I.moons}</b>${I.moonNote ? `<i>${I.moonNote}</i>` : ''}</div>
        <div><small>Temperature</small><b>${I.temp}</b></div><div><small>From the Sun</small><b>${I.sunDist}</b><i>on average</i></div>
      </div></div>`, el => {
      startGlobe($('#plGlobe', el), name); const st = startOrbit($('#plOrbit', el), name);
      if (name === 'Jupiter') jupMoons($('#jmBox', el));
      live(name); clearInterval(liveT); liveT = setInterval(() => live(name), 1000);
      $('#plLive', el).onclick = () => { N.haptic(14); Sheet.close(); App.go('sky'); SkyMap.focus({ body: name }); };
      $('#plPlay', el).onclick = () => { st.play = 1; st.playT0 = performance.now(); $('#plPlay', el).textContent = '● Playing ' + I.year.replace(' days', '-day').replace(' years', '-year') + ' orbit'; N.haptic(8); };
      // real photo when online
      N.json('https://en.wikipedia.org/api/rest_v1/page/summary/' + I.wiki).then(j => {
        const src = (j.thumbnail && j.thumbnail.source) || (j.originalimage && j.originalimage.source); if (!src) return;
        const im = $('#plPhoto', el); if (!im) return;
        im.onload = () => { const sg = $('#plSeg', el); if (!sg) return; sg.hidden = false; show('p'); };
        im.src = src.replace(/\/\d+px-/, '/640px-');
        const show = v => { $$('#plSeg button', el).forEach(b => b.classList.toggle('on', b.dataset.v === v)); im.classList.toggle('on', v === 'p'); $('#plGlobe', el).classList.toggle('off', v === 'p'); $('#plCred', el).textContent = v === 'p' ? 'Photo: Wikipedia / NASA' : ''; };
        $$('#plSeg button', el).forEach(b => b.onclick = () => { show(b.dataset.v); N.haptic(8); });
      }).catch(() => {});
    });
    Sheet.onclose = () => { globe = null; orb = null; clearInterval(liveT); };
  }
  /* ---------------- Jupiter's Galilean moons (Pro) ---------------- */
  const RJ = 71492 / 149597870.7, JM = [['io', 'Io', '#f2d57a'], ['europa', 'Europa', '#e8e2d2'], ['ganymede', 'Ganymede', '#c9bba4'], ['callisto', 'Callisto', '#9c8f80']];
  function jovian(date) {      // offsets of the four moons on the sky, in Jupiter radii (x east, y north, z away from us)
    const g = A.GeoVector('Jupiter', date, true), d = g.Length(), u = [g.x / d, g.y / d, g.z / d];
    const ra = Math.atan2(u[1], u[0]), dec = Math.asin(u[2]), e = [-Math.sin(ra), Math.cos(ra), 0], n = [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)];
    const jm = A.JupiterMoons(date), lt = d * 0.0057755183;   // light-time in days
    const jm2 = A.JupiterMoons(new Date(+date - lt * 864e5));  // moons as they were when the light left
    return JM.map(([k, nm, col]) => { const m = jm2[k], v = [m.x, m.y, m.z];
      const x = (v[0] * e[0] + v[1] * e[1] + v[2] * e[2]) / RJ, y = (v[0] * n[0] + v[1] * n[1] + v[2] * n[2]) / RJ, z = (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) / RJ;
      const r = Math.hypot(x, y * 1.07), st = r < 1 ? (z > 0 ? 'hidden' : 'transit') : 'clear';
      return { k, nm, col, x, y, z, st }; });
  }
  function jupMoons(box) {
    if (!box) return;
    if (!S.pro) { box.innerHTML = Pro.lockedRow('Jupiter\'s moons live', 'Io, Europa, Ganymede and Callisto as binoculars show them'); box.onclick = () => Pro.paywall('Jupiter'); return; }
    let off = 0; box.innerHTML = `<canvas id="jmC"></canvas><div class="jm-t"><button class="btn" id="jmNow">Now</button><input type="range" id="jmS" min="-48" max="48" step="0.25" value="0"><span id="jmL"></span></div><div class="jm-list" id="jmList"></div><p class="jm-note">As binoculars show them: north up, east to the left. Moons slide back and forth across Jupiter from night to night.</p>`;
    const cv = $('#jmC', box), t0 = performance.now();
    const list = date => { const ms = jovian(date); $('#jmList', box).innerHTML = ms.map(m => `<div><i style="background:${m.col}"></i><b>${m.nm}</b><span>${m.st === 'hidden' ? 'hidden behind Jupiter' : m.st === 'transit' ? 'crossing in front of Jupiter' : (Math.abs(m.x) / 2).toFixed(1) + ' Jupiter-widths ' + (m.x > 0 ? 'left' : 'right')}</span></div>`).join(''); };
    function frame(n) { if (!cv.isConnected) return; requestAnimationFrame(frame);
      const date = new Date(Date.now() + off * 36e5), ms = jovian(date), { x, w, h } = hidpi(cv), cx = w / 2, cy = h / 2, sc = (w / 2 - 16) / 28;
      const bg = x.createRadialGradient(cx, cy, 0, cx, cy, w * .6); bg.addColorStop(0, '#0d1428'); bg.addColorStop(1, '#03050c'); x.fillStyle = bg; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.arc(cx, cy, Math.min(w, h) / 2 - 4, 0, 7); x.stroke();
      const draw = m => { const px = cx - m.x * sc, py = cy - m.y * sc; x.fillStyle = m.col; x.shadowColor = m.col; x.shadowBlur = 8; x.beginPath(); x.arc(px, py, 3.2, 0, 7); x.fill(); x.shadowBlur = 0;
        x.font = '600 10.5px Inter'; x.fillStyle = 'rgba(230,236,255,.9)'; x.textAlign = 'center'; x.fillText(m.nm, px, py + (m.k === 'europa' || m.k === 'callisto' ? -10 : 16)); x.textAlign = 'left'; };
      ms.filter(m => m.z > 0 && m.st !== 'hidden').forEach(draw);   // behind Jupiter but visible beside it
      const jr = Math.max(sc, 9), jg = x.createLinearGradient(cx, cy - jr, cx, cy + jr); jg.addColorStop(0, '#f4e6cc'); jg.addColorStop(.35, '#cfa478'); jg.addColorStop(.5, '#f0dcc0'); jg.addColorStop(.65, '#c39066'); jg.addColorStop(1, '#ead6b8');
      x.fillStyle = jg; x.beginPath(); x.ellipse(cx, cy, jr, jr * .935, 0, 0, 7); x.fill();
      ms.filter(m => m.z <= 0).forEach(draw);
      x.font = '500 10px Mono'; x.fillStyle = 'rgba(160,175,210,.6)'; x.fillText('E', 8, cy + 4); x.textAlign = 'right'; x.fillText('W', w - 8, cy + 4); x.textAlign = 'left';
      $('#jmL', box).textContent = off === 0 ? 'Now' : (off > 0 ? '+' : '−') + Math.abs(off) + ' h · ' + fT(date);
      if (!frame.k || n - frame.k > 500) { frame.k = n; list(date); }
    }
    requestAnimationFrame(frame);
    $('#jmS', box).oninput = e => { off = +e.target.value; };
    $('#jmNow', box).onclick = () => { off = 0; $('#jmS', box).value = 0; };
  }

  return { open, INFO, jovian };
})();
