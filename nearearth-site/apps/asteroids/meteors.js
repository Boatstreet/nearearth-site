/* Meteors tab: the shower that's active now, drawn on your own sky with meteors streaming from its real radiant at its real speed,
   plus live rates, best time tonight, the Moon, upcoming peaks and the latest fireballs from NASA/JPL (CNEOS). */
(function () {
'use strict';
var DEG = Math.PI / 180, DAY = 86400000, EPS = 23.4393 * DEG;
var api, box, cv, g, W = 0, H = 0, dpr = 1, raf = 0, active = false, last = 0;
var bg = document.createElement('canvas'), fg = document.createElement('canvas');
var M = { sel: null, preview: null, sc: null, built: 0, meteors: [], trains: [], acc: 0, fb: null, fbErr: null, pending: null };

/* IMO working list, J2000 solar longitudes: a = start, p = peak, b = end. ra/dec radiant at peak with daily drift. */
var SH = [
  { c: 'QUA', n: 'Quadrantids', a: 276, p: 283.15, b: 291, z: 80, ra: 230, dec: 49, dra: 0.8, ddec: -0.2, v: 41, con: 'Boötes', par: 'asteroid 2003 EH1', pid: '2003 EH1', B: [1.2, 1.2] },
  { c: 'ACE', n: 'Alpha Centaurids', a: 311, p: 319.2, b: 331, z: 6, ra: 210, dec: -59, dra: 1.2, ddec: -0.3, v: 58, con: 'Centaurus' },
  { c: 'LYR', n: 'Lyrids', a: 24, p: 32.32, b: 40, z: 18, ra: 271, dec: 34, dra: 1.1, ddec: 0, v: 49, con: 'Lyra', par: 'comet C/1861 G1 Thatcher', B: [0.22, 0.6] },
  { c: 'ETA', n: 'Eta Aquariids', a: 29, p: 45.5, b: 67, z: 50, ra: 338, dec: -1, dra: 0.9, ddec: 0.4, v: 66, con: 'Aquarius', par: 'comet 1P/Halley', pid: '1P', B: [0.08, 0.08] },
  { c: 'ARI', n: 'Daytime Arietids', a: 53, p: 76.5, b: 93, z: 30, ra: 44, dec: 24, dra: 1.0, ddec: 0.3, v: 38, con: 'Aries', day: true },
  { c: 'CAP', n: 'Alpha Capricornids', a: 101, p: 127, b: 143, z: 5, ra: 307, dec: -10, dra: 0.9, ddec: 0.3, v: 23, con: 'Capricornus', par: 'comet 169P/NEAT', pid: '169P', fb: true },
  { c: 'SDA', n: 'Southern Delta Aquariids', a: 110, p: 127, b: 150, z: 25, ra: 340, dec: -16, dra: 0.8, ddec: 0.2, v: 41, con: 'Aquarius', par: 'comet 96P/Machholz', pid: '96P' },
  { c: 'PER', n: 'Perseids', a: 115, p: 140.0, b: 151, z: 100, ra: 48, dec: 58, dra: 1.35, ddec: 0.12, v: 59, con: 'Perseus', par: 'comet 109P/Swift–Tuttle', pid: '109P', B: [0.2, 0.4] },
  { c: 'AUR', n: 'Aurigids', a: 155, p: 158.6, b: 163, z: 6, ra: 91, dec: 39, dra: 1.1, ddec: 0, v: 66, con: 'Auriga', par: 'comet C/1911 N1 Kiess' },
  { c: 'SPE', n: 'September Epsilon Perseids', a: 162, p: 166.7, b: 178, z: 5, ra: 48, dec: 40, dra: 1.0, ddec: 0.2, v: 64, con: 'Perseus' },
  { c: 'STA', n: 'Southern Taurids', a: 167, p: 197, b: 238, z: 5, ra: 32, dec: 9, dra: 0.8, ddec: 0.3, v: 27, con: 'Cetus', par: 'comet 2P/Encke', pid: '2P', fb: true },
  { c: 'DRA', n: 'Draconids', a: 192.6, p: 195.4, b: 196.6, z: 10, ra: 262, dec: 54, dra: 0, ddec: 0, v: 20, con: 'Draco', par: 'comet 21P/Giacobini–Zinner', pid: '21P' },
  { c: 'ORI', n: 'Orionids', a: 189, p: 208, b: 225, z: 20, ra: 95, dec: 16, dra: 0.7, ddec: 0.1, v: 66, con: 'Orion', par: 'comet 1P/Halley', pid: '1P', B: [0.12, 0.13] },
  { c: 'NTA', n: 'Northern Taurids', a: 207, p: 230, b: 258, z: 5, ra: 58, dec: 22, dra: 0.8, ddec: 0.2, v: 29, con: 'Taurus', par: 'comet 2P/Encke', pid: '2P', fb: true },
  { c: 'LEO', n: 'Leonids', a: 223, p: 235.27, b: 248, z: 15, ra: 152, dec: 22, dra: 0.7, ddec: -0.4, v: 71, con: 'Leo', par: 'comet 55P/Tempel–Tuttle', pid: '55P', B: [0.35, 0.35] },
  { c: 'AMO', n: 'Alpha Monocerotids', a: 232, p: 239.32, b: 243, z: 5, ra: 117, dec: 1, dra: 1.1, ddec: -0.1, v: 65, con: 'Canis Minor' },
  { c: 'GEM', n: 'Geminids', a: 252, p: 262.2, b: 268, z: 150, ra: 112, dec: 33, dra: 1.0, ddec: -0.1, v: 35, con: 'Gemini', par: 'asteroid 3200 Phaethon', pid: '3200', B: [0.39, 0.81] },
  { c: 'URS', n: 'Ursids', a: 265, p: 270.7, b: 274, z: 10, ra: 217, dec: 76, dra: 0, ddec: 0, v: 33, con: 'Ursa Minor', par: 'comet 8P/Tuttle', pid: '8P', B: [0.6, 0.9] }
];

/* ---------- astronomy ---------- */
function mod(x) { return ((x % 360) + 360) % 360; }
function w180(x) { return mod(x + 180) - 180; }
function dn(ms) { return ms / DAY + 2440587.5 - 2451545.0; }
function sunLonDate(ms) { var n = dn(ms), L = 280.460 + 0.9856474 * n, q = (357.528 + 0.9856003 * n) * DEG; return mod(L + 1.915 * Math.sin(q) + 0.020 * Math.sin(2 * q)); }
function solLon(ms) { return mod(sunLonDate(ms) - 0.01397 * dn(ms) / 365.25); }   // J2000, as the IMO lists them
function timeOfLon(lam, near) { var t = near; for (var i = 0; i < 4; i++) t += w180(lam - solLon(t)) / 0.98565 * DAY; return t; }
function radiant(s, ms) { var d = w180(solLon(ms) - s.p); return { ra: mod(s.ra + s.dra * d), dec: Math.max(-89, Math.min(89, s.dec + s.ddec * d)) }; }
function zhr(s, ms) {
  var d = w180(solLon(ms) - s.p), a = w180(s.a - s.p), b = w180(s.b - s.p); if (d < a || d > b) return 0;
  var B = d < 0 ? (s.B ? s.B[0] : Math.max(0.05, 2 / -a)) : (s.B ? s.B[1] : Math.max(0.05, 2 / b));
  return s.z * Math.pow(10, -B * Math.abs(d));
}
function peakNear(s, ms) { return timeOfLon(s.p, ms); }
function nextPeak(s, ms) { var t = timeOfLon(s.p, ms); if (t < ms - DAY) t = timeOfLon(s.p, t + 365.25 * DAY); return t; }
function windowOf(s, tp) { return [tp + w180(s.a - s.p) / 0.98565 * DAY, tp + w180(s.b - s.p) / 0.98565 * DAY]; }
function gmst(ms) { return mod(280.46061837 + 360.98564736629 * dn(ms)); }
function hor(ra, dec, ms, loc) {
  var h = (gmst(ms) + loc.lon - ra) * DEG, d = dec * DEG, f = loc.lat * DEG;
  var sa = Math.sin(f) * Math.sin(d) + Math.cos(f) * Math.cos(d) * Math.cos(h);
  var az = Math.atan2(-Math.sin(h) * Math.cos(d), Math.cos(f) * Math.sin(d) - Math.sin(f) * Math.cos(d) * Math.cos(h));
  return { alt: Math.asin(Math.max(-1, Math.min(1, sa))) / DEG, az: mod(az / DEG) };
}
function eclToEq(l, b) { l *= DEG; b *= DEG; return { ra: mod(Math.atan2(Math.sin(l) * Math.cos(EPS) - Math.tan(b) * Math.sin(EPS), Math.cos(l)) / DEG), dec: Math.asin(Math.sin(b) * Math.cos(EPS) + Math.cos(b) * Math.sin(EPS) * Math.sin(l)) / DEG }; }
function sunEq(ms) { return eclToEq(sunLonDate(ms), 0); }
function moon(ms) {
  var d = dn(ms), L = 218.316 + 13.176396 * d, Mm = 134.963 + 13.064993 * d, F = 93.272 + 13.229350 * d, D = 297.850 + 12.190749 * d, Ms = 357.529 + 0.98560028 * d;
  var lam = mod(L + 6.289 * Math.sin(Mm * DEG) + 1.274 * Math.sin((2 * D - Mm) * DEG) + 0.658 * Math.sin(2 * D * DEG) - 0.186 * Math.sin(Ms * DEG)), bet = 5.128 * Math.sin(F * DEG);
  var el = w180(lam - sunLonDate(ms)), cpsi = Math.cos(bet * DEG) * Math.cos(el * DEG), eq = eclToEq(lam, bet);
  return { ra: eq.ra, dec: eq.dec, k: (1 - cpsi) / 2, wax: el > 0 };
}
function vec(alt, az) { var a = alt * DEG, z = az * DEG; return [Math.cos(a) * Math.sin(z), Math.cos(a) * Math.cos(z), Math.sin(a)]; }
function altOf(v) { return Math.asin(Math.max(-1, Math.min(1, v[2]))) / DEG; }
function compass(az) { return ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(mod(az) / 22.5) % 16]; }

/* how many you'd see, and when it's best */
function rate(s, ms, loc) {
  var z = zhr(s, ms), r = radiant(s, ms), h = hor(r.ra, r.dec, ms, loc), sun = sunEq(ms), sh = hor(sun.ra, sun.dec, ms, loc).alt;
  var mo = moon(ms), mh = hor(mo.ra, mo.dec, ms, loc).alt, moonF = mh > 0 ? 1 - 0.55 * mo.k : 1;
  var dark = sh < -12 ? 1 : sh < -6 ? 0.35 : 0;
  return { zhr: z, alt: h.alt, az: h.az, hr: z * Math.max(0, Math.sin(h.alt * DEG)) * moonF * dark, sun: sh, moonAlt: mh, moon: mo };
}
function bestTime(s, from, loc) {
  var pts = [], top = null;
  for (var t = from; t <= from + DAY; t += 10 * 60000) { var r = rate(s, t, loc); r.t = t; pts.push(r); if (!top || r.hr > top.hr) top = r; }
  if (!top || top.hr < 0.05) return null;
  var i = pts.indexOf(top), a = i, b = i; while (a > 0 && pts[a - 1].hr >= top.hr * 0.7) a--; while (b < pts.length - 1 && pts[b + 1].hr >= top.hr * 0.7) b++;
  return { t: top.t, from: pts[a].t, to: pts[b].t, hr: top.hr, alt: top.alt };
}
function riseAfter(s, ms, loc) { for (var t = ms; t < ms + DAY; t += 10 * 60000) { var r = radiant(s, t); if (hor(r.ra, r.dec, t, loc).alt > 0) return t; } return null; }

/* ---------- which shower, which sky ---------- */
function activeList(ms) { return SH.filter(function (s) { return !s.day && zhr(s, ms) >= 0.5; }).sort(function (a, b) { return zhr(b, ms) - zhr(a, ms); }); }
function getLoc() {
  var l = api.ls('skyLoc'); if (l && l.lat != null) return { lat: l.lat, lon: l.lon, approx: false };
  var lon = Math.max(-170, Math.min(170, -new Date(api.now()).getTimezoneOffset() / 4));
  return { lat: 40, lon: lon, approx: true };
}
function scene() {
  var now = api.now(), loc = getLoc(), act = activeList(now);
  var s = M.sel || act[0] || null, mode = 'live', t = now, best = null;
  if (s && s.dec < -25 && loc.approx) loc.lat = -30;
  if (M.preview) { t = M.preview; best = s ? bestTime(s, t - DAY / 2, loc) : null; if (best) t = best.t; mode = 'preview'; }
  else {
    var sun = sunEq(now), sh = hor(sun.ra, sun.dec, now, loc).alt;
    if (s) best = bestTime(s, now, loc);
    var rn = s ? rate(s, now, loc) : null;
    // daylight, or the radiant still too low to show much: show the best moment tonight instead
    if (sh > -10 || (rn && best && rn.alt < 12 && best.t - now > 1800000)) { if (best) { t = best.t; mode = 'tonight'; } else if (sh > -10) { t = darkAfter(now, loc); mode = 'tonight'; } }
  }
  var r = s ? radiant(s, t) : null, rh = r ? hor(r.ra, r.dec, t, loc) : null, mo = moon(t), mh = hor(mo.ra, mo.dec, t, loc), sun2 = sunEq(t);
  var az0 = rh ? rh.az : 180, alt0 = rh ? Math.max(24, Math.min(48, rh.alt - 8)) : 32;   // radiant sits a little above the middle, clear of the title
  return { s: s, t: t, mode: mode, loc: loc, act: act, best: best, rad: r, rh: rh, moon: mo, mh: mh, sunAlt: hor(sun2.ra, sun2.dec, t, loc).alt, az0: az0, alt0: alt0, built: now };
}
function darkAfter(ms, loc) { for (var t = ms; t < ms + DAY; t += 15 * 60000) { var s = sunEq(t); if (hor(s.ra, s.dec, t, loc).alt < -15) return t + 2 * 3600000; } return ms; }

/* ---------- projection ---------- */
var CAM = { f: [0, 1, 0], r: [1, 0, 0], u: [0, 0, 1], S: 100, cx: 0, cy: 0 };
function setCam(sc) {
  var a = sc.alt0 * DEG, z = sc.az0 * DEG;
  CAM.f = [Math.cos(a) * Math.sin(z), Math.cos(a) * Math.cos(z), Math.sin(a)];
  CAM.r = [Math.cos(z), -Math.sin(z), 0];
  CAM.u = [CAM.r[1] * CAM.f[2] - CAM.r[2] * CAM.f[1], CAM.r[2] * CAM.f[0] - CAM.r[0] * CAM.f[2], CAM.r[0] * CAM.f[1] - CAM.r[1] * CAM.f[0]];
  var hfov = Math.max(80, Math.min(110, 100 * W / Math.max(1, H) / 1.25));
  CAM.S = (W / 2) / (2 * Math.tan(hfov / 4 * DEG)); CAM.cx = W / 2; CAM.cy = H * 0.5;
}
function proj(v) {
  var z = v[0] * CAM.f[0] + v[1] * CAM.f[1] + v[2] * CAM.f[2]; if (z < -0.3) return null;
  var k = 2 / (1 + z) * CAM.S;
  return [CAM.cx + (v[0] * CAM.r[0] + v[1] * CAM.r[1] + v[2] * CAM.r[2]) * k, CAM.cy - (v[0] * CAM.u[0] + v[1] * CAM.u[1] + v[2] * CAM.u[2]) * k];
}
function eqVec(ra, dec, ms, loc) { var h = hor(ra, dec, ms, loc); return vec(h.alt, h.az); }

/* ---------- the static sky (rebuilt every half minute) ---------- */
function hill(az) { var a = az * DEG; var h = 1.3 + 1.0 * Math.sin(3 * a + 1) + 0.6 * Math.sin(7 * a + 2) + 0.3 * Math.sin(17 * a); var tr = Math.sin(5 * a + 0.7); if (tr > 0.45) h += (tr - 0.45) * 3 * (0.6 + 0.4 * Math.pow(Math.abs(Math.sin(70 * a)), 2)); return Math.max(0.4, h); }
function build() {
  var sc = M.sc; setCam(sc);
  [bg, fg].forEach(function (c) { c.width = W * dpr; c.height = H * dpr; });
  var b = bg.getContext('2d'); b.setTransform(dpr, 0, 0, dpr, 0, 0);
  var hz = proj(vec(0, sc.az0)), hy = hz ? hz[1] : H * 0.9;
  var tw = sc.sunAlt > -18 ? Math.min(1, (sc.sunAlt + 18) / 12) : 0, ml = sc.mh.alt > 0 ? sc.moon.k : 0;
  var gr = b.createLinearGradient(0, 0, 0, hy);
  gr.addColorStop(0, '#02030a'); gr.addColorStop(0.6, mix('#060a1c', '#1a2a52', tw * 0.6 + ml * 0.25)); gr.addColorStop(1, mix('#0f1a36', '#3a4f80', tw * 0.7 + ml * 0.3));
  b.fillStyle = gr; b.fillRect(0, 0, W, H);
  // stars, constellation lines
  var SD = window.SKYDATA, lim = 5.9 - ml * 1.6 - tw * 2.5;
  if (SD) {
    b.strokeStyle = 'rgba(169,156,255,0.11)'; b.lineWidth = 0.8;
    SD.l.forEach(function (line) { b.beginPath(); var on = false; line.forEach(function (p) { var v = eqVec(p[0], p[1], sc.t, sc.loc), q = v[2] > -0.02 ? proj(v) : null; if (q) { on ? b.lineTo(q[0], q[1]) : b.moveTo(q[0], q[1]); on = true; } else on = false; }); b.stroke(); });
    var s = SD.s;
    for (var i = 0; i < s.length; i += 4) {
      var mg = s[i + 2]; if (mg > lim) continue;
      var v = eqVec(s[i], s[i + 1], sc.t, sc.loc); if (v[2] < 0) continue; var q = proj(v); if (!q || q[0] < -4 || q[0] > W + 4 || q[1] < -4 || q[1] > H) continue;
      var ext = Math.min(1, altOf(v) / 10 + 0.15), r = Math.max(0.35, Math.min(2.6, 0.45 + (lim - mg) * 0.36)), bv = s[i + 3];
      var col = bv < 0 ? '207,224,255' : bv < 0.5 ? '244,246,255' : bv < 1.1 ? '255,241,216' : '255,210,168';
      b.fillStyle = 'rgba(' + col + ',' + Math.min(1, (0.35 + (lim - mg) * 0.22) * ext).toFixed(2) + ')';
      b.beginPath(); b.arc(q[0], q[1], r, 0, 7); b.fill();
      if (mg < 1.2) { var hg = b.createRadialGradient(q[0], q[1], 0, q[0], q[1], r * 5); hg.addColorStop(0, 'rgba(' + col + ',' + (0.22 * ext).toFixed(2) + ')'); hg.addColorStop(1, 'rgba(' + col + ',0)'); b.fillStyle = hg; b.beginPath(); b.arc(q[0], q[1], r * 5, 0, 7); b.fill(); }
    }
  }
  // the Moon, if it's up and in view
  if (sc.mh.alt > -1) { var mq = proj(vec(sc.mh.alt, sc.mh.az)); if (mq && mq[0] > -40 && mq[0] < W + 40) drawMoon(b, mq[0], mq[1], 7, sc.moon); }
  // horizon glow
  var hgr = b.createLinearGradient(0, hy - 70, 0, hy + 4); hgr.addColorStop(0, 'rgba(70,90,150,0)'); hgr.addColorStop(1, 'rgba(70,90,150,' + (0.22 + tw * 0.3).toFixed(2) + ')');
  b.fillStyle = hgr; b.fillRect(0, hy - 70, W, 74);
  // ground silhouette: hills and a tree line, fixed to real azimuths
  var f = fg.getContext('2d'); f.setTransform(dpr, 0, 0, dpr, 0, 0); f.clearRect(0, 0, W, H);
  f.beginPath(); var first = true;
  for (var az = sc.az0 - 95; az <= sc.az0 + 95; az += 0.4) { var p = proj(vec(hill(az), az)); if (!p) continue; first ? f.moveTo(p[0], p[1]) : f.lineTo(p[0], p[1]); first = false; }
  f.lineTo(W + 10, H + 10); f.lineTo(-10, H + 10); f.closePath();
  var gg = f.createLinearGradient(0, hy - 30, 0, H); gg.addColorStop(0, '#070912'); gg.addColorStop(1, '#020306'); f.fillStyle = gg; f.fill();
  f.strokeStyle = 'rgba(120,140,200,.10)'; f.lineWidth = 1; f.stroke();
  // compass ticks on the horizon
  f.font = '600 10px system-ui'; f.textAlign = 'center'; f.fillStyle = 'rgba(200,210,235,.55)';
  for (var c = 0; c < 360; c += 45) { if (Math.abs(w180(c - sc.az0)) > 70) continue; var cp = proj(vec(-2.5, c)); if (cp) f.fillText(compass(c), cp[0], Math.min(H - 6, cp[1] + 8)); }
  M.built = api.now();
}
function drawMoon(b, x, y, r, mo) {
  var gl = b.createRadialGradient(x, y, 0, x, y, r * 7); gl.addColorStop(0, 'rgba(220,230,255,' + (0.25 * mo.k).toFixed(2) + ')'); gl.addColorStop(1, 'rgba(220,230,255,0)');
  b.fillStyle = gl; b.beginPath(); b.arc(x, y, r * 7, 0, 7); b.fill();
  b.fillStyle = '#20232e'; b.beginPath(); b.arc(x, y, r, 0, 7); b.fill();
  var side = mo.wax ? 1 : -1, ex = r * Math.abs(1 - 2 * mo.k);
  b.fillStyle = '#e9ecf4'; b.beginPath(); b.arc(x, y, r, -Math.PI / 2, Math.PI / 2, side < 0);
  b.ellipse(x, y, ex, r, 0, Math.PI / 2, -Math.PI / 2, (mo.k > 0.5) === (side > 0)); b.fill();
}
function mix(a, b, t) { t = Math.max(0, Math.min(1, t)); var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); var r = Math.round((pa >> 16) * (1 - t) + (pb >> 16) * t), gg = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t), bb = Math.round((pa & 255) * (1 - t) + (pb & 255) * t); return 'rgb(' + r + ',' + gg + ',' + bb + ')'; }

/* ---------- meteors ---------- */
function colours(v) { return v >= 55 ? ['150,255,205', '236,255,246'] : v >= 40 ? ['190,215,255', '255,255,255'] : ['255,196,120', '255,240,214']; }
function radVec() { var sc = M.sc; return sc.rh ? vec(sc.rh.alt, sc.rh.az) : null; }
function spawn(fire, sporadic) {
  var sc = M.sc, R = sporadic ? null : radVec(), v = sporadic || !sc.s ? 20 + Math.random() * 45 : sc.s.v;
  if (!R) { var ra = Math.random() * 360, ral = -60 + Math.random() * 100; R = vec(ral, ra); }
  for (var tries = 0; tries < 14; tries++) {
    var x = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5], dot = x[0] * R[0] + x[1] * R[1] + x[2] * R[2];
    var q = [x[0] - dot * R[0], x[1] - dot * R[1], x[2] - dot * R[2]], ql = Math.hypot(q[0], q[1], q[2]); if (ql < 1e-3) continue; q = [q[0] / ql, q[1] / ql, q[2] / ql];
    var d0 = (3 + Math.pow(Math.random(), 0.8) * 62) * DEG, len = (5 + Math.random() * 18) * DEG * (fire ? 1.6 : 1);
    var p0 = at(R, q, d0), p1 = at(R, q, d0 + len);
    if (altOf(p0) < 6 && altOf(p1) < 6) continue;
    var s0 = proj(p0), s1 = proj(p1); if (!s0 || !s1) continue;
    if ((s0[0] < 0 || s0[0] > W || s0[1] < 0 || s0[1] > H) && (s1[0] < 0 || s1[0] > W || s1[1] < 0 || s1[1] > H)) continue;
    var w = (8 + 0.42 * v) * Math.max(0.35, Math.sin(d0 + len / 2)) + 4, mag = fire ? -4 - Math.random() * 3 : 3.2 - Math.pow(Math.random(), 1.6) * 5;
    M.meteors.push({ R: R, q: q, d0: d0, len: len, t: 0, dur: Math.max(0.18, Math.min(fire ? 2.2 : 1.5, len / DEG / w * (fire ? 1.3 : 1))), mag: mag, fire: !!fire, col: colours(v), v: v });
    return true;
  }
  return false;
}
function at(R, q, d) { var c = Math.cos(d), s = Math.sin(d); return [R[0] * c + q[0] * s, R[1] * c + q[1] * s, R[2] * c + q[2] * s]; }
function drawMeteor(m, dt) {
  m.t += dt; var p = m.t / m.dur; if (p >= 1) { if (m.fire || m.mag < -1.5) train(m); return false; }
  var dh = m.d0 + m.len * p, dt0 = Math.max(m.d0, dh - m.len * (m.fire ? 0.6 : 0.42));
  var h = proj(at(m.R, m.q, dh)), tl = proj(at(m.R, m.q, dt0)); if (!h || !tl) return true;
  var bright = Math.pow(Math.sin(Math.PI * Math.min(1, p * 1.08)), 0.55), wdt = m.fire ? 3.4 : Math.max(0.7, Math.min(2.4, 0.9 + (2.5 - m.mag) * 0.3));
  if (m.fire && p > 0.55) bright *= 1 + 0.6 * Math.max(0, Math.sin(p * 40)); // flaring as it breaks up
  var gr = g.createLinearGradient(tl[0], tl[1], h[0], h[1]);
  gr.addColorStop(0, 'rgba(' + m.col[0] + ',0)'); gr.addColorStop(0.7, 'rgba(' + m.col[0] + ',' + (0.35 * bright).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(' + m.col[1] + ',' + Math.min(1, bright).toFixed(3) + ')');
  g.strokeStyle = gr; g.lineCap = 'round'; g.lineWidth = wdt; g.beginPath(); g.moveTo(tl[0], tl[1]); g.lineTo(h[0], h[1]); g.stroke();
  var hr = m.fire ? 16 : 3 + wdt * 1.6, hg = g.createRadialGradient(h[0], h[1], 0, h[0], h[1], hr);
  hg.addColorStop(0, 'rgba(' + m.col[1] + ',' + Math.min(1, bright).toFixed(3) + ')'); hg.addColorStop(0.3, 'rgba(' + m.col[0] + ',' + (0.35 * bright).toFixed(3) + ')'); hg.addColorStop(1, 'rgba(' + m.col[0] + ',0)');
  g.fillStyle = hg; g.beginPath(); g.arc(h[0], h[1], hr, 0, 7); g.fill();
  if (m.fire && p > 0.7 && Math.random() < 0.5) { var sp = proj(at(m.R, m.q, dh - Math.random() * m.len * 0.15)); if (sp) { g.fillStyle = 'rgba(' + m.col[1] + ',.8)'; g.fillRect(sp[0] + (Math.random() - 0.5) * 8, sp[1] + (Math.random() - 0.5) * 8, 1.6, 1.6); } }
  return true;
}
function train(m) { var pts = []; for (var i = 0; i <= 14; i++) { var s = proj(at(m.R, m.q, m.d0 + m.len * (0.35 + 0.65 * i / 14))); if (s) pts.push(s); } if (pts.length > 2) M.trains.push({ pts: pts, t: 0, dur: m.fire ? 3.2 : 1.4, a: m.fire ? 0.38 : 0.16, col: m.col[0] }); }
function drawTrain(tr, dt) {
  tr.t += dt; var p = tr.t / tr.dur; if (p >= 1) return false; var a = tr.a * (1 - p) * (1 - p);
  g.strokeStyle = 'rgba(' + tr.col + ',' + a.toFixed(3) + ')'; g.lineWidth = 1.2 + p * 3; g.beginPath();
  tr.pts.forEach(function (q, i) { var dx = Math.sin(i * 0.9 + tr.t * 1.3) * p * 6, dy = Math.cos(i * 0.7) * p * 3; i ? g.lineTo(q[0] + dx, q[1] + dy) : g.moveTo(q[0] + dx, q[1] + dy); }); g.stroke();
  return true;
}
function animRate() { var sc = M.sc; if (!sc.s) return 0; var r = rate(sc.s, sc.t, sc.loc), hr = sc.s.z && r.zhr ? r.zhr * Math.max(0.12, Math.sin(Math.max(0, r.alt) * DEG)) : 0; return Math.max(0.5, Math.min(6, 0.6 + hr / 9)); }

function frame(t) {
  if (!active) return; raf = requestAnimationFrame(frame);
  var dt = Math.min(0.1, (t - (last || t)) / 1000); last = t; if (document.hidden) return;
  var r = box.getBoundingClientRect(); if (r.width !== W || r.height !== H) { resize(); return; }
  if (!M.sc || (M.sc.mode === 'live' && api.now() - M.built > 30000)) { refreshScene(); return; }
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.drawImage(bg, 0, 0, W, H);
  // radiant
  var sc = M.sc, rp = sc.rh && sc.rh.alt > -3 ? proj(vec(sc.rh.alt, sc.rh.az)) : null;
  if (rp) {
    var pu = 0.5 + 0.5 * Math.sin(t / 600); g.strokeStyle = 'rgba(169,156,255,' + (0.35 + 0.3 * pu).toFixed(2) + ')'; g.lineWidth = 1.2;
    g.setLineDash([3, 4]); g.beginPath(); g.arc(rp[0], rp[1], 13 + pu * 3, 0, 7); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.moveTo(rp[0] - 5, rp[1]); g.lineTo(rp[0] + 5, rp[1]); g.moveTo(rp[0], rp[1] - 5); g.lineTo(rp[0], rp[1] + 5); g.stroke();
    g.font = '700 10px system-ui'; g.textAlign = 'center'; g.fillStyle = 'rgba(214,207,255,.85)'; var lb = 'RADIANT · ' + sc.s.con.toUpperCase(), under = rp[1] < 120; g.textAlign = rp[0] < 70 ? 'left' : rp[0] > W - 70 ? 'right' : 'center'; g.fillText(lb, rp[0], under ? rp[1] + 32 : rp[1] - 22); g.textAlign = 'center';
  }
  // spawn
  M.acc += dt * animRate(); while (M.acc >= 1) { M.acc -= 1 + (Math.random() - 0.5) * 0.6; spawn(Math.random() < (sc.s && sc.s.fb ? 0.07 : 0.03)); }
  if (Math.random() < dt * (sc.s ? 0.12 : 0.45)) spawn(Math.random() < 0.03, true);
  if (M.pending) { spawn(true); M.pending = null; }
  M.trains = M.trains.filter(function (tr) { return drawTrain(tr, dt); });
  M.meteors = M.meteors.filter(function (m) { return drawMeteor(m, dt); });
  g.drawImage(fg, 0, 0, W, H);
}
function resize() {
  var r = box.getBoundingClientRect(); W = r.width; H = r.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = W * dpr; cv.height = H * dpr; if (M.sc) build(); M.meteors = []; M.trains = [];
}

/* ---------- the page ---------- */
var $ = function (id) { return document.getElementById(id); };
function fDate(ms) { return api.fDay(ms); }
function rel(ms) { var d = Math.round((ms - api.now()) / DAY); return d === 0 ? 'today' : d === 1 ? 'tomorrow' : d === -1 ? 'yesterday' : d > 0 ? 'in ' + d + ' days' : Math.abs(d) + ' days ago'; }
function n0(x) { return x >= 10 ? Math.round(x) : x >= 1 ? x.toFixed(0) : x > 0.05 ? '<1' : '0'; }
function speedWord(v) { return v >= 55 ? 'very fast, green-white' : v >= 40 ? 'fast, white' : v >= 30 ? 'medium, yellowish' : 'slow, golden, fireballs'; }
function refreshScene() { M.sc = scene(); M.meteors = []; M.trains = []; if (W) build(); overlay(); info(); }
function overlay() {
  var sc = M.sc, s = sc.s, eye, pill;
  if (!s) { eye = 'No major shower tonight'; pill = sc.mode === 'live' ? '<i class="m-live"></i>Live' : 'Tonight ' + api.fTime(sc.t); }
  else if (sc.mode === 'preview') { eye = 'Peak night preview'; pill = fDate(sc.t) + ' ' + api.fTime(sc.t); }
  else { var pk = peakNear(s, api.now()), dd = (pk - api.now()) / DAY; eye = Math.abs(dd) < 1.2 ? 'At its peak' : dd > 0 ? 'Active · peak ' + rel(pk) : 'Active · peaked ' + rel(pk); pill = sc.mode === 'live' ? '<i class="m-live"></i>Live' : 'Tonight ' + api.fTime(sc.t); }
  $('m-eye').textContent = eye; $('m-name').textContent = s ? s.n : 'Sporadic meteors';
  if (s) { var r = rate(s, sc.t, sc.loc); $('m-sub').textContent = (r.hr >= 0.5 ? '≈ ' + n0(r.hr) + ' an hour' : 'ZHR ' + n0(r.zhr)) + ' · ' + s.v + ' km/s'; }
  else $('m-sub').textContent = 'A few an hour from any direction';
  $('m-pill').innerHTML = pill;
  $('m-face').textContent = s && sc.rh ? 'Facing ' + compass(sc.az0) + ' · radiant ' + (sc.rh.alt > 0 ? Math.round(sc.rh.alt) + '° up' : 'below the horizon') : 'Facing ' + compass(sc.az0);
  $('m-back').hidden = sc.mode !== 'preview';
  var chips = sc.act.length > 1 && sc.mode !== 'preview' ? sc.act.slice(0, 4).map(function (x) { return '<button data-ms="' + x.c + '" aria-pressed="' + (x === s) + '">' + x.n.replace('Southern ', 'S. ').replace('Northern ', 'N. ') + '</button>'; }).join('') : '';
  $('m-chips').innerHTML = chips; $('m-chips').hidden = !chips;
}
function stat(b, s) { return '<div><b>' + b + '</b><span>' + s + '</span></div>'; }
function info() {
  var sc = M.sc, s = sc.s, now = api.now(), loc = sc.loc, h = '';
  var mo = moon(now), mh = hor(mo.ra, mo.dec, now, loc).alt;
  var moonTxt = Math.round(mo.k * 100) + '%', moonSub = (mo.wax ? 'waxing' : 'waning') + ', ' + (mh > 0 ? 'up now' : 'down now');
  if (s) {
    var r = rate(s, now, loc), pk = peakNear(s, M.preview || now), best = sc.mode === 'preview' ? sc.best : bestTime(s, now, loc);
    h += '<div class="card"><p class="eyebrow">' + (sc.mode === 'preview' ? 'Peak night · ' + fDate(pk) : 'Right now') + (loc.approx ? '' : ' · ' + Math.abs(loc.lat).toFixed(1) + '°' + (loc.lat >= 0 ? 'N' : 'S')) + '</p>' +
      '<div class="facts3 m-facts">' +
      stat(sc.mode === 'preview' ? n0(s.z) : n0(r.zhr), sc.mode === 'preview' ? 'ZHR at peak' : 'ZHR now (peak ' + s.z + ')') +
      stat(best ? '≈ ' + n0(best.hr) : '—', best ? 'an hour at best' : 'not visible tonight') +
      stat(fDate(pk).replace(/^\w+ /, ''), 'peak, ' + rel(pk)) +
      stat(s.v + ' km/s', speedWord(s.v)) +
      stat(r.alt > 0 ? Math.round(r.alt) + '°' : 'Below', 'radiant ' + (r.alt > 0 ? 'height' : 'horizon') + ', ' + s.con) +
      stat(moonTxt, 'Moon ' + moonSub) + '</div>';
    if (best) h += '<p class="m-best"><b>Best ' + (sc.mode === 'preview' ? 'that night' : 'tonight') + ': ' + api.fTime(best.from) + '–' + api.fTime(best.to) + '</b> with the radiant ' + Math.round(best.alt) + '° up' + (sc.mode === 'preview' ? '' : '. Give your eyes 20 minutes to adjust and look about 45° away from the radiant') + '.</p>';
    if (best && best.from > now + 15 * 60000) h += remindRow(s, best);
    else if (!best) { var rise = riseAfter(s, now, loc); h += '<p class="m-best">' + (rise ? 'The radiant rises at ' + api.fTime(rise) + ', but not while it\'s dark enough tonight.' : 'The radiant doesn\'t rise from your latitude.') + '</p>'; }
    if (s.par) h += '<div class="m-par"><span>Debris from <b>' + api.esc(s.par) + '</b></span>' + (s.pid ? '<button class="btn" data-mact="parent">Its orbit</button>' : '') + '</div>';
    if (loc.approx) h += locAsk();
    h += '</div>';
    h += '<h2 class="sec">Activity<span>Zenithal hourly rate</span></h2><div class="card m-chart">' + chart(s, pk) + '</div>';
  } else {
    h += '<div class="card"><p class="eyebrow">Right now</p><p style="margin:0">No major shower is active. You can still see a few <b>sporadic</b> meteors an hour on a dark night, from random directions.</p><div class="facts3 m-facts" style="margin-top:12px">' + stat(moonTxt, 'Moon ' + moonSub) + '</div>' + (loc.approx ? locAsk() : '') + '</div>';
  }
  var others = sc.act.filter(function (x) { return x !== s; });
  if (others.length && sc.mode !== 'preview') h += '<h2 class="sec">Also active</h2><div class="card flush"><ul class="list">' + others.map(function (x) { var pk2 = peakNear(x, now); return row(x, n0(zhr(x, now)), 'ZHR now', 'Peak ' + fDate(pk2) + ' · ' + x.v + ' km/s · ' + x.con, 'data-ms="' + x.c + '"'); }).join('') + '</ul></div>';
  var up = SH.filter(function (x) { return !x.day; }).map(function (x) { return { s: x, t: nextPeak(x, now) }; }).filter(function (o) { return o.t > now + DAY / 2; }).sort(function (a, b) { return a.t - b.t; }).slice(0, 6);
  h += '<h2 class="sec">Coming up<span>' + (api.pro ? 'Tap to preview the peak night' : 'Peak-night previews with Pro') + '</span></h2><div class="card flush"><ul class="list">' + up.map(function (o) {
    var mk = moon(o.t).k; return row(o.s, fDate(o.t).replace(/^\w+ /, ''), rel(o.t), 'ZHR ' + o.s.z + ' · Moon ' + Math.round(mk * 100) + '% lit · ' + o.s.con, 'data-mprev="' + o.s.c + '" data-mt="' + o.t + '"');
  }).join('') + '</ul></div>';
  h += '<h2 class="sec">Latest fireballs<span>NASA/JPL CNEOS</span></h2><div class="card flush"><ul class="list" id="m-fb">' + fbHTML() + '</ul></div>';
  h += '<p class="small muted" style="margin:4px 6px 0">Shower dates, rates and radiants from the International Meteor Organization\'s working list; peak times can vary by several hours. ZHR is what one observer would see under a perfectly dark sky with the radiant overhead, so real counts are lower.</p>';
  $('m-info').innerHTML = h;
}
/* reminders (Pro): a notification ten minutes before the best time */
function remKey(s, best) { return s.c + ':' + new Date(best.from).toISOString().slice(0, 13); }
function rems() { var r = api.ls('mRem') || {}, n = api.now(), out = {}; Object.keys(r).forEach(function (k) { if (r[k].at > n - DAY) out[k] = r[k]; }); return out; }
function remindRow(s, best) {
  var on = !!rems()[remKey(s, best)], at = best.from - 10 * 60000;
  return '<div class="m-par"><span>' + (on ? 'Reminder set for <b>' + api.fTime(at) + '</b>, ten minutes before the best time.' : 'Get a notification ten minutes before the best time.') + '</span>' +
    '<button class="btn' + (on ? '' : ' pri') + '" data-mact="remind" data-mk="' + remKey(s, best) + '" data-mat="' + at + '" data-mname="' + api.esc(s.n) + '" data-mbest="' + best.from + '">' +
    (on ? 'Cancel' : 'Remind me') + (api.pro ? '' : '<span class="pro-tag">PRO</span>') + '</button></div>';
}
function toggleRemind(b) {
  if (!api.pro) { api.openPro('remind'); return; }
  var r = rems(), k = b.dataset.mk, id = 0; for (var i = 0; i < k.length; i++) id = (id * 31 + k.charCodeAt(i)) % 900;
  if (r[k]) { if (api.A && api.A.unremind) api.A.unremind(id); delete r[k]; api.ls('mRem', r); api.toast('Reminder cancelled'); }
  else {
    var at = +b.dataset.mat, best = +b.dataset.mbest;
    if (api.A && api.A.remind) { api.A.remind(id, at, b.dataset.mname + ' tonight', 'Best viewing starts at ' + api.fTime(best) + '. Find a dark spot, give your eyes 20 minutes, and look about 45° from the radiant.'); if (api.A.askNotify) api.A.askNotify(); }
    r[k] = { id: id, at: at }; api.ls('mRem', r); api.toast('Reminder set for ' + api.fTime(at));
  }
  info();
}
function locAsk() { return '<div class="m-par" style="margin-top:12px"><span class="muted">Showing a typical sky. Set your location for your own times and directions.</span>' + (api.A && api.A.skyLocate ? '<button class="btn pri" data-mact="loc">Use my location</button>' : '') + '</div>'; }
function row(s, big, small, sub, attr) {
  var c = colours(s.v)[0];
  return '<li><button class="rowb" ' + attr + '><span class="ic"><svg width="40" height="40" viewBox="0 0 40 40"><path d="M10 30 L26 14" stroke="rgba(' + c + ',.45)" stroke-width="2.4" stroke-linecap="round"/><circle cx="27" cy="13" r="3.4" fill="rgb(' + c + ')"/></svg></span>' +
    '<span class="nm">' + api.esc(s.n) + '</span><span class="rt"><b>' + big + '</b><span>' + small + '</span></span><span class="sb">' + sub + '</span></button></li>';
}
function chart(s, tp) {
  var w = windowOf(s, tp), a = w[0] - 2 * DAY, b = w[1] + 2 * DAY, Wc = 340, Hc = 110, pad = 8, n = 120, pts = [], mx = s.z;
  for (var i = 0; i <= n; i++) { var t = a + (b - a) * i / n; pts.push([pad + (Wc - 2 * pad) * i / n, Hc - 22 - (Hc - 34) * zhr(s, t) / mx]); }
  var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
  var x = function (t) { return pad + (Wc - 2 * pad) * (t - a) / (b - a); }, now = api.now(), nx = x(now);
  var svg = '<svg viewBox="0 0 ' + Wc + ' ' + Hc + '" width="100%" style="display:block"><defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a99cff" stop-opacity=".45"/><stop offset="1" stop-color="#a99cff" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="' + line + ' L' + (Wc - pad) + ' ' + (Hc - 22) + ' L' + pad + ' ' + (Hc - 22) + 'Z" fill="url(#mg)"/><path d="' + line + '" fill="none" stroke="#c9bfff" stroke-width="1.8"/>' +
    '<line x1="' + pad + '" x2="' + (Wc - pad) + '" y1="' + (Hc - 22) + '" y2="' + (Hc - 22) + '" stroke="#252c40"/>' +
    '<text x="' + x(tp) + '" y="' + (Hc - 6) + '" fill="#c9bfff" font-size="10" font-weight="700" text-anchor="middle">Peak ' + fDate(tp).replace(/^\w+ /, '') + '</text>' +
    '<text x="' + Math.max(pad, x(w[0])) + '" y="' + (Hc - 6) + '" fill="#8d95ab" font-size="10" text-anchor="start">' + fDate(w[0]).replace(/^\w+ /, '') + '</text>' +
    '<text x="' + Math.min(Wc - pad, x(w[1])) + '" y="' + (Hc - 6) + '" fill="#8d95ab" font-size="10" text-anchor="end">' + fDate(w[1]).replace(/^\w+ /, '') + '</text>' +
    '<text x="' + (pad + 2) + '" y="12" fill="#8d95ab" font-size="10">' + s.z + '</text>';
  if (nx > pad && nx < Wc - pad) { var ny = Hc - 22 - (Hc - 34) * zhr(s, now) / mx; svg += '<line x1="' + nx + '" x2="' + nx + '" y1="8" y2="' + (Hc - 22) + '" stroke="#ffcf5c" stroke-dasharray="2 3"/><circle cx="' + nx + '" cy="' + ny + '" r="4" fill="#ffcf5c"/><text x="' + nx + '" y="10" fill="#ffcf5c" font-size="10" font-weight="700" text-anchor="' + (nx > Wc - 40 ? 'end' : nx < 40 ? 'start' : 'middle') + '">Now</text>'; }
  return svg + '</svg>';
}
function fbHTML() {
  if (!M.fb) return M.fbErr ? '<li><div class="err">Couldn\'t load fireballs.<br><button class="btn" data-mact="fb">Try again</button></div></li>' : '<li><div class="skel"></div></li><li><div class="skel"></div></li>';
  if (!M.fb.length) return '<li><p class="muted" style="padding:14px 16px;margin:0">No reports.</p></li>';
  return M.fb.slice(0, 6).map(function (f) {
    var where = f.lat != null ? f.lat.toFixed(1) + '°' + (f.latD || '') + ' ' + f.lon.toFixed(1) + '°' + (f.lonD || '') : 'Location not given';
    var y = new Date(f.t).getUTCFullYear(), big = f.kt != null ? (f.kt >= 1 ? f.kt.toFixed(1) : f.kt.toFixed(2)) + ' kt' : '—';
    return '<li><div class="rowb" style="cursor:default"><span class="ic"><svg width="40" height="40" viewBox="0 0 40 40"><path d="M9 31 L24 16" stroke="#ffb54788" stroke-width="3" stroke-linecap="round"/><circle cx="25.5" cy="14.5" r="5" fill="#ffcf5c"/><circle cx="25.5" cy="14.5" r="2.4" fill="#fff6dc"/></svg></span>' +
      '<span class="nm">' + fDate(f.t) + (y !== new Date(api.now()).getUTCFullYear() ? ' ' + y : '') + ', ' + api.fTime(f.t) + '</span><span class="rt"><b>' + big + '</b><span>impact energy</span></span>' +
      '<span class="sb">' + where + (f.alt != null ? ' · ' + f.alt.toFixed(0) + ' km up' : '') + (f.vel != null ? ' · ' + f.vel.toFixed(1) + ' km/s' : '') + '</span></div></li>';
  }).join('');
}
function loadFireballs(force) {
  return api.getJSON(api.JPL + 'fireball.api?limit=12', force ? 0 : 360).then(function (j) {
    if (!j || !j.fields) { M.fb = []; return; }
    var f = {}; j.fields.forEach(function (n, i) { f[n] = i; });
    M.fb = (j.data || []).map(function (r) { var gt = function (n) { return f[n] == null ? null : r[f[n]]; }, ds = gt('date') || '', nm = function (x) { var v = parseFloat(x); return isFinite(v) ? v : null; };
      return { t: Date.UTC(+ds.slice(0, 4), +ds.slice(5, 7) - 1, +ds.slice(8, 10), +ds.slice(11, 13), +ds.slice(14, 16), +ds.slice(17, 19)), e: nm(gt('energy')), kt: nm(gt('impact-e')), lat: nm(gt('lat')), latD: gt('lat-dir'), lon: nm(gt('lon')), lonD: gt('lon-dir'), alt: nm(gt('alt')), vel: nm(gt('vel')) }; })
      .sort(function (a, b) { return b.t - a.t; });
    M.fbErr = null;
  }).catch(function (e) { M.fbErr = e; }).then(function () { var el = $('m-fb'); if (el) el.innerHTML = fbHTML(); });
}
function bind() {
  box.addEventListener('click', function () { M.pending = 1; });
  document.getElementById('p-meteor').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ms],[data-mprev],[data-mact]'); if (!b) return;
    if (b.dataset.ms) { M.sel = SH.filter(function (s) { return s.c === b.dataset.ms; })[0] || null; M.preview = null; refreshScene(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else if (b.dataset.mprev && !api.pro) api.openPro('peaks');
    else if (b.dataset.mprev) { M.sel = SH.filter(function (s) { return s.c === b.dataset.mprev; })[0]; M.preview = +b.dataset.mt; refreshScene(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else if (b.dataset.mact === 'back') { M.sel = null; M.preview = null; refreshScene(); }
    else if (b.dataset.mact === 'parent') { var s = M.sc.s; if (s && s.pid) api.openOrbit(s.pid); }
    else if (b.dataset.mact === 'fb') { M.fbErr = null; $('m-fb').innerHTML = fbHTML(); loadFireballs(true); }
    else if (b.dataset.mact === 'loc') locate(b);
    else if (b.dataset.mact === 'remind') toggleRemind(b);
  });
}
function locate(btn) {
  if (!api.A || !api.A.skyLocate) return;
  btn.textContent = 'Finding you…'; btn.disabled = true;
  var prev = window.__skyLoc;
  window.__skyLoc = function (l) {
    window.__skyLoc = prev; if (prev) try { prev(l); } catch (e) {}
    if (!l) { api.toast('Couldn\'t get your location'); btn.textContent = 'Use my location'; btn.disabled = false; return; }
    api.ls('skyLoc', { lat: l.lat, lon: l.lon, decl: l.decl || 0, src: 'phone', t: Date.now() }); refreshScene();
  };
  api.A.skyLocate();
}

window.MeteorView = {
  init: function (a) { api = a; box = $('m-box'); cv = $('m-c'); g = cv.getContext('2d'); bind(); },
  shown: function () {
    active = true; resize(); refreshScene(); last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    if (!M.fb || Date.now() - (M.fbAt || 0) > 3600000) { M.fbAt = Date.now(); loadFireballs(false); }
  },
  hidden: function () { active = false; cancelAnimationFrame(raf); },
  reload: function () { refreshScene(); return loadFireballs(true); },
  debug: function () { return { M: M, SH: SH, zhr: zhr, solLon: solLon, rate: rate, bestTime: bestTime, radiant: radiant, hor: hor, moon: moon, spawn: spawn, scene: scene, nextPeak: nextPeak }; }
};
})();
