/* Website demo layer: runs the real app UI with sample data, no network, no lasting storage.
   Loaded first in each app's index.html. window.__DEMO_APP is set just before this file. */
(function () {
  'use strict';
  var APP = window.__DEMO_APP || '';
  var PLACE = { name: 'London', lat: 51.5074, lon: -0.1278 };

  /* ---------- in-memory storage (the four apps share one website origin) ---------- */
  function MemStore(seed) {
    var m = Object.create(null); Object.keys(seed || {}).forEach(function (k) { m[k] = String(seed[k]); });
    var s = {
      getItem: function (k) { k = String(k); return k in m ? m[k] : null; },
      setItem: function (k, v) { m[String(k)] = String(v); },
      removeItem: function (k) { delete m[String(k)]; },
      clear: function () { Object.keys(m).forEach(function (k) { delete m[k]; }); },
      key: function (i) { return Object.keys(m)[i] || null; },
    };
    Object.defineProperty(s, 'length', { get: function () { return Object.keys(m).length; } });
    return new Proxy(s, {
      get: function (t, k) { if (k in t) return t[k]; return typeof k === 'string' && k in m ? m[k] : undefined; },
      set: function (t, k, v) { if (k in t) return false; m[k] = String(v); return true; },
      ownKeys: function () { return Object.keys(m); },
      getOwnPropertyDescriptor: function (t, k) { return k in m ? { value: m[k], enumerable: true, configurable: true, writable: true } : undefined; },
      has: function (t, k) { return k in t || k in m; },
      deleteProperty: function (t, k) { delete m[k]; return true; },
    });
  }
  var SEED = {
    solar: {
      'sonne:onb:done': 'true', 'sonne:tour:major': '99', 'sonne:pro:test': 'true',
      'sonne:place': JSON.stringify(PLACE), 'sonne:places': JSON.stringify([PLACE]),
      'sonne:notif': JSON.stringify({ on: false }),
    },
    overhead: { settings: JSON.stringify({ alerts: false }), places: JSON.stringify([PLACE]), placeIdx: '0' },
    asteroids: { settings: JSON.stringify({ alerts: false }) },
    sky: {},
  }[APP] || {};
  try { Object.defineProperty(window, 'localStorage', { value: MemStore(SEED), configurable: true }); } catch (e) { }
  try { Object.defineProperty(window, 'sessionStorage', { value: MemStore({}), configurable: true }); } catch (e) { }

  /* ---------- location: always London ---------- */
  try {
    var pos = { coords: { latitude: PLACE.lat, longitude: PLACE.lon, accuracy: 30, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() };
    var geo = {
      getCurrentPosition: function (ok) { setTimeout(function () { ok(pos); }, 50); },
      watchPosition: function (ok) { setTimeout(function () { ok(pos); }, 50); return 1; },
      clearWatch: function () { },
    };
    Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
  } catch (e) { }

  /* ---------- helpers ---------- */
  var NOW = Date.now(), MIN = 60e3, HR = 3600e3, DAY = 864e5;
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function pad(n, w) { return String(n).padStart(w || 2, '0'); }
  function iso(t) { return new Date(t).toISOString().slice(0, 19); }       // 2026-10-26T12:00:00
  function isoZ(t) { return iso(t) + 'Z'; }
  function isoM(t) { return new Date(t).toISOString().slice(0, 16) + 'Z'; }  // DONKI style
  function sp(t) { return iso(t).replace('T', ' '); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function cd(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + MON[d.getUTCMonth()] + '-' + pad(d.getUTCDate()) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); }
  function floorTo(t, step) { return Math.floor(t / step) * step; }
  function q(url) { var o = {}; try { new URL(url).searchParams.forEach(function (v, k) { o[k] = v; }); } catch (e) { } return o; }

  /* ---------- sample data: shared ---------- */
  function kpAt(t) { // a calm week with one active spell about 30 h ago
    var h = (NOW - t) / HR;
    return Math.max(0.33, Math.min(9, 2.4 + 0.9 * Math.sin(t / (9 * HR)) + 2.6 * Math.exp(-Math.pow((h - 30) / 9, 2))));
  }
  function kpRound(v) { return Math.round(v * 3) / 3; }
  function kpForecast() {
    var rows = [['time_tag', 'kp', 'observed', 'noaa_scale']], t0 = floorTo(NOW, 3 * HR) - 7 * DAY;
    for (var t = t0; t < NOW + 3 * DAY; t += 3 * HR) {
      var k = kpRound(kpAt(t)); var kind = t + 3 * HR < NOW ? 'observed' : t < NOW ? 'estimated' : 'predicted';
      rows.push([sp(t), k.toFixed(2), kind, k >= 5 ? 'G' + Math.min(5, Math.floor(k - 4)) : null]);
    }
    return rows;
  }
  function clouds(u, withTemp) {
    var p = q(u), r = rng(7), start = floorTo(NOW, DAY) - (p.past_days ? DAY : 0), n = 24 * ((+p.forecast_days || 2) + (+p.past_days || 0));
    var time = [], cc = [], lo = [], mid = [], hi = [], temp = [];
    for (var i = 0; i < n; i++) {
      var t = start + i * HR, hr = new Date(t).getUTCHours();
      var base = 35 + 35 * Math.sin(i / 9) + (r() - 0.5) * 20; base = Math.max(0, Math.min(100, Math.round(base)));
      time.push(t / 1000); cc.push(base); lo.push(Math.round(base * 0.5)); mid.push(Math.round(base * 0.3)); hi.push(Math.round(base * 0.4));
      temp.push(+(9 + 4 * Math.sin((hr - 9) / 24 * 2 * Math.PI) + (r() - 0.5)).toFixed(1));
    }
    var hourly = { time: time, cloud_cover: cc, cloud_cover_low: lo, cloud_cover_mid: mid, cloud_cover_high: hi };
    if (withTemp || /temperature_2m/.test(u)) hourly.temperature_2m = temp;
    return { latitude: PLACE.lat, longitude: PLACE.lon, utc_offset_seconds: 0, timezone: 'Europe/London', hourly: hourly };
  }

  /* ---------- Solar (NOAA SWPC, NASA DONKI) ---------- */
  var REG = [ // numbered active regions on today's disk
    { r: 4262, loc: 'N14W32', cls: 'Ekc', mag: 'Beta-Gamma', area: 520, n: 24, c: 70, m: 30, x: 5 },
    { r: 4265, loc: 'S09E18', cls: 'Dai', mag: 'Beta', area: 260, n: 14, c: 45, m: 10, x: 1 },
    { r: 4266, loc: 'S21W05', cls: 'Cso', mag: 'Beta', area: 110, n: 6, c: 25, m: 5, x: 1 },
    { r: 4268, loc: 'N08E51', cls: 'Hsx', mag: 'Alpha', area: 90, n: 1, c: 10, m: 1, x: 1 },
    { r: 4269, loc: 'N22E07', cls: 'Bxo', mag: 'Beta', area: 20, n: 4, c: 5, m: 1, x: 1 },
  ];
  var FLARE_AT = NOW - 6.2 * HR;
  function xrayLong(t) {
    var b = 1.4e-6 * (1 + 0.25 * Math.sin(t / (2.3 * HR)));
    var dt = (t - FLARE_AT) / MIN; if (dt > -12) b += 1.25e-5 * (dt < 0 ? Math.exp(dt / 4) : Math.exp(-dt / 22));
    var dt2 = (t - (NOW - 15 * HR)) / MIN; if (dt2 > -8) b += 3.6e-6 * (dt2 < 0 ? Math.exp(dt2 / 3) : Math.exp(-dt2 / 14));
    return b;
  }
  function solar(u) {
    var path = new URL(u).pathname.replace(/^\//, ''), r = rng(11), out = [], t, i;
    switch (path) {
      case 'products/noaa-planetary-k-index.json':
        out = [['time_tag', 'Kp', 'a_running', 'station_count']];
        for (t = floorTo(NOW, 3 * HR) - 7 * DAY; t <= NOW - 3 * HR; t += 3 * HR) out.push([sp(t) + '.000', kpRound(kpAt(t)).toFixed(2), '12', '8']);
        return out;
      case 'products/noaa-planetary-k-index-forecast.json': return kpForecast();
      case 'json/rtsw/rtsw_wind_1m.json':
        for (i = 0; i < 1440; i++) { t = floorTo(NOW, MIN) - i * MIN; var h = i / 60;
          out.push({ time_tag: iso(t), active: true, source: 'DSCOVR', proton_speed: +(468 + 60 * Math.exp(-Math.pow((h - 20) / 6, 2)) + 18 * Math.sin(i / 70) + r() * 9).toFixed(1), proton_density: +(4.2 + 2.5 * Math.exp(-Math.pow((h - 22) / 4, 2)) + r() * 0.8).toFixed(2), proton_temperature: Math.round(9e4 + r() * 3e4) }); }
        return out;
      case 'json/rtsw/rtsw_mag_1m.json':
        for (i = 0; i < 1440; i++) { t = floorTo(NOW, MIN) - i * MIN; var bz = 1.5 * Math.sin(i / 37) - 3.2 * Math.exp(-Math.pow((i / 60 - 21) / 3, 2)) + (r() - 0.5) * 1.6;
          out.push({ time_tag: iso(t), active: true, source: 'DSCOVR', bt: +(5.4 + Math.abs(bz) * 0.5 + r()).toFixed(2), bx_gsm: +(r() * 4 - 2).toFixed(2), by_gsm: +(2 + r() * 2).toFixed(2), bz_gsm: +bz.toFixed(2) }); }
        return out;
      case 'json/goes/primary/xrays-1-day.json': case 'json/goes/primary/xrays-3-day.json':
        var n = path.indexOf('3-day') > 0 ? 3 * 1440 : 1440;
        for (i = n; i >= 0; i--) { t = floorTo(NOW, MIN) - i * MIN; var f = xrayLong(t) * (1 + (r() - 0.5) * 0.04);
          out.push({ time_tag: isoZ(t), satellite: 19, flux: f, observed_flux: f, electron_correction: 0, electron_contaminaton: false, energy: '0.1-0.8nm' });
          out.push({ time_tag: isoZ(t), satellite: 19, flux: f * 0.12, observed_flux: f * 0.12, electron_correction: 0, electron_contaminaton: false, energy: '0.05-0.4nm' }); }
        return out;
      case 'json/goes/primary/xray-flares-latest.json':
        return [{ time_tag: isoZ(NOW), begin_time: isoZ(FLARE_AT - 14 * MIN), begin_class: 'C2.1', max_time: isoZ(FLARE_AT), max_class: 'M1.4', max_xrlong: 1.39e-5, end_time: isoZ(FLARE_AT + 31 * MIN), end_class: 'C3.0', current_class: 'C1.6', current_ratio: 0.1, current_int_xrlong: 0.012, satellite: 19 }];
      case 'json/goes/primary/integral-protons-1-day.json':
        for (i = 288; i >= 0; i--) { t = floorTo(NOW, 5 * MIN) - i * 5 * MIN;
          out.push({ time_tag: isoZ(t), satellite: 18, flux: +(0.32 + r() * 0.12).toFixed(3), energy: '>=10 MeV' }); out.push({ time_tag: isoZ(t), satellite: 18, flux: +(0.05 + r() * 0.03).toFixed(3), energy: '>=100 MeV' }); }
        return out;
      case 'json/solar_regions.json':
        var d = new Date(NOW - DAY).toISOString().slice(0, 10);
        return REG.map(function (g) { var m = /^([NS])(\d+)([EW])(\d+)$/.exec(g.loc);
          return { observed_date: d, region: g.r - 10000, latitude: (m[1] === 'S' ? -1 : 1) * +m[2], longitude: (m[3] === 'E' ? -1 : 1) * +m[4], location: g.loc, carrington_longitude: 210, old_corrected_class: null, corrected_class: g.cls, spot_class: g.cls, mag_class: g.mag, area: g.area, extent: 8, number_spots: g.n, c_flare_probability: g.c, m_flare_probability: g.m, x_flare_probability: g.x, proton_probability: 1, c_xray_events: g.r === 4262 ? 4 : 1, m_xray_events: g.r === 4262 ? 1 : 0, x_xray_events: 0, first_date: new Date(NOW - 6 * DAY).toISOString().slice(0, 10), status: 'active' }; });
      case 'products/noaa-scales.json':
        var L = function (dd, r1, g1) { return { DateStamp: new Date(NOW + dd * DAY).toISOString().slice(0, 10), TimeStamp: '00:00:00', R: { Scale: String(r1), Text: r1 ? 'minor' : 'none', MinorProb: '35', MajorProb: '5' }, S: { Scale: '0', Text: 'none', Prob: '1' }, G: { Scale: String(g1), Text: g1 ? 'minor' : 'none' } }; };
        return { '-1': L(0, 1, 0), '0': L(0, 0, 0), '1': L(1, null, 0), '2': L(2, null, 1), '3': L(3, null, 0) };
      case 'json/solar_probabilities.json':
        return [{ date: new Date(NOW).toISOString().slice(0, 10), c_class_1_day: 90, c_class_2_day: 90, c_class_3_day: 85, m_class_1_day: 35, m_class_2_day: 35, m_class_3_day: 30, x_class_1_day: 5, x_class_2_day: 5, x_class_3_day: 5, '10mev_protons_1_day': 1, '10mev_protons_2_day': 1, '10mev_protons_3_day': 1 }];
      case 'products/alerts.json':
        var st = function (tt) { var x = new Date(tt); return x.getUTCFullYear() + ' ' + MON[x.getUTCMonth()] + ' ' + pad(x.getUTCDate()) + ' ' + pad(x.getUTCHours()) + pad(x.getUTCMinutes()) + ' UTC'; };
        return [
          { product_id: 'XM5S', issue_datetime: sp(FLARE_AT + 40 * MIN) + '.000', message: 'Space Weather Message Code: SUMXM5\r\nSerial Number: 1342\r\nIssue Time: ' + st(FLARE_AT + 40 * MIN) + '\r\n\r\nSUMMARY: X-ray Event exceeded M5\r\nBegin Time: ' + st(FLARE_AT - 14 * MIN) + '\r\nMaximum Time: ' + st(FLARE_AT) + '\r\nEnd Time: ' + st(FLARE_AT + 31 * MIN) + '\r\nX-ray Class: M1.4\r\nLocation: N14W32\r\nNOAA Scale: R1 - Minor' },
          { product_id: 'K04A', issue_datetime: sp(NOW - 31 * HR) + '.000', message: 'Space Weather Message Code: ALTK04\r\nSerial Number: 2210\r\nIssue Time: ' + st(NOW - 31 * HR) + '\r\n\r\nALERT: Geomagnetic K-index of 4\r\nThreshold Reached: ' + st(NOW - 31 * HR) + '\r\nSynoptic Period: 0900-1200 UTC\r\n\r\nActive Warning: Yes\r\nNOAA Scale: N/A' },
          { product_id: 'A20F', issue_datetime: sp(NOW - 9 * HR) + '.000', message: 'Space Weather Message Code: WATA20\r\nSerial Number: 1102\r\nIssue Time: ' + st(NOW - 9 * HR) + '\r\n\r\nWATCH: Geomagnetic Storm Category G1 Predicted\r\n\r\nHighest Storm Level Predicted by Day:\r\n' + MON[new Date(NOW + DAY).getUTCMonth()] + ' ' + pad(new Date(NOW + DAY).getUTCDate()) + ':  None (Below G1)   ' + MON[new Date(NOW + 2 * DAY).getUTCMonth()] + ' ' + pad(new Date(NOW + 2 * DAY).getUTCDate()) + ':  G1 (Minor)\r\n\r\nTHIS SUPERSEDES ANY/ALL PRIOR WATCHES IN EFFECT' },
        ];
      case 'json/ovation_aurora_latest.json':
        var co = [];
        for (var lon = 0; lon < 360; lon++) for (var lat = -90; lat <= 90; lat++) {
          var c = 65 + 3.5 * Math.cos((lon - 160) * Math.PI / 180); var v = Math.max(0, 38 * Math.exp(-Math.pow(Math.abs(lat) - c, 2) / 16) - 2);
          co.push([lon, lat, Math.round(v)]); }
        return { 'Observation Time': isoZ(NOW - 10 * MIN), 'Forecast Time': isoZ(NOW + 30 * MIN), 'Data Format': '[Longitude, Latitude, Aurora]', coordinates: co, type: 'MultiPoint' };
      case 'json/solar-cycle/observed-solar-cycle-indices.json':
        for (var y = 1749; y <= new Date(NOW).getUTCFullYear(); y++) for (var mo = 1; mo <= 12; mo++) {
          var tt = Date.UTC(y, mo - 1, 15); if (tt > NOW - 30 * DAY) break;
          var ph = ((y + (mo - 1) / 12) - 2019.9) / 11.1, base = 30 + 110 * Math.pow(Math.max(0, Math.sin(Math.PI * (ph - Math.floor(ph)))), 1.6);
          var ssn = Math.max(0, base + (r() - 0.5) * 30);
          out.push({ 'time-tag': y + '-' + pad(mo), ssn: +ssn.toFixed(1), smoothed_ssn: +base.toFixed(1), observed_swpc_ssn: -1, smoothed_swpc_ssn: -1, 'f10.7': y >= 1947 ? +(65 + ssn * 0.75).toFixed(1) : -1, 'smoothed_f10.7': y >= 1947 ? +(65 + base * 0.75).toFixed(1) : -1 });
        }
        return out;
      case 'json/solar-cycle/predicted-solar-cycle.json':
        for (i = 0; i < 48; i++) { var dt3 = new Date(NOW); dt3.setUTCMonth(dt3.getUTCMonth() + i);
          var p = Math.max(5, 120 * Math.exp(-i / 30)); out.push({ 'time-tag': dt3.getUTCFullYear() + '-' + pad(dt3.getUTCMonth() + 1), predicted_ssn: +p.toFixed(1), high_ssn: +(p * 1.2).toFixed(1), low_ssn: +(p * 0.8).toFixed(1), 'predicted_f10.7': +(65 + p * 0.75).toFixed(1), 'high_f10.7': 0, 'low_f10.7': 0 }); }
        return out;
    }
    return undefined;
  }
  function donki(u) {
    var kind = new URL(u).pathname.split('/').pop(), link = 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/';
    if (kind === 'FLR') return [
      { flrID: 'F1', beginTime: isoM(FLARE_AT - 14 * MIN), peakTime: isoM(FLARE_AT), endTime: isoM(FLARE_AT + 31 * MIN), classType: 'M1.4', sourceLocation: 'N14W32', activeRegionNum: 14262, link: link },
      { flrID: 'F2', beginTime: isoM(NOW - 15.2 * HR), peakTime: isoM(NOW - 15 * HR), endTime: isoM(NOW - 14.6 * HR), classType: 'C5.0', sourceLocation: 'S09E18', activeRegionNum: 14265, link: link },
      { flrID: 'F3', beginTime: isoM(NOW - 3.4 * DAY), peakTime: isoM(NOW - 3.38 * DAY), endTime: isoM(NOW - 3.3 * DAY), classType: 'M2.7', sourceLocation: 'N13W06', activeRegionNum: 14262, link: link },
      { flrID: 'F4', beginTime: isoM(NOW - 9 * DAY), peakTime: isoM(NOW - 8.98 * DAY), endTime: isoM(NOW - 8.9 * DAY), classType: 'X1.1', sourceLocation: 'S15E40', activeRegionNum: 14251, link: link },
      { flrID: 'F5', beginTime: isoM(NOW - 17 * DAY), peakTime: isoM(NOW - 16.98 * DAY), endTime: isoM(NOW - 16.9 * DAY), classType: 'M1.0', sourceLocation: 'N20W60', activeRegionNum: 14244, link: link },
    ];
    if (kind === 'CME') {
      var cme = function (id, t, sp1, loc, ar, arr, kp, gb) { return { activityID: id, startTime: isoM(t), sourceLocation: loc, activeRegionNum: ar, note: 'Halo CME seen in SOHO LASCO C2 and C3 following the flare.', link: link,
        cmeAnalyses: [{ isMostAccurate: true, speed: sp1, type: sp1 > 1000 ? 'O' : 'C', halfAngle: 45, longitude: 12, latitude: 8, enlilList: arr ? [{ estimatedShockArrivalTime: isoM(arr), isEarthGB: !!gb, kp_18: kp - 1, kp_90: kp, kp_135: kp + 1, kp_180: kp + 1, estimatedDuration: 18 }] : [] }] }; };
      return [cme('C1', NOW - 3.3 * DAY, 820, 'N13W06', 14262, NOW + 1.6 * DAY, 5, true), cme('C2', NOW - 9 * DAY, 1450, 'S15E40', 14251, NOW - 7.2 * DAY, 6), cme('C3', NOW - 16.8 * DAY, 540, 'N20W60', 14244, null, 0)];
    }
    if (kind === 'GST') return [{ gstID: 'G1', startTime: isoM(NOW - 7.2 * DAY), allKpIndex: [{ observedTime: isoM(NOW - 7 * DAY), kpIndex: 6.33, source: 'NOAA' }], link: link }];
    return [];
  }

  /* ---------- Overhead (CelesTrak elements) ---------- */
  function sunRA(t) { // degrees, low precision
    var n = t / DAY + 2440587.5 - 2451545, L = (280.46 + 0.9856474 * n) % 360, g = (357.528 + 0.9856003 * n) * Math.PI / 180;
    var lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * Math.PI / 180, eps = 23.439 * Math.PI / 180;
    return (Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) * 180 / Math.PI + 360) % 360;
  }
  var SATS = [ // name, cospar, norad, inclination, mean motion, ecc, RAAN offset from Sun, mean anomaly
    ['ISS (ZARYA)', '1998-067A', 25544, 51.6316, 15.4986, 0.0006, 0, 40],
    ['CSS (TIANHE)', '2021-035A', 48274, 41.4703, 15.6125, 0.0004, 70, 200],
    ['HST', '1990-037B', 20580, 28.4697, 15.2862, 0.0002, 300, 110],
    ['CSS (WENTIAN)', '2022-085A', 53239, 41.4703, 15.6125, 0.0004, 70, 200.3],
    ['SOYUZ-MS 28', '2025-268A', 66003, 51.6316, 15.4986, 0.0006, 0, 40.2],
    ['PROGRESS-MS 32', '2025-180A', 64650, 51.6316, 15.4986, 0.0006, 0, 39.9],
    ['SL-16 R/B', '2004-049B', 28353, 71.0, 14.3, 0.0016, 210, 15],
    ['SL-16 R/B', '1992-093B', 22285, 71.0, 14.35, 0.0011, 160, 250],
    ['COSMOS 2237', '1993-016A', 22566, 71.0, 14.13, 0.0009, 95, 300],
    ['ENVISAT', '2002-009A', 27386, 98.3, 14.38, 0.0001, 85, 170],
    ['SEASAT 1', '1978-064A', 10967, 108.0, 14.1, 0.0006, 20, 60],
    ['H-2A R/B', '2018-084C', 43681, 97.9, 15.0, 0.0010, 250, 320],
  ];
  function omm(s, epoch) {
    var off = s[6]; try { var mh = /raan=(\d+)/.exec(location.hash); if (mh && s[2] === 25544) off = +mh[1]; } catch (e) { }
    var raan = (sunRA(epoch) + off) % 360;
    return { OBJECT_NAME: s[0], OBJECT_ID: s[1], EPOCH: new Date(epoch).toISOString().replace('Z', ''), MEAN_MOTION: s[4], ECCENTRICITY: s[5], INCLINATION: s[3], RA_OF_ASC_NODE: +raan.toFixed(4), ARG_OF_PERICENTER: 90, MEAN_ANOMALY: s[7], EPHEMERIS_TYPE: 0, CLASSIFICATION_TYPE: 'U', NORAD_CAT_ID: s[2], ELEMENT_SET_NO: 999, REV_AT_EPOCH: 50000, BSTAR: 0.00025, MEAN_MOTION_DOT: 0.0001, MEAN_MOTION_DDOT: 0 };
  }
  function celestrak(u) {
    var p = q(u), ep = floorTo(NOW, DAY);
    if (p.CATNR) { var s = SATS.filter(function (x) { return x[2] === +p.CATNR; })[0]; return s ? [omm(s, ep)] : 'No GP data found'; }
    if (p.GROUP === 'stations') return SATS.slice(0, 6).map(function (s) { return omm(s, ep); });
    if (p.GROUP === 'visual') return SATS.map(function (s) { return omm(s, ep); });
    return [];
  }

  /* ---------- Asteroids & Meteors (NASA/JPL) ---------- */
  var LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWXY';
  function desig(t, r) { var d = new Date(t), y = d.getUTCFullYear(), half = d.getUTCMonth() * 2 + (d.getUTCDate() > 15 ? 1 : 0);
    var sub = Math.floor(r() * 9); return y + ' ' + LETTERS[half] + LETTERS[Math.floor(r() * 24)] + (sub ? sub : ''); }
  var ROCKS = null;
  function rocks() { // a fixed set of sample flybys, timed relative to now
    if (ROCKS) return ROCKS;
    var r = rng(42); ROCKS = [];
    var offs = [0.35, 1.2, 2.1, 2.9, 3.6, 4.4, 5.8, 7.1, 8.3, 9.9, 12.4, 14.0, 16.5, 19.2, 22.8, 26.1, 29.7, 33.0, 37.4, 41.2, 45.9, 50.3, 55.8, -0.8, -2.4, -4.1, -6.6, -9.3, -12.7, -16.0, -19.9, -24.1];
    offs.forEach(function (o, i) {
      var t = NOW + o * DAY + Math.floor(r() * 12) * HR, dist = i === 0 ? 0.00107 : 0.0016 + Math.pow(r(), 1.4) * 0.047;
      var disc = t - (5 + r() * 40) * DAY;
      ROCKS.push({ des: i === 4 ? '2001 FO32' : i === 9 ? '2013 WA44' : desig(disc, r), t: t, dist: dist, v: 4 + r() * 19, h: i === 4 ? 17.7 : i === 9 ? 21.0 : 20.5 + r() * 8.2, pha: i === 4 || i === 9 || r() < 0.08, a: 0.85 + r() * 1.6, e: 0.1 + r() * 0.55, i: r() * 18, om: r() * 360, w: r() * 360, ma: r() * 360 });
    });
    return ROCKS;
  }
  var CAD_F = ['des', 'orbit_id', 'jd', 'cd', 'dist', 'dist_min', 'dist_max', 'v_rel', 'v_inf', 't_sigma_f', 'h', 'diameter', 'diameter_sigma', 'fullname'];
  function cadRow(o) { return [o.des, '12', (2440587.5 + o.t / DAY).toFixed(9), cd(o.t), o.dist.toFixed(16), (o.dist * 0.999).toFixed(16), (o.dist * 1.001).toFixed(16), o.v.toFixed(13), (o.v * 0.97).toFixed(13), '< 00:01', o.h.toFixed(1), null, null, '       (' + o.des + ')']; }
  function cadOut(list) { list = list.slice().sort(function (a, b) { return a.t - b.t; }); return { signature: { source: 'NASA/JPL SBDB Close Approach Data API', version: '1.5' }, count: list.length, fields: CAD_F, data: list.map(cadRow) }; }
  function dateArg(s, fallback) { if (!s) return fallback; if (s === 'now') return NOW; var m = /^%?\+?(\d+)$/.exec(s.replace('%2B', '+')); if (m && s.indexOf('-') < 0) return NOW + +m[1] * DAY; var t = Date.parse(s + (s.length <= 10 ? 'T00:00:00Z' : 'Z')); return isNaN(t) ? fallback : t; }
  function jpl(u) {
    var url = new URL(u), path = url.pathname.split('/').pop(), p = q(u);
    if (path === 'cad.api') {
      if (p.des) { var o = rocks().filter(function (x) { return x.des === p.des; })[0]; if (!o) return { count: 0, fields: CAD_F, data: [] };
        var hist = [o]; var rr = rng(o.des.length * 97); for (var k = 1; k < 7; k++) { var t2 = o.t + (k - 3.5) * (2 + rr() * 9) * 365.25 * DAY; hist.push(Object.assign({}, o, { t: t2, dist: o.dist * (2 + rr() * 30) })); }
        return cadOut(hist.filter(function (x) { return x.dist < 0.2; })); }
      var a = dateArg(p['date-min'], NOW), b = dateArg(p['date-max'], NOW + 60 * DAY), dm = +(p['dist-max'] || 0.05);
      var list = rocks().filter(function (x) { return x.t >= a && x.t <= b && x.dist <= dm && (p.pha !== 'true' || x.pha); });
      if (a < NOW - 30 * DAY || b > NOW + 62 * DAY) { // a calendar month/year outside the sample set: make a deterministic month
        var rr2 = rng(Math.floor(a / DAY)), nn = Math.min(400, Math.round((b - a) / DAY * 0.9));
        list = []; for (var j = 0; j < nn; j++) { var tt = a + rr2() * (b - a); list.push({ des: desig(tt - 20 * DAY, rr2), t: tt, dist: 0.002 + Math.pow(rr2(), 1.3) * (dm - 0.002), v: 4 + rr2() * 19, h: 21 + rr2() * 8 }); }
      }
      return cadOut(list);
    }
    if (path === 'sentry.api') {
      var rs = rng(9), names = ['2000 SG344', '2010 RF12', '2005 QK76', '2008 JL3', '2006 JY26', '2023 DO', '2012 HG2', '2017 WT28', '2019 VB37', '2020 VW', '2007 UD6', '2014 HN197', '2018 LX3', '2016 WN55', '2021 EU', '2009 JF1', '2015 JJ', '2022 UF23', '2011 AG5', '2024 TY7'];
      return { signature: { source: 'NASA/JPL Sentry Data API', version: '2.0' }, count: names.length, data: names.map(function (n, i) {
        var ip = Math.pow(10, -2.4 - rs() * 5), y = 2030 + Math.floor(rs() * 90), h = 20 + rs() * 8;
        return { des: n, fullname: '(' + n + ')', id: 'bJ' + i, ip: ip.toExponential(2), ps_cum: (-2.5 - rs() * 6).toFixed(2), ps_max: (-2.8 - rs() * 6).toFixed(2), ts_max: i === 3 ? '1' : '0', n_imp: 1 + Math.floor(rs() * 60), range: y + '-' + (y + Math.floor(rs() * 60)), diameter: (Math.pow(10, -h / 5) * 1329 / Math.sqrt(0.14)).toFixed(3), h: h.toFixed(1), v_inf: (5 + rs() * 15).toFixed(2), last_obs: new Date(NOW - rs() * 3000 * DAY).toISOString().slice(0, 10), last_obs_jd: '0' };
      }) };
    }
    if (path === 'fireball.api') {
      var rf = rng(5), F = ['date', 'energy', 'impact-e', 'lat', 'lat-dir', 'lon', 'lon-dir', 'alt', 'vel'], a2 = dateArg(p['date-min'], NOW - 400 * DAY), b2 = dateArg(p['date-max'], NOW), rows = [];
      var lim = +(p.limit || 0) || 999;
      for (var tf = Math.min(b2, NOW) - rf() * 9 * DAY; tf > a2 && rows.length < lim; tf -= (4 + rf() * 18) * DAY) {
        rows.push([sp(tf), (2 + rf() * 60).toFixed(1), (0.08 + rf() * 1.2).toFixed(2), (rf() * 70).toFixed(1), rf() < 0.5 ? 'N' : 'S', (rf() * 180).toFixed(1), rf() < 0.5 ? 'E' : 'W', (20 + rf() * 30).toFixed(1), (13 + rf() * 15).toFixed(1)]); }
      return { signature: { source: 'NASA/JPL Fireball Data API', version: '1.2' }, count: rows.length, fields: F, data: rows };
    }
    if (path === 'sbdb.api') {
      var o2 = rocks().filter(function (x) { return x.des === p.sstr; })[0]; if (!o2) return { message: 'specified object was not found', code: '200' };
      var ep = 2440587.5 + floorTo(NOW, DAY) / DAY;
      var el = { e: o2.e, a: o2.a, q: o2.a * (1 - o2.e), i: o2.i, om: o2.om, w: o2.w, ma: o2.ma, n: 0.9856076686 / Math.pow(o2.a, 1.5), per: 365.25 * Math.pow(o2.a, 1.5), ad: o2.a * (1 + o2.e) };
      var cls = o2.a < 1 ? ['ATE', 'Aten'] : o2.a * (1 - o2.e) < 1.017 ? ['APO', 'Apollo'] : ['AMO', 'Amor'];
      return { object: { fullname: '(' + o2.des + ')', des: o2.des, pha: !!o2.pha, neo: true, orbit_class: { code: cls[0], name: cls[1] } },
        orbit: { epoch: String(ep), moid: (o2.dist * 0.6).toFixed(5), condition_code: '4', n_obs_used: 120, data_arc: '42', first_obs: new Date(o2.t - 40 * DAY).toISOString().slice(0, 10), last_obs: new Date(NOW - 2 * DAY).toISOString().slice(0, 10),
          elements: Object.keys(el).map(function (k) { return { name: k, value: String(el[k]) }; }) },
        phys_par: [{ name: 'H', value: o2.h.toFixed(1) }], discovery: null };
    }
    return undefined;
  }

  /* ---------- router ---------- */
  function mock(u) {
    var host = ''; try { host = new URL(u, location.href).hostname; } catch (e) { }
    if (/services\.swpc\.noaa\.gov/.test(host)) return solar(u);
    if (/ccmc\.gsfc\.nasa\.gov/.test(host)) return donki(u);
    if (/api\.open-meteo\.com/.test(host)) return clouds(u);
    if (/geocoding-api\.open-meteo\.com/.test(host)) return { results: [{ name: 'London', latitude: PLACE.lat, longitude: PLACE.lon, admin1: 'England', country: 'United Kingdom', timezone: 'Europe/London' }] };
    if (/bigdatacloud|nominatim/.test(host)) return { city: 'London', locality: 'London', principalSubdivision: 'England', countryName: 'United Kingdom', countryCode: 'GB', address: { city: 'London', country: 'United Kingdom' }, display_name: 'London, England, United Kingdom' };
    if (/celestrak\.org/.test(host) && /gp\.php/.test(u)) return celestrak(u);
    if (/ssd-api\.jpl\.nasa\.gov/.test(host)) return jpl(u);
    return undefined;
  }
  function respond(u) {
    var body = mock(u);
    if (body === undefined) return null;
    return typeof body === 'string' ? body : JSON.stringify(body);
  }
  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  // Real data first (works on a normal website); sample data when the host blocks it (the Claude preview)
  var LIVE_OK = true;
  function live(u) {
    if (!LIVE_OK || !realFetch) return Promise.reject(new Error('off'));
    var ctl = window.AbortController ? new AbortController() : null, tm = setTimeout(function () { if (ctl) ctl.abort(); }, 9000);
    return realFetch(u, ctl ? { signal: ctl.signal } : undefined).then(function (r) {
      clearTimeout(tm); if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text().then(function (t) { if (!t || /^\s*</.test(t)) throw new Error('not data'); try { window.parent.postMessage({ demoLive: APP }, '*'); } catch (e) { } return t; });
    }, function (e) { clearTimeout(tm); throw e; });
  }
  window.fetch = function (input, init) {
    var u = typeof input === 'string' ? input : input && input.url;
    var abs; try { abs = new URL(u, location.href); } catch (e) { abs = null; }
    if (abs && abs.origin === location.origin) return realFetch(input, init);
    var href = abs ? abs.href : u;
    return live(href).then(function (t) { return new Response(t, { status: 200, headers: { 'Content-Type': 'application/json' } }); }, function () {
      var b = respond(href);
      return b == null ? new Response('Not available', { status: 404 }) : new Response(b, { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
  };
  window.__MOCK = function (u) { // Overhead / Asteroids hook
    return live(u).catch(function () { var b = respond(u); if (b == null) throw new Error('HTTP 404'); return b; });
  };

  /* ---------- pictures of the Sun: local sample image ---------- */
  var desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (desc && desc.set) Object.defineProperty(HTMLImageElement.prototype, 'src', {
    get: desc.get, configurable: true,
    set: function (v) {
      var sv = String(v);
      if (/sdo\.gsfc\.nasa\.gov|helioviewer\.org/.test(sv) && !this.__demoFb) {
        var img = this, fb = /HMIIF|continuum/.test(sv) ? 'demo-sun.jpg' : 'demo-sun-uv.jpg';
        this.addEventListener('error', function onErr() { img.removeEventListener('error', onErr); img.__demoFb = true; desc.set.call(img, fb); });
      }
      desc.set.call(this, v);
    },
  });

  /* ---------- links out: open in a new tab, never navigate the phone ---------- */
  window.open = (function (o) { return function (u) { try { return o.call(window, u, '_blank', 'noopener'); } catch (e) { return null; } }; })(window.open);
})();
