/* Solar — Guide tab: the space weather scales plus plain-language explanations of everything in the app */
(function () {
  'use strict';
  const { esc, $ } = U;

  // Small helpers for consistent article markup
  const P = (t) => `<p>${t}</p>`;
  const H = (t) => `<h3>${t}</h3>`;
  const KV = (rows) => `<div class="kv">${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
  const TIP = (t) => `<div class="tipbox">${ic('info')}<span>${t}</span></div>`;
  const SW = (c, l) => `<i class="swatch" style="background:${c}"></i>${l}`;

  const SECTIONS = [
    {
      id: 'now', icon: 'sun', title: 'Reading the Sun tab', sub: 'The picture, the markers, the tiles',
      html: () => P('The big picture is the real Sun, photographed by NASA\'s <b>Solar Dynamics Observatory</b> (SDO) from orbit and refreshed about every 15 minutes. North is up and east is on the left — as if you were looking at the Sun from Earth.') +
        H('The coloured rings') +
        P('Each ring marks a numbered <b>sunspot group</b> (an "active region"). The number is NOAA\'s region number — the full number has a 1 in front, so 4248 is region 14248. The rings are moved forward to the current time, because the Sun keeps turning between NOAA\'s daily report and now.') +
        KV([[SW('var(--c)', 'Yellow'), 'Magnetically simple, mostly quiet'], [SW('var(--m)', 'Orange'), 'Complex — can produce M-class flares'], [SW('var(--x)', 'Red'), 'Very complex (delta) or already flared X — watch this one']]) +
        H('The views') +
        P('The chips under the picture switch between instruments and wavelengths. Each one shows a different layer of the Sun, from its visible surface up into the million-degree corona:') +
        KV([['Sunspots', 'Visible light (HMI). The surface at about 5,500 °C; spots look dark because they are 1,500–2,000 °C cooler'], ['Magnetic', 'Magnetogram. White = magnetic field pointing towards us, black = away. Sunspot groups show as black-and-white pairs'], ['Chromosphere 304 Å', 'Helium at ~50,000 °C. Shows prominences and filaments — clouds of plasma held by magnetic fields'], ['Corona loops 171 Å', 'Iron at ~600,000 °C. Magnetic loops arching over active regions'], ['Coronal holes 193 Å', 'Corona at ~1.2 million °C. Dark patches are coronal holes, where fast solar wind escapes'], ['Flares 131 Å', 'Very hot plasma, up to 10 million °C. Flares light up brightly here'], ['Active regions 211 Å', '~2 million °C. Active regions glow, coronal holes are dark'], ['Photosphere UV 1700 Å', 'Just above the surface. Bright magnetic network around sunspots']]) +
        H('The tiles') +
        P('Tap any tile for a chart and a short explanation. The headline above them sums up the situation in a few words, and the R · S · G boxes show NOAA\'s current levels (see <b>Space weather scales</b>).') +
        TIP('Pull the page down to refresh everything. Tap a ring or a group card for a close-up of that sunspot group.'),
    },
    {
      id: 'spots', icon: 'spots', title: 'Sunspots & active regions', sub: 'What they are, how they\'re classified',
      html: () => P('Sunspots are places where bundles of the Sun\'s magnetic field burst through the surface. The strong field holds back the heat flowing up from inside, so the spot is cooler and looks dark. A big spot can be several times the size of Earth.') +
        P('Spots come in groups with two magnetic polarities, like the two ends of a bar magnet. When the field lines in a group get twisted and tangled, they can suddenly snap into a simpler shape — releasing energy as a <b>flare</b> and sometimes throwing out a <b>CME</b>.') +
        H('Area') +
        P('Measured in <b>millionths of the visible hemisphere</b> (MSH). 100 MSH is about 300 million km² — around 600 times the Earth\'s surface. A group above ~1,000 MSH can be seen without magnification through eclipse glasses.') +
        H('Magnetic class (Mount Wilson)') +
        KV([['Alpha (α)', 'A single polarity'], ['Beta (β)', 'Two polarities with a clear dividing line'], ['Gamma (γ)', 'Polarities mixed up with no clear divide'], ['Beta-gamma (βγ)', 'Complex — M-class flares possible'], ['Delta (δ)', 'Opposite polarities squeezed inside one penumbra. The most flare-productive configuration — almost all X flares come from delta groups']]) +
        H('Spot class (McIntosh)') +
        P('Three letters, e.g. <b>Fkc</b>:') +
        KV([['1st letter', 'Size and shape of the group: A, B (tiny, no penumbra) … C, D, E, F (growing, F = huge) … H (single large spot)'], ['2nd letter', 'Penumbra of the largest spot: x none, r rudimentary, s/a small, h/k large'], ['3rd letter', 'How tightly packed the spots are: x single, o open, i intermediate, c compact']]) +
        P('Big, compact groups (k and c) with delta spots are the ones forecasters watch most closely.') +
        H('Rotation') +
        P('The Sun turns once about every 27 days as seen from Earth, so a group crosses the visible disk in about two weeks. A group on the left (east) edge has just appeared; one near the right (west) edge is about to rotate away. Groups near the middle face Earth directly — eruptions from there are most likely to reach us.'),
    },
    {
      id: 'flares', icon: 'bolt', title: 'Solar flares', sub: 'A, B, C, M, X — and what they do',
      html: () => P('A flare is a sudden flash of light and X-rays from a sunspot group, lasting minutes to hours. The X-rays reach Earth in about 8 minutes — at the speed of light — so there is no warning.') +
        H('Flare classes') +
        P('Measured by the GOES satellites as X-ray power arriving at Earth. Each letter is ten times stronger than the one before; the number refines it (M5 is five times M1, X2 is twice X1).') +
        KV([['A, B', 'Background level — the quiet Sun'], ['C', 'Small, common. No effects at Earth'], ['M', 'Medium. Brief radio blackouts at the poles and on the day side (R1–R2)'], ['X', 'Major. Radio blackouts across the sunlit half of Earth (R3+); often with CMEs and radiation storms'], ['X10+', 'Extreme. The largest on record (4 Nov 2003) saturated the sensors — estimated around X28 or more']]) +
        P('The <b>X-ray flux</b> chart (Activity tab) shows the live GOES measurement. The orange line gives the flare class; each spike is a flare.') +
        TIP('A flare alone does not bring aurora — the light and X-rays only affect the upper atmosphere on the day side. Aurora needs a CME or fast solar wind to arrive 1–4 days later.'),
    },
    {
      id: 'cme', icon: 'cme', title: 'Coronal mass ejections', sub: 'Clouds of plasma heading into space',
      html: () => P('A CME is a huge cloud of magnetised plasma — billions of tonnes — blasted off the Sun, often together with a flare or when a filament erupts. Coronagraphs on the SOHO and STEREO spacecraft see them as expanding bubbles around the Sun.') +
        KV([['Speed', '300 km/s (slow) to over 3,000 km/s (extreme)'], ['Travel time to Earth', 'Usually 1–4 days; the fastest in under a day'], ['Halo CME', 'Appears as a ring all around the Sun — it is heading straight towards (or away from) us']]) +
        P('NASA models each CME\'s path. The Events tab marks those with an <b>Earth-directed component</b> and shows the modelled arrival time — accurate to roughly ±7 hours.') +
        P('When a CME arrives, the solar wind suddenly jumps in speed and density (a <b>shock</b>). Whether a storm follows depends on the magnetic field inside the cloud: if it points south (negative Bz), energy pours into Earth\'s magnetic field.'),
    },
    {
      id: 'wind', icon: 'wind', title: 'Solar wind, Bz & Bt', sub: 'The live readings from L1',
      html: () => P('The Sun constantly blows a thin stream of charged particles into space: the <b>solar wind</b>. It is measured by the DSCOVR and ACE spacecraft at the L1 point, 1.5 million km towards the Sun — so what you see in the app reaches Earth <b>about 30–60 minutes later</b>.') +
        KV([['Speed', 'Normal 300–450 km/s. 500–700 = fast stream from a coronal hole. 700+ usually means a CME'], ['Density', 'Normal 2–10 particles/cm³. A sudden jump = shock arriving'], ['Temperature', 'Normal around 50,000–200,000 K; higher in fast wind'], ['Bt', 'Total strength of the interplanetary magnetic field. Normal ~5 nT; 15–20+ nT = strong CME field'], ['Bz', 'The north–south part of that field. The key number for aurora']]) +
        H('Why Bz matters') +
        P('Earth\'s magnetic field points north. When the solar wind\'s field points <b>south</b> (Bz negative), the two connect and energy flows in — like opening a door. Bz around −10 nT or lower for an hour or more, combined with fast wind, is what produces strong storms and bright aurora. When Bz points north, the door is mostly shut, even if the wind is fast.') +
        TIP('Quick aurora check: speed above 500 km/s, Bt above 10 nT and Bz staying below −5 nT. All three together — go outside.'),
    },
    {
      id: 'kp', icon: 'magnet', title: 'Kp index & geomagnetic storms', sub: 'How disturbed Earth\'s field is',
      html: () => P('Kp is a 0–9 scale of how disturbed Earth\'s magnetic field is, measured by magnetometers around the world and averaged over 3-hour blocks. Each step is roughly twice as strong as the one before. Kp 5 and above counts as a <b>geomagnetic storm</b> (G1–G5).') +
        H('Kp and aurora in Europe') +
        KV([['Kp 0–2', 'Quiet. Aurora only in the far north (northern Norway, Iceland)'], ['Kp 3–4', 'Active. Aurora across Scandinavia and Scotland'], ['Kp 5 · G1', 'Possible low on the northern horizon in northern Germany, Denmark, the Baltic'], ['Kp 6 · G2', 'Northern Germany, the Netherlands, Poland — visible to the eye with a dark sky'], ['Kp 7 · G3', 'Across Germany; low in the north from the south'], ['Kp 8 · G4', 'All of Central Europe, overhead in the north'], ['Kp 9 · G5', 'Southern Europe too — as in May 2024 and October 2024']]) +
        P('The Activity tab shows the last three days and NOAA\'s three-day forecast (faded bars). Forecasts are uncertain: CME arrivals and their magnetic field can only be confirmed when they reach L1.'),
    },
    {
      id: 'aurora', icon: 'aurora', title: 'Seeing the aurora', sub: 'The aurora tile and practical tips',
      html: () => P('The <b>Aurora now</b> tile uses NOAA\'s OVATION model: a world map of the chance of aurora for the next 30–90 minutes, based on the live solar wind. Solar shows two numbers for your place:') +
        KV([['Overhead', 'Chance of aurora directly above you'], ['Horizon', 'Chance of seeing it low in the north — the aurora can be 100s of km up and visible from far south of where it actually is']]) +
        H('Tips') +
        `<ul class="glist"><li>Find somewhere <b>dark</b> with a clear view <b>north</b> — away from towns and street lights.</li><li>The best time is usually around <b>22:00–02:00</b> local time, but strong storms can glow from dusk.</li><li>Give your eyes 15–20 minutes to adapt; avoid your phone screen, or use it on the lowest brightness.</li><li>A <b>phone camera</b> in night mode sees colour much better than the eye — faint aurora often looks grey to the eye but green or red in a photo.</li><li>Aurora comes in waves. If Bz turns south again, it can return within minutes — check the app every 15 minutes.</li><li>Turn on aurora notifications in Settings to be told when the chance at your place rises.</li></ul>`,
    },
    {
      id: 'scales', icon: 'alert', title: 'Space weather scales', sub: 'NOAA\'s R, S and G levels explained',
      html: (S) => P('NOAA rates space weather on three scales, each from 1 (minor) to 5 (extreme), like the categories for hurricanes. They describe effects on technology and people rather than the physics. The lit level is the one happening now — tap a row for every level in detail.') +
        Scales.strip(S && S.scales ? S.scales.now : null) +
        KV([['R · Radio blackouts', 'From flare X-rays. Instant, minutes to hours, sunlit side only'], ['S · Radiation storms', 'From fast protons. Tens of minutes after a big flare or CME shock; can last days. Harmless on the ground'], ['G · Geomagnetic storms', 'From CMEs and fast solar wind, 1–4 days after the eruption. Brings aurora; affects power grids, GPS, satellites']]),
    },
    {
      id: 'cycle', icon: 'cycle', title: 'Solar cycle & sunspot number', sub: 'The 11-year rhythm and how spots are counted',
      html: () => P('The number of sunspots rises and falls over roughly 11 years. At <b>solar minimum</b> the Sun can go weeks without a single spot; at <b>solar maximum</b> there are often 10+ groups at once and flares and storms are far more frequent. The magnetic poles of the Sun swap places at each maximum.') +
        P('The current cycle, <b>Solar Cycle 25</b>, began in December 2019. Its maximum came around 2024–2025 — with the strongest storms in decades — and it is now slowly declining. Big events often keep happening for a few years after maximum.') +
        H('The sunspot number') +
        P('Since 1849 the daily count has used the same simple formula, invented by Rudolf Wolf:') +
        `<div class="formula">Sunspot number = 10 × groups + individual spots</div>` +
        P('So 3 groups with 25 spots between them make 10×3 + 25 = 55. Groups count extra because they are the meaningful unit. The official worldwide number is compiled by <b>SILSO</b> at the Royal Observatory of Belgium from about 80 observatories; it was recalibrated in 2015 (version 2.0), which is the series used in the History tab.') +
        TIP('Values for the last few months are provisional and can change slightly. Today\'s value in History is an estimate from NOAA\'s live region report until SILSO publishes it.'),
    },
    {
      id: 'history', icon: 'calendar', title: 'Using History', sub: 'Every day since 1818',
      html: () => KV([['All years', 'Coloured stripes show the solar cycles since 1818. Records and a list of every year'], ['A year', 'Averages, spotless days and the cycle phase. Tap a month tile'], ['A month', 'Calendar coloured by sunspot number (○ = spotless). Switch to Pictures to see the Sun on each day (from 1996)'], ['A day', 'The Sun\'s picture with numbered groups (from 1996), flares (from 2010) and the same date in other years']]) +
        P('Tap the <b>month</b> or <b>year</b> in the title to jump straight to another one. Use the arrows to step forward or back, the trail at the top to go up a level, and the calendar button for any date or a famous event.') +
        P('History always opens on the current month when you start the app.'),
    },
    {
      id: 'app', icon: 'gear', title: 'Using the app', sub: 'Gestures, notifications, data',
      html: () => H('Gestures') +
        KV([['Pull down', 'Refresh (Sun, Activity, Events). The sun turns as you pull and spins while loading'], ['Swipe right', 'Remove an alert or event card. Tap Undo, or "Bring back" at the bottom of the list'], ['Back button', 'Closes sheets, goes up a level in History, then returns to the Sun tab']]) +
        H('Notifications') +
        P('Turn on in Settings › Notifications. Solar checks NOAA about every 30 minutes, even when closed, and notifies you when an alert reaches the level you chose — for storms, flares, radiation and, if your place is set, the aurora chance. Android may delay checks a little when the battery is low.') +
        H('Updates & data') +
        KV([['Sun picture', 'Every 15 minutes'], ['Solar wind, X-rays', 'Every 1–5 minutes at the source; Solar refreshes when you open it or pull down'], ['Kp, alerts, scales', 'Every 3 hours / as issued'], ['Sunspot regions', 'Once a day (around 00:30 UTC)'], ['Events (NASA DONKI)', 'Within hours of each event']]) +
        P('Everything is downloaded from public NASA, NOAA and SILSO servers. Solar has no account, no tracking and no cookies; your location stays on the phone.'),
    },
    {
      id: 'glossary', icon: 'search', title: 'Glossary', sub: 'Terms used in the app, A–Z',
      html: () => KV(GLOSSARY.map(([t, d]) => [t, d])),
    },
  ];

  const GLOSSARY = [
    ['Active region (AR)', 'An area of strong magnetic field on the Sun, usually with sunspots. NOAA numbers each one'],
    ['Å (ångström)', 'A tenth of a nanometre — the unit for the ultraviolet wavelengths of the Sun pictures'],
    ['Aurora', 'Light from oxygen (green, red) and nitrogen (blue, purple) in the upper atmosphere, hit by particles guided by Earth\'s magnetic field'],
    ['Bt / Bz', 'Total strength / north–south part of the solar wind\'s magnetic field, in nanotesla (nT). Negative Bz drives storms'],
    ['CME', 'Coronal mass ejection — a cloud of plasma and magnetic field thrown off the Sun'],
    ['Coronal hole', 'A dark area in ultraviolet pictures where the magnetic field opens into space; source of fast solar wind'],
    ['Corona', 'The Sun\'s outer atmosphere, over a million degrees, seen in ultraviolet or during an eclipse'],
    ['DONKI', 'NASA\'s space weather event database (Database Of Notifications, Knowledge, Information)'],
    ['DSCOVR / ACE', 'Spacecraft at L1 measuring the solar wind before it reaches Earth'],
    ['Filament / prominence', 'A cloud of cooler plasma held above the surface by magnetic fields — dark against the disk (filament), bright at the edge (prominence)'],
    ['Flare', 'A sudden release of energy in a sunspot group, seen as a flash of X-rays and light'],
    ['G scale', 'NOAA\'s geomagnetic storm scale, G1–G5 (Kp 5–9)'],
    ['GOES', 'US weather satellites that also measure solar X-rays and protons'],
    ['HMI / AIA', 'The two cameras on SDO: HMI for visible light and magnetic fields, AIA for ultraviolet'],
    ['Kp index', '0–9 measure of how disturbed Earth\'s magnetic field is, per 3 hours'],
    ['L1', 'A point 1.5 million km towards the Sun where gravity balances, used for early-warning spacecraft'],
    ['MSH', 'Millionths of the solar hemisphere — the unit for sunspot area'],
    ['OVATION', 'NOAA\'s model of the auroral oval for the next 30–90 minutes'],
    ['Penumbra / umbra', 'The lighter outer part and the dark core of a sunspot'],
    ['pfu', 'Particle flux unit — protons per cm² per second per steradian, used for radiation storms'],
    ['R scale', 'NOAA\'s radio blackout scale, R1–R5 (M1 to X20 flares)'],
    ['S scale', 'NOAA\'s solar radiation storm scale, S1–S5 (10 to 100,000 pfu)'],
    ['SDO', 'NASA\'s Solar Dynamics Observatory, photographing the Sun continuously since 2010'],
    ['SEP', 'Solar energetic particles — the fast protons behind radiation storms'],
    ['SILSO', 'The World Data Center for the sunspot number, at the Royal Observatory of Belgium'],
    ['SOHO', 'ESA/NASA observatory watching the Sun since 1996; source of the History pictures 1996–2010'],
    ['Solar cycle', 'The ~11-year rise and fall in sunspots and activity'],
    ['Solar wind', 'The constant stream of charged particles flowing from the Sun'],
    ['Spotless day', 'A day with sunspot number 0 — common near solar minimum'],
    ['SWPC', 'NOAA\'s Space Weather Prediction Center, the official US space weather forecaster'],
    ['UTC', 'Universal time — the time all space weather data is given in. Germany is UTC+1 in winter, UTC+2 in summer'],
  ];

  let host = null, query = '';
  const strip = (h) => h.replace(/<[^>]+>/g, ' ').toLowerCase();

  function render(h, S) {
    host = h;
    const q = query.trim().toLowerCase();
    const sec = SECTIONS.filter((s) => !q || (s.title + ' ' + s.sub + ' ' + strip(s.html(S))).toLowerCase().includes(q));
    const gl = q ? GLOSSARY.filter(([t, d]) => (t + ' ' + d).toLowerCase().includes(q)) : [];
    const p = host.tabShell('guide', `
      <div class="set-titlebar"><button class="icon-btn" data-gback aria-label="Back">${ic('back')}</button><div class="tab-title">Guide</div></div>
      <p class="muted top">What everything in Solar means, in plain words</p>
      <div class="search gsearch">${ic('search')}<input id="gq" placeholder="Search — e.g. Bz, delta, aurora" value="${esc(query)}" autocomplete="off"></div>
      <div id="gres">${results(sec, gl, q, S)}</div>
      <p class="attrib">Explanations written for Solar from NOAA SWPC, NASA and SILSO material</p>`);
    const inp = $('#gq', p);
    inp.addEventListener('input', () => {
      query = inp.value;
      const q2 = query.trim().toLowerCase();
      const sec2 = SECTIONS.filter((s) => !q2 || (s.title + ' ' + s.sub + ' ' + strip(s.html(S))).toLowerCase().includes(q2));
      const gl2 = q2 ? GLOSSARY.filter(([t, d]) => (t + ' ' + d).toLowerCase().includes(q2)) : [];
      $('#gres', p).innerHTML = results(sec2, gl2, q2, S);
    });
    p.addEventListener('click', (e) => {
      const sc = e.target.closest('[data-scale]'); if (sc) { host.scaleSheet(sc.dataset.scale); return; }
      const b = e.target.closest('[data-gs]'); if (b) open(b.dataset.gs, S);
    });
  }
  function results(sec, gl, q, S) {
    let h = '';
    if (!q) h += `<div class="sect-row"><div class="sect">Space weather scales · now</div></div>${Scales.strip(S && S.scales ? S.scales.now : null)}<div class="sect-row"><div class="sect">Topics</div></div>`;
    if (gl.length) h += `<div class="sect">Glossary</div>${KV(gl)}`;
    if (sec.length) h += `${q ? '<div class="sect">Topics</div>' : ''}<div class="glinks">${sec.map((s) => `<button class="card linkcard" data-gs="${s.id}"><span class="lc-ic">${ic(s.icon)}</span><span class="tx"><b>${s.title}</b><small>${s.sub}</small></span>${ic('right')}</button>`).join('')}</div>`;
    if (!h) h = '<p class="muted">Nothing found. Try another word.</p>';
    return h;
  }
  function open(id, S) {
    const s = SECTIONS.find((x) => x.id === id); if (!s) return;
    host.pushPage(s.title, `<div class="article">${s.html(S)}</div>`, (pg) => {
      pg.addEventListener('click', (e) => { const sc = e.target.closest('[data-scale]'); if (sc) host.scaleSheet(sc.dataset.scale); });
    });
  }

  // ---------------- per-tab info (the (i) button at the top right) ----------------
  const TABINFO = {
    sun: { title: 'About the Sun tab', html: (S) => SECTIONS[0].html(S), related: ['spots', 'flares', 'scales'] },
    incoming: {
      title: 'About the Incoming tab',
      html: () => P('Incoming is the look-ahead: what the Sun has already thrown towards Earth and what NOAA expects over the next few days.') +
        H('CMEs on their way') +
        P('The animation shows coronal mass ejections (CMEs) from NASA\'s DONKI database that are expected to reach Earth, travelling from the Sun to Earth. The arrival time and the expected Kp are NASA\'s model run (WSA-ENLIL) — real arrivals are often several hours early or late, and a weak or glancing hit may do almost nothing.') +
        KV([['Speed', 'Faster CMEs arrive sooner (1–4 days) and hit harder'], ['Arrives', 'Model estimate, typically ±7 hours'], ['Kp', 'The storm level the model expects if it hits']]) +
        H('Next 3 days') +
        P('NOAA\'s forecast for the R, S and G scales: the chance of radio blackouts (flares), radiation storms and geomagnetic storms on each day. The colour shows the highest level expected.') +
        H('Watches & warnings') +
        P('<b>Watch</b> = a storm is expected (e.g. a CME is coming). <b>Warning</b> = it\'s about to happen or already happening. <b>Alert</b> = a threshold was reached.') +
        H('Sunspot groups to watch') +
        P('The groups most likely to flare, with NOAA\'s flare chances. Complex (delta) groups facing Earth are the ones to watch.') +
        H('At your place') +
        P('The aurora chance and the next eclipse for the place you picked.') +
        TIP('Tap a CME to see where it came from and when it should arrive.'),
      related: ['cme', 'kp', 'scales'],
    },
    activity: {
      title: 'About the Activity tab',
      html: () => P('Activity shows the live measurements behind space weather, as charts.') +
        H('Solar wind') +
        P('Measured by the DSCOVR / ACE spacecraft at L1, 1.5 million km towards the Sun — about 30–60 minutes before the wind reaches Earth. That\'s your early warning.') +
        KV([['Speed', 'Normal 300–450 km/s. Above 600 km/s is fast — storms likely'], ['Density', 'Particles per cm³. Spikes often mark the front of a CME'], ['Bz', 'North–south part of the magnetic field. Negative (south) for a long time = aurora and storms'], ['Bt', 'Total field strength. High Bt with negative Bz is the storm recipe']]) +
        H('X-rays · flares') +
        P('GOES satellite X-ray flux on a log scale. Each letter is ten times stronger than the one before: A, B, C, M, X. M1 and above causes radio blackouts on the day side (R1+).') +
        H('Geomagnetic · Kp') +
        P('Kp 0–9, every 3 hours. Kp 5 = G1 minor storm, Kp 9 = G5 extreme. The higher Kp, the further from the poles the aurora can be seen.') +
        H('Flare chance today') +
        P('NOAA\'s probability of C, M and X-class flares and a proton event in the next 24 hours.') +
        H('Solar cycle 25') +
        P('The monthly sunspot number over the ~11-year cycle, with NOAA\'s prediction. Near the peak there are more flares and CMEs.') +
        TIP('Tap a chart to switch the time range. Pull down to refresh.'),
      related: ['wind', 'flares', 'kp', 'cycle'],
    },
    earth: {
      title: 'About the Earth tab',
      html: () => P('The Earth tab shows everything the Sun is sending our way hitting Earth right now, as a live animation.') +
        H('The picture') +
        KV([['Sun (left)', 'Grows and flashes with the current X-ray level'], ['Streaks', 'The solar wind — faster and denser when the live readings are high'], ['Blue curve', 'The bow shock and magnetic shield (magnetopause). It is pushed closer when the wind pressure is high'], ['Lines around Earth', 'Earth\'s magnetic field. A red ring appears during storms (the ring current)'], ['Globe', 'Real day and night right now, with NOAA\'s live aurora on the night side'], ['Yellow dots at the poles', 'Fast protons during a radiation storm (S1+)']]) +
        H('Hitting Earth now') +
        P('Each card is one thing reaching Earth, with its level colour: green quiet, yellow to red for stronger. Tap a card for its chart and explanation.') +
        H('The shield size') +
        P('Calculated from the live solar wind with the Shue model. Normally about 10 Earth radii out; a strong CME can squeeze it inside 7, close to the GPS and TV satellites at 6.6.') +
        TIP('The Aurora button at the top right of the picture opens the Aurora tab. Sizes and distances are not to scale.'),
      related: ['wind', 'kp', 'scales', 'aurora'],
    },
    aurora: {
      title: 'About the Aurora tab',
      html: () => P('The Aurora tab shows the northern and southern lights right now, from NOAA\'s <b>OVATION</b> model, which forecasts the aurora for the next 30–90 minutes from the live solar wind.') +
        H('The sky') +
        P('The curtains over the lake follow the current strength: one faint band when it\'s quiet, many bright, pink-topped curtains in a big storm.') +
        KV([['Quiet', 'Only the far north and south'], ['Active', 'Kp around 5, or the oval reaching ~57°'], ['Strong', 'Kp 6, oval near 53°'], ['Very strong', 'Kp 7, oval near 49°'], ['Extreme', 'Kp 8–9, seen far from the poles']]) +
        H('Your city') +
        P('The chance that the aurora is visible from your city: <b>overhead</b> when the oval is above you, <b>on the horizon</b> when it\'s within a few hundred km poleward. Tap <b>Change</b> to pick another city — your aurora alerts follow it. It has to be dark: daylight hides even a strong aurora.') +
        H('Tonight') +
        P('One answer for your city: <b>GO</b>, <b>MAYBE</b> or <b>STAY IN</b>. Every hour of the coming night gets a score out of 100 from three things multiplied together: the chance of aurora reaching your city, how clear the sky is (low cloud counts most) and how dark it is (the Sun at least 12° below the horizon, a bright Moon counts against it). The best hour decides the answer: 40+ = go, 18–39 = maybe. The bars show the whole night; tap the card for the hour-by-hour table.') +
        P('For the next 90 minutes the aurora chance is NOAA\'s OVATION; after that it comes from NOAA\'s Kp forecast. Clouds come from Open-Meteo.') +
        H('The globes') +
        P('Each pole seen from space, turned so the night side faces you. The glow is NOAA\'s probability map; the curtains stand on top of it (their height is exaggerated). The Sun shines from beyond the pole. Drag sideways to spin, double-tap to reset.') +
        H('What you\'re seeing') +
        P('The aurora glows where fast particles from the solar wind, steered by Earth\'s magnetic field, crash into the upper air 100–300 km up. Both hemispheres light up at the same time, as mirror images, and the stronger the storm (higher Kp), the further the ovals spread towards the equator.') +
        H('Colours') +
        KV([['Green', 'Oxygen, 100–200 km up — the most common'], ['Red / pink', 'Oxygen higher up, 200–400 km — only in strong storms'], ['Blue / purple', 'Nitrogen at the bottom edge of bright curtains']]) +
        H('Alerts') +
        P('Pick a level (5% = low on the horizon, 20%+ = likely overhead) and Solar checks every 30 minutes, even when closed.') +
        TIP('Go somewhere dark, away from city lights, give your eyes 15 minutes and look north (south in the southern hemisphere). A phone camera often shows colour your eyes can\'t.'),
      related: ['aurora', 'kp', 'wind'],
    },
    events: {
      title: 'About the Events tab',
      html: (S) => P('Events has two views. <b>Coming up</b> is the look-ahead: what the Sun has already thrown towards Earth and what NOAA expects. <b>Happened</b> is the record: NOAA\'s messages and the big events of the last 30 days.') + H('Coming up') + TABINFO.incoming.html(S).replace(/^<p>[^<]*(<[^p][^>]*>[^<]*)*<\/p>/, '') + H('Happened') +
        H('NOAA alerts & warnings') +
        P('Messages from NOAA\'s Space Weather Prediction Center. They disappear 3 days after the event they describe has passed. Swipe one right to remove it yourself.') +
        KV([['Watch', 'Something is expected, e.g. a CME on its way'], ['Warning', 'Imminent or happening now'], ['Alert', 'A level has just been reached'], ['Summary', 'Report after an event, e.g. a finished flare']]) +
        H('Last 30 days') +
        P('Flares, CMEs, geomagnetic storms and radiation storms from NASA\'s DONKI database, newest first, 15 per page. Events older than 30 days drop off. Tap one for details; swipe right to remove.') +
        H('The scales') +
        P('The R · S · G strip shows NOAA\'s current levels. Tap a row for what each level means.') +
        TIP('Tap <b>Select</b> to pick several and remove them together; removed items can be restored.'),
      related: ['cme', 'scales', 'flares', 'kp'],
    },
    eclipse: {
      title: 'About the Eclipse tab',
      html: () => P('Eclipse shows the solar eclipses you can see from your place, calculated on your phone from the positions of the Sun and Moon.') +
        H('Your place') +
        P('Tap the place at the top to change it, use your location or add another city. It\'s shared with the Aurora tab and your alerts.') +
        H('Coming up') +
        P('Each eclipse visible from your place, with how much of the Sun is covered, the times it starts, peaks and ends, and how high the Sun is.') +
        KV([['Total', 'The Moon covers the whole Sun — only inside a narrow path'], ['Annular', 'The Moon is too far to cover it all: a ring of fire'], ['Partial', 'Part of the Sun covered — seen over a wide area']]) +
        H('Around the world') +
        P('The paths of the next total and annular eclipses on a world map.') +
        TIP('Never look at the Sun without certified eclipse glasses — except during the few minutes of totality.'),
      related: [],
    },
  };
  function tabInfo(tabId, S, h) {
    if (h) host = h;
    const t = TABINFO[tabId] || TABINFO.sun;
    const rel = t.related.map((id) => SECTIONS.find((x) => x.id === id)).filter(Boolean);
    host.pushPage(t.title, `<div class="article">${t.html(S)}</div>
      ${rel.length ? `<div class="sect">More in the guide</div><div class="glinks">${rel.map((s) => `<button class="card linkcard" data-gs="${s.id}"><span class="lc-ic">${ic(s.icon)}</span><span class="tx"><b>${s.title}</b><small>${s.sub}</small></span>${ic('right')}</button>`).join('')}</div>` : ''}
      <button class="card linkcard" data-gfull><span class="lc-ic">${ic('book')}</span><span class="tx"><b>The full guide</b><small>Every topic, the scales and the glossary</small></span>${ic('right')}</button>`, (pg) => {
      pg.classList.add('tinfo');
      pg.addEventListener('click', (e) => {
        const sc = e.target.closest('[data-scale]'); if (sc) { host.scaleSheet(sc.dataset.scale); return; }
        const b = e.target.closest('[data-gs]'); if (b) { open(b.dataset.gs, S); return; }
        if (e.target.closest('[data-gfull]')) host.setTab('guide');
      });
    });
  }

  window.Guide = { render, open, tabInfo, SECTIONS };
})();
