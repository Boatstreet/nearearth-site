/* Opening sequence: flight through space, a tumbling asteroid rushes past the camera over Earth's limb, the name rises in. Tap to skip. */
(function () {
  var el = document.getElementById('intro'); if (!el) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (window.__NOINTRO || reduce) { el.remove(); return; }
  var cv = el.querySelector('canvas'), g = cv.getContext('2d');
  var W, H, dpr, start = performance.now(), done = false, DUR = 3700;
  function size() { dpr = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; }
  size(); addEventListener('resize', size);
  var seed = 11, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  var clamp = function (t) { return Math.max(0, Math.min(1, t)); };
  var ease = function (t) { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
  var inout = function (t) { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  var stars = []; for (var i = 0; i < 240; i++) stars.push({ x: rnd(), y: rnd(), z: rnd() * 0.85 + 0.15, tw: rnd() * 6, c: rnd() });
  var dust = []; for (i = 0; i < 90; i++) dust.push({ x: (rnd() - 0.5) * 6, y: (rnd() - 0.5) * 6, z: rnd() * 10 + 0.3 });
  var lights = []; for (i = 0; i < 140; i++) lights.push({ a: -Math.PI / 2 + (rnd() - 0.5) * 1.5, d: 0.015 + Math.pow(rnd(), 1.8) * 0.16, s: rnd() });

  // the asteroid: a real 3D mesh (stretched, lumpy, cratered), turned and lit by the Sun every frame
  function icosphere(n) {
    var t0 = (1 + Math.sqrt(5)) / 2, V = [[-1, t0, 0], [1, t0, 0], [-1, -t0, 0], [1, -t0, 0], [0, -1, t0], [0, 1, t0], [0, -1, -t0], [0, 1, -t0], [t0, 0, -1], [t0, 0, 1], [-t0, 0, -1], [-t0, 0, 1]].map(nrm);
    var F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (var s2 = 0; s2 < n; s2++) {
      var cache = {}, NF = [];
      var mid = function (a, b) { var k = a < b ? a + '_' + b : b + '_' + a; if (cache[k] == null) { V.push(nrm([(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2, (V[a][2] + V[b][2]) / 2])); cache[k] = V.length - 1; } return cache[k]; };
      F.forEach(function (f) { var a = mid(f[0], f[1]), b = mid(f[1], f[2]), c = mid(f[2], f[0]); NF.push([f[0], a, c], [f[1], b, a], [f[2], c, b], [a, b, c]); });
      F = NF;
    }
    return { V: V, F: F };
  }
  function nrm(v) { var l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
  function body(sd, opt) {
    var r0 = seed; seed = sd;
    var waves = []; for (var k = 0; k < 6; k++) { var u = rnd() * 2 - 1, ph = rnd() * 6.283, sq = Math.sqrt(1 - u * u); waves.push([sq * Math.cos(ph), u, sq * Math.sin(ph), k < 3 ? 1 + rnd() * 1.2 : 2.5 + rnd() * 2, rnd() * 6.283, k < 3 ? 0.035 + rnd() * 0.03 : 0.01 + rnd() * 0.01]); }
    var cr = []; for (k = 0; k < (opt.craters || 0); k++) { u = rnd() * 2 - 1; ph = rnd() * 6.283; sq = Math.sqrt(1 - u * u); var rr = 0.1 + Math.pow(rnd(), 2) * 0.22; cr.push([sq * Math.cos(ph), u, sq * Math.sin(ph), Math.cos(rr), Math.cos(rr * 1.4), rr * (0.09 + rnd() * 0.06)]); }
    var ax = opt.axes || [1.22, 0.92, 0.82], mesh = icosphere(opt.sub || 4);
    var V = mesh.V.map(function (v) {
      var x = v[0], y = v[1], z = v[2], e = 1 / Math.sqrt(x * x / (ax[0] * ax[0]) + y * y / (ax[1] * ax[1]) + z * z / (ax[2] * ax[2]));
      waves.forEach(function (w) { e += w[5] * Math.sin(w[3] * (x * w[0] + y * w[1] + z * w[2]) * 2 + w[4]); });
      cr.forEach(function (c) { var d = x * c[0] + y * c[1] + z * c[2]; if (d > c[4]) { if (d > c[3]) { var q = (1 - d) / (1 - c[3]); e -= c[5] * (1 - q * q); } else e += c[5] * 0.22 * Math.sin((d - c[4]) / (c[3] - c[4]) * Math.PI); } });
      return [x * e, y * e, z * e, 0.58 + 0.12 * Math.sin(x * 4.1 + 1) * Math.sin(y * 3.3 + z * 2.7) + 0.05 * Math.sin(x * 11 + y * 7) * Math.sin(z * 9 - y * 5)];
    });
    seed = r0;
    var F = mesh.F.map(function (f) {
      var a = V[f[0]], b = V[f[1]], c = V[f[2]], ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      var n = nrm([uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]);
      return { i: f, n: n, alb: (a[3] + b[3] + c[3]) / 3 };
    });
    var VN = V.map(function () { return [0, 0, 0]; });
    F.forEach(function (f) { f.i.forEach(function (k) { VN[k][0] += f.n[0]; VN[k][1] += f.n[1]; VN[k][2] += f.n[2]; }); });
    VN = VN.map(nrm);
    var VL = V.map(function () { return 0; });
    var P = V.map(function () { return [0, 0, 0]; }), vis = [];
    function draw(cx, cy, R, Rm, alpha) {
      var i, v, p;
      for (i = 0; i < V.length; i++) { v = V[i]; p = P[i]; p[0] = Rm[0] * v[0] + Rm[1] * v[1] + Rm[2] * v[2]; p[1] = Rm[3] * v[0] + Rm[4] * v[1] + Rm[5] * v[2]; p[2] = Rm[6] * v[0] + Rm[7] * v[1] + Rm[8] * v[2]; }
      vis.length = 0;
      for (i = 0; i < V.length; i++) {
        var m = VN[i], wx = Rm[0] * m[0] + Rm[1] * m[1] + Rm[2] * m[2], wy = Rm[3] * m[0] + Rm[4] * m[1] + Rm[5] * m[2], wz = Rm[6] * m[0] + Rm[7] * m[1] + Rm[8] * m[2];
        var dl = wx * LV[0] + wy * LV[1] + wz * LV[2], dif = dl > 0 ? Math.pow(dl, 0.85) : 0;
        VL[i] = dif * V[i][3] * 1.3 + 0.05 + Math.max(0, -dl) * 0.04 + Math.pow(Math.max(0, 1 - wz), 3) * Math.max(0, dl) * 0.25; // sunlit, faint fill on the night side, rim catch-light
      }
      for (i = 0; i < F.length; i++) {
        var f = F[i], n = f.n, nz = Rm[6] * n[0] + Rm[7] * n[1] + Rm[8] * n[2]; if (nz <= 0) continue;
        var lum = (VL[f.i[0]] + VL[f.i[1]] + VL[f.i[2]]) / 3;
        var a = P[f.i[0]], b = P[f.i[1]], c = P[f.i[2]];
        vis.push({ d: a[2] + b[2] + c[2], f: f, col: 'rgba(' + Math.min(255, lum * 236 + 6 | 0) + ',' + Math.min(255, lum * 214 + 7 | 0) + ',' + Math.min(255, lum * 196 + 12 | 0) + ',' + alpha.toFixed(3) + ')' });
      }
      vis.sort(function (x, y) { return x.d - y.d; });
      g.lineJoin = 'round'; g.lineWidth = Math.max(0.8, R * 0.008);
      for (i = 0; i < vis.length; i++) {
        var q = vis[i], A = P[q.f.i[0]], B = P[q.f.i[1]], C = P[q.f.i[2]];
        g.beginPath(); g.moveTo(cx + A[0] * R, cy - A[1] * R); g.lineTo(cx + B[0] * R, cy - B[1] * R); g.lineTo(cx + C[0] * R, cy - C[1] * R); g.closePath();
        g.fillStyle = q.col; g.strokeStyle = q.col; g.fill(); g.stroke();
      }
    }
    return { draw: draw };
  }
  var ROCK = body(4242, { craters: 18 });
  var frags = []; for (i = 0; i < 6; i++) frags.push({ dx: (rnd() - 0.5) * 2.6, dy: (rnd() - 0.5) * 1.6, dz: rnd() * 2.2 + 0.4, s: 0.05 + rnd() * 0.08, b: body(900 + i * 37, { craters: 1, axes: [1.3, 0.9, 0.75], sub: 2 }), sp: rnd() * 6 });
  var LV = (function () { var x = 0.75, y = 0.5, z = 0.32, l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; })();
  function rotM(a, b, c) { // tumble: about y by a, then x by b, then z by c
    var ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
    var A = [ca, 0, sa, 0, 1, 0, -sa, 0, ca], B = [1, 0, 0, 0, cb, -sb, 0, sb, cb], C = [cc, -sc, 0, sc, cc, 0, 0, 0, 1];
    function mul(P, Q) { var o = []; for (var r = 0; r < 3; r++) for (var k = 0; k < 3; k++) o[r * 3 + k] = P[r * 3] * Q[k] + P[r * 3 + 1] * Q[3 + k] + P[r * 3 + 2] * Q[6 + k]; return o; }
    return mul(C, mul(B, A));
  }
  // close up, the facets would show: render the rock off-screen and soften it by a hair so it reads as a smooth surface
  var oc = document.createElement('canvas'), ocg = oc.getContext('2d');
  function drawBody(bd, cx, cy, R, Rm, a) {
    if (R < 30 || !('filter' in g)) { bd.draw(cx, cy, R, Rm, a); return; }
    var sz = Math.ceil(R * 3.4), px = Math.ceil(sz * dpr); if (oc.width !== px) { oc.width = px; oc.height = px; } else ocg.clearRect(0, 0, px, px);
    ocg.setTransform(dpr, 0, 0, dpr, 0, 0);
    var keep = g; g = ocg; bd.draw(sz / 2, sz / 2, R, Rm, 1); g = keep;
    g.save(); g.globalAlpha = a; g.filter = 'blur(' + Math.min(2.2, R * 0.0045).toFixed(2) + 'px)'; g.drawImage(oc, cx - sz / 2, cy - sz / 2, sz, sz); g.restore();
  }

  // camera path of the asteroid in view space (x right, y down, z depth)
  function rockAt(k) {
    var z = 13 * (1 - k) + 0.75 * k, X = 6.2 * (1 - k) - 1.05 * k, Y = -4.4 * (1 - k) + 0.55 * k;
    return { z: z, sx: W * 0.5 + X / z * W * 0.5, sy: H * 0.42 + Y / z * W * 0.5, R: W * 0.26 / z };
  }

  function frame(now) {
    if (done) return;
    var t = (window.__INTRO_T != null ? window.__INTRO_T : now - start) / 1000;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#04050c'; g.fillRect(0, 0, W, H);

    var neb = ease(t / 1.2);
    [[0.2, 0.22, 0.6, '125,107,255'], [0.85, 0.42, 0.5, '40,190,200'], [0.6, 0.08, 0.38, '200,120,255']].forEach(function (n) {
      var gr = g.createRadialGradient(W * n[0], H * n[1], 0, W * n[0], H * n[1], Math.max(W, H) * n[2]);
      gr.addColorStop(0, 'rgba(' + n[3] + ',' + (0.15 * neb).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(' + n[3] + ',0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    });
    stars.forEach(function (s) {
      var a = (0.3 + 0.7 * Math.abs(Math.sin(t * 1.6 + s.tw))) * (0.35 + s.z * 0.65) * Math.min(1, 0.2 + t * 1.5);
      var col = s.c < 0.15 ? '200,190,255' : s.c > 0.9 ? '255,225,190' : '232,236,255';
      g.fillStyle = 'rgba(' + col + ',' + a.toFixed(2) + ')'; g.beginPath(); g.arc(s.x * W, s.y * H, s.z * 1.1, 0, 7); g.fill();
    });

    // the Sun, just off-frame top right, lighting everything
    var sunA = ease((t - 0.2) / 1);
    var sg = g.createRadialGradient(W * 1.02, -H * 0.04, 0, W * 1.02, -H * 0.04, W * 0.9);
    sg.addColorStop(0, 'rgba(255,240,210,' + (0.85 * sunA).toFixed(3) + ')'); sg.addColorStop(0.08, 'rgba(255,214,150,' + (0.35 * sunA).toFixed(3) + ')'); sg.addColorStop(0.4, 'rgba(255,190,120,' + (0.06 * sunA).toFixed(3) + ')'); sg.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = sg; g.fillRect(0, 0, W, H);

    // forward flight: dust streaks rushing past the camera, easing off as the title lands
    var speed = 1 - 0.85 * ease((t - 2.2) / 1.0), travel = t * 3.2 - Math.max(0, t - 2.2) * 2.4;
    dust.forEach(function (d) {
      var z = ((d.z - travel) % 10 + 10) % 10 + 0.3, z2 = z + 0.35 * speed;
      var x1 = W / 2 + d.x / z * W * 0.5, y1 = H * 0.42 + d.y / z * W * 0.5, x0 = W / 2 + d.x / z2 * W * 0.5, y0 = H * 0.42 + d.y / z2 * W * 0.5;
      var a = clamp((10 - z) / 6) * clamp(t * 2) * 0.6; if (a < 0.02) return;
      g.strokeStyle = 'rgba(210,214,255,' + a.toFixed(3) + ')'; g.lineWidth = Math.min(2.2, 1.6 / z + 0.3); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    });

    // Earth's limb below
    var R = Math.max(W, H) * 0.95, rise = inout((t - 0.2) / 1.3), ecx = W * 0.5, ecy = H + R - H * 0.17 * rise + (1 - rise) * H * 0.15;
    var glow = g.createRadialGradient(ecx, ecy, R * 0.98, ecx, ecy, R * 1.09);
    glow.addColorStop(0, 'rgba(110,190,255,' + (0.55 * rise).toFixed(3) + ')'); glow.addColorStop(0.35, 'rgba(90,150,255,' + (0.18 * rise).toFixed(3) + ')'); glow.addColorStop(1, 'rgba(90,150,255,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(ecx, ecy, R * 1.09, 0, 7); g.fill();
    var body = g.createRadialGradient(ecx + R * 0.35, ecy - R * 0.9, R * 0.1, ecx, ecy, R);
    body.addColorStop(0, '#1d4686'); body.addColorStop(0.5, '#0a1b38'); body.addColorStop(1, '#050b18');
    g.fillStyle = body; g.beginPath(); g.arc(ecx, ecy, R, 0, 7); g.fill();
    var rimE = g.createLinearGradient(ecx + R * 0.6, 0, ecx - R * 0.6, 0); rimE.addColorStop(0, 'rgba(170,220,255,.95)'); rimE.addColorStop(0.55, 'rgba(120,180,255,.55)'); rimE.addColorStop(1, 'rgba(90,140,255,.15)');
    g.strokeStyle = rimE; g.globalAlpha = rise; g.lineWidth = 2; g.beginPath(); g.arc(ecx, ecy, R, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); g.globalAlpha = 1;
    lights.forEach(function (c) {
      var r = R * (1 - c.d), x = ecx + Math.cos(c.a) * r, y = ecy + Math.sin(c.a) * r; if (y > H || x < -5 || x > W + 5) return;
      var tw = 0.55 + 0.45 * Math.sin(t * 3 + c.s * 9), a = rise * tw * (0.35 + c.s * 0.5) * clamp(1 - x / (W * 0.7));
      if (a <= 0.02) return; g.fillStyle = 'rgba(255,214,150,' + Math.min(1, a).toFixed(2) + ')'; g.fillRect(x, y, 1.4, 1.4);
    });

    // the asteroid approaches from deep space, tumbling, and sweeps past the camera
    var k = clamp((t - 0.25) / 2.15), kk = k * k * (3 - 2 * k) * 0.35 + k * 0.65;
    if (k > 0 && k < 1) {
      var P = rockAt(kk), spin = t * 1.1, fade = clamp((P.z - 0.75) / 0.6) * 0.5 + 0.5, appear = clamp(k * 6);
      var fr = frags.map(function (f) { var z = P.z + f.dz * Math.min(1, P.z / 3); return { f: f, z: z, sx: W * 0.5 + ((P.sx - W * 0.5) / (W * 0.5) * P.z + f.dx) / z * W * 0.5, sy: H * 0.42 + ((P.sy - H * 0.42) / (W * 0.5) * P.z + f.dy) / z * W * 0.5, R: W * 0.26 * f.s / z }; });
      var fd = function (q) { drawBody(q.f.b, q.sx, q.sy, q.R, rotM(q.f.sp + t * 2, q.f.sp, 0.3), appear); };
      fr.forEach(function (q) { if (q.z > P.z) fd(q); });
      drawBody(ROCK, P.sx, P.sy, P.R, rotM(0.4 + spin, 0.5 + t * 0.22, 0.35), appear * fade);
      fr.forEach(function (q) { if (q.z <= P.z) fd(q); });
    }

    // a lens glint as it crosses the sunlight, then the frame settles
    var gl = (t - 2.05) / 0.5; if (gl > 0 && gl < 1) {
      var ga = Math.sin(gl * Math.PI) * 0.35, gx = W * (1.1 - gl * 1.2);
      var lg = g.createLinearGradient(gx - W * 0.4, 0, gx + W * 0.4, 0); lg.addColorStop(0, 'rgba(255,230,200,0)'); lg.addColorStop(0.5, 'rgba(255,230,200,' + ga.toFixed(3) + ')'); lg.addColorStop(1, 'rgba(255,230,200,0)');
      g.fillStyle = lg; g.fillRect(0, H * 0.38, W, 2);
    }
    if (t >= DUR / 1000) return finish();
    requestAnimationFrame(frame);
  }
  function finish() { if (done) return; done = true; el.classList.add('done'); setTimeout(function () { el.remove(); }, 650); }
  el.addEventListener('pointerdown', finish);
  window.__introFinish = finish;
  requestAnimationFrame(frame);
})();
