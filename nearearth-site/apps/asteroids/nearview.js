/* Around Earth (Upcoming tab): one flyby at a time, in 3D, on its real trajectory.
   Geocentric, to scale: the asteroid moves along its real approach direction (from its orbit) at its real speed and miss distance,
   past a textured Earth lit by the real Sun, with the Moon where it really is and the real stars behind. A slow camera move gives depth;
   only Earth and the Moon are drawn larger than life when they would otherwise be specks (the corner note says by how much). */
(function () {
'use strict';
var DEG = Math.PI / 180, RE = 6371, RM = 1737, LDKM = 384400, DAY = 86400000, EPS = 23.4393 * DEG;
var api, box, cv, g, W = 0, H = 0, dpr = 1, raf = 0, active = false, last = 0;
var SPAN = 34, list = [], idx = -1, cur = null, loopT = 0, paused = false, drag = null, resumeAt = 0, dwell = 0, TEX = null, CLD = null, texBusy = false, scrubFn = null;
var glob = document.createElement('canvas'), gctx = glob.getContext('2d'), gimg = null, gAcc = 1;
var SKY = null, FAKE = []; (function () { var s = 3, r = function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; for (var i = 0; i < 320; i++) { var u = r() * 2 - 1, p = r() * 6.283, q = Math.sqrt(1 - u * u); FAKE.push([q * Math.cos(p), q * Math.sin(p), u, 2 + r() * 4, 0.3]); } })();
var MONO = 'ui-monospace, "Roboto Mono", "SF Mono", monospace', CY = '120,220,255';

function $(id) { return document.getElementById(id); }
function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function add(a, b, k) { return [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]; }
function gmst(ms) { return ((280.46061837 + 360.98564736629 * (ms / DAY + 2440587.5 - 2451545.0)) % 360) * DEG; }
function ease(t) { t = Math.max(0, Math.min(1, t)); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function moonEcl(ms) {
  var d = ms / DAY + 2440587.5 - 2451545.0, L = 218.316 + 13.176396 * d, M = 134.963 + 13.064993 * d, F = 93.272 + 13.229350 * d, D = 297.850 + 12.190749 * d, Ms = 357.529 + 0.98560028 * d;
  var lam = (L + 6.289 * Math.sin(M * DEG) + 1.274 * Math.sin((2 * D - M) * DEG) + 0.658 * Math.sin(2 * D * DEG) - 0.186 * Math.sin(Ms * DEG)) * DEG;
  var bet = 5.128 * Math.sin(F * DEG) * DEG, r = 385001 - 20905 * Math.cos(M * DEG) - 3699 * Math.cos((2 * D - M) * DEG);
  return [r * Math.cos(bet) * Math.cos(lam), r * Math.cos(bet) * Math.sin(lam), r * Math.sin(bet)];
}

/* ---------- this week's flybys ---------- */
function refresh() {
  var D = api.D(), n = api.now(), keep = cur && cur.f;
  list = (D.up || []).filter(function (o) { return o.t >= n - 6 * 3600000 && o.t <= n + 7 * DAY; }).sort(function (a, b) { return a.t - b.t; });
  if (!list.length) { idx = -1; cur = null; ui(); return; }
  var j = keep ? list.findIndex(function (o) { return o.des === keep.des && o.t === keep.t; }) : -1;
  if (j < 0) { j = list.findIndex(function (o) { return o.t > n; }); if (j < 0) j = list.length - 1; }
  select(j, true);
}
function select(j, quiet) {
  if (!list.length) return;
  idx = (j + list.length) % list.length; var f = list[idx];
  if (cur && cur.f === f && quiet) { ui(); return; }
  cur = { f: f, geo: api.flyGeom(f, null), intro: 1 }; setup(); loopT = 0; dwell = 0; ui();
  var token = cur;
  api.loadObj(f.des).then(function (info) { if (cur === token) { cur.geo = api.flyGeom(f, info); setup(); } }).catch(function () {});
}
function setup() {
  var gq = cur.geo, f = cur.f;
  cur.X = norm(gq.uE); cur.Y = norm(gq.bE); cur.Z = norm(cross(cur.X, cur.Y)); cur.sun = norm(gq.sunE);
  cur.bkm = f.dist * api.AU; cur.v = f.v || f.vinf || 15; cur.approx = gq.approx;
  cur.view = Math.max(cur.bkm * 1.4, 26000);                                     // radius of space to frame, km
  cur.tw = cur.view * 1.25 / cur.v * 1000;                                         // ms from closest approach to the edge of the shot
  cur.ca = add([0, 0, 0], cur.Y, cur.bkm);
}
function astAt(ms) { return add(cur.ca, cur.X, cur.v * (ms - cur.f.t) / 1000); }

/* ---------- camera ---------- */
var C = { pos: [0, 0, 1], f: [0, 0, -1], r: [1, 0, 0], u: [0, 1, 0], F: 400, cx: 0, cy: 0 };
function camera(k) {
  var intro = cur.intro || 0, az = (-26 + 52 * ease(k)) * DEG + intro * 50 * DEG, tl = (60 - 12 * Math.sin(Math.PI * k)) * DEG - intro * 18 * DEG;
  var target = add([0, 0, 0], cur.Y, cur.bkm * 0.42), fov = 21 * DEG;
  var dist = cur.view / Math.tan(fov) * 1.02 * (1 + 1.6 * intro * intro);
  var h = add(add([0, 0, 0], cur.Y, -Math.cos(az)), cur.X, Math.sin(az)), dir = add(add([0, 0, 0], cur.Z, Math.cos(tl)), h, Math.sin(tl));
  C.pos = add(target, dir, dist); C.f = norm(add(target, C.pos, -1)); C.r = norm(cross(C.f, cur.Z)); C.u = cross(C.r, C.f);
  C.F = Math.min(W, H) / 2 / Math.tan(fov); C.cx = W / 2; C.cy = H * 0.56;
}
function proj(p) { var d = add(p, C.pos, -1), z = dot(d, C.f); if (z <= 1) return null; return [C.cx + dot(d, C.r) / z * C.F, C.cy - dot(d, C.u) / z * C.F, z]; }
function projDir(v) { var z = dot(v, C.f); if (z <= 0.02) return null; return [C.cx + dot(v, C.r) / z * C.F, C.cy - dot(v, C.u) / z * C.F]; }

/* ---------- textures and the real sky ---------- */
function loadTex() {
  if (TEX || texBusy) return; texBusy = true;
  var go = function () {
    var get = function (src, w, h, cb) { var im = new Image(); im.onload = function () { var c = document.createElement('canvas'); c.width = w; c.height = h; var x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h); cb(x.getImageData(0, 0, w, h)); }; im.src = src; };
    get(window.FLYTEX.earth, 1024, 512, function (d) { TEX = d; });
    get(window.FLYTEX.clouds, 512, 256, function (d) { CLD = d; });
  };
  if (window.FLYTEX) go(); else { var s = document.createElement('script'); s.src = api.asset('flytex.js'); s.onload = go; document.head.appendChild(s); }
  var sk = function () { // real stars, turned into ecliptic directions
    var s = window.SKYDATA.s, out = [], ce = Math.cos(EPS), se = Math.sin(EPS);
    for (var i = 0; i < s.length; i += 4) { if (s[i + 2] > 5.2) continue; var a = s[i] * DEG, d = s[i + 1] * DEG, x = Math.cos(d) * Math.cos(a), y = Math.cos(d) * Math.sin(a), z = Math.sin(d); out.push([x, y * ce + z * se, -y * se + z * ce, s[i + 2], s[i + 3]]); }
    SKY = out;
  };
  if (window.SKYDATA) sk(); else { var t = document.createElement('script'); t.src = api.asset('skydata.js'); t.onload = sk; document.head.appendChild(t); }
}

/* ---------- Earth: a textured globe drawn for the camera's exact viewpoint ---------- */
function paintGlobe(px, ms) {
  var D = Math.max(8, Math.min(160, Math.round(px * 2 * dpr))); if (glob.width !== D || !gimg) { glob.width = glob.height = D; gimg = gctx.createImageData(D, D); }
  var out = gimg.data, T = TEX && TEX.data, TW = TEX ? TEX.width : 1, TH = TEX ? TEX.height : 1, Cd = CLD && CLD.data, CW = CLD ? CLD.width : 1, CH = CLD ? CLD.height : 1;
  var G = gmst(ms), ce = Math.cos(EPS), se = Math.sin(EPS), sun = cur.sun, R = C.r, U = C.u, F = C.f, cs = ms / DAY * 0.004;
  for (var py = 0; py < D; py++) for (var qx = 0; qx < D; qx++) {
    var o = (py * D + qx) * 4, x = (qx + 0.5) / D * 2 - 1, y = 1 - (py + 0.5) / D * 2, rr = x * x + y * y;
    if (rr >= 1) { out[o + 3] = 0; continue; }
    var z = Math.sqrt(1 - rr), wx = x * R[0] + y * U[0] - z * F[0], wy = x * R[1] + y * U[1] - z * F[1], wz = x * R[2] + y * U[2] - z * F[2];
    var l = wx * sun[0] + wy * sun[1] + wz * sun[2], day = l < -0.1 ? 0 : l > 0.15 ? 1 : (l + 0.1) / 0.25, r, gg, b;
    var Y = wy * ce + wz * se, Z = -wy * se + wz * ce, lat = Math.asin(Math.max(-1, Math.min(1, Z)));
    if (T) {
      var u = (Math.atan2(Y, wx) - G) / 6.283185 + 0.5; u -= Math.floor(u);
      var row = Math.min(Math.floor(TH * 0.975), Math.max(Math.ceil(TH * 0.02), Math.floor((0.5 - lat / Math.PI) * TH))), k = (row * TW + Math.floor(u * TW)) * 4;
      r = T[k]; gg = T[k + 1]; b = T[k + 2];
      var la = Math.abs(lat) / DEG; if (la > 72) { var ic = Math.min(1, (la - 72) / 8); r += (232 - r) * ic; gg += (238 - gg) * ic; b += (246 - b) * ic; }
      if (Cd) { var cu = u + cs; cu -= Math.floor(cu); var cc = Cd[(Math.floor(row / TH * CH) * CW + Math.floor(cu * CW)) * 4] / 255 * 0.8 * Math.min(1, (90 - la) / 12); r += (245 - r) * cc; gg += (248 - gg) * cc; b += (255 - b) * cc; }
    } else { r = 40; gg = 90; b = 170; }
    var shade = 0.2 + 0.8 * day * (0.55 + 0.45 * Math.max(0, l)), rim = Math.pow(1 - z, 2.4) * (0.2 + 0.8 * day);
    r = r * shade * (1 - 0.35 * (1 - day)) + 6 * (1 - day); gg = gg * shade * (1 - 0.2 * (1 - day)) + 12 * (1 - day); b = b * shade + 34 * (1 - day); // night side kept faintly visible, cool-toned
    r += (110 - r) * rim * 0.6; gg += (175 - gg) * rim * 0.6; b += (255 - b) * rim * 0.7;
    out[o] = r; out[o + 1] = gg; out[o + 2] = b; out[o + 3] = Math.min(1, (1 - Math.sqrt(rr)) * D * 0.6) * 255;
  }
  gctx.putImageData(gimg, 0, 0);
}
function drawMoon(p, rad) {
  var sx = dot(cur.sun, C.r), sy = dot(cur.sun, C.u), sz = -dot(cur.sun, C.f);
  g.fillStyle = '#1b1d24'; g.beginPath(); g.arc(p[0], p[1], rad, 0, 7); g.fill();
  var gr = g.createRadialGradient(p[0] + sx * rad * 0.6, p[1] - sy * rad * 0.6, 0, p[0] + sx * rad * 0.2, p[1] - sy * rad * 0.2, rad * (1.2 + 0.4 * sz));
  gr.addColorStop(0, '#eef0f5'); gr.addColorStop(0.55, '#a9aebb'); gr.addColorStop(1, 'rgba(60,64,76,0)');
  g.save(); g.beginPath(); g.arc(p[0], p[1], rad, 0, 7); g.clip(); g.fillStyle = gr; g.fillRect(p[0] - rad, p[1] - rad, rad * 2, rad * 2); g.restore();
}

/* ---------- the frame ---------- */
function draw(dt) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#03040a'; g.fillRect(0, 0, W, H);
  if (!cur) { g.fillStyle = '#8d95ab'; g.font = '600 13px system-ui'; g.textAlign = 'center'; g.fillText('No flybys in the next 7 days', W / 2, H / 2); $('nv-time').innerHTML = ''; $('nv-ca').classList.remove('on'); return; }

  // time: slow overall, slower still near closest approach, a pause at closest approach, then loop; a finger scrubs it
  if (resumeAt && performance.now() > resumeAt) { resumeAt = 0; paused = false; }
  var k0 = loopT / SPAN, dtc0 = (k0 * 2 - 1) * cur.tw, slow = 0.28 + 0.72 * Math.min(1, Math.abs(dtc0) / (cur.tw * 0.2));
  if (!paused && !drag) {
    if (dwell > 0) dwell -= dt;
    else { var before = loopT; loopT += dt * slow; if (before < SPAN / 2 && loopT >= SPAN / 2) { loopT = SPAN / 2; dwell = 2.5; } }
    if (loopT > SPAN + 2) loopT = 0;
  }
  if (cur.intro > 0) cur.intro = Math.max(0, cur.intro - dt / 2.6);
  var k = Math.min(1, loopT / SPAN), dtc = (k * 2 - 1) * cur.tw, ms = cur.f.t + dtc;
  camera(k);

  // the real sky
  var stars = SKY || FAKE;
  for (var i = 0; i < stars.length; i++) {
    var s = stars[i], q = projDir(s); if (!q || q[0] < 0 || q[0] > W || q[1] < 0 || q[1] > H) continue;
    var m = s[3], a = Math.max(0.12, Math.min(0.95, (5.6 - m) / 4.2)), rr2 = Math.max(0.5, Math.min(1.9, (5.6 - m) * 0.38)), bv = s[4];
    g.fillStyle = (bv < 0 ? 'rgba(205,222,255,' : bv < 0.6 ? 'rgba(240,244,255,' : bv < 1.2 ? 'rgba(255,240,215,' : 'rgba(255,212,170,') + a.toFixed(2) + ')';
    g.fillRect(q[0] - rr2 / 2, q[1] - rr2 / 2, rr2, rr2);
  }
  // the Sun: a glare where it really is (or from the edge it lies beyond)
  var sp = projDir(cur.sun), sx = dot(cur.sun, C.r), sy = dot(cur.sun, C.u), sl = Math.hypot(sx, sy) || 1, sgx, sgy, sga;
  if (sp && sp[0] > -W && sp[0] < 2 * W && sp[1] > -H && sp[1] < 2 * H) { sgx = sp[0]; sgy = sp[1]; sga = 0.5; } else { sgx = C.cx + sx / sl * W * 0.75; sgy = C.cy - sy / sl * H * 0.75; sga = 0.22; }
  var sg = g.createRadialGradient(sgx, sgy, 0, sgx, sgy, Math.max(W, H) * 0.7); sg.addColorStop(0, 'rgba(255,226,170,' + sga + ')'); sg.addColorStop(0.15, 'rgba(255,200,130,' + (sga * 0.35) + ')'); sg.addColorStop(1, 'rgba(255,200,130,0)');
  g.fillStyle = sg; g.fillRect(0, 0, W, H);

  // Earth and Moon sizes: true scale, unless that would make them specks
  var eC = proj([0, 0, 0]), caP = proj(cur.ca);
  var eTrue = RE / eC[2] * C.F, bPx = caP ? Math.hypot(caP[0] - eC[0], caP[1] - eC[1]) : 100;
  var ePx = Math.max(eTrue, Math.min(26, Math.max(9, bPx * 0.32))), ex = ePx / eTrue;
  // the Moon's orbit (to scale) and the Moon
  var mN = norm(cross(moonEcl(ms), moonEcl(ms + 6 * 3600000))), mA = norm(moonEcl(ms)), mB = cross(mN, mA);
  g.strokeStyle = 'rgba(200,210,235,.16)'; g.lineWidth = 1; g.setLineDash([2, 5]); g.beginPath(); var first = true;
  for (var a2 = 0; a2 <= 360; a2 += 4) { var pm = proj(add(add([0, 0, 0], mA, LDKM * Math.cos(a2 * DEG)), mB, LDKM * Math.sin(a2 * DEG))); if (!pm) { first = true; continue; } first ? g.moveTo(pm[0], pm[1]) : g.lineTo(pm[0], pm[1]); first = false; }
  g.stroke(); g.setLineDash([]);
  var moonP = proj(moonEcl(ms)), moonPx = moonP ? Math.max(2.5, Math.min(ePx * 0.27, RM / moonP[2] * C.F * ex)) : 0;

  // the trajectory
  var col = cur.f.pha ? '255,107,107' : cur.f.dist < api.LD_AU ? '255,181,71' : '201,191,255';
  var N = 120, T0 = cur.f.t - cur.tw * 1.6, T1 = cur.f.t + cur.tw * 1.6, pts = [];
  for (var n = 0; n <= N; n++) { var tt = T0 + (T1 - T0) * n / N; pts.push([tt, proj(astAt(tt))]); }
  function pathPart(front) {
    for (var n2 = 1; n2 <= N; n2++) {
      var A = pts[n2 - 1], B = pts[n2]; if (!A[1] || !B[1]) continue;
      var isFront = (A[1][2] + B[1][2]) / 2 < eC[2]; if (isFront !== front) continue;
      var done = B[0] <= ms, fade = 1 - Math.abs(n2 / N - 0.5) * 1.5;
      g.strokeStyle = 'rgba(' + col + ',' + ((done ? 0.85 : 0.28) * Math.max(0.15, fade)).toFixed(3) + ')'; g.lineWidth = done ? 2 : 1.2;
      g.setLineDash(done ? [] : [3, 5]); g.beginPath(); g.moveTo(A[1][0], A[1][1]); g.lineTo(B[1][0], B[1][1]); g.stroke();
    }
    g.setLineDash([]);
  }
  pathPart(false);
  // closest approach: the miss-distance line from Earth
  if (caP) {
    g.strokeStyle = 'rgba(' + col + ',.5)'; g.lineWidth = 1; g.setLineDash([2, 4]); g.beginPath(); g.moveTo(eC[0], eC[1]); g.lineTo(caP[0], caP[1]); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.arc(caP[0], caP[1], 3, 0, 7); g.strokeStyle = 'rgba(' + col + ',.9)'; g.stroke();
  }
  if (moonP && moonP[2] >= eC[2]) drawMoon(moonP, moonPx);
  // Earth, with its glow
  var halo = g.createRadialGradient(eC[0], eC[1], ePx * 0.9, eC[0], eC[1], ePx * 2.2); halo.addColorStop(0, 'rgba(90,160,255,.45)'); halo.addColorStop(1, 'rgba(90,160,255,0)');
  g.fillStyle = halo; g.beginPath(); g.arc(eC[0], eC[1], ePx * 2.2, 0, 7); g.fill();
  gAcc += dt; if (gAcc > 0.05 || !gimg) { gAcc = 0; paintGlobe(ePx, cur.tw < 8 * 3600000 ? ms : api.now()); }
  g.drawImage(glob, eC[0] - ePx, eC[1] - ePx, ePx * 2, ePx * 2);
  if (moonP && moonP[2] < eC[2]) drawMoon(moonP, moonPx);
  if (moonP && moonP[0] > 0 && moonP[0] < W && moonP[1] > 0 && moonP[1] < H) { g.fillStyle = 'rgba(200,210,235,.6)'; g.font = '600 9px ' + MONO; g.textAlign = 'center'; g.fillText('MOON', moonP[0], moonP[1] + moonPx + 11); }
  g.fillStyle = 'rgba(' + CY + ',.75)'; g.font = '600 9px ' + MONO; g.textAlign = 'center'; g.fillText('EARTH', eC[0], eC[1] + ePx + 13);
  pathPart(true);
  // time ticks along the path
  var stepH = [0.25, 0.5, 1, 2, 3, 6, 12, 24, 48, 96, 192].filter(function (h) { return cur.tw / 3600000 / h <= 3; })[0] || 192, lastLab = null;
  g.font = '600 9px ' + MONO; g.textAlign = 'center';
  for (var hk = -20; hk <= 20; hk++) {
    if (!hk) continue; var tp = proj(astAt(cur.f.t + hk * stepH * 3600000)); if (!tp || tp[0] < 10 || tp[0] > W - 10 || tp[1] < 10 || tp[1] > H - 10) continue;
    g.fillStyle = 'rgba(' + col + ',.7)'; g.beginPath(); g.arc(tp[0], tp[1], 1.6, 0, 7); g.fill();
    var hv = hk * stepH; if (lastLab && Math.hypot(tp[0] - lastLab[0], tp[1] - lastLab[1]) < 34) continue; lastLab = tp; g.fillStyle = 'rgba(200,210,235,.5)'; g.fillText((hv > 0 ? '+' : '−') + (Math.abs(hv) < 1 ? Math.abs(hv) * 60 + 'm' : Math.abs(hv) >= 48 ? Math.abs(hv) / 24 + 'd' : Math.abs(hv) + 'h'), tp[0], tp[1] + 13);
  }
  if (caP) { g.fillStyle = 'rgba(' + col + ',1)'; g.font = '700 10px ' + MONO; g.textAlign = caP[0] > W - 90 ? 'right' : caP[0] < 90 ? 'left' : 'center'; g.fillText('CA ' + api.fDist(cur.f.dist, true), caP[0], caP[1] - 10); }

  // the asteroid: sunlit rock, target bracket, short motion streak
  var ap = proj(astAt(ms)), ap2 = proj(astAt(ms - cur.tw * 0.05)), range = Math.hypot(cur.bkm, cur.v * dtc / 1000), rate = cur.v * (cur.v * dtc / 1000) / range;
  if (ap) {
    if (ap2) { var st = g.createLinearGradient(ap2[0], ap2[1], ap[0], ap[1]); st.addColorStop(0, 'rgba(' + col + ',0)'); st.addColorStop(1, 'rgba(' + col + ',.9)'); g.strokeStyle = st; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(ap2[0], ap2[1]); g.lineTo(ap[0], ap[1]); g.stroke(); g.lineCap = 'butt'; }
    var gl = g.createRadialGradient(ap[0], ap[1], 0, ap[0], ap[1], 16); gl.addColorStop(0, 'rgba(' + col + ',.6)'); gl.addColorStop(1, 'rgba(' + col + ',0)'); g.fillStyle = gl; g.beginPath(); g.arc(ap[0], ap[1], 16, 0, 7); g.fill();
    var rk = g.createRadialGradient(ap[0] + sx / sl * 1.8, ap[1] - sy / sl * 1.8, 0.4, ap[0], ap[1], 4.5); rk.addColorStop(0, '#fbf3e6'); rk.addColorStop(0.6, '#a59a8e'); rk.addColorStop(1, '#3c3732');
    g.fillStyle = rk; g.beginPath(); g.ellipse(ap[0], ap[1], 4.6, 3.7, 0.5, 0, 7); g.fill();
    g.strokeStyle = 'rgba(' + col + ',.95)'; g.lineWidth = 1.1; var bq = 10, be = 3.5;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) { g.beginPath(); g.moveTo(ap[0] + c[0] * bq, ap[1] + c[1] * (bq - be)); g.lineTo(ap[0] + c[0] * bq, ap[1] + c[1] * bq); g.lineTo(ap[0] + c[0] * (bq - be), ap[1] + c[1] * bq); g.stroke(); });
    g.strokeStyle = 'rgba(' + CY + ',.35)'; g.setLineDash([1, 4]); g.beginPath(); g.moveTo(eC[0], eC[1]); g.lineTo(ap[0], ap[1]); g.stroke(); g.setLineDash([]);
  }
  if (dwell > 2.3) cur.ping = 1;
  if (cur.ping && caP) { cur.ping -= dt * 0.7; if (cur.ping > 0) { g.strokeStyle = 'rgba(' + col + ',' + cur.ping.toFixed(2) + ')'; g.lineWidth = 1.2; g.beginPath(); g.arc(caP[0], caP[1], 10 + (1 - cur.ping) * 30, 0, 7); g.stroke(); } else cur.ping = 0; }
  // where it really is now
  var now = api.now(); if (Math.abs(now - cur.f.t) < cur.tw * 1.6) { var np = proj(astAt(now)); if (np) { g.strokeStyle = 'rgba(95,214,164,.9)'; g.lineWidth = 1.2; g.strokeRect(np[0] - 5, np[1] - 5, 10, 10); g.fillStyle = 'rgba(95,214,164,.95)'; g.font = '700 8px ' + MONO; g.textAlign = 'center'; g.fillText('NOW', np[0], np[1] + 16); } }

  // scale bar and size note
  var zc = dot(add(add([0, 0, 0], cur.Y, cur.bkm * 0.42), C.pos, -1), C.f), kmPx = zc / C.F, want = W * 0.24 * kmPx, nice = [1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6, 2e6, 5e6, 1e7, 2e7, 5e7].filter(function (v) { return v <= want; }).pop() || 1e3;
  var bw = nice / kmPx, by = H - 14; g.strokeStyle = 'rgba(' + CY + ',.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(14, by - 4); g.lineTo(14, by); g.lineTo(14 + bw, by); g.lineTo(14 + bw, by - 4); g.stroke();
  g.fillStyle = 'rgba(' + CY + ',.8)'; g.font = '600 9px ' + MONO; g.textAlign = 'left'; g.fillText((nice >= 1e6 ? nice / 1e6 + ' million' : nice.toLocaleString('en')) + ' km', 14, by - 7);
  g.textAlign = 'right'; g.fillStyle = 'rgba(200,210,235,.45)'; g.fillText(ex > 1.3 ? 'Earth & Moon shown ×' + Math.round(ex) + ' size' : 'to scale', W - 14, by);
  if (cur.approx) g.fillText('approach direction estimated', W - 14, by - 12);
  g.strokeStyle = 'rgba(' + CY + ',.3)'; [[8, 8, 1, 1], [W - 8, 8, -1, 1], [8, H - 30, 1, -1], [W - 8, H - 30, -1, -1]].forEach(function (c) { g.beginPath(); g.moveTo(c[0], c[1] + c[3] * 12); g.lineTo(c[0], c[1]); g.lineTo(c[0] + c[2] * 12, c[1]); g.stroke(); });

  // closest-approach note
  var km = cur.bkm, caOn = Math.abs(dtc) < cur.tw * 0.07, note = $('nv-ca');
  if (caOn) { var nk = cur.f.t + ':' + cur.f.des; if (note.dataset.k !== nk) { note.dataset.k = nk; note.innerHTML = '<b>◆ CLOSEST APPROACH</b><i>' + Math.round(km).toLocaleString('en') + ' km · ' + api.fDist(cur.f.dist, true) + '</i><i>' + (km < LDKM ? 'Inside the Moon\'s orbit' : (km / LDKM).toFixed(1) + '× the Moon\'s distance') + '</i><i>' + api.fDay(cur.f.t) + ' ' + api.fTime(cur.f.t) + ' · ' + cur.v.toFixed(1) + ' km/s</i>'; } }
  note.classList.toggle('on', caOn);
  // telemetry
  var sec = Math.abs(Math.round(dtc / 1000)), hms = (dtc < 0 ? 'T−' : 'T+') + String(Math.floor(sec / 3600)).padStart(2, '0') + ':' + String(Math.floor(sec / 60) % 60).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  $('nv-time').innerHTML = '<b>' + hms + '</b><span>' + api.fDay(ms) + ' ' + api.fTime(ms) + '</span>' +
    '<i>RANGE <em>' + Math.round(range).toLocaleString('en') + ' km</em></i><i>LD <em>' + (range / LDKM).toFixed(range < LDKM * 10 ? 3 : 1) + '</em></i>' +
    '<i>R-RATE <em>' + (rate >= 0 ? '+' : '−') + Math.abs(rate).toFixed(1) + ' km/s</em> ' + (Math.abs(rate) < 0.05 ? 'CA' : rate < 0 ? 'closing' : 'receding') + '</i>';
}

/* ---------- controls and readouts ---------- */
function ui() {
  var sub = $('e-sub'); if (sub) sub.textContent = list.length ? (idx + 1) + ' of ' + list.length + ' this week' : '';
  if (!cur) { $('nv-name').innerHTML = '<b>No flybys this week</b>'; $('nv-facts').innerHTML = ''; $('nv-btns').hidden = true; return; }
  var f = cur.f, n = api.now(), next = list.filter(function (o) { return o.t > n; })[0] === f, past = f.t < n;
  $('nv-name').innerHTML = '<b>' + api.esc(f.name) + (f.pha ? ' <span class="badge b-pha">PHA</span>' : '') + (next ? ' <span class="badge b-next">Next</span>' : '') + '</b><span>' + (past ? 'Passed ' : 'Closest ') + api.fDay(f.t) + ', ' + api.fTime(f.t) + '</span>';
  $('nv-facts').innerHTML = '<div><b>' + api.fDist(f.dist, true) + '</b><span>closest</span></div><div><b>' + (f.v ? f.v.toFixed(1) + ' km/s' : '—') + '</b><span>speed</span></div><div><b>' + (f.measured ? '' : '≈') + api.fSize(f.size) + '</b><span>size</span></div>';
  $('nv-btns').hidden = false;
}
function bind() {
  $('nv-prev').onclick = function () { select(idx - 1); };
  $('nv-next').onclick = function () { select(idx + 1); };
  $('nv-btns').addEventListener('click', function (e) {
    var b = e.target.closest('[data-nv]'); if (!b || !cur) return; var f = cur.f, k = b.dataset.nv;
    if (k === 'fly') api.openFlyby(f.des, f.t); else if (k === 'obj') api.openObject(f.des); else if (k === 'orbit') api.openOrbit(f.des, f.t);
  });
  // slide a finger sideways to move the asteroid along its path; tap to pause or play
  var sx = null, sy = 0, k0 = 0;
  function scrubTo(clientX, fromX) { if (!cur) return; var k = Math.max(0, Math.min(1, k0 + (clientX - fromX) / Math.max(200, W * 0.9))); loopT = k * SPAN; dwell = 0; cur.intro = 0; }
  scrubFn = function (k) { k0 = 0; scrubTo(k * Math.max(200, W * 0.9), 0); };
  box.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; k0 = Math.min(1, loopT / SPAN); drag = null; try { box.setPointerCapture(e.pointerId); } catch (x) {} });
  box.addEventListener('pointermove', function (e) {
    if (sx == null) return; var dx = e.clientX - sx, dy = e.clientY - sy;
    if (!drag && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) { drag = true; resumeAt = 0; }
    if (drag) { scrubTo(e.clientX, sx); e.preventDefault(); }
  });
  function end(e) {
    if (sx == null) return; var dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (drag) { drag = null; paused = true; resumeAt = performance.now() + 2500; return; }
    if (e.type === 'pointerup' && Math.abs(dx) < 8 && Math.abs(dy) < 8) { resumeAt = 0; paused = !paused; }
  }
  box.addEventListener('pointerup', end); box.addEventListener('pointercancel', function () { sx = null; if (drag) { drag = null; paused = true; resumeAt = performance.now() + 2500; } });
}
function resize() { var r = box.getBoundingClientRect(); W = r.width; H = r.height; dpr = Math.min(window.devicePixelRatio || 1, 2); cv.width = W * dpr; cv.height = H * dpr; }
function loop(t) {
  if (!active) return; raf = requestAnimationFrame(loop);
  var dt = Math.min(0.1, (t - (last || t)) / 1000); last = t; if (document.hidden) return;
  var r = box.getBoundingClientRect(); if (Math.abs(r.width - W) > 1 || Math.abs(r.height - H) > 1) resize();
  try { draw(dt); } catch (e) { if (!loop.e) { loop.e = 1; console.error(e); } }
}

window.NearView = {
  init: function (a) { api = a; box = $('ev-box'); cv = $('ev-c'); g = cv.getContext('2d'); bind(); },
  shown: function () { active = true; loadTex(); resize(); refresh(); last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); },
  hidden: function () { active = false; cancelAnimationFrame(raf); },
  dataChanged: function () { if (active) refresh(); },
  debug: function () { return { cur: cur, list: list, idx: idx, select: select, setLoop: function (k) { loopT = k * SPAN; paused = true; dwell = 0; if (cur) cur.intro = 0; }, scrubTo: function (k) { scrubFn(k); }, tex: !!TEX, sky: !!SKY, C: C }; }
};
})();
