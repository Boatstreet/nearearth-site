/* Space news from nasa.gov, same rules as the Near Sky app.
   Rules (NASA Images and Media Usage Guidelines, JPL Image Use Policy):
   - no NASA logos or insignia, no implied endorsement, NASA credited as the source, every story links to the full article on nasa.gov
   - headline, date, author and NASA's own opening paragraph only, never the whole article
   - NO IMAGES of any kind: text only (blanket ban, so no photo credit or rights question can arise)
   Feeds come through /api/news (the site's edge function), which fetches only these two nasa.gov feeds. */
(function () {
  'use strict';
  var boxes = [].slice.call(document.querySelectorAll('[data-news]'));
  if (!boxes.length || !window.DOMParser || !window.fetch) return;

  var FEEDS = [{ k: 'nasa', n: 'NASA' }, { k: 'jpl', n: 'JPL' }];

  /* ----- feed parsing (identical to Near Sky) ----- */
  var DCNS = 'http://purl.org/dc/elements/1.1/';
  function textOf(html) { var d = new DOMParser().parseFromString('<div>' + (html || '') + '</div>', 'text/html'); return (d.body.textContent || '').replace(/\s+/g, ' ').trim(); }
  function excerpt(t) {
    t = t.replace(/The post .* appeared first on NASA\.?\s*$/i, '').replace(/\s*\[(?:…|&hellip;|\.\.\.)\]\s*$/, '…').replace(/([.!?])…$/, '$1').trim();
    return t.length > 320 ? t.slice(0, 320).replace(/\s\S*$/, '') + '…' : t;
  }
  function parse(xml, feed) {
    var d = new DOMParser().parseFromString(xml, 'application/xml'), out = [], items = [].slice.call(d.getElementsByTagName('item'), 0, 12);
    items.forEach(function (it) {
      var g = function (n) { var e = it.getElementsByTagName(n)[0]; return e ? e.textContent.trim() : ''; };
      var ns = function (u, n, q) { var e = it.getElementsByTagNameNS(u, n)[0] || it.getElementsByTagName(q)[0]; return e ? e.textContent : ''; };
      var link = g('link'), host = ''; try { host = new URL(link).hostname; } catch (e) {}
      if (!/(^|\.)nasa\.gov$/.test(host) || !/^https:/.test(link)) return;
      var t = +new Date(g('pubDate')); if (!t) return;
      out.push({ t: t, title: textOf(g('title')), link: link, by: ns(DCNS, 'creator', 'dc:creator').trim(), ex: excerpt(textOf(g('description'))), src: feed.k });
    });
    return out;
  }

  /* ----- load ----- */
  var items = null, failed = false;
  function load() {
    return Promise.all(FEEDS.map(function (f) {
      return fetch('/api/news?f=' + f.k).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (x) { return parse(x, f); }).catch(function () { return null; });
    })).then(function (res) {
      var all = [].concat.apply([], res.filter(Boolean)), seen = {};
      all.sort(function (a, b) { return b.t - a.t; });
      items = all.filter(function (i) { if (seen[i.link]) return false; seen[i.link] = 1; return true; }).slice(0, 24);
      failed = !items.length;
      boxes.forEach(render);
    });
  }

  /* ----- render ----- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function when(t) {
    var h = (Date.now() - t) / 36e5;
    if (h < 1) return 'Just now'; if (h < 24) return Math.round(h) + ' h ago'; if (h < 48) return 'Yesterday';
    return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: new Date(t).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }
  function card(i, big) {
    return '<article class="nws noimg' + (big ? ' big' : '') + '">' +
      '<p class="nws-k">' + (i.src === 'jpl' ? 'JPL news' : 'NASA news') + ' · ' + esc(when(i.t)) + '</p>' +
      '<h3><a href="' + esc(i.link) + '" target="_blank" rel="noopener">' + esc(i.title) + '</a></h3>' +
      (i.by ? '<p class="nws-by">By ' + esc(i.by) + '</p>' : '') +
      (i.ex ? '<p class="nws-ex">' + esc(i.ex) + '</p>' : '') +
      '<a class="nws-go" href="' + esc(i.link) + '" target="_blank" rel="noopener">Read on nasa.gov <span aria-hidden="true">↗</span></a>' +
    '</article>';
  }
  function render(box) {
    var list = box.querySelector('.nws-list'), n = +box.dataset.news || 6, f = box.dataset.filter || 'all', em = box.querySelector('.nws-fresh');
    if (!items) { list.innerHTML = '<p class="nws-msg">' + (failed ? 'Couldn\'t reach nasa.gov just now. <a href="https://www.nasa.gov/news/" target="_blank" rel="noopener">See NASA news on nasa.gov</a>.' : 'Loading the latest news from nasa.gov…') + '</p>'; return; }
    if (failed) { list.innerHTML = '<p class="nws-msg">Couldn\'t reach nasa.gov just now. <a href="https://www.nasa.gov/news/" target="_blank" rel="noopener">See NASA news on nasa.gov</a>.</p>'; return; }
    var L = items.filter(function (i) { return f === 'all' || i.src === f; }).slice(0, n);
    var fresh = items.filter(function (i) { return Date.now() - i.t < 864e5; }).length;
    if (em) em.innerHTML = fresh ? '<i class="live-dot" aria-hidden="true"></i>' + fresh + ' new today' : '';
    list.innerHTML = L.length ? L.map(function (i, k) { return card(i, k === 0 && box.dataset.lead === '1'); }).join('') : '<p class="nws-msg">Nothing new here right now.</p>';
  }
  boxes.forEach(function (box) {
    box.querySelectorAll('[data-nf]').forEach(function (b) {
      b.addEventListener('click', function () {
        box.dataset.filter = b.dataset.nf;
        box.querySelectorAll('[data-nf]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        render(box);
      });
    });
    render(box);
  });
  load();
  window.SpaceNews = { _parse: parse };
})();
