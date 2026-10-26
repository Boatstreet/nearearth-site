/* Solar — Eclipse tab: solar eclipses seen from your place, drawn on the live picture of the Sun.
   Positions of the Sun and Moon: Astronomy Engine (Don Cross, MIT licence), computed on the phone. */
(function () {
  'use strict';
  const { Store, Fmt, esc, $, $$ } = U;
  const A = window.Astronomy;
  const R_SUN = 695700, R_MOON = 1737.4, D2R = Math.PI / 180;

  // ---------------- geometry ----------------
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
  const sub = (a, b, k) => [a[0] - k * b[0], a[1] - k * b[1], a[2] - k * b[2]];

  // How the Sun and Moon look from the observer at time t: offsets in solar radii, "up" = towards the zenith.
  function sky(t, obs) {
    const time = A.MakeTime(t);
    const rot = A.Rotation_EQD_HOR(time, obs);
    const hv = (body) => { const eq = A.Equator(body, time, obs, true, true); const v = A.RotateVector(rot, eq.vec); return { u: norm([v.x, v.y, v.z]), d: eq.dist * A.KM_PER_AU }; };
    const s = hv(A.Body.Sun), m = hv(A.Body.Moon);
    let up = sub([0, 0, 1], s.u, s.u[2]);
    if (Math.hypot(up[0], up[1], up[2]) < 1e-6) up = sub([1, 0, 0], s.u, s.u[0]); // Sun at the zenith: use north
    up = norm(up);
    const right = cross(s.u, up);
    const rs = Math.asin(R_SUN / s.d), rm = Math.asin(R_MOON / m.d);
    const x = dot(m.u, right) / rs, y = dot(m.u, up) / rs;           // Moon centre, in solar radii
    // celestial north on the picture (SDO images have north up)
    const npole = A.RotateVector(rot, new A.Vector(0, 0, 1, time));
    const n = norm(sub([npole.x, npole.y, npole.z], s.u, dot([npole.x, npole.y, npole.z], s.u)));
    const rotDeg = Math.atan2(dot(n, right), dot(n, up)) / D2R;
    const hor = A.Horizon(time, obs, ...(() => { const e = A.Equator(A.Body.Sun, time, obs, true, true); return [e.ra, e.dec]; })(), 'normal');
    const k = rm / rs, sep = Math.hypot(x, y);
    return { x, y, k, sep, rotDeg, alt: hor.altitude, az: hor.azimuth, cover: overlap(sep, k), mag: Math.max(0, (1 + k - sep) / 2) };
  }
  // Fraction of the Sun's disk (radius 1) hidden by a disk of radius k at distance d.
  function overlap(d, k) {
    if (d >= 1 + k) return 0;
    if (d <= Math.abs(1 - k)) return k >= 1 ? 1 : k * k;
    const a = Math.acos((d * d + 1 - k * k) / (2 * d)), b = Math.acos((d * d + k * k - 1) / (2 * d * k));
    return (a + k * k * b - 0.5 * Math.sqrt((-d + 1 + k) * (d + 1 - k) * (d - 1 + k) * (d + 1 + k))) / Math.PI;
  }

  // ---------------- finding eclipses ----------------
  const memo = {};
  function list(place) {
    const key = place.lat.toFixed(2) + ',' + place.lon.toFixed(2);
    if (memo[key]) return memo[key];
    const DATES = ['peak', 'begin', 'end', 'tBegin', 'tEnd'];
    const saved = Store.get('ecl:v1:' + key, null);
    if (saved && Array.isArray(saved)) {
      return (memo[key] = saved.map((x) => { const o = Object.assign({}, x); DATES.forEach((k) => { o[k] = x[k] ? new Date(x[k]) : null; }); return o; }));
    }
    const obs = new A.Observer(place.lat, place.lon, 0);
    const out = [], until = Date.UTC(2061, 0, 1);
    let e = A.SearchLocalSolarEclipse(new Date(Date.UTC(2015, 0, 1)), obs);
    for (let n = 0; n < 80 && e.peak.time.date.getTime() < until; n++) {
      out.push(item(e, obs, place));
      e = A.NextLocalSolarEclipse(e.peak.time, obs);
    }
    try { Store.set('ecl:v1:' + key, out.map((x) => { const o = Object.assign({}, x); DATES.forEach((k) => { o[k] = x[k] ? +x[k] : null; }); return o; })); } catch (x) { }
    return (memo[key] = out);
  }
  function item(e, obs, place) {
    const d = (x) => (x ? x.time.date : null);
    const it = {
      kind: e.kind, cover: e.obscuration, peak: d(e.peak), begin: d(e.partial_begin), end: d(e.partial_end),
      tBegin: d(e.total_begin), tEnd: d(e.total_end), altPeak: e.peak.altitude,
      altBegin: e.partial_begin.altitude, altEnd: e.partial_end.altitude,
    };
    // the eclipse as a whole: total or annular somewhere else?
    try {
      const g = A.SearchGlobalSolarEclipse(new Date(it.peak.getTime() - 2 * 864e5));
      if (Math.abs(g.peak.date - it.peak) < 864e5) { it.global = g.kind; if (g.latitude != null) it.gmax = { lat: g.latitude, lon: g.longitude }; }
    } catch (x) { }
    it.mag = sky(it.peak, obs).mag;
    return it;
  }

  // ---------------- words ----------------
  const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const dirOf = (az) => DIRS[Math.round(((az % 360) + 360) % 360 / 45) % 8];
  const pct = (f) => (f >= 0.995 && f < 1 ? '99' : Math.round(f * 100)) + '%';
  const KIND = { total: 'Total', annular: 'Annular', partial: 'Partial' };
  function headline(it) {
    if (it.kind === 'total') return 'Total eclipse';
    if (it.kind === 'annular') return 'Annular eclipse · ring of fire';
    return pct(it.cover) + ' of the Sun covered';
  }
  function untilText(t) {
    const days = Math.ceil((t - Date.now()) / 864e5);
    if (t < Date.now()) { const ago = Math.floor((Date.now() - t) / 864e5); return ago < 1 ? 'today' : ago < 60 ? ago + ' days ago' : ago < 730 ? Math.round(ago / 30.4) + ' months ago' : Math.round(ago / 365.25) + ' years ago'; }
    if (days <= 1) return 'today';
    if (days < 60) return 'in ' + days + ' days';
    if (days < 730) return 'in ' + Math.round(days / 30.4) + ' months';
    return 'in ' + (days / 365.25).toFixed(days < 3650 ? 1 : 0).replace('.0', '') + ' years';
  }
  const dur = (a, b) => { const s = Math.round((b - a) / 1000); return Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's'; };
  const longDate = (d) => { const s = Fmt.day(d); return s + ' ' + (Fmt.utcMode() ? d.getUTCFullYear() : d.getFullYear()); };
  function km(a, b) {
    const t = (x) => x * D2R, dLat = t(b.lat - a.lat), dLon = t(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }
  function bearing(a, b) {
    const t = (x) => x * D2R, y = Math.sin(t(b.lon - a.lon)) * Math.cos(t(b.lat));
    const x = Math.cos(t(a.lat)) * Math.sin(t(b.lat)) - Math.sin(t(a.lat)) * Math.cos(t(b.lat)) * Math.cos(t(b.lon - a.lon));
    return (Math.atan2(y, x) / D2R + 360) % 360;
  }
  function elsewhere(it, place) {
    if (!it.global || it.global === it.kind || it.global === 'partial') return '';
    const w = it.global === 'total' ? 'The path of totality' : 'The ring-of-fire path';
    try {
      const g = A.SearchGlobalSolarEclipse(new Date(+it.peak - 2 * 864e5));
      const d = EclPath.describe(g), n = EclPath.nearest(d, place);
      if (!n) return '';
      return `${w} comes within about ${Math.round(n.km / 100) * 100} km, to the ${DIRS[Math.round(n.dir / 45) % 8]}${n.country ? ' in ' + n.country : ''}`;
    } catch (e) { return ''; }
  }


  // ---------------- the picture ----------------
  // The live SDO picture of the Sun, turned the way it stands in your sky, with the Moon in front.
  function picture(g, it, opts) {
    const total = it.kind === 'total' && g.cover >= 0.9999;
    const dark = Math.min(1, Math.max(0, (g.cover - 0.6) / 0.4));
    const imgW = 1 / Data.diskFrac('HMIIF', 'sdo', Sun.geom(new Date()).rsun) / 2; // image half-width in solar radii
    const src = Data.sdoUrl('HMIIF', 1024);
    const horizon = g.alt < 0.6 ? Math.max(-2.4, g.alt / 0.266) : null; // SVG y points down; solar radius ≈ 0.266°
    return `<svg class="eclsvg" viewBox="-2.4 -2.4 4.8 4.8" preserveAspectRatio="xMidYMid meet" style="--sky:${skyColor(g, total)}">
      <defs>
        <clipPath id="eclSun"><circle r="1"/></clipPath>
        <radialGradient id="eclGlow"><stop offset="0.38" stop-color="#ffb35c" stop-opacity="${0.55 * (1 - dark)}"/><stop offset="1" stop-color="#ff8a2b" stop-opacity="0"/></radialGradient>
        <radialGradient id="eclCorona"><stop offset="0.42" stop-color="#fff6e8" stop-opacity=".95"/><stop offset="0.55" stop-color="#e8eefc" stop-opacity=".45"/><stop offset="1" stop-color="#9fb4ff" stop-opacity="0"/></radialGradient>
        <radialGradient id="eclDisk" cx=".45" cy=".42"><stop offset="0" stop-color="#ffd27a"/><stop offset=".75" stop-color="#ff9b3a"/><stop offset="1" stop-color="#d9531e"/></radialGradient>
      </defs>
      <rect x="-2.4" y="-2.4" width="4.8" height="4.8" class="eclsky"/>
      ${total ? coronaRays() : `<circle r="2.2" fill="url(#eclGlow)"/>`}
      <g clip-path="url(#eclSun)">
        <circle r="1" fill="url(#eclDisk)"/>
        <image href="${src}" x="${-imgW}" y="${-imgW}" width="${2 * imgW}" height="${2 * imgW}" transform="rotate(${g.rotDeg.toFixed(2)})" preserveAspectRatio="none" class="eclimg"/>
      </g>
      <circle cx="${g.x.toFixed(4)}" cy="${(-g.y).toFixed(4)}" r="${g.k.toFixed(4)}" class="eclmoon${total ? ' tot' : ''}"/>
      ${horizon != null ? `<rect x="-2.4" y="${horizon.toFixed(3)}" width="4.8" height="${(2.4 - horizon + 0.1).toFixed(3)}" class="eclground"/><text x="2.3" y="${(horizon - 0.08).toFixed(3)}" text-anchor="end" class="ecllbl eclhz">horizon</text>` : ''}
      ${opts && opts.arrow ? `<text x="0" y="-2.12" text-anchor="middle" class="ecllbl">↑ up in the sky</text>` : ''}
    </svg>`;
  }
  function skyColor(g, total) {
    if (total) return '#05070f';
    if (g.alt < 0) return '#0b0d1a';
    const c = g.cover, base = g.alt < 8 ? [56, 72, 108] : [36, 74, 128];
    const k = 1 - Math.max(0, (c - 0.5) / 0.5) * 0.75;
    return `rgb(${base.map((v) => Math.round(v * k + 6)).join(',')})`;
  }
  function coronaRays() {
    let h = '<circle r="2.3" fill="url(#eclCorona)"/>';
    const rays = [[18, 2.2], [70, 1.7], [128, 2.0], [196, 2.3], [250, 1.6], [312, 2.1]];
    for (const [a, l] of rays) h += `<path d="M0,-1 Q0.18,${-(1 + l) / 2} 0,${-l} Q-0.18,${-(1 + l) / 2} 0,-1" fill="#f3f1ff" opacity=".28" transform="rotate(${a})"/>`;
    return h;
  }

  // ---------------- the tab ----------------
  let host = null, sel = null, tSel = null, playT = null, showPast = false;
  const settings = () => ({ place: Store.get('place', null) });
  function stop() { clearInterval(playT); playT = null; }

  function render(h) {
    host = h; stop();
    const place = settings().place;
    if (!place) {
      const p = host.tabShell('eclipse', `<div class="tab-title">Eclipses</div>
        <div class="card eclempty">${placeholderSvg()}<b>Where are you watching from?</b><p class="muted">Set your place and Solar works out every eclipse of the Sun you can see from there — how much of the Sun is covered, when, and what it looks like.</p>
        <button class="btn" data-ecl="place">${ic('gps')} Set your place</button></div>`);
      p.addEventListener('click', (e) => { if (e.target.closest('[data-ecl=place]')) host.setTab('places'); });
      return;
    }
    const all = list(place), now = Date.now();
    const next = all.filter((x) => +x.end > now);
    const past = all.filter((x) => +x.end <= now).reverse();
    if (pendingPeak) { sel = all.find((x) => Math.abs(+x.peak - +pendingPeak) < 3600e3) || sel; pendingPeak = null; }
    const pro = !window.Pro || Pro.on();
    if (!pro) sel = next[0] || past[0]; // free: the next eclipse only
    if (!sel || !all.includes(sel)) sel = next[0] || past[0];
    const it = sel;
    const obs = new A.Observer(place.lat, place.lon, 0);
    if (tSel == null || tSel < +it.begin || tSel > +it.end) tSel = bestTime(it, obs);
    const g = sky(new Date(tSel), obs);
    const isNext = it === next[0];
    const live = now >= +it.begin && now <= +it.end;
    const p = host.tabShell('eclipse', `
      <div class="tab-title">Eclipses</div>
      <button class="eplace" data-ecl="chplace"><span class="epic">${ic('pin')}</span><span class="tx"><small>Seen from</small><b>${esc(place.name)}</b></span><span class="epchg">Change ${ic('right')}</span></button>
      <p class="muted top eptimes">Times ${Fmt.utcMode() ? 'in UTC' : 'on your phone\'s clock'}</p>
      <div class="eclhero">
        <div class="eclwhen"><span class="ecltag ${it.kind}">${live ? 'Happening now' : isNext ? 'Next eclipse' : +it.end < now ? 'Past eclipse' : 'Coming up'}</span><span>${esc(untilText(+it.peak))}</span></div>
        <h1>${esc(headline(it))}</h1>
        <p class="eclsub">${esc(longDate(it.peak))} · greatest at ${esc(Fmt.time(it.peak))}${it.kind === 'total' && it.tBegin ? ' · totality ' + dur(it.tBegin, it.tEnd) : ''}</p>
        <div class="eclpic">${picture(g, it, { arrow: true })}</div>
        ${pro ? `<div class="eclnow"><b id="eclT">${esc(Fmt.time(new Date(tSel)))}</b><span id="eclC">${phase(g, it)}</span></div>
        <div class="eclctl"><button class="icon-btn" data-ecl="play">${ic('play')}</button><input type="range" id="eclR" min="${+it.begin}" max="${+it.end}" step="30000" value="${tSel}"></div>
        <div class="eclticks"><span>${esc(Fmt.time(it.begin))}<small>starts</small></span><span>${esc(Fmt.time(it.peak))}<small>greatest</small></span><span>${esc(Fmt.time(it.end))}<small>ends</small></span></div>` : ''}
        <p class="muted small center">${pro ? 'Drag the Moon across the Sun, or press play. ' : ''}The Moon is placed exactly where it will be from ${esc(place.name)}. The Sun is today's live picture, so the sunspots will differ on the day.</p>
      </div>
      ${!pro ? `<div class="kv"><div><span>How much is covered</span><b>${pct(it.cover)} of the Sun's area${it.kind !== 'total' ? ' · ' + Math.round(it.mag * 100) + '% of its width' : ''}</b></div></div>
      ${Pro.lockCard(next.slice(0, 4).map((x) => row(x, false)).join(''), 'eclipse', 'Watch it play out, minute by minute', 'The Moon crossing the Sun from your place, exact times, world path maps and every eclipse past and future')}
      <button class="card linkcard" data-ecl="safety"><span class="lc-ic">${ic('alert')}</span><span class="tx"><b>Watching safely</b><small>Never look at the Sun without eclipse glasses</small></span>${ic('right')}</button>
      <p class="attrib">Positions: Astronomy Engine (calculated on your phone) · Sun picture: NASA SDO</p>` : `
      <div class="kv">
        <div><span>How much is covered</span><b>${pct(it.cover)} of the Sun's area${it.kind !== 'total' ? ' · ' + Math.round(it.mag * 100) + '% of its width' : ''}</b></div>
        <div><span>Starts</span><b>${esc(Fmt.time(it.begin))} · Sun ${altText(it.altBegin)}</b></div>
        ${it.tBegin ? `<div><span>${it.kind === 'total' ? 'Totality' : 'Ring'}</span><b>${esc(Fmt.time(it.tBegin))} – ${esc(Fmt.time(it.tEnd))} · ${dur(it.tBegin, it.tEnd)}</b></div>` : ''}
        <div><span>Greatest</span><b>${esc(Fmt.time(it.peak))} · Sun ${altText(it.altPeak)}, ${dirOf(sky(it.peak, obs).az)}</b></div>
        <div><span>Ends</span><b>${esc(Fmt.time(it.end))} · Sun ${altText(it.altEnd)}</b></div>
      </div>
      ${elsewhere(it, place) ? `<p class="muted">${esc(elsewhere(it, place))}.</p>` : ''}
      ${it.altBegin < 0 || it.altEnd < 0 ? `<p class="muted">${it.altBegin < 0 ? 'The Sun rises already partly covered.' : 'The Sun sets while still partly covered.'} You need a clear, low view to the ${dirOf(sky(it.altBegin < 0 ? it.begin : it.end, obs).az)}.</p>` : ''}
      ${worldBox(place, all)}
      <div class="sect-row"><div class="sect">${showPast ? 'Past eclipses' : 'Coming up'} from ${esc(place.name)}</div>${host.seg('eclp', showPast ? 'past' : 'next', [['next', 'Next'], ['past', 'Past']])}</div>
      <div class="ecllist">${(showPast ? past : next).slice(0, showPast ? 12 : 20).map((x) => row(x, x === it)).join('') || '<p class="muted">None in this period.</p>'}</div>
      <button class="card linkcard" data-ecl="safety"><span class="lc-ic">${ic('alert')}</span><span class="tx"><b>Watching safely</b><small>Never look at the Sun without eclipse glasses</small></span>${ic('right')}</button>
      <p class="attrib">Positions: Astronomy Engine (calculated on your phone) · Sun picture: NASA SDO</p>`}`);
    wire(p, it, obs);
  }
  // ---------------- around the world ----------------
  const secs = (s) => Math.floor(s / 60) + 'm\u00a0' + String(Math.round(s % 60)).padStart(2, '0') + 's';
  const kmText = (k) => (k < 50 ? 'right where you are' : 'about ' + (k < 1000 ? Math.round(k / 10) * 10 : Math.round(k / 100) * 100).toLocaleString('en-GB') + ' km');
  function worldCard(g, title, place, all) {
    const d = EclPath.describe(g), near = EclPath.nearest(d, place);
    const local = all.find((x) => Math.abs(+x.peak - +g.peak.date) < 864e5);
    const where = d.countries.length ? d.countries.join(', ') : 'Only over the ocean';
    const longest = d.dur ? `${secs(d.dur)} ${d.where ? 'in ' + esc(d.where) : 'over the ocean'}` : '';
    const nearTxt = near ? (near.km < 50 ? 'The path passes over you' : `${kmText(near.km)} to the ${DIRS[Math.round(near.dir / 45) % 8]}${near.country ? ', in ' + esc(near.country) : ''}`) : '';
    return `<div class="card worldcard">
      <div class="wchead"><span class="ecltag ${g.kind}">${g.kind === 'total' ? 'Total' : 'Annular'}</span><span>${esc(longDate(g.peak.date))} · ${esc(untilText(+g.peak.date))}</span></div>
      <b class="wctitle">${esc(title)}</b>
      <div class="wcmap">${EclPath.map(d, place)}</div>
      <div class="kv wckv">
        <div><span>${g.kind === 'total' ? 'Path of totality' : 'Ring of fire path'}</span><b>${esc(where)}</b></div>
        ${longest ? `<div><span>${g.kind === 'total' ? 'Longest totality' : 'Longest ring'}</span><b>${longest} · path up to ${d.width} km wide</b></div>` : ''}
        ${nearTxt ? `<div><span>Closest to you</span><b>${nearTxt}</b></div>` : ''}
        <div><span>From ${esc(place.name)}</span><b>${local ? (local.kind === 'partial' ? pct(local.cover) + ' of the Sun covered' : KIND[local.kind] + '!') : 'Not visible'}</b></div>
      </div>
      ${local ? `<button class="linkbtn" data-wsel="${+local.peak}">See it from ${esc(place.name)} ›</button>` : ''}
    </div>`;
  }
  function worldBox(place, all) {
    let nt, na;
    try { nt = EclPath.upcoming('total', 1)[0]; na = EclPath.upcoming('annular', 1)[0]; } catch (e) { return ''; }
    const now = Date.now(), mine = all.find((x) => x.kind === 'total' && +x.end > now);
    return `<div class="sect-row"><div class="sect">Around the world</div><div class="sect-aside">where the Sun disappears</div></div>
      ${nt ? worldCard(nt, 'Next total eclipse on Earth', place, all) : ''}
      ${na ? worldCard(na, 'Next ring of fire on Earth', place, all) : ''}
      <div class="row static">${ic('pin')}<span class="tx"><span class="t1">Next total eclipse from ${esc(place.name)}</span><span class="t2">${mine ? esc(longDate(mine.peak)) + ' · ' + esc(untilText(+mine.peak)) : 'None before 2061 — you would need to travel to see one'}</span></span>${mine ? `<button class="icon-btn" data-wsel="${+mine.peak}">${ic('right')}</button>` : ''}</div>
      <button class="card linkcard" data-ecl="world"><span class="lc-ic">${ic('globe')}</span><span class="tx"><b>More eclipses around the world</b><small>The next 10 total and annular eclipses, and where to see them</small></span>${ic('right')}</button>`;
  }
  // Switch the place the eclipses are worked out for (the same list as the Places tab).
  function placeSheet() {
    const cur = settings().place, l = host.placesList();
    const same = (p) => cur && Math.abs(p.lat - cur.lat) < 0.03 && Math.abs(p.lon - cur.lon) < 0.03 && p.name === cur.name;
    host.openSheet(`<div class="stitle">${ic('pin')} Watch from</div>
      <div class="eplist">${l.map((p, i) => { const n = Eclipse.next(p);
        return `<button class="row${same(p) ? ' on' : ''}" data-pi="${i}">${p.gps ? ic('gps') : ic('pin')}<span class="tx"><span class="t1">${esc(p.name)}</span><span class="t2">${n ? 'Next: ' + esc(longDate(n.peak)) + ' · ' + (n.kind === 'partial' ? pct(n.cover) : KIND[n.kind]) : ''}</span></span>${same(p) ? `<span class="ck on">${ic('check')}</span>` : ''}</button>`; }).join('')}</div>
      <div class="pacts"><button class="btn" data-pa2="gps">${ic('gps')} My location</button><button class="btn ghost" data-pa2="add">${ic('plus')} Add a place</button></div>
      <button class="card linkcard" data-pa2="manage"><span class="lc-ic">${ic('pin')}</span><span class="tx"><b>Manage places</b><small>Local time, Sun and aurora at each place · remove places</small></span>${ic('right')}</button>`, (sh) => {
      sh.addEventListener('click', (e) => {
        const r = e.target.closest('[data-pi]');
        if (r) { const p = l[+r.dataset.pi]; host.closeSheet(); if (!same(p)) { sel = null; tSel = null; host.setPlace(p); } return; }
        const b = e.target.closest('[data-pa2]');
        if (b) { host.closeSheet(); if (b.dataset.pa2 === 'manage') { host.setTab('places'); return; } sel = null; tSel = null; if (b.dataset.pa2 === 'gps') host.locate(); else setTimeout(() => host.searchSheet(), 300); }
      });
    });
  }
  function worldSheet(place) {
    const out = [];
    let g = A.SearchGlobalSolarEclipse(new Date());
    for (let i = 0; i < 40 && out.length < 10; i++) { if (g.kind !== 'partial') out.push(g); g = A.NextGlobalSolarEclipse(g.peak); }
    host.openSheet(`<div class="stitle">${ic('globe')} Eclipses around the world</div>
      <p class="lead">Where the Sun is completely covered (total) or turns into a ring of fire (annular). Everywhere else nearby sees a partial eclipse.</p>
      ${out.map((x) => { const d = EclPath.describe(x), near = EclPath.nearest(d, place);
        return `<div class="wrow"><div class="wrmap">${EclPath.map(d, place)}</div><div class="tx"><b>${esc(longDate(x.peak.date))} · ${x.kind === 'total' ? 'Total' : 'Annular'}</b>
          <small>${esc(d.countries.length ? d.countries.join(', ') : 'Only over the ocean')}${d.dur ? ' · up to ' + secs(d.dur) : ''}${near ? ' · ' + kmText(near.km) + ' from you' : ''}</small></div></div>`; }).join('')}
      <p class="muted small">Paths calculated on your phone from the Sun and Moon positions. Country outlines: Natural Earth.</p>`);
  }

  // The moment with the most of the Sun covered while it is still above your horizon.
  function bestTime(it, obs) {
    if (it.altPeak > 0.5) return +it.peak;
    let best = +it.peak, bc = -1;
    for (let k = 0; k <= 120; k++) {
      const t = +it.begin + (+it.end - +it.begin) * k / 120, g = sky(new Date(t), obs);
      if (g.alt > 0.15 && g.cover > bc) { bc = g.cover; best = t; }
    }
    return best;
  }
  function altText(a) { return a < -0.5 ? 'below the horizon' : a < 1 ? 'on the horizon' : Math.round(a) + '° up'; }
  function phase(g, it) {
    if (g.alt < -0.8) return 'Sun below the horizon';
    if (g.cover < 0.005) return (g.t != null ? +g.t : tSel) > +it.peak ? 'Eclipse over' : 'Not started';
    if (it.kind === 'total' && g.cover >= 0.9999) return 'Totality — the corona appears';
    if (it.kind === 'annular' && g.sep + g.k <= 1) return 'Ring of fire';
    return pct(g.cover) + ' covered';
  }
  function row(x, on) {
    const cx = x.kind === 'partial' ? (2.02 - 2 * x.mag).toFixed(2) : 0;
    const icon = `<svg viewBox="-1.3 -1.3 2.6 2.6" class="eclmini">${x.kind === 'total' ? '<circle r="1.25" fill="#dfe6ff" opacity=".35"/>' : ''}<circle r="1" fill="#ffb347"/><circle cx="${cx}" cy="0" r="${x.kind === 'annular' ? 0.86 : 1.02}" fill="#0b1424"/></svg>`;
    return `<button class="row eclrow${on ? ' on' : ''}" data-eid="${+x.peak}">${icon}<span class="tx"><span class="t1">${esc(longDate(x.peak))} · ${x.kind === 'partial' ? pct(x.cover) : KIND[x.kind]}</span><span class="t2">${esc(untilText(+x.peak))} · ${esc(Fmt.time(x.peak))} · Sun ${altText(x.altPeak)}${x.global && x.global !== x.kind && x.global !== 'partial' ? ' · ' + KIND[x.global].toLowerCase() + ' elsewhere' : ''}</span></span>${x.kind !== 'partial' ? `<span class="ecltag ${x.kind}">${KIND[x.kind]}</span>` : ''}</button>`;
  }
  function wire(p, it, obs) {
    const r = $('#eclR', p), pic = $('.eclpic', p), lt = $('#eclT', p), lc = $('#eclC', p), pb = $('[data-ecl=play]', p);
    let shape = '';
    if (r) {
    const draw = (t) => {
      tSel = t; const g = sky(new Date(t), obs);
      const total = it.kind === 'total' && g.cover >= 0.9999, horizon = g.alt < 0.6;
      const key = total + '|' + horizon;
      const svg = pic.querySelector('svg');
      if (!svg || key !== shape) { pic.innerHTML = picture(g, it, { arrow: true }); shape = key; }
      else {
        // move the Moon and turn the Sun in place: the Sun picture stays loaded
        const m = svg.querySelector('.eclmoon'); m.setAttribute('cx', g.x.toFixed(4)); m.setAttribute('cy', (-g.y).toFixed(4)); m.setAttribute('r', g.k.toFixed(4));
        const im = svg.querySelector('.eclimg'); if (im) im.setAttribute('transform', 'rotate(' + g.rotDeg.toFixed(2) + ')');
        svg.style.setProperty('--sky', skyColor(g, total));
        if (horizon) {
          const hz = Math.max(-2.4, g.alt / 0.266), gr = svg.querySelector('.eclground'), tx = svg.querySelector('.eclhz');
          if (gr) { gr.setAttribute('y', hz.toFixed(3)); gr.setAttribute('height', (2.4 - hz + 0.1).toFixed(3)); }
          if (tx) tx.setAttribute('y', (hz - 0.08).toFixed(3));
        }
        const st = svg.querySelector('#eclGlow stop'); if (st) st.setAttribute('stop-opacity', (0.55 * (1 - Math.min(1, Math.max(0, (g.cover - 0.6) / 0.4)))).toFixed(3));
      }
      lt.textContent = Fmt.time(new Date(t)); lc.textContent = phase(g, it);
    };
    { const g0 = sky(new Date(tSel), obs); shape = (it.kind === 'total' && g0.cover >= 0.9999) + '|' + (g0.alt < 0.6); }
    r.addEventListener('input', () => { stop(); pb.innerHTML = ic('play'); draw(+r.value); });
    // grab the Moon and drag it back and forth along its real path: the time follows the Moon
    let path = null, dr = null;
    const track = () => {
      if (path) return path;
      const t0 = +it.begin, t1 = +it.end, N = 240; path = [];
      for (let i = 0; i <= N; i++) { const t = t0 + (t1 - t0) * i / N, g = sky(new Date(t), obs); path.push({ t, x: g.x, y: -g.y }); }
      return path;
    };
    const toSvg = (e) => {
      const b = pic.getBoundingClientRect(), sc = 4.8 / Math.min(b.width, b.height || b.width);
      return { x: (e.clientX - b.left - b.width / 2) * sc, y: (e.clientY - b.top - b.height / 2) * sc };
    };
    const moonPos = () => { const m = pic.querySelector('.eclmoon'); return m ? { x: +m.getAttribute('cx'), y: +m.getAttribute('cy'), r: +m.getAttribute('r') } : null; };
    const timeAt = (q) => { // nearest point on the Moon's track, refined between samples
      const P = track(); let bi = 0, bd = 1e9;
      for (let i = 0; i < P.length; i++) { const d = (P[i].x - q.x) ** 2 + (P[i].y - q.y) ** 2; if (d < bd) { bd = d; bi = i; } }
      let best = P[bi].t, bestD = bd;
      for (const j of [bi - 1, bi + 1]) {
        if (j < 0 || j >= P.length) continue;
        const A = P[Math.min(bi, j)], B = P[Math.max(bi, j)], vx = B.x - A.x, vy = B.y - A.y, L = vx * vx + vy * vy || 1e-12;
        const u = Math.max(0, Math.min(1, ((q.x - A.x) * vx + (q.y - A.y) * vy) / L)), px = A.x + vx * u - q.x, py = A.y + vy * u - q.y, d = px * px + py * py;
        if (d < bestD) { bestD = d; best = A.t + (B.t - A.t) * u; }
      }
      return best;
    };
    pic.addEventListener('pointerdown', (e) => {
      const q = toSvg(e), m = moonPos();
      const onMoon = !!m && Math.hypot(q.x - m.x, q.y - m.y) < m.r + 0.35;
      dr = { x: e.clientX, y: e.clientY, on: false, onMoon, id: e.pointerId, ox: m ? m.x - q.x : 0, oy: m ? m.y - q.y : 0 };
    });
    pic.addEventListener('pointermove', (e) => {
      if (!dr) return;
      const dx = e.clientX - dr.x, dy = e.clientY - dr.y;
      if (!dr.on) {
        const go = dr.onMoon ? Math.hypot(dx, dy) > 4 : Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy);
        if (!go) return;
        dr.on = true; stop(); pb.innerHTML = ic('play'); pic.classList.add('scrub'); track(); try { pic.setPointerCapture(dr.id); } catch (er) { }
      }
      e.preventDefault();
      const q = toSvg(e), v = Math.max(+it.begin, Math.min(+it.end, timeAt({ x: q.x + dr.ox, y: q.y + dr.oy })));
      r.value = v; draw(v);
    });
    const endDrag = () => { dr = null; pic.classList.remove('scrub'); };
    pic.addEventListener('pointerup', endDrag); pic.addEventListener('pointercancel', endDrag);
    pb.addEventListener('click', () => {
      if (playT) { stop(); pb.innerHTML = ic('play'); return; }
      pb.innerHTML = ic('pause');
      if (+r.value >= +it.end) r.value = +it.begin;
      const step = (+it.end - +it.begin) / 90;
      let hold = 0;
      playT = setInterval(() => {
        if (!p.isConnected) { stop(); return; }
        // loop: hold the end for a moment (about a second), then start again from the beginning
        if (hold > 0) { hold--; if (hold === 0) { r.value = +it.begin; draw(+it.begin); } return; }
        let v = +r.value + step;
        if (v >= +it.end) { v = +it.end; hold = 14; }
        r.value = v; draw(v);
      }, 70);
    });
    }
    p.addEventListener('click', (e) => {
      const s = e.target.closest('[data-seg] button');
      if (s) { showPast = s.dataset.v === 'past'; render(host); return; }
      const b = e.target.closest('[data-eid]');
      if (b) { const pl = settings().place; sel = list(pl).find((x) => String(+x.peak) === b.dataset.eid); tSel = null; render(host); const tv = $('.tabview'); if (tv) tv.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      const ws = e.target.closest('[data-wsel]');
      if (ws) { const pl = settings().place; sel = list(pl).find((x) => String(+x.peak) === ws.dataset.wsel) || sel; tSel = null; render(host); const tv = $('.tabview'); if (tv) tv.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      const a = e.target.closest('[data-ecl]');
      if (a && a.dataset.ecl === 'safety') safety();
      if (a && a.dataset.ecl === 'world') worldSheet(settings().place);
      if (a && a.dataset.ecl === 'chplace') placeSheet();
    });
  }
  function safety() {
    host.openSheet(`<div class="stitle">${ic('alert')} Watching an eclipse safely</div>
      <p class="lead">Even when 99% of the Sun is covered, the thin crescent left is bright enough to burn your retina — and it doesn't hurt while it happens.</p>
      <div class="kv">
        <div><span>Eclipse glasses</span><b>ISO 12312-2 certified, from a known seller. Check them for scratches.</b></div>
        <div><span>Pinhole</span><b>A hole in card, or the gaps between your fingers or tree leaves, project little crescents onto the ground.</b></div>
        <div><span>Camera, binoculars</span><b>Only with a proper solar filter on the front — never glasses behind them.</b></div>
        <div><span>Sunglasses</span><b>Not safe, not even several pairs.</b></div>
        <div><span>Totality</span><b>Only during totality (the Sun completely covered) may you look without glasses. Put them back on the moment the first bright point returns.</b></div>
      </div>`);
  }
  function placeholderSvg() {
    return '<svg viewBox="-2 -1.3 4 2.6" class="eclph"><circle r="1" fill="#ffb347"/><circle cx="0.45" cy="-0.2" r="1.02" fill="#0b1424"/></svg>';
  }
  function reset() { sel = null; tSel = null; stop(); }

  const nextMemo = {};
  function next(place) {
    const key = place.lat.toFixed(2) + ',' + place.lon.toFixed(2);
    const hit = nextMemo[key];
    if (hit && (!hit.end || +hit.end > Date.now())) return hit;
    try {
      const obs = new A.Observer(place.lat, place.lon, 0);
      const e = A.SearchLocalSolarEclipse(new Date(Date.now() - 6 * 3600e3), obs);
      return (nextMemo[key] = { kind: e.kind, cover: e.obscuration, peak: e.peak.time.date, end: e.partial_end.time.date });
    } catch (x) { return null; }
  }
  function select(peak) { sel = null; tSel = null; pendingPeak = peak; }
  let pendingPeak = null;
  // the History button on this tab: show past eclipses and scroll to them
  function showHistory() {
    if (window.Pro && !Pro.on()) { Pro.paywall('eclipse'); return; }
    showPast = true; render(host);
    setTimeout(() => { const el = document.querySelector('.tabview .ecllist'); if (el && el.previousElementSibling) el.previousElementSibling.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
  }
  window.Eclipse = { render, reset, sky, list, overlap, next, select, showHistory };
})();
