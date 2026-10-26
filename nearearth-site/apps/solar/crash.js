/* Solar — privacy-friendly crash log.
   Problems are kept only on this phone (the last 20). Nothing is ever sent automatically:
   the user can read each report and choose to share it. Reports hold the app version, Android
   version, phone model, the tab that was open and the error — no location, place names,
   coordinates or personal data (they are scrubbed out before saving). */
(function () {
  'use strict';
  const { Store, esc } = U;
  const KEY = 'crash:log', MAX = 20;
  // Where "Send" opens an email to (leave empty to let the user pick the address).
  const SUPPORT_EMAIL = '';

  function scrub(s) {
    s = String(s == null ? '' : s);
    const pl = Store.get('place', null), list = Store.get('places', []) || [];
    for (const p of [pl].concat(list)) if (p && p.name) for (const part of String(p.name).split(',')) { const w = part.trim(); if (w.length > 2) s = s.split(w).join('[place]'); }
    s = s.replace(/(latitude|longitude|lat|lon)=[-0-9.]+/gi, '$1=[x]')
      .replace(/-?\d{1,3}\.\d{3,}/g, '[n]')                     // coordinates and other precise numbers
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
      .replace(/file:\/\/\/android_asset\/www\//g, '')
      .replace(/\?[^\s)'"]*/g, '?…');                            // drop query strings from URLs
    return s.length > 2500 ? s.slice(0, 2500) + '…' : s;
  }
  function list() { const l = Store.get(KEY, []); return Array.isArray(l) ? l : []; }
  function add(kind, msg, stack, extra) {
    try {
      const l = list(), m = scrub(msg), st = scrub(stack || '');
      const tab = (document.querySelector('.tabview') || {}).dataset ? document.querySelector('.tabview').dataset.tab : '';
      const last = l[0];
      if (last && last.m === m && Date.now() - last.t < 60000) { last.n = (last.n || 1) + 1; Store.set(KEY, l); return; } // same error repeating
      l.unshift({ t: Date.now(), k: kind, m, s: st, tab: tab || '', v: (window.Onboard && Onboard.VERSION) || '', ua: device(), x: extra || '' });
      Store.set(KEY, l.slice(0, MAX));
    } catch (e) { }
  }
  function device() { const m = navigator.userAgent.match(/Android [\d.]+(; [^;)]+)?/); return m ? m[0].replace(/; wv$/, '') : 'browser'; }
  window.addEventListener('error', (e) => { if (e && e.message) add('Script error', e.message, (e.error && e.error.stack) || (e.filename ? e.filename + ':' + e.lineno : '')); });
  window.addEventListener('unhandledrejection', (e) => { const r = e && e.reason; if (!r) return; const m = r.message || String(r); if (/network|fetch|timeout|HTTP \d|No connection|Failed to load/i.test(m)) return; add('Unhandled problem', m, r.stack || ''); });

  // A crash the Android side recorded (app closed, or a widget problem) — moved into the log.
  function takeNative() {
    let c = '';
    try { if (window.Native && Native.lastCrash) c = Native.lastCrash(); } catch (e) { }
    if (!c) return null;
    const lines = String(c).split('\n'), head = lines[0] || '';
    const fatal = c.indexOf('FATAL') >= 0;
    add(fatal ? 'App closed unexpectedly' : 'Problem caught', (lines[1] || head).slice(0, 300), lines.slice(2).join('\n'), head);
    return { fatal };
  }
  function report(r) {
    return `Solar ${r.v} · ${r.ua}\n${new Date(r.t).toISOString().slice(0, 16).replace('T', ' ')} UTC · ${r.k}${r.n > 1 ? ' ×' + r.n : ''}${r.tab ? ' · tab ' + r.tab : ''}\n${r.x ? r.x + '\n' : ''}${r.m}\n${r.s}`;
  }
  function send(text) {
    const url = 'mailto:' + SUPPORT_EMAIL + '?subject=' + encodeURIComponent('Solar problem report') + '&body=' + encodeURIComponent(text.slice(0, 6000));
    if (window.Native && Native.open) Native.open(url); else window.location.href = url;
  }
  function page(host) {
    const l = list(), on = Store.get('crash:ask', true);
    host.pushPage('Problem reports', `
      <p class="lead">When something goes wrong, Solar keeps a short report on this phone so it can be fixed. Nothing is sent unless you choose to send it.</p>
      <div class="card list">
        <button class="row" data-cr="ask"><span class="tx"><span class="t1">Ask me after a problem</span><span class="t2">Offer to send a report the next time Solar opens</span></span><span class="sw${on ? ' on' : ''}"><i></i></span></button>
      </div>
      <div class="sect-row"><div class="sect">${l.length ? l.length + ' saved report' + (l.length === 1 ? '' : 's') : 'No problems recorded'}</div>${l.length ? '<button class="btn ghost small" data-cr="clear">Delete all</button>' : ''}</div>
      ${l.map((r, i) => `<div class="card crcard"><div class="crh"><b>${esc(r.k)}${r.n > 1 ? ' ×' + r.n : ''}</b><span>${esc(new Date(r.t).toLocaleString())}</span></div>
        <pre class="msg crashlog">${esc(report(r))}</pre>
        <div class="crb"><button class="btn small" data-cr="send" data-i="${i}">${ic('link')} Send</button><button class="btn ghost small" data-cr="copy" data-i="${i}">Copy</button><button class="btn ghost small" data-cr="del" data-i="${i}">${ic('trash')} Delete</button></div></div>`).join('')}
      <p class="muted small">Reports contain the app and Android version, the phone model, which tab was open and the technical error. Your location, places and settings are removed before saving. Up to 20 are kept.</p>`, (p) => {
      p.addEventListener('click', (e) => {
        const b = e.target.closest('[data-cr]'); if (!b) return;
        const a = b.dataset.cr, r = list()[+b.dataset.i];
        if (a === 'ask') { Store.set('crash:ask', !Store.get('crash:ask', true)); b.querySelector('.sw').classList.toggle('on'); return; }
        if (a === 'clear') { Store.set(KEY, []); host.popPage(); page(host); return; }
        if (!r) return;
        if (a === 'send') send(report(r));
        else if (a === 'copy') { if (window.Native && Native.copy) Native.copy(report(r)); else if (navigator.clipboard) navigator.clipboard.writeText(report(r)); host.toast('Copied'); }
        else if (a === 'del') { const l2 = list(); l2.splice(+b.dataset.i, 1); Store.set(KEY, l2); host.popPage(); page(host); }
      });
    });
  }
  // On start: move a native crash into the log and, if allowed, offer to send it.
  function check(host, quiet) {
    const n = takeNative();
    if (!n || quiet || !Store.get('crash:ask', true)) return;
    const r = list()[0];
    host.openSheet(`<div class="stitle">${ic('alert')} ${n.fatal ? 'Solar closed unexpectedly' : 'Solar caught a problem'}</div>
      <p class="lead">${n.fatal ? 'Sorry about that. ' : 'Solar kept running, but part of it may not have worked. '}A short report was saved on this phone. Sending it helps get it fixed — it contains no location or personal data.</p>
      <pre class="msg crashlog">${esc(report(r))}</pre>
      <div class="onb-btns"><button class="btn" data-cs="send">${ic('link')} Send report</button><button class="btn ghost" data-cs="no">Not now</button></div>`, (sh) => {
      sh.addEventListener('click', (e) => { const b = e.target.closest('[data-cs]'); if (!b) return; if (b.dataset.cs === 'send') send(report(r)); host.closeSheet(); });
    });
  }
  window.CrashLog = { add, list, page, check, count: () => list().length, _scrub: scrub };
})();
