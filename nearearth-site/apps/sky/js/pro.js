'use strict';
/* ---------- Sky Pro: unlock state, paywall, best nights, alerts, favourites, explorer, signal lab, share cards, widgets ---------- */
const Pro = (() => {
  // Testing build: Pro starts unlocked. Switch it off in Settings to see the free app. (Replace with Play billing before release.)
  S.pro = store.get('pro', true);
  S.prefs = Object.assign({ darkMin: 70, nConj: true, nFav: true }, S.prefs);
  const BADGE = '<span class="pro-b">PRO</span>';
  const FEATURES = [
    ['📷', 'Camera view', 'Point your phone and see stars, planets and listened-to stars labelled over the live camera.'],
    ['🌙', 'Best-night finder', 'The next two weeks ranked for stargazing, from cloud, Moon and darkness.'],
    ['🔔', 'Your own alerts', 'Pick your score, get told when planets meet and when your favourite stars ride high.'],
    ['🧩', 'Home-screen widgets', 'Tonight\'s score, the Moon and what\'s coming up, without opening the app.'],
    ['🪐', 'Jupiter\'s moons live', 'Io, Europa, Ganymede and Callisto as binoculars show them tonight.'],
    ['⏳', 'Time machine', 'Wind the sky to any date: the night of the Wow! signal, the Moon landing, your birthday.'],
    ['🔭', 'SETI explorer', 'Search all 5,541 listened-to stars, keep favourites, play Signal lab and share star cards.']];

  function paywall(focus) {
    Sheet.open(`<div class="pw"><div class="pw-hero"><canvas id="pwC"></canvas><div><div class="eyebrow cy">Sky Pro</div><h2>See more. Hear more.</h2><p>One payment, yours for good. No account, no tracking, no subscription.</p></div></div>
      ${FEATURES.map(f => `<div class="pw-f ${focus && f[1].startsWith(focus) ? 'hl' : ''}"><span>${f[0]}</span><div><b>${f[1]}</b><p>${f[2]}</p></div></div>`).join('')}
      <button class="pw-buy" id="pwBuy">${S.pro ? 'Pro is unlocked ✓' : 'Unlock Sky Pro'}</button>
      <p class="pw-note">Testing build: purchases arrive with the Google Play release. Until then the Pro switch in Settings unlocks everything.</p></div>`, el => {
      ringAnim($('#pwC', el), '#3ff0cf');
      $('#pwBuy', el).onclick = () => { if (!S.pro) setPro(true); Sheet.close(); toast('Sky Pro unlocked'); };
    });
  }
  function setPro(on) { S.pro = !!on; store.set('pro', S.pro); document.body.classList.toggle('is-pro', S.pro); App.proChanged(); }
  function gate(name, fn) { return (...a) => { if (S.pro) return fn(...a); N.haptic(12); paywall(name); }; }
  document.body.classList.toggle('is-pro', S.pro);

  /* ---------------- best nights (16-day forecast) ---------------- */
  let nights = [], selN = 0;
  function computeNights() {
    const out = [], p0 = partsIn(new Date());
    for (let k = 0; k < 15; k++) {
      const ref = new Date(+zMidnight(p0.y, p0.m, p0.d) + k * 864e5 + 14 * 36e5), n = nightOf(ref), m = moonInfo(n.mid, n);
      let cl = null; const w = S.wx;
      if (w && w.hourly && n.darkS) { let s = 0, c = 0; w.hourly.time.forEach((tt, i) => { const t = tt * 1000; if (t >= +n.darkS - 18e5 && t <= +n.darkE) { s += w.hourly.cloud_cover[i]; c++; } }); if (c) cl = s / c / 100; }
      const sc = nightScore(n, m, cl); out.push({ n, m, cl, sc, ref });
    }
    return out;
  }
  function renderBest() {
    const el = $('#bestNights'); if (!el) return;
    if (!S.pro) { el.innerHTML = lockedRow('Best-night finder', 'The next two weeks ranked for stargazing'); el.onclick = () => paywall('Best-night'); return; }
    el.onclick = null; nights = computeNights();
    const withF = nights.filter(x => x.cl != null), best = (withF.length ? withF : nights).reduce((a, b) => b.sc.score > a.sc.score ? b : a, nights[0]);
    selN = nights.indexOf(best);
    el.innerHTML = `<div class="bn-best"><span>Best ahead</span><b>${fD(best.n.start)}</b><em>${best.sc.score}</em></div><div class="bn-bars">${nights.map((x, i) => `<button class="bn ${i === selN ? 'on' : ''} ${x.cl == null ? 'nf' : ''}" data-i="${i}"><i style="height:${Math.max(6, x.sc.score)}%;background:${x.cl == null ? '#7d89a8' : scoreCol(x.sc.score)}"></i><small>${i ? dtf({ weekday: 'narrow' }).format(x.n.start) : 'T'}</small></button>`).join('')}</div><div class="bn-info" id="bnInfo"></div>${nights.some(x => x.cl == null) ? '<div class="bn-key">Grey striped bars are beyond the cloud forecast: darkness and Moon only.</div>' : ''}`;
    const info = i => { const x = nights[i]; $('#bnInfo').innerHTML = `<b>${relDay(x.n.start) === 'Today' ? 'Tonight' : fDl(x.n.start)} · ${x.sc.score}</b><span>${x.cl == null ? 'Beyond the cloud forecast · ' : ''}${esc(x.sc.why)}</span><span>Dark ${fT(x.n.darkS)}–${fT(x.n.darkE)} · ${x.m.name}, ${Math.round(x.m.frac * 100)}% lit</span>`; };
    $$('.bn', el).forEach(b => b.onclick = e => { e.stopPropagation(); selN = +b.dataset.i; $$('.bn', el).forEach(z => z.classList.toggle('on', z === b)); info(selN); N.haptic(8); });
    info(selN);
  }
  const scoreCol = s => s >= 70 ? '#52e0a0' : s >= 45 ? '#3ff0cf' : s >= 25 ? '#ffb24d' : '#ff5d73';
  const lockedRow = (t, s) => `<div class="locked"><span class="lk">🔒</span><div><b>${t} ${BADGE}</b><small>${s}</small></div><span class="chev">›</span></div>`;

  /* ---------------- planet meetings (conjunctions) ---------------- */
  function conjunctions(days = 45) {
    const bodies = ['Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'], out = [], p0 = partsIn(new Date()), sep = (a, b) => { const d = Math.sin(a.dec * D2R) * Math.sin(b.dec * D2R) + Math.cos(a.dec * D2R) * Math.cos(b.dec * D2R) * Math.cos((a.ra - b.ra) * D2R); return Math.acos(clamp(d, -1, 1)) * R2D; };
    const obs = observer(), run = {};   // run[pair] = the event currently being tracked while the pair stays close
    for (let k = 0; k < days; k++) {
      const t = new Date(+zMidnight(p0.y, p0.m, p0.d) + k * 864e5 + 21 * 36e5), pos = {}; bodies.forEach(b => pos[b] = bodyPos(b, t, obs));
      for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j], key = a + b, s = sep(pos[a], pos[b]), lim = a === 'Moon' ? 4 : 2.5;
        const visible = (a === 'Moon' || A.Elongation(a, t).elongation > 15) && A.Elongation(b, t).elongation > 15;
        if (s < lim && visible) {
          const ev = run[key];
          if (ev && ev.last === k - 1) { ev.last = k; if (s < ev.s) { ev.s = s; ev.t = t; } }
          else { run[key] = { a, b, s, t, last: k }; out.push(run[key]); }
        }
      }
    }
    return out.sort((x, y) => x.t - y.t);
  }

  /* ---------------- favourites ---------------- */
  let favs = store.get('favs', []);
  const isFav = t => favs.includes(t.id);
  function toggleFav(t) { favs = isFav(t) ? favs.filter(x => x !== t.id) : favs.concat(t.id); store.set('favs', favs); renderFavs(); N.haptic(12); return isFav(t); }
  function renderFavs() {
    const el = $('#lsFavs'); if (!el) return;
    if (!S.pro) { el.innerHTML = lockedRow('Favourites', 'Keep your own list of listened-to stars'); el.onclick = () => paywall('SETI'); return; }
    el.onclick = null; const M = horMatrix(new Date(), place().lat, place().lon), list = favs.map(id => SETIDATA.find(t => t.id === id)).filter(Boolean);
    el.innerHTML = list.length ? list.map(t => { const h = altAz(M, t.ra, t.dec); return `<button class="tr2" data-id="${esc(t.id)}"><span class="ring" style="--sc:${spColor(t.sp)}"></span><div class="nm"><b>${esc(setiName(t))}</b><small>${t.ly ? t.ly + ' ly · ' : ''}${spWord(t.sp)}</small></div><div class="r"><b>${h.alt > 0 ? Math.round(h.alt) + '°' : 'down'}</b>${h.alt > 0 ? compassS(h.az) : ''}</div></button>`; }).join('') : '<p class="muted" style="font-size:13px;padding:4px 2px">Tap ☆ on any star to keep it here. You can get an alert when one rides high.</p>';
    $$('.tr2', el).forEach(b => b.onclick = () => Listen.target(SETIDATA.find(t => t.id === b.dataset.id)));
  }

  /* ---------------- explorer ---------------- */
  const FILTERS = [['all', 'All'], ['fav', '★ Favourites'], ['bubble', 'Inside our bubble'], ['G', 'Sun-like'], ['M', 'Red dwarfs'], ['K', 'Orange dwarfs'], ['galaxy', 'Galaxies'], ['up', 'Up now']];
  function explorer() {
    let q = '', f = 'all', sort = 'near', pg = 0; const PER = 8, BUB = new Date().getFullYear() - 1920;
    const base = SETIDATA.filter(t => t.k === 'star' || t.k === 'galaxy');
    Sheet.open(`<h2>Explore every target</h2><input class="search" id="exQ" placeholder="Search a name, HIP or GJ number" autocomplete="off">
      <div class="chips ex-ch" id="exF">${FILTERS.map(x => `<button data-f="${x[0]}" class="${x[0] === f ? 'on' : ''}">${x[1]}</button>`).join('')}</div>
      <div class="seg sm" id="exS"><button data-s="near" class="on">Nearest</button><button data-s="name">A–Z</button><button data-s="most">Most listened</button></div>
      <div id="exN" class="muted" style="font-size:12px;margin:4px 2px"></div><div id="exL" class="tlist"></div>`, el => {
      const draw = (dir) => {
        const M = horMatrix(new Date(), place().lat, place().lon), ql = q.toLowerCase().replace(/\s+/g, '');
        let l = base.filter(t => {
          if (ql && !(setiName(t) + setiCode(t) + t.id + (t.nm || '')).toLowerCase().replace(/\s+/g, '').includes(ql)) return false;
          if (f === 'fav') return isFav(t); if (f === 'bubble') return t.ly && t.ly < BUB; if (f === 'galaxy') return t.k === 'galaxy';
          if ('GMK'.includes(f) && f.length === 1) return (t.sp || '')[0] === f; if (f === 'up') return altAz(M, t.ra, t.dec).alt > 10; return true; });
        l.sort(sort === 'near' ? (a, b) => (a.ly || 1e9) - (b.ly || 1e9) : sort === 'name' ? (a, b) => setiName(a).localeCompare(setiName(b)) : (a, b) => b.n - a.n);
        const pages = Math.max(1, Math.ceil(l.length / PER)); pg = clamp(pg, 0, pages - 1);
        $('#exN', el).textContent = fmtN(l.length) + (l.length === 1 ? ' target' : ' targets');
        $('#exL', el).innerHTML = `<div class="pg-list ${dir > 0 ? 'in-r' : dir < 0 ? 'in-l' : ''}" style="min-height:${PER * 59}px">` + l.slice(pg * PER, pg * PER + PER).map(t => `<button class="tr2" data-id="${esc(t.id)}"><span class="ring" style="--sc:${t.k === 'galaxy' ? '#ffb24d' : spColor(t.sp)}"></span><div class="nm"><b>${isFav(t) ? '★ ' : ''}${esc(setiName(t))}</b><small>${t.k === 'galaxy' ? 'Galaxy' : spWord(t.sp)}${t.c ? ' · ' + CONS(t.c) : ''} · ${t.n} recordings</small></div><div class="r"><b>${t.ly ? t.ly + ' ly' : '—'}</b>${esc(setiCode(t) !== setiName(t) ? setiCode(t) : '')}</div></button>`).join('') + '</div>' +
          (pages > 1 ? `<div class="pager"><button class="pb" id="exP" ${pg ? '' : 'disabled'}><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button><span>Page <b>${pg + 1}</b> of ${fmtN(pages)}</span><button class="pb" id="exNx" ${pg < pages - 1 ? '' : 'disabled'}><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button></div>` : '');
        $$('#exL .tr2', el).forEach(b => b.onclick = () => Listen.target(SETIDATA.find(t => t.id === b.dataset.id)));
        const p = $('#exP', el), n = $('#exNx', el); if (p) p.onclick = () => { pg--; draw(-1); }; if (n) n.onclick = () => { pg++; draw(1); };
      };
      let tm; $('#exQ', el).oninput = e => { clearTimeout(tm); tm = setTimeout(() => { q = e.target.value.trim(); pg = 0; draw(0); }, 180); };
      $$('#exF button', el).forEach(b => b.onclick = () => { f = b.dataset.f; pg = 0; $$('#exF button', el).forEach(x => x.classList.toggle('on', x === b)); draw(0); N.haptic(8); });
      $$('#exS button', el).forEach(b => b.onclick = () => { sort = b.dataset.s; pg = 0; $$('#exS button', el).forEach(x => x.classList.toggle('on', x === b)); draw(0); N.haptic(8); });
      draw(0);
    });
  }

  /* ---------------- Signal lab ---------------- */
  function lab() {
    let round = 0, score = 0, streak = 0; const ROUNDS = 10, best = store.get('labBest', 0);
    const CASES = [
      { k: 'cand', on: { drift: .45 }, off: null, why: 'It drifts, as a transmitter on a spinning, orbiting planet would, and it vanished when the dish looked away. That is exactly what a real candidate looks like. Next step: look again on another night.' },
      { k: 'rfi', on: { drift: 0 }, off: { drift: 0 }, why: 'A perfectly straight line has zero drift: whatever sent it is moving with us, so it is on or near Earth. It also showed up in the OFF pointing.' },
      { k: 'rfi', on: { drift: .35 }, off: { drift: .35 }, why: 'It drifts, which looks promising, but it is still there when the dish points at empty sky. A real distant signal would disappear. This one is coming from around us.' },
      { k: 'rfi', on: { broad: 1 }, off: { broad: 1 }, why: 'A bright stripe across every frequency at once is a burst of interference, like a spark or a radar pulse. Real technosignatures are expected to be narrow.' },
      { k: 'cand', on: { drift: -.3 }, off: null, why: 'Narrow, drifting, and gone in the OFF pointing: this passes the first tests. Searchers would flag it and re-observe. Every real one so far has later turned out to be Earth\'s, but this is how a discovery would start.' },
      { k: 'rfi', on: { drift: 0, wide: 1 }, off: null, why: 'It vanished in the OFF pointing, but it does not drift at all. A source fixed on Earth or a satellite moving with us gives zero drift, so this is almost certainly ours.' }];
    const paint = (c, spec, seed) => { const { x } = hidpi(c), r = rng(seed); const im = x.createImageData(c.width, c.height), d = im.data, W = im.width, H = im.height;   // device pixels: putImageData ignores the hidpi scale
      const c0 = W * (.25 + r() * .5);
      for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) { let v = -Math.log(r() + 1e-6) * .16 + .12;
        if (spec) { if (spec.broad && Math.abs(yy - H * .45) < 6) v += .8; else if (spec.drift != null && !spec.broad) { const cx = c0 + spec.drift * (yy - H / 2) * (W / H); if (Math.abs(xx - cx) < (spec.wide ? 4 : 2.4)) v += .85; } }
        const cc = CMAP[clamp(Math.round(v * 255), 0, 255)], i = (yy * W + xx) * 4; d[i] = cc[0]; d[i + 1] = cc[1]; d[i + 2] = cc[2]; d[i + 3] = 255; }
      x.putImageData(im, 0, 0); };
    const next = (el) => {
      if (round >= ROUNDS) { const nb = Math.max(best, score); store.set('labBest', nb);
        $('#labBody', el).innerHTML = `<div class="lab-end"><div class="n">${score}/${ROUNDS}</div><p>${score >= 9 ? 'Signal hunter. Breakthrough Listen would hire you.' : score >= 7 ? 'Sharp eyes. You know Earth\'s tricks.' : score >= 5 ? 'Not bad. Interference fools professionals too.' : 'Earth\'s noise is sneaky. Try again!'}</p><small>Best: ${nb}/${ROUNDS}</small><button class="btn cy" id="labAgain">Play again</button></div>`;
        $('#labAgain', el).onclick = () => { round = 0; score = 0; streak = 0; next(el); }; return; }
      const cs = CASES[Math.floor(Math.random() * CASES.length)], seed = Math.floor(Math.random() * 1e6);
      $('#labBody', el).innerHTML = `<div class="lab-top"><span>Round ${round + 1} of ${ROUNDS}</span><span>Score ${score}${streak > 1 ? ' · 🔥' + streak : ''}</span></div>
        <div class="lab-pan"><div><small>ON · pointed at the star</small><canvas id="labOn"></canvas></div><div><small>OFF · pointed at empty sky</small><canvas id="labOff"></canvas></div></div>
        <p class="lab-q">Alien candidate, or Earth interference?</p>
        <div class="lab-btns"><button class="btn cy" data-a="cand">👽 Candidate</button><button class="btn" data-a="rfi">🌍 Interference</button></div><div id="labWhy"></div>`;
      paint($('#labOn', el), cs.on, seed); paint($('#labOff', el), cs.off, seed + 1);
      $$('.lab-btns button', el).forEach(b => b.onclick = () => {
        const ok = b.dataset.a === cs.k; if (ok) { score++; streak++; } else streak = 0; N.haptic(ok ? 15 : 40); round++;
        $$('.lab-btns button', el).forEach(z => { z.disabled = true; if (z.dataset.a === cs.k) z.classList.add('right'); else if (z === b) z.classList.add('wrong'); });
        $('#labWhy', el).innerHTML = `<div class="verdict" style="border-color:${ok ? 'var(--grn)' : 'var(--red)'}"><small style="color:${ok ? 'var(--grn)' : 'var(--red)'}">${ok ? 'Correct' : 'Not quite'}</small>${cs.why}</div><button class="btn cy" id="labNext">${round >= ROUNDS ? 'See your score' : 'Next signal'}</button>`;
        $('#labNext', el).onclick = () => next(el);
      });
    };
    Sheet.open(`<h2>Signal lab</h2><p class="muted" style="font-size:13.5px;margin-bottom:10px">Sort ten recordings the way the Breakthrough Listen pipeline does. Each pair shows the dish pointed at a star (ON) and at nearby empty sky (OFF). Time runs downwards, frequency across. Best so far: ${best}/${ROUNDS}.</p><div id="labBody"></div>`, el => next(el));
  }

  /* ---------------- share cards ---------------- */
  function shareCard(t) {
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), r = rng(t.id.length * 977), YR = new Date().getFullYear();
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#050816'); g.addColorStop(1, '#0a1630'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 700; i++) { x.globalAlpha = .2 + r() * .7; x.fillStyle = ['#fff', '#cfe0ff', '#ffe9c4'][Math.floor(r() * 3)]; const s = Math.pow(r(), 4) * 3 + .6; x.beginPath(); x.arc(r() * W, r() * H, s, 0, 7); x.fill(); }
    x.globalAlpha = 1; const cx = W / 2, cy = 520, col = spColor(t.sp);
    for (let k = 1; k <= 5; k++) { x.strokeStyle = `rgba(63,240,207,${.55 - k * .09})`; x.lineWidth = 4; x.beginPath(); x.arc(cx, cy, 60 + k * 62, 0, 7); x.stroke(); }
    const sg = x.createRadialGradient(cx, cy, 0, cx, cy, 120); sg.addColorStop(0, '#fff'); sg.addColorStop(.25, col); sg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = sg; x.beginPath(); x.arc(cx, cy, 120, 0, 7); x.fill();
    x.textAlign = 'center'; x.fillStyle = '#3ff0cf'; x.font = '600 34px Mono'; x.fillText('LISTENED TO BY BREAKTHROUGH LISTEN', cx, 150);
    x.fillStyle = '#fff'; x.font = '700 96px Sora'; x.fillText(setiName(t), cx, 940, W - 120);
    x.fillStyle = '#c9d3f0'; x.font = '400 44px Inter'; x.fillText([t.ly ? t.ly + ' light-years away' : null, t.k === 'galaxy' ? 'a nearby galaxy' : spWord(t.sp)].filter(Boolean).join(' · '), cx, 1010, W - 120);
    const line = t.ly ? (t.ly < YR - 1920 ? `It could have heard our radio since ${Math.round(1920 + t.ly)}` : `The light you see left it in ${Math.round(YR - t.ly)}`) : `${t.n} recordings at Green Bank`;
    x.fillStyle = '#ffd27a'; x.font = '600 46px Sora'; x.fillText(line, cx, 1110, W - 120);
    x.fillStyle = '#8b97b8'; x.font = '400 34px Inter'; x.fillText(`${t.n} recordings · Green Bank Telescope`, cx, 1175, W - 120);
    x.fillStyle = 'rgba(255,255,255,.7)'; x.font = '600 34px Sora'; x.fillText('Sky · nearspace.app', cx, H - 70);
    const url = c.toDataURL('image/png');
    if (N.has && window.Native.shareImage) window.Native.shareImage(url.split(',')[1], setiName(t).replace(/\W+/g, '_') + '.png', `${setiName(t)}, listened to by Breakthrough Listen`);
    else Sheet.open(`<h2>Share card</h2><img src="${url}" style="width:100%;border-radius:16px" alt="">`);
  }

  /* ---------------- widgets ---------------- */
  function pushWidgets() {
    if (!N.has || !window.Native.widgets) return;
    try {
      const n = Tonight.night, m = moonInfo(new Date(), n), ev = events().filter(e => +e.t > Date.now() && e.k !== 'moon').slice(0, 3);
      let q = null; try { q = A.SearchMoonQuarter(new Date()); } catch (e) {}
      window.Native.widgets(JSON.stringify({ pro: S.pro, place: place().name, score: n.sc.score, verdict: verdict(n.sc.score), why: n.sc.why, dark: n.darkS ? fT(n.darkS) + '–' + fT(n.darkE) : 'Twilight only',
        moonName: m.name, moonPct: Math.round(m.frac * 100), phase: A.MoonPhase(new Date()), south: place().lat < 0, nextPhase: q ? ['New Moon', 'First quarter', 'Full Moon', 'Last quarter'][q.quarter] + ' ' + fD(q.time.date) : '',
        events: ev.map(e => ({ n: e.n, d: relDay(e.t) })), updated: fT(new Date()) }));
    } catch (e) {}
  }

  return { paywall, gate, setPro, BADGE, renderBest, conjunctions, isFav, toggleFav, renderFavs, explorer: gate('SETI', explorer), lab: gate('SETI', lab), shareCard: gate('SETI', shareCard), pushWidgets, lockedRow, FEATURES };
})();
