'use strict';
/* ---------- app shell ---------- */
const App = {
  version: '1.2',
  go(v) {
    if (S.view === v && v !== 'sky') { $('#v-' + v).scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const prev = S.view; S.view = v;
    $$('.view').forEach(e => e.classList.toggle('on', e.id === 'v-' + v));
    $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    if (prev === 'sky' && v !== 'sky') SkyMap.hide();
    if (v === 'sky') SkyMap.show(); if (v === 'listen') Listen.show(); if (v === 'signals') Signals.show(); if (v === 'cal') Cal.render();
    if (v !== 'sky') $('#skyInfo').classList.remove('on');
    N.haptic(8);
  },
  placeChanged() {
    const p = place(); $('#placeName').textContent = p.name;
    S.wx = null; App.refresh(true); Tonight.render(); SkyMap.reset(); Listen.placeChanged();
    if (S.view === 'cal') Cal.render(); if (S.view === 'sky') SkyMap.show();
  },
  prefsChanged(k) {
    if (k === 'red') document.body.classList.toggle('red', S.prefs.red);
    if (k === 'h24' || k === 'tempC') { Tonight.render(); if (S.view === 'cal') Cal.render(); }
    if (k.startsWith('n')) App.notify();
  },
  async locate(force) {
    if (!S.prefs.useGps) return;
    sync('busy', 'Finding you');
    const r = await N.locate();
    if (r && r.lat != null) {
      const moved = !S.gps || Math.hypot(S.gps.lat - r.lat, S.gps.lon - r.lon) > .05;
      S.gps = Object.assign(S.gps || {}, { lat: r.lat, lon: r.lon, tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
      if (moved || !S.gps.name || S.gps.name === 'Your location') {
        S.gps.name = 'Your location';
        try { const g = await N.json(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${r.lat}&longitude=${r.lon}&localityLanguage=en`); S.gps.name = g.city || g.locality || g.principalSubdivision || 'Your location'; } catch (e) {}
      }
      store.set('gps', S.gps);
      if (S.placeIdx < 0 && (moved || force)) App.placeChanged(); else if (S.placeIdx < 0) $('#placeName').textContent = S.gps.name;
    } else if (!S.gps && S.placeIdx < 0) { sync('err', 'No location, showing Greenwich'); }
  },
  async refresh(force) {
    const p = place(), now = Date.now(), c = store.get('cache', {});
    const k = p.lat.toFixed(2) + ',' + p.lon.toFixed(2);
    if (!force && c.k === k && now - c.t < 30 * 6e4) { S.wx = c.wx; S.kp = c.kp; return; }
    sync('busy', 'Updating');
    const jobs = [
      N.json(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&hourly=cloud_cover,temperature_2m&past_days=1&forecast_days=4&timeformat=unixtime&timezone=auto`).then(j => { S.wx = j; if (!p.tz && j.timezone) p.tz = j.timezone; }),
      N.json('https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json').then(j => {
        const rows = Array.isArray(j[0]) ? j.slice(1).map(r => ({ t: r[0], kp: r[1] })) : j.map(r => ({ t: r.time_tag, kp: r.kp }));
        S.kp = rows.map(r => ({ t: Date.parse(String(r.t).replace(' ', 'T') + (String(r.t).endsWith('Z') ? '' : 'Z')), kp: +r.kp })).filter(r => !isNaN(r.t) && !isNaN(r.kp));
      })];
    const res = await Promise.allSettled(jobs), fails = res.filter(r => r.status === 'rejected').length;
    if (fails < 2) store.set('cache', { k, t: Date.now(), wx: S.wx, kp: S.kp });
    else { if (c.k === k) { S.wx = S.wx || c.wx; S.kp = S.kp || c.kp; } }
    sync(fails === 2 ? 'err' : '', fails === 2 ? 'Offline · sky still works' : fails ? 'Updated ' + fT(new Date()) + ' · partly' : 'Updated ' + fT(new Date()));
    Tonight.render(); App.notify();
  },
  notify() {
    if (!N.has) return; const L = [], now = Date.now(), n = Tonight.night;
    try {
      if (S.prefs.nDark && n && n.sc && n.sc.score >= 70 && n.civD && +n.civD > now) L.push({ id: 1, t: +n.civD, title: verdict(n.sc.score) + ' ahead · ' + n.sc.score, text: `Dark from ${fT(n.darkS)} until ${fT(n.darkE)} · ${n.sc.why}` });
      const ev = events().filter(e => +e.t > now && +e.t < now + 15 * 864e5);
      if (S.prefs.nMeteor) ev.filter(e => e.k === 'met').forEach((e, i) => { const t = +e.t - 4 * 36e5; if (t > now) L.push({ id: 200 + i, t, title: e.n + ' tonight', text: e.d }); });
      if (S.prefs.nEclipse) ev.filter(e => e.k === 'ecl' && e.vis).forEach((e, i) => { const t = +e.t - 864e5; if (t > now) L.push({ id: 300 + i, t, title: e.n + ' tomorrow', text: e.d + ' · peak ' + fT(e.t) }); });
    } catch (e) {}
    N.schedule(L);
  },
  tick() {
    $('#clock').textContent = fT(new Date());
    Tonight.tick(); SkyMap.tick();
  },
  splash() {
    const c = $('#splashC'), { x, w, h } = hidpi(c), r = rng(3), st = Array.from({ length: 220 }, () => ({ a: r() * 6.283, d: r() * .2, v: .2 + r() * .9 })), t0 = performance.now();
    const f = n => { const t = (n - t0) / 1000; if (t > 2.6) return; requestAnimationFrame(f);
      x.fillStyle = 'rgba(2,3,10,.35)'; x.fillRect(0, 0, w, h);
      for (const s of st) { s.d += s.v * .012 * (1 + t * 1.5); if (s.d > 1) s.d = .02; const R = s.d * Math.hypot(w, h) * .6, px = w / 2 + Math.cos(s.a) * R, py = h / 2 + Math.sin(s.a) * R; x.fillStyle = `rgba(210,225,255,${Math.min(1, s.d * 2)})`; x.fillRect(px, py, 1 + s.d * 1.6, 1 + s.d * 1.6); }
      for (let k = 0; k < 3; k++) { const p = ((t * .6) + k / 3) % 1; x.strokeStyle = `rgba(63,240,207,${(1 - p) * .35})`; x.lineWidth = 1.2; x.beginPath(); x.arc(w / 2, h / 2, 40 + p * Math.min(w, h) * .55, 0, 7); x.stroke(); }
    };
    requestAnimationFrame(f);
    setTimeout(() => $('#splash').classList.add('out'), 1900);
  },
  init() {
    App.splash();
    if (S.prefs.red) document.body.classList.add('red');
    $('#placeName').textContent = place().name;
    $$('#tabs button').forEach(b => b.onclick = () => App.go(b.dataset.v));
    $('#placeBtn').onclick = openPlaces; $('#setBtn').onclick = openSettings; $('#guideBtn').onclick = openGuide;
    Tonight.render(); Tonight.start(); App.tick(); setInterval(App.tick, 1000);
    setInterval(() => { if (S.view === 'tonight') Tonight.render(); }, 5 * 6e4);
    App.refresh(false).then(() => { if (!S.wx) App.refresh(true); });
    App.locate(false);
    window.onResume = () => { Cal.reset(); if (S.view === 'cal') Cal.render(); App.refresh(false); Tonight.render(); };
    window.onBack = () => { if ($('#sheet').classList.contains('on')) { Sheet.close(); return true; } if (S.view !== 'tonight') { App.go('tonight'); return true; } return false; };
    window.addEventListener('resize', () => {});
  }
};
App.init();
