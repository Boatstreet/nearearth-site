/* Sky tab: a live window onto the sky from where you stand. Turn the phone and the view follows. */
(function () {
'use strict';
var DEG = Math.PI / 180, RE = 6371, EPS = 23.4392911 * DEG;
var api, cv, g, W = 0, H = 0, dpr = 1, raf = 0, active = false;
var S = {
  lat: null, lon: null, decl: 0, locSrc: '', fov: 64, mode: 'drag', az: 180, alt: 25,
  basis: null, target: null, qSeen: false, magAcc: 3, headAcc: -1, cam: false, sel: null, selTrack: null,
  lastBodies: 0, lastAst: 0, hits: [], pulse: 0
};
var STARS = null, LINES = null, CONS = null, NAMES = null;
var bodies = [], asts = [], astInfo = {}, astQueue = [], loadingAst = 0;

/* ---------- vectors ---------- */
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function norm(a) { var l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function mul(M, v) { return [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]]; }
function mulT(M, v) { return [M[0] * v[0] + M[3] * v[1] + M[6] * v[2], M[1] * v[0] + M[4] * v[1] + M[7] * v[2], M[2] * v[0] + M[5] * v[1] + M[8] * v[2]]; }
function mm(A, B) { var R = []; for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) R.push(A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]); return R; }
function radec(ra, dec) { var c = Math.cos(dec * DEG); return [c * Math.cos(ra * DEG), c * Math.sin(ra * DEG), Math.sin(dec * DEG)]; }
function ecl2eq(v) { return [v.x, v.y * Math.cos(EPS) - v.z * Math.sin(EPS), v.y * Math.sin(EPS) + v.z * Math.cos(EPS)]; }

/* J2000 equatorial -> local East/North/Up, for this place and moment (precession + Earth's rotation + latitude) */
function frame(ms) {
  var J = api.jd(ms), d = J - 2451545, T = d / 36525, as = DEG / 3600;
  var ze = (2306.2181 * T + 0.30188 * T * T) * as, z = (2306.2181 * T + 1.09468 * T * T) * as, th = (2004.3109 * T - 0.42665 * T * T) * as;
  var cz = Math.cos(z), sz = Math.sin(z), ct = Math.cos(th), st = Math.sin(th), cZ = Math.cos(ze), sZ = Math.sin(ze);
  var P = [cz * ct * cZ - sz * sZ, -cz * ct * sZ - sz * cZ, -cz * st, sz * ct * cZ + cz * sZ, -sz * ct * sZ + cz * cZ, -sz * st, st * cZ, -st * sZ, ct];
  var gmst = (280.46061837 + 360.98564736629 * d) * DEG, lst = gmst + S.lon * DEG, cl = Math.cos(lst), sl = Math.sin(lst);
  var Rz = [cl, sl, 0, -sl, cl, 0, 0, 0, 1];
  var f = S.lat * DEG, cf = Math.cos(f), sf = Math.sin(f);
  var L = [0, 1, 0, -sf, 0, cf, cf, 0, sf];             // rows: East, North, Up
  return mm(L, mm(Rz, P));
}
function altaz(v) { var n = norm(v); return { alt: Math.asin(Math.max(-1, Math.min(1, n[2]))) / DEG, az: (Math.atan2(n[0], n[1]) / DEG + 360) % 360 }; }
function fromAltAz(alt, az) { var c = Math.cos(alt * DEG); return [c * Math.sin(az * DEG), c * Math.cos(az * DEG), Math.sin(alt * DEG)]; }

/* ---------- Solar System, geocentric J2000 equatorial (km) ---------- */
function moonGeoEcl(J) {
  var d = J - 2451545.0, L = 218.316 + 13.176396 * d, M = 134.963 + 13.064993 * d, F = 93.272 + 13.229350 * d, D = 297.850 + 12.190749 * d, Ms = 357.529 + 0.98560028 * d;
  var lam = (L + 6.289 * Math.sin(M * DEG) + 1.274 * Math.sin((2 * D - M) * DEG) + 0.658 * Math.sin(2 * D * DEG) - 0.186 * Math.sin(Ms * DEG)) * DEG;
  var bet = 5.128 * Math.sin(F * DEG) * DEG, r = 385001 - 20905 * Math.cos(M * DEG) - 3699 * Math.cos((2 * D - M) * DEG);
  return { x: r * Math.cos(bet) * Math.cos(lam), y: r * Math.cos(bet) * Math.sin(lam), z: r * Math.sin(bet) };
}
/* Earth's centre (not the Earth-Moon barycentre), heliocentric ecliptic AU */
function earthHelio(J) {
  var b = api.posFromEl(api.planetEl(api.PLAN[2], J), J), m = moonGeoEcl(J), k = 0.012150 / api.AU;
  return { x: b.x - m.x * k, y: b.y - m.y * k, z: b.z - m.z * k };
}
var PLANET_LOOK = { Mercury: '#c9c0b5', Venus: '#fff1c9', Mars: '#ff8a65', Jupiter: '#f1d6ae', Saturn: '#eadba6' };
var SATURN = ['Saturn', '#e6d39a', 0, [9.53667594, -0.00125060], [0.05386179, -0.00050991], [2.48599187, 0.00193609], [49.95424423, 1222.49362201], [92.59887831, -0.41897216], [113.66242448, -0.28867794]];
function computeBodies(ms) {
  var J = api.jd(ms), E = earthHelio(J), out = [];
  var sun = ecl2eq({ x: -E.x * api.AU, y: -E.y * api.AU, z: -E.z * api.AU });
  out.push({ id: 'sun', name: 'Sun', geo: sun, kind: 'sun', mag: -26.7 });
  var m = moonGeoEcl(J), mEq = ecl2eq(m);
  out.push({ id: 'moon', name: 'Moon', geo: mEq, kind: 'moon', illum: (1 + Math.cos(Math.PI - Math.acos(Math.max(-1, Math.min(1, dot(norm(mEq), norm(sun))))))) / 2, sunDir: norm(sun), mag: -10 });
  api.PLAN.concat([SATURN]).forEach(function (pl) {
    if (pl[0] === 'Earth') return;
    var p = api.posFromEl(api.planetEl(pl, J), J);
    out.push({ id: pl[0].toLowerCase(), name: pl[0], kind: 'planet', color: PLANET_LOOK[pl[0]], geo: ecl2eq({ x: (p.x - E.x) * api.AU, y: (p.y - E.y) * api.AU, z: (p.z - E.z) * api.AU }) });
  });
  return out;
}
function astGeo(el, J, E) { var p = api.posFromEl(el, J); E = E || earthHelio(J); return { helio: p, geo: ecl2eq({ x: (p.x - E.x) * api.AU, y: (p.y - E.y) * api.AU, z: (p.z - E.z) * api.AU }) }; }
/* Apparent brightness (H, G magnitude system) */
function vmag(H, helio, geoKm) {
  if (H == null) return null;
  var r = Math.sqrt(helio.x * helio.x + helio.y * helio.y + helio.z * helio.z), dl = Math.sqrt(dot(geoKm, geoKm)) / api.AU;
  var sunFromAst = norm([-helio.x, -helio.y, -helio.z]), astFromEarth = norm(geoKm);
  // phase angle: Sun–asteroid–Earth
  var toEarth = [-astFromEarth[0], -astFromEarth[1], -astFromEarth[2]];
  var hEq = ecl2eq({ x: sunFromAst[0], y: sunFromAst[1], z: sunFromAst[2] });
  var a = Math.acos(Math.max(-1, Math.min(1, dot(hEq, toEarth)))), t = Math.tan(a / 2), G = 0.15;
  var p1 = Math.exp(-3.33 * Math.pow(t, 0.63)), p2 = Math.exp(-1.87 * Math.pow(t, 1.22));
  return H + 5 * Math.log10(r * dl) - 2.5 * Math.log10((1 - G) * p1 + G * p2);
}

/* ---------- which asteroids to highlight ---------- */
function pickAsteroids() {
  var D = api.D(), n = api.now(); if (!D.up) return [];
  var soon = D.up.filter(function (o) { return o.t > n - 86400000 && o.t < n + 14 * 86400000; });
  var seen = {}, list = [];
  soon.slice().sort(function (a, b) { return a.dist - b.dist; }).forEach(function (o) { if (!seen[o.des] && list.length < 12) { seen[o.des] = 1; list.push(o); } });
  return list;
}
function refreshAsteroidList() {
  var list = pickAsteroids();
  asts = list.map(function (o) { var prev = asts.filter(function (a) { return a.des === o.des; })[0]; return prev || { des: o.des, name: o.name, ca: o, pha: o.pha, h: o.h }; });
  astQueue = asts.filter(function (a) { return !astInfo[a.des]; }).map(function (a) { return a.des; });
  pump();
}
function pump() {
  while (loadingAst < 3 && astQueue.length) {
    var des = astQueue.shift(); loadingAst++;
    (function (des) {
      api.loadObj(des).then(function (info) { astInfo[des] = info; }).catch(function () { astInfo[des] = { failed: true }; })
        .then(function () { loadingAst--; S.lastAst = 0; status(); pump(); });
    })(des);
  }
  status();
}
function computeAsteroids(ms) {
  var J = api.jd(ms), E = earthHelio(J);
  asts.forEach(function (a) {
    var info = astInfo[a.des];
    if (!info || info.failed || !info.el || !info.el.a) { a.ok = false; return; }
    var r = astGeo(info.el, J, E); a.geo = r.geo; a.helio = r.helio; a.ok = true;
    a.km = Math.sqrt(dot(r.geo, r.geo)); a.mag = vmag(info.H != null ? info.H : a.h, r.helio, r.geo);
  });
}
function trackFor(a) {
  var info = astInfo[a.des]; if (!info || !info.el) return null;
  var n = api.now(), pts = [], start = n - 3 * 86400000, end = Math.max(n + 4 * 86400000, a.ca.t + 2 * 86400000);
  for (var t = start; t <= end; t += 3 * 3600000) { var J = api.jd(t); pts.push({ t: t, geo: astGeo(info.el, J).geo, day: new Date(t).getHours() === 0 || t === start }); }
  return pts;
}

/* ---------- view basis ---------- */
function dragBasis() {
  var f = fromAltAz(S.alt, S.az), up0 = [0, 0, 1];
  var r = norm(cross(f, up0)); if (!isFinite(r[0]) || Math.abs(S.alt) > 89.9) r = [Math.cos(S.az * DEG), -Math.sin(S.az * DEG), 0];
  var u = cross(r, f);
  return { f: f, u: u, r: r };
}
/* Android rotation vector: device -> world (East, North, Up) */
window.__skyQ = function (w, x, y, z, headAcc, magAcc) {
  S.qSeen = true; S.headAcc = headAcc; S.magAcc = magAcc;
  if (S.mode !== 'phone') return;
  var R = [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
           2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
           2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
  var dx = [R[0], R[3], R[6]], dy = [R[1], R[4], R[7]], dz = [R[2], R[5], R[8]];
  var th = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * DEG;
  var right = [Math.cos(th) * dx[0] + Math.sin(th) * dy[0], Math.cos(th) * dx[1] + Math.sin(th) * dy[1], Math.cos(th) * dx[2] + Math.sin(th) * dy[2]];
  var up = [-Math.sin(th) * dx[0] + Math.cos(th) * dy[0], -Math.sin(th) * dx[1] + Math.cos(th) * dy[1], -Math.sin(th) * dx[2] + Math.cos(th) * dy[2]];
  var fwd = [-dz[0], -dz[1], -dz[2]];
  // magnetic -> true north
  var D = S.decl * DEG, c = Math.cos(D), s = Math.sin(D);
  var tn = function (v) { return [v[0] * c + v[1] * s, -v[0] * s + v[1] * c, v[2]]; };
  S.target = { f: tn(fwd), u: tn(up), r: tn(right) };
};
function smoothBasis() {
  if (S.mode === 'phone' && S.target) {
    if (!S.basis) S.basis = S.target;
    var k = 0.35, b = S.basis, t = S.target;
    var f = norm([b.f[0] + (t.f[0] - b.f[0]) * k, b.f[1] + (t.f[1] - b.f[1]) * k, b.f[2] + (t.f[2] - b.f[2]) * k]);
    var u0 = [b.u[0] + (t.u[0] - b.u[0]) * k, b.u[1] + (t.u[1] - b.u[1]) * k, b.u[2] + (t.u[2] - b.u[2]) * k];
    var r = norm(cross(f, u0)), u = cross(r, f);
    S.basis = { f: f, u: u, r: r };
    var aa = altaz(f); S.az = aa.az; S.alt = aa.alt;
  } else S.basis = dragBasis();
}

/* ---------- drawing ---------- */
var F = 1, cx = 0, cy = 0;
function proj(v) {
  var b = S.basis, z = dot(v, b.f); if (z <= 1e-4) return null;
  return [cx + F * dot(v, b.r) / z, cy - F * dot(v, b.u) / z, z];
}
function clipSeg(a, b) { // segment in world dirs, clipped to in front of the camera
  var B = S.basis, za = dot(a, B.f), zb = dot(b, B.f), e = 0.02;
  if (za < e && zb < e) return null;
  if (za < e) { var t = (e - za) / (zb - za); a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  else if (zb < e) { var t2 = (e - zb) / (za - zb); b = [b[0] + (a[0] - b[0]) * t2, b[1] + (a[1] - b[1]) * t2, b[2] + (a[2] - b[2]) * t2]; }
  return [proj(a), proj(b)];
}
function polyline(pts, close) {
  var started = false;
  for (var i = 1; i < pts.length + (close ? 1 : 0); i++) {
    var s = clipSeg(pts[i - 1], pts[i % pts.length]); if (!s || !s[0] || !s[1]) { started = false; continue; }
    if (!started) { g.moveTo(s[0][0], s[0][1]); started = true; }
    g.lineTo(s[1][0], s[1][1]);
    if (s[1][2] < 0.021) started = false;
  }
}
function bvColor(bv) {
  var t = Math.max(-0.3, Math.min(2, bv));
  if (t < 0) return [170, 191, 255]; if (t < 0.4) return [202 + t * 60, 215 + t * 30, 255]; if (t < 0.8) return [255, 244 - (t - 0.4) * 40, 232 - (t - 0.4) * 90];
  if (t < 1.4) return [255, 228 - (t - 0.8) * 90, 196 - (t - 0.8) * 150]; return [255, 180, 110];
}
function skyColor(sunAlt) {
  var night = [4, 6, 14], dusk = [14, 22, 52], twi = [36, 54, 108], day = [62, 108, 176];
  var mix = function (a, b, t) { t = Math.max(0, Math.min(1, t)); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  var c = sunAlt < -18 ? night : sunAlt < -6 ? mix(night, dusk, (sunAlt + 18) / 12) : sunAlt < 0 ? mix(dusk, twi, (sunAlt + 6) / 6) : mix(twi, day, sunAlt / 10);
  return c;
}
function label(txt, x, y, color, font, placed, align) {
  g.font = font; var fs = parseFloat((font.match(/(\d+(\.\d+)?)px/) || [0, 13])[1]), w = g.measureText(txt).width, h = fs + 3, x0 = align === 'center' ? x - w / 2 : x, y0 = y - h + 3;
  for (var i = 0; i < placed.length; i++) { var p = placed[i]; if (x0 < p[0] + p[2] && x0 + w > p[0] && y0 < p[1] + p[3] && y0 + h > p[1]) return false; }
  placed.push([x0 - 2, y0 - 2, w + 4, h + 4]);
  g.textAlign = align || 'left'; g.lineJoin = 'round'; g.lineWidth = 4; g.strokeStyle = 'rgba(2,3,10,0.9)'; g.strokeText(txt, x, y); g.fillStyle = color; g.fillText(txt, x, y);
  return true;
}

function draw() {
  var ms = api.now();
  if (ms - S.lastBodies > 5000) { S.M = frame(ms); bodies = computeBodies(ms); S.lastBodies = ms; }
  if (ms - S.lastAst > 10000) { computeAsteroids(ms); S.lastAst = ms; if (S.sel && S.sel.kind === 'ast') S.selTrack = trackFor(S.sel.a); }
  var M = S.M;
  smoothBasis();
  var rect = cv.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (rect.width !== W || rect.height !== H) { W = rect.width; H = rect.height; cv.width = W * dpr; cv.height = H * dpr; }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx = W / 2; cy = H / 2; F = (H / 2) / Math.tan(S.fov * DEG / 2);
  var placed = [], hits = []; S.hits = hits;
  var obsJ2000 = mulT(M, [0, 0, RE]);
  var enu = function (geoKm, topo) { var v = topo ? [geoKm[0] - obsJ2000[0], geoKm[1] - obsJ2000[1], geoKm[2] - obsJ2000[2]] : geoKm; return norm(mul(M, v)); };
  var sun = bodies[0], sunV = enu(sun.geo, false), sunAlt = altaz(sunV).alt, dayF = Math.max(0, Math.min(1, (sunAlt + 8) / 14));

  // sky
  if (S.cam) { g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(2,4,12,0.25)'; g.fillRect(0, 0, W, H); }
  else { var c = skyColor(sunAlt), gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgb(' + c.map(Math.round) + ')'); gr.addColorStop(1, 'rgb(' + c.map(function (x) { return Math.round(x * 0.6); }) + ')'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }

  // grid: altitude rings and azimuth lines
  g.lineWidth = 1; g.strokeStyle = 'rgba(169,156,255,0.13)'; g.beginPath();
  [-60, -30, 30, 60].forEach(function (a) { var pts = []; for (var z = 0; z < 360; z += 3) pts.push(fromAltAz(a, z)); polyline(pts, true); });
  for (var az = 0; az < 360; az += 30) { var pts2 = []; for (var al = -88; al <= 88; al += 4) pts2.push(fromAltAz(al, az)); polyline(pts2, false); }
  g.stroke();

  // constellations
  if (S.fov < 110) {
    g.strokeStyle = 'rgba(150,170,230,' + (0.28 * (1 - dayF * 0.6)) + ')'; g.lineWidth = 1; g.beginPath();
    LINES.forEach(function (seg) { polyline(seg.map(function (p) { return mul(M, p); }), false); });
    g.stroke();
  }
  // stars
  var limit = S.fov > 90 ? 5.2 : S.fov > 50 ? 5.8 : 6.5, dim = 1 - dayF * 0.75;
  for (var i = 0; i < STARS.n; i++) {
    var mag = STARS.mag[i]; if (mag > limit) break;
    var v = mul(M, STARS.v[i]), p = proj(v); if (!p || p[0] < -5 || p[0] > W + 5 || p[1] < -5 || p[1] > H + 5) continue;
    var r = Math.max(0.55, (6.3 - mag) * 0.5) * (64 / S.fov) ** 0.35, col = STARS.col[i], a = Math.min(1, 0.35 + (6 - mag) * 0.2) * dim;
    g.fillStyle = 'rgba(' + col + ',' + a.toFixed(2) + ')';
    if (r < 1.1) g.fillRect(p[0] - r, p[1] - r, r * 2, r * 2); else { g.beginPath(); g.arc(p[0], p[1], r, 0, 7); g.fill(); }
    if (mag < 1.6) hits.push({ x: p[0], y: p[1], r: 14, kind: 'star', name: STARS.name[i] || 'Star', mag: mag, v: v });
  }
  // star and constellation names
  g.font = '600 11px system-ui';
  NAMES.forEach(function (n) { if (STARS.mag[n[0]] > (S.fov > 80 ? 1.3 : 2.4)) return; var p = proj(mul(M, STARS.v[n[0]])); if (p && p[0] > 0 && p[0] < W && p[1] > 0 && p[1] < H) label(n[1], p[0] + 7, p[1] + 5, 'rgba(236,240,255,' + (0.7 * dim + 0.3) + ')', '600 12.5px system-ui', placed); });
  if (S.fov < 100) CONS.forEach(function (c) { if (c.rank > (S.fov > 70 ? 1 : 2)) return; var p = proj(mul(M, c.v)); if (p && p[0] > 20 && p[0] < W - 20 && p[1] > 20 && p[1] < H - 20) label(c.name.toUpperCase(), p[0], p[1], 'rgba(176,192,245,' + (0.55 * dim + 0.2) + ')', '700 11px system-ui', placed, 'center'); });

  // Sun, Moon, planets
  bodies.forEach(function (b) {
    var v = enu(b.geo, b.kind === 'moon'), p = proj(v); b.v = v;
    if (!p) return;
    if (b.kind === 'sun') {
      var gl = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], 46); gl.addColorStop(0, 'rgba(255,240,190,0.95)'); gl.addColorStop(0.18, 'rgba(255,214,120,0.7)'); gl.addColorStop(1, 'rgba(255,190,90,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(p[0], p[1], 46, 0, 7); g.fill(); g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(p[0], p[1], Math.max(5, F * 0.0047), 0, 7); g.fill();
      label('Sun', p[0] + 15, p[1] - 10, '#ffd98e', '700 14px system-ui', placed);
    } else if (b.kind === 'moon') {
      var R = Math.max(7, F * 0.0045); drawMoon(p[0], p[1], R, b, v, sunV);
      label('Moon', p[0] + R + 6, p[1] + 5, '#f0f2f7', '700 14px system-ui', placed);
    } else {
      g.fillStyle = b.color; g.beginPath(); g.arc(p[0], p[1], 3.4, 0, 7); g.fill();
      g.strokeStyle = b.color; g.globalAlpha = 0.4; g.beginPath(); g.arc(p[0], p[1], 7, 0, 7); g.stroke(); g.globalAlpha = 1;
      label(b.name, p[0] + 11, p[1] + 5, b.color, '700 13.5px system-ui', placed);
    }
    hits.push({ x: p[0], y: p[1], r: 22, kind: b.kind, name: b.name, v: v, body: b });
  });

  // selected asteroid's path across the sky
  if (S.sel && S.sel.kind === 'ast' && S.selTrack) {
    var tr = S.selTrack, tv = tr.map(function (q) { return enu(q.geo, true); });
    g.strokeStyle = 'rgba(169,156,255,0.75)'; g.lineWidth = 1.6; g.setLineDash([5, 4]); g.beginPath(); polyline(tv, false); g.stroke(); g.setLineDash([]);
    tr.forEach(function (q, i) { if (!q.day) return; var p = proj(tv[i]); if (!p) return; g.fillStyle = '#c9bfff'; g.beginPath(); g.arc(p[0], p[1], 2.6, 0, 7); g.fill();
      label(api.fDay(q.t).replace(/^\w+ /, ''), p[0] + 7, p[1] - 7, '#d6ceff', '700 12px system-ui', placed); });
  }

  // ground: everything below the horizon, shaded so you can still see through it
  g.fillStyle = S.cam ? 'rgba(14,18,12,0.35)' : 'rgba(16,22,14,0.78)';
  var nadir = [0, 0, -1];
  for (var a2 = 0; a2 < 360; a2 += 6) fillTri(nadir, fromAltAz(0, a2), fromAltAz(0, a2 + 6));

  // 3D compass ring on the horizon
  drawCompass(placed);

  // asteroids
  S.pulse = (S.pulse + 0.03) % 1;
  var off = [];
  asts.forEach(function (a) {
    if (!a.ok) return;
    var v = enu(a.geo, true), p = proj(v); a.v = v; var aa = altaz(v); a.altaz = aa;
    var col = a.pha ? '#ff6b6b' : a.km < 384400 ? '#ffb547' : '#a99cff';
    if (p && p[0] > -10 && p[0] < W + 10 && p[1] > -10 && p[1] < H + 10) {
      var sel = S.sel && S.sel.kind === 'ast' && S.sel.a === a;
      var pr = 9 + S.pulse * 14;
      g.strokeStyle = col; g.globalAlpha = (1 - S.pulse) * 0.8; g.lineWidth = 2; g.beginPath(); g.arc(p[0], p[1], pr, 0, 7); g.stroke(); g.globalAlpha = 1;
      g.lineWidth = sel ? 2.5 : 1.6; g.beginPath(); g.arc(p[0], p[1], 8, 0, 7); g.stroke();
      g.fillStyle = col; g.beginPath(); g.arc(p[0], p[1], 2.6, 0, 7); g.fill();
      label(a.name + '  ' + api.fDist(a.km / api.AU, true), p[0] + 14, p[1] + 5, col, '700 14px system-ui', placed);
      hits.push({ x: p[0], y: p[1], r: 26, kind: 'ast', a: a, prio: 2 });
    } else off.push({ a: a, v: v, col: col });
  });
  // off-screen pointers for the closest few and the selected one
  off.sort(function (x, y) { return x.a.ca.dist - y.a.ca.dist; });
  var chips = []; off.filter(function (o, i) { return i < 3 || (S.sel && S.sel.a === o.a); }).forEach(function (o, i) { edgeChip(o, i, hits, chips); });

  // centre reticle
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - 10, cy); g.lineTo(cx - 4, cy); g.moveTo(cx + 4, cy); g.lineTo(cx + 10, cy); g.moveTo(cx, cy - 10); g.lineTo(cx, cy - 4); g.moveTo(cx, cy + 4); g.lineTo(cx, cy + 10); g.stroke();
  heading();
  if (S.sel) card(false);
}
function fillTri(a, b, c) {
  var B = S.basis, e = 0.02, pts = [a, b, c], out = [];
  for (var i = 0; i < 3; i++) {
    var P = pts[i], Q = pts[(i + 1) % 3], zp = dot(P, B.f), zq = dot(Q, B.f);
    if (zp >= e) out.push(P);
    if ((zp >= e) !== (zq >= e)) { var t = (e - zp) / (zq - zp); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t, P[2] + (Q[2] - P[2]) * t]); }
  }
  if (out.length < 3) return;
  g.beginPath(); out.forEach(function (v, i) { var p = proj(v); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); g.fill();
}
function drawMoon(x, y, R, b, v, sunV) {
  // lit side faces the Sun; phase from the Sun–Moon angle
  var k = b.illum, bas = S.basis;
  var sx = dot(sunV, bas.r) - dot(v, bas.r) * dot(sunV, v), sy = dot(sunV, bas.u) - dot(v, bas.u) * dot(sunV, v), ang = Math.atan2(-sy, sx);
  g.save(); g.translate(x, y); g.rotate(ang);
  g.fillStyle = '#2a2d36'; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
  g.fillStyle = '#eef0f5'; g.beginPath(); g.arc(0, 0, R, -Math.PI / 2, Math.PI / 2, false);
  g.ellipse(0, 0, Math.abs(1 - 2 * k) * R, R, 0, Math.PI / 2, -Math.PI / 2, k > 0.5); g.fill();
  g.restore();
}
function drawCompass(placed) {
  // horizon band: a ring of thickness so it reads as a 3D compass
  g.fillStyle = 'rgba(169,156,255,0.10)';
  for (var a = 0; a < 360; a += 6) { quad(fromAltAz(0, a), fromAltAz(0, a + 6), fromAltAz(-2.2, a + 6), fromAltAz(-2.2, a)); }
  g.strokeStyle = 'rgba(200,192,255,0.85)'; g.lineWidth = 1.6; g.beginPath(); var ring = []; for (var z = 0; z <= 360; z += 2) ring.push(fromAltAz(0, z)); polyline(ring, false); g.stroke();
  g.strokeStyle = 'rgba(169,156,255,0.35)'; g.lineWidth = 1; g.beginPath(); var ring2 = []; for (var z2 = 0; z2 <= 360; z2 += 2) ring2.push(fromAltAz(-2.2, z2)); polyline(ring2, false); g.stroke();
  // ticks
  g.lineWidth = 1.2;
  for (var d = 0; d < 360; d += 5) {
    var h = d % 90 === 0 ? 3.2 : d % 45 === 0 ? 2.4 : d % 15 === 0 ? 1.6 : 0.8;
    var s = clipSeg(fromAltAz(0, d), fromAltAz(h, d)); if (!s || !s[0] || !s[1]) continue;
    g.strokeStyle = d === 0 ? '#ff6b6b' : 'rgba(220,214,255,0.8)'; g.beginPath(); g.moveTo(s[0][0], s[0][1]); g.lineTo(s[1][0], s[1][1]); g.stroke();
  }
  var names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  for (var d2 = 0; d2 < 360; d2 += 15) {
    var p = proj(fromAltAz(d2 % 90 === 0 ? 4.6 : 3.6, d2)); if (!p || p[0] < 0 || p[0] > W || p[1] < 0 || p[1] > H) continue;
    var nm = names[d2], big = d2 % 90 === 0;
    if (nm) label(nm, p[0], p[1], d2 === 0 ? '#ff7a7a' : '#ffffff', (big ? '800 19px' : '700 13.5px') + ' system-ui', placed, 'center');
    else label(d2 + '°', p[0], p[1], 'rgba(232,228,255,0.92)', '700 11.5px system-ui', placed, 'center');
  }
  var zp = proj([0, 0, 1]); if (zp) { g.strokeStyle = 'rgba(220,214,255,0.6)'; g.beginPath(); g.moveTo(zp[0] - 6, zp[1]); g.lineTo(zp[0] + 6, zp[1]); g.moveTo(zp[0], zp[1] - 6); g.lineTo(zp[0], zp[1] + 6); g.stroke(); label('Zenith', zp[0] + 9, zp[1] + 5, 'rgba(232,228,255,0.9)', '700 12px system-ui', placed); }
}
function quad(a, b, c, d) { fillTri(a, b, c); fillTri(a, c, d); }
function edgeChip(o, i, hits, chips) {
  var b = S.basis, x = dot(o.v, b.r), y = dot(o.v, b.u), ang = Math.atan2(-y, x);
  var top = 64, bottom = H - 120, hw = W / 2 - 70, hh = (bottom - top) / 2 - 10, mx = W / 2, my = (top + bottom) / 2;
  var c = Math.cos(ang), s = Math.sin(ang), t = Math.min(hw / Math.max(1e-6, Math.abs(c)), hh / Math.max(1e-6, Math.abs(s)));
  var px = mx + c * t, py = my + s * t, txt = o.a.name;
  // keep chips that point the same way from stacking on top of each other
  var dir = py > my ? -1 : 1;
  for (var k = 0; k < 8 && chips.some(function (q) { return Math.abs(q[0] - px) < 130 && Math.abs(q[1] - py) < 36; }); k++) py += dir * 36;
  chips.push([px, py]);
  g.font = '700 12.5px system-ui'; var w = g.measureText(txt).width + 32;
  g.fillStyle = 'rgba(13,17,32,0.85)'; g.strokeStyle = o.col; g.lineWidth = 1;
  roundRect(px - w / 2, py - 15, w, 30, 15); g.fill(); g.stroke();
  g.save(); g.translate(px - w / 2 + 13, py); g.rotate(ang); g.fillStyle = o.col; g.beginPath(); g.moveTo(5, 0); g.lineTo(-3, -4.5); g.lineTo(-3, 4.5); g.closePath(); g.fill(); g.restore();
  g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.fillText(txt, px - w / 2 + 24, py + 4.5);
  hits.push({ x: px, y: py, r: Math.max(26, w / 2), kind: 'ast', a: o.a, prio: 3, chip: true });
}
function roundRect(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
var DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
var lastHead = '';
function heading() {
  var t = 'Facing ' + DIRS[Math.round(S.az / 22.5) % 16] + ' ' + Math.round(S.az) + '° · ' + (S.alt >= 0 ? Math.round(S.alt) + '° up' : Math.round(-S.alt) + '° down');
  if (t !== lastHead) { lastHead = t; var el = document.getElementById('s-sub'); if (el) el.textContent = t; }
}
var lastStatus = '';
function status() {
  var el = document.getElementById('sky-status'); if (!el) return;
  var ready = asts.filter(function (a) { return astInfo[a.des]; }).length, txt;
  if (!asts.length) txt = 'No asteroid flybys in the next two weeks';
  else if (ready < asts.length) txt = 'Locating asteroids ' + ready + ' of ' + asts.length + '…';
  else txt = asts.length + ' asteroids passing in the next two weeks are marked';
  if (S.mode === 'phone' && S.magAcc < 2) txt = 'Compass needs calibrating: wave your phone in a figure 8';
  if (txt !== lastStatus) { lastStatus = txt; el.textContent = txt; el.classList.toggle('warn', S.mode === 'phone' && S.magAcc < 2); }
}

/* ---------- info card ---------- */
var lastCard = '';
function card(force) {
  var el = document.getElementById('sky-card'), s = S.sel;
  if (!s) { el.hidden = true; lastCard = ''; return; }
  var html, aa = altaz(s.kind === 'ast' ? s.a.v || [0, 0, 1] : s.v || (s.body && s.body.v) || [0, 0, 1]);
  var pos = 'Az ' + Math.round(aa.az) + '° ' + DIRS[Math.round(aa.az / 22.5) % 16] + ' · ' + (aa.alt >= 0 ? 'Alt ' + Math.round(aa.alt) + '°' : Math.round(-aa.alt) + '° below the horizon');
  if (s.kind === 'ast') {
    var a = s.a, m = a.mag, vis = m == null ? '' : m < 6 ? 'naked eye' : m < 10 ? 'binoculars' : m < 15 ? 'small telescope' : m < 19 ? 'large telescope' : 'too faint for amateur scopes';
    html = '<div class="sky-card-h"><b>' + api.esc(a.name) + (a.pha ? ' <span class="badge b-pha">PHA</span>' : '') + '</b><button class="sky-x" data-sky="close" aria-label="Close">×</button></div>' +
      '<div class="sky-card-g"><div><b>' + api.fDist(a.km / api.AU, true) + '</b><span>away now</span></div><div><b>' + (m == null ? '—' : 'mag ' + m.toFixed(1)) + '</b><span>' + vis + '</span></div><div><b>' + api.fDist(a.ca.dist, true) + '</b><span>closest ' + api.fDay(a.ca.t) + '</span></div></div>' +
      '<div class="sky-card-p">' + pos + '</div>' +
      '<div class="btns"><button class="btn pri" data-sky="fly">3D flyby</button><button class="btn" data-sky="obj">Details</button></div>';
  } else {
    var extra = s.kind === 'moon' ? Math.round(s.body.illum * 100) + '% lit · ' : s.kind === 'star' && s.mag != null ? 'mag ' + s.mag.toFixed(1) + ' · ' : s.kind === 'planet' ? 'Planet · ' : '';
    html = '<div class="sky-card-h"><b>' + api.esc(s.name) + '</b><button class="sky-x" data-sky="close" aria-label="Close">×</button></div><div class="sky-card-p">' + extra + pos + '</div>';
  }
  if (html !== lastCard || force) { el.innerHTML = html; lastCard = html; }
  el.hidden = false;
}

/* ---------- input ---------- */
function setMode(m, quiet) {
  S.mode = m; S.basis = null;
  var b = document.getElementById('sky-mode'); b.setAttribute('aria-pressed', m === 'phone'); b.querySelector('span').textContent = m === 'phone' ? 'Follow phone' : 'Drag to look';
  if (!quiet) api.toast(m === 'phone' ? 'Following your phone' : 'Drag to look around');
}
function bindInput() {
  var pts = {}, pinch = 0, moved = false, down = null;
  cv.addEventListener('pointerdown', function (e) { pts[e.pointerId] = [e.clientX, e.clientY]; down = [e.clientX, e.clientY, Date.now()]; moved = false; try { cv.setPointerCapture(e.pointerId); } catch (x) {} });
  cv.addEventListener('pointermove', function (e) {
    var p = pts[e.pointerId]; if (!p) return;
    var ids = Object.keys(pts), dx = e.clientX - p[0], dy = e.clientY - p[1]; pts[e.pointerId] = [e.clientX, e.clientY];
    if (Math.abs(e.clientX - down[0]) + Math.abs(e.clientY - down[1]) > 8) moved = true;
    if (ids.length === 2) { var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) S.fov = Math.max(12, Math.min(110, S.fov * pinch / d)); pinch = d; return; }
    if (!moved) return;
    if (S.mode === 'phone') { setMode('drag'); }
    var k = S.fov / H;
    S.az = (S.az - dx * k + 360) % 360; S.alt = Math.max(-89, Math.min(89, S.alt + dy * k));
  });
  var up = function (e) {
    delete pts[e.pointerId]; if (Object.keys(pts).length < 2) pinch = 0;
    if (!moved && down && Date.now() - down[2] < 500) tap(e);
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', function (e) { delete pts[e.pointerId]; pinch = 0; });
  cv.addEventListener('wheel', function (e) { e.preventDefault(); S.fov = Math.max(12, Math.min(110, S.fov * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
}
function tap(e) {
  var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null, bd = 1e9;
  S.hits.forEach(function (h) { var d = Math.hypot(h.x - x, h.y - y) - (h.prio || 0) * 4; if (d < h.r && d < bd) { bd = d; best = h; } });
  if (!best) { S.sel = null; S.selTrack = null; card(); return; }
  if (best.kind === 'ast') { S.sel = { kind: 'ast', a: best.a }; S.selTrack = trackFor(best.a); if (best.chip && S.mode === 'drag') { var aa = altaz(best.a.v); S.az = aa.az; S.alt = Math.max(-80, Math.min(80, aa.alt)); } }
  else S.sel = best;
  card(true);
}

/* ---------- location ---------- */
window.__skyLoc = function (l) {
  if (!l) { if (S.lat == null) askLocation(true); return; }
  S.lat = l.lat; S.lon = l.lon; S.decl = l.decl || 0; S.locSrc = 'phone'; S.lastBodies = 0; S.lastAst = 0;
  api.ls('skyLoc', { lat: l.lat, lon: l.lon, decl: S.decl, src: 'phone', t: Date.now() });
  locChip(); document.getElementById('sky-loc-card').hidden = true;
};
function locChip() {
  var el = document.getElementById('sky-loc'); if (S.lat == null) { el.querySelector('span').textContent = 'Set location'; return; }
  el.querySelector('span').textContent = Math.abs(S.lat).toFixed(1) + '°' + (S.lat >= 0 ? 'N' : 'S') + ' ' + Math.abs(S.lon).toFixed(1) + '°' + (S.lon >= 0 ? 'E' : 'W');
}
function askLocation(denied) {
  var c = document.getElementById('sky-loc-card'); c.hidden = false;
  c.innerHTML = '<b>Where are you?</b><p>' + (denied ? 'Location wasn\'t available. ' : '') + 'The sky depends on where you stand. Use your phone\'s location (rough is fine) or type it in.</p>' +
    '<div class="btns">' + (api.A && api.A.skyLocate ? '<button class="btn pri" data-sky="locate">Use my location</button>' : '') + '<button class="btn" data-sky="manual">Type it in</button></div>';
}
function manualLocation() {
  var c = document.getElementById('sky-loc-card'); c.hidden = false;
  c.innerHTML = '<b>Your location</b><p>Latitude and longitude in degrees. North and east are positive.</p>' +
    '<div class="sky-in"><label>Latitude<input id="sky-lat" inputmode="decimal" placeholder="51.5" value="' + (S.lat != null ? S.lat : '') + '"></label><label>Longitude<input id="sky-lon" inputmode="decimal" placeholder="-0.13" value="' + (S.lon != null ? S.lon : '') + '"></label></div>' +
    '<div class="btns"><button class="btn pri" data-sky="save-loc">Save</button><button class="btn" data-sky="cancel-loc">Cancel</button></div>';
}

/* ---------- camera ---------- */
var stream = null;
window.__skyCam = function (ok) {
  if (!ok) { api.toast('Camera permission was not given'); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { api.toast('Camera isn\'t available here'); return; }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false }).then(function (s) {
    stream = s; var v = document.getElementById('sky-video'); v.srcObject = s; v.hidden = false; v.play().catch(function () {});
    S.cam = true; document.getElementById('sky-cam').setAttribute('aria-pressed', 'true');
    api.toast('Camera on · pinch to line the stars up');
  }).catch(function (e) { api.toast('Couldn\'t start the camera'); });
};
function camOff() {
  if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null;
  var v = document.getElementById('sky-video'); v.srcObject = null; v.hidden = true; S.cam = false;
  document.getElementById('sky-cam').setAttribute('aria-pressed', 'false');
}

/* ---------- lifecycle ---------- */
function prepData() {
  var d = window.SKYDATA, n = d.s.length / 4;
  STARS = { n: n, v: [], mag: new Float32Array(n), col: [], name: {} };
  for (var i = 0; i < n; i++) { STARS.v.push(radec(d.s[i * 4], d.s[i * 4 + 1])); STARS.mag[i] = d.s[i * 4 + 2]; STARS.col.push(bvColor(d.s[i * 4 + 3]).map(Math.round).join(',')); }
  d.n.forEach(function (x) { STARS.name[x[0]] = x[1]; });
  NAMES = d.n; LINES = d.l.map(function (seg) { return seg.map(function (p) { return radec(p[0], p[1]); }); });
  CONS = d.c.map(function (c) { return { name: c[0], v: radec(c[1], c[2]), rank: c[3] }; });
}
function loop() { if (!active) return; raf = requestAnimationFrame(loop); if (document.hidden || S.lat == null) return; try { draw(); } catch (e) { if (!loop.err) { loop.err = 1; console.error(e); } } status(); }

document.addEventListener('visibilitychange', function () { if (document.hidden && S.cam) camOff(); });

window.SkyView = {
  init: function (a) {
    api = a; cv = document.getElementById('sky-c'); g = cv.getContext('2d');
    prepData(); bindInput();
    var saved = api.ls('skyLoc'); if (saved && saved.lat != null) { S.lat = saved.lat; S.lon = saved.lon; S.decl = saved.decl || 0; S.locSrc = saved.src; }
    document.getElementById('p-sky').addEventListener('click', function (e) {
      var b = e.target.closest('[data-sky]'); if (!b) return; var k = b.dataset.sky;
      if (k === 'close') { S.sel = null; S.selTrack = null; card(); }
      else if (k === 'fly' && S.sel && S.sel.a) api.openFlyby(S.sel.a.des, S.sel.a.ca.t);
      else if (k === 'obj' && S.sel && S.sel.a) api.openObject(S.sel.a.des);
      else if (k === 'locate') { api.A.skyLocate(); document.getElementById('sky-loc-card').innerHTML = '<b>Finding you…</b><p>Using your phone\'s rough location.</p>'; }
      else if (k === 'manual') manualLocation();
      else if (k === 'cancel-loc') { document.getElementById('sky-loc-card').hidden = S.lat != null; if (S.lat == null) askLocation(); }
      else if (k === 'save-loc') {
        var la = parseFloat(document.getElementById('sky-lat').value), lo = parseFloat(document.getElementById('sky-lon').value);
        if (!isFinite(la) || !isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) { api.toast('Check the numbers'); return; }
        var decl = api.A && api.A.skyDeclination ? api.A.skyDeclination(la, lo) : 0;
        window.__skyLoc({ lat: la, lon: lo, decl: decl }); S.locSrc = 'manual'; api.ls('skyLoc', { lat: la, lon: lo, decl: decl, src: 'manual' });
      }
      else if (k === 'loc') askLocation();
      else if (k === 'mode') { if (S.mode === 'phone') setMode('drag'); else if (S.qSeen || (api.A && api.A.skyStart)) setMode('phone'); else api.toast('No motion sensors here'); }
      else if (k === 'cam') { if (S.cam) camOff(); else if (api.A && api.A.skyCamera) api.A.skyCamera(); else window.__skyCam(true); }
      else if (k === 'zin') S.fov = Math.max(12, S.fov / 1.35); else if (k === 'zout') S.fov = Math.min(110, S.fov * 1.35);
    });
  },
  shown: function () {
    active = true; refreshAsteroidList(); locChip();
    var sensors = api.A && api.A.skyStart && api.A.skyStart();
    setMode(sensors ? 'phone' : 'drag', true);
    if (S.lat == null) { if (api.A && api.A.skyHasLocation && api.A.skyHasLocation()) api.A.skyLocate(); else askLocation(); }
    else { document.getElementById('sky-loc-card').hidden = true; if (S.locSrc === 'phone' && api.A && api.A.skyHasLocation && api.A.skyHasLocation()) api.A.skyLocate(); }
    S.lastBodies = 0; S.lastAst = 0; cancelAnimationFrame(raf); loop();
  },
  hidden: function () { active = false; cancelAnimationFrame(raf); if (api.A && api.A.skyStop) api.A.skyStop(); camOff(); },
  dataChanged: function () { if (active) refreshAsteroidList(); },
  bodiesAt: function (ms) { var M = frame(ms), bs = computeBodies(ms), o = mulT(M, [0, 0, RE]), out = {}; bs.forEach(function (b) { var v = b.kind === 'moon' ? [b.geo[0] - o[0], b.geo[1] - o[1], b.geo[2] - o[2]] : b.geo; var aa = altaz(mul(M, v)); out[b.id] = aa; if (b.kind === 'moon') out.moonIllum = b.illum; }); return out; },
  debug: function () { return { S: S, asts: asts, bodies: bodies, altaz: altaz, frame: frame, enuOf: function (geo, topo) { var M = frame(api.now()); var o = mulT(M, [0, 0, RE]); var v = topo ? [geo[0] - o[0], geo[1] - o[1], geo[2] - o[2]] : geo; return norm(mul(M, v)); }, starAltAz: function (idx) { return altaz(mul(frame(api.now()), STARS.v[idx])); }, findStar: function (name) { var i = NAMES.filter(function (n) { return n[1] === name; })[0]; return i ? i[0] : -1; }, setView: function (az, alt, fov) { S.mode = 'drag'; S.az = az; S.alt = alt; if (fov) S.fov = fov; }, tap: tap }; }
};
})();
