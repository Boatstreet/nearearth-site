/* Solar — NOAA space weather scales, explained (R radio blackouts, S radiation storms, G geomagnetic storms) */
(function () {
  'use strict';
  const NAMES = ['', 'Minor', 'Moderate', 'Strong', 'Severe', 'Extreme'];
  const SCALES = {
    R: {
      name: 'Radio blackouts', icon: 'bolt',
      cause: 'X-rays from a solar flare reach Earth in about 8 minutes and disturb the upper atmosphere on the day side. Shortwave (HF) radio fades, and GPS can be slightly less accurate. Blackouts last from minutes to a few hours and only affect the half of Earth in daylight.',
      measure: 'GOES X-ray flare class',
      levels: [
        { m: 'M1 flare', f: 'about 2000 per cycle (≈950 days)', e: 'Weak or brief loss of shortwave radio on the sunlit side. Low-frequency navigation signals briefly degraded.' },
        { m: 'M5 flare', f: 'about 350 per cycle (≈300 days)', e: 'Shortwave radio lost for tens of minutes over part of the sunlit side. Navigation signals degraded for tens of minutes.' },
        { m: 'X1 flare', f: 'about 175 per cycle (≈140 days)', e: 'Wide-area shortwave blackout for about an hour on the sunlit side. Low-frequency navigation lost for about an hour.' },
        { m: 'X10 flare', f: 'about 8 per cycle', e: 'Shortwave blackout across most of the sunlit side for one to two hours. Navigation outages and growing GPS errors on the day side.' },
        { m: 'X20 flare', f: 'fewer than 1 per cycle', e: 'Complete shortwave blackout on the entire sunlit side for hours. Ships and aircraft lose HF contact; low-frequency navigation down; satellite navigation errors.' },
      ],
    },
    S: {
      name: 'Solar radiation storms', icon: 'sun',
      cause: 'Fast protons, accelerated by big flares and CME shock waves, arrive within tens of minutes to hours and can last days. On the ground you are safe — the atmosphere shields you — but astronauts, polar flights and satellites are exposed.',
      measure: '≥10 MeV protons (particle flux units)',
      levels: [
        { m: '10 pfu', f: 'about 50 per cycle', e: 'Minor effect on shortwave radio in the polar regions. No biological risk.' },
        { m: '100 pfu', f: 'about 25 per cycle', e: 'Small extra radiation dose for passengers and crew on high-latitude flights. Occasional glitches in satellites; polar HF radio affected.' },
        { m: '1000 pfu', f: 'about 10 per cycle', e: 'Astronauts should avoid spacewalks. Higher dose for polar flights. Satellite star-trackers and solar panels affected; polar HF radio degraded.' },
        { m: '10,000 pfu', f: 'about 3 per cycle', e: 'Significant radiation risk for astronauts outside their shielding and for polar air crews. Satellite memory errors, navigation and orientation problems; polar HF blackout.' },
        { m: '100,000 pfu', f: 'fewer than 1 per cycle', e: 'High radiation hazard for astronauts and high-flying aircraft at high latitudes. Satellites may be damaged or lost; HF radio impossible in polar regions for days.' },
      ],
    },
    G: {
      name: 'Geomagnetic storms', icon: 'magnet',
      cause: 'A CME or a fast solar-wind stream hits Earth\'s magnetic field 1–4 days after leaving the Sun. The disturbance drives the aurora, can induce currents in power lines and pipelines, and upsets satellites and GPS. The bigger the storm, the further south the aurora reaches.',
      measure: 'Kp index',
      levels: [
        { m: 'Kp 5', f: 'about 1700 per cycle (≈900 days)', e: 'Weak power-grid fluctuations, minor satellite effects. Aurora visible in Scandinavia and Scotland, sometimes low on the northern horizon in northern Germany.' },
        { m: 'Kp 6', f: 'about 600 per cycle (≈360 days)', e: 'High-latitude power systems may raise voltage alarms; satellite drag increases; HF radio fades at high latitudes. Aurora can be seen from northern Germany and the Netherlands.' },
        { m: 'Kp 7', f: 'about 200 per cycle (≈130 days)', e: 'Voltage corrections may be needed in power grids, satellite navigation and low-frequency radio problems. Aurora possible across Germany, low on the northern horizon in the south.' },
        { m: 'Kp 8 to 9-', f: 'about 100 per cycle (≈60 days)', e: 'Widespread voltage control problems, some protection systems may trip. Satellite tracking and GPS degraded for hours. Aurora visible across Central Europe, overhead in the north.' },
        { m: 'Kp 9', f: 'about 4 per cycle', e: 'Possible grid collapse or blackouts and transformer damage. Satellites hard to track, HF radio out for days, GPS degraded. Aurora may reach southern Europe — as in May 2024.' },
      ],
    },
  };
  function color(n) { return ['var(--ok)', '#e8d454', '#ffb13d', '#ff8f3d', '#ff6b4a', '#ff4d6d'][Math.max(0, Math.min(5, n))]; }

  // Bottom-of-page strip: three rows R/S/G with five steps, current level lit.
  function strip(now) {
    now = now || { r: 0, s: 0, g: 0 };
    return '<div class="scalebox">' + ['R', 'S', 'G'].map((k) => {
      const cur = now[k.toLowerCase()] || 0, sc = SCALES[k];
      return `<button class="scrow" data-scale="${k}"><span class="sclbl"><b>${k}</b>${sc.name}</span><span class="steps">${[1, 2, 3, 4, 5].map((n) =>
        `<i class="${n <= cur ? 'lit' : ''}${n === cur ? ' cur' : ''}" style="--sc:${color(n)}">${k}${n}</i>`).join('')}</span></button>`;
    }).join('') + '<p class="muted small">Now lit: current NOAA levels. Tap a row for what each level means.</p></div>';
  }

  function sheetHtml(k, cur) {
    const sc = SCALES[k];
    return `<div class="stitle">${ic(sc.icon)} ${sc.name} · ${k}1–${k}5</div>
      <p class="lead">${sc.cause}</p>
      <div class="sctabs">${Object.keys(SCALES).map((x) => `<button data-sw="${x}" class="${x === k ? 'on' : ''}">${x} · ${SCALES[x].name}</button>`).join('')}</div>
      ${sc.levels.map((l, i) => `<div class="lvl${i + 1 === cur ? ' now' : ''}" style="--sc:${color(i + 1)}">
        <div class="lvh"><b>${k}${i + 1}</b><span>${NAMES[i + 1]}</span>${i + 1 === cur ? '<em>now</em>' : ''}</div>
        <p>${l.e}</p>
        <div class="lvm"><span>${sc.measure}: <b>${l.m}</b></span><span>${l.f}</span></div></div>`).join('')}
      <p class="muted small">Based on NOAA's Space Weather Scales. "Per cycle" means per ~11-year solar cycle; days count the days with at least one event of that level.</p>`;
  }

  window.Scales = { SCALES, strip, sheetHtml, color, NAMES };
})();
