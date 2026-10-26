'use strict';
/* ---------- Calendar ---------- */
const Cal = (() => {
  let ym = null, sel = null;
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const md = new Map(); for (const d of Object.keys(OBSDAYS)) { const k = d.slice(5); if (!md.has(k)) md.set(k, []); md.get(k).push(d); }
  const key = (y, m, d) => y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');

  function today() { const p = partsIn(new Date()); return { y: p.y, m: p.m, d: p.d }; }
  function reset() { const t = today(); ym = { y: t.y, m: t.m }; sel = t; }

  function render() {
    if (!ym) reset();
    const { y, m } = ym, first = new Date(Date.UTC(y, m - 1, 1)), dow = (first.getUTCDay() + 6) % 7, days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const prevDays = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
    const t = today(), ev = events();
    $('#calTitle').innerHTML = `${MON[m - 1]} ${y}<small>${place().name}</small>`;
    const cells = [], total = Math.ceil((dow + days) / 7) * 7;
    for (let i = 0; i < total; i++) {
      let dd = i - dow + 1, mm = m, yy = y, out = false;
      if (dd < 1) { out = true; mm = m - 1; if (mm < 1) { mm = 12; yy--; } dd = prevDays + dd; } else if (dd > days) { out = true; mm = m + 1; if (mm > 12) { mm = 1; yy++; } dd -= days; }
      cells.push({ y: yy, m: mm, d: dd, out });
    }
    $('#calGrid').innerHTML = cells.map((c, i) => {
      const s = zMidnight(c.y, c.m, c.d), e = new Date(+s + 864e5), evs = ev.filter(x => x.t >= s && x.t < e);
      const dots = [];
      if (evs.some(x => x.k === 'met')) dots.push('k-met'); if (evs.some(x => x.k === 'ecl')) dots.push('k-ecl'); if (evs.some(x => x.k === 'pl')) dots.push('k-pl');
      if (md.has(key(2000, c.m, c.d).slice(5))) dots.push('k-seti');
      const isT = c.y === t.y && c.m === t.m && c.d === t.d, isS = sel && c.y === sel.y && c.m === sel.m && c.d === sel.d;
      return `<button class="cd ${c.out ? 'out' : ''} ${isT ? 'today' : ''} ${isS ? 'sel' : ''}" data-i="${i}"><span>${c.d}</span><canvas></canvas><div class="dots">${dots.map(d => `<i class="${d}"></i>`).join('')}</div></button>`;
    }).join('');
    $$('#calGrid .cd').forEach((b, i) => {
      const c = cells[i], noon = new Date(+zMidnight(c.y, c.m, c.d) + 21 * 36e5);
      const cv = $('canvas', b), { x } = hidpi(cv, 22, 22); drawMoon(x, 11, 11, 8.5, A.MoonPhase(noon), { dark: '#141a2c' });
      b.onclick = () => { sel = { y: c.y, m: c.m, d: c.d }; N.haptic(8); if (c.out) { ym = { y: c.y, m: c.m }; render(); } else { $$('#calGrid .cd').forEach(z => z.classList.toggle('sel', z === b)); day(); } };
    });
    day();
  }

  function day() {
    if (!sel) return;
    const s = zMidnight(sel.y, sel.m, sel.d), e = new Date(+s + 864e5), noon = new Date(+s + 13 * 36e5);
    const n = nightOf(noon), mo = moonInfo(new Date(+s + 21 * 36e5), n), obs = observer();
    const mr = (() => { try { return asDate(A.SearchRiseSet('Moon', obs, +1, s, 1)); } catch (er) { return null; } })(), ms = (() => { try { return asDate(A.SearchRiseSet('Moon', obs, -1, s, 1)); } catch (er) { return null; } })();
    const ev = events().filter(x => x.t >= s && x.t < e);
    const col = { met: 'var(--gold)', ecl: 'var(--red)', pl: '#8fa6ff', moon: '#e9e4d0', season: 'var(--amb)' };
    const sh = showerActive(noon).filter(x => !ev.some(y => y.sh === x));
    const k = key(2000, sel.m, sel.d).slice(5), seti = (md.get(k) || []).sort();
    let setiH = '';
    if (seti.length) {
      setiH = `<div class="card"><div class="ch"><span class="seti">On this day at Green Bank</span><em>Breakthrough Listen</em></div>` + seti.map(d => {
        const ids = OBSDAYS[d].map(i => SETIDATA[i]).filter(t => t.k !== 'pulsar'); const top = ids.slice().sort((a, b) => (a.ly || 1e9) - (b.ly || 1e9)).slice(0, 3);
        return `<div class="ev"><i style="background:var(--cy)"></i><div><b>${d.slice(0, 4)}</b>: listened to ${ids.length} target${ids.length === 1 ? '' : 's'}${top.length ? ', including ' + top.map(t => `<a data-t="${SETIDATA.indexOf(t)}" style="color:var(--cy)">${esc(setiName(t))}</a>`).join(', ') : ''}</div></div>`;
      }).join('') + '</div>';
    }
    $('#calDay').innerHTML = `<div class="dayh">${fDl(noon)}</div>
      <div class="card"><div class="hours" style="margin:0">${[['Dark from', n.darkS], ['Dark until', n.darkE]].map(([a, b]) => `<div><small>${a}</small><b>${fT(b && b.date ? b.date : b)}</b></div>`).join('')}</div>
      <div class="ev" style="margin-top:10px"><i style="background:#e9e4d0"></i><div>${mo.name}, ${Math.round(mo.frac * 100)}% lit<small>Moonrise ${fT(mr)} · moonset ${fT(ms)}</small></div></div>
      ${ev.filter(x => x.k !== 'moon').map(x => `<div class="ev"><i style="background:${col[x.k]}"></i><div>${esc(x.n)} · ${fT(x.t)}<small>${esc(x.d)}</small></div></div>`).join('')}
      ${ev.filter(x => x.k === 'moon').map(x => `<div class="ev"><i style="background:${col.moon}"></i><div>${esc(x.n)} at ${fT(x.t)}<small>${esc(x.d)}</small></div></div>`).join('')}
      ${sh.map(x => `<div class="ev"><i style="background:var(--gold);opacity:.5"></i><div>${x.n} active<small>Peak ${x.pk[1]} ${MON[x.pk[0] - 1].slice(0, 3)} · up to ${x.z} an hour</small></div></div>`).join('')}
      </div>${setiH}`;
    $$('#calDay [data-t]').forEach(a => a.onclick = () => Listen.target(SETIDATA[+a.dataset.t]));
  }
  $('#calPrev').onclick = () => { ym.m--; if (ym.m < 1) { ym.m = 12; ym.y--; } sel = { y: ym.y, m: ym.m, d: 1 }; render(); N.haptic(8); };
  $('#calNext').onclick = () => { ym.m++; if (ym.m > 12) { ym.m = 1; ym.y++; } sel = { y: ym.y, m: ym.m, d: 1 }; render(); N.haptic(8); };
  // swipe months
  (() => { let x0 = null; const g = $('#calGrid'); g.addEventListener('touchstart', e => x0 = e.touches[0].clientX, { passive: true }); g.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 60) (dx < 0 ? $('#calNext') : $('#calPrev')).click(); x0 = null; }); })();
  return { render, reset };
})();
