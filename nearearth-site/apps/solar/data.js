/* Solar — data sources: NOAA SWPC (live), NASA DONKI (events), SDO / Helioviewer (images) */
(function () {
  'use strict';
  const { cached, table, pick, num, utc } = U;
  const SWPC = 'https://services.swpc.noaa.gov';

  const URLS = {
    kp: SWPC + '/products/noaa-planetary-k-index.json',
    kpFc: SWPC + '/products/noaa-planetary-k-index-forecast.json',
    plasma: SWPC + '/products/solar-wind/plasma-1-day.json',
    mag: SWPC + '/products/solar-wind/mag-1-day.json',
    plasma7: SWPC + '/products/solar-wind/plasma-7-day.json',
    mag7: SWPC + '/products/solar-wind/mag-7-day.json',
    // NOAA removed the /products/solar-wind files on 30 Apr 2026; these real-time feeds replace them (last 24 h only)
    rtswWind: SWPC + '/json/rtsw/rtsw_wind_1m.json',
    protons: SWPC + '/json/goes/primary/integral-protons-1-day.json',
    rtswMag: SWPC + '/json/rtsw/rtsw_mag_1m.json',
    xray: SWPC + '/json/goes/primary/xrays-1-day.json',
    xray3: SWPC + '/json/goes/primary/xrays-3-day.json',
    flares: SWPC + '/json/goes/primary/xray-flares-latest.json',
    regions: SWPC + '/json/solar_regions.json',
    scales: SWPC + '/products/noaa-scales.json',
    probs: SWPC + '/json/solar_probabilities.json',
    alerts: SWPC + '/products/alerts.json',
    ovation: SWPC + '/json/ovation_aurora_latest.json',
    cycle: SWPC + '/json/solar-cycle/observed-solar-cycle-indices.json',
    cyclePred: SWPC + '/json/solar-cycle/predicted-solar-cycle.json',
    f107: SWPC + '/json/f107_cm_flux.json',
    discussion: SWPC + '/text/discussion.txt',
  };
  // NASA moved DONKI's web service on 30 Sep 2026 (the old kauai address now redirects to a news page).
  const DONKI = 'https://ccmc.gsfc.nasa.gov/DONKI-API/get/';
  const DONKI_OLD = 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/';

  // ---------- images ----------
  // SDO near-real-time browse images refresh every 15 minutes.
  const CHANNELS = [
    { id: 'HMIIF', name: 'Sunspots', sub: 'Visible light · HMI', hmi: true, tint: '#f5b25c' },
    { id: 'HMIBC', name: 'Magnetic', sub: 'Magnetogram · HMI', hmi: true },
    { id: '0304', name: 'Chromosphere', sub: '304 Å · AIA', tint: '#ff7a3d' },
    { id: '0171', name: 'Corona loops', sub: '171 Å · AIA', tint: '#e9c25a' },
    { id: '0193', name: 'Coronal holes', sub: '193 Å · AIA', tint: '#c88c4a' },
    { id: '0131', name: 'Flares', sub: '131 Å · AIA', tint: '#3fb2b0' },
    { id: '0211', name: 'Active regions', sub: '211 Å · AIA', tint: '#b45ec8' },
    { id: '1700', name: 'Photosphere UV', sub: '1700 Å · AIA', tint: '#e98c5d' },
  ];
  // Helioviewer fallbacks for when the SDO browse folder is stale or down.
  const HV_LAYER = {
    HMIIF: '[SDO,HMI,HMI,continuum,1,100]', HMIBC: '[SDO,HMI,HMI,magnetogram,1,100]',
    '0304': '[SDO,AIA,AIA,304,1,100]', '0171': '[SDO,AIA,AIA,171,1,100]', '0193': '[SDO,AIA,AIA,193,1,100]',
    '0131': '[SDO,AIA,AIA,131,1,100]', '0211': '[SDO,AIA,AIA,211,1,100]', '1700': '[SDO,AIA,AIA,1700,1,100]',
  };
  function slot() { return Math.floor(Date.now() / (15 * 60000)); }
  function sdoUrl(ch, res) { return 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_' + res + '_' + ch + '.jpg?s=' + slot(); }
  function hvUrl(ch, px, at) {
    const scale = (2 * 1000 / px).toFixed(4); // arcsec per pixel so the whole disk (~1920") fits
    return 'https://api.helioviewer.org/v2/takeScreenshot/?date=' + new Date(at ? +at : Date.now() - 3600e3).toISOString().replace(/\.\d+Z$/, 'Z') +
      '&imageScale=' + scale + '&layers=' + HV_LAYER[ch] + '&x0=0&y0=0&width=' + px + '&height=' + px + '&display=true&watermark=false' + (at ? '' : '&s=' + slot());
  }
  // SDO's own 48-hour movies of the latest pictures
  function sdoMovie(ch, res) { return 'https://sdo.gsfc.nasa.gov/assets/img/latest/mpeg/latest_' + (res || 512) + '_' + ch + '.mp4'; }
  // Fraction of the image width taken by the solar radius, for placing region markers.
  // SDO browse images keep the full-res plate scale (HMI 0.504"/px, AIA 0.6"/px at 4096 px).
  function diskFrac(ch, src, rsunArcsec) {
    if (src === 'hv') return rsunArcsec / 2000;
    const scale = ch.startsWith('HMI') ? 0.504 : 0.6;
    return rsunArcsec / scale / 4096;
  }

  // ---------- live numbers ----------
  async function kp(force) {
    const r = await cached('kp', URLS.kp, 15, force);
    const rows = table(r.data).map((o) => ({ t: utc(pick(o, 'time_tag', 'time')), kp: num(pick(o, 'kp', 'kp_index', 'estimated_kp')) }))
      .filter((x) => x.t && x.kp != null);
    return { rows, at: r.t, stale: r.stale };
  }
  async function kpForecast(force) {
    const r = await cached('kpfc', URLS.kpFc, 60, force);
    return table(r.data).map((o) => ({
      t: utc(pick(o, 'time_tag', 'time')), kp: num(pick(o, 'kp')),
      kind: String(pick(o, 'observed') || '').toLowerCase(), scale: pick(o, 'noaa_scale'),
    })).filter((x) => x.t && x.kp != null);
  }
  // Real-time solar wind. Each feed lists every spacecraft (e.g. DSCOVR, ACE, IMAP) minute by minute,
  // newest first; NOAA marks the one it currently relies on as "active". Keep that one, oldest first.
  function rtsw(rows) {
    const hasActive = rows.some((o) => o.active === true || o.active === 'true');
    const by = new Map();
    for (const o of rows) {
      const t = utc(pick(o, 'time_tag')); if (!t) continue;
      const act = o.active === true || o.active === 'true';
      if (hasActive && !act) continue;
      if (!by.has(+t)) by.set(+t, o);
    }
    return Array.from(by.entries()).sort((a, b) => a[0] - b[0]).map(([t, o]) => ({ t: new Date(t), o }));
  }
  async function windFeeds(force) {
    try {
      const [p, m] = await Promise.all([cached('rtsw-wind', URLS.rtswWind, 5, force), cached('rtsw-mag', URLS.rtswMag, 5, force)]);
      return { p, m, plasma: rtsw(table(p.data)), mag: rtsw(table(m.data)) };
    } catch (e) { // older NOAA layout, in case the real-time feeds are unreachable
      const [p, m] = await Promise.all([cached('plasma', URLS.plasma, 5, force), cached('mag', URLS.mag, 5, force)]);
      const rows = (d) => table(d).map((o) => ({ t: utc(pick(o, 'time_tag')), o })).filter((x) => x.t);
      return { p, m, plasma: rows(p.data), mag: rows(m.data) };
    }
  }
  // "week" used to fetch NOAA's 7-day files; those are gone, so the longer views are built from
  // Solar's own hourly record on the phone plus this last day.
  async function wind(force, week) {
    const f = await windFeeds(force);
    const plasma = f.plasma.map(({ t, o }) => ({ t, n: num(pick(o, 'proton_density', 'density')), v: num(pick(o, 'proton_speed', 'speed')), temp: num(pick(o, 'proton_temperature', 'temperature')) }));
    const mag = f.mag.map(({ t, o }) => ({ t, bz: num(pick(o, 'bz_gsm', 'bz')), by: num(pick(o, 'by_gsm', 'by')), bt: num(pick(o, 'bt')) }));
    const last = (a, k) => { for (let i = a.length - 1; i >= 0; i--) if (a[i][k] != null) return a[i]; return null; };
    const src = f.plasma.length ? pick(f.plasma[f.plasma.length - 1].o, 'source') : null;
    return { plasma, mag, v: last(plasma, 'v'), n: last(plasma, 'n'), temp: last(plasma, 'temp'), bz: last(mag, 'bz'), bt: last(mag, 'bt'), at: Math.min(f.p.t, f.m.t), stale: f.p.stale || f.m.stale, source: src };
  }
  // GOES integral protons: the >=10 MeV channel decides radiation storms (S1 at 10 pfu)
  async function protons(force) {
    const r = await cached('protons', URLS.protons, 10, force);
    const pts = [];
    for (const o of table(r.data)) {
      if (!/^>=\s*10 MeV/i.test(String(pick(o, 'energy') || ''))) continue;
      const t = utc(pick(o, 'time_tag')), f = num(pick(o, 'flux'));
      if (t && f != null && f >= 0) pts.push({ t, f });
    }
    pts.sort((a, b) => a.t - b.t);
    return { pts, now: pts[pts.length - 1] || null, at: r.t };
  }
  async function xray(force, days3) {
    const r = await cached(days3 ? 'xray3' : 'xray', days3 ? URLS.xray3 : URLS.xray, 5, force);
    const long = [], short = [];
    for (const o of table(r.data)) {
      const t = utc(pick(o, 'time_tag')), f = num(pick(o, 'flux', 'observed_flux'));
      if (!t || f == null || f <= 0) continue;
      const e = String(pick(o, 'energy') || '');
      if (e.startsWith('0.1')) long.push({ t, f }); else if (e.startsWith('0.05')) short.push({ t, f });
    }
    return { long, short, now: long[long.length - 1] || null, at: r.t, stale: r.stale };
  }
  function flareClass(f) {
    if (f == null || f <= 0) return '--';
    const L = [['X', 1e-4], ['M', 1e-5], ['C', 1e-6], ['B', 1e-7], ['A', 1e-8]];
    for (const [c, b] of L) if (f >= b) { const v = f / b; return c + (v >= 10 && c === 'X' ? Math.round(v) : v.toFixed(1)); }
    return 'A' + (f / 1e-8).toFixed(1);
  }
  async function latestFlare(force) {
    const r = await cached('flares', URLS.flares, 10, force);
    const a = Array.isArray(r.data) ? r.data : [r.data];
    const o = a.length ? table(a)[0] : null;
    if (!o) return null;
    return {
      cls: pick(o, 'max_class', 'current_class'), cur: pick(o, 'current_class'),
      begin: utc(pick(o, 'begin_time')), max: utc(pick(o, 'max_time')), end: utc(pick(o, 'end_time')),
    };
  }

  // Active regions — the numbered sunspot groups. One row per region per day; keep the latest day.
  function parseLoc(s) {
    const m = /^([NS])(\d{1,2})([EW])(\d{1,3})$/.exec(String(s || '').trim().toUpperCase());
    if (!m) return null;
    return { lat: (m[1] === 'S' ? -1 : 1) * +m[2], lon: (m[3] === 'E' ? -1 : 1) * +m[4] };
  }
  async function regions(force) {
    const r = await cached('regions', URLS.regions, 60, force);
    const rows = table(r.data);
    let latest = null;
    for (const o of rows) { const d = String(pick(o, 'observed_date') || ''); if (d && (!latest || d > latest)) latest = d; }
    const out = [];
    for (const o of rows) {
      if (latest && String(pick(o, 'observed_date')) !== latest) continue;
      const loc = parseLoc(pick(o, 'location'));
      let lat = loc ? loc.lat : num(pick(o, 'latitude')), lon = loc ? loc.lon : num(pick(o, 'longitude'));
      const region = num(pick(o, 'region'));
      if (region == null) continue;
      const spots = num(pick(o, 'number_spots'));
      out.push({
        region: region < 10000 ? region + 10000 : region,
        loc: pick(o, 'location') || '', lat, lon,
        area: num(pick(o, 'area')), spots, cls: pick(o, 'spot_class'), mag: pick(o, 'mag_class'),
        extent: num(pick(o, 'extent')),
        c: num(pick(o, 'c_flare_probability')), m: num(pick(o, 'm_flare_probability')), x: num(pick(o, 'x_flare_probability')),
        cEv: num(pick(o, 'c_xray_events')) || 0, mEv: num(pick(o, 'm_xray_events')) || 0, xEv: num(pick(o, 'x_xray_events')) || 0,
        first: pick(o, 'first_date'), status: pick(o, 'status'),
      });
    }
    out.sort((a, b) => (b.area || 0) - (a.area || 0));
    return { list: out, date: latest, at: r.t, stale: r.stale };
  }

  async function scales(force) {
    const r = await cached('scales', URLS.scales, 15, force);
    const d = r.data || {};
    const g = (k) => d[k] || d[String(k)] || null;
    const lvl = (o, k) => { const v = o && o[k] && o[k].Scale; const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };
    const fc = [1, 2, 3].map((i) => g(i)).filter(Boolean).map((o) => ({
      date: o.DateStamp, g: lvl(o, 'G'),
      rMinor: num(o.R && o.R.MinorProb), rMajor: num(o.R && o.R.MajorProb), s: num(o.S && o.S.Prob),
    }));
    const now = g(0), max = g(-1);
    return { now: { r: lvl(now, 'R'), s: lvl(now, 'S'), g: lvl(now, 'G') }, max24: { r: lvl(max, 'R'), s: lvl(max, 'S'), g: lvl(max, 'G') }, fc, at: r.t };
  }
  async function probabilities(force) {
    const r = await cached('probs', URLS.probs, 60, force);
    return table(r.data).map((o) => ({
      date: pick(o, 'date'),
      c: [num(o.c_class_1_day), num(o.c_class_2_day), num(o.c_class_3_day)],
      m: [num(o.m_class_1_day), num(o.m_class_2_day), num(o.m_class_3_day)],
      x: [num(o.x_class_1_day), num(o.x_class_2_day), num(o.x_class_3_day)],
      p: [num(o['10mev_protons_1_day']), num(o['10mev_protons_2_day']), num(o['10mev_protons_3_day'])],
    })).filter((x) => x.date).sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null;
  }
  // When the thing an alert is about is over: the latest time in its message
  // ("Valid To", "Now Valid Until", "End Time", "Threshold Reached", "Begin/Maximum Time"…)
  // or, for watches, the end of the last day with a storm predicted. Falls back to the issue time.
  const MON3 = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  function alertEnd(msg, issued) {
    let end = issued ? +issued : 0;
    const re = /(\d{4}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}) (\d{2})(\d{2}) UTC/g;
    let m;
    while ((m = re.exec(msg))) end = Math.max(end, Date.UTC(+m[1], MON3[m[2]], +m[3], +m[4], +m[5]));
    // watch: "Highest Storm Level Predicted by Day: Oct 05: G1 (Minor)   Oct 06: None (Below G1)"
    const day = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}):\s+(G[1-5]|None)/g;
    const y0 = issued ? issued.getUTCFullYear() : new Date().getUTCFullYear();
    while ((m = day.exec(msg))) {
      if (m[3] === 'None') continue;
      let y = y0; if (issued && MON3[m[1]] === 0 && issued.getUTCMonth() === 11) y++;
      end = Math.max(end, Date.UTC(y, MON3[m[1]], +m[2], 23, 59));
    }
    return end ? new Date(end) : null;
  }
  async function alerts(force) {
    const r = await cached('alerts', URLS.alerts, 10, force);
    return table(r.data).map((o) => {
      const msg = String(pick(o, 'message') || '').replace(/\r/g, '');
      const t = utc(pick(o, 'issue_datetime'));
      const head = (/^(ALERT|WARNING|WATCH|SUMMARY|EXTENDED WARNING|CANCEL[^:]*|CONTINUED ALERT):\s*(.+)$/m.exec(msg) || []);
      const kind = (head[1] || 'NOTICE').toLowerCase();
      return { id: pick(o, 'product_id'), t, kind, title: head[2] ? head[2].trim() : (msg.split('\n').find((l) => l.trim() && !l.startsWith('Space Weather Message Code')) || 'Notice'), msg, until: alertEnd(msg, t) };
    }).filter((a) => a.t).sort((a, b) => b.t - a.t);
  }

  // Aurora: OVATION 30-minute forecast, grid of [lon 0..359, lat -90..90, probability %]
  async function ovation(force) {
    const r = await cached('ovation', URLS.ovation, 15, force);
    const d = r.data || {};
    const grid = new Map();
    for (const c of d.coordinates || []) grid.set(Math.round(c[0]) + ',' + Math.round(c[1]), c[2]);
    return {
      grid, obs: utc(d['Observation Time']), fc: utc(d['Forecast Time']),
      at(lat, lon) {
        lon = ((Math.round(lon) % 360) + 360) % 360;
        let best = 0; // the oval just poleward is visible low on the horizon, so look a few degrees north too
        const dir = lat >= 0 ? 1 : -1;
        const here = grid.get(lon + ',' + Math.round(lat)) || 0;
        for (let k = 1; k <= 8; k++) best = Math.max(best, (grid.get(lon + ',' + (Math.round(lat) + dir * k)) || 0) * (1 - k / 10));
        return { here, horizon: Math.round(best) };
      },
    };
  }

  async function cycle(force) {
    const [o, p] = await Promise.all([cached('cycle', URLS.cycle, 720, force), cached('cyclep', URLS.cyclePred, 720, force).catch(() => ({ data: [] }))]);
    const pos = (v) => { const n = num(v); return n == null || n < 0 ? null : n; }; // NOAA uses -1 for 'not yet computed'
    const obs = table(o.data).map((x) => ({ t: pick(x, 'time-tag', 'time_tag'), ssn: pos(pick(x, 'ssn')), sm: pos(pick(x, 'smoothed_ssn')), f: pos(pick(x, 'f10.7')) })).filter((x) => x.t);
    const pred = table(p.data).map((x) => ({ t: pick(x, 'time-tag', 'time_tag'), ssn: pos(pick(x, 'predicted_ssn')), hi: pos(pick(x, 'high_ssn')), lo: pos(pick(x, 'low_ssn')) })).filter((x) => x.t && x.ssn != null);
    return { obs, pred };
  }
  async function discussion(force) {
    const key = 'disc';
    const c = U.Store.get('c:' + key, null);
    if (c && !force && Date.now() - c.t < 3600e3) return c.d;
    try { const t = await U.http(URLS.discussion); U.Store.set('c:' + key, { t: Date.now(), d: t }); return t; }
    catch (e) { if (c) return c.d; throw e; }
  }

  // ---------- NASA DONKI events (last 30 days) ----------
  function ymd(d) { return d.toISOString().slice(0, 10); }
  async function donki(kind, days, force) {
    const end = new Date(), start = new Date(Date.now() - days * 864e5);
    const q = kind + '?startDate=' + ymd(start) + '&endDate=' + ymd(end);
    let r;
    try { r = await cached('donki-' + kind + days, DONKI + q, 60, force); }
    catch (e) { r = await cached('donki-' + kind + days, DONKI_OLD + q, 60, force); } // in case NASA moves back
    return Array.isArray(r.data) ? r.data : [];
  }
  async function events(force) {
    const [flr, cme, gst] = await Promise.all([
      donki('FLR', 30, force).catch(() => null), donki('CME', 30, force).catch(() => null), donki('GST', 30, force).catch(() => null),
    ]);
    if (!flr && !cme && !gst) throw new Error('NASA DONKI did not answer');
    return parseEvents(flr, cme, gst);
  }
  // DONKI records → the app's event objects (also used by the tab histories)
  function parseEvents(flr, cme, gst, sep, ips) {
    const ev = [];
    for (const f of flr || []) ev.push({
      kind: 'flare', t: utc(f.peakTime || f.beginTime), cls: f.classType, loc: f.sourceLocation, ar: f.activeRegionNum,
      begin: utc(f.beginTime), end: utc(f.endTime), link: f.link,
    });
    for (const c of cme || []) {
      const an = (c.cmeAnalyses || []).find((a) => a.isMostAccurate) || (c.cmeAnalyses || [])[0] || {};
      const en = (an.enlilList || []).filter((e) => e.estimatedShockArrivalTime || e.isEarthGB);
      const earth = en.length > 0;
      const hit = en.find((e) => e.estimatedShockArrivalTime) || {};
      const kps = [hit.kp_18, hit.kp_90, hit.kp_135, hit.kp_180].map(num).filter((x) => x != null);
      ev.push({ kind: 'cme', t: utc(c.startTime), speed: num(an.speed), type: an.type, half: num(an.halfAngle), loc: c.sourceLocation, ar: c.activeRegionNum, note: c.note,
        earth, arrival: utc(hit.estimatedShockArrivalTime), glancing: !!hit.isEarthGB, kpMax: kps.length ? Math.max(...kps) : null,
        dir: num(an.longitude), dur: num(hit.estimatedDuration), link: c.link });
    }
    for (const g of gst || []) {
      const kps = (g.allKpIndex || []).map((k) => num(k.kpIndex)).filter((x) => x != null);
      ev.push({ kind: 'storm', t: utc(g.startTime), kp: kps.length ? Math.max(...kps) : null, link: g.link });
    }
    for (const x of sep || []) ev.push({ kind: 'sep', t: utc(x.eventTime), inst: (x.instruments || []).map((i) => i.displayName).join(', '), link: x.link });
    for (const x of ips || []) ev.push({ kind: 'shock', t: utc(x.eventTime), where: x.location, inst: (x.instruments || []).map((i) => i.displayName).join(', '), link: x.link });
    return ev.filter((e) => e.t).sort((a, b) => b.t - a.t);
  }

  // ---------- cloud forecast for the Tonight score (Open-Meteo, keyless) ----------
  async function clouds(lat, lon, force) {
    const la = lat.toFixed(2), lo = lon.toFixed(2);
    const r = await cached('wx:' + la + ',' + lo, `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&hourly=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high&forecast_days=2&timeformat=unixtime`, 30, force);
    const h = (r.data && r.data.hourly) || {};
    return (h.time || []).map((t, i) => ({ t: t * 1000, c: num(h.cloud_cover && h.cloud_cover[i]), lo: num(h.cloud_cover_low && h.cloud_cover_low[i]), mid: num(h.cloud_cover_mid && h.cloud_cover_mid[i]), hi: num(h.cloud_cover_high && h.cloud_cover_high[i]) })).filter((x) => x.c != null);
  }
  // ---------- place search (Open-Meteo geocoding, keyless) ----------
  async function geocode(q) {
    const j = await U.getJSON('https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&format=json&name=' + encodeURIComponent(q));
    return (j.results || []).map((r) => ({ name: r.name, lat: r.latitude, lon: r.longitude, sub: [r.admin1, r.country].filter(Boolean).join(', '), tz: r.timezone || null }));
  }

  window.Data = { clouds, parseEvents, DONKI_OLD, protons, _alertEnd: alertEnd, DONKI, URLS, CHANNELS, sdoUrl, hvUrl, sdoMovie, diskFrac, kp, kpForecast, wind, xray, flareClass, latestFlare, regions, parseLoc, scales, probabilities, alerts, ovation, cycle, discussion, events, geocode };
})();
