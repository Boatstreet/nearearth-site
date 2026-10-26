/* Solar — tiny SVG charts */
(function () {
  'use strict';
  const W = 340;

  function kpColor(k) {
    if (k >= 8) return '#ff4d6d';
    if (k >= 7) return '#ff6b4a';
    if (k >= 6) return '#ff8f3d';
    if (k >= 5) return '#ffb13d';
    if (k >= 4) return '#e8d454';
    return '#6fcf97';
  }

  // Generic time-series line. series: [{pts:[{t,v}], color, width, fill}]
  function line(series, o) {
    o = o || {};
    const H = o.h || 130, sp = !!o.spark, L = sp ? 0 : 34, R = sp ? 0 : 6, T = sp ? 3 : 8, B = sp ? 3 : 20;
    const all = series.flatMap((s) => s.pts.filter((p) => p.v != null));
    if (all.length < 2) return '<div class="nochart">No data yet</div>';
    const t0 = o.t0 || Math.min(...all.map((p) => +p.t)), t1 = o.t1 || Math.max(...all.map((p) => +p.t));
    const log = !!o.log, f = (v) => (log ? Math.log10(v) : v);
    let y0 = o.yMin != null ? o.yMin : Math.min(...all.map((p) => f(p.v)));
    let y1 = o.yMax != null ? o.yMax : Math.max(...all.map((p) => f(p.v)));
    if (o.yMin == null || o.yMax == null) { const pad = (y1 - y0) * 0.1 || 1; if (o.yMin == null) y0 -= pad; if (o.yMax == null) y1 += pad; }
    if (o.sym) { const m = Math.max(Math.abs(y0), Math.abs(y1)); y0 = -m; y1 = m; }
    const X = (t) => L + ((t - t0) / (t1 - t0 || 1)) * (W - L - R);
    const Y = (v) => T + (1 - (f(v) - y0) / (y1 - y0 || 1)) * (H - T - B);
    const Yr = (fv) => T + (1 - (fv - y0) / (y1 - y0 || 1)) * (H - T - B);
    let h = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
    // bands (e.g. flare classes)
    for (const b of o.bands || []) {
      const ya = Yr(Math.min(b.to, y1)), yb = Yr(Math.max(b.from, y0));
      if (yb <= ya) continue;
      h += `<rect x="${L}" y="${ya}" width="${W - L - R}" height="${yb - ya}" fill="${b.color}" opacity=".07"/>`;
      h += `<text x="${W - R - 3}" y="${ya + 11}" class="band" text-anchor="end">${b.label}</text>`;
    }
    // y grid
    const ticks = o.ticks || niceTicks(y0, y1, 4);
    for (const v of ticks) {
      const y = Yr(v); if (y < T - 1 || y > H - B + 1) continue;
      h += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="grid${v === 0 ? ' zero' : ''}"/>`;
      h += `<text x="${L - 5}" y="${y + 3.5}" class="yl" text-anchor="end">${o.tickFmt ? o.tickFmt(v) : v}</text>`;
    }
    // x labels
    const span = t1 - t0, step = o.xStep || (span > 4 * 864e5 ? 864e5 : span > 30 * 3600e3 ? 12 * 3600e3 : span > 10 * 3600e3 ? 6 * 3600e3 : 3600e3 * 2);
    const local = !U.Fmt.utcMode(), off = local ? new Date().getTimezoneOffset() * 60000 : 0;
    const xs = []; if (o.xTicks) xs.push(...o.xTicks); else for (let t = Math.ceil((t0 - off) / step) * step + off; !sp && t <= t1; t += step) xs.push(t);
    for (const t of sp ? [] : xs) {
      const x = X(t), d = new Date(t);
      if (x < L + 8 || x > W - R - 8) continue;
      const lab = o.xFmt ? o.xFmt(d) : step >= 864e5 ? U.Fmt.day(d).split(' ').slice(1).join(' ') : U.Fmt.hour(d) + 'h';
      h += `<line x1="${x}" x2="${x}" y1="${T}" y2="${H - B}" class="grid v"/><text x="${x}" y="${H - 6}" class="xl" text-anchor="middle">${lab}</text>`;
    }
    for (const s of series) {
      const pts = s.pts.filter((p) => p.v != null && (!log || p.v > 0));
      if (pts.length < 2) continue;
      let d = '', prev = null;
      for (const p of pts) {
        const gap = prev && (p.t - prev.t) > (o.gap || 20 * 60000);
        d += (d && !gap ? 'L' : 'M') + X(+p.t).toFixed(1) + ',' + Y(p.v).toFixed(1);
        prev = p;
      }
      if (s.fill) {
        const base = o.sym ? Yr(0) : H - B;
        h += `<path d="${d}L${X(+pts[pts.length - 1].t).toFixed(1)},${base}L${X(+pts[0].t).toFixed(1)},${base}Z" fill="${s.fill}" opacity=".18"/>`;
      }
      h += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 1.6}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
    }
    if (o.now) { const x = X(Date.now()); if (x > L && x < W - R) h += `<line x1="${x}" x2="${x}" y1="${T}" y2="${H - B}" class="nowline"/>`; }
    return h + '</svg>';
  }

  function niceTicks(a, b, n) {
    const span = b - a; if (!(span > 0)) return [a];
    const raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const st = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
    const out = []; for (let v = Math.ceil(a / st) * st; v <= b + 1e-9; v += st) out.push(+v.toFixed(6));
    return out;
  }

  // Kp bars: observed + forecast, 3-hour blocks
  function kpBars(rows, o) {
    o = o || {};
    const H = o.h || 120, L = 22, R = 4, T = 6, B = 20;
    if (!rows.length) return '<div class="nochart">No data yet</div>';
    const n = rows.length, bw = (W - L - R) / n;
    let h = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
    for (const v of [0, 3, 5, 7, 9]) {
      const y = T + (1 - v / 9) * (H - T - B);
      h += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="grid${v === 5 ? ' storm' : ''}"/><text x="${L - 5}" y="${y + 3.5}" class="yl" text-anchor="end">${v}</text>`;
    }
    let lastDay = null;
    rows.forEach((r, i) => {
      const x = L + i * bw, hgt = Math.max(1.5, (r.kp / 9) * (H - T - B));
      const fc = r.kind && r.kind !== 'observed' && r.kind !== 'estimated';
      h += `<rect x="${(x + bw * 0.12).toFixed(1)}" y="${(H - B - hgt).toFixed(1)}" width="${(bw * 0.76).toFixed(1)}" height="${hgt.toFixed(1)}" rx="1.5" fill="${kpColor(r.kp)}" opacity="${fc ? 0.45 : 0.95}"${fc ? ' class="fcbar"' : ''}/>`;
      const day = U.Fmt.day(r.t);
      if (day !== lastDay) {
        if (lastDay !== null) h += `<line x1="${x}" x2="${x}" y1="${T}" y2="${H - B}" class="grid v"/>`;
        h += `<text x="${x + 2}" y="${H - 6}" class="xl">${day.split(' ').slice(0, 2).join(' ')}</text>`;
        lastDay = day;
      }
    });
    return h + '</svg>';
  }

  // Arc gauge 0..max
  function gauge(v, max, color, o) {
    o = o || {};
    const r = 38, cx = 50, cy = 50, a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
    const p = Math.max(0, Math.min(1, (v || 0) / max)), a = a0 + (a1 - a0) * p;
    const pt = (ang) => [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
    const [x0, y0] = pt(a0), [x1, y1] = pt(a1), [xa, ya] = pt(a);
    const big = (a1 - a0) > Math.PI ? 1 : 0, bigA = (a - a0) > Math.PI ? 1 : 0;
    return `<svg class="gauge" viewBox="0 0 100 92"><path d="M${x0},${y0}A${r},${r} 0 ${big} 1 ${x1},${y1}" class="gtrack"/>` +
      (v != null ? `<path d="M${x0},${y0}A${r},${r} 0 ${bigA} 1 ${xa},${ya}" stroke="${color}" class="gval"/><circle cx="${xa}" cy="${ya}" r="5" fill="${color}" class="gdot"/>` : '') + '</svg>';
  }

  window.Charts = { line, kpBars, gauge, kpColor, niceTicks };
})();
