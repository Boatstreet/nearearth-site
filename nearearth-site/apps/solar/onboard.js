/* Solar — first-launch welcome (city, alerts, Pro) and the guided tour.
   The tour runs after the welcome on a new install, and again (as "What's new") when the
   major version goes up. Settings › Help can replay either. */
(function () {
  'use strict';
  const { Store, esc } = U;
  const APP_VERSION = '6.7';
  const MAJOR = parseInt(APP_VERSION, 10);
  let host = null, el = null, tourEl = null;
  // decided when the app starts, before anything is downloaded and cached
  const DONE_AT_START = !!Store.get('onb:done', false);
  const EXISTING_AT_START = !DONE_AT_START && !!(Store.get('place', null) || Store.get('notif', null) || Store.get('c:kp', null) || Store.get('pro:lastWhy', null));

  // ---------------- welcome ----------------
  function welcome(done) {
    if (el) el.remove();
    el = document.createElement('div');
    el.className = 'onb';
    document.body.appendChild(el);
    let step = 0, poll = 0;
    const finish = (then) => { clearInterval(poll); Store.set('onb:done', true); el.classList.add('out'); setTimeout(() => { if (el) el.remove(); el = null; (then || done || (() => { }))(); }, 260); };
    const dots = () => `<div class="onb-dots">${[0, 1, 2].map((i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>`;
    function draw() {
      clearInterval(poll);
      const pl = host.place();
      let body = '';
      if (step === 0) {
        body = `<div class="onb-sun"><i></i></div>
          <h1>Welcome to Solar</h1>
          <p>The Sun, space weather, the aurora and eclipses — live, in plain words.</p>
          <div class="onb-card">
            <b>Where are you?</b>
            <span>Your city is used for the aurora chance, tonight's go / no-go and eclipse times. It stays on your phone.</span>
            <div class="onb-place">${pl ? `${ic(pl.gps ? 'gps' : 'pin')} <b>${esc(pl.name)}</b>` : '<span class="muted">No city yet</span>'}</div>
            <div class="onb-btns"><button class="btn" data-o="gps">${ic('gps')} My location</button><button class="btn ghost" data-o="search">${ic('search')} Search</button></div>
          </div>`;
        poll = setInterval(() => { const p2 = host.place(); if ((p2 && p2.name) !== (pl && pl.name)) draw(); }, 600);
      } else if (step === 1) {
        const n = host.notif();
        body = `<div class="onb-ic">${ic('alert')}</div>
          <h1>Get alerts</h1>
          <p>Solar checks NOAA every 30 minutes, even when it's closed, and tells you about big storms, X-class flares and aurora.</p>
          <div class="onb-card">
            <button class="row" data-o="notif">${ic('alert')}<span class="tx"><span class="t1">Space weather alerts</span><span class="t2">Strong storms, big flares, radiation storms</span></span><span class="sw${n.on ? ' on' : ''}"><i></i></span></button>
            ${Pro.on() && pl ? `<div class="onb-sub"><b>Aurora at ${esc(pl.name.split(',')[0])}</b><span>Tell me when the chance reaches</span>${host.seg('oa', String(n.a || 0), [['0', 'Off'], ['5', '5%'], ['10', '10%'], ['20', '20%']])}</div>`
            : `<p class="muted small">Aurora alerts for your city come with Solar Pro — next screen.</p>`}
          </div>`;
      } else {
        const feats = (Pro.FEATURES || []).slice(0, 6);
        body = `<div class="onb-ic pro">${ic('star')}</div>
          <h1>Solar Pro</h1>
          <p>Everything you've seen is free. Pro adds more for enthusiasts — try it free for 7 days.</p>
          <div class="onb-card onb-feats">${feats.map(([, icn, t, d]) => `<div class="onb-feat">${ic(icn)}<span><b>${esc(t)}</b><small>${esc(d)}</small></span></div>`).join('')}</div>`;
      }
      el.innerHTML = `<div class="onb-in"><button class="onb-skip" data-o="skip">Skip</button>${body}
        <div class="onb-foot">${dots()}<button class="btn big" data-o="next">${step < 2 ? 'Next' : 'Start exploring'}</button>
        ${step === 2 ? '<button class="btn ghost" data-o="pro">See what Pro costs</button>' : ''}</div></div>`;
    }
    el.addEventListener('click', (e) => {
      const sb = e.target.closest('[data-seg=oa] button');
      if (sb) { const n = host.notif(); n.a = +sb.dataset.v; if (n.a > 0 && !n.on) { host.saveNotif(n); host.toggleNotif(); } else host.saveNotif(n); setTimeout(draw, 300); return; }
      const b = e.target.closest('[data-o]'); if (!b) return;
      const o = b.dataset.o;
      if (o === 'gps') host.locate();
      else if (o === 'search') host.searchSheet();
      else if (o === 'notif') { host.toggleNotif(); setTimeout(draw, 400); setTimeout(draw, 1500); }
      else if (o === 'next') { if (step < 2) { step++; draw(); } else finish(); }
      else if (o === 'skip') finish();
      else if (o === 'pro') finish(() => { Pro.paywall(); if (done) setTimeout(() => { }, 0); });
    });
    window.__onbRedraw = () => el && draw();
    draw();
  }

  // ---------------- guided tour ----------------
  const TOUR = [
    { tab: 'sun', sel: '#tabbar', t: 'Six tabs', d: 'Everything in Solar lives in these tabs. Here is a 1-minute tour — tap Next, or Skip any time.' },
    { tab: 'sun', sel: '.tabview .sunhero', t: 'The Sun, live', d: 'NASA\'s latest picture. Coloured rings mark sunspot groups — tap one for a close-up. The chips below switch views.' },
    { tab: 'sun', sel: '.tabview .topbtns', t: 'Top right', d: 'The time, this tab\'s history (calendar), ⓘ for what everything on the tab means, and Settings.' },
    { tab: 'sun', sel: '.tabview .statrow, .tabview .updst', t: 'Pull down to refresh', d: 'This line shows when the data was last updated. Pull the page down to fetch it fresh.' },
    { tab: 'events', sel: '.tabview .evseg', t: 'Events', d: 'Coming up: CMEs on their way to Earth and NOAA\'s 3-day forecast. Happened: NOAA alerts and the last 30 days of flares, CMEs and storms — swipe one right to remove it.' },
    { tab: 'activity', sel: '#tabbar [data-tab=activity]', t: 'Activity', d: 'The live measurements as charts: solar wind, X-rays, Kp and the solar cycle.' },
    { tab: 'earth', sel: '.tabview .earthbox', t: 'Earth', d: 'Everything hitting Earth right now, animated: the solar wind, the magnetic shield, flares and the aurora. Pro explains every hit, live.' },
    { tab: 'aurora', sel: '#autonight', t: 'Tonight (Pro)', d: 'Go, maybe or stay in for your city: the aurora chance, clouds and darkness in one answer. Tap Change to pick another city.' },
    { tab: 'aurora', sel: '.tabview .aupoles', t: 'The aurora from space', d: 'The northern lights live from above the pole. With Pro: the southern lights too, globes you can spin, and the cities that can see it.' },
    { tab: 'eclipse', sel: '#tabbar [data-tab=eclipse]', t: 'Eclipses', d: 'The next solar eclipse from your city and how much of the Sun is covered. Pro plays it out minute by minute and lists every eclipse.' },
    { tab: 'sun', sel: '.tabview [data-top=settings], .tabview .topbtns', t: 'You\'re all set', d: 'Settings has alerts, home-screen widgets and "Replay the tour" if you want to see this again.' },
  ];
  const WHATS_NEW = [
    { tab: 'events', sel: '.tabview .evseg', t: 'Incoming + Events', d: 'One tab now: Coming up for what\'s on its way, Happened for alerts and the last 30 days.' },
    { tab: 'aurora', sel: '#tabbar [data-tab=aurora]', t: 'New: the Aurora tab', d: 'Northern and southern lights on spinning globes, the live sky over a lake, and which cities can see it now.' },
    { tab: 'aurora', sel: '#autonight', t: 'New: Tonight', d: 'One answer for your city — go, maybe or stay in — from the aurora chance, clouds and darkness.' },
    { tab: 'sun', sel: '.tabview .topbtns', t: 'New: help and history per tab', d: 'ⓘ now explains the tab you are on, and the calendar shows that tab\'s own history.' },
    { tab: 'sun', sel: '.tabview [data-top=settings], .tabview .topbtns', t: 'New: home-screen widgets', d: 'Six widgets, including a full-page one. Settings › Home-screen widgets › Add.' },
  ];
  function tour(kind, done) {
    const steps = kind === 'new' ? WHATS_NEW : TOUR;
    if (tourEl) tourEl.remove();
    tourEl = document.createElement('div');
    tourEl.className = 'tour';
    tourEl.innerHTML = '<div class="tour-block"></div><div class="tour-hole"></div><div class="tour-card"></div>';
    document.body.appendChild(tourEl);
    const hole = tourEl.querySelector('.tour-hole'), card = tourEl.querySelector('.tour-card');
    let i = 0;
    const end = () => { Store.set('tour:major', MAJOR); window.removeEventListener('resize', place); if (tourEl) { tourEl.classList.add('out'); setTimeout(() => { if (tourEl) tourEl.remove(); tourEl = null; }, 220); } host.setTab('sun'); if (done) done(); };
    function target(s) {
      for (const sel of s.sel.split(',')) { const e = document.querySelector(sel.trim()); if (e && e.getBoundingClientRect().height > 0) return e; }
      return null;
    }
    function place() {
      const s = steps[i], t = target(s);
      let r = t ? t.getBoundingClientRect() : null;
      const vh = window.innerHeight, vw = window.innerWidth, pad = 6;
      if (r && r.height > vh * 0.6) r = { left: r.left, top: r.top, width: r.width, height: vh * 0.45, bottom: r.top + vh * 0.45 };
      if (r) { Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + 2 * pad + 'px', height: r.height + 2 * pad + 'px', opacity: 1 }); }
      else Object.assign(hole.style, { left: vw / 2 + 'px', top: vh / 2 + 'px', width: '0px', height: '0px', opacity: 1 });
      card.innerHTML = `<div class="tour-n">${i + 1} / ${steps.length}</div><b>${esc(s.t)}</b><p>${esc(s.d)}</p>
        <div class="tour-btns"><button class="tour-skip" data-t="skip">${i === steps.length - 1 ? '' : 'Skip tour'}</button>${i ? '<button class="btn ghost" data-t="back">Back</button>' : ''}<button class="btn" data-t="next">${i === steps.length - 1 ? 'Done' : 'Next'}</button></div>`;
      const below = !r || r.top + r.height / 2 < vh / 2;
      card.style.top = below ? Math.min(vh - 240, (r ? r.bottom : vh / 2) + 18) + 'px' : '';
      card.style.bottom = below ? '' : Math.min(vh - 120, vh - (r ? r.top : vh / 2) + 18) + 'px';
      card.classList.toggle('up', !below);
    }
    function show() {
      const s = steps[i];
      if (s.tab) host.setTab(s.tab);
      const tv = document.querySelector('.tabview'); if (tv) tv.scrollTop = 0;
      setTimeout(() => {
        const t = target(s);
        if (t && t.closest('.tabview')) { const r = t.getBoundingClientRect(); if (r.top < 60 || r.bottom > window.innerHeight - 90) t.scrollIntoView({ block: 'center' }); }
        setTimeout(place, 80);
      }, 260);
    }
    tourEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      const a = b.dataset.t;
      if (a === 'next') { if (i < steps.length - 1) { i++; show(); } else end(); }
      else if (a === 'back') { i = Math.max(0, i - 1); show(); }
      else end();
    });
    window.addEventListener('resize', place);
    show();
  }

  // ---------------- when to run ----------------
  function maybeRun(h) {
    host = h;
    const done = DONE_AT_START, existing = EXISTING_AT_START;
    if (!done && !existing) { welcome(() => tour('full')); return true; }
    if (!done) Store.set('onb:done', true);
    const seen = Store.get('tour:major', 0);
    if (seen < MAJOR) { setTimeout(() => tour(existing || seen ? 'new' : 'full'), 900); return true; }
    return false;
  }
  window.Onboard = { maybeRun, welcome: (h) => { host = h || host; welcome(() => tour('full')); }, tour: (k, h) => { host = h || host; tour(k || 'full'); }, active: () => !!(el || tourEl), VERSION: APP_VERSION };
})();
