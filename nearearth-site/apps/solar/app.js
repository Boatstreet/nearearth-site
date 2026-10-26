/* Solar — solar weather app */
(function () {
  'use strict';
  const { Store, Fmt, esc, $, $$ } = U;

  // ---------------- state ----------------
  const S = { protons: null, kp: null, kpFc: null, wind: null, wind7: null, xray: null, xray3: null, flare: null, regions: null, scales: null, probs: null, alerts: null, ovation: null, cycle: null, events: null, disc: null, err: {} };
  let tab = 'sun', prevTab = 'sun', disk = null, lastLoad = 0, loadingAll = false;
  // The Sun view always starts on Sunspots; a view picked with the chips lasts until the app is closed.
  let viewChan = 'HMIIF'; Store.set('channel', null);
  const settings = () => ({
    channel: Pro.on() ? viewChan : 'HMIIF', res: Store.get('res', 1024), marks: Store.get('marks', true),
    place: Store.get('place', null),
  });

  // ---------------- tiny UI kit ----------------
  const view = $('#view'), sheet = $('#sheet'), scrim = $('#scrim');
  let toastT;
  function toast(msg, action, fn) {
    const t = $('#toast');
    t.innerHTML = esc(msg) + (action ? ` <button class="tact">${esc(action)}</button>` : '');
    t.classList.toggle('act', !!action);
    if (action) t.querySelector('.tact').onclick = () => { t.classList.remove('on'); fn(); };
    t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), action ? 4500 : 2600);
  }
  function openSheet(html, after) {
    sheet.innerHTML = '<div class="grab"></div>' + html;
    sheet.scrollTop = 0;
    sheet.classList.add('on'); scrim.classList.add('on');
    if (after) after(sheet);
  }
  function closeSheet() { sheet.classList.remove('on'); scrim.classList.remove('on'); }
  scrim.addEventListener('click', closeSheet);
  // Drag the info sheet down to close it: from the handle, or anywhere once it's scrolled to the top.
  (function sheetDrag() {
    let st = null;
    sheet.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1 || !sheet.classList.contains('on')) { st = null; return; }
      const t = e.touches[0];
      st = { y: t.clientY, x: t.clientX, t: Date.now(), dy: 0, on: false, handle: t.clientY - sheet.getBoundingClientRect().top < 36 };
    }, { passive: true });
    sheet.addEventListener('touchmove', (e) => {
      if (!st) return;
      const t = e.touches[0], dy = t.clientY - st.y, dx = t.clientX - st.x;
      if (!st.on) {
        if (Math.abs(dy) < 8) return;
        if (dy > 0 && Math.abs(dy) > Math.abs(dx) && (st.handle || sheet.scrollTop <= 0)) { st.on = true; }
        else { st = null; return; }
      }
      e.preventDefault();
      st.dy = Math.max(0, t.clientY - st.y);
      sheet.style.transition = 'none'; sheet.style.transform = `translateY(${st.dy}px)`;
      scrim.style.opacity = String(Math.max(0, 1 - st.dy / (sheet.offsetHeight || 400)));
    }, { passive: false });
    const end = () => {
      if (!st || !st.on) { st = null; return; }
      const fast = st.dy / Math.max(1, Date.now() - st.t) > 0.6, h = sheet.offsetHeight || 400;
      sheet.style.transition = ''; scrim.style.opacity = '';
      if (st.dy > Math.min(120, h * 0.3) || (fast && st.dy > 30)) {
        sheet.style.transform = 'translateY(105%)';
        setTimeout(() => { closeSheet(); sheet.style.transform = ''; }, 260);
      } else sheet.style.transform = '';
      st = null;
    };
    sheet.addEventListener('touchend', end);
    sheet.addEventListener('touchcancel', end);
  })();
  const sheetOpen = () => sheet.classList.contains('on');
  const pages = [];
  function pushPage(title, html, after) {
    const p = document.createElement('div');
    p.className = 'page';
    p.innerHTML = `<div class="pbar"><button class="icon-btn" data-back>${ic('back')}</button><div class="ptitle">${esc(title)}</div></div><div class="pbody">${html}</div>`;
    document.body.appendChild(p); pages.push(p);
    p.querySelector('[data-back]').addEventListener('click', popPage);
    if (after) after(p);
    return p;
  }
  function popPage() { const p = pages.pop(); if (p) p.remove(); }
  window.onBack = function () {
    if (sheetOpen()) { closeSheet(); return true; }
    if (tab === 'events' && evSel) { evSel = null; render(); return true; }
    if (pages.length) { popPage(); return true; }
    if (tab === 'history' && SunHist.back()) return true;
    if (SIDE.includes(tab)) { setTab(prevTab); return true; }
    if (tab !== 'sun') { setTab('sun'); return true; }
    return false;
  };

  // ---------------- levels & wording ----------------
  const KP_TXT = ['Quiet', 'Quiet', 'Quiet', 'Unsettled', 'Active', 'Minor storm', 'Moderate storm', 'Strong storm', 'Severe storm', 'Extreme storm'];
  const kpText = (k) => KP_TXT[Math.max(0, Math.min(9, Math.floor(k + 0.34)))];
  const gOf = (k) => (k >= 5 ? Math.min(5, Math.floor(k + 0.34) - 4) : 0);
  function windText(v) { return v == null ? '' : v < 400 ? 'Slow' : v < 500 ? 'Moderate' : v < 650 ? 'Fast' : v < 800 ? 'Very fast' : 'Extreme'; }
  function bzText(bz) { return bz == null ? '' : bz <= -15 ? 'Strongly south' : bz <= -5 ? 'South — aurora-friendly' : bz < 0 ? 'Slightly south' : bz < 5 ? 'Slightly north' : 'North'; }
  function denText(n) { return n == null ? '' : n < 4 ? 'Low' : n < 12 ? 'Normal' : n < 25 ? 'High' : 'Very high'; }
  function lvlColor(n) { return ['var(--ok)', '#e8d454', '#ffb13d', '#ff8f3d', '#ff6b4a', '#ff4d6d'][Math.max(0, Math.min(5, n))]; }
  function flareColor(cls) { const c = (cls || '')[0]; return c === 'X' ? 'var(--x)' : c === 'M' ? 'var(--m)' : c === 'C' ? 'var(--c)' : 'var(--muted)'; }
  const fmt = (v, d) => (v == null ? '--' : (+v).toFixed(d == null ? 0 : d));

  function headline() {
    const kp = S.kp && S.kp.rows.length ? S.kp.rows[S.kp.rows.length - 1].kp : null;
    const fl = S.xray && S.xray.now ? Data.flareClass(S.xray.now.f) : null;
    const sc = S.scales ? S.scales.now : null;
    const big = S.flare && S.flare.cls && S.flare.max && Date.now() - S.flare.max < 24 * 3600e3 ? S.flare.cls : null;
    if (kp == null && !fl) return { t: 'Loading the Sun…', s: '' };
    const parts = [];
    let t;
    if (kp != null && kp >= 5) t = kpText(kp) + ' in progress';
    else if (big && /^[XM]/.test(big)) t = big[0] === 'X' ? 'Major flare today' : 'Active Sun';
    else if (fl && /^[XM]/.test(fl)) t = 'Flare in progress';
    else if (kp != null && kp >= 4) t = 'Unsettled field';
    else t = 'The Sun is calm';
    if (fl) parts.push('X-ray ' + fl);
    if (big) parts.push('largest flare ' + big);
    if (kp != null) parts.push('Kp ' + fmt(kp, 1));
    if (sc && (sc.r || sc.s || sc.g)) parts.push(['R' + sc.r, 'S' + sc.s, 'G' + sc.g].join(' '));
    return { t, s: parts.join(' · ') };
  }

  // ---------------- tabs ----------------
  const TABS = [['sun', 'Sun', 'sun'], ['events', 'Events', 'bolt'], ['activity', 'Activity', 'pulse'], ['earth', 'Earth', 'earth'], ['aurora', 'Aurora', 'aurora'], ['eclipse', 'Eclipse', 'eclipse']];
  const SIDE = ['settings', 'guide', 'history', 'places']; // opened from the buttons at the top right, not the tab bar
  const bar = $('#tabbar');
  bar.innerHTML = TABS.map(([id, name, i]) => `<button data-tab="${id}"><span class="ti">${ic(i)}</span>${name}</button>`).join('');
  bar.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
  // Incoming and Events are one tab: "Coming up" and "Happened"
  let evView = Store.get('evView', 'next');
  function setTab(t) {
    if (t === 'incoming') { evView = 'next'; Store.set('evView', 'next'); t = 'events'; }
    if (t !== 'events') evSel = null;
    if (SIDE.includes(t) && !SIDE.includes(tab)) prevTab = tab;
    const same = t === tab && view.firstChild;
    tab = t;
    $$('[data-tab]', bar).forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    while (pages.length) popPage();
    if (same) { const tv = view.querySelector('.tabview'); if (tv) tv.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    render();
    if (t === 'events' && !S.events && !S.err.events) loadEvents();
    if (t === 'activity' && !S.cycle && !S.err.cycle) loadSlow();
    if (t === 'earth') { if (!S.events && !S.err.events) loadEvents(); if (!S.ovation) loadOvation(); if (!S.protons) run('protons', () => Data.protons()); }
    if (t === 'events' && Pro.on() && settings().place && !S.ovation) loadOvation();
    if (t === 'aurora' && !S.ovation) loadOvation();
  }
  let rT;
  // On the Earth tab only the cards change when data arrives, so the animation keeps running
  function rerender() { clearTimeout(rT); rT = setTimeout(() => { auroraCheck(); if (window.AuroraView && AuroraView.isOpen()) { AuroraView.update(); if (tab === 'earth') EarthView.update(HOST, S); updStatus(); return; } if (tab === 'earth' && !pages.length && EarthView.update(HOST, S)) { updStatus(); return; } render(); }, 30); }
  function render() {
    const tv = view.querySelector('.tabview');
    const keep = tv && tv.dataset.tab === tab ? tv.scrollTop : 0;
    if (tab === 'sun') renderSun();
    else if (tab === 'activity') renderActivity();
    else if (tab === 'events') { if (evView === 'next') renderIncoming(); else renderEvents(); }
    else if (tab === 'history') SunHist.render(HOST);
    else if (tab === 'eclipse') Eclipse.render(HOST);
    else if (tab === 'earth') EarthView.render(HOST, S);
    else if (tab === 'aurora') AuroraView.render(HOST, S);
    else if (tab === 'places') renderPlaces();
    else if (tab === 'guide') Guide.render(HOST, S);
    else renderSettings();
    const nv = view.querySelector('.tabview'); if (nv) nv.scrollTop = keep;
  }
  // the calendar button: each tab's own history (removed on tabs without one)
  const HIST_LBL = { sun: 'Sunspot history', events: 'Event history', activity: 'Activity history', earth: 'What hit Earth', aurora: 'Aurora history', eclipse: 'Past eclipses' };
  function tabShell(id, inner) {
    const top = SIDE.includes(id) ? '' : `<div class="topbtns"><span class="topclock">${clockText()}</span>${HIST_LBL[id] ? `<button class="icon-btn" data-top="history" aria-label="${HIST_LBL[id]}">${ic('calendar')}</button>` : ''}<button class="icon-btn" data-top="guide" aria-label="Guide">${ic('info')}</button><button class="icon-btn" data-top="settings" aria-label="Settings">${ic('gear')}</button></div>`;
    view.innerHTML = `<div class="tabview" data-tab="${id}">${top}${inner}</div>`;
    const tv = view.firstChild;
    tv.addEventListener('click', (e) => {
      const b = e.target.closest('[data-top]'); if (b) { e.stopPropagation(); if (b.dataset.top === 'guide' && !SIDE.includes(id)) Guide.tabInfo(id, S, HOST);
        else if (b.dataset.top === 'history' && (id === 'earth' || id === 'aurora') && !Pro.on()) Pro.paywall(id);
        else if (b.dataset.top === 'history' && id === 'eclipse') Eclipse.showHistory();
        else if (b.dataset.top === 'history' && window.TabHist && TabHist.has(id)) TabHist.open(id, HOST, S);
        else setTab(b.dataset.top);
        return; }
      if (e.target.closest('[data-gback]')) { e.stopPropagation(); setTab(prevTab); }
    }, true);
    return tv;
  }
  // Live clock next to the top-right icons; follows the Local time / UTC setting.
  // Clock: hours:minutes:seconds with the day and date underneath; follows the Local time / UTC setting.
  const p2 = (n) => String(n).padStart(2, '0');
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function clockText() {
    const d = new Date(), u = Fmt.utcMode();
    const g = (a, b) => (u ? d['getUTC' + a]() : d['get' + b]());
    return `<b>${p2(g('Hours', 'Hours'))}:${p2(g('Minutes', 'Minutes'))}<small>:${p2(g('Seconds', 'Seconds'))}</small></b>` +
      `<span>${WD[g('Day', 'Day')]} ${g('Date', 'Date')} ${MO[g('Month', 'Month')]}${u ? ' · UTC' : ''}</span>`;
  }
  let lastClock = '';
  (function tick() {
    if (!document.hidden) { const t = clockText(); if (t !== lastClock) { lastClock = t; $$('.topclock').forEach((el) => { el.innerHTML = t; }); } }
    setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
  })();
  // Status line under the title: "Updating…" while loading, then "Updated 20:00",
  // or "Offline · saved Sat 17 Oct, 20:00" when only the saved copy could be shown.
  function statusText() {
    if (loadingAll) return { t: 'Updating…', cls: 'busy' };
    const xs = [S.kp, S.wind, S.xray].filter(Boolean);
    if (!xs.length) return { t: S.err.kp ? 'Offline' : '', cls: S.err.kp ? 'off' : '' };
    const at = new Date(Math.min(...xs.map((x) => x.at)));
    if (xs.some((x) => x.stale)) return { t: 'Offline · saved ' + Fmt.dayTime(at), cls: 'off' };
    return { t: 'Updated ' + (Fmt.day(at) === Fmt.day(new Date()) ? Fmt.time(at) : Fmt.dayTime(at)), cls: '' };
  }
  const statusHtml = () => { const st = statusText(); return `<span class="updst ${st.cls}">${st.cls === 'busy' ? '<i></i>' : ''}${esc(st.t)}</span>`; };
  const statRow = (pre) => `<div class="statrow">${pre ? `<span class="statpre">${pre}</span>` : ''}${statusHtml()}</div>`;
  function updStatus() { const html = statusHtml(); $$('.updst').forEach((el) => { el.outerHTML = html; }); }

  // ---------------- SUN TAB ----------------
  function renderSun() {
    const st = settings();
    const h = headline();
    const ch = Data.CHANNELS.find((c) => c.id === st.channel) || Data.CHANNELS[0];
    const regs = S.regions ? S.regions.list : [];
    const spots = regs.reduce((a, r) => a + (r.spots || 0), 0);
    const p = tabShell('sun', `
      <div class="sunhero">
        <div class="topbar"><div class="brand">${ic('sun')}<span>Solar</span></div><span class="sp"></span>
          </div>
        ${statRow()}
        <div id="diskslot"></div>
        <div class="chips" id="chips">${Data.CHANNELS.map((c, k) => !Pro.on() && k > 0
          ? `<button class="chip locked" data-pro="views"><i style="background:${c.tint || '#888'}"></i>${c.name}${ic('lock', 'lk')}</button>`
          : `<button class="chip${c.id === ch.id ? ' on' : ''}" data-ch="${c.id}"><i style="background:${c.tint || '#888'}"></i>${c.name}</button>`).join('')}</div>
        <div class="chsub">${esc(ch.sub)}${regs.length && st.marks ? ' · tap a marker for the sunspot group' : ''}</div>
        <button class="tlbtn" ${Pro.on() ? 'data-act="timelapse"' : 'data-pro="views"'}>${ic('play')}<span>The last 48 hours</span>${Pro.on() ? '' : Pro.pill(true)}</button>
        <div class="headline"><h1>${esc(h.t)}</h1><p>${esc(h.s)}</p></div>
        ${(() => { const on = CmeAnim.active(S.events).filter((x) => +x.arrival > Date.now()); return on.length ? `<button class="cmebanner" data-act="cme">${ic('cme')}<span>CME heading for Earth · arrives ${esc(CmeAnim.until(on[0].arrival))}</span>${ic('right')}</button>` : ''; })()}
      </div>
      ${scalesStrip()}
      <div class="grid">${tiles()}</div>
      <div class="sect-row"><div class="sect">Sunspot groups</div><div class="sect-aside">${regs.length ? regs.length + ' groups · ' + spots + ' spots' : ''}</div></div>
      ${regionList(regs)}
      <button class="card linkcard" data-act="history"><span class="lc-ic">${ic('calendar')}</span><span class="tx"><b>Past sunspots</b><small>Any day since 1818 — the Sun's picture since 1996</small></span>${ic('right')}</button>
      <button class="card linkcard" data-act="cycle"><span class="lc-ic">${ic('cycle')}</span><span class="tx"><b>Solar cycle</b><small>Monthly sunspot numbers and NOAA's prediction</small></span>${ic('right')}</button>
      <p class="attrib">Images: NASA SDO / Helioviewer · Data: NOAA SWPC, NASA DONKI</p>`);

    // keep the disk alive between renders so the image doesn't reload
    if (!disk) {
      disk = Sun.disk({ channel: st.channel, res: st.res, marks: st.marks });
      disk.onRegion((r) => regionSheet(r));
    }
    $('#diskslot', p).appendChild(disk.el);
    disk.setRegions(regs, S.regions && S.regions.date);

    p.addEventListener('click', (e) => {
      const scl = e.target.closest('[data-scale]'); if (scl) { scaleSheet(scl.dataset.scale); return; }
      const a = e.target.closest('[data-act],[data-ch],[data-reg],[data-tile]');
      if (!a) return;
      if (a.dataset.ch) { viewChan = a.dataset.ch; disk.setChannel(a.dataset.ch); $$('.chip', p).forEach((c) => c.classList.toggle('on', c === a)); const c = Data.CHANNELS.find((x) => x.id === a.dataset.ch); $('.chsub', p).textContent = c.sub + (regs.length && st.marks ? ' · tap a marker for the sunspot group' : ''); a.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); return; }
      if (a.dataset.reg) { const r = regs.find((x) => String(x.region) === a.dataset.reg); if (r) regionSheet(r); return; }
      if (a.dataset.tile) { tileSheet(a.dataset.tile); return; }
      if (a.dataset.act === 'cycle') cyclePage();
      if (a.dataset.act === 'timelapse') timelapsePage(settings().channel);
      if (a.dataset.act === 'history') setTab('history');
      if (a.dataset.act === 'cme') setTab('incoming');
      if (a.dataset.act === 'place') setTab('places');
    });
    const chips = $('#chips', p), on = $('.chip.on', chips);
    if (on) chips.scrollLeft = on.offsetLeft - chips.clientWidth / 2 + on.clientWidth / 2;
  }

  function scalesStrip() {
    const sc = S.scales; if (!sc) return '';
    const it = (k, n, name) => `<button class="scale" data-scale="${k}" style="--lc:${lvlColor(n)}"><b>${k}${n}</b><span>${name}</span></button>`;
    return `<div class="scales">${it('R', sc.now.r, 'Radio')}${it('S', sc.now.s, 'Radiation')}${it('G', sc.now.g, 'Geomagnetic')}</div>`;
  }

  function tiles() {
    const kpNow = S.kp && S.kp.rows.length ? S.kp.rows[S.kp.rows.length - 1] : null;
    const w = S.wind, x = S.xray, st = settings();
    const t = [];
    const tile = (id, icon, label, val, unit, sub, extra, color) =>
      `<button class="tile" data-tile="${id}"${color ? ` style="--tc:${color}"` : ''}><div class="lbl">${ic(icon)}${label}</div>${extra || ''}<div class="val">${val}<small>${unit || ''}</small></div><div class="sub">${sub || ''}</div></button>`;
    // Kp
    t.push(tile('kp', 'magnet', 'Kp index', kpNow ? fmt(kpNow.kp, kpNow.kp % 1 ? 1 : 0) : '--', '', kpNow ? kpText(kpNow.kp) + (gOf(kpNow.kp) ? ' · G' + gOf(kpNow.kp) : '') : 'Loading',
      `<div class="gwrap">${Charts.gauge(kpNow ? kpNow.kp : null, 9, kpNow ? Charts.kpColor(kpNow.kp) : '#555')}</div>`, kpNow ? Charts.kpColor(kpNow.kp) : null));
    // X-ray
    const cls = x && x.now ? Data.flareClass(x.now.f) : '--';
    t.push(tile('xray', 'sun', 'X-ray flux', cls, '', S.flare && S.flare.cls ? 'Last flare ' + S.flare.cls + (S.flare.max ? ' · ' + Fmt.time(S.flare.max) : '') : 'GOES 0.1–0.8 nm',
      x ? `<div class="spark">${Charts.line([{ pts: x.long.slice(-720).map((p) => ({ t: p.t, v: p.f })), color: flareColor(cls), fill: flareColor(cls) }], { h: 58, log: true, yMin: -8, yMax: -3.5, ticks: [], spark: true })}</div>` : '', flareColor(cls)));
    // Wind
    const wd = w ? bucket(w.plasma.map((p) => ({ t: p.t, v: p.v })), 96) : [];
    const wv = wd.filter((p) => p.v != null).map((p) => p.v), wtr = w ? windTrend(w.plasma) : '';
    t.push(tile('wind', 'wind', 'Solar wind', w && w.v ? fmt(w.v.v) : '--', 'km/s',
      w && w.v ? windText(w.v.v) + (wtr ? ' · ' + wtr : '') + (wv.length ? '<br>24 h: ' + Math.round(Math.min(...wv)) + '–' + Math.round(Math.max(...wv)) : '') : 'DSCOVR / ACE at L1',
      w ? `<div class="spark">${Charts.line([{ pts: wd, color: windColor(w.v && w.v.v), fill: windColor(w.v && w.v.v) }], { h: 58, ticks: [], spark: true })}</div>` : '', w && w.v && w.v.v >= 500 ? windColor(w.v.v) : null));
    // Bz
    const bz = w && w.bz ? w.bz.bz : null;
    t.push(tile('bz', 'magnet', 'Bz / Bt', fmt(bz, 1), 'nT', w && w.bt ? 'Bt ' + fmt(w.bt.bt, 1) + ' nT · ' + bzText(bz) : bzText(bz),
      w ? `<div class="spark">${Charts.line([{ pts: w.mag.slice(-360).map((p) => ({ t: p.t, v: p.bz })), color: bz != null && bz < 0 ? 'var(--m)' : 'var(--ok)' }], { h: 58, sym: true, ticks: [0], tickFmt: () => '', spark: true })}</div>` : '', bz != null && bz <= -5 ? 'var(--m)' : null));
    // Aurora
    let au = '--', auSub = 'Tap to set your place';
    if (st.place && S.ovation) {
      const a = S.ovation.at(st.place.lat, st.place.lon);
      au = Math.max(a.here, a.horizon);
      auSub = (a.here >= 10 ? 'Overhead possible' : a.horizon >= 5 ? 'Low on the horizon' : 'Unlikely') + ' · ' + esc(st.place.name);
    } else if (st.place) auSub = esc(st.place.name);
    if (Pro.on()) t.push(tile('aurora', 'aurora', 'Aurora now', au, au === '--' ? '' : '%', auSub, '', au !== '--' && au >= 10 ? '#7cf0b0' : null));
    else t.push(`<button class="tile protile" data-pro="aurora"><div class="lbl">${ic('aurora')}Aurora at your place</div><div class="val">${ic('lock')}</div><div class="sub">Live chance where you are · Solar Pro</div></button>`);
    // Density / temperature
    t.push(tile('density', 'density', 'Density', w && w.n ? fmt(w.n.n, 1) : '--', 'p/cm³', w && w.n ? denText(w.n.n) + (w.temp ? ' · ' + Math.round(w.temp.temp / 1000) + 'k K' : '') : ''));
    // Flare chances
    const pr = S.probs;
    t.push(tile('probs', 'bolt', 'Flare chance', pr && pr.m[0] != null ? pr.m[0] : '--', pr ? '% M' : '', pr ? 'X ' + fmt(pr.x[0]) + '% · C ' + fmt(pr.c[0]) + '% today' : 'NOAA forecast'));
    // Sunspots
    const regs = S.regions ? S.regions.list : null;
    t.push(tile('spots', 'spots', 'Sunspots', regs ? regs.length : '--', regs ? ' groups' : '', regs ? regs.reduce((a, r) => a + (r.spots || 0), 0) + ' spots · ' + regs.reduce((a, r) => a + (r.area || 0), 0) + ' MSH' : ''));
    return t.join('');
  }

  // ---------------- SOLAR WIND: history ----------------
  const WIND_BANDS = [{ from: 0, to: 400, color: '#6fcf97', label: 'slow' }, { from: 400, to: 500, color: '#e8d454', label: 'moderate' }, { from: 500, to: 650, color: '#ffb13d', label: 'fast' }, { from: 650, to: 800, color: '#ff8f3d', label: 'very fast' }, { from: 800, to: 3000, color: '#ff4d6d', label: 'extreme' }];
  const windColor = (v) => (v == null ? 'var(--accent)' : v < 400 ? '#6fcf97' : v < 500 ? '#e8d454' : v < 650 ? '#ffb13d' : v < 800 ? '#ff8f3d' : '#ff4d6d');
  // average into n time buckets so long series stay light to draw
  function bucket(pts, n) {
    const ok = pts.filter((p) => p.v != null);
    if (ok.length <= n) return ok;
    const t0 = +ok[0].t, t1 = +ok[ok.length - 1].t, w = (t1 - t0) / n || 1, out = [];
    let k = 0;
    for (let i = 0; i < n; i++) {
      let sum = 0, c = 0; const end = t0 + (i + 1) * w;
      while (k < ok.length && +ok[k].t <= end) { sum += ok[k].v; c++; k++; }
      out.push({ t: new Date(t0 + (i + 0.5) * w), v: c ? sum / c : null });
    }
    return out;
  }
  function windTrend(pl) {
    const now = Date.now(), m = (a, b) => { const v = pl.filter((p) => p.v != null && +p.t > now - a && +p.t <= now - b).map((p) => p.v); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };
    const a = m(3600e3, 0), b = m(4 * 3600e3, 3600e3);
    if (a == null || b == null) return '';
    return a - b > 40 ? 'rising ↑' : b - a > 40 ? 'falling ↓' : 'steady';
  }
  // Solar keeps its own hourly record so it can show more than NOAA's 7 days of live data.
  function windArchive(w) {
    if (!w) return;
    const arch = Store.get('windArch', {}), add = {};
    const put = (t, k, v) => { if (v == null) return; const h = Math.floor(+t / 3600e3); (add[h] = add[h] || {}); (add[h][k] = add[h][k] || []).push(v); };
    for (const p of w.plasma) { put(p.t, 'v', p.v); put(p.t, 'n', p.n); }
    for (const p of w.mag) { put(p.t, 'bz', p.bz); put(p.t, 'bt', p.bt); }
    const cur = Math.floor(Date.now() / 3600e3);
    for (const h in add) {
      if (+h >= cur) continue; // only complete hours
      const o = {}; for (const k in add[h]) o[k] = Math.round((add[h][k].reduce((a, b) => a + b, 0) / add[h][k].length) * 10) / 10;
      arch[h] = o;
    }
    const keep = cur - 35 * 24;
    for (const h in arch) if (+h < keep) delete arch[h];
    try { Store.set('windArch', arch); } catch (e) { }
  }
  function archSeries() {
    const arch = Store.get('windArch', {}), hs = Object.keys(arch).map(Number).sort((a, b) => a - b);
    const plasma = hs.map((h) => ({ t: new Date(h * 3600e3 + 1800e3), v: arch[h].v ?? null, n: arch[h].n ?? null }));
    const mag = hs.map((h) => ({ t: new Date(h * 3600e3 + 1800e3), bz: arch[h].bz ?? null, bt: arch[h].bt ?? null }));
    return { plasma, mag, days: hs.length ? (hs[hs.length - 1] - hs[0]) / 24 : 0 };
  }
  let windRange = Store.get('windRange', '24h');
  const WRANGES = [['6h', '6 h', 6 * 3600e3], ['24h', '24 h', 864e5], ['3d', '3 days', 3 * 864e5], ['7d', '7 days', 7 * 864e5], ['30d', '30 days', 30 * 864e5]];
  // The solar wind panel: range picker, stats, shock detection and charts. Used in the Sun tab's sheet and the Activity tab.
  function windPanel(focus) {
    const r = WRANGES.find((x) => x[0] === windRange) || WRANGES[1], span = r[2], now = Date.now();
    const picker = seg('wr', windRange, WRANGES.map((x) => [x[0], x[1]]));
    if (!S.wind) return picker + `<div class="card chartcard">${S.err.wind ? `<p class="muted">Solar wind data couldn't be loaded from NOAA (${esc(S.err.wind)}). Pull down to try again.</p>` : skel()}</div>`;
    let src = S.wind, note = '';
    if (span > 864e5) {
      if (!S.wind7) {
        if (!S.err.wind7) run('wind7', () => Data.wind(false, true)); // redraws when it arrives
        return picker + `<div class="card chartcard">${S.err.wind7 ? `<p class="muted">A week of solar wind is unavailable (${esc(S.err.wind7)}).</p>` : skel()}</div>`;
      }
      src = S.wind7;
    }
    if (span > 864e5) {
      // NOAA now publishes only the last 24 hours: longer views use Solar's hourly record on the phone
      const a = archSeries(), first = (arr) => (arr.length ? +arr[0].t : Infinity);
      const live = S.wind7 || S.wind, cut = Math.min(first(live.plasma), Date.now());
      src = { plasma: a.plasma.filter((p) => +p.t < cut).concat(live.plasma), mag: a.mag.filter((p) => +p.t < cut).concat(live.mag) };
      const have = Math.max(1, Math.min(span / 864e5, (Date.now() - Math.min(cut, first(a.plasma))) / 864e5));
      const want = Math.round(span / 864e5);
      note = have < want - 0.5 ? `NOAA now publishes only the last 24 hours of solar wind. Solar keeps an hourly record on your phone, so this view fills up over time: ${Math.round(have)} of ${want} days so far.` : 'Older than 24 hours: hourly averages saved by Solar on your phone.';
    }
    const from = now - span, inR = (p) => +p.t >= from;
    const pl = src.plasma.filter(inR), mg = src.mag.filter(inR);
    const N = 240;
    const sp = bucket(pl.map((p) => ({ t: p.t, v: p.v })), N), dn = bucket(pl.map((p) => ({ t: p.t, v: p.n })), N);
    const bzS = bucket(mg.map((p) => ({ t: p.t, v: p.bz })), N), btS = bucket(mg.map((p) => ({ t: p.t, v: p.bt })), N);
    const xo = { t0: from, t1: now, xStep: span > 8 * 864e5 ? 7 * 864e5 : undefined, gap: Math.max(20 * 60000, (3 * span) / N, span > 7 * 864e5 ? 3 * 3600e3 : 0) };
    const vs = pl.filter((p) => p.v != null);
    const avg = vs.length ? vs.reduce((a, p) => a + p.v, 0) / vs.length : null;
    const hi = vs.reduce((a, p) => (!a || p.v > a.v ? p : a), null), lo = vs.reduce((a, p) => (!a || p.v < a.v ? p : a), null);
    const south = mg.filter((p) => p.bz != null), southPct = south.length ? Math.round((south.filter((p) => p.bz < -5).length / south.length) * 100) : null;
    let shock = null;
    const nb = Math.max(12, Math.round(span / 1800e3));
    const hr = bucket(pl.map((p) => ({ t: p.t, v: p.v })), nb), hn = bucket(pl.map((p) => ({ t: p.t, v: p.n })), nb);
    for (let i = 2; i < hr.length; i++) {
      const a = hr[i - 2], b = hr[i], na = hn[i - 2], nb2 = hn[i];
      if (a && b && a.v != null && b.v != null && b.v - a.v >= 80 && na && nb2 && na.v && nb2.v && nb2.v / na.v >= 1.6) { if (!shock || b.v - a.v > shock.jump) shock = { t: b.t, jump: Math.round(b.v - a.v) }; }
    }
    const sec = (t, h) => `<div class="ctitle">${t}</div>${h}`;
    const speed = sec('Speed · km/s', Charts.line([{ pts: sp, color: 'var(--accent)', fill: 'var(--accent)' }], Object.assign({ h: 150, bands: WIND_BANDS, yMin: 250 }, xo)));
    const dens = sec('Density · p/cm³', Charts.line([{ pts: dn, color: '#c39bff', fill: '#c39bff' }], Object.assign({ h: 100, yMin: 0 }, xo)));
    const bz = sec(`Bz <i style="color:var(--m)">●</i> and Bt <i style="color:var(--muted)">●</i> · nT`, Charts.line([{ pts: btS, color: 'var(--muted)', width: 1.2 }, { pts: btS.map((p) => ({ t: p.t, v: p.v == null ? null : -p.v })), color: 'var(--muted)', width: 1.2 }, { pts: bzS, color: 'var(--m)', fill: 'var(--m)' }], Object.assign({ h: 120, sym: true }, xo)));
    const order = focus === 'density' ? [dens, speed, bz] : focus === 'bz' ? [bz, speed, dens] : [speed, dens, bz];
    const nowV = S.wind.v && S.wind.v.v;
    return picker + `
      <div class="grid wstats">
        <div class="tile mini"><div class="lbl">Now</div><div class="val" style="color:${windColor(nowV)}">${fmt(nowV)}<small>km/s</small></div><div class="sub">${esc(windTrend(S.wind.plasma) || windText(nowV))}</div></div>
        <div class="tile mini"><div class="lbl">Average · ${r[1]}</div><div class="val">${fmt(avg)}<small>km/s</small></div><div class="sub">${windText(avg)}</div></div>
        <div class="tile mini"><div class="lbl">Highest</div><div class="val" style="color:${windColor(hi && hi.v)}">${fmt(hi && hi.v)}<small>km/s</small></div><div class="sub">${hi ? Fmt.dayTime(hi.t) : ''}</div></div>
        <div class="tile mini"><div class="lbl">Bz south</div><div class="val">${southPct == null ? '--' : southPct}<small>%</small></div><div class="sub">of the time below −5 nT</div></div>
      </div>
      ${shock ? `<div class="row static wshock">${ic('bolt')}<span class="tx"><span class="t1">Shock front ${Fmt.dayTime(shock.t)}</span><span class="t2">Speed jumped about ${shock.jump} km/s with denser wind — a CME or fast stream arriving</span></span></div>` : ''}
      <div class="card chartcard">${order.join('')}</div>
      ${note ? `<p class="muted small">${note}</p>` : ''}
      <p class="muted small">Bands: slow under 400 km/s, moderate to 500, fast to 650, very fast to 800, extreme above. Lowest in this period: ${fmt(lo && lo.v)} km/s.</p>`;
  }
  let windSheetOpen = null;
  function windSheet(focus, title, text) {
    windSheetOpen = { focus, title, text };
    openSheet(`<div class="stitle">${title}</div><div class="wpanel">${windPanel(focus)}</div><p class="lead">${text}</p>`, (sh) => {
      sh.addEventListener('click', (e) => { const b = e.target.closest('[data-seg=wr] button'); if (!b) return; windRange = b.dataset.v; Store.set('windRange', windRange); refreshWindSheet(); });
    });
  }
  // when new data arrives (e.g. the 7 days), redraw an open solar wind sheet in place
  function refreshWindSheet() {
    const box = sheetOpen() && windSheetOpen && sheet.querySelector('.wpanel');
    if (box) box.innerHTML = windPanel(windSheetOpen.focus);
  }

  function probBar(label, v, color) {
    return `<div class="pb"><span>${label}</span><i><b style="width:${Math.min(100, v || 0)}%;background:${color}"></b></i><em>${v == null ? '--' : v + '%'}</em></div>`;
  }
  function regionList(regs) {
    if (!S.regions) return S.err.regions ? `<p class="muted">Couldn't load sunspot groups (${esc(S.err.regions)}).</p>` : '<div class="card skel" style="height:90px"></div>';
    if (!regs.length) return '<p class="muted">No numbered sunspot groups on the visible disk today — a spotless Sun.</p>';
    return '<div class="regs">' + regs.map((r) => `<button class="card reg" data-reg="${r.region}" style="--mc:${Sun.regionColor(r)}">
      <div class="rhead"><span class="rnum">AR ${r.region}</span><span class="rloc">${esc(r.loc)}</span></div>
      <div class="rstats"><span>${r.spots == null ? '--' : r.spots} spot${r.spots === 1 ? '' : 's'}</span><span>${r.area == null ? '--' : r.area} MSH</span><span>${esc(r.mag || '—')}</span></div>
      ${probBar('M', r.m, 'var(--m)')}${probBar('X', r.x, 'var(--x)')}
      ${r.cEv || r.mEv || r.xEv ? `<div class="rev">Flares yesterday: ${[r.cEv && r.cEv + '×C', r.mEv && r.mEv + '×M', r.xEv && r.xEv + '×X'].filter(Boolean).join(' ')}</div>` : ''}
    </button>`).join('') + '</div>';
  }

  const MAG = {
    A: 'Alpha — a single polarity, magnetically simple', B: 'Beta — two polarities, simple divide', G: 'Gamma — polarities mixed up, complex',
    BG: 'Beta-gamma — complex, can produce M-class flares', D: 'Delta — opposite polarities in one penumbra, the most flare-productive',
    BD: 'Beta-delta — complex with a delta spot', GD: 'Gamma-delta — highly complex', BGD: 'Beta-gamma-delta — the most complex class, X-flare capable',
  };
  function magKey(m) { return (m || '').toUpperCase().replace(/ALPHA/g, 'A').replace(/BETA/g, 'B').replace(/GAMMA/g, 'G').replace(/DELTA/g, 'D').replace(/[^ABGD]/g, ''); }

  function regionSheet(r) {
    const st = settings(), g = Sun.geom(new Date());
    const lon = Sun.rotate(r.lon, S.regions && S.regions.date, r.lat), p = Sun.project(r.lat, lon, g.B0);
    const f = Data.diskFrac('HMIIF', 'sdo', g.rsun);
    const u = 0.5 + p.x * f, v = 0.5 - p.y * f, zoom = 5;
    const bg = Data.sdoUrl('HMIIF', 2048);
    const mk = magKey(r.mag);
    openSheet(`<div class="stitle">Sunspot group AR ${r.region}</div>
      <div class="zoom" style="background-image:url('${bg}');background-size:${zoom * 100}%;background-position:${(u * zoom - 0.5) / (zoom - 1) * 100}% ${(v * zoom - 0.5) / (zoom - 1) * 100}%"><span>Close-up · visible light</span></div>
      <div class="kv">
        <div><span>Position</span><b>${esc(r.loc)} ${lon > 60 ? '· near the west limb, rotating away' : lon < -60 ? '· just rotated into view' : p.x > -0.3 && p.x < 0.3 ? '· facing Earth' : ''}</b></div>
        <div><span>Spots</span><b>${r.spots == null ? '--' : r.spots}</b></div>
        <div><span>Area</span><b>${r.area == null ? '--' : r.area + ' millionths of the hemisphere'}</b></div>
        <div><span>McIntosh class</span><b>${esc(r.cls || '--')}</b></div>
        <div><span>Magnetic class</span><b>${esc(r.mag || '--')}</b></div>
        ${r.first ? `<div><span>First seen</span><b>${esc(String(r.first).slice(0, 10))}</b></div>` : ''}
      </div>
      ${MAG[mk] ? `<p class="muted">${MAG[mk]}.</p>` : ''}
      <div class="sect">Flare chance today</div>
      ${probBar('C', r.c, 'var(--c)')}${probBar('M', r.m, 'var(--m)')}${probBar('X', r.x, 'var(--x)')}
      <p class="muted small">From NOAA's daily region report (${esc(S.regions && S.regions.date || '')}). Positions are rotated forward to now.</p>`);
  }

  const TILE_INFO = {
    kp: ['Kp index', 'A 0–9 measure of how disturbed Earth\'s magnetic field is, updated every 3 hours. Kp 5 and above is a geomagnetic storm (G1–G5); around Kp 5–6 aurora can reach northern Germany, Kp 7+ the south.'],
    xray: ['X-ray flux', 'Solar X-rays measured by the GOES satellites. Flares are graded A, B, C, M and X — each step is ten times stronger. M and X flares can cause short radio blackouts on the day side of Earth (R1–R5).'],
    wind: ['Solar wind', 'The stream of particles from the Sun, measured by DSCOVR/ACE at the L1 point about an hour upstream of Earth. Normal is 300–450 km/s; fast streams from coronal holes and CME impacts push it to 600–1000+.'],
    bz: ['Bz and Bt', 'The interplanetary magnetic field. Bt is its total strength; Bz is the north–south part. When Bz points south (negative) for a while, energy pours into Earth\'s magnetic field — that is what drives aurora and storms.'],
    aurora: ['Aurora now', 'NOAA\'s OVATION model: the chance of seeing aurora overhead in the next ~30–90 minutes, plus the chance of seeing it low on the northern horizon from your place. Dark, clear skies away from city light are needed.'],
    density: ['Density', 'Protons per cubic centimetre in the solar wind. A sudden jump together with faster speed usually marks a shock from an arriving CME.'],
    probs: ['Flare chance', 'NOAA forecasters\' probability of at least one C, M or X-class flare over the next three days, and of a proton event.'],
    spots: ['Sunspots', 'Numbered active regions on the visible side of the Sun from NOAA\'s daily Solar Region Summary. Area is in millionths of the solar hemisphere (MSH) — 1000 MSH is visible with eclipse glasses.'],
  };
  function tileSheet(id) {
    if (id === 'aurora' && !settings().place) { setTab('places'); toast('Add your place for the aurora forecast'); return; }
    const [title, text] = TILE_INFO[id] || ['', ''];
    let extra = '';
    if (id === 'kp') extra = `<div class="card chartcard">${Charts.kpBars(kpSeries())}</div>` + (Pro.on() ? `<p class="muted small">Faded bars are NOAA's forecast.</p>` : `<button class="row prorow" data-pro="charts">${ic('pulse')}<span class="tx"><span class="t1">Kp forecast for the next 3 days</span><span class="t2">See when the next storm is due</span></span>${Pro.pill(true)}</button>`);
    if (id === 'xray' && S.xray) extra = Pro.on() ? xrayChart(S.xray) : Pro.lockCard(xrayChart(S.xray), 'charts', 'X-ray flux chart', 'Every flare of the last day or three');
    if ((id === 'wind' || id === 'density' || id === 'bz') && S.wind) { windSheet(id, title, text); return; }
    if (id === 'probs' && S.probs) extra = probsTable(S.probs);
    if (id === 'aurora' && S.ovation) {
      const pl = settings().place, a = S.ovation.at(pl.lat, pl.lon);
      extra = `<div class="kv"><div><span>Overhead at ${esc(pl.name)}</span><b>${a.here}%</b></div><div><span>Low on the horizon</span><b>${a.horizon}%</b></div><div><span>Forecast for</span><b>${Fmt.dayTime(S.ovation.fc)}</b></div></div>`;
    }
    if (id === 'spots' && S.regions) extra = `<p class="muted">${S.regions.list.length} groups on ${esc(S.regions.date || '')}. Tap a group in the list on the Sun tab for its close-up.</p>`;
    openSheet(`<div class="stitle">${title}</div><p class="lead">${text}</p>${extra}`);
  }

  function kpSeries() {
    if (S.kpFc && S.kpFc.length) {
      const now = Date.now(), until = Pro.on() ? now + 3 * 864e5 : now;
      return S.kpFc.filter((r) => r.t > now - 3 * 864e5 && r.t < until);
    }
    return S.kp ? S.kp.rows.slice(-24).map((r) => ({ ...r, kind: 'observed' })) : [];
  }
  const XBANDS = [{ from: -9, to: -7, color: '#999', label: 'A·B' }, { from: -6, to: -5, color: '#e8d454', label: 'C' }, { from: -5, to: -4, color: '#ff8f3d', label: 'M' }, { from: -4, to: -2, color: '#ff4d6d', label: 'X' }];
  function xrayChart(x) {
    return `<div class="card chartcard">${Charts.line([
      { pts: x.short.map((p) => ({ t: p.t, v: p.f })), color: '#7aa8ff', width: 1.2 },
      { pts: x.long.map((p) => ({ t: p.t, v: p.f })), color: '#ffb347', width: 1.8 },
    ], { h: 160, log: true, yMin: -8.5, yMax: -3, ticks: [-8, -7, -6, -5, -4], tickFmt: (v) => ['A', 'B', 'C', 'M', 'X'][v + 8], bands: XBANDS, now: true })}
    <div class="legend"><span style="--c:#ffb347">0.1–0.8 nm (flare class)</span><span style="--c:#7aa8ff">0.05–0.4 nm</span></div></div>`;
  }
  function windCharts(w, focus) {
    const sp = `<div class="ctitle">Speed · km/s</div>${Charts.line([{ pts: w.plasma.map((p) => ({ t: p.t, v: p.v })), color: 'var(--accent)', fill: 'var(--accent)' }], { h: 110 })}`;
    const de = `<div class="ctitle">Density · p/cm³</div>${Charts.line([{ pts: w.plasma.map((p) => ({ t: p.t, v: p.n })), color: '#c39bff', fill: '#c39bff' }], { h: 100, yMin: 0 })}`;
    const bz = `<div class="ctitle">Bz <i style="color:var(--m)">●</i> and Bt <i style="color:var(--muted)">●</i> · nT</div>${Charts.line([{ pts: w.mag.map((p) => ({ t: p.t, v: p.bt })), color: 'var(--muted)', width: 1.2 }, { pts: w.mag.map((p) => ({ t: p.t, v: -p.bt })), color: 'var(--muted)', width: 1.2 }, { pts: w.mag.map((p) => ({ t: p.t, v: p.bz })), color: 'var(--m)', fill: 'var(--m)' }], { h: 120, sym: true })}`;
    const order = focus === 'density' ? [de, sp, bz] : focus === 'bz' ? [bz, sp, de] : [sp, de, bz];
    return `<div class="card chartcard">${order.join('')}</div>`;
  }
  function probsTable(pr) {
    const d0 = U.utc(pr.date) || new Date();
    const days = [0, 1, 2].map((i) => Fmt.day(new Date(+d0 + i * 864e5)).split(' ').slice(0, 2).join(' '));
    const row = (n, a, c) => `<tr><th style="color:${c}">${n}</th>${a.map((v) => `<td>${v == null ? '--' : v + '%'}</td>`).join('')}</tr>`;
    return `<table class="tbl"><tr><th></th>${days.map((d) => `<th>${d}</th>`).join('')}</tr>${row('C-class', pr.c, 'var(--c)')}${row('M-class', pr.m, 'var(--m)')}${row('X-class', pr.x, 'var(--x)')}${row('Protons', pr.p, '#7aa8ff')}</table>`;
  }

  // ---------------- INCOMING TAB ----------------
  // Everything on its way to Earth: CMEs, NOAA's outlook, watches and warnings, flare-prone sunspot groups,
  // aurora at your place and your next eclipse.
  function evSeg() {
    return `<div class="evseg" data-evv>${[['next', 'Coming up', 'incoming'], ['past', 'Happened', 'bolt']].map(([v, l, i]) => `<button data-v="${v}" class="${v === evView ? 'on' : ''}">${ic(i)}${l}</button>`).join('')}</div>`;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-evv] button'); if (!b) return;
    e.stopPropagation();
    if (b.dataset.v === evView) return;
    evView = b.dataset.v; Store.set('evView', evView); evSel = null;
    render(); const tv = view.querySelector('.tabview'); if (tv) tv.scrollTop = 0;
  }, true);
  function renderIncoming() {
    const now = Date.now(), sc = S.scales, pr = S.probs, st = settings();
    // NOAA's next three days
    const days = sc ? sc.fc.map((f, i) => `<div class="tile mini inday" style="--lc:${lvlColor(f.g)}"><div class="lbl">${esc(dayLabel(f.date))}</div>
        <div class="val" style="color:${lvlColor(f.g)}">${f.g ? 'G' + f.g : 'Quiet'}</div>
        <div class="sub">${f.g ? ['', 'Minor storm', 'Moderate storm', 'Strong storm', 'Severe storm', 'Extreme storm'][f.g] : 'No storm expected'}${pr && pr.m[i] != null ? '<br>Flares: M\u00a0' + pr.m[i] + '%, X\u00a0' + pr.x[i] + '%' : ''}</div></div>`).join('') : '';
    const fcRows = (S.kpFc || []).filter((r) => +r.t > now - 3 * 3600e3 && +r.t < now + 3 * 864e5);
    const kpChart = fcRows.length ? `<div class="card chartcard">${Charts.kpBars(fcRows)}<div class="legend"><span style="--c:#6fcf97">Quiet</span><span style="--c:#e8d454">Active</span><span style="--c:#ffb13d">Storm G1+</span></div></div>` : '';
    // NOAA watches and warnings still in force
    const ww = (S.alerts || []).filter((a) => /^(watch|warning|extended warning)/.test(a.kind) && +a.t > now - 72 * 3600e3);
    // sunspot groups facing Earth (or just coming round) that could flare
    const regs = S.regions ? S.regions.list : [];
    const lonNow = (r) => Sun.rotate(r.lon, S.regions && S.regions.date, r.lat);
    const risky = (r) => (r.m || 0) >= 20 || (r.x || 0) >= 5 || /DELTA/i.test(r.mag || '') || r.mEv || r.xEv;
    const facing = regs.filter((r) => r.lon != null && Math.abs(lonNow(r)) <= 35 && risky(r));
    const coming = regs.filter((r) => r.lon != null && lonNow(r) < -50);
    const regRow = (r, sub) => `<button class="row inreg" data-reg="${r.region}" style="--mc:${Sun.regionColor(r)}"><span class="rnum">AR ${r.region}</span><span class="tx"><span class="t1">${esc(sub)}</span><span class="t2">M ${r.m == null ? '--' : r.m}% · X ${r.x == null ? '--' : r.x}% today · ${esc(r.mag || '')}</span></span>${ic('right')}</button>`;
    // aurora and eclipse at your place
    let aurora = '';
    if (!st.place) aurora = `<button class="row" data-act="place">${ic('pin')}<span class="tx"><span class="t1">Add your place</span><span class="t2">For the aurora chance and your next eclipse</span></span>${ic('right')}</button>`;
    else if (!Pro.on()) aurora = `<button class="row prorow" data-pro="aurora">${ic('aurora')}<span class="tx"><span class="t1">Aurora at ${esc(st.place.name)}</span><span class="t2">The live chance where you are, and an alert when it's worth going out</span></span>${Pro.pill(true)}</button>`;
    else if (S.ovation) { const a = S.ovation.at(st.place.lat, st.place.lon), v = Math.max(a.here, a.horizon); aurora = `<div class="row static">${ic('aurora')}<span class="tx"><span class="t1">Aurora at ${esc(st.place.name)}: <b style="color:${v >= 10 ? '#7cf0b0' : 'var(--text)'}">${v}%</b></span><span class="t2">${a.here >= 10 ? 'May be visible overhead' : a.horizon >= 5 ? 'Look low toward the poleward horizon' : 'Unlikely right now'} · NOAA forecast for ${Fmt.time(S.ovation.fc)}</span></span></div>`; }
    else aurora = '<div class="card skel" style="height:60px"></div>';
    const ec = st.place ? Eclipse.next(st.place) : null;
    const p = tabShell('events', `
      <div class="tab-title">Events</div>
      ${statRow("What's on its way to Earth ·")}
      ${evSeg()}
      ${CmeAnim.box(S.events, S.err.events)}
      <div class="sect-row"><div class="sect">Next 3 days</div><div class="sect-aside">NOAA forecast</div></div>
      ${sc ? `<div class="grid3">${days}</div>` : skel()}
      ${Pro.on() ? kpChart : `<button class="row prorow" data-pro="charts">${ic('pulse')}<span class="tx"><span class="t1">Kp forecast, 3 hours at a time</span><span class="t2">See exactly when the next storm is due</span></span>${Pro.pill(true)}</button>`}
      <div class="sect-row"><div class="sect">Watches & warnings</div><div class="sect-aside">NOAA</div></div>
      ${S.alerts ? (ww.length ? ww.map((a) => `<button class="row alert ${a.kind.startsWith('watch') ? 'watch' : 'warn'}" data-al="${S.alerts.indexOf(a)}"><span class="tag">${esc(a.kind)}</span><span class="tx"><span class="t1">${esc(a.title)}</span><span class="t2">${Fmt.dayTime(a.t)}</span></span></button>`).join('') : '<p class="muted">No watches or warnings from NOAA right now.</p>') : skel()}
      <div class="sect-row"><div class="sect">Sunspot groups to watch</div></div>
      ${S.regions ? (facing.length || coming.length ? facing.map((r) => regRow(r, 'Facing Earth — flares from here hit hardest')).join('') + coming.map((r) => regRow(r, 'Just rotated into view — faces Earth in about ' + Math.max(1, Math.round((0 - lonNow(r)) / 13.2)) + ' days')).join('')
        : '<p class="muted">No flare-prone groups facing Earth right now.</p>') : skel()}
      <div class="sect-row"><div class="sect">At your place</div></div>
      ${aurora}
      ${ec ? `<button class="row" data-act="eclipse">${ic('eclipse')}<span class="tx"><span class="t1">Next eclipse: ${esc(Fmt.day(ec.peak))} ${ec.peak.getFullYear()}</span><span class="t2">${ec.kind === 'partial' ? Math.round(ec.cover * 100) + '% of the Sun covered' : ec.kind === 'total' ? 'Total eclipse' : 'Ring of fire'} from ${esc(st.place.name)}</span></span>${ic('right')}</button>` : ''}
      <p class="attrib">CMEs: NASA CCMC DONKI (WSA-ENLIL model) · Forecasts, alerts, regions, aurora: NOAA SWPC</p>`);
    CmeAnim.start(p, S.events);
    p.addEventListener('click', (e) => {
      const ce = e.target.closest('[data-cmeev]'); if (ce && S.events) { const ev = S.events.find((x) => x.kind === 'cme' && String(+x.t) === ce.dataset.cmeev); if (ev) eventSheet(ev); return; }
      const a = e.target.closest('[data-al]'); if (a) { const x = S.alerts[+a.dataset.al]; openSheet(`<div class="stitle">${esc(x.title)}</div><p class="muted small">${Fmt.dayTime(x.t)} · ${esc(x.id || '')}</p><pre class="msg">${esc(x.msg)}</pre>`); return; }
      const r = e.target.closest('[data-reg]'); if (r) { const g = regs.find((x) => String(x.region) === r.dataset.reg); if (g) regionSheet(g); return; }
      const act = e.target.closest('[data-act]');
      if (act && act.dataset.act === 'eclipse') setTab('eclipse');
      if (act && act.dataset.act === 'place') setTab('places');
    });
  }

  // ---------------- ACTIVITY TAB ----------------
  let wRange = Store.get('wRange', 'day'), xRange = Store.get('xRange', 'day');
  function seg(name, cur, opts) { return `<div class="seg mini" data-seg="${name}">${opts.map(([v, l]) => `<button data-v="${v}" class="${v === cur ? 'on' : ''}">${l}</button>`).join('')}</div>`; }
  function renderActivity() {
    const w = wRange === 'week' ? S.wind7 : S.wind, x = xRange === '3d' ? S.xray3 : S.xray;
    const sc = S.scales;
    const p = tabShell('activity', `
      <div class="tab-title">Activity</div>
      ${statRow()}
      <div class="sect-row"><div class="sect">Geomagnetic · Kp</div></div>
      <div class="card chartcard">${S.kp || S.kpFc ? Charts.kpBars(kpSeries()) : skel()}<div class="legend"><span style="--c:#6fcf97">Quiet</span><span style="--c:#e8d454">Active</span><span style="--c:#ffb13d">Storm G1+</span>${Pro.on() ? '<span class="fc">Forecast</span>' : ''}</div></div>
      ${Pro.on() ? '' : `<button class="row prorow" data-pro="charts">${ic('pulse')}<span class="tx"><span class="t1">Kp forecast for the next 3 days</span><span class="t2">See when the next storm is due</span></span>${Pro.pill(true)}</button>`}
      <div class="sect-row"><div class="sect">X-rays · flares</div>${Pro.on() ? seg('x', xRange, [['day', '24 h'], ['3d', '3 days']]) : ''}</div>
      ${!Pro.on() ? Pro.lockCard(S.xray ? xrayChart(S.xray) : skel(), 'charts', 'X-ray flux chart', 'Every flare, with C, M and X bands') : x ? xrayChart(x) : `<div class="card chartcard">${skel()}</div>`}
      <div class="sect-row"><div class="sect">Solar wind</div><div class="sect-aside">DSCOVR / ACE at L1</div></div>
      <div class="wpanel">${windPanel('wind')}</div>
      <div class="sect-row"><div class="sect">Solar cycle 25</div></div>
      ${cycleCard()}
      `);
    p.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-seg] button');
      if (b && b.parentNode.dataset.seg === 'wr') { windRange = b.dataset.v; Store.set('windRange', windRange); render(); return; }
      if (b) {
        const which = b.parentNode.dataset.seg, v = b.dataset.v;
        if (which === 'w') { wRange = v; Store.set('wRange', v); if (v === 'week' && !S.wind7) { try { S.wind7 = await Data.wind(false, true); } catch (er) { toast('Week of solar wind unavailable'); } } }
        if (which === 'x') { xRange = v; Store.set('xRange', v); if (v === '3d' && !S.xray3) { try { S.xray3 = await Data.xray(false, true); } catch (er) { toast('3 days of X-rays unavailable'); } } }
        render(); return;
      }
      if (e.target.closest('[data-act=cycle]')) cyclePage();
      const ce = e.target.closest('[data-cmeev]'); if (ce && S.events) { const ev = S.events.find((x) => x.kind === 'cme' && String(+x.t) === ce.dataset.cmeev); if (ev) eventSheet(ev); return; }
    });
  }
  function outlookTable(sc) {
    return `<table class="tbl"><tr><th></th>${sc.fc.map((f) => `<th>${esc(dayLabel(f.date))}</th>`).join('')}</tr>
      <tr><th>Storm (max G)</th>${sc.fc.map((f) => `<td>${f.g ? 'G' + f.g : 'None'}</td>`).join('')}</tr>
      <tr><th>Radio blackout R3+</th>${sc.fc.map((f) => `<td>${f.rMajor == null ? '--' : f.rMajor + '%'}</td>`).join('')}</tr></table>`;
  }
  function dayLabel(s) { const d = U.utc(String(s).replace(/^(\w{3}) (\d{2}) (\d{4})$/, '$3-$1-$2')) || new Date(s); return isNaN(d) ? s : Fmt.day(d); }
  const skel = () => '<div class="skel" style="height:110px"></div>';

  function cycleCard(big) {
    const c = S.cycle;
    if (!c) return `<div class="card chartcard">${S.err.cycle ? `<p class="muted">Couldn't load the solar cycle (${esc(S.err.cycle)}).</p>` : skel()}</div>`;
    const from = big ? '1996-01' : '2008-01';
    const toT = (s) => U.utc(s.length === 7 ? s + '-15' : s);
    const obs = c.obs.filter((o) => o.t >= from).map((o) => ({ t: toT(o.t), ssn: o.ssn, sm: o.sm }));
    const pred = c.pred.map((o) => ({ t: toT(o.t), v: o.ssn, hi: o.hi, lo: o.lo }));
    const last = obs[obs.length - 1];
    const maxSm = obs.filter((o) => o.sm != null && o.t > new Date('2020-01-01')).reduce((a, o) => (o.sm > a.sm ? o : a), { sm: -1 });
    return `<${big ? 'div' : 'button'} class="card chartcard cyc"${big ? '' : ' data-act="cycle"'}>
      ${Charts.line([
        { pts: obs.map((o) => ({ t: o.t, v: o.ssn })), color: '#ffb347', width: 1, fill: '#ffb347' },
        { pts: obs.map((o) => ({ t: o.t, v: o.sm })), color: '#fff2c4', width: 2.2 },
        { pts: pred.map((o) => ({ t: o.t, v: o.hi })), color: '#7aa8ff', width: 0.8 },
        { pts: pred.map((o) => ({ t: o.t, v: o.lo })), color: '#7aa8ff', width: 0.8 },
        { pts: pred.map((o) => ({ t: o.t, v: o.v })), color: '#7aa8ff', width: 1.8 },
      ], { h: big ? 200 : 140, yMin: 0, gap: 40 * 864e5, xTicks: (big ? [2000, 2005, 2010, 2015, 2020, 2025, 2030] : [2010, 2015, 2020, 2025, 2030]).map((y) => Date.UTC(y, 0, 1)), xFmt: (d) => String(d.getUTCFullYear()) })}
      <div class="legend"><span style="--c:#ffb347">Monthly</span><span style="--c:#fff2c4">Smoothed</span><span style="--c:#7aa8ff">NOAA prediction</span></div>
      ${last ? `<div class="cycstats"><div><b>${fmt(last.ssn)}</b><span>${esc(Fmt.MONTHS[last.t.getUTCMonth()] + ' ' + last.t.getUTCFullYear())}</span></div>${maxSm.sm > 0 ? `<div><b>${fmt(maxSm.sm, 1)}</b><span>Cycle 25 peak (smoothed, ${Fmt.MONTHS[maxSm.t.getUTCMonth()]} ${maxSm.t.getUTCFullYear()})</span></div>` : ''}</div>` : ''}
    </${big ? 'div' : 'button'}>`;
  }
  function cyclePage() {
    const show = (p) => { $('.pbody', p).innerHTML = cycleCard(true) + `<p class="lead">The Sun's activity rises and falls over roughly 11 years. Cycle 25 began in December 2019; its smoothed peak marks solar maximum, after which sunspots slowly fade toward the next minimum — though big flares and storms often continue in the declining years.</p><p class="muted small">Sunspot numbers: SILSO / NOAA SWPC.</p>`; };
    const p = pushPage('Solar cycle', '', (pg) => show(pg));
    if (!S.cycle) loadSlow().then(() => p.isConnected && show(p));
  }

  // ---------------- TIME-LAPSE (Pro) ----------------
  // 24 pictures of the Sun, one every 2 hours over the last 2 days (Helioviewer), played as a flip-book.
  // NASA's own 48-hour movies are no longer updated, so the app builds its own.
  function timelapsePage(ch) {
    let cur = ch, timer = null, gen = 0;
    const p = pushPage('The last 48 hours', '');
    const body = $('.pbody', p);
    const stop = () => { clearInterval(timer); timer = null; };
    const obs = new MutationObserver(() => { if (!p.isConnected) { stop(); gen++; obs.disconnect(); } });
    obs.observe(document.body, { childList: true });
    const N = 24, STEP = 2 * 3600e3;
    function show() {
      stop(); const my = ++gen;
      const c = Data.CHANNELS.find((x) => x.id === cur) || Data.CHANNELS[0];
      const end = Math.floor((Date.now() - 3600e3) / 900e3) * 900e3; // newest picture about an hour old, on a 15-minute step
      const frames = []; for (let k = N - 1; k >= 0; k--) frames.push(end - k * STEP);
      body.innerHTML = `<div class="chips tlchips">${Data.CHANNELS.map((x) => `<button class="chip${x.id === cur ? ' on' : ''}" data-tl="${x.id}"><i style="background:${x.tint || '#888'}"></i>${x.name}</button>`).join('')}</div>
        <div class="tlbox"><img class="tlf on" alt=""><div class="tlmsg">Loading pictures… <b>0</b> of ${N}</div>
          <div class="tlctl"><button class="icon-btn" data-tlp>${ic('play')}</button><input type="range" min="0" max="${N - 1}" value="${N - 1}"><span class="tlt"></span></div></div>
        <p class="muted small center">${esc(c.name)} · ${esc(c.sub)} · one picture every 2 hours · Helioviewer (NASA SDO)</p>
        <p class="lead">Watch sunspot groups turn with the Sun, loops flicker over active regions and flares flash. The Sun turns once every ~27 days as seen from Earth, so in two days spots move about a quarter of the way across.</p>`;
      const box = $('.tlbox', body), img = $('.tlf', box), msg = $('.tlmsg', box), cnt = $('b', msg);
      const rng = $('input', box), lbl = $('.tlt', box), btn = $('[data-tlp]', box);
      const got = new Array(N).fill(null);
      let i = N - 1, loaded = 0;
      const ready = () => got.map((u, k) => (u ? k : -1)).filter((k) => k >= 0);
      const go = (k) => { i = k; rng.value = k; lbl.textContent = Fmt.dayTime(new Date(frames[k])); if (got[k]) img.src = got[k]; };
      const play = () => {
        stop(); btn.innerHTML = ic('pause');
        timer = setInterval(() => { const r = ready(); if (r.length < 2) return; const nx = r.find((k) => k > i); go(nx == null ? r[0] : nx); }, 420);
      };
      btn.addEventListener('click', () => { if (timer) { stop(); btn.innerHTML = ic('play'); } else play(); });
      rng.addEventListener('input', () => { stop(); btn.innerHTML = ic('play'); const want = +rng.value, r = ready(); if (!r.length) return; const k = r.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a)); go(k); rng.value = want; });
      lbl.textContent = Fmt.dayTime(new Date(frames[N - 1]));
      // load newest first, four at a time; start playing once a few are in
      const order = frames.map((_, k) => N - 1 - k);
      let next = 0, failed = 0;
      const pump = () => {
        if (my !== gen || next >= order.length) return;
        const k = order[next++], im = new Image();
        im.onload = () => {
          if (my !== gen) return;
          got[k] = im.src; loaded++; cnt.textContent = loaded;
          if (k === N - 1 && !timer) go(k);
          if (loaded === 6 && !timer) play();
          if (loaded === N) msg.style.display = 'none';
          pump();
        };
        im.onerror = () => { if (my !== gen) return; failed++; if (failed > N / 2 && !loaded) msg.innerHTML = 'Pictures unavailable right now — try again later'; pump(); };
        im.src = Data.hvUrl(cur, 512, frames[k]);
      };
      for (let w = 0; w < 4; w++) pump();
      const on = $('.tlchips .on', body); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
    }
    body.addEventListener('click', (e) => { const b = e.target.closest('[data-tl]'); if (b) { cur = b.dataset.tl; show(); } });
    show();
  }

  // ---------------- EVENTS TAB ----------------
  let evFilter = Store.get('evFilter', 'all');
  let evSel = null; // a Set of ids while choosing several events to remove
  // "Last 30 days" is split into pages
  const EV_PAGE = 15;
  let evPage = 0;
  function pager(pages) {
    if (pages < 2) return '';
    const nums = [];
    for (let k = 0; k < pages; k++) {
      if (pages > 7 && k > 0 && k < pages - 1 && Math.abs(k - evPage) > 1) { if (nums[nums.length - 1] !== '…') nums.push('…'); continue; }
      nums.push(k);
    }
    return `<div class="pager"><button data-pg="${evPage - 1}" ${evPage ? '' : 'disabled'} aria-label="Previous page">${ic('back')}</button>` +
      nums.map((k) => (k === '…' ? '<span class="pgdots">…</span>' : `<button data-pg="${k}" class="pgn${k === evPage ? ' on' : ''}">${k + 1}</button>`)).join('') +
      `<button data-pg="${evPage + 1}" class="flip" ${evPage < pages - 1 ? '' : 'disabled'} aria-label="Next page">${ic('back')}</button></div>`;
  }
  function renderEvents() {
    const al = S.alerts || [];
    const ev = S.events || [];
    let hidden = hiddenSet();
    if (hidden.size > 100) {
      // forget removals older than 35 days: they have dropped out of the 30-day lists anyway
      const cut = Date.now() - 35 * 864e5;
      const keep = Array.from(hidden).filter((id) => { const t = +String(id).split('|')[2]; return !(t > 0) || t > cut; });
      if (keep.length < hidden.size) { Store.set('hiddenEv', keep); hidden = new Set(keep); }
    }
    // Alerts and warnings go 3 days after what they describe has passed.
    const alCut = Date.now() - 3 * 864e5;
    const alShown = al.filter((a) => +(a.until || a.t) >= alCut && !hidden.has(alId(a)));
    // Rolling 30 days: anything older drops off by itself.
    const cutoff = Date.now() - 30 * 864e5;
    const shown = ev.filter((e) => +e.t >= cutoff && (evFilter === 'all' || e.kind === evFilter) && !hidden.has(evId(e)));
    const pages = Math.max(1, Math.ceil(shown.length / EV_PAGE));
    if (evPage >= pages) evPage = pages - 1;
    const pageItems = shown.slice(evPage * EV_PAGE, evPage * EV_PAGE + EV_PAGE);
    const nHidden = restorable().length;
    const icon = { flare: 'bolt', cme: 'cme', storm: 'magnet' };
    const kinds = { warning: 'warn', watch: 'watch', alert: 'alert', summary: 'sum' };
    const allIds = alShown.map(alId).concat(shown.map(evId));
    const AL_MAX = evSel ? alShown.length : 12;
    if (evSel) for (const id of Array.from(evSel)) if (!allIds.includes(id)) evSel.delete(id);
    const ck = (id) => (evSel ? `<span class="ck${evSel.has(id) ? ' on' : ''}">${ic('check')}</span>` : '');
    const selCls = (id) => (evSel && evSel.has(id) ? ' picked' : '');
    const p = tabShell('events', `
      <div class="tab-title">Events</div>
      ${statRow('What already happened ·')}
      ${evSeg()}
      ${evSel ? `<div class="selbar"><span><b>${evSel.size}</b> selected</span><button data-act="selall">${evSel.size === allIds.length && allIds.length ? 'Select none' : 'Select all ' + allIds.length}</button><button data-act="selcancel">Cancel</button></div>`
        : `<div class="selrow"><p class="muted top">${nHidden ? '' : 'Swipe a card to the right to remove it · pull down to refresh'}</p>${nHidden ? `<button class="selbtn" data-act="restoresheet">${ic('refresh')} Restore ${nHidden}</button>` : ''}${allIds.length ? `<button class="selbtn" data-act="selstart">${ic('check')} Select</button>` : ''}</div>`}
      <div class="sect-row"><div class="sect">NOAA alerts & warnings</div></div>
      ${S.alerts ? (alShown.length ? '<div class="alist">' + alShown.slice(0, AL_MAX).map((a) => `<button class="row alert ${kinds[a.kind.split(' ')[0]] || ''}${selCls(alId(a))}" data-al="${al.indexOf(a)}" data-swipe="${esc(alId(a))}">${ck(alId(a))}<span class="tag">${esc(a.kind)}</span><span class="tx"><span class="t1">${esc(a.title)}</span><span class="t2">${Fmt.dayTime(a.t)}</span></span></button>`).join('') + '</div>' : `<p class="muted">${al.length ? 'All alerts removed.' : 'No alerts in the last few days.'}</p>`) : S.err.alerts ? `<p class="muted">Couldn't load alerts (${esc(S.err.alerts)}).</p>` : skel()}
      <div class="sect-row" id="ev30"><div class="sect">Last 30 days${shown.length ? ` <span class="sect-n">${shown.length}</span>` : ''}</div>${seg('ev', evFilter, [['all', 'All'], ['flare', 'Flares'], ['cme', 'CMEs'], ['storm', 'Storms']])}</div>
      ${S.events ? (shown.length ? '<div class="evlist">' + pageItems.map((e) => {
        const i = ev.indexOf(e);
        let title, sub, col;
        if (e.kind === 'flare') { title = (e.cls || '?') + ' flare'; sub = (e.ar ? 'AR ' + e.ar + ' · ' : '') + (e.loc || ''); col = flareColor(e.cls); }
        else if (e.kind === 'cme') { title = 'Coronal mass ejection' + (e.speed ? ' · ' + e.speed + ' km/s' : ''); sub = e.earth ? 'Earth-directed component' + (e.arrival ? ' · arrival ' + Fmt.dayTime(e.arrival) : '') : (e.loc ? 'From ' + e.loc : 'Not Earth-directed'); col = e.earth ? 'var(--m)' : 'var(--accent)'; }
        else { title = 'Geomagnetic storm' + (e.kp != null ? ' · Kp ' + fmt(e.kp, 1) + ' (G' + gOf(e.kp) + ')' : ''); sub = ''; col = e.kp != null ? Charts.kpColor(e.kp) : 'var(--m)'; }
        return `<button class="row ev${selCls(evId(e))}" data-ev="${i}" data-swipe="${esc(evId(e))}" style="--ec:${col}">${ck(evId(e))}<span class="evic">${ic(icon[e.kind])}</span><span class="tx"><span class="t1">${esc(title)}</span><span class="t2">${Fmt.dayTime(e.t)}${sub ? ' · ' + esc(sub) : ''}</span></span></button>`;
      }).join('') + '</div>' + pager(pages) : '<p class="muted">Nothing of this kind in the last 30 days.</p>') : S.err.events ? `<p class="muted">Couldn't reach NASA DONKI (${esc(S.err.events)}).</p>` : skel()}
      ${nHidden ? `<button class="restore" data-act="restore">${nHidden} removed · <b>Bring back</b><br><small>Removals become permanent when you close Solar</small></button>` : ''}
      <button class="card linkcard" data-act="disc"><span class="lc-ic">${ic('info')}</span><span class="tx"><b>Forecaster discussion</b><small>NOAA SWPC's written analysis, updated twice a day</small></span>${ic('right')}</button>
      <button class="card linkcard" data-act="guide"><span class="lc-ic">${ic('book')}</span><span class="tx"><b>Space weather scales & guide</b><small>What R, S and G levels mean — in the Guide tab</small></span>${ic('right')}</button>
      <p class="attrib">Events: NASA CCMC DONKI · Alerts & scales: NOAA SWPC</p>
      ${evSel ? `<button class="btn selremove${evSel.size ? '' : ' off'}" data-act="selremove">${ic('trash')} ${evSel.size && evSel.size === allIds.length ? 'Remove all ' + evSel.size : 'Remove ' + (evSel.size || '')}</button>` : ''}`);
    p.addEventListener('click', (e) => {
      const sa = e.target.closest('[data-act]');
      if (sa && sa.dataset.act === 'selstart') { evSel = new Set(); render(); return; }
      if (sa && sa.dataset.act === 'selcancel') { evSel = null; render(); return; }
      if (sa && sa.dataset.act === 'selall') { evSel = evSel.size === allIds.length ? new Set() : new Set(allIds); render(); return; }
      if (sa && sa.dataset.act === 'selremove') {
        if (!evSel.size) return;
        const ids = Array.from(evSel), h = Store.get('hiddenEv', []);
        Store.set('hiddenEv', Array.from(new Set(h.concat(ids)))); ids.forEach((id) => removedNow.add(id));
        evSel = null; render();
        toast('Removed ' + ids.length + (ids.length === 1 ? ' event' : ' events'), 'Undo', () => { unhide(ids); render(); });
        return;
      }
      if (evSel) { const r = e.target.closest('[data-swipe]'); if (r) { const id = r.dataset.swipe; if (evSel.has(id)) evSel.delete(id); else evSel.add(id); render(); return; } }
      const b = e.target.closest('[data-seg] button');
      if (b) { evFilter = b.dataset.v; Store.set('evFilter', evFilter); evPage = 0; render(); return; }
      const pg = e.target.closest('[data-pg]');
      if (pg) { evPage = +pg.dataset.pg; render(); const h = $('#ev30'); if (h) h.scrollIntoView({ block: 'start' }); return; }
      const a = e.target.closest('[data-al]');
      if (a) { const x = al[+a.dataset.al]; openSheet(`<div class="stitle">${esc(x.title)}</div><p class="muted small">${Fmt.dayTime(x.t)} · ${esc(x.id || '')}</p><pre class="msg">${esc(x.msg)}</pre>`); return; }
      const v = e.target.closest('[data-ev]');
      if (v) { eventSheet(ev[+v.dataset.ev]); return; }
      const act = e.target.closest('[data-act]');
      if (act && act.dataset.act === 'disc') discPage();
      if (act && act.dataset.act === 'guide') setTab('guide');
      if (act && act.dataset.act === 'restore') { unhide(restorable()); render(); toast('Removed events are back'); }
      if (act && act.dataset.act === 'restoresheet') restoreSheet();
      const sc = e.target.closest('[data-scale]');
      if (sc) scaleSheet(sc.dataset.scale);
    });
  }
  // Events removed since Solar was opened: bring back all of them or one at a time.
  function restoreSheet() {
    const ids = new Set(restorable()), al = S.alerts || [], ev = S.events || [];
    const items = [];
    for (const a of al) if (ids.has(alId(a))) items.push({ id: alId(a), t: a.t, title: a.title, sub: 'NOAA ' + a.kind });
    for (const e of ev) if (ids.has(evId(e))) items.push({ id: evId(e), t: e.t, title: e.kind === 'flare' ? (e.cls || '?') + ' flare' : e.kind === 'cme' ? 'Coronal mass ejection' + (e.speed ? ' · ' + e.speed + ' km/s' : '') : 'Geomagnetic storm' + (e.kp != null ? ' · Kp ' + fmt(e.kp, 1) : ''), sub: e.kind === 'flare' ? 'Flare' : e.kind === 'cme' ? 'CME' : 'Storm' });
    items.sort((a, b) => b.t - a.t);
    openSheet(`<div class="stitle">${ic('refresh')} Removed just now</div>
      <p class="lead">${ids.size} removed since you opened Solar. You can bring them back until you close the app — after that they're gone for good.</p>
      <button class="btn wide" data-r="all">${ic('refresh')} Restore all ${ids.size}</button>
      <div class="rlist">${items.map((x) => `<div class="row static"><span class="tx"><span class="t1">${esc(x.title)}</span><span class="t2">${esc(x.sub)} · ${Fmt.dayTime(x.t)}</span></span><button class="selbtn" data-r="${esc(x.id)}">Restore</button></div>`).join('')}</div>`, (sh) => {
      sh.addEventListener('click', (e) => {
        const b = e.target.closest('[data-r]'); if (!b) return;
        if (b.dataset.r === 'all') { unhide(Array.from(ids)); closeSheet(); render(); toast('Removed events are back'); return; }
        unhide([b.dataset.r]); ids.delete(b.dataset.r);
        const row = b.closest('.row'); if (row) row.remove();
        render(); toast('Restored');
        if (!ids.size) closeSheet();
      });
    });
  }
  const alId = (a) => 'a|' + (a.id || '') + '|' + (+a.t);
  const evId = (e) => 'e|' + e.kind + '|' + (+e.t) + '|' + (e.cls || e.speed || e.kp || '');
  const hiddenSet = () => new Set(Store.get('hiddenEv', []));
  // Removed this session: these can still be restored. Once Solar is closed, removals are permanent.
  const removedNow = new Set();
  const restorable = () => { const h = hiddenSet(); return Array.from(removedNow).filter((id) => h.has(id)); };
  function unhide(ids) { const drop = new Set(ids); Store.set('hiddenEv', Store.get('hiddenEv', []).filter((x) => !drop.has(x))); ids.forEach((id) => removedNow.delete(id)); }
  function hideEvent(id) {
    const h = Store.get('hiddenEv', []); if (!h.includes(id)) h.push(id); Store.set('hiddenEv', h); removedNow.add(id);
    render();
    toast('Removed', 'Undo', () => { unhide([id]); render(); });
  }
  function scaleSheet(k) {
    const cur = S.scales ? S.scales.now[k.toLowerCase()] : 0;
    openSheet(Scales.sheetHtml(k, cur), (sh) => sh.querySelector('.sctabs').addEventListener('click', (e) => { const b = e.target.closest('[data-sw]'); if (b) scaleSheet(b.dataset.sw); }));
  }
  function eventSheet(e) {
    let h = '';
    if (e.kind === 'flare') h = `<div class="stitle" style="color:${flareColor(e.cls)}">${esc(e.cls)} solar flare</div><div class="kv">
      <div><span>Start</span><b>${Fmt.dayTime(e.begin)}</b></div><div><span>Peak</span><b>${Fmt.dayTime(e.t)}</b></div><div><span>End</span><b>${Fmt.dayTime(e.end)}</b></div>
      ${e.ar ? `<div><span>Region</span><b>AR ${e.ar}</b></div>` : ''}${e.loc ? `<div><span>Location</span><b>${esc(e.loc)}</b></div>` : ''}</div>`;
    else if (e.kind === 'cme') h = `<div class="stitle">${CmeAnim.active([e]).length ? `<i class="cmedot" style="--cc:${CmeAnim.colorFor(e, S.events && S.events.includes(e) ? S.events : [e])};display:inline-block;margin:0 8px 2px 0;vertical-align:middle"></i>` : ''}Coronal mass ejection</div><div class="kv">
      <div><span>Seen from</span><b>${Fmt.dayTime(e.t)}</b></div>${e.speed ? `<div><span>Speed</span><b>${e.speed} km/s</b></div>` : ''}${e.half ? `<div><span>Half-width</span><b>${e.half}°</b></div>` : ''}
      ${e.loc ? `<div><span>Source</span><b>${esc(e.loc)}${e.ar ? ' · AR ' + e.ar : ''}</b></div>` : ''}<div><span>Toward Earth</span><b>${e.earth ? 'Yes — expected glancing blow or impact' : 'No'}</b></div>
      ${e.arrival ? `<div><span>Model arrival</span><b>${Fmt.dayTime(e.arrival)}</b></div>` : ''}</div>${e.note ? `<p class="muted">${esc(e.note)}</p>` : ''}`;
    else h = `<div class="stitle">Geomagnetic storm</div><div class="kv"><div><span>Began</span><b>${Fmt.dayTime(e.t)}</b></div>${e.kp != null ? `<div><span>Peak Kp</span><b>${fmt(e.kp, 1)} · ${kpText(e.kp)}</b></div>` : ''}</div>`;
    if (e.kind === 'cme' && CmeAnim.active([e]).length) h = h.replace('<div class="kv">', `<canvas class="cmecv" data-cme-anim data-only="${+e.t}"></canvas><div class="kv">`) +
      `<div class="kv"><div><span>${+e.arrival > Date.now() ? 'Arrives' : 'Arrived'}</span><b>${Fmt.dayTime(e.arrival)} · ${esc(CmeAnim.until(e.arrival))}</b></div>${e.kpMax != null ? `<div><span>Expected Kp</span><b>up to ${e.kpMax}${e.kpMax >= 5 ? ' (G' + Math.min(5, Math.floor(e.kpMax) - 4) + ')' : ''}</b></div>` : ''}${e.glancing ? '<div><span>Impact</span><b>Glancing blow</b></div>' : ''}</div>`;
    if (e.link) h += `<button class="btn ghost" data-open="${esc(e.link)}">${ic('link')} Open in DONKI</button>`;
    openSheet(h, (s) => {
      CmeAnim.start(s, S.events && S.events.includes(e) ? S.events : [e]); const b = s.querySelector('[data-open]'); if (b) b.addEventListener('click', () => openExternal(b.dataset.open)); });
  }
  function discPage() {
    const p = pushPage('Forecaster discussion', skel());
    const fill = (t) => { if (p.isConnected) $('.pbody', p).innerHTML = `<pre class="msg">${esc(t)}</pre>`; };
    if (S.disc) fill(S.disc);
    Data.discussion().then((t) => { S.disc = t; fill(t); }).catch((er) => p.isConnected && ($('.pbody', p).innerHTML = `<p class="muted">Couldn't load (${esc(er.message)}).</p>`));
  }
  function openExternal(u) { if (window.Native && Native.open) Native.open(u); else window.open(u, '_blank'); }

  // ---------------- SETTINGS TAB ----------------
  function renderSettings() {
    const st = settings();
    const p = tabShell('settings', `
      <div class="set-titlebar"><button class="icon-btn" data-act="setback" aria-label="Back">${ic('back')}</button><div class="tab-title">Settings</div></div>
      <button class="card prohead${Pro.on() ? ' on' : ''}" data-pro-open="1"><span class="pfi">${ic('star')}</span><span class="tx"><b>Solar Pro</b><small>${esc(Pro.status())}</small></span>${ic('right')}</button>
      <div class="sect">Your place · for aurora and eclipses</div>
      <button class="row" data-act="places">${ic('pin')}<span class="tx"><span class="t1">${st.place ? esc(st.place.name) : 'Not set'}</span><span class="t2">${placesList().length > 1 ? placesList().length + ' places saved · change in Places' : 'Add and switch places in the Places tab'}</span></span>${ic('right')}</button>
      <div class="sect">Sun image</div>
      <div class="row static col"><span class="t1">Picture size</span><span class="t2">Bigger is sharper for close-ups but uses more data</span>${seg('res', String(st.res), [['512', 'Small'], ['1024', 'Medium'], ['2048', 'Large']])}</div>
      ${Pro.on() ? '' : `<button class="row prorow" data-pro="views">${ic('layers')}<span class="tx"><span class="t1">7 more views of the Sun</span><span class="t2">Corona, flares, magnetic field and a 48-hour time-lapse</span></span>${Pro.pill(true)}</button>`}
      <button class="row" data-act="marks">${ic('spots')}<span class="tx"><span class="t1">Sunspot group markers</span><span class="t2">Numbered rings on the sun image</span></span><span class="sw${st.marks ? ' on' : ''}"><i></i></span></button>
      <div class="sect">Notifications</div>
      ${notifRows()}
      <div class="sect">Home-screen widgets</div>
      <p class="muted small" style="margin:0 4px 8px">Tap <b>Add</b> and your phone asks where to put it. Stretch the Full page widget to fill a whole screen. They refresh every 30 minutes; tap one to open that part of the app.</p>
      <div class="card list">${WIDGETS.map(([k, n, d, sz]) => `<div class="row static">${ic('widget')}<span class="tx"><span class="t1">${n} <small class="muted">${sz}</small>${(k === 'full' || k === 'aurora') && !Pro.on() ? ' ' + Pro.pill(true) : ''}</span><span class="t2">${d}</span></span><button class="btn small" data-addw="${k}">${ic('plus')} Add</button></div>`).join('')}</div>
      <div class="sect">Times</div>
      <div class="row static col">${seg('utc', Fmt.utcMode() ? 'utc' : 'local', [['local', 'Local time'], ['utc', 'UTC']])}</div>
      <div class="sect">Help</div>
      <div class="card list">
        <button class="row" data-help="tour">${ic('play')}<span class="tx"><span class="t1">Replay the tour</span><span class="t2">A 1-minute walk through every tab</span></span>${ic('right')}</button>
        <button class="row" data-help="new">${ic('star')}<span class="tx"><span class="t1">What's new in Solar ${window.Onboard ? Onboard.VERSION.split('.')[0] : ''}</span><span class="t2">The newest features, shown in place</span></span>${ic('right')}</button>
        <button class="row" data-help="welcome">${ic('sun')}<span class="tx"><span class="t1">Welcome screens</span><span class="t2">City, alerts and Solar Pro</span></span>${ic('right')}</button>
        <button class="row" data-help="crash">${ic('alert')}<span class="tx"><span class="t1">Problem reports</span><span class="t2">${window.CrashLog && CrashLog.count() ? CrashLog.count() + ' saved on this phone · nothing is sent automatically' : 'None saved · nothing is sent automatically'}</span></span>${ic('right')}</button>
      </div>
      <div class="sect">Data</div>
      <div class="row static"><span class="tx"><span class="t1">NOAA Space Weather Prediction Center</span><span class="t2">Kp, solar wind, X-rays, sunspot regions, scales, alerts, aurora, solar cycle</span></span></div>
      <div class="row static"><span class="tx"><span class="t1">NASA Solar Dynamics Observatory</span><span class="t2">Live sun images every 15 minutes · Helioviewer as backup</span></span></div>
      <div class="row static"><span class="tx"><span class="t1">Natural Earth</span><span class="t2">Country outlines for eclipse paths (public domain, via world-atlas)</span></span></div>
      <div class="row static"><span class="tx"><span class="t1">Astronomy Engine</span><span class="t2">Sun and Moon positions for eclipses, calculated on your phone (MIT licence, Don Cross)</span></span></div>
      <div class="row static"><span class="tx"><span class="t1">NASA CCMC DONKI</span><span class="t2">Flares, CMEs and storms of the last 30 days</span></span></div>
      <button class="row" data-act="cache">${ic('trash')}<span class="tx"><span class="t1">Clear saved data</span><span class="t2">Everything is downloaded fresh next time</span></span></button>
      <p class="attrib">Solar 6.7 · free sources, no account, no cookies</p>`);
    p.addEventListener('click', (e) => {
      const b = e.target.closest('[data-seg] button');
      if (b) {
        const k = b.parentNode.dataset.seg, v = b.dataset.v;
        if (k === 'res') { Store.set('res', +v); disk = null; }
        if (k === 'utc') Store.set('timeUtc', v === 'utc');
        if (k === 'ng' || k === 'nr' || k === 'ns' || k === 'na') { const n = notif(); n[k.slice(1)] = +v; saveNotif(n); }
        if (k === 'qs' || k === 'qe') { const n = notif(); n[k] = +v; saveNotif(n); }
        render(); return;
      }
      if (e.target.closest('[data-pro-open]')) { Pro.paywall(); return; }
      const a = e.target.closest('[data-act]'); if (!a) return;
      const act = a.dataset.act;
      if (act === 'setback') { setTab(prevTab); return; }
      if (act === 'places') { setTab('places'); return; }
      if (act === 'notif') { toggleNotif(); return; }
      if (act === 'quiet') { const n = notif(); n.qOn = !n.qOn; saveNotif(n); render(); return; }
      if (act === 'nwatch') { const n = notif(); n.watch = !n.watch; saveNotif(n); render(); return; }
      if (act === 'ntest') { if (window.Native && Native.notifyTest) Native.notifyTest(); else toast('Notifications work in the phone app'); return; }
      if (act === 'marks') { Store.set('marks', !st.marks); if (disk) disk.setMarks(!st.marks); render(); }
      if (act === 'gps') locate();
      if (act === 'search') searchSheet();
      if (act === 'cache') { Object.keys(localStorage).filter((k) => k.startsWith('sonne:c:')).forEach((k) => localStorage.removeItem(k)); toast('Saved data cleared'); loadAll(true); }
    });
  }
  // ---- notifications (checked in the background by the Android side) ----
  const NDEF = { on: false, g: 1, r: 2, s: 1, a: 0, watch: true, qOn: false, qs: 23, qe: 7 };
  const notif = () => Object.assign({}, NDEF, Store.get('notif', {}));
  function saveNotif(n) {
    Store.set('notif', n);
    const pl = settings().place;
    if (window.Native && Native.setNotify) Native.setNotify(JSON.stringify(Object.assign({}, n, pl ? { lat: pl.lat, lon: pl.lon, place: pl.name } : {})));
  }
  window.__notifPerm = function (ok) {
    const n = notif();
    if (ok) { n.on = true; saveNotif(n); toast('Notifications on'); } else { n.on = false; saveNotif(n); toast('Notifications are blocked — allow them for Solar in phone settings'); }
    if (tab === 'settings') render();
    if (window.AuroraView && AuroraView.isOpen()) AuroraView.update();
  };
  function toggleNotif() {
    const n = notif();
    if (n.on) { n.on = false; saveNotif(n); render(); return; }
    if (window.Native && Native.notifyPermission) Native.notifyPermission(); else window.__notifPerm(true);
  }
  function notifRows() {
    const n = notif(), st = settings();
    const main = `<button class="row" data-act="notif">${ic('alert')}<span class="tx"><span class="t1">Space weather alerts</span><span class="t2">Solar checks NOAA every 30 minutes, even when closed</span></span><span class="sw${n.on ? ' on' : ''}"><i></i></span></button>`;
    if (!n.on) return main;
    const test = `<button class="row" data-act="ntest">${ic('bolt')}<span class="tx"><span class="t1">Send a test notification</span></span></button>`;
    if (!Pro.on()) return main + `<div class="row static"><span class="tx"><span class="t1">Big events only</span><span class="t2">Strong storms (G3+), X-class flares (R3+) and strong radiation storms (S3+), with NOAA's watches for them</span></span></div>
      <button class="row prorow" data-pro="alerts">${ic('alert')}<span class="tx"><span class="t1">Choose your own levels</span><span class="t2">From the first minor storm or M-flare · quiet hours at night</span></span>${Pro.pill(true)}</button>
      <button class="row prorow" data-pro="aurora">${ic('aurora')}<span class="tx"><span class="t1">Aurora alerts at your place</span><span class="t2">A nudge when it's worth heading outside</span></span>${Pro.pill(true)}</button>` + test;
    const lv = (letter, max) => [['0', 'Off']].concat([1, 2, 3, 4].slice(0, max).map((k) => [String(k), letter + k + '+']));
    const hours = (k, cur) => seg(k, String(cur), [[k === 'qs' ? '21' : '6', k === 'qs' ? '21:00' : '06:00'], [k === 'qs' ? '22' : '7', k === 'qs' ? '22:00' : '07:00'], [k === 'qs' ? '23' : '8', k === 'qs' ? '23:00' : '08:00'], [k === 'qs' ? '0' : '9', k === 'qs' ? '00:00' : '09:00']]);
    return main + `<div class="row static col"><span class="t1">Geomagnetic storms</span><span class="t2">Aurora and power-grid storms (G1 = Kp 5)</span>${seg('ng', String(n.g), lv('G', 4))}</div>
      <div class="row static col"><span class="t1">Solar flares · radio blackouts</span><span class="t2">R1 = M1 flare, R3 = X1 flare</span>${seg('nr', String(n.r), lv('R', 3))}</div>
      <div class="row static col"><span class="t1">Radiation storms</span><span class="t2">Proton events (S1+)</span>${seg('ns', String(n.s), lv('S', 3))}</div>
      <button class="row" data-act="nwatch"><span class="tx"><span class="t1">Watches & warnings</span><span class="t2">Heads-up when a storm is expected, e.g. a CME on its way</span></span><span class="sw${n.watch ? ' on' : ''}"><i></i></span></button>
      <div class="row static col"><span class="t1">Aurora at your place</span><span class="t2">${st.place ? 'When the chance at ' + esc(st.place.name) + ' reaches' : 'Set your place above first'}</span>${st.place ? seg('na', String(n.a), [['0', 'Off'], ['5', '5%'], ['10', '10%'], ['20', '20%'], ['40', '40%']]) : ''}</div>
      <button class="row" data-act="quiet">${ic('moon')}<span class="tx"><span class="t1">Quiet hours</span><span class="t2">No alerts at night, except severe (level 4–5) events. Aurora alerts still come.</span></span><span class="sw${n.qOn ? ' on' : ''}"><i></i></span></button>
      ${n.qOn ? `<div class="row static col"><span class="t1">From</span>${hours('qs', n.qs)}<span class="t1" style="margin-top:8px">Until</span>${hours('qe', n.qe)}</div>` : ''}` + test;
  }
  // Settings › Help
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-help]'); if (!b) return;
    e.stopPropagation();
    const k = b.dataset.help;
    if (k === 'tour') Onboard.tour('full', HOST); else if (k === 'new') Onboard.tour('new', HOST); else if (k === 'welcome') Onboard.welcome(HOST); else CrashLog.page(HOST);
  }, true);
  // ---------------- home-screen widgets ----------------
  const WIDGETS = [['full', 'Full page', 'Everything at a glance — the Sun, Kp chart, R/S/G, tonight', '4×5'], ['aurora', 'Aurora tonight', 'Go, maybe or stay in for your city', '3×2'],
    ['sun', 'Sun', 'The live Sun with Kp and flare level', '2×2'], ['kp', 'Kp', 'Kp now and the last 24 hours', '2×2'], ['strip', 'Space weather strip', 'Kp, flare, wind, Bz and aurora in one line', '4×1'], ['classic', 'Classic', 'The original Solar widget', '4×1']];
  // Asks the launcher to pin the widget (Android 8+); the app's native side handles solar-widget:// links.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-addw]'); if (!b) return;
    e.stopPropagation();
    if (window.Native && Native.open) { Native.open('solar-widget://pin/' + b.dataset.addw); toast('Choose where to put the widget'); }
    else toast('On your phone: touch and hold the home screen › Widgets › Solar');
  }, true);
  // ---------------- PLACES TAB ----------------
  function placesList() {
    let l = Store.get('places', null);
    if (!l) { const cur = Store.get('place', null); l = cur ? [cur] : []; Store.set('places', l); }
    return l;
  }
  const samePlace = (a, b) => !!a && !!b && ((a.gps && b.gps) || (Math.abs(a.lat - b.lat) < 0.03 && Math.abs(a.lon - b.lon) < 0.03));
  function addPlace(pl) {
    const l = placesList(), i = l.findIndex((x) => samePlace(x, pl));
    if (i >= 0) l[i] = Object.assign({}, l[i], pl); else l.push(pl);
    Store.set('places', l);
    setPlace(pl, true);
  }
  function setPlace(pl, added) {
    Store.set('place', pl); saveNotif(notif());
    toast((added ? 'Added ' : 'Now showing ') + pl.name);
    if (!S.ovation) loadOvation();
    render();
  }
  function removePlace(i) {
    const l = placesList(), gone = l.splice(i, 1)[0];
    Store.set('places', l);
    if (samePlace(gone, settings().place)) { Store.set('place', l[0] || null); saveNotif(notif()); }
    render();
    toast('Removed ' + gone.name, 'Undo', () => { const m = placesList(); m.splice(i, 0, gone); Store.set('places', m); render(); });
  }
  // times at the place itself, when its time zone is known (from the search); else the phone's clock
  function placeTime(d, pl) {
    if (!d) return '--';
    if (Fmt.utcMode() || !pl.tz) return Fmt.time(d);
    try { return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: pl.tz }).format(d); } catch (e) { return Fmt.time(d); }
  }
  function sunAt(pl) {
    const A = window.Astronomy, obs = new A.Observer(pl.lat, pl.lon, 0), now = new Date();
    const eq = A.Equator(A.Body.Sun, now, obs, true, true), h = A.Horizon(now, obs, eq.ra, eq.dec, 'normal');
    const find = (dir) => { try { const t = A.SearchRiseSet(A.Body.Sun, obs, dir, now, 1.2); return t ? t.date : null; } catch (e) { return null; } };
    return { alt: h.altitude, rise: find(+1), set: find(-1) };
  }
  function placeCard(pl, i, cur) {
    const sun = sunAt(pl), ec = Eclipse.next(pl);
    let au;
    if (!Pro.on()) au = `<div class="pstat lockd" data-pro="aurora"><b>${ic('lock')}</b><span>Aurora</span></div>`;
    else if (S.ovation) { const a = S.ovation.at(pl.lat, pl.lon), v = Math.max(a.here, a.horizon); au = `<div class="pstat"><b style="color:${v >= 10 ? '#7cf0b0' : 'var(--text)'}">${v}%</b><span>Aurora now</span></div>`; }
    else au = `<div class="pstat"><b>--</b><span>Aurora now</span></div>`;
    const up = sun.alt > -0.83;
    const nextT = up ? sun.set : sun.rise;
    const ecTxt = ec ? `${Fmt.day(ec.peak).split(' ').slice(1).join(' ')} ${ec.peak.getFullYear()} · ${ec.kind === 'partial' ? Math.round(ec.cover * 100) + '%' : ec.kind}` : '—';
    return `<div class="card placecard${cur ? ' cur' : ''}" data-pl="${i}">
      <div class="pchead"><span class="tx"><b>${pl.gps ? ic('gps') : ''}${esc(pl.name)}</b><small>${esc(pl.sub || (pl.lat.toFixed(2) + '°, ' + pl.lon.toFixed(2) + '°'))}</small></span>
        <span class="pctime">${placeTime(new Date(), pl)}${cur ? '<em>Current</em>' : ''}</span></div>
      <div class="pcstats">
        <div class="pstat"><b>${up ? Math.round(sun.alt) + '°' : 'Night'}</b><span>${up ? 'Sun height' : 'Sun down'}</span></div>
        <div class="pstat"><b>${placeTime(nextT, pl)}</b><span>${up ? 'Sunset' : 'Sunrise'}</span></div>
        ${au}
      </div>
      <button class="pcecl" data-pecl="${i}">${ic('eclipse')}<span class="pcetx">Next eclipse: <b>${esc(ecTxt)}</b></span>${ic('right')}</button>
      <button class="icon-btn pcdel" data-pdel="${i}" aria-label="Remove">${ic('trash')}</button>
    </div>`;
  }
  function renderPlaces() {
    const l = placesList(), cur = settings().place;
    const p = tabShell('places', `
      <div class="set-titlebar"><button class="icon-btn" data-gback aria-label="Back">${ic('back')}</button><div class="tab-title">Places</div></div>
      <p class="muted top">Tap a place to use it for the aurora forecast, alerts and eclipses</p>
      ${l.length ? l.map((pl, i) => placeCard(pl, i, !!cur && samePlace(pl, cur) && pl.name === cur.name)).join('') : `<div class="card eclempty">${ic('pin')}<b>No places yet</b><p class="muted">Add where you live, or anywhere you'd like to watch the aurora or an eclipse from.</p></div>`}
      <div class="pacts"><button class="btn" data-act="gps">${ic('gps')} My location</button><button class="btn ghost" data-act="search">${ic('plus')} Add a place</button></div>
      <p class="attrib">Sun times calculated on your phone · times shown at each place where its time zone is known</p>`);
    if (Pro.on() && l.length && !S.ovation && !S.err.ovation) loadOvation();
    p.addEventListener('click', (e) => {
      const del = e.target.closest('[data-pdel]'); if (del) { removePlace(+del.dataset.pdel); return; }
      const ec = e.target.closest('[data-pecl]');
      if (ec) { const pl = l[+ec.dataset.pecl]; const n = Eclipse.next(pl); if (!cur || !samePlace(pl, cur) || pl.name !== cur.name) { Store.set('place', pl); saveNotif(notif()); toast('Now showing ' + pl.name); } if (n) Eclipse.select(n.peak); setTab('eclipse'); return; }
      const a = e.target.closest('[data-act]');
      if (a && a.dataset.act === 'gps') { locate(); return; }
      if (a && a.dataset.act === 'search') { searchSheet(); return; }
      const c = e.target.closest('[data-pl]');
      if (c) { const pl = l[+c.dataset.pl]; if (!(cur && samePlace(pl, cur) && pl.name === cur.name)) setPlace(pl); }
    });
  }
  const locWait = {};
  window.__locCb = function (id, lat, lon, err) { const f = locWait[id]; if (f) { delete locWait[id]; f(lat, lon, err); } };
  function locate() {
    toast('Finding your location…');
    const done = (lat, lon, err) => {
      if (err || lat == null) { toast(err || 'Location unavailable'); return; }
      addPlace({ name: 'My location', lat, lon, gps: true });
    };
    if (window.Native && Native.location) { const id = 'l' + Date.now(); locWait[id] = done; Native.location(id); }
    else if (navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => done(p.coords.latitude, p.coords.longitude), (e) => done(null, null, e.message), { timeout: 20000 });
    else done(null, null, 'Location unavailable');
  }
  function searchSheet() {
    openSheet(`<div class="stitle">Find a place</div><div class="search">${ic('search')}<input id="q" placeholder="City or town" autocomplete="off"></div><div id="res"></div>`, (s) => {
      const q = $('#q', s), res = $('#res', s); let tm, list = [];
      setTimeout(() => q.focus(), 250);
      q.addEventListener('input', () => {
        clearTimeout(tm);
        const v = q.value.trim(); if (v.length < 2) { res.innerHTML = ''; return; }
        tm = setTimeout(async () => {
          try { list = await Data.geocode(v); res.innerHTML = list.length ? list.map((r, i) => `<button class="row" data-i="${i}"><span class="tx"><span class="t1">${esc(r.name)}</span><span class="t2">${esc(r.sub)}</span></span></button>`).join('') : '<p class="muted">No matches</p>'; }
          catch (e) { res.innerHTML = `<p class="muted">Search unavailable (${esc(e.message)})</p>`; }
        }, 350);
      });
      res.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (!b) return; const r = list[+b.dataset.i]; closeSheet(); addPlace({ name: r.name, lat: r.lat, lon: r.lon, sub: r.sub, tz: r.tz }); });
    });
  }

  // ---------------- loading ----------------
  async function run(key, fn) {
    try { S[key] = await fn(); delete S.err[key]; if (key === 'wind' || key === 'wind7') { windArchive(S[key]); refreshWindSheet(); } }
    catch (e) { S.err[key] = e.message; }
    rerender();
  }
  // In-app aurora alert: once per new level or chance, while Solar is open
  function auroraCheck() {
    if (!S.ovation || !window.AuroraView || (window.Onboard && Onboard.active())) return;
    const al = AuroraView.alertOf(AuroraView.summary(S, settings().place));
    if (!al) return;
    const k = al.key + '|' + new Date().toISOString().slice(0, 13);
    if (Store.get('auToast', '') === k || AuroraView.isOpen()) return;
    Store.set('auToast', k);
    toast(al.short, 'Watch', () => AuroraView.open(HOST, S));
  }
  function loadOvation(force) { return run('ovation', () => Data.ovation(force)); }
  function loadEvents(force) { return run('events', () => Data.events(force)); }
  function loadSlow(force) { return run('cycle', () => Data.cycle(force)); }
  async function loadAll(force) {
    if (loadingAll) return;
    loadingAll = true; lastLoad = Date.now(); updStatus();
    const jobs = [
      run('kp', () => Data.kp(force)), run('kpFc', () => Data.kpForecast(force)), run('wind', () => Data.wind(force)),
      run('xray', () => Data.xray(force)), run('flare', () => Data.latestFlare(force)), run('regions', () => Data.regions(force)),
      run('scales', () => Data.scales(force)), run('probs', () => Data.probabilities(force)), run('alerts', () => Data.alerts(force)),
    ];
    if (settings().place) jobs.push(loadOvation(force));
    if (!S.events || force) jobs.push(loadEvents(force));
    // a week of solar wind every 6 hours, so Solar's own hourly record has no gaps
    if (Date.now() - Store.get('w7at', 0) > 6 * 3600e3) { Store.set('w7at', Date.now()); jobs.push(run('wind7', () => Data.wind(force, true))); }
    if (force && wRange === 'week') jobs.push(run('wind7', () => Data.wind(true, true)));
    if (force && xRange === '3d') jobs.push(run('xray3', () => Data.xray(true, true)));
    await Promise.all(jobs);
    loadingAll = false;
    pushWidget();
    const failed = ['kp', 'wind', 'xray'].filter((k) => S.err[k] && !S[k]);
    if (failed.length === 3) toast('No connection to NOAA — showing what\'s saved');
    rerender();
  }
  function pushWidget() {
    if (!(window.Native && Native.widgetData)) return;
    const o = {};
    const kp = S.kp && S.kp.rows.length ? S.kp.rows[S.kp.rows.length - 1].kp : null;
    if (kp != null) o.kp = kp;
    if (S.xray && S.xray.now) o.xcls = Data.flareClass(S.xray.now.f);
    if (S.wind && S.wind.v) o.wind = Math.round(S.wind.v.v);
    const pl = settings().place;
    if (pl && S.ovation) { const a = S.ovation.at(pl.lat, pl.lon); o.aurora = Math.max(a.here, a.horizon); o.place = pl.name; }
    const al = (S.alerts || []).find((a) => !/cancel/i.test(a.kind || ''));
    o.alert = al ? al.title : '';
    try { Native.widgetData(JSON.stringify(o)); } catch (e) { }
  }
  let pausedAt = 0;
  window.__pause = function () { pausedAt = Date.now(); };
  window.__resume = function () {
    const was = Pro.on(); Pro.refresh();
    if (was !== Pro.on()) proChanged();
    if (pausedAt && Date.now() - pausedAt > 15 * 60000) SunHist.reset();
    if (Date.now() - lastLoad > 10 * 60000) { loadAll(); if (disk) disk.reload(); }
    if (tab === 'history') render();
  };
  window.__openTab = function (t) { closeSheet(); if (t === 'pro') { setTab('sun'); Pro.paywall('widget'); return; } setTab(t); if (t === 'events') { loadAll(true); loadEvents(true); } };
  setInterval(() => { if (!document.hidden && Date.now() - lastLoad > 15 * 60000) { loadAll(); if (disk) disk.reload(); } }, 60000);

  // Pro switched on or off: redraw everything and bring the background checker in step.
  function proChanged() {
    if (!Pro.on()) viewChan = 'HMIIF';
    if (disk) disk.setChannel(viewChan);
    saveNotif(notif());
    if (Pro.on() && settings().place && !S.ovation) loadOvation();
    pushWidget();
    render();
  }
  const HOST = { statRow, tileSheet, place: () => settings().place, tabShell, openSheet, closeSheet, toast, rerender, pushPage, scaleSheet, seg, setTab, onChange: proChanged, placesList, setPlace, locate, searchSheet, notif, saveNotif, toggleNotif, popPage, loadOvation };
  Pro.init(HOST);
  window.App = { S, render, setTab, toast };
  Gestures.init({
    root: view,
    canPull: (tv) => ['sun', 'activity', 'events', 'earth', 'aurora'].includes(tv.dataset.tab),
    onRefresh: () => { if (disk && tab === 'sun') disk.reload(); return Promise.all([loadAll(true), tab === 'events' ? loadEvents(true) : null, tab === 'activity' ? loadSlow(true) : null, tab === 'aurora' ? Promise.all([loadOvation(true), AuroraView.refreshWx()]) : null, tab === 'earth' ? Promise.all([loadOvation(true), run('protons', () => Data.protons(true)), loadEvents(true)]) : null]); },
    onSwipe: (id) => { if (evSel) render(); else hideEvent(id); }, // no swiping away while selecting
  });
  saveNotif(notif()); // keep the background checker in step with this version's settings
  // A problem last time (recorded on the Android side) goes into the crash log; offer to send it.
  afterSplash(() => setTimeout(() => { if (window.Onboard && Onboard.active()) CrashLog.check(HOST, true); else CrashLog.check(HOST); }, 900));
  setTab('sun');
  loadAll(false);
  // after the start screen: the welcome / tour (first run, major update)
  function afterSplash(fn) { if (window.Splash && Splash.active()) document.addEventListener('splashdone', fn, { once: true }); else fn(); }
  afterSplash(() => setTimeout(() => { if (window.Onboard) Onboard.maybeRun(HOST); }, 150));
})();
