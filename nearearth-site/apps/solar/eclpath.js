/* Solar — where an eclipse is total or annular on Earth: the Moon's shadow traced over the globe,
   the countries it crosses, and how close it comes to you. Uses Astronomy Engine and the WORLD outlines. */
(function () {
  'use strict';
  const A = window.Astronomy;
  const KM = A.KM_PER_AU, RE = 6371.0, R_SUN = 695700, R_MOON = 1737.4, D2R = Math.PI / 180;

  // ---- countries: point in polygon (outlines in tenths of a degree) ----
  let C = null;
  function countries() {
    if (C) return C;
    C = (window.WORLD || []).map(([name, rings]) => ({
      name,
      rings: rings.map((r) => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); y0 = Math.min(y0, r[i + 1]); y1 = Math.max(y1, r[i + 1]); } return { r, x0, x1, y0, y1 }; }),
    }));
    return C;
  }
  function countryAt(lat, lon) {
    const y = lat * 10;
    for (const c of countries()) {
      let inside = false;
      for (const g of c.rings) {
        // rings across the date line run past +180°, so test the point there too
        const x = g.x1 > 1800 && lon < 0 ? lon * 10 + 3600 : lon * 10;
        if (x < g.x0 || x > g.x1 || y < g.y0 || y > g.y1) continue;
        const r = g.r;
        for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
          const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
      }
      if (inside) {
        // Natural Earth keeps some far-away territories under their country
        if (c.name === 'France' && lon < -30) return 'French Guiana';
        if (c.name === 'United States' && lat > 51) return 'Alaska (US)';
        if (c.name === 'United States' && lat < 23 && lon < -150) return 'Hawaii (US)';
        return c.name;
      }
    }
    return null;
  }

  // ---- the Moon's shadow axis meeting the Earth ----
  function shadowAt(date) {
    const t = A.MakeTime(date);
    const m = A.GeoVector(A.Body.Moon, t, true), s = A.GeoVector(A.Body.Sun, t, true);
    const mv = [m.x * KM, m.y * KM, m.z * KM], sv = [s.x * KM, s.y * KM, s.z * KM];
    let d = [mv[0] - sv[0], mv[1] - sv[1], mv[2] - sv[2]];
    const D = Math.hypot(d[0], d[1], d[2]); d = [d[0] / D, d[1] / D, d[2] / D];
    const b = mv[0] * d[0] + mv[1] * d[1] + mv[2] * d[2];
    const c = mv[0] * mv[0] + mv[1] * mv[1] + mv[2] * mv[2] - RE * RE;
    const disc = b * b - c;
    if (disc < 0) return null;
    const L = -b - Math.sqrt(disc); // km from the Moon to the ground along the axis
    const p = [mv[0] + L * d[0], mv[1] + L * d[1], mv[2] + L * d[2]];
    const o = A.VectorObserver(new A.Vector(p[0] / KM, p[1] / KM, p[2] / KM, t), false);
    const rU = R_MOON - (L * (R_SUN - R_MOON)) / D; // umbra (>0) or antumbra (<0) radius, km
    return { t: date, lat: o.latitude, lon: o.longitude, r: rU };
  }

  function km(a, b) {
    const t = (x) => x * D2R, dLat = t(b.lat - a.lat), dLon = t(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * RE * Math.asin(Math.sqrt(Math.min(1, h)));
  }
  function bearing(a, b) {
    const t = (x) => x * D2R, y = Math.sin(t(b.lon - a.lon)) * Math.cos(t(b.lat));
    const x = Math.cos(t(a.lat)) * Math.sin(t(b.lat)) - Math.sin(t(a.lat)) * Math.cos(t(b.lat)) * Math.cos(t(b.lon - a.lon));
    return (Math.atan2(y, x) / D2R + 360) % 360;
  }

  // Is the eclipse total or annular at this place and moment? (the Moon's disk wholly inside or covering the Sun's)
  function central(lat, lon, date) {
    const t = A.MakeTime(date), obs = new A.Observer(lat, lon, 0);
    const s = A.Equator(A.Body.Sun, t, obs, true, true), m = A.Equator(A.Body.Moon, t, obs, true, true);
    const h = A.Horizon(t, obs, s.ra, s.dec, '');
    if (h.altitude < -0.5) return false;
    const rs = Math.asin(R_SUN / (s.dist * KM)), rm = Math.asin(R_MOON / (m.dist * KM));
    const sep = A.AngleBetween(s.vec, m.vec) * D2R;
    return sep <= Math.abs(rs - rm);
  }
  function dest(p, brg, d) {
    const t = D2R, la = p.lat * t, lo = p.lon * t, b = brg * t, a = d / RE;
    const la2 = Math.asin(Math.sin(la) * Math.cos(a) + Math.cos(la) * Math.sin(a) * Math.cos(b));
    const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(a) * Math.cos(la), Math.cos(a) - Math.sin(la) * Math.sin(la2));
    return [la2 / t, ((lo2 / t + 540) % 360) - 180];
  }
  // Trace the central path of a global eclipse (from SearchGlobalSolarEclipse) and describe it.
  const memo = {};
  function describe(g) {
    const key = +g.peak.date;
    if (memo[key]) return memo[key];
    const pts = [], peak = +g.peak.date;
    for (let k = -480; k <= 480; k++) { // every 30 s over ±4 h
      const p = shadowAt(new Date(peak + k * 30000));
      if (p) pts.push(p);
    }
    const list = [];
    let ocean = false;
    const add = (c) => { if (c && !list.includes(c)) list.push(c); };
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      const c = countryAt(p.lat, p.lon);
      add(c); if (!c) ocean = true;
      // The ground path is wider than the shadow itself when the Sun is low: walk out to both sides
      // (every 2 minutes of the path) and keep going while the eclipse there is still total/annular.
      if (i % 4 === 0 && q !== o) {
        const dir = bearing(o, q);
        for (const side of [90, -90]) {
          for (let k = 1; k <= 12; k++) {
            const [la, lo] = dest(p, dir + side, Math.abs(p.r) * 0.35 * k);
            if (!central(la, lo, p.t)) break;
            add(countryAt(la, lo));
          }
        }
      }
    }
    // the longest total/annular phase, at the point of greatest eclipse
    let dur = null, where = null;
    if (g.latitude != null) {
      where = countryAt(g.latitude, g.longitude);
      try {
        const e = A.SearchLocalSolarEclipse(new Date(peak - 864e5 / 2), new A.Observer(g.latitude, g.longitude, 0));
        if (e.total_begin && e.total_end) dur = (e.total_end.time.date - e.total_begin.time.date) / 1000;
      } catch (x) { }
    }
    const mid = pts.reduce((a, p) => (Math.abs(+p.t - peak) < Math.abs(+a.t - peak) ? p : a), pts[0] || { t: peak, r: 0 });
    return (memo[key] = { kind: g.kind, peak: g.peak.date, pts, countries: list, ocean, dur, where, gmax: g.latitude != null ? { lat: g.latitude, lon: g.longitude } : null, width: Math.round(Math.abs(mid.r) * 2) });
  }
  function nearest(desc, place) {
    let best = null;
    for (const p of desc.pts) { const d = km(place, p); if (!best || d < best.d) best = { d, p }; }
    if (!best) return null;
    return { km: Math.max(0, best.d - desc.width / 2), dir: bearing(place, best.p), country: countryAt(best.p.lat, best.p.lon) };
  }

  // The next eclipses of a kind, anywhere on Earth.
  function upcoming(kind, n, from) {
    const out = [];
    let g = A.SearchGlobalSolarEclipse(from || new Date());
    for (let i = 0; i < 40 && out.length < n; i++) {
      if (g.kind === kind) out.push(g);
      g = A.NextGlobalSolarEclipse(g.peak);
    }
    return out;
  }

  // ---- a small world map with the path ----
  let LAND = null;
  function landPath() {
    if (LAND) return LAND;
    let d = '';
    for (const [, rings] of (window.WORLD || [])) for (const r of rings) {
      const draw = (shift) => { d += 'M' + ((r[0] + shift) / 10).toFixed(1) + ' ' + (-r[1] / 10).toFixed(1); for (let i = 2; i < r.length; i += 2) d += 'L' + ((r[i] + shift) / 10).toFixed(1) + ' ' + (-r[i + 1] / 10).toFixed(1); d += 'Z'; };
      draw(0);
      if (r.some((x, i) => i % 2 === 0 && x > 1800)) draw(-3600); // date-line rings: draw the wrapped copy too
    }
    return (LAND = d);
  }
  function map(desc, place, opts) {
    const lat0 = 80, lat1 = -60;
    let line = '', prev = null;
    for (const p of desc.pts) {
      const x = p.lon.toFixed(2), y = (-p.lat).toFixed(2);
      line += (prev == null || Math.abs(p.lon - prev) > 180 ? 'M' : 'L') + x + ' ' + y;
      prev = p.lon;
    }
    const col = desc.kind === 'total' ? '#f4f1ff' : '#ffb07a';
    const w = Math.max(1.6, (desc.width / 111) * 1.0);
    return `<svg class="eclmap" viewBox="-180 ${-lat0} 360 ${lat0 - lat1}" preserveAspectRatio="xMidYMid meet">
      <rect x="-180" y="${-lat0}" width="360" height="${lat0 - lat1}" class="emsea"/>
      <path d="${landPath()}" class="emland"/>
      <path d="${line}" fill="none" stroke="${col}" stroke-opacity=".35" stroke-width="${(w + 3).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${line}" fill="none" stroke="${col}" stroke-width="${w.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>
      ${desc.gmax ? `<circle cx="${desc.gmax.lon.toFixed(1)}" cy="${(-desc.gmax.lat).toFixed(1)}" r="2.6" fill="${col}" stroke="#0b1424" stroke-width="1"/>` : ''}
      ${place ? `<circle cx="${place.lon.toFixed(1)}" cy="${(-place.lat).toFixed(1)}" r="3.2" fill="var(--accent)" stroke="#0b1424" stroke-width="1.4"/>` : ''}
    </svg>`;
  }

  window.EclPath = { shadowAt, describe, nearest, upcoming, countryAt, km, bearing, map, central };
})();
