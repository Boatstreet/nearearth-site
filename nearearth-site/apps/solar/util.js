/* Solar — shared helpers: storage, networking, formatting */
(function () {
  'use strict';

  const Store = {
    get(k, d) { try { const v = localStorage.getItem('sonne:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { if (v == null) localStorage.removeItem('sonne:' + k); else localStorage.setItem('sonne:' + k, JSON.stringify(v)); } catch (e) { } },
  };

  // ---- HTTP: through the Android bridge when present, fetch() otherwise ----
  const pending = {};
  let seq = 0;
  window.__httpCb = function (id, status, body) {
    const p = pending[id]; if (!p) return; delete pending[id];
    p(status, body);
  };
  function http(url, timeout) {
    return new Promise((resolve, reject) => {
      const done = (status, body) => {
        if (status >= 200 && status < 300) resolve(body);
        else reject(new Error(status ? 'HTTP ' + status : (body || 'No connection')));
      };
      if (window.Native && Native.http) {
        const id = 'h' + (++seq);
        pending[id] = done;
        Native.http(id, url, '{}');
        setTimeout(() => { if (pending[id]) { delete pending[id]; reject(new Error('Timed out')); } }, timeout || 30000);
      } else {
        fetch(url).then((r) => r.text().then((t) => done(r.status, t))).catch((e) => done(0, e.message));
      }
    });
  }
  // NOAA sometimes pads files with NUL bytes, which JSON.parse rejects
  async function getJSON(url) { return JSON.parse(String(await http(url)).replace(/\u0000+/g, '').trim()); }

  // Cached JSON: returns fresh data if younger than maxAge (minutes), otherwise refetches,
  // falling back to the stale copy when the network fails.
  const mem = {};
  async function cached(key, url, maxAge, force) {
    const c = mem[key] || Store.get('c:' + key, null);
    if (c && !force && Date.now() - c.t < maxAge * 60000) return { data: c.d, t: c.t, stale: false };
    try {
      const d = await getJSON(url);
      const e = { t: Date.now(), d };
      mem[key] = e;
      try { Store.set('c:' + key, e); } catch (_) { }
      return { data: d, t: e.t, stale: false };
    } catch (err) {
      if (c) return { data: c.d, t: c.t, stale: true, error: err.message };
      throw err;
    }
  }

  // NOAA publishes tables either as [[header...], [row...]] or as [{...}]. Normalise both to
  // objects with lower-cased keys so field lookups don't care which shape arrives.
  function table(j) {
    if (!Array.isArray(j) || !j.length) return [];
    if (Array.isArray(j[0])) {
      const h = j[0].map((x) => String(x).toLowerCase());
      return j.slice(1).map((r) => { const o = {}; h.forEach((k, i) => { o[k] = r[i]; }); return o; });
    }
    return j.map((r) => { const o = {}; for (const k in r) o[k.toLowerCase()] = r[k]; return o; });
  }
  function pick(o, ...keys) { for (const k of keys) { const v = o[k]; if (v != null && v !== '') return v; } return null; }
  // -9999 / -99999 are NOAA's 'no data' markers
  function num(v) { if (v == null || v === '') return null; const n = +v; return isFinite(n) && n > -9999 ? n : null; }
  // NOAA times come as "2026-10-05 12:00:00.000", "2026-10-05T12:00:00Z", or "2026-10-05T12:00:00"
  function utc(s) {
    if (!s) return null;
    if (typeof s === 'number') return new Date(s);
    let t = String(s).trim().replace(' ', 'T');
    if (/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?$/.test(t)) t += 'Z';
    if (/^\d{4}-\d\d-\d\d$/.test(t)) t += 'T00:00:00Z';
    const d = new Date(t);
    return isNaN(d) ? null : d;
  }

  const pad = (n) => String(n).padStart(2, '0');
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const Fmt = {
    utcMode() { return Store.get('timeUtc', false); },
    time(d) { if (!d) return '--'; return Fmt.utcMode() ? pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ' UTC' : pad(d.getHours()) + ':' + pad(d.getMinutes()); },
    hour(d) { return Fmt.utcMode() ? pad(d.getUTCHours()) : pad(d.getHours()); },
    day(d) { if (!d) return '--'; return Fmt.utcMode() ? DAYS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] : DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; },
    dayTime(d) { return d ? Fmt.day(d) + ', ' + Fmt.time(d) : '--'; },
    ago(t) {
      const m = Math.round((Date.now() - t) / 60000);
      if (m < 1) return 'just now';
      if (m < 60) return m + ' min ago';
      const h = Math.round(m / 60);
      if (h < 48) return h + ' h ago';
      return Math.round(h / 24) + ' days ago';
    },
    MONTHS,
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  window.U = { Store, http, getJSON, cached, table, pick, num, utc, Fmt, esc, $, $$, pad };
})();
