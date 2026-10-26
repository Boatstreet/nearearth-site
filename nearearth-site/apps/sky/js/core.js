'use strict';
/* clean archive list: drop non-pulsar diagnostics; the interstellar object moves, so keep it off the map */
window.SETIDATA.forEach(t => { if (/^DIAG_/i.test(t.id) && !/PSR/i.test(t.id)) t.k = 'object'; });  // keep indices: OBSDAYS refers to them
window.SETIDATA.forEach(t => { if (/OUMUAMUA/i.test(t.id)) { t.k = 'object'; t.nm = '\u02bbOumuamua'; } });
/* ---------- core: state, bridge, utils, sheet, places, settings ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtN = n => n.toLocaleString('en-US');

const store = {
  get(k, d) { try { const v = localStorage.getItem('sky.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('sky.' + k, JSON.stringify(v)); } catch (e) {} }
};

const S = {
  prefs: Object.assign({
    h24: true, tempC: true, red: false, setiLayer: true, lines: true, labels: true,
    nDark: true, nIss: true, nMeteor: true, nEclipse: true, useGps: true
  }, store.get('prefs', {})),
  places: store.get('places', []),
  placeIdx: store.get('placeIdx', -1),       // -1 = current location
  gps: store.get('gps', null),               // {lat,lon,name,tz}
  view: 'tonight',
  wx: null, kp: null, tle: null,
};
function savePrefs() { store.set('prefs', S.prefs); }

/* place helpers */
function place() {
  if (S.placeIdx >= 0 && S.places[S.placeIdx]) return S.places[S.placeIdx];
  return S.gps || { lat: 51.4779, lon: -0.0015, name: 'Greenwich', tz: 'Europe/London', fallback: true };
}
function observer() { const p = place(); return new Astronomy.Observer(p.lat, p.lon, p.elev || 0); }
function tzOf() { return place().tz || Intl.DateTimeFormat().resolvedOptions().timeZone; }

/* ---------- time formatting in place's timezone ---------- */
const _dtf = {};
function dtf(opts) {
  const k = tzOf() + JSON.stringify(opts) + S.prefs.h24;
  if (!_dtf[k]) { try { _dtf[k] = new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: tzOf(), hourCycle: S.prefs.h24 ? 'h23' : 'h12' }, opts)); } catch (e) { _dtf[k] = new Intl.DateTimeFormat('en-GB', Object.assign({ hourCycle: S.prefs.h24 ? 'h23' : 'h12' }, opts)); } }
  return _dtf[k];
}
const fT = d => d ? dtf({ hour: '2-digit', minute: '2-digit' }).format(d).replace(' ', ' ') : '–';
const fTs = d => dtf({ hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(d);
const fD = d => dtf({ weekday: 'short', day: 'numeric', month: 'short' }).format(d);
const fDl = d => dtf({ weekday: 'long', day: 'numeric', month: 'long' }).format(d);
const fDm = d => dtf({ day: 'numeric', month: 'short', year: 'numeric' }).format(d);
function partsIn(d) {   // y,m,d,h,min in place tz
  const p = {}; dtf({ year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).forEach(x => p[x.type] = x.value);
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute };
}
function tzOffsetMin(d) { const p = partsIn(d); return Math.round((Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - Math.floor(d / 60000) * 60000) / 60000); }
/* local midnight (in place tz) for y,m,d -> Date */
function zMidnight(y, m, d) {
  let t = Date.UTC(y, m - 1, d); let off = tzOffsetMin(new Date(t)); t -= off * 60000;
  const off2 = tzOffsetMin(new Date(t)); if (off2 !== off) t += (off - off2) * 60000; return new Date(t);
}
function dayKey(d) { const p = partsIn(d); return p.y + '-' + String(p.m).padStart(2, '0') + '-' + String(p.d).padStart(2, '0'); }
function relDay(d) {
  const a = dayKey(new Date()), b = dayKey(d);
  if (a === b) return 'Today'; if (dayKey(new Date(Date.now() + 864e5)) === b) return 'Tomorrow';
  return fD(d);
}
function until(ms) {
  if (ms < 0) return 'now'; const m = Math.round(ms / 60000);
  if (m < 60) return 'in ' + m + ' min'; const h = Math.floor(m / 60);
  if (h < 48) return 'in ' + h + ' h ' + (m % 60 ? (m % 60) + ' min' : ''); return 'in ' + Math.round(h / 24) + ' days';
}

/* ---------- native bridge ---------- */
const N = (() => {
  const has = typeof window.Native !== 'undefined';
  const cbs = {}; let seq = 0;
  window.__cb = (id, json) => { const f = cbs[id]; delete cbs[id]; if (f) { let v; try { v = JSON.parse(json); } catch (e) { v = json; } f(v); } };
  function call(name, ...args) {
    return new Promise(res => { const id = 'c' + (++seq); cbs[id] = res; try { window.Native[name](...args, id); } catch (e) { delete cbs[id]; res({ error: String(e) }); } });
  }
  return {
    has,
    async get(url) {
      if (has) { const r = await call('get', url); if (r.status >= 200 && r.status < 300) return r.body; throw new Error('HTTP ' + (r.status || r.error)); }
      const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text();
    },
    async json(url) { return JSON.parse(await this.get(url)); },
    locate() {
      if (has) return call('locate');
      return new Promise(res => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lon: p.coords.longitude }), e => res({ error: e.message }), { timeout: 12000 }) : res({ error: 'no gps' }));
    },
    haptic(ms = 12) { try { has ? window.Native.haptic(ms) : navigator.vibrate && navigator.vibrate(ms); } catch (e) {} },
    share(t) { try { has ? window.Native.share(t) : navigator.share && navigator.share({ text: t }); } catch (e) {} },
    compass(on) { try { has && window.Native.compass(!!on); } catch (e) {} },
    schedule(list) { try { has && window.Native.schedule(JSON.stringify(list)); } catch (e) {} },
    awake(on) { try { has && window.Native.keepAwake(!!on); } catch (e) {} },
  };
})();

/* ---------- ui helpers ---------- */
let _tt;
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(_tt); _tt = setTimeout(() => e.classList.remove('on'), 2400); }
function sync(state, text) { const d = $('#syncDot'); d.className = state === 'busy' ? 'busy' : state === 'err' ? 'err' : ''; $('#syncText').textContent = text; }

const Sheet = {
  open(html, after) {
    $('#sheetIn').innerHTML = html; $('#sheetIn').scrollTop = 0;
    $('#sheet').classList.add('on'); $('#sheetBg').classList.add('on'); N.haptic(8);
    if (after) after($('#sheetIn'));
  },
  close() { $('#sheet').classList.remove('on'); $('#sheetBg').classList.remove('on'); if (Sheet.onclose) { const f = Sheet.onclose; Sheet.onclose = null; f(); } }
};
(function sheetDrag() {
  let y0 = null, dy = 0; const sh = $('#sheet');
  sh.addEventListener('touchstart', e => { if ($('#sheetIn').scrollTop > 0 && !e.target.closest('.grab')) return; y0 = e.touches[0].clientY; dy = 0; sh.style.transition = 'none'; }, { passive: true });
  sh.addEventListener('touchmove', e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
  sh.addEventListener('touchend', () => { if (y0 == null) return; sh.style.transition = ''; sh.style.transform = ''; if (dy > 110) Sheet.close(); y0 = null; });
  $('#sheetBg').onclick = () => Sheet.close();
})();

function hidpi(c, w, h) {
  const r = Math.min(window.devicePixelRatio || 1, 2.5);
  w = w || c.clientWidth; h = h || c.clientHeight;
  if (c.width !== Math.round(w * r) || c.height !== Math.round(h * r)) { c.width = Math.round(w * r); c.height = Math.round(h * r); }
  const x = c.getContext('2d'); x.setTransform(r, 0, 0, r, 0, 0); return { x, w, h, r };
}

/* deterministic random */
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

/* star colour from B-V */
function bvColor(bv) {
  bv = clamp(bv, -0.4, 2.0);
  const stops = [[-0.4, [155, 176, 255]], [0, [202, 216, 255]], [0.4, [248, 247, 255]], [0.8, [255, 236, 210]], [1.2, [255, 210, 160]], [1.6, [255, 180, 120]], [2.0, [255, 150, 100]]];
  for (let i = 1; i < stops.length; i++) if (bv <= stops[i][0]) {
    const [a, ca] = stops[i - 1], [b, cb] = stops[i], t = (bv - a) / (b - a);
    return `rgb(${ca.map((c, j) => Math.round(lerp(c, cb[j], t))).join(',')})`;
  }
  return 'rgb(255,150,100)';
}
function spColor(sp) {
  const c = (sp || 'G')[0].toUpperCase();
  return { O: '#9bb0ff', B: '#aabfff', A: '#cad7ff', F: '#f8f7ff', G: '#fff1cc', K: '#ffd2a1', M: '#ffad7a' }[c] || '#e8ecff';
}
function spWord(sp) {
  const c = (sp || '')[0];
  return { O: 'blue giant', B: 'blue-white star', A: 'white star', F: 'yellow-white star', G: 'Sun-like yellow star', K: 'orange dwarf', M: 'red dwarf' }[c] || 'star';
}
function setiName(t) {
  if (t.nm) return t.nm;
  const m = t.id.match(/^HIP_?(\d+)/i); if (m) return 'HIP ' + m[1];
  const g = t.id.match(/^GJ_?(.+)/i); if (g) return 'Gliese ' + g[1];
  if (t.k === 'pulsar') return t.id.replace(/^DIAG_?/i, '').replace(/^PSR_?/i, 'PSR ').replace('_', ' ');
  return t.id.replace(/_/g, ' ');
}
function setiCode(t) { const m = t.id.match(/^HIP_?(\d+)/i); if (m) return 'HIP ' + m[1]; const g = t.id.match(/^GJ_?(.+)/i); if (g) return 'GJ ' + g[1]; return t.id.replace(/_/g, ' '); }
const CONS = n => (window.SKYDATA.cons[n] || {}).n || n || '';

/* ---------- places ---------- */
const PIN = '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
const GPS = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7.5"/></svg>';
function openPlaces() {
  const list = () => {
    let h = `<button class="plc ${S.placeIdx < 0 ? 'cur' : ''}" data-i="-1"><span class="pi">${GPS}</span><div><b>Current location</b><small>${S.gps ? esc(S.gps.name) : 'Use GPS'}</small></div></button>`;
    S.places.forEach((p, i) => h += `<div class="plc ${S.placeIdx === i ? 'cur' : ''}" data-i="${i}"><span class="pi">${PIN}</span><div><b>${esc(p.name)}</b><small>${esc(p.sub || '')} · ${p.lat.toFixed(2)}°, ${p.lon.toFixed(2)}°</small></div><button class="x" data-del="${i}">✕</button></div>`);
    return h;
  };
  Sheet.open(`<h2>Places</h2><input class="search" id="plQ" placeholder="Search city or town" autocomplete="off"><div id="plRes"></div><h3>Saved</h3><div id="plList">${list()}</div>`, el => {
    const res = $('#plRes', el); let t;
    $('#plQ', el).oninput = e => {
      clearTimeout(t); const q = e.target.value.trim(); if (q.length < 2) { res.innerHTML = ''; return; }
      t = setTimeout(async () => {
        res.innerHTML = '<div class="skel"></div><div class="skel"></div>';
        try {
          const j = await N.json('https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&name=' + encodeURIComponent(q));
          res.innerHTML = (j.results || []).map((r, i) => `<button class="plc" data-r="${i}"><span class="pi">${PIN}</span><div><b>${esc(r.name)}</b><small>${esc([r.admin1, r.country].filter(Boolean).join(', '))}</small></div></button>`).join('') || '<p class="muted" style="padding:10px 4px">No matches</p>';
          $$('[data-r]', res).forEach(b => b.onclick = () => {
            const r = j.results[+b.dataset.r];
            S.places.push({ name: r.name, sub: [r.admin1, r.country].filter(Boolean).join(', '), lat: r.latitude, lon: r.longitude, tz: r.timezone, elev: r.elevation || 0 });
            S.placeIdx = S.places.length - 1; savePlaces(); Sheet.close(); App.placeChanged();
          });
        } catch (err) { res.innerHTML = '<p class="muted" style="padding:10px 4px">Search needs an internet connection.</p>'; }
      }, 350);
    };
    $('#plList', el).onclick = e => {
      const del = e.target.closest('[data-del]');
      if (del) { const i = +del.dataset.del; S.places.splice(i, 1); if (S.placeIdx === i) S.placeIdx = -1; else if (S.placeIdx > i) S.placeIdx--; savePlaces(); $('#plList', el).innerHTML = list(); App.placeChanged(); return; }
      const row = e.target.closest('[data-i]'); if (!row) return;
      S.placeIdx = +row.dataset.i; savePlaces(); Sheet.close(); App.placeChanged(); if (S.placeIdx < 0) App.locate(true);
    };
  });
}
function savePlaces() { store.set('places', S.places); store.set('placeIdx', S.placeIdx); }

/* ---------- settings ---------- */
function openSettings() {
  const sw = (k, t, s) => `<div class="row"><div>${t}${s ? `<small>${s}</small>` : ''}</div><button class="sw ${S.prefs[k] ? 'on' : ''}" data-k="${k}"></button></div>`;
  Sheet.open(`<h2>Settings</h2>
    <h3>Display</h3>
    <div class="row"><div>Time format</div><div class="opt" data-o="h24"><button data-v="1" class="${S.prefs.h24 ? 'on' : ''}">24 h</button><button data-v="0" class="${!S.prefs.h24 ? 'on' : ''}">12 h</button></div></div>
    <div class="row"><div>Temperature</div><div class="opt" data-o="tempC"><button data-v="1" class="${S.prefs.tempC ? 'on' : ''}">°C</button><button data-v="0" class="${!S.prefs.tempC ? 'on' : ''}">°F</button></div></div>
    ${sw('red', 'Night vision', 'Turns the whole app red so your eyes stay dark-adapted')}
    <h3>Sky map</h3>
    ${sw('setiLayer', 'Show listened-to stars', 'Cyan rings on every SETI target')}
    ${sw('lines', 'Constellation lines')}
    ${sw('labels', 'Labels')}
    <h3>Notifications</h3>
    ${sw('nDark', 'Clear dark nights', 'At dusk when tonight scores 70 or more')}
    ${sw('nMeteor', 'Meteor shower peaks', 'Evening before the peak')}
    ${sw('nEclipse', 'Eclipses', 'The day before, when visible from your place')}
    <h3>About</h3>
    <p class="muted" style="font-size:12.5px;line-height:1.6">Sky ${App.version}. SETI targets and observation dates come from the Breakthrough Listen public archive index (UC Berkeley SETI Research Center). Star distances: HYG database. Stars and constellations: d3-celestial (Yale Bright Star / Hipparcos). Positions: Astronomy Engine. Weather: Open-Meteo. Aurora: NOAA SWPC. No account, no tracking; your places stay on your phone.</p>`, el => {
    $$('.sw', el).forEach(b => b.onclick = () => { const k = b.dataset.k; S.prefs[k] = !S.prefs[k]; b.classList.toggle('on', S.prefs[k]); savePrefs(); N.haptic(10); App.prefsChanged(k); });
    $$('.opt', el).forEach(o => o.onclick = e => { const b = e.target.closest('button'); if (!b) return; S.prefs[o.dataset.o] = b.dataset.v === '1'; $$('button', o).forEach(x => x.classList.toggle('on', x === b)); savePrefs(); App.prefsChanged(o.dataset.o); });
  });
}

function openGuide() {
  Sheet.open(`<div class="gd"><h2>Guide</h2>
  <h3>Tonight</h3><p>The big number scores tonight from 0 to 100 for stargazing: how long it stays properly dark, how much the Moon washes the sky out, and the cloud forecast for the dark hours. The bar shows the night from dusk to dawn: lighter blue is twilight, deep navy is true darkness, and grey blocks are forecast cloud.</p>
  <h3>Sky</h3><p><b>Dome</b> shows the whole sky as if you were lying on your back, with the horizon around the edge. <b>Look</b> is a window you drag around. Tap the compass to let the phone steer: hold it up and the map follows where you point. Drag the time slider to wind the sky forwards or back by 12 hours. Cyan rings mark stars the Breakthrough Listen team pointed the Green Bank Telescope at.</p>
  <h3>Listen</h3><p>Breakthrough Listen is the largest search yet for radio signals from other civilisations. The list here is the real public index of their Green Bank observations from 2016 to 2018: 45,815 recordings, counting the OFF pointings, of ${fmtN(SETIDATA.filter(t => t.k === 'star').length)} stars, ${SETIDATA.filter(t => t.k === 'galaxy').length} nearby galaxies and ${SETIDATA.filter(t => t.k === 'pulsar').length} pulsars used to check the equipment. The top animation is a simulation of how a search works, using whichever real target is highest over you right now. A narrow line that drifts across frequency is what a transmitter on a rotating, orbiting planet would look like. Every candidate so far turned out to be Earth's own interference, which is why each target is checked with an "OFF" pointing: a real signal disappears when the dish looks away, interference does not.</p>
  <h3>Our radio bubble</h3><p>Radio broadcasts strong enough to leak into space began around 1920, so a sphere roughly a century of light-years wide now carries them. Any listened-to star inside the bubble could in principle have heard us; a reply from it could already be on its way.</p>
  <h3>Signals</h3><p>The famous moments the sky seemed to answer: the Wow! signal, BLC1, pulsars, fast radio bursts, and the microwave oven that fooled a telescope for 17 years. Red stamps are still unexplained, amber ones have a likely but unproven answer, green ones are solved, and violet ones are messages we sent the other way.</p>
  <h3>Calendar</h3><p>Moon phases for every day, with dots for meteor showers, eclipses, planet events and days in the archive when Green Bank was listening. Tap a day for darkness and moon times. It returns to today each time you open the app.</p></div>`);
}
