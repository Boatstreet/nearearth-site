/* Solar — Solar Pro: unlock state, the Pro page (paywall) and the locked-feature cards */
(function () {
  'use strict';
  const { Store, esc } = U;

  // ---------------- state (kept by the Android side; a browser preview uses localStorage) ----------------
  let st = null;
  function read() {
    try { if (window.Native && Native.proState) return JSON.parse(Native.proState()); } catch (e) { }
    const now = Date.now(), ts = Store.get('pro:trialStart', 0), test = Store.get('pro:test', false);
    const trial = ts && now < ts + 7 * 864e5;
    return { pro: trial || test, why: trial ? 'trial' : test ? 'test' : null, trialEnds: ts ? ts + 7 * 864e5 : 0, trialUsed: !!ts,
      testMode: true, test, store: false, prices: { lifetime: '€11.99', yearly: '€4.99', estimate: true } };
  }
  function refresh() { st = read(); return st; }
  const on = () => (st || refresh()).pro;
  const state = () => st || refresh();

  function daysLeft() { const s = state(); return Math.max(0, Math.ceil((s.trialEnds - Date.now()) / 864e5)); }
  function status() {
    const s = state();
    if (s.why === 'purchase') return s.plan === 'solar_pro_yearly' ? 'Pro · yearly plan' : 'Pro · lifetime';
    if (s.why === 'trial') { const d = daysLeft(); return 'Free trial · ' + d + ' day' + (d === 1 ? '' : 's') + ' left'; }
    if (s.why === 'test') return 'Pro · test mode';
    return s.trialUsed ? 'Free version' : 'Free version · try Pro free for 7 days';
  }

  // ---------------- features ----------------
  const FEATURES = [
    ['earth', 'earth', 'The full Earth tab', 'Every hit explained, live: the solar wind, the magnetic shield, flares, radiation and storms.'],
    ['aurora', 'aurora', 'The full Aurora tab', 'Tonight\'s go / no-go for your city, both poles on spinning globes, where it\'s visible now and aurora alerts.'],
    ['eclipse', 'eclipse', 'The full Eclipse tab', 'Watch every eclipse play out from your place, with exact times, world path maps and every eclipse past and future.'],
    ['widgets', 'widget', 'Aurora tonight & Full page widgets', 'Tonight\'s verdict and everything at a glance on your home screen.'],
    ['alerts', 'alert', 'Your own alerts', 'Pick the levels for storms, flares and radiation storms, and set quiet hours for the night.'],
    ['views', 'layers', 'All 8 views of the Sun', 'Corona loops, coronal holes, flares, the magnetic field… plus the last 48 hours as a time-lapse.'],
    ['charts', 'pulse', 'Pro charts', 'X-ray flux, the 3-day Kp forecast and NOAA\'s storm and flare outlook.'],
    ['history', 'calendar', 'The full history', 'Every day since 1818 and the Sun\'s picture for every day since 1996. Free shows the last 7 days.'],
  ];

  // ---------------- the Pro page ----------------
  let host = null, plan = Store.get('pro:plan', 'lifetime');
  function paywall(focus) {
    if (!host) return;
    refresh();
    const pg = host.pushPage('Solar Pro', '', (p) => fill(p, focus));
    pg.classList.add('propage');
  }
  function fill(p, focus) {
    const s = refresh(), pr = s.prices || {};
    const feats = FEATURES.slice().sort((a, b) => (b[0] === focus) - (a[0] === focus));
    const owned = s.why === 'purchase';
    const planBtn = (id, name, price, note) => `<button class="plan${plan === id ? ' on' : ''}" data-plan="${id}"><i class="radio"></i><span class="tx"><b>${name}</b><small>${note}</small></span><em>${esc(price || '')}</em></button>`;
    p.querySelector('.pbody').innerHTML = `
      <div class="prohero"><div class="pglow"></div><div class="psun">${ic('sun')}</div>
        <h2>Solar Pro</h2><p>Everything the Sun is doing — and what it means for you tonight.</p>
        <span class="pstatus${s.pro ? ' on' : ''}">${s.pro ? ic('check') : ''}${esc(status())}</span></div>
      <div class="pfeat">${feats.map(([id, icon, t, d]) => `<div class="pf${id === focus ? ' hi' : ''}"><span class="pfi">${ic(icon)}</span><span class="tx"><b>${t}</b><small>${d}</small></span></div>`).join('')}</div>
      ${owned ? `<p class="muted center">Thank you for supporting Solar.</p>` : `
      <div class="plans">${planBtn('lifetime', 'Lifetime', pr.lifetime, 'Pay once, keep Pro for good')}${planBtn('yearly', 'Yearly', pr.yearly ? pr.yearly + ' / year' : '', 'Cancel any time in Google Play')}</div>
      ${!s.trialUsed ? `<button class="btn wide" data-pa="trial">${ic('star')} Start 7-day free trial</button>
        <button class="btn ghost wide" data-pa="buy">Buy ${plan === 'yearly' ? 'yearly' : 'lifetime'} · ${esc(plan === 'yearly' ? (pr.yearly || '') + '/yr' : pr.lifetime || '')}</button>`
        : `<button class="btn wide" data-pa="buy">${ic('star')} Get Solar Pro · ${esc(plan === 'yearly' ? (pr.yearly || '') + '/yr' : pr.lifetime || '')}</button>`}
      <p class="muted small center">${!s.trialUsed ? 'The trial needs no payment details and ends by itself after 7 days. ' : ''}${pr.estimate ? 'Prices are a guide until Solar is on Google Play.' : 'Payment through Google Play.'}</p>
      <button class="linkbtn" data-pa="restore">Restore purchase</button>`}
      ${s.testMode ? `<div class="sect">Testing</div>
      <button class="row" data-pa="test">${ic('gear')}<span class="tx"><span class="t1">Test Pro on this phone</span><span class="t2">Unlocks everything without paying. Only in your test build — removed for the Play Store.</span></span><span class="sw${s.test ? ' on' : ''}"><i></i></span></button>` : ''}
      <p class="attrib">The data stays the same free public data from NOAA and NASA — Pro pays for the app, not the data.</p>`;
    p.querySelector('.pbody').onclick = (e) => {
      const pl = e.target.closest('[data-plan]');
      if (pl) { plan = pl.dataset.plan; Store.set('pro:plan', plan); fill(p, focus); return; }
      const a = e.target.closest('[data-pa]'); if (!a) return;
      const act = a.dataset.pa;
      if (act === 'trial') {
        let ok;
        if (window.Native && Native.proStartTrial) ok = Native.proStartTrial();
        else { ok = !Store.get('pro:trialStart', 0); if (ok) Store.set('pro:trialStart', Date.now()); }
        changed(ok ? 'Solar Pro is on for 7 days — enjoy!' : 'The free trial was already used');
        fill(p, focus);
      }
      if (act === 'buy') { if (window.Native && Native.proBuy) Native.proBuy(plan); else window.__proResult(false, 'Purchases work once Solar is installed from Google Play.'); }
      if (act === 'restore') { if (window.Native && Native.proRestore) Native.proRestore(); else window.__proResult(false, 'Nothing to restore yet.'); }
      if (act === 'test') {
        const v = !state().test;
        if (window.Native && Native.proTest) Native.proTest(v); else Store.set('pro:test', v);
        changed(v ? 'Test mode: Pro unlocked' : 'Test mode off');
        fill(p, focus);
      }
    };
  }
  window.__proResult = function (ok, msg) {
    changed(msg || (ok ? 'Solar Pro unlocked — thank you!' : ''));
    const pg = document.querySelector('.page.propage'); if (pg) fill(pg);
  };
  // Something changed: refresh state, tell the app, remember why we're Pro (to spot the end of a trial).
  function changed(msg) {
    refresh();
    Store.set('pro:lastWhy', state().why);
    if (msg && host) host.toast(msg);
    if (host && host.onChange) host.onChange();
  }

  // ---------------- locked bits ----------------
  const pill = (small) => `<span class="propill${small ? ' sm' : ''}">${ic('lock')}Pro</span>`;
  // A real preview, blurred, with what Pro adds on top.
  function lockCard(preview, feature, title, sub) {
    preview = String(preview || '').replace(/<button\b/g, '<div').replace(/<\/button>/g, '</div>').replace(/\sdata-(pro|eact|act|tile|ch)="[^"]*"/g, ''); // a picture of the content, not working buttons
    return `<button class="card lockcard" data-pro="${feature}"><div class="lockprev" aria-hidden="true">${preview || '<div style="height:110px"></div>'}</div>
      <div class="lockover"><span class="propill">${ic('lock')}Solar Pro</span><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div></button>`;
  }
  // Any element with data-pro opens the Pro page on tap (before the tabs' own handlers see it).
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-pro]'); if (!t) return;
    e.stopPropagation(); e.preventDefault();
    paywall(t.dataset.pro);
  }, true);

  function init(h) {
    host = h;
    refresh();
    const last = Store.get('pro:lastWhy', null);
    if (last === 'trial' && !on()) {
      setTimeout(() => host.toast('Your Solar Pro trial has ended', 'See Pro', () => paywall()), 1200);
    }
    Store.set('pro:lastWhy', state().why);
  }

  window.Pro = { FEATURES, init, on, state, refresh, status, paywall, lockCard, pill, daysLeft };
})();
