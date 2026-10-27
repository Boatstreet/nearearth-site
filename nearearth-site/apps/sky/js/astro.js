'use strict';
/* ---------- astronomy helpers ---------- */
const A = Astronomy;
const PLANETS = [
  { b: 'Mercury', c: '#c9b9a6' }, { b: 'Venus', c: '#fff1c8' }, { b: 'Mars', c: '#ff8a5c' },
  { b: 'Jupiter', c: '#f3d6ac' }, { b: 'Saturn', c: '#ead9a0' }];

/* matrix: equatorial unit vector (J2000-ish) -> horizontal [east,north,up] */
function horMatrix(date, lat, lon) {
  const lst = (A.SiderealTime(date) * 15 + lon) * D2R, cL = Math.cos(lst), sL = Math.sin(lst);
  const sp = Math.sin(lat * D2R), cp = Math.cos(lat * D2R);
  return [-sL, cL, 0, -sp * cL, -sp * sL, cp, cp * cL, cp * sL, sp];
}
function eqVec(ra, dec) { const r = ra * D2R, d = dec * D2R, c = Math.cos(d); return [c * Math.cos(r), c * Math.sin(r), Math.sin(d)]; }
function applyM(m, v) { return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; }
function altAz(m, ra, dec) { const h = applyM(m, eqVec(ra, dec)); return { alt: Math.asin(clamp(h[2], -1, 1)) * R2D, az: (Math.atan2(h[0], h[1]) * R2D + 360) % 360, v: h }; }

function bodyPos(body, date, obs) {
  const eq = A.Equator(body, date, obs, true, true);
  const h = A.Horizon(date, obs, eq.ra, eq.dec, 'normal');
  return { alt: h.altitude, az: h.azimuth, ra: eq.ra * 15, dec: eq.dec, dist: eq.dist };
}
function compass(az) { return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(az / 45) % 8]; }
function compassS(az) { return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(az / 45) % 8]; }
const asDate = t => t ? t.date : null;

/* ---------- the night ---------- */
function nightOf(ref = new Date()) {
  const obs = observer(), p = partsIn(ref);
  let base = zMidnight(p.y, p.m, p.d);
  // if before local noon, "tonight" began yesterday unless the sun has risen
  if (p.h < 12) {
    const sr = A.SearchRiseSet('Sun', obs, +1, base, 1);
    if (!sr || ref < sr.date) base = new Date(base - 864e5);
  }
  const noon = new Date(+base + 12 * 36e5);
  const f = (dir, alt, from) => { try { return asDate(A.SearchAltitude('Sun', obs, dir, from, 1.2, alt)); } catch (e) { return null; } };
  const r = (dir, from) => { try { return asDate(A.SearchRiseSet('Sun', obs, dir, from, 1.2)); } catch (e) { return null; } };
  const n = { noon, base };
  n.set = r(-1, noon); n.civD = f(-1, -6, noon); n.nauD = f(-1, -12, noon); n.astD = f(-1, -18, noon);
  const from = n.set || noon;
  n.astA = n.astD ? f(+1, -18, n.astD) : null; n.nauA = n.nauD ? f(+1, -12, n.nauD) : null;
  n.civA = n.civD ? f(+1, -6, n.civD) : null; n.rise = r(+1, from);
  n.start = n.set || noon; n.end = n.rise || new Date(+noon + 864e5);
  if (n.end - n.start > 864e5) n.end = new Date(+n.start + 864e5);
  n.darkS = n.astD && n.astA ? n.astD : (n.nauD && n.nauA ? n.nauD : null);
  n.darkE = n.astD && n.astA ? n.astA : (n.nauD && n.nauA ? n.nauA : null);
  n.trueDark = !!(n.astD && n.astA);
  n.darkH = n.darkS ? (n.darkE - n.darkS) / 36e5 : 0;
  n.mid = n.darkS ? new Date((+n.darkS + +n.darkE) / 2) : new Date((+n.start + +n.end) / 2);
  return n;
}

function moonInfo(date, night) {
  const obs = observer(), il = A.Illumination('Moon', date), ph = A.MoonPhase(date);
  const names = ['New Moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full Moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  const idx = Math.round(ph / 45) % 8;
  const rs = (dir) => { try { return asDate(A.SearchRiseSet('Moon', obs, dir, night ? night.noon : date, 1.5)); } catch (e) { return null; } };
  const m = { frac: il.phase_fraction, phase: ph, name: names[idx], rise: rs(+1), set: rs(-1), pos: bodyPos('Moon', date, obs) };
  // fraction of dark hours with the moon above the horizon
  if (night && night.darkS) {
    let up = 0, n = 0;
    for (let t = +night.darkS; t <= +night.darkE; t += 15 * 6e4) { n++; if (bodyPos('Moon', new Date(t), obs).alt > 0) up++; }
    m.upFrac = n ? up / n : 0;
  } else m.upFrac = m.pos.alt > 0 ? 1 : 0;
  return m;
}

function planetsTonight(night) {
  const obs = observer(), s = night.darkS || night.civD || night.start, e = night.darkE || night.civA || night.end;
  return PLANETS.map(p => {
    let best = -90, bt = null, firstUp = null, lastUp = null;
    for (let t = +s; t <= +e; t += 10 * 6e4) {
      const a = bodyPos(p.b, new Date(t), obs).alt;
      if (a > best) { best = a; bt = new Date(t); }
      if (a > 8) { if (!firstUp) firstUp = new Date(t); lastUp = new Date(t); }
    }
    const pos = bodyPos(p.b, bt || night.mid, obs), il = A.Illumination(p.b, bt || night.mid);
    let con = ''; try { con = A.Constellation(pos.ra / 15, pos.dec).name; } catch (er) {}
    return Object.assign({}, p, { best, bt, firstUp, lastUp, mag: il.mag, az: pos.az, con, vis: best > 8 });
  });
}

/* ---------- score ---------- */
function nightScore(night, moon, cloud) {
  if (!night.darkS) {
    const tw = night.nauD ? .35 : night.civD ? .15 : 0;
    return { score: Math.round(100 * tw * (1 - .9 * (cloud ?? 0))), why: night.nauD ? 'No true darkness tonight, only twilight' : 'The sun never sets far enough' };
  }
  const darkF = Math.pow(clamp(night.darkH / 7, 0, 1), .5) * (night.trueDark ? 1 : .7);
  const moonPen = moon.frac * moon.upFrac;
  const c = cloud == null ? 0 : cloud;
  const s = Math.round(100 * darkF * (1 - .9 * c) * (1 - .5 * moonPen));
  const bits = [];
  if (cloud != null) bits.push(c < .15 ? 'clear skies' : c < .45 ? Math.round(c * 100) + '% cloud' : c < .8 ? 'mostly cloudy' : 'overcast');
  bits.push(moonPen < .1 ? 'no moonlight' : moonPen < .4 ? 'some moonlight' : 'bright moon');
  bits.push(night.darkH.toFixed(1).replace('.0', '') + ' h of darkness');
  return { score: clamp(s, 0, 100), why: bits.join(' · ') };
}
function verdict(s) { return s >= 80 ? 'Superb night' : s >= 60 ? 'Good night' : s >= 40 ? 'Fair night' : s >= 20 ? 'Poor night' : 'Stay in tonight'; }

/* ---------- meteor showers (IAU major) ---------- */
const SHOWERS = [
  { n: 'Quadrantids', pk: [1, 4], a: [[12, 28], [1, 12]], z: 110, ra: 230, dec: 49, p: 'asteroid 2003 EH1' },
  { n: 'Lyrids', pk: [4, 22], a: [[4, 14], [4, 30]], z: 18, ra: 271, dec: 34, p: 'comet Thatcher' },
  { n: 'Eta Aquariids', pk: [5, 6], a: [[4, 19], [5, 28]], z: 50, ra: 338, dec: -1, p: "Halley's Comet" },
  { n: 'Southern Delta Aquariids', pk: [7, 30], a: [[7, 12], [8, 23]], z: 25, ra: 340, dec: -16, p: 'comet 96P/Machholz' },
  { n: 'Perseids', pk: [8, 12], a: [[7, 17], [8, 24]], z: 100, ra: 48, dec: 58, p: 'comet Swift–Tuttle' },
  { n: 'Draconids', pk: [10, 8], a: [[10, 6], [10, 10]], z: 10, ra: 262, dec: 54, p: 'comet Giacobini–Zinner' },
  { n: 'Orionids', pk: [10, 21], a: [[10, 2], [11, 7]], z: 20, ra: 95, dec: 16, p: "Halley's Comet" },
  { n: 'Southern Taurids', pk: [10, 10], a: [[9, 10], [11, 20]], z: 5, ra: 32, dec: 9, p: 'comet Encke' },
  { n: 'Northern Taurids', pk: [11, 12], a: [[10, 20], [12, 10]], z: 5, ra: 58, dec: 22, p: 'comet Encke' },
  { n: 'Leonids', pk: [11, 17], a: [[11, 6], [11, 30]], z: 15, ra: 152, dec: 22, p: 'comet Tempel–Tuttle' },
  { n: 'Geminids', pk: [12, 14], a: [[12, 4], [12, 20]], z: 150, ra: 112, dec: 33, p: 'asteroid 3200 Phaethon' },
  { n: 'Ursids', pk: [12, 22], a: [[12, 17], [12, 26]], z: 10, ra: 217, dec: 76, p: 'comet Tuttle' }];
function showerActive(d) {
  const p = partsIn(d), md = p.m * 100 + p.d;
  return SHOWERS.filter(s => { const a = s.a[0][0] * 100 + s.a[0][1], b = s.a[1][0] * 100 + s.a[1][1]; return a <= b ? md >= a && md <= b : md >= a || md <= b; });
}
function showerPeakDate(s, y) { return new Date(+zMidnight(y, s.pk[0], s.pk[1]) + 22 * 36e5); }

/* ---------- events (cached per range) ---------- */
let _ev = null;
function events() {
  const key = place().lat.toFixed(1) + place().lon.toFixed(1);
  if (_ev && _ev.key === key) return _ev.list;
  const obs = observer(), list = [], t0 = new Date(Date.now() - 400 * 864e5), t1 = new Date(Date.now() + 3 * 365 * 864e5);
  try { let q = A.SearchMoonQuarter(t0); while (q.time.date < t1) { if (q.quarter === 0 || q.quarter === 2) list.push({ t: q.time.date, k: 'moon', n: q.quarter === 0 ? 'New Moon' : 'Full Moon', d: q.quarter === 0 ? 'Darkest skies of the month' : 'Moon up all night' }); q = A.NextMoonQuarter(q); } } catch (e) {}
  try { let e = A.SearchLunarEclipse(t0); while (e.peak.date < t1) {
    const vis = bodyPos('Moon', e.peak.date, obs).alt > 0;
    list.push({ t: e.peak.date, k: 'ecl', n: { penumbral: 'Penumbral lunar eclipse', partial: 'Partial lunar eclipse', total: 'Total lunar eclipse' }[e.kind] || 'Lunar eclipse', d: vis ? 'Visible from ' + place().name : 'Moon below your horizon at peak', vis, big: e.kind !== 'penumbral' });
    e = A.NextLunarEclipse(e.peak); } } catch (e) {}
  try { let e = A.SearchLocalSolarEclipse(t0, obs); while (e.peak.time.date < t1) {
    if (e.peak.altitude > 0) list.push({ t: e.peak.time.date, k: 'ecl', n: (e.kind === 'total' ? 'Total' : e.kind === 'annular' ? 'Annular' : 'Partial') + ' solar eclipse', d: Math.round(e.obscuration * 100) + '% of the Sun covered from ' + place().name, vis: true, big: true, solar: true, obsc: e.obscuration });
    e = A.NextLocalSolarEclipse(e.peak.time, obs); } } catch (e) {}
  try { let e = A.SearchGlobalSolarEclipse(t0); while (e.peak.date < t1) {
    if (!list.some(x => x.solar && Math.abs(x.t - e.peak.date) < 2 * 864e5)) list.push({ t: e.peak.date, k: 'ecl', n: (e.kind === 'total' ? 'Total' : e.kind === 'annular' ? 'Annular' : e.kind === 'hybrid' ? 'Hybrid' : 'Partial') + ' solar eclipse', d: 'Not visible from ' + place().name, vis: false });
    e = A.NextGlobalSolarEclipse(e.peak); } } catch (e) {}
  for (const b of ['Mars', 'Jupiter', 'Saturn']) { try { let t = t0; for (let i = 0; i < 4; i++) { const o = A.SearchRelativeLongitude(b, 180, t); if (!o || o.date > t1) break; list.push({ t: o.date, k: 'pl', n: b + ' at opposition', d: 'Biggest and brightest, up all night' }); t = new Date(+o.date + 30 * 864e5); } } catch (e) {} }
  for (const b of ['Mercury', 'Venus']) { try { let t = t0; for (let i = 0; i < 12; i++) { const o = A.SearchMaxElongation(b, t); if (!o || o.time.date > t1) break; list.push({ t: o.time.date, k: 'pl', n: b + ' furthest from the Sun', d: Math.round(o.elongation) + '° ' + (o.visibility === 'evening' ? 'after sunset' : 'before sunrise') + ', best time to spot it' }); t = new Date(+o.time.date + 10 * 864e5); } } catch (e) {} }
  for (let y = partsIn(t0).y; y <= partsIn(t1).y; y++) SHOWERS.forEach(s => { const t = showerPeakDate(s, y); if (t > t0 && t < t1) list.push({ t, k: 'met', n: s.n + ' peak', d: 'Up to ' + s.z + ' meteors an hour · from ' + s.p, sh: s }); });
  list.sort((a, b) => a.t - b.t);
  _ev = { key, list }; return list;
}

