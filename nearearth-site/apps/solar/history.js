/* Solar — History: every day since 1818 (sunspot number), the Sun's picture since 1996 and its numbered groups */
(function () {
  'use strict';
  const { Store, Fmt, esc, $, $$ } = U;
  const BASE = Date.UTC(1818, 0, 1), DAY = 864e5;
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const URL_SN = 'https://www.sidc.be/SILSO/DATA/SN_d_tot_V2.0.csv';
  const URL_EISN = 'https://www.sidc.be/SILSO/DATA/EISN/EISN_current.csv';

  // ---------------- daily sunspot numbers ----------------
  let SN = null, snErr = null, snLoading = null;
  const idx = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - BASE) / DAY);
  const dateOf = (i) => new Date(BASE + i * DAY);
  const todayIdx = () => Math.floor((Date.now() - BASE) / DAY);
  // Today SILSO has no value yet; NOAA's live region report gives the same Wolf formula: 10 × groups + spots.
  function liveToday() {
    const r = window.App && App.S && App.S.regions;
    if (!r || !r.list) return -1;
    return 10 * r.list.length + r.list.reduce((a, g) => a + (g.spots || 0), 0);
  }
  const val = (i) => { const v = SN && i >= 0 && i < SN.v.length ? SN.v[i] : -1; return v < 0 && i === todayIdx() ? liveToday() : v; };

  function parseRows(text, sep) {
    const out = [];
    for (const line of text.split('\n')) {
      const p = line.split(sep).map((x) => x.trim());
      if (p.length < 5 || !/^\d{4}$/.test(p[0])) continue;
      const y = +p[0], m = +p[1], d = +p[2], v = +p[4];
      if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31) || !isFinite(v)) continue;
      out.push([idx(y, m, d), Math.round(v), p.length > 7 ? p[7] !== '1' : true]);
    }
    return out;
  }
  function build(rows, eisn) {
    const n = todayIdx() + 1, v = new Int16Array(n).fill(-1), prov = new Uint8Array(n);
    let lastDef = -1;
    for (const [i, x, pr] of rows) if (i >= 0 && i < n) { v[i] = x; prov[i] = pr ? 1 : 0; if (x >= 0) lastDef = Math.max(lastDef, i); }
    for (const [i, x] of eisn) if (i > lastDef && i >= 0 && i < n && x >= 0) { v[i] = x; prov[i] = 2; }
    let last = -1; for (let i = n - 1; i >= 0; i--) if (v[i] >= 0) { last = i; break; }
    return { v, prov, last };
  }
  async function loadSN(force) {
    if (SN && !force) return SN;
    if (snLoading) return snLoading;
    snLoading = (async () => {
      let main = Store.get('sn:v2', null), eisn = Store.get('sn:eisn', null);
      const age = (c, h) => !c || Date.now() - c.t > h * 3600e3;
      const tasks = [];
      if (force || age(main, 24 * 7)) tasks.push(U.http(URL_SN, 60000).then((t) => {
        const rows = parseRows(t, ';');
        if (rows.length < 1000) throw new Error('Unexpected SILSO format');
        // store compactly: first day index + comma list; provisional flags as a run marker
        const first = rows[0][0], arr = [], provFrom = rows.findIndex((r) => r[2]);
        for (const r of rows) arr[r[0] - first] = r[1];
        main = { t: Date.now(), first, s: arr.map((x) => (x == null ? -1 : x)).join(','), provFrom: provFrom >= 0 ? rows[provFrom][0] : -1 };
        try { Store.set('sn:v2', main); } catch (e) { }
      }).catch((e) => { if (!main) throw e; }));
      if (force || age(eisn, 6)) tasks.push(U.http(URL_EISN, 30000).then((t) => {
        eisn = { t: Date.now(), rows: parseRows(t, ',').map((r) => [r[0], r[1]]) };
        Store.set('sn:eisn', eisn);
      }).catch(() => { }));
      await Promise.all(tasks);
      const rows = main.s.split(',').map((x, k) => [main.first + k, +x, main.provFrom >= 0 && main.first + k >= main.provFrom]);
      SN = build(rows, eisn ? eisn.rows : []);
      SN.loadedAt = main.t; snErr = null;
      aggregates();
      return SN;
    })();
    try { return await snLoading; } catch (e) { snErr = e.message; throw e; } finally { snLoading = null; }
  }

  // yearly / monthly aggregates
  let YEARS = null;
  function stats(a, b) { // inclusive day range
    let sum = 0, n = 0, zero = 0, max = -1, maxI = -1;
    for (let i = a; i <= b; i++) { const x = val(i); if (x < 0) continue; sum += x; n++; if (x === 0) zero++; if (x > max) { max = x; maxI = i; } }
    return { mean: n ? sum / n : null, n, zero, max, maxI };
  }
  function aggregates() {
    YEARS = [];
    const ly = new Date().getUTCFullYear();
    for (let y = 1818; y <= ly; y++) {
      const s = stats(idx(y, 1, 1), Math.min(idx(y, 12, 31), SN.v.length - 1));
      if (s.n) YEARS.push({ y, ...s });
    }
  }
  const monthStats = (y, m) => stats(idx(y, m, 1), Math.min(idx(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate()), SN.v.length - 1));

  // colour scale for sunspot numbers
  const STOPS = [[1, [92, 74, 30]], [25, [140, 104, 30]], [60, [201, 138, 30]], [110, [236, 122, 28]], [170, [240, 90, 40]], [230, [224, 49, 63]], [320, [170, 22, 80]]];
  function snColor(x, alpha) {
    if (x == null || x < 0) return 'transparent';
    if (x === 0) return 'rgba(60,72,94,' + (alpha == null ? 1 : alpha) + ')';
    let c = STOPS[STOPS.length - 1][1];
    for (let k = 0; k < STOPS.length - 1; k++) {
      const [a, ca] = STOPS[k], [b, cb] = STOPS[k + 1];
      if (x <= a) { c = ca; break; }
      if (x <= b) { const f = (x - a) / (b - a); c = ca.map((q, j) => Math.round(q + (cb[j] - q) * f)); break; }
    }
    return 'rgba(' + c.join(',') + ',' + (alpha == null ? 1 : alpha) + ')';
  }

  // ---------------- pictures (Helioviewer) ----------------
  const D_HMI = Date.UTC(2010, 4, 1), D_AIA = Date.UTC(2010, 4, 13), D_MDI = Date.UTC(1996, 4, 1), D_MDI_END = Date.UTC(2011, 3, 12), D_EIT = Date.UTC(1996, 0, 15);
  const VIEWS = [
    { id: 'spots', name: 'Sunspots', layer: (t) => (t >= D_HMI ? '[SDO,HMI,HMI,continuum,1,100]' : t >= D_MDI && t < D_MDI_END ? '[SOHO,MDI,MDI,continuum,1,100]' : null), tint: '#f5b25c' },
    { id: 'mag', name: 'Magnetic', layer: (t) => (t >= D_HMI ? '[SDO,HMI,HMI,magnetogram,1,100]' : t >= D_MDI && t < D_MDI_END ? '[SOHO,MDI,MDI,magnetogram,1,100]' : null), tint: '#888' },
    { id: '304', name: '304 Å', layer: (t) => (t >= D_AIA ? '[SDO,AIA,AIA,304,1,100]' : t >= D_EIT ? '[SOHO,EIT,EIT,304,1,100]' : null), tint: '#ff7a3d' },
    { id: '171', name: '171 Å', layer: (t) => (t >= D_AIA ? '[SDO,AIA,AIA,171,1,100]' : t >= D_EIT ? '[SOHO,EIT,EIT,171,1,100]' : null), tint: '#e9c25a' },
  ];
  function instrument(view, t) {
    const l = view.layer(t); if (!l) return '';
    const p = l.slice(1, -1).split(',');
    return p[0] + ' ' + p[1] + (p[3] === 'continuum' ? ' · visible light' : p[3] === 'magnetogram' ? ' · magnetogram' : ' · ' + p[3] + ' Å');
  }
  function imgTime(i) { const t = BASE + i * DAY + 12 * 3600e3; return Math.min(t, Date.now() - 2 * 3600e3); }
  function hvShot(layer, t, px, field, x0, y0, h) {
    return 'https://api.helioviewer.org/v2/takeScreenshot/?date=' + new Date(t).toISOString().replace(/\.\d+Z$/, 'Z') +
      '&imageScale=' + (field / px).toFixed(4) + '&layers=' + layer + '&x0=' + (x0 || 0).toFixed(1) + '&y0=' + (y0 || 0).toFixed(1) +
      '&width=' + px + '&height=' + (h || px) + '&display=true&watermark=false';
  }

  // ---------------- regions on a past day (HEK, NOAA SWPC Observer entries) ----------------
  const hekMem = {};
  async function regionsOn(i) {
    const d = dateOf(i).toISOString().slice(0, 10);
    if (hekMem[d]) return hekMem[d];
    const c = Store.get('hek:' + d, null);
    if (c && (i < todayIdx() - 2 || Date.now() - c.t < 3 * 3600e3)) return (hekMem[d] = c.r);
    const q = 'https://www.lmsal.com/hek/her?cosec=2&cmd=search&type=column&event_type=ar' +
      '&event_starttime=' + d + 'T00:00:00&event_endtime=' + d + 'T23:59:59&event_coordsys=helioprojective&x1=-1200&x2=1200&y1=-1200&y2=1200' +
      '&param0=frm_name&op0=%3D&value0=' + encodeURIComponent('NOAA SWPC Observer') + '&result_limit=200';
    const j = await U.getJSON(q);
    const seen = new Set(), out = [];
    for (const o0 of (j.result || j.Result || [])) {
      const o = {}; for (const k in o0) o[k.toLowerCase()] = o0[k];
      let n = U.num(o.ar_noaanum); if (!n) continue;
      if (n < 10000) n += 10000;
      if (seen.has(n)) continue; seen.add(n);
      const lat = U.num(o.hgs_y), lon = U.num(o.hgs_x);
      out.push({
        region: n, lat, lon, hx: U.num(o.hpc_x), hy: U.num(o.hpc_y), t: o.event_starttime,
        spots: U.num(o.ar_numspots), cls: o.ar_mcintoshcls || null, mag: o.ar_mtwilsoncls || null,
        loc: lat == null || lon == null ? '' : (lat < 0 ? 'S' : 'N') + String(Math.abs(Math.round(lat))).padStart(2, '0') + (lon < 0 ? 'E' : 'W') + String(Math.abs(Math.round(lon))).padStart(2, '0'),
      });
    }
    out.sort((a, b) => (b.spots || 0) - (a.spots || 0));
    hekMem[d] = out;
    try { Store.set('hek:' + d, { t: Date.now(), r: out }); } catch (e) { }
    return out;
  }
  async function flaresOn(i) {
    const d = dateOf(i).toISOString().slice(0, 10);
    const r = await U.cached('flr:' + d, Data.DONKI + 'FLR?startDate=' + d + '&endDate=' + d, i < todayIdx() - 2 ? 1e7 : 60);
    return (Array.isArray(r.data) ? r.data : []).map((f) => ({ cls: f.classType, peak: U.utc(f.peakTime || f.beginTime), loc: f.sourceLocation, ar: f.activeRegionNum }))
      .filter((f) => f.peak && dateOf(i).toISOString().slice(0, 10) === f.peak.toISOString().slice(0, 10)).sort((a, b) => a.peak - b.peak);
  }

  // ---------------- view state ----------------
  const now = new Date();
  // Always open on the current month: a fresh start (or coming back after a while) shows today.
  const thisMonth = () => { const d = new Date(); return { k: 'month', y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }; };
  let lvl = thisMonth();
  function reset() { lvl = thisMonth(); }
  let calMode = Store.get('h:cal', 'number'), dayView = Store.get('h:view', 'spots');
  let host = null;
  function go(l) { lvl = l; render(host); const tv = document.querySelector('.tabview'); if (tv) tv.scrollTop = 0; }
  function back() {
    if (lvl.k === 'day') { go({ k: 'month', y: lvl.y, m: lvl.m }); return true; }
    if (lvl.k === 'month') { go({ k: 'year', y: lvl.y }); return true; }
    if (lvl.k === 'year') { go({ k: 'all' }); return true; }
    return false;
  }

  function trail() {
    const parts = [['All years', { k: 'all' }]];
    if (lvl.y) parts.push([String(lvl.y), { k: 'year', y: lvl.y }]);
    if (lvl.m) parts.push([MON[lvl.m - 1], { k: 'month', y: lvl.y, m: lvl.m }]);
    if (lvl.d) parts.push([String(lvl.d), lvl]);
    return '<div class="trail">' + parts.map(([t, l], k) => k === parts.length - 1 ? `<b>${t}</b>` : `<button data-go='${JSON.stringify(l)}'>${t}</button><i>›</i>`).join('') + '</div>';
  }
  const fmtSN = (x) => (x == null || x < 0 ? '–' : Math.round(x));
  const dshort = (i) => { const d = dateOf(i); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()].slice(0, 3) + ' ' + d.getUTCFullYear(); };

  function shell(inner, opt) {
    const nav = opt && opt.nav ? `<div class="hnav"><button class="icon-btn" data-nav="-1">${ic('back')}</button><div class="htitle">${opt.title}</div><button class="icon-btn flip" data-nav="1">${ic('back')}</button></div>` : `<div class="htitle solo">${opt.title}</div>`;
    return `<div class="h-titlebar"><div class="set-titlebar"><button class="icon-btn" data-gback aria-label="Back">${ic('back')}</button><div class="tab-title">History</div></div><button class="icon-btn" data-h="jump" aria-label="Go to date">${ic('calendar')}</button></div>${trail()}${nav}${inner}<p class="attrib">Sunspot numbers: SILSO, Royal Observatory of Belgium · Pictures: Helioviewer (SDO, SOHO) · Groups: NOAA via HEK · Flares: NASA DONKI</p>`;
  }

  // ---------------- render ----------------
  function render(h) {
    host = h;
    if (!SN) {
      const p = host.tabShell('history', shell(snErr ? `<p class="muted">Couldn't load the sunspot record (${esc(snErr)}). <button class="btn small ghost" data-h="retry">Try again</button></p>` : '<div class="skel" style="height:300px"></div>', { title: 'Loading the record…' }));
      wire(p);
      if (!snErr) loadSN().then(() => host.rerender()).catch(() => host.rerender());
      return;
    }
    let p;
    if (lvl.k === 'all') p = renderAll();
    else if (lvl.k === 'year') p = renderYear();
    else if (lvl.k === 'month') p = renderMonth();
    else p = renderDay();
    if (!freeOk(lvl)) lockPage(p);
    wire(p);
  }

  // ---------------- free version: the last 7 days ----------------
  const FREE_DAYS = 7;
  const freeFrom = () => todayIdx() - (FREE_DAYS - 1);
  function freeOk(l) {
    if (!window.Pro || Pro.on()) return true;
    if (l.k === 'day') return idx(l.y, l.m, l.d) >= freeFrom();
    if (l.k === 'month') { const last = idx(l.y, l.m, new Date(Date.UTC(l.y, l.m, 0)).getUTCDate()); return last >= freeFrom(); }
    return false;
  }
  // Show the real page blurred behind a card, so it's clear what Pro opens up.
  function lockPage(p) {
    p.classList.add('hlocked');
    const what = lvl.k === 'all' ? 'Every year since 1818' : lvl.k === 'year' ? 'The whole of ' + lvl.y : lvl.k === 'month' ? MON[lvl.m - 1] + ' ' + lvl.y : lvl.d + ' ' + MON[lvl.m - 1] + ' ' + lvl.y;
    const card = document.createElement('div');
    card.className = 'hlock';
    card.innerHTML = `<span class="propill">${ic('lock')}Solar Pro</span><b>${esc(what)}</b>
      <p>The free version shows the last ${FREE_DAYS} days. Solar Pro opens the full record: every day since 1818 and the Sun's picture for every day since 1996.</p>
      <button class="btn" data-pro="history">${ic('star')} See Solar Pro</button>
      <button class="btn ghost" data-go='${JSON.stringify(thisMonth())}'>Back to this week</button>`;
    const anchor = p.querySelector('.hnav, .htitle.solo');
    if (anchor) anchor.after(card); else p.prepend(card);
  }

  function wire(p) {
    p.addEventListener('click', (e) => {
      const g = e.target.closest('[data-go]'); if (g) { go(JSON.parse(g.dataset.go)); return; }
      const n = e.target.closest('[data-nav]'); if (n) { step(+n.dataset.nav); return; }
      const a = e.target.closest('[data-h]'); if (!a) return;
      if (a.dataset.h === 'jump') jumpSheet();
      if (a.dataset.h === 'pm') monthPicker();
      if (a.dataset.h === 'py') yearPicker();
      if (a.dataset.h === 'retry') { snErr = null; render(host); }
    });
  }
  // Tappable month and year in the title
  const pickM = (m, short) => `<button class="tpick" data-h="pm">${short ? MON[m - 1].slice(0, 3) : MON[m - 1]}<i></i></button>`;
  const pickY = (y) => `<button class="tpick" data-h="py">${y}<i></i></button>`;
  // keep the current level when changing month/year; clamp the day to the month and to today
  function jumpTo(y, m) {
    const t = new Date();
    if (y > t.getUTCFullYear() || (y === t.getUTCFullYear() && m > t.getUTCMonth() + 1)) m = t.getUTCMonth() + 1;
    if (lvl.k === 'year') { go({ k: 'year', y }); return; }
    if (lvl.k === 'day') {
      let d = Math.min(lvl.d, new Date(Date.UTC(y, m, 0)).getUTCDate());
      if (idx(y, m, d) > todayIdx()) d = t.getUTCDate();
      go({ k: 'day', y, m, d }); return;
    }
    go({ k: 'month', y, m });
  }
  function monthPicker() {
    const y = lvl.y, t = new Date();
    host.openSheet(`<div class="stitle">${y}</div><div class="pickgrid m">${MON.map((n, k) => {
      const fut = y === t.getUTCFullYear() && k > t.getUTCMonth(), st = fut ? null : monthStats(y, k + 1);
      return `<button data-pm="${k + 1}" class="${k + 1 === lvl.m ? 'on' : ''}" ${fut ? 'disabled' : ''} style="--pc:${st ? snColor(st.mean, 0.55) : 'transparent'}"><b>${n.slice(0, 3)}</b><small>${st && st.mean != null ? Math.round(st.mean) : ''}</small></button>`;
    }).join('')}</div>`, (sh) => sh.addEventListener('click', (e) => { const b = e.target.closest('[data-pm]'); if (b) { host.closeSheet(); jumpTo(lvl.y, +b.dataset.pm); } }));
  }
  function yearPicker() {
    const ys = YEARS.slice().reverse();
    host.openSheet(`<div class="stitle">Choose a year</div><p class="muted small">Coloured by the year's average sunspot number.</p><div class="pickgrid y">${ys.map((q) =>
      `<button data-py="${q.y}" class="${q.y === lvl.y ? 'on' : ''}${q.y % 10 === 0 ? ' dec' : ''}" style="--pc:${snColor(q.mean, 0.55)}">${q.y}</button>`).join('')}</div>`, (sh) => {
      const on = sh.querySelector('.pickgrid .on'); if (on) sh.scrollTop = Math.max(0, on.offsetTop - sh.clientHeight / 2);
      sh.addEventListener('click', (e) => { const b = e.target.closest('[data-py]'); if (b) { host.closeSheet(); jumpTo(+b.dataset.py, lvl.m || 1); } });
    });
  }
  function step(dir) {
    if (lvl.k === 'year') { const y = lvl.y + dir; if (y >= 1818 && y <= now.getUTCFullYear()) go({ k: 'year', y }); return; }
    if (lvl.k === 'month') {
      let y = lvl.y, m = lvl.m + dir; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
      if (Date.UTC(y, m - 1, 1) <= Date.now() && y >= 1818) go({ k: 'month', y, m }); return;
    }
    if (lvl.k === 'day') {
      const i = idx(lvl.y, lvl.m, lvl.d) + dir; if (i < 0 || i > todayIdx()) return;
      const d = dateOf(i); go({ k: 'day', y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() });
    }
  }
  function jumpSheet() {
    const cur = lvl.d ? dateOf(idx(lvl.y, lvl.m, lvl.d)) : lvl.m ? new Date(Date.UTC(lvl.y, lvl.m - 1, 1)) : new Date();
    host.openSheet(`<div class="stitle">Go to a date</div><p class="lead">Sunspot numbers go back to 1 January 1818. Pictures of the Sun start in 1996.</p>
      <input type="date" id="jd" class="dinput" min="1818-01-01" max="${new Date().toISOString().slice(0, 10)}" value="${cur.toISOString().slice(0, 10)}">
      <div class="pacts"><button class="btn" data-j="go">Show day</button><button class="btn ghost" data-j="today">Today</button></div>
      <div class="sect">Famous days</div>
      <div class="famous">${[['1859-09-01', 'Carrington Event'], ['1989-03-13', 'Québec blackout storm'], ['2003-10-28', 'Halloween storms'], ['2017-09-06', 'X9.3 flare'], ['2024-05-10', 'Gannon storm (May 2024 aurora)'], ['2024-10-03', 'X9.0 flare']]
        .map(([d, t]) => `<button class="row" data-fd="${d}"><span class="tx"><span class="t1">${t}</span><span class="t2">${d}</span></span>${ic('right')}</button>`).join('')}</div>`, (s) => {
      s.addEventListener('click', (e) => {
        const b = e.target.closest('[data-j],[data-fd]'); if (!b) return;
        let v = b.dataset.fd || (b.dataset.j === 'today' ? new Date().toISOString().slice(0, 10) : $('#jd', s).value);
        const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(v || ''); if (!m) return;
        host.closeSheet(); go({ k: 'day', y: +m[1], m: +m[2], d: +m[3] });
      });
    });
  }

  // ----- all years -----
  function renderAll() {
    const ys = YEARS, ly = ys[ys.length - 1];
    const by = (f) => ys.filter((y) => y.n > 300 || y === ly).reduce((a, b) => (f(b) > f(a) ? b : a));
    const top = by((y) => y.mean), low = by((y) => -y.mean), spotless = by((y) => y.zero);
    let maxDay = -1, maxI = -1; for (const y of ys) if (y.max > maxDay) { maxDay = y.max; maxI = y.maxI; }
    const stripes = ys.map((y) => `<button style="background:${snColor(y.mean)}" data-go='{"k":"year","y":${y.y}}' aria-label="${y.y}"></button>`).join('');
    const decades = [1820, 1860, 1900, 1940, 1980, 2020].map((d) => `<span style="left:${((d - 1818) / (ly.y - 1818 + 1)) * 100}%">${d}</span>`).join('');
    const chart = Charts.line([{ pts: ys.map((y) => ({ t: Date.UTC(y.y, 6, 1), v: y.mean })), color: '#ffb347', fill: '#ffb347', width: 1.4 }], { h: 130, yMin: 0, gap: 400 * DAY, xTicks: [1850, 1900, 1950, 2000].map((y) => Date.UTC(y, 0, 1)), xFmt: (d) => String(d.getUTCFullYear()) });
    return host.tabShell('history', shell(`
      <div class="card stripes-card"><div class="stripes">${stripes}</div><div class="decades">${decades}</div>
      <p class="muted small">Each stripe is a year, coloured by its average daily sunspot number. The rhythm is the ~11-year solar cycle — ${cycleNo2(ly.y)} cycles so far. Tap a year.</p></div>
      <div class="card chartcard">${chart}</div>
      <div class="grid recs">
        ${rec('Most active year', top.y, fmtSN(top.mean) + ' average', `{"k":"year","y":${top.y}}`)}
        ${rec('Quietest year', low.y, fmtSN(low.mean) + ' average', `{"k":"year","y":${low.y}}`)}
        ${rec('Most spotless days', spotless.y, spotless.zero + ' days without spots', `{"k":"year","y":${spotless.y}}`)}
        ${rec('Highest day', maxDay, dshort(maxI), JSON.stringify(dayL(maxI)))}
      </div>
      <div class="sect">Every year</div>
      <div class="ylist">${ys.slice().reverse().map((y) => `<button class="yrow" data-go='{"k":"year","y":${y.y}}'><b>${y.y}</b><i><em style="width:${Math.min(100, y.mean / 2.5)}%;background:${snColor(y.mean)}"></em></i><span>${fmtSN(y.mean)}</span><small>${y.zero ? y.zero + ' spotless' : ''}</small></button>`).join('')}</div>`,
    { title: '1818 – ' + ly.y }));
  }
  const rec = (l, v, s, go) => `<button class="tile rec" data-go='${go}'><div class="lbl">${l}</div><div class="val">${v}</div><div class="sub">${s}</div></button>`;
  const dayL = (i) => { const d = dateOf(i); return { k: 'day', y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; };

  // ----- a year -----
  function renderYear() {
    const y = lvl.y, ys = YEARS.find((q) => q.y === y) || { mean: null, zero: 0, max: -1, n: 0 };
    const months = []; for (let m = 1; m <= 12; m++) months.push({ m, ...(Date.UTC(y, m - 1, 1) <= Date.now() ? monthStats(y, m) : { mean: null, n: 0, zero: 0, max: -1 }) });
    const prev = YEARS.find((q) => q.y === y - 1);
    const diff = prev && ys.mean != null ? ys.mean - prev.mean : null;
    const W = 340, H = 120, bw = (W - 30) / 12, maxM = Math.max(50, ...months.map((q) => q.mean || 0));
    let bars = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
    for (const v of Charts.niceTicks(0, maxM, 3)) { const yy = 8 + (1 - v / maxM) * (H - 28); bars += `<line x1="26" x2="${W}" y1="${yy}" y2="${yy}" class="grid"/><text x="21" y="${yy + 3.5}" class="yl" text-anchor="end">${v}</text>`; }
    months.forEach((q, k) => {
      const x = 28 + k * bw;
      if (q.mean != null) { const hh = Math.max(1.5, (q.mean / maxM) * (H - 28)); bars += `<rect x="${x + bw * 0.14}" y="${H - 20 - hh}" width="${bw * 0.72}" height="${hh}" rx="2" fill="${snColor(q.mean)}"/>`; }
      bars += `<text x="${x + bw / 2}" y="${H - 6}" class="xl" text-anchor="middle">${MON[k][0]}</text>`;
    });
    bars += '</svg>';
    return host.tabShell('history', shell(`
      <div class="grid hstats">
        ${hs('Average', fmtSN(ys.mean), diff == null ? 'daily sunspot number' : (diff >= 0 ? '+' : '−') + Math.abs(Math.round(diff)) + ' vs ' + (y - 1))}
        ${hs('Highest day', ys.max >= 0 ? ys.max : '–', ys.maxI >= 0 ? dshort(ys.maxI) : '', ys.maxI >= 0 ? JSON.stringify(dayL(ys.maxI)) : '')}
        ${hs('Spotless days', ys.zero, ys.n ? Math.round((ys.zero / ys.n) * 100) + '% of the year' : '')}
        ${hs('Solar cycle', cycleNo2(y), cyclePhase(y))}
      </div>
      <div class="card chartcard"><div class="ctitle">Monthly average</div>${bars}</div>
      <div class="sect">Months</div>
      <div class="mgrid">${months.map((q) => `<button class="mtile${q.n ? '' : ' empty'}" ${q.n ? `data-go='{"k":"month","y":${y},"m":${q.m}}'` : 'disabled'} style="--mc:${snColor(q.mean, 0.9)}">
        <b>${MON[q.m - 1].slice(0, 3)}</b><span>${q.n ? fmtSN(q.mean) : ''}</span><small>${q.zero ? q.zero + ' spotless' : q.n ? 'max ' + q.max : ''}</small></button>`).join('')}</div>`,
    { title: pickY(y), nav: true }));
  }
  const hs = (l, v, s, go) => `<${go ? 'button' : 'div'} class="tile hst"${go ? ` data-go='${go}'` : ''}><div class="lbl">${l}</div><div class="val">${v}</div><div class="sub">${s || ''}</div></${go ? 'button' : 'div'}>`;
  // approximate cycle minima (start years) for labels
  const MINIMA = [1755.2, 1766.5, 1775.5, 1784.7, 1798.3, 1810.6, 1823.3, 1833.9, 1843.5, 1855.9, 1867.2, 1878.9, 1890.2, 1902.0, 1913.6, 1923.6, 1933.8, 1944.2, 1954.3, 1964.9, 1976.5, 1986.8, 1996.4, 2008.9, 2019.9];
  function cycleNo2(y) { let c = 0; for (let k = 0; k < MINIMA.length; k++) if (y + 0.5 >= MINIMA[k]) c = k + 1; return c; }
  function cyclePhase(y) {
    const c = cycleNo2(y), s = MINIMA[c - 1], e = MINIMA[c] || s + 11;
    const f = (y + 0.5 - s) / (e - s);
    return f < 0.15 ? 'near minimum' : f < 0.35 ? 'rising' : f < 0.55 ? 'near maximum' : f < 0.9 ? 'declining' : 'near minimum';
  }

  // ----- a month -----
  function renderMonth() {
    const y = lvl.y, m = lvl.m, days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const st = monthStats(y, m), pv = m === 1 ? monthStats(y - 1, 12) : monthStats(y, m - 1);
    const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7, ti = todayIdx();
    const pics = calMode === 'pictures' && Date.UTC(y, m - 1, 1) >= D_MDI;
    let cells = '';
    for (let k = 0; k < lead; k++) cells += '<i></i>';
    for (let d = 1; d <= days; d++) {
      const i = idx(y, m, d), x = val(i), fut = i > ti;
      const thumb = pics && !fut ? `<img loading="lazy" src="${hvShot(VIEWS[0].layer(imgTime(i)) || VIEWS[2].layer(imgTime(i)), imgTime(i), 96, 2000)}" alt="">` : '';
      const lk = !fut && !freeOk({ k: 'day', y, m, d });
      cells += `<button class="cday${x === 0 ? ' zero' : ''}${fut ? ' fut' : ''}${i === ti ? ' today' : ''}${thumb ? ' pic' : ''}${lk ? ' lk' : ''}" ${fut ? 'disabled' : lk ? 'data-pro="history"' : `data-go='${JSON.stringify({ k: 'day', y, m, d })}'`} style="--dc:${snColor(x, 0.85)}">${thumb}<b>${d}</b><span>${fut ? '' : x < 0 ? '–' : x === 0 ? '○' : x}</span></button>`;
    }
    const compare = st.mean != null && pv.mean != null ? (st.mean >= pv.mean ? 'up' : 'down') + ' from ' + Math.round(pv.mean) + ' the month before' : '';
    const decade = []; for (let k = 1; k <= 10; k++) { const s2 = monthStats(y - k, m); if (s2.mean != null) decade.push(s2.mean); }
    const dAvg = decade.length ? decade.reduce((a, b) => a + b, 0) / decade.length : null;
    const p = host.tabShell('history', shell(`
      <div class="seg mini calmode" data-cal>${[['number', 'Sunspot number'], ['pictures', 'Pictures']].map(([v, l]) => `<button data-v="${v}" class="${v === calMode ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${calMode === 'pictures' && !pics ? '<p class="muted small">No spacecraft pictures before 1996 — showing sunspot numbers.</p>' : ''}
      <div class="cal"><div class="dow">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<i>${d}</i>`).join('')}</div><div class="cgrid">${cells}</div></div>
      <div class="legendbar"><span>0</span><i style="background:linear-gradient(90deg,${[1, 25, 60, 110, 170, 230, 320].map((v) => snColor(v)).join(',')})"></i><span>300+</span><em>○ spotless</em></div>
      ${st.n ? `<div class="card msum"><p><b>Average sunspot number ${fmtSN(st.mean)}</b>${compare ? ', ' + compare : ''}.${dAvg != null ? ` That's ${Math.abs(Math.round(((st.mean - dAvg) / (dAvg || 1)) * 100))}% ${st.mean >= dAvg ? 'above' : 'below'} the average ${MON[m - 1]} of the previous ten years (${Math.round(dAvg)}).` : ''}</p>
      <p>${st.zero ? `${st.zero} spotless day${st.zero === 1 ? '' : 's'}. ` : 'No spotless days. '}${st.max > 0 ? `Highest: ${st.max} on ${dateOf(st.maxI).getUTCDate()} ${MON[m - 1]}.` : ''}</p>
      ${SN.prov[idx(y, m, Math.min(days, 28))] ? '<p class="small">Recent values are provisional and may change slightly.</p>' : ''}</div>` : ''}`,
    { title: pickM(m) + ' ' + pickY(y), nav: true }));
    p.querySelector('[data-cal]').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; calMode = b.dataset.v; Store.set('h:cal', calMode); render(host); e.stopPropagation(); });
    return p;
  }

  // ----- a day -----
  function renderDay() {
    const i = idx(lvl.y, lvl.m, lvl.d), x = val(i), t = imgTime(i), ms = monthStats(lvl.y, lvl.m);
    const view = VIEWS.find((v) => v.id === dayView) || VIEWS[0];
    const layer = view.layer(t) || VIEWS.map((v) => v.layer(t)).find(Boolean);
    const dt = dateOf(i), wd = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dt.getUTCDay()];
    // same date in other years
    const others = []; for (let yy = lvl.y - 1; yy >= Math.max(1818, lvl.y - 30); yy--) { if (lvl.m === 2 && lvl.d === 29 && !(yy % 4 === 0 && (yy % 100 || yy % 400 === 0))) continue; others.push({ y: yy, v: val(idx(yy, lvl.m, lvl.d)) }); }
    for (let yy = lvl.y + 1; yy <= now.getUTCFullYear(); yy++) { const j = idx(yy, lvl.m, lvl.d); if (j <= todayIdx()) others.unshift({ y: yy, v: val(j) }); }
    let best = { y: null, v: -1 }; for (let yy = 1818; yy <= now.getUTCFullYear(); yy++) { const v = val(idx(yy, lvl.m, lvl.d)); if (v > best.v) best = { y: yy, v }; }
    const p = host.tabShell('history', shell(`
      <div class="hday">
        <div class="pastdisk${layer ? '' : ' noimg'}" id="pdisk">
          <div class="glow"></div>
          ${layer ? `<img class="sunimg" src="${hvShot(layer, t, 900, 2000)}" alt="The Sun on ${dshort(i)}"><div class="ph"><div class="phs"></div></div><svg class="ovl" viewBox="-1 -1 2 2"></svg>` : `<div class="artdisk"><span>${fmtSN(x)}</span><small>sunspot number</small></div>`}
        </div>
        ${layer ? `<div class="chips hchips">${VIEWS.filter((v) => v.layer(t)).map((v) => `<button class="chip${v.id === view.id ? ' on' : ''}" data-v="${v.id}"><i style="background:${v.tint}"></i>${v.name}</button>`).join('')}</div>
        <div class="chsub">${esc(instrument(view.layer(t) ? view : VIEWS.find((v) => v.layer(t)), t))} · nearest picture to 12:00 UTC</div>` : `<p class="muted small center">No spacecraft pictures before 1996 — this day is known from the sunspot count made by observers at the time.</p>`}
      </div>
      <div class="grid hstats">
        ${hs('Sunspot number', `<span style="color:${x > 0 ? snColor(Math.max(x, 60)) : 'var(--text)'}">${x < 0 ? '–' : x}</span>`, x === 0 ? 'A spotless day' : x < 0 ? 'Not recorded' : i === todayIdx() && (SN.v[i] == null || SN.v[i] < 0) ? 'Estimate from NOAA today' : ms.mean != null ? (x >= ms.mean ? '+' : '−') + Math.abs(Math.round(x - ms.mean)) + ' vs month average' : '')}
        ${hs('Month average', fmtSN(ms.mean), MON[lvl.m - 1] + ' ' + lvl.y)}
      </div>
      <div class="sect-row"><div class="sect">Sunspot groups</div><div class="sect-aside" id="gcount"></div></div>
      <div id="groups">${i >= idx(1996, 1, 1) ? '<div class="skel" style="height:80px"></div>' : '<p class="muted">Numbered groups (NOAA regions) are available from 1996 on in this app.</p>'}</div>
      ${t >= Date.UTC(2010, 3, 1) ? '<div class="sect">Flares that day</div><div id="flares"><div class="skel" style="height:50px"></div></div>' : ''}
      <div class="sect">${lvl.d} ${MON[lvl.m - 1]} in other years</div>
      <div class="card oyears">${others.slice(0, 16).map((o) => `<button class="oy" data-go='${JSON.stringify({ k: 'day', y: o.y, m: lvl.m, d: lvl.d })}'><b>${o.y}</b><i><em style="width:${Math.min(100, Math.max(0, o.v) / 3)}%;background:${snColor(o.v)}"></em></i><span>${fmtSN(o.v)}</span></button>`).join('')}
      ${best.y ? `<p class="muted small">Highest ever on this date: <b>${best.v}</b> in ${best.y}.</p>` : ''}</div>`,
    { title: `<span class="wd">${wd},</span> ${lvl.d} ${pickM(lvl.m, true)} ${pickY(lvl.y)}`, nav: true }));

    const dk = p.querySelector('#pdisk');
    if (layer) {
      const img = dk.querySelector('.sunimg');
      const stat = document.createElement('div'); stat.className = 'pdstat'; stat.textContent = 'Loading picture…';
      dk.after(stat);
      const to = setTimeout(() => { if (!dk.classList.contains('ok')) { dk.classList.add('failed'); img.removeAttribute('src'); stat.textContent = 'Picture unavailable for this day'; } }, 45000);
      img.addEventListener('load', () => { clearTimeout(to); if (img.naturalWidth) { dk.classList.add('ok'); stat.textContent = ''; } else { dk.classList.add('failed'); stat.textContent = 'Picture unavailable for this day'; } });
      img.addEventListener('error', () => { if (!img.getAttribute('src')) return; clearTimeout(to); dk.classList.add('failed'); stat.textContent = 'Picture unavailable for this day'; });
      p.querySelector('.hchips').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; dayView = b.dataset.v; Store.set('h:view', dayView); render(host); });
    }
    const key = i;
    if (i >= idx(1996, 1, 1)) regionsOn(i).then((rs) => {
      if (!p.isConnected || idx(lvl.y, lvl.m, lvl.d) !== key) return;
      const g = Sun.geom(new Date(t)), ovl = dk.querySelector('.ovl');
      if (ovl) {
        ovl.setAttribute('viewBox', [-2000 / g.rsun / 2, -2000 / g.rsun / 2, 2000 / g.rsun, 2000 / g.rsun].join(' '));
        ovl.innerHTML = rs.map((r) => {
          let px, py;
          if (r.lat != null && r.lon != null) { const lon = Sun.rotate(r.lon, U.utc(r.t), r.lat, new Date(t)); const q = Sun.project(r.lat, lon, g.B0); if (q.z < 0.05) return ''; px = q.x; py = q.y; }
          else if (r.hx != null) { px = r.hx / g.rsun; py = r.hy / g.rsun; } else return '';
          const sz = 0.04 + Math.min(0.04, (r.spots || 1) / 900), lx = px > 0.55 ? -1 : 1;
          return `<g class="mk" transform="translate(${px.toFixed(4)},${(-py).toFixed(4)})" style="--mc:${grpColor(r)}"><circle r="${sz.toFixed(3)}" class="ring"/><text x="${(lx * (sz + 0.018)).toFixed(3)}" y="${(-sz - 0.006).toFixed(3)}" text-anchor="${lx > 0 ? 'start' : 'end'}">${r.region % 10000}</text></g>`;
        }).join('');
      }
      p.querySelector('#gcount').textContent = rs.length ? rs.length + ' groups · ' + rs.reduce((a, r) => a + (r.spots || 0), 0) + ' spots' : '';
      p.querySelector('#groups').innerHTML = rs.length ? '<div class="regs">' + rs.map((r) => `<button class="card reg" data-g="${r.region}" style="--mc:${grpColor(r)}"><div class="rhead"><span class="rnum">AR ${r.region}</span><span class="rloc">${esc(r.loc)}</span></div><div class="rstats"><span>${r.spots == null ? '--' : r.spots} spot${r.spots === 1 ? '' : 's'}</span><span>${esc(r.cls || '')}</span></div><div class="rstats"><span>${esc(r.mag || '')}</span></div></button>`).join('') + '</div>'
        : `<p class="muted">${x === 0 ? 'No sunspot groups — the Sun was spotless.' : 'No numbered groups listed for this day.'}</p>`;
      p.querySelector('#groups').onclick = (e) => { const b = e.target.closest('[data-g]'); if (b) groupSheet(rs.find((r) => String(r.region) === b.dataset.g), t, layer); };
    }).catch((er) => { if (p.isConnected) p.querySelector('#groups').innerHTML = `<p class="muted">Couldn't load the groups for this day (${esc(er.message)}).</p>`; });
    if (t >= Date.UTC(2010, 3, 1)) flaresOn(i).then((fs) => {
      if (!p.isConnected) return;
      p.querySelector('#flares').innerHTML = fs.length ? '<div class="flr">' + fs.map((f) => `<span class="fchip" style="--fc:${flareCol(f.cls)}"><b>${esc(f.cls)}</b> ${Fmt.time(f.peak)}${f.ar ? ' · AR ' + f.ar : ''}</span>`).join('') + '</div>' : '<p class="muted">No C, M or X-class flares recorded.</p>';
    }).catch(() => { if (p.isConnected) p.querySelector('#flares').innerHTML = '<p class="muted">Flare list unavailable.</p>'; });
    return p;
  }
  function grpColor(r) { const m = (r.mag || '').toUpperCase(); return /DELTA/.test(m) ? 'var(--x)' : /GAMMA/.test(m) ? 'var(--m)' : 'var(--c)'; }
  function flareCol(c) { c = (c || '')[0]; return c === 'X' ? 'var(--x)' : c === 'M' ? 'var(--m)' : 'var(--c)'; }
  function groupSheet(r, t, layer) {
    if (!r) return;
    const g = Sun.geom(new Date(t));
    let hx = r.hx, hy = r.hy;
    if (r.lat != null && r.lon != null) { const q = Sun.project(r.lat, Sun.rotate(r.lon, U.utc(r.t), r.lat, new Date(t)), g.B0); hx = q.x * g.rsun; hy = q.y * g.rsun; }
    const spotLayer = VIEWS[0].layer(t) || layer;
    host.openSheet(`<div class="stitle">AR ${r.region} · ${dshort(Math.floor((t - BASE) / DAY))}</div>
      ${hx != null ? `<div class="zoom"><img src="${hvShot(spotLayer, t, 640, 400, hx, hy, 400)}" alt=""><span>Close-up · ${esc(instrument(VIEWS[0].layer(t) ? VIEWS[0] : VIEWS[2], t))}</span></div>` : ''}
      <div class="kv"><div><span>Position</span><b>${esc(r.loc || '--')}</b></div><div><span>Spots</span><b>${r.spots == null ? '--' : r.spots}</b></div>
      <div><span>McIntosh class</span><b>${esc(r.cls || '--')}</b></div><div><span>Magnetic class</span><b>${esc(r.mag || '--')}</b></div></div>
      <p class="muted small">From NOAA's region report for that day, via the Heliophysics Events Knowledgebase.</p>`);
  }

  window.SunHist = { render, back, reset, load: loadSN, _parse: parseRows, snColor };
})();
