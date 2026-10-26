/* Solar — per-tab history (the calendar button at the top right).
   Incoming: past CMEs · Events: flares, CMEs, storms, radiation storms · Earth: what hit Earth
   (geomagnetic storms and shock arrivals) — all NASA DONKI, month by month since 2010.
   Activity: Kp, sunspot number and F10.7 radio flux · Aurora: aurora nights — GFZ Potsdam, since 1932.
   (The Sun tab keeps its own History; Eclipse shows past eclipses.) */
(function () {
  'use strict';
  const { esc, Fmt } = U;
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const p2 = (n) => String(n).padStart(2, '0');
  const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const nowYM = () => { const d = new Date(); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }; };
  const isCur = (y, m) => { const n = nowYM(); return y === n.y && m === n.m; };
  const LV = ['#2fa36b', '#e8d454', '#ffb13d', '#ff8f3d', '#ff6b4a', '#ff4d6d'];
  const gOf = (kp) => (kp >= 5 ? Math.min(5, Math.floor(kp + 0.34) - 4) : 0);
  function fmtKp(v) { if (v == null) return '--'; const r = Math.round(v * 3) / 3, n = Math.round(r), d = r - n; return n + (d > 0.1 ? '+' : d < -0.1 ? '−' : ''); }
  function openLink(u) { if (!u) return; if (window.Native && Native.open) Native.open(u); else window.open(u, '_blank'); }

  // ---------------- fetching (kept in memory only: months of DONKI data are large) ----------------
  const mem = {};
  async function get(url, live) {
    const c = mem[url];
    if (c && (!live || Date.now() - c.t < 30 * 60e3)) return c.d;
    const d = await U.getJSON(url); mem[url] = { t: Date.now(), d }; return d;
  }
  async function donki(kind, y, m) {
    const q = `${kind}?startDate=${y}-${p2(m)}-01&endDate=${y}-${p2(m)}-${p2(dim(y, m))}`, live = isCur(y, m);
    let d;
    try { d = await get(Data.DONKI + q, live); } catch (e) { d = await get(Data.DONKI_OLD + q, live); }
    return Array.isArray(d) ? d : [];
  }
  const GFZ = 'https://kp.gfz.de/app/json/';
  async function gfz(index, y, m) {
    const end = isCur(y, m) ? new Date().toISOString().slice(0, 19) + 'Z' : `${y}-${p2(m)}-${p2(dim(y, m))}T23:59:59Z`; // the service may refuse future times
    const url = `${GFZ}?start=${y}-${p2(m)}-01T00:00:00Z&end=${end}&index=${index}`;
    const d = await get(url, isCur(y, m));
    const t = d.datetime || [], v = d[index] || [], st = d.status || [];
    return t.map((x, i) => ({ t: U.utc(x), v: v[i] == null || v[i] < 0 ? null : +v[i], pre: st[i] === 'pre' })).filter((x) => x.t && x.v != null);
  }
  // per UTC day: the 8 three-hour Kp values
  function byDay(rows, y, m) {
    const out = Array.from({ length: dim(y, m) }, () => []);
    for (const r of rows) if (r.t.getUTCFullYear() === y && r.t.getUTCMonth() + 1 === m) out[r.t.getUTCDate() - 1].push(r);
    return out;
  }

  // ---------------- aurora from Kp (no OVATION archive exists, so estimate from Kp) ----------------
  // Magnetic latitude of the aurora's equatorward edge for each Kp (the classic Kp ↔ latitude table)
  const EDGE = [66.5, 64.5, 62.4, 60.4, 58.3, 56.3, 54.2, 52.2, 50.1, 48.1];
  function edgeOf(kp) { const k = Math.max(0, Math.min(9, kp)), i = Math.floor(k), f = k - i; return i >= 9 ? EDGE[9] : EDGE[i] + (EDGE[i + 1] - EDGE[i]) * f; }
  const POLE = [80.8 * Math.PI / 180, -72.6 * Math.PI / 180]; // geomagnetic north pole (dipole, ~2025)
  function mlat(lat, lon) {
    const a = lat * Math.PI / 180, b = lon * Math.PI / 180;
    return Math.abs(Math.asin(Math.sin(a) * Math.sin(POLE[0]) + Math.cos(a) * Math.cos(POLE[0]) * Math.cos(b - POLE[1])) * 180 / Math.PI);
  }
  function seenAt(kp, ml) { if (ml == null) return null; const e = edgeOf(kp); return ml >= e + 2 ? 'overhead' : ml >= e - 2 ? 'horizon' : null; }
  const AUC = ['#16352c', '#1e6b4f', '#29a874', '#46e39b', '#b6ff8a', '#ff7ad0'];
  const auLvl = (kp) => (kp >= 8 ? 5 : kp >= 7 ? 4 : kp >= 6 ? 3 : kp >= 5 ? 2 : kp >= 4 ? 1 : 0);

  // ---------------- the subjects ----------------
  const CFG = {
    incoming: { title: 'CME history', from: [2010, 1], what: 'Every coronal mass ejection NASA catalogued that month, and whether it was heading for Earth.' },
    events: { title: 'Event history', from: [2010, 1], what: 'Flares, CMEs, geomagnetic storms and radiation storms, month by month.' },
    earth: { title: 'What hit Earth', from: [2010, 1], what: 'Geomagnetic storms and the shock waves of CMEs arriving at Earth.' },
    activity: { title: 'Activity history', from: [1932, 1], what: 'Daily highest Kp, with the sunspot number and the Sun\'s radio flux (F10.7).' },
    aurora: { title: 'Aurora history', from: [1932, 1], what: 'How strong the aurora was each day, estimated from Kp.' },
  };
  let host = null, getS = null, st = null, page = null;

  function nav() {
    const c = CFG[st.tab], n = nowYM(), ys = [];
    for (let y = n.y; y >= c.from[0]; y--) ys.push(y);
    const first = st.y === c.from[0] && st.m === c.from[1], last = st.y === n.y && st.m === n.m;
    return `<div class="thnav"><button class="icon-btn" data-thm="-1" ${first ? 'disabled' : ''} aria-label="Previous month">${ic('back')}</button>
      <select id="thmo" aria-label="Month">${MON.map((x, i) => `<option value="${i + 1}" ${i + 1 === st.m ? 'selected' : ''}>${x}</option>`).join('')}</select>
      <select id="thy" aria-label="Year">${ys.map((y) => `<option ${y === st.y ? 'selected' : ''}>${y}</option>`).join('')}</select>
      <button class="icon-btn fwd" data-thm="1" ${last ? 'disabled' : ''} aria-label="Next month">${ic('back')}</button></div>`;
  }
  function open(tab, h, S) {
    if (!CFG[tab]) return;
    host = h; getS = () => S;
    const n = nowYM();
    st = { tab, y: n.y, m: n.m, filter: 'all' };
    page = host.pushPage(CFG[tab].title, `<p class="muted top">${CFG[tab].what}</p><div id="thnav">${nav()}</div><div id="thbody"></div>`, (p) => {
      p.classList.add('thpage');
      p.addEventListener('click', (e) => {
        const mv = e.target.closest('[data-thm]');
        if (mv) { let m = st.m + +mv.dataset.thm, y = st.y; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } go(y, m); return; }
        const f = e.target.closest('[data-thf] button');
        if (f) { st.filter = f.dataset.v; draw(); return; }
        const d = e.target.closest('[data-thd]');
        if (d) { daySheet(+d.dataset.thd); return; }
        const l = e.target.closest('[data-link]');
        if (l) openLink(l.dataset.link);
      });
      p.addEventListener('change', (e) => {
        if (e.target.id === 'thmo' || e.target.id === 'thy') go(+p.querySelector('#thy').value, +p.querySelector('#thmo').value);
      });
    });
    load();
  }
  function go(y, m) {
    const c = CFG[st.tab], n = nowYM();
    if (y * 12 + m > n.y * 12 + n.m) { y = n.y; m = n.m; }
    if (y * 12 + m < c.from[0] * 12 + c.from[1]) { y = c.from[0]; m = c.from[1]; }
    st.y = y; st.m = m; st.data = null;
    page.querySelector('#thnav').innerHTML = nav();
    load();
  }
  async function load() {
    const key = st.tab + st.y + '-' + st.m, body = page.querySelector('#thbody');
    st.key = key; st.data = null; st.err = null;
    body.innerHTML = '<div class="card skel" style="height:220px"></div>';
    try {
      let data;
      const { y, m } = st;
      if (st.tab === 'incoming') data = Data.parseEvents([], await donki('CME', y, m), []);
      else if (st.tab === 'events') {
        const [f, c, g, s] = await Promise.all(['FLR', 'CME', 'GST', 'SEP'].map((k) => donki(k, y, m).catch(() => null)));
        if (!f && !c && !g && !s) throw new Error('NASA DONKI did not answer');
        data = Data.parseEvents(f, c, g, s);
      } else if (st.tab === 'earth') {
        const [g, i] = await Promise.all([donki('GST', y, m), donki('IPS', y, m).catch(() => [])]);
        data = Data.parseEvents([], [], g, [], i.filter((x) => /earth/i.test(x.location || '')));
      } else if (st.tab === 'activity') {
        const [kp, sn, f] = await Promise.all([gfz('Kp', y, m), gfz('SN', y, m).catch(() => []), gfz('Fobs', y, m).catch(() => [])]);
        data = { kp: byDay(kp, y, m), sn: byDay(sn, y, m), f: byDay(f, y, m) };
      } else data = { kp: byDay(await gfz('Kp', y, m), y, m) };
      if (st.key !== key) return;
      st.data = Array.isArray(data) ? data.filter((e) => e.t && e.t.getUTCFullYear() === y && e.t.getUTCMonth() + 1 === m) : data;
    } catch (e) {
      if (st.key !== key) return;
      st.err = e.message || 'No connection';
    }
    draw();
  }

  // ---------------- drawing ----------------
  function summary(lines) { return `<div class="card msum">${lines.filter(Boolean).map((l) => `<p>${l}</p>`).join('')}</div>`; }
  function erow(e) {
    const day = Fmt.day(e.t) + ', ' + Fmt.time(e.t);
    let icon, col, t1, t2;
    if (e.kind === 'flare') { const c = (e.cls || '')[0]; icon = 'bolt'; col = c === 'X' ? LV[5] : c === 'M' ? LV[3] : LV[1]; t1 = `${esc(e.cls || '?')} flare`; t2 = day + (e.ar ? ' · region ' + esc(e.ar) : '') + (e.loc ? ' · ' + esc(e.loc) : ''); }
    else if (e.kind === 'cme') { icon = 'cme'; col = e.earth ? LV[e.kpMax >= 7 ? 5 : e.kpMax >= 5 ? 3 : 2] : '#7a8aa6'; t1 = `CME${e.speed ? ' · ' + Math.round(e.speed) + ' km/s' : ''}${e.type ? ' · type ' + esc(e.type) : ''}`; t2 = day + (e.earth ? ` · ${e.glancing && !e.arrival ? 'glancing blow' : 'Earth-directed'}${e.arrival ? ', arrival ' + Fmt.day(e.arrival) : ''}${e.kpMax ? ', Kp up to ' + fmtKp(e.kpMax) : ''}` : ' · not heading for Earth'); }
    else if (e.kind === 'storm') { const g = gOf(e.kp || 0); icon = 'magnet'; col = LV[g]; t1 = `Geomagnetic storm${g ? ' · G' + g : ''}`; t2 = day + (e.kp != null ? ' · Kp up to ' + fmtKp(e.kp) : ''); }
    else if (e.kind === 'sep') { icon = 'alert'; col = LV[3]; t1 = 'Radiation storm (solar protons)'; t2 = day + (e.inst ? ' · ' + esc(e.inst) : ''); }
    else { icon = 'wind'; col = LV[2]; t1 = 'CME shock reached Earth'; t2 = day + (e.inst ? ' · seen by ' + esc(e.inst) : ''); }
    return `<button class="row ev" ${e.link ? `data-link="${esc(e.link)}"` : ''} style="--ec:${col}"><span class="evic">${ic(icon)}</span><span class="tx"><span class="t1">${t1}</span><span class="t2">${t2}</span></span></button>`;
  }
  function list(ev, empty) { return ev.length ? `<div class="thlist">${ev.map(erow).join('')}</div>` : `<p class="muted">${empty}</p>`; }
  function cal(cells) {
    const lead = (new Date(Date.UTC(st.y, st.m - 1, 1)).getUTCDay() + 6) % 7;
    return `<div class="cal"><div class="dow">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<i>${d}</i>`).join('')}</div><div class="cgrid">${'<i></i>'.repeat(lead)}${cells.join('')}</div></div>`;
  }
  const dmax = (a) => (a.length ? Math.max(...a.map((r) => r.v)) : null);
  const dmean = (a) => (a.length ? a.reduce((s, r) => s + r.v, 0) / a.length : null);
  function today() { const n = new Date(); return isCur(st.y, st.m) ? n.getUTCDate() : 99; }
  function spark(vals, col) {
    const v = vals.map((x) => (x == null ? null : x)), ok = v.filter((x) => x != null);
    if (ok.length < 2) return '';
    const mx = Math.max(...ok), mn = Math.min(...ok), W = 300, H = 46, n = v.length;
    let d = ''; v.forEach((x, i) => { if (x == null) return; const X = (i / (n - 1)) * W, Y = H - 4 - ((x - mn) / ((mx - mn) || 1)) * (H - 8); d += (d ? 'L' : 'M') + X.toFixed(1) + ' ' + Y.toFixed(1); });
    return `<svg class="thspark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="${col}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
  }

  function draw() {
    const body = page && page.querySelector('#thbody'); if (!body) return;
    const mname = MON[st.m - 1] + ' ' + st.y;
    if (st.err) { body.innerHTML = `<p class="muted">Couldn't load ${mname} (${esc(st.err)}). Pull back and try again when you're online.</p>`; return; }
    if (!st.data) return;
    const d = st.data;
    let h = '';
    if (st.tab === 'incoming') {
      const earth = d.filter((e) => e.earth), fast = d.reduce((a, e) => Math.max(a, e.speed || 0), 0);
      h = summary([`<b>${d.length} CME${d.length === 1 ? '' : 's'}</b> in ${mname}${d.length ? `, ${earth.length} heading for Earth` : ''}.`, fast ? `Fastest: ${Math.round(fast)} km/s.` : '']) + list(d, 'No CMEs catalogued this month.');
    } else if (st.tab === 'events') {
      const n = (k) => d.filter((e) => e.kind === k).length, x = d.filter((e) => e.kind === 'flare' && /^X/.test(e.cls || '')).length, m = d.filter((e) => e.kind === 'flare' && /^M/.test(e.cls || '')).length;
      const strong = d.filter((e) => e.kind === 'storm').reduce((a, e) => Math.max(a, e.kp || 0), 0);
      const sel = st.filter === 'all' ? d : d.filter((e) => e.kind === st.filter);
      h = summary([`<b>${mname}:</b> ${n('flare')} flare${n('flare') === 1 ? '' : 's'} (${x} X, ${m} M), ${n('cme')} CME${n('cme') === 1 ? '' : 's'}, ${n('storm')} geomagnetic storm${n('storm') === 1 ? '' : 's'}${strong ? ' (strongest Kp ' + fmtKp(strong) + ')' : ''}, ${n('sep')} radiation storm${n('sep') === 1 ? '' : 's'}.`])
        + `<div class="seg mini thfilter" data-thf>${[['all', 'All'], ['flare', 'Flares'], ['cme', 'CMEs'], ['storm', 'Storms'], ['sep', 'Radiation']].map(([v, l]) => `<button data-v="${v}" class="${v === st.filter ? 'on' : ''}">${l}</button>`).join('')}</div>`
        + list(sel, 'Nothing of this kind this month.');
    } else if (st.tab === 'earth') {
      const storms = d.filter((e) => e.kind === 'storm'), shocks = d.filter((e) => e.kind === 'shock');
      const top = storms.reduce((a, e) => (!a || (e.kp || 0) > (a.kp || 0) ? e : a), null);
      h = summary([`<b>${storms.length} geomagnetic storm${storms.length === 1 ? '' : 's'}</b> and ${shocks.length} CME shock${shocks.length === 1 ? '' : 's'} reached Earth in ${mname}.`, top && top.kp ? `Strongest: Kp ${fmtKp(top.kp)}${gOf(top.kp) ? ' (G' + gOf(top.kp) + ')' : ''} on ${Fmt.day(top.t)}.` : storms.length ? '' : 'A quiet month for Earth\'s magnetic field.'])
        + list(d, 'Nothing hit Earth hard enough to count as a storm this month.');
    } else if (st.tab === 'activity') {
      const td = today(), cells = d.kp.map((a, i) => {
        const mx = dmax(a), fut = i + 1 > td;
        return `<button class="cday${fut ? ' fut' : ''}${i + 1 === td ? ' today' : ''}" ${fut || mx == null ? 'disabled' : `data-thd="${i + 1}"`} style="--dc:${mx == null ? 'rgba(255,255,255,.04)' : gOf(mx) ? LV[gOf(mx)] : mx >= 4 ? '#7d8a3a' : '#28524a'}"><b>${i + 1}</b><span>${mx == null ? '' : fmtKp(mx)}</span></button>`;
      });
      const all = d.kp.flat(), storms = d.kp.filter((a) => dmax(a) >= 5).length, top = all.reduce((a, r) => (!a || r.v > a.v ? r : a), null);
      const sn = d.sn.map(dmean), f = d.f.map(dmean), snM = sn.filter((x) => x != null), fM = f.filter((x) => x != null);
      h = cal(cells) + `<div class="legendbar"><span>Kp 0</span><i style="background:linear-gradient(90deg,#28524a,#7d8a3a,${LV.slice(1).join(',')})"></i><span>9</span></div>`
        + summary([all.length ? `<b>${storms} storm day${storms === 1 ? '' : 's'}</b> (Kp 5 or more) in ${mname}.` : 'No Kp values yet.', top ? `Highest: Kp ${fmtKp(top.v)} on ${top.t.getUTCDate()} ${MON[st.m - 1]}.` : '',
          snM.length ? `Sunspot number: average <b>${Math.round(snM.reduce((a, b) => a + b, 0) / snM.length)}</b>.` : '', fM.length ? `F10.7 radio flux: average <b>${Math.round(fM.reduce((a, b) => a + b, 0) / fM.length)}</b> sfu.` : ''])
        + (snM.length > 1 ? `<div class="card thchart"><div class="thlbl">Sunspot number, day by day</div>${spark(sn, '#ffb13d')}</div>` : '')
        + (fM.length > 1 ? `<div class="card thchart"><div class="thlbl">F10.7 radio flux (sfu)</div>${spark(f, '#7cc0ff')}</div>` : '')
        + '<p class="muted small">Tap a day for its eight 3-hour Kp values.</p>';
    } else {
      const pl = host.place(), ml = pl ? mlat(pl.lat, pl.lon) : null, td = today();
      let nights = 0;
      const cells = d.kp.map((a, i) => {
        const mx = dmax(a), fut = i + 1 > td, see = mx == null ? null : seenAt(mx, ml);
        if (see) nights++;
        return `<button class="cday au${fut ? ' fut' : ''}${i + 1 === td ? ' today' : ''}${see ? ' seen ' + see : ''}${mx != null && auLvl(mx) >= 4 ? ' lt' : ''}" ${fut || mx == null ? 'disabled' : `data-thd="${i + 1}"`} style="--dc:${mx == null ? 'rgba(255,255,255,.04)' : AUC[auLvl(mx)]}"><b>${i + 1}</b><span>${mx == null ? '' : fmtKp(mx)}</span></button>`;
      });
      const all = d.kp.map(dmax), best = all.reduce((a, v, i) => (v != null && (a == null || v > all[a]) ? i : a), null);
      h = cal(cells) + `<div class="legendbar"><span>Faint</span><i style="background:linear-gradient(90deg,${AUC.join(',')})"></i><span>Extreme</span>${pl ? '<em><b class="thdot"></b>seen at ' + esc(pl.name.split(',')[0]) + '</em>' : ''}</div>`
        + summary([pl ? `<b>${nights} day${nights === 1 ? '' : 's'}</b> in ${mname} when the aurora could have been seen from ${esc(pl.name)} (if it was dark and clear).` : 'Pick a city on the Aurora tab to see which days it could be seen there.',
          best != null ? `Strongest: ${best + 1} ${MON[st.m - 1]}, Kp ${fmtKp(all[best])} — ${['faint, far north only', 'active', 'a minor storm', 'a strong storm', 'a severe storm', 'an extreme storm'][auLvl(all[best])]}.` : ''])
        + '<p class="muted small">Estimated from the daily highest Kp (GFZ Potsdam), so treat it as a guide. Tap a day for the details.</p>';
    }
    h += `<p class="attrib">${st.tab === 'activity' || st.tab === 'aurora' ? 'Data: GFZ Potsdam — Kp, sunspot number and F10.7 (CC BY 4.0)' : 'Data: NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information)'}</p>`;
    body.innerHTML = h;
  }

  function daySheet(day) {
    const a = st.data.kp[day - 1] || [], date = `${day} ${MON[st.m - 1]} ${st.y}`;
    const bars = Array.from({ length: 8 }, (_, i) => a.find((r) => r.t.getUTCHours() === i * 3));
    const chart = `<div class="thbars">${bars.map((r, i) => `<div><i style="height:${r ? Math.max(4, r.v / 9 * 100) : 0}%;background:${r ? (gOf(r.v) ? LV[gOf(r.v)] : r.v >= 4 ? '#c9c64a' : '#3fbf8a') : 'transparent'}"></i><b>${r ? fmtKp(r.v) : ''}</b><span>${p2(i * 3)}</span></div>`).join('')}</div><p class="muted small">Kp every 3 hours, UTC${a.some((r) => r.pre) ? ' · preliminary' : ''}</p>`;
    const mx = dmax(a);
    let extra = '';
    if (st.tab === 'aurora') {
      const pl = host.place(), ml = pl ? mlat(pl.lat, pl.lon) : null, see = seenAt(mx, ml);
      extra = `<div class="kv"><div><span>Aurora strength</span><b>${['Faint', 'Active', 'Minor storm', 'Strong storm', 'Severe storm', 'Extreme storm'][auLvl(mx)]}</b></div>
        <div><span>Reached about</span><b>${Math.round(edgeOf(mx))}° magnetic latitude</b></div>
        ${pl ? `<div><span>${esc(pl.name.split(',')[0])} (${Math.round(ml)}° magnetic)</span><b>${see === 'overhead' ? 'Likely overhead' : see === 'horizon' ? 'Low on the horizon' : 'Too far from the aurora'}</b></div>` : ''}</div>`;
    } else {
      const sn = dmean(st.data.sn[day - 1] || []), f = dmean(st.data.f[day - 1] || []);
      extra = `<div class="kv"><div><span>Highest Kp</span><b>${fmtKp(mx)}${gOf(mx) ? ' · G' + gOf(mx) + ' storm' : ''}</b></div>${sn != null ? `<div><span>Sunspot number</span><b>${Math.round(sn)}</b></div>` : ''}${f != null ? `<div><span>F10.7 radio flux</span><b>${Math.round(f)} sfu</b></div>` : ''}</div>`;
    }
    host.openSheet(`<div class="stitle">${ic(st.tab === 'aurora' ? 'aurora' : 'magnet')} ${date}</div>${chart}${extra}`);
  }

  window.TabHist = { open, has: (t) => !!CFG[t], _mlat: mlat, _edge: edgeOf };
})();
