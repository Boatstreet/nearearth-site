/* Space news from nasa.gov, same rules as the Near Sky app.
   Rules (NASA Images and Media Usage Guidelines, JPL Image Use Policy):
   - no NASA logos or insignia, no implied endorsement, NASA credited as the source, every story links to the full article on nasa.gov
   - headline, date, author and NASA's own opening paragraph only, never the whole article
   - a picture is shown ONLY when its credit is exactly NASA's own (allow-list below) and it is hosted on nasa.gov;
     anything else (partners, agencies, photographers, companies, no credit) = text only
   Feeds come through /api/news (the site's edge function), which fetches only these two nasa.gov feeds. */
(function () {
  'use strict';
  var boxes = [].slice.call(document.querySelectorAll('[data-news]'));
  if (!boxes.length || !window.DOMParser || !window.fetch) return;

  var FEEDS = [{ k: 'nasa', n: 'NASA' }, { k: 'jpl', n: 'JPL' }];

  /* ----- the image credit check (identical to Near Sky) ----- */
  var OWN = [/^NASA$/, /^NASA\/JPL-Caltech$/, /^NASA[’']s Scientific Visualization Studio$/];   // NASA/<photographer> credits are deliberately left out: text only
  var NOT = /\b(ESA|CSA|STScI|JAXA|ISRO|SpaceX|Boeing|Lockheed|Northrop|Blue Origin|Axiom|Getty|AP|Reuters|AFP|courtesy|MSSS|ASU|SwRI|APL|JHU|Caltech\/|Univ|University|Institute|Observatory|Inc|LLC|Ltd)\b|[,&+;]| and /i;
  function cleanCredit(t) { return String(t || '').replace(/\s+/g, ' ').replace(/^\s*(image|photo|video)?\s*credits?\s*:\s*/i, '').trim().replace(/\.$/, ''); }
  function creditOK(c) { return !!c && !NOT.test(c.replace(/^NASA\/JPL-Caltech$/, '')) && OWN.some(function (r) { return r.test(c); }); }
  function pickSrc(img) {
    var set = (img.getAttribute('srcset') || '').split(',').map(function (s) { return s.trim().split(/\s+/); }).filter(function (a) { return a[0]; }).map(function (a) { return { u: a[0], w: parseInt(a[1], 10) || 0 }; });
    var ok = set.filter(function (x) { return x.w >= 600; }).sort(function (a, b) { return a.w - b.w; })[0] || set.sort(function (a, b) { return b.w - a.w; })[0];
    var u = (ok && ok.u) || img.getAttribute('src') || '';
    try { var h = new URL(u); return h.protocol === 'https:' && /(^|\.)nasa\.gov$/.test(h.hostname) ? h.href : null; } catch (e) { return null; }
  }
  // first picture in the article and its credit; src is null unless the credit is on the allow-list
  function imageOf(html) {
    if (!html) return null;
    var d = new DOMParser().parseFromString(html, 'text/html'), figs = d.querySelectorAll('figure');
    for (var i = 0; i < figs.length; i++) {
      var fig = figs[i], img = fig.querySelector('img'); if (!img) continue;   // first picture only (videos are skipped)
      var cr = '', cEl = fig.querySelector('.hds-credits, [class*="credit"]');
      if (cEl) cr = cleanCredit(cEl.textContent);
      else { var cap = fig.querySelector('figcaption'), m = cap && cap.textContent.match(/(?:image|photo)?\s*credits?\s*:\s*([^\n]+)$/i); if (m) cr = cleanCredit(m[1]); }
      var src = pickSrc(img);
      return creditOK(cr) && src ? { src: src, credit: cr } : { src: null, credit: cr };
    }
    return null;
  }

  /* ----- feed parsing (identical to Near Sky) ----- */
  var CNS = 'http://purl.org/rss/1.0/modules/content/', DCNS = 'http://purl.org/dc/elements/1.1/';
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
      out.push({ t: t, title: textOf(g('title')), link: link, by: ns(DCNS, 'creator', 'dc:creator').trim(), ex: excerpt(textOf(g('description'))), img: imageOf(ns(CNS, 'encoded', 'content:encoded')), src: feed.k });
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
    var pic = i.img && i.img.src;
    return '<article class="nws' + (pic ? '' : ' noimg') + (big ? ' big' : '') + '">' +
      (pic ? '<a class="nws-im" href="' + esc(i.link) + '" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true"><img src="' + esc(i.img.src) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a><p class="nws-cr">Image: ' + esc(i.img.credit) + '</p>' : '') +
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
  window.SpaceNews = { _creditOK: creditOK, _imageOf: imageOf, _parse: parse };
})();
