// nearspace.app edge function.
// Static files are served straight from ./nearearth-site; this only runs for paths that are not files:
//   /api/sky        a small summary of the sky right now, for the home page bar (cached 10 minutes)
//   /api/proxy?url= read-only pass-through to the public science feeds the app demos use (cached 5 minutes)
//   /api/news?f=    nasa.gov's public RSS feeds (NASA news releases, JPL news) for Space news (cached 30 minutes)
// Everything else falls through to the static files (and the 404 page).

const UA = 'nearspace.app (hello@nearspace.app)';
const ALLOW = [
  'services.swpc.noaa.gov', 'ssd-api.jpl.nasa.gov', 'celestrak.org', 'api.open-meteo.com',
  'geocoding-api.open-meteo.com', 'ccmc.gsfc.nasa.gov', 'kauai.ccmc.gsfc.nasa.gov', 'kp.gfz.de',
  'www.sidc.be', 'www.lmsal.com', 'nominatim.openstreetmap.org', 'api.bigdatacloud.net',
  'www.wikidata.org', 'en.wikipedia.org',
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/sky') return cached(request, ctx, 600, () => sky());
    if (url.pathname === '/api/proxy') return proxy(request, ctx, url);
    if (url.pathname === '/api/news') return news(request, ctx, url);
    return env.ASSETS.fetch(request);
  },
};

function json(data, maxAge, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}`, 'access-control-allow-origin': '*' },
  });
}

async function cached(request, ctx, maxAge, make) {
  if (request.method !== 'GET') return json({ error: 'GET only' }, 0, 405);
  const cache = caches.default, key = new Request(new URL(request.url).toString(), { method: 'GET' });
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await make();
  if (res.ok) ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

async function text(u, ms = 8000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'application/json,text/plain,*/*' }, signal: ctl.signal, cf: { cacheTtl: 300 } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return (await r.text()).replace(/\u0000+/g, '').trim();
  } finally { clearTimeout(t); }
}
const get = async (u, ms) => JSON.parse(await text(u, ms));

// NOAA tables come either as [[header], [row]...] or as [{...}]
function table(j) {
  if (!Array.isArray(j) || !j.length) return [];
  if (Array.isArray(j[0])) { const h = j[0].map((x) => String(x).toLowerCase()); return j.slice(1).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]]))); }
  return j.map((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v])));
}
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const utc = (s) => { if (!s) return null; s = String(s).replace(' ', 'T'); if (!/[zZ]|[+-]\d\d:?\d\d$/.test(s)) s += 'Z'; const t = Date.parse(s); return Number.isFinite(t) ? t : null; };
const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

async function sky() {
  const [kp, flare, regions, flyby, iss] = await Promise.allSettled([
    get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json').then((j) => {
      const rows = table(j).map((o) => ({ t: utc(o.time_tag), kp: num(o.kp ?? o.kp_index ?? o.estimated_kp) })).filter((x) => x.t && x.kp != null);
      const last = rows[rows.length - 1]; return last ? { kp: last.kp, t: last.t } : null;
    }),
    get('https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json').then((j) => {
      const o = Array.isArray(j) ? j[0] : j; if (!o) return null;
      return { cls: o.max_class || o.current_class || null, t: utc(o.max_time) || utc(o.begin_time) };
    }),
    get('https://services.swpc.noaa.gov/json/solar_regions.json').then((j) => {
      const rows = table(j); let latest = ''; rows.forEach((o) => { if (o.observed_date > latest) latest = o.observed_date; });
      const today = rows.filter((o) => o.observed_date === latest);
      return { count: new Set(today.map((o) => o.region)).size, spots: today.reduce((s, o) => s + (num(o.number_spots) || 0), 0), date: latest };
    }),
    get('https://ssd-api.jpl.nasa.gov/cad.api?date-min=now&date-max=%2B30&dist-max=0.05&sort=date&fullname=true&diameter=true').then((j) => {
      if (!j || !j.fields || !j.data || !j.data.length) return null;
      const f = {}; j.fields.forEach((n, i) => { f[n] = i; });
      const r = j.data.find((row) => { const m = /^(\d+)-(\w{3})-(\d+) (\d+):(\d+)/.exec(row[f.cd]); return m && Date.UTC(+m[1], MON[m[2]], +m[3], +m[4], +m[5]) > Date.now(); });
      if (!r) return null;
      const m = /^(\d+)-(\w{3})-(\d+) (\d+):(\d+)/.exec(r[f.cd]);
      const full = String(r[f.fullname] || r[f.des]).trim().replace(/^\((.+)\)$/, '$1');
      return { name: full, t: Date.UTC(+m[1], MON[m[2]], +m[3], +m[4], +m[5]), ld: num(r[f.dist]) / 0.00256955529, v: num(r[f.v_rel]), h: num(r[f.h]), d: num(r[f.diameter]) };
    }),
    text('https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=tle').then((t) => {
      const l = t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean); const l1 = l.find((x) => x.startsWith('1 ')), l2 = l.find((x) => x.startsWith('2 '));
      return l1 && l2 ? { l1, l2 } : null;
    }),
  ]);
  const v = (p) => (p.status === 'fulfilled' ? p.value : null);
  const out = { at: Date.now(), kp: v(kp), flare: v(flare), regions: v(regions), flyby: v(flyby), iss: v(iss) };
  const anything = Object.values(out).some((x) => x && typeof x === 'object');
  return json(out, anything ? 600 : 30, anything ? 200 : 502);
}

async function proxy(request, ctx, url) {
  let target;
  try { target = new URL(url.searchParams.get('url') || ''); } catch (e) { return json({ error: 'bad url' }, 0, 400); }
  if (target.protocol !== 'https:' || !ALLOW.includes(target.hostname)) return json({ error: 'host not allowed' }, 0, 403);
  return cached(request, ctx, 300, async () => {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12000);
    try {
      const r = await fetch(target.toString(), { headers: { 'user-agent': UA }, signal: ctl.signal, cf: { cacheTtl: 300 } });
      const body = await r.arrayBuffer();
      return new Response(body, { status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'cache-control': r.ok ? 'public, max-age=300' : 'no-store', 'access-control-allow-origin': '*' } });
    } catch (e) {
      return json({ error: 'upstream unreachable' }, 0, 502);
    } finally { clearTimeout(t); }
  });
}

// Space news: only these two official feeds, fetched as-is. Parsing and the image-credit rules run in the page (assets/news.js).
const NEWS_FEEDS = { nasa: 'https://www.nasa.gov/news-release/feed/', jpl: 'https://www.nasa.gov/centers-and-facilities/jpl/feed/' };
async function news(request, ctx, url) {
  const f = url.searchParams.get('f'), target = NEWS_FEEDS[f];
  if (!target) return json({ error: 'unknown feed' }, 0, 400);
  return cached(request, ctx, 1800, async () => {
    try {
      const r = await fetch(target, { headers: { 'user-agent': UA, accept: 'application/rss+xml, application/xml, text/xml' }, cf: { cacheTtl: 1800 } });
      if (!r.ok) return json({ error: 'nasa.gov HTTP ' + r.status }, 0, 502);
      return new Response(await r.text(), { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=1800' } });
    } catch (e) { return json({ error: 'nasa.gov unreachable' }, 0, 502); }
  });
}
