'use strict';
/* ---------- Listen (SETI) ---------- */
function cmapTeal(v) {   // 0..1 -> [r,g,b]
  const s = [[0, [0, 0, 6]], [.25, [6, 22, 60]], [.5, [8, 92, 120]], [.72, [40, 200, 180]], [.88, [170, 255, 230]], [1, [255, 255, 255]]];
  for (let i = 1; i < s.length; i++) if (v <= s[i][0]) { const t = (v - s[i - 1][0]) / (s[i][0] - s[i - 1][0]); return s[i - 1][1].map((c, j) => Math.round(lerp(c, s[i][1][j], t))); }
  return [255, 255, 255];
}
const CMAP = Array.from({ length: 256 }, (_, i) => cmapTeal(i / 255));

const Listen = (() => {
  const T = SETIDATA, YEAR = new Date().getFullYear(), BUB = YEAR - 1920;
  const idxOf = new Map(T.map((t, i) => [t, i]));
  const obsDates = (() => { const m = new Map(); for (const [d, l] of Object.entries(OBSDAYS)) for (const i of l) { if (!m.has(i)) m.set(i, []); m.get(i).push(d); } return m; })();

  /* ----- hero: simulated waterfall + dish, with selectable scenes ----- */
  const cv = $('#lsCanvas'), WF = 200, HF = 260, ROWS_PER_S = 1000 / 55;
  const wf = document.createElement('canvas'); wf.width = WF; wf.height = HF; const wx = wf.getContext('2d');
  const row = wx.createImageData(WF, 1);
  let rfi = [], cur = null, queue = [], last = 0, t0 = performance.now();
  let scene = null, sc = {}, stepI = 0, stT = 0, statusCls = '', hist = new Array(HF).fill(null), autoI = 0;
  const statusEl = $('#lsStatus');
  function setStatus(cls, txt) { statusCls = cls; statusEl.className = 'ls-status ' + cls; statusEl.querySelector('span').textContent = txt; }
  function pickTarget() {
    if (!queue.length) {
      const M = horMatrix(new Date(), place().lat, place().lon);
      queue = T.filter(t => t.k !== 'pulsar' && t.k !== 'object' && altAz(M, t.ra, t.dec).alt > 20).sort(() => Math.random() - .5).slice(0, 30);
      if (!queue.length) queue = T.filter(t => t.k === 'star').sort(() => Math.random() - .5).slice(0, 30);
    }
    return queue.shift();
  }
  function showTarget(t, title, meta) {
    $('#lsTarget').textContent = title || setiName(t);
    if (meta) { $('#lsMeta').textContent = meta; return; }
    const band = t.b.includes('L') && t.b.includes('S') ? '1.1–2.7 GHz' : t.b.includes('S') ? '1.8–2.7 GHz' : '1.1–1.9 GHz';
    $('#lsMeta').textContent = [setiCode(t) !== setiName(t) ? setiCode(t) : null, t.ly ? t.ly + ' ly' : t.k === 'galaxy' ? 'galaxy' : null, t.sp ? t.sp.split(' ')[0] : null, band].filter(Boolean).join(' · ');
  }
  const near = (i, c, w = 1.2) => Math.abs(i - c) < w;
  const randRFI = () => Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => ({ c: Math.random() * WF, w: Math.random() < .3 ? 2 : 1, a: .3 + Math.random() * .5 }));
  const disp = i => { const f = 1.1 + i / WF * .8; return (1 / (f * f) - 1 / (1.9 * 1.9)) / (1 / 1.21 - 1 / 3.61); };   // 0 at the top of the band, 1 at the bottom   // dispersion delay shape (high freq on the right arrives first)

  /* each scene: steps [id, seconds, status class, status text]; row(i, step, t) adds brightness; trace marks the signal for the box */
  const SCENES = [
    { id: 'typical', cat: 'search', name: 'Typical search', icon: '📡', kind: 'Simulation', sub: 'A candidate pops up, then the OFF check', desc: 'What a night at Green Bank is really like. The dish works through real listened-to stars above you. Now and then a promising drifting line appears, the dish looks away to an empty patch of sky, the line is still there, so it must be coming from Earth.',
      start() { cur = pickTarget(); showTarget(cur); rfi = randRFI(); sc.c = 30 + Math.random() * (WF - 60); sc.d = (Math.random() < .5 ? -1 : 1) * (.04 + Math.random() * .08); },
      steps: [['tune', 1.6, '', 'Tuning'], ['listen', 4, '', 'Listening'], ['cand', 5, 'cand', () => 'Candidate · drift ' + (sc.d * 2.4).toFixed(2) + ' Hz/s'], ['off', 4, 'cand', 'Pointing away to empty sky…'], ['still', 3, 'rej', 'Still there with the dish turned away'], ['rej', 4, 'rej', 'Rejected · Earth interference']],
      row(i, st) { let v = 0; if (st !== 'tune' && st !== 'listen' && near(i, sc.c)) v += .85; return v; }, adv(st) { if (st !== 'tune' && st !== 'listen') { sc.c += sc.d; return sc.c; } return null; },
      box: st => st === 'cand' || st === 'off' ? ['CANDIDATE', 'amb'] : st === 'still' || st === 'rej' ? ['RFI', 'red'] : null },
    { id: 'wow', cat: 'replay', name: 'The Wow! signal', icon: '❗', kind: 'Replay · 1977', sub: '72 seconds that were never heard again', desc: 'A replay of 15 August 1977 at the Big Ear telescope in Ohio. A narrow signal right next to the hydrogen line rises and fades over 72 seconds, exactly as a source fixed among the stars would. The printout reads 6EQUJ5 and Jerry Ehman circles it. When the telescope looks again, there is nothing. Shown sped up ten times.',
      start() { showTarget(null, 'Big Ear, Ohio', '15 Aug 1977 · Sagittarius · 1420.4 MHz'); rfi = []; sc.c = 104; sc.code = ''; },
      steps: [['tune', 1.4, '', 'Tuning to 1420 MHz'], ['listen', 3, '', 'Scanning as Earth turns'], ['rise', 7.2, 'cand', () => 'Intensity ' + (sc.code || '…')], ['wow', 3.5, 'cand', '6EQUJ5 · "Wow!"'], ['again', 5, '', 'Looking again the next nights…'], ['never', 5, 'rej', 'Never heard again · still unexplained']],
      row(i, st, t) { let v = near(i, 100, 26) ? .05 * (1 - Math.abs(i - 100) / 26) : 0; if (st === 'rise' && near(i, sc.c, 1.4)) { const g = Math.exp(-Math.pow((t / 7.2 - .5) * 4.2, 2)); v += g * 1.1; sc.code = '6EQUJ5'.slice(0, Math.min(6, Math.floor(t / 7.2 * 6.9))).split('').join(' · '); } return v; },
      adv(st) { return st === 'rise' ? sc.c : null; }, box: st => st === 'wow' ? ['6EQUJ5', 'amb'] : null },
    { id: 'blc1', cat: 'replay', name: 'BLC1 from Proxima', icon: '🔴', kind: 'Replay · 2019', sub: 'The best candidate ever, until it wasn\'t', desc: 'A replay of Breakthrough Listen\'s most famous candidate. Parkes watching Proxima Centauri, the nearest star, picks up a narrow tone at 982 MHz that drifts slowly, just like a transmitter on an orbiting planet. It even vanishes when the dish looks away. Then the team finds near-identical copies at other frequencies, the fingerprint of electronics on Earth.',
      start() { showTarget(null, 'Proxima Centauri', '4.2 ly · Parkes · 982.002 MHz'); rfi = randRFI().slice(0, 2); sc.c = 92; sc.d = .06; sc.tw = [44, 150, 172]; },
      steps: [['tune', 1.4, '', 'Tuning'], ['listen', 3, '', 'Listening to Proxima Centauri'], ['cand', 6, 'cand', 'Candidate · slow drift, like a planet'], ['off', 4, 'ok', 'Gone when the dish looks away…'], ['on', 3, 'cand', 'Back on Proxima… still there'], ['twins', 5, 'cand', 'Wait: lookalikes at other frequencies'], ['rej', 5, 'rej', 'Rejected · electronics on Earth']],
      row(i, st) { let v = 0; if ((st === 'cand' || st === 'on' || st === 'twins' || st === 'rej') && near(i, sc.c)) v += .9; if ((st === 'twins' || st === 'rej') && sc.tw.some(c => near(i, c + (sc.c - 92) * (c / 92)))) v += .7; return v; },
      adv(st) { if (st !== 'tune' && st !== 'listen') { sc.c += sc.d; return st === 'off' ? null : sc.c; } return null; },
      box: st => st === 'cand' || st === 'on' ? ['CANDIDATE', 'amb'] : st === 'twins' ? ['LOOKALIKES', 'amb'] : st === 'rej' ? ['RFI', 'red'] : null },
    { id: 'voyager', cat: 'search', name: 'Voyager 1', icon: '🛰️', kind: 'Our own spacecraft', sub: 'What success would look like', desc: 'Breakthrough Listen pointed Green Bank at Voyager 1, now 25 billion km away in interstellar space, to prove the system works. Its 23-watt transmitter shows up as a bright carrier with a side tone either side, drifting steadily as Earth turns. If a civilisation out there did what we do, this is what we would see.',
      start() { showTarget(null, 'Voyager 1', '25 billion km · 8.4 GHz · 23 watts'); rfi = []; sc.c = 100; sc.d = -.05; },
      steps: [['tune', 1.4, '', 'Tuning to 8.4 GHz'], ['listen', 2.5, '', 'Pointing at Voyager 1'], ['det', 6, 'ok', 'Detected · carrier and sidebands'], ['off', 3, 'ok', 'Gone when the dish looks away ✓'], ['win', 5, 'ok', 'This is what success would look like']],
      row(i, st) { let v = 0; if (st === 'det' || st === 'win') { if (near(i, sc.c, 1.3)) v += 1.2; if (near(i, sc.c - 14) || near(i, sc.c + 14)) v += .5; } return v; },
      adv(st) { if (st === 'det' || st === 'win') { sc.c += sc.d; return sc.c; } if (st === 'off') sc.c += sc.d; return null; }, box: st => st === 'det' || st === 'win' ? ['VOYAGER 1', 'grn'] : null },
    { id: 'pulsar', cat: 'nature', name: 'Pulsar', icon: '💫', kind: 'Simulation', sub: 'A dead star ticking like a clock', desc: 'Breakthrough Listen checks its equipment on pulsars, collapsed stars that spin and sweep a radio beam past us like a lighthouse. Each pulse arrives first at high frequencies and later at low ones, delayed by the thin gas between the stars. The first one ever found, in 1967, was nicknamed LGM-1, Little Green Men.',
      start() { const p = T.find(t => /0332\+5434/.test(t.id)); showTarget(null, 'PSR B0329+54', 'pulsar · 3,400 ly · a pulse every 0.71 s'); rfi = randRFI().slice(0, 1); },
      steps: [['tune', 1.4, '', 'Tuning'], ['pulse', 8, 'ok', 'Regular pulses · every 0.71 s'], ['why', 5, 'ok', 'Natural · a spinning neutron star']],
      row(i, st, t) { if (st === 'tune') return 0; const ph = ((t - disp(i) * 1.1) / .71) % 1; return (ph < 0 ? ph + 1 : ph) < .13 ? .8 : 0; }, adv: () => null, box: () => null },
    { id: 'frb', cat: 'nature', name: 'Fast radio burst', icon: '⚡', kind: 'Simulation', sub: 'A flash from billions of light-years', desc: 'A single flash lasting a few thousandths of a second, carrying as much energy as the Sun gives out in days. Its curved, smeared shape comes from crossing billions of light-years of thin gas between galaxies. Thousands are now known; at least some come from magnetars.',
      start() { const t = pickTarget(); cur = t; showTarget(t); rfi = randRFI(); sc.t0 = null; },
      steps: [['tune', 1.4, '', 'Tuning'], ['listen', 4, '', 'Listening'], ['burst', 3.4, 'cand', 'Burst! 5 milliseconds long'], ['why', 5, 'ok', 'Natural · smeared by intergalactic gas'], ['quiet', 3, '', 'One flash, then silence']],
      row(i, st, t) { if (st !== 'burst') return 0; return Math.abs(t - .3 - disp(i) * 2.4) < .07 ? 1.25 : 0; }, adv: () => null, box: st => st === 'burst' ? ['BURST', 'amb'] : null },
    { id: 'peryton', cat: 'replay', name: 'Microwave mystery', icon: '🍿', kind: 'Replay · 1998–2015', sub: '17 years of bursts, solved in a kitchen', desc: 'For 17 years Parkes kept catching chirps that looked a bit like cosmic bursts but appeared in every beam at once and mostly around lunchtime. In 2015 the culprit was caught: the staff microwave oven, opened before the timer finished.',
      start() { showTarget(null, 'Parkes, Australia', '1.4 GHz · all 13 beams · 12:42'); rfi = randRFI().slice(0, 2); },
      steps: [['tune', 1.4, '', 'Tuning'], ['listen', 3, '', 'Listening · lunchtime'], ['chirp', 2.6, 'cand', 'Burst in all 13 beams at once?!'], ['hm', 4, 'cand', 'Odd: it always happens around lunch'], ['door', 5, 'rej', 'Solved · microwave door opened early']],
      row(i, st, t) { if (st !== 'chirp') return 0; const u = i / WF; return Math.abs(t - .4 - Math.pow(1 - u, 2.2) * 1.6) < .07 ? 1 : 0; }, adv: () => null, box: st => st === 'door' ? ['MICROWAVE', 'red'] : null },
    { id: 'whatif', cat: 'madeup', name: 'What if…', icon: '👽', kind: 'Made up', sub: 'A signal that passes every test', desc: 'An imagined night, clearly made up: a signal from a real nearby star that passes every check. It vanishes when the dish looks away, returns when it looks back, shows up again the next night and is confirmed by a second telescope. This has never happened. Yet.',
      start() { const c = T.filter(t => t.k === 'star' && t.ly && t.ly < 40); cur = c[Math.floor(Math.random() * c.length)]; showTarget(cur); rfi = randRFI().slice(0, 2); sc.c = 70 + Math.random() * 60; sc.d = .09; },
      steps: [['tune', 1.4, '', 'Tuning'], ['listen', 3, '', 'Listening'], ['cand', 5, 'cand', 'Candidate · drifting'], ['off', 3.5, 'ok', 'Gone in the OFF pointing ✓'], ['on', 3.5, 'ok', 'Back when the dish returns ✓'], ['n2', 3.5, 'ok', 'There again the next night ✓'], ['conf', 5, 'ok', 'Confirmed by a second telescope ✓'], ['note', 4, 'cand', 'Made up · this has never happened. Yet.']],
      row(i, st) { return st !== 'tune' && st !== 'listen' && st !== 'off' && near(i, sc.c) ? .9 : 0; }, adv(st) { if (st === 'tune' || st === 'listen') return null; sc.c += sc.d; if (sc.c > WF - 10 || sc.c < 10) sc.d = -sc.d; return st === 'off' ? null : sc.c; },
      box: st => st === 'cand' ? ['CANDIDATE', 'amb'] : st === 'off' || st === 'tune' || st === 'listen' ? null : ['SIGNAL', 'grn'] },
    /* ---------------- Pro simulations ---------------- */
    { id: 'lgm1', cat: 'replay', pro: 1, name: 'LGM-1: Little Green Men', icon: '🟢', kind: 'Replay · 1967', sub: 'A bit of "scruff" that ticked like a clock', desc: 'Cambridge, November 1967. Jocelyn Bell Burnell notices a small patch of "scruff" on kilometres of chart paper. Recorded faster, it becomes a train of pulses exactly 1.337 seconds apart, so regular the team half-jokingly calls it LGM-1, for Little Green Men. It was the first pulsar ever found.',
      start() { showTarget(null, 'Cambridge, UK', '28 Nov 1967 · 81.5 MHz · PSR B1919+21'); rfi = randRFI().slice(0, 1); },
      steps: [['tune', 1.4, '', 'Tuning to 81.5 MHz'], ['listen', 3, '', 'Scanning the sky on chart paper'], ['scruff', 4, 'cand', 'A bit of "scruff" on the chart…'], ['zoom', 6, 'ok', 'Recorded faster: pulses every 1.337 s'], ['lgm', 4, 'cand', 'Nicknamed LGM-1 · Little Green Men'], ['why', 5, 'ok', 'Natural · the first pulsar ever found']],
      row(i, st, t) { if (st === 'scruff') return i > 70 && i < 130 && Math.random() < .08 ? .5 : 0; if (st === 'zoom' || st === 'lgm' || st === 'why') { const ph = ((t - disp(i) * .35) / 1.337) % 1; return (ph < 0 ? ph + 1 : ph) < .09 ? .8 : 0; } return 0; },
      adv: st => st === 'scruff' ? 100 : null, box: st => st === 'scruff' ? ['SCRUFF', 'amb'] : null },
    { id: 'hd164595', cat: 'replay', pro: 1, name: 'HD 164595', icon: '⭐', kind: 'Replay · 2015', sub: 'A spike from a Sun-like star', desc: 'A Russian telescope scanning a Sun-like star 94 light-years away records one strong spike. When the news breaks in 2016, Breakthrough Listen turns Green Bank on the star and the SETI Institute listens with the Allen Telescope Array. Neither hears anything, and the original team later concludes it was most likely interference from Earth.',
      start() { showTarget(null, 'HD 164595', '94 ly · Sun-like star · RATAN-600, then Green Bank'); rfi = randRFI().slice(0, 2); },
      steps: [['tune', 1.4, '', 'Tuning to 11 GHz'], ['listen', 3, '', 'RATAN-600 scanning Hercules'], ['spike', 2.6, 'cand', 'One strong spike!'], ['follow', 5, '', 'Green Bank and the Allen Array listen…'], ['none', 4, 'rej', 'Nothing there · likely Earth interference']],
      row(i, st, t) { if (st !== 'spike') return 0; const g = Math.exp(-Math.pow((t / 2.6 - .45) * 5, 2)); return Math.abs(i - 100) < 22 ? g * (1 - Math.abs(i - 100) / 22) * 1.7 : 0; },
      adv: st => st === 'spike' ? 100 : null, box: st => st === 'spike' ? ['SPIKE', 'amb'] : null },
    { id: 'ross128', cat: 'replay', pro: 1, name: 'Ross 128 "Weird!"', icon: '〰️', kind: 'Replay · 2017', sub: 'Odd pulses from the star next door', desc: 'Astronomers studying red dwarfs with the Arecibo telescope catch strange, roughly repeating broad pulses during ten minutes on Ross 128, just 11 light-years away. They publish it half-jokingly as the "Weird!" signal. Follow-ups point to geostationary satellites in that part of the sky. Green Bank also listened to Ross 128 eighteen times in 2016.',
      start() { const t = T.find(x => x.id === 'GJ447'); showTarget(t || null, t ? 'Ross 128' : 'Ross 128', '11 ly · red dwarf · Arecibo 4–5 GHz'); rfi = []; },
      steps: [['tune', 1.4, '', 'Tuning'], ['listen', 3, '', 'Ten minutes on Ross 128'], ['weird', 6, 'cand', 'Odd, quasi-regular pulses: "Weird!"'], ['check', 4, 'cand', 'A flare? A planet? Something else?'], ['sat', 5, 'rej', 'Solved · satellites in the same patch of sky']],
      row(i, st, t) { if (st === 'tune' || st === 'listen') return 0; const ph = (t * 2.3 + Math.sin(t * 1.7) * .3) % 1; return ph < .12 && i > 25 && i < 175 ? .8 * (1 - Math.abs(i - 100) / 95) : 0; }, adv: () => null, box: () => null },
    { id: 'shgb', cat: 'replay', pro: 1, name: 'SHGb02+14a', icon: '💻', kind: 'Replay · 2003', sub: 'Found by home computers, three times', desc: 'SETI@home farmed out Arecibo data to millions of volunteers\' screensavers. One candidate between Pisces and Aries turned up in three separate observations near the hydrogen line. But it drifted far faster than any planet\'s motion would explain, and it was never seen again: most likely a coincidence among billions of channels.',
      start() { showTarget(null, 'SHGb02+14a', 'Pisces–Aries · Arecibo · SETI@home'); rfi = randRFI().slice(0, 2); sc.c = 40; },
      steps: [['tune', 1.4, '', 'Tuning to 1420 MHz'], ['listen', 3, '', 'Millions of home computers crunching'], ['hit1', 3, 'cand', 'Flagged once…'], ['gap', 2, '', 'A different night…'], ['hit2', 3, 'cand', 'Flagged again, same spot!'], ['drift', 4, 'cand', 'But it drifts far too fast for a planet'], ['never', 4, 'rej', 'Never seen again · probably chance']],
      row(i, st) { return (st === 'hit1' || st === 'hit2' || st === 'drift') && near(i, sc.c) ? .8 : 0; },
      adv(st) { if (st === 'hit1' || st === 'hit2' || st === 'drift') { sc.c += .75; if (sc.c > WF - 20) sc.c = 30; return sc.c; } if (st === 'gap') sc.c = 40; return null; },
      box: st => st === 'hit1' || st === 'hit2' ? ['CANDIDATE', 'amb'] : st === 'drift' ? ['TOO FAST', 'red'] : null },
    { id: 'arecibo', cat: 'replay', pro: 1, name: 'Sending the Arecibo message', icon: '📨', kind: 'Replay · 1974 · transmit', sub: 'For once, the dish talks', desc: 'On 16 November 1974 the Arecibo telescope turned transmitter and beamed 1,679 bits at the star cluster M13: two tones, one for 0 and one for 1, a few seconds of each. Laid out in a 23 by 73 grid the bits draw numbers, DNA, a human and the telescope itself. The bit pattern here is stylised. The message reaches M13 in about 22,000 years.',
      start() { showTarget(null, 'Arecibo, Puerto Rico', '16 Nov 1974 · 2380 MHz · 1,679 bits to M13'); rfi = []; sc.bits = 0; sc.r = rng(1679); sc.b = 0; },
      steps: [['tune', 1.4, '', 'Switching from listening to sending'], ['send', 12, 'ok', () => 'Sending bit ' + fmtN(Math.min(1679, Math.floor(sc.bits))) + ' of 1,679'], ['done', 5, 'ok', 'Sent · reaches M13 in about 22,000 years']],
      row(i, st) { return st === 'send' && near(i, sc.b ? 106 : 94, 1.4) ? 1.1 : 0; },
      adv(st) { if (st !== 'send') return null; sc.bits += 7.7; if (Math.random() < .35) sc.b = sc.r() < .4 ? 1 : 0; return sc.b ? 106 : 94; }, box: st => st === 'send' ? ['0 · 1', 'grn'] : null },
    { id: 'jupiter', cat: 'nature', pro: 1, name: 'Jupiter\'s radio storms', icon: '🪐', kind: 'Nature', sub: 'Waves on a beach, set off by Io', desc: 'Jupiter is the loudest radio source in the sky after the Sun at around 20 MHz. Its volcanic moon Io drives huge electric currents into Jupiter\'s magnetic field, and the result is storms of short sweeping bursts. Through a loudspeaker radio amateurs say they sound like waves breaking on a beach.',
      start() { showTarget(null, 'Jupiter', 'decametric radio · ~20 MHz · triggered by Io'); rfi = []; sc.st = []; },
      steps: [['tune', 1.4, '', 'Tuning down to 20 MHz'], ['listen', 3, '', 'Io is in the right place…'], ['storm', 9, 'ok', 'Storm! Sweeping bursts, "waves on a beach"'], ['why', 5, 'ok', 'Natural · currents between Io and Jupiter']],
      row(i, st, t) { let v = 0; for (const k of sc.st) { const a = t - k.t; if (a >= 0 && a < .9 && Math.abs(i - (k.c - a * 110)) < 1.8) v += .95; } return v; },
      adv(st) { if (st === 'storm' || st === 'why') { const now = (performance.now() - stT) / 1000; if (Math.random() < .3) sc.st.push({ t: now, c: 110 + Math.random() * 90 }); sc.st = sc.st.filter(k => now - k.t < 1); } else sc.st = []; return null; }, box: () => null },
    { id: 'solar', cat: 'nature', pro: 1, name: 'Solar radio burst', icon: '☀️', kind: 'Nature', sub: 'The Sun shouts after a flare', desc: 'After a solar flare, beams of electrons race out through the Sun\'s atmosphere at a third of the speed of light. As they reach thinner and thinner gas they make radio waves at lower and lower frequencies, so each burst sweeps rapidly from high to low. Astronomers call these type III bursts.',
      start() { showTarget(null, 'The Sun', 'type III burst · 20–200 MHz · after a flare'); rfi = []; },
      steps: [['tune', 1.4, '', 'Pointing at the Sun'], ['listen', 2.5, '', 'Quiet Sun…'], ['burst', 4, 'cand', 'Type III burst: sweeping down fast'], ['more', 4, 'cand', 'Another… and another'], ['why', 5, 'ok', 'Natural · electron beams from a solar flare']],
      row(i, st, t) { let v = st === 'tune' ? 0 : .03; const hits = st === 'burst' ? [.4, 2.1] : st === 'more' ? [.2, .9, 1.6, 2.6] : []; for (const h of hits) if (Math.abs(t - h - disp(i) * .9) < .12) v += 1; return v; }, adv: () => null, box: () => null },
    { id: 'hydrogen', cat: 'nature', pro: 1, name: 'The Milky Way\'s hydrogen', icon: '🌌', kind: 'Nature', sub: 'Hearing the spiral arms move', desc: 'Cold hydrogen gas glows faintly at exactly 1420.4 MHz. As the dish sweeps along the Milky Way, the line splits into several humps: each is a spiral arm moving towards or away from us at its own speed, shifting the frequency. This is how astronomers first mapped our galaxy\'s spiral.',
      start() { showTarget(null, 'The Milky Way', 'hydrogen line · 1420.4 MHz · galactic rotation'); rfi = randRFI().slice(0, 1); },
      steps: [['tune', 1.4, '', 'Tuning to 1420.4 MHz'], ['sweep', 11, 'ok', () => 'Panning along the galaxy · longitude ' + Math.round(20 + ((performance.now() - stT) / 1000) * 14) + '°'], ['why', 5, 'ok', 'Each hump is a spiral arm moving at its own speed']],
      row(i, st, t) { if (st === 'tune') return 0; const a = st === 'sweep' ? t : 11; let v = 0; [[100 + 26 * Math.sin(a * .45), .4], [100 - 18 * Math.sin(a * .45 + .8), .3], [100 + 6 * Math.sin(a * .3), .22]].forEach(([c, h]) => { v += h * Math.exp(-Math.pow((i - c) / 5, 2)); }); return v; }, adv: () => null, box: () => null },
    { id: 'starlink', cat: 'earth', pro: 1, name: 'Satellite train', icon: '🛰', kind: 'Earth\'s noise', sub: 'A string of satellites drowns the star', desc: 'Tens of thousands of satellites now circle Earth, and their transmitters and stray electronics leak into radio telescopes. As a train passes over, each one streaks across the waterfall as a steep line. Searches have to recognise and throw out more of this every year.',
      start() { cur = pickTarget(); showTarget(cur); rfi = randRFI().slice(0, 2); sc.ln = []; },
      steps: [['tune', 1.4, '', 'Tuning'], ['listen', 3, '', 'Listening'], ['train', 7, 'rej', 'Satellite train passing overhead'], ['gone', 3, '', 'Passed · back to the star'], ['note', 4, 'rej', 'All Earth interference · rejected']],
      row(i, st) { let v = 0; for (const l of sc.ln) if (Math.abs(i - l.c) < 1.3) v += .8; return v; },
      adv(st) { if (st === 'train') { if (Math.random() < .045) sc.ln.push({ c: 70 + Math.random() * 140, d: -(.45 + Math.random() * .5) }); } sc.ln.forEach(l => l.c += l.d); sc.ln = sc.ln.filter(l => l.c > -5); return null; }, box: () => null },
    { id: 'radar', cat: 'earth', pro: 1, name: 'Airport radar', icon: '✈️', kind: 'Earth\'s noise', sub: 'Pulses sweeping past every few seconds', desc: 'Air traffic radar sends out powerful short pulses as its antenna turns. When the beam sweeps across a radio telescope it leaves bright stripes across a wide band, again and again. The pattern is easy to spot and throw out, but it can hide anything faint underneath.',
      start() { cur = pickTarget(); showTarget(cur); rfi = randRFI().slice(0, 2); },
      steps: [['tune', 1.4, '', 'Tuning'], ['listen', 3, '', 'Listening'], ['radar', 7, 'rej', 'Radar beam sweeping past'], ['why', 4, 'rej', 'Pulsed interference · rejected']],
      row(i, st, t) { if (st !== 'radar') return 0; const ph = (t % 1.1) / 1.1; return ph < .08 && i > 50 && i < 150 ? .9 * (1 - Math.abs(i - 100) / 55) : ph > .5 && ph < .53 && i > 70 && i < 130 ? .35 : 0; }, adv: () => null, box: () => null },
    { id: 'earth10', cat: 'madeup', pro: 1, name: 'Earth from 10 light-years', icon: '🌍', kind: 'Imagined', sub: 'What our own leakage might look like', desc: 'An imagined view of Earth from a star 10 light-years away, with a telescope like Green Bank. Our TV and radio carriers show up as narrow lines, military and airport radars as sweeping pulses, and every signal drifts back and forth with Earth\'s 24-hour spin. This is roughly what Breakthrough Listen hopes to find somewhere else.',
      start() { showTarget(null, 'Earth', 'seen from 10 light-years · imagined'); rfi = []; sc.ln = [60, 78, 121, 140, 163].map(c => ({ c, d: .05 })); },
      steps: [['tune', 1.4, '', 'Pointing at a small blue planet'], ['tv', 5, 'cand', 'Narrow TV and radio carriers'], ['radar', 5, 'cand', 'Powerful radar sweeps'], ['drift', 5, 'ok', 'All drifting with the planet\'s 24-hour spin'], ['note', 5, 'cand', 'Imagined · how Earth might look to someone else']],
      row(i, st, t) { if (st === 'tune') return 0; let v = 0; for (const l of sc.ln) if (Math.abs(i - l.c) < 1.2) v += .75; if ((st === 'radar' || st === 'drift') && (t % 1.4) < .1 && i > 40 && i < 160) v += .5; return v; },
      adv(st) { if (st !== 'tune') sc.ln.forEach(l => l.c += l.d * (st === 'drift' ? 3 : 1)); return st === 'tv' ? sc.ln[2].c : null; }, box: st => st === 'tv' ? ['CARRIER', 'amb'] : null },
    { id: 'decode', cat: 'madeup', pro: 1, name: 'Decode a message', icon: '🔢', kind: 'Made up', sub: 'A signal that counts in primes', desc: 'A made-up night: a narrow signal from a real nearby star switches on and off in groups. Count them and you get 2, 3, 5, 7, 11, 13: prime numbers. Nature does not make primes, so a pattern like this would be a strong sign of a mind behind it. This has never happened.',
      start() { const c = T.filter(t => t.k === 'star' && t.ly && t.ly < 30); cur = c[Math.floor(Math.random() * c.length)]; showTarget(cur); rfi = randRFI().slice(0, 2); sc.c = 90 + Math.random() * 20;
        const on = []; let tt = .3; [2, 3, 5, 7, 11, 13].forEach(p => { for (let k = 0; k < p; k++) { on.push([tt, tt + .1]); tt += .2; } tt += .5; }); sc.on = on; sc.n = 0; },
      steps: [['tune', 1.4, '', 'Tuning'], ['listen', 3, '', 'Listening'], ['cand', 4, 'cand', 'Candidate · switching on and off'], ['count', 14.6, 'ok', () => 'Counting groups: ' + sc.cnt], ['primes', 4, 'ok', 'Prime numbers: nature doesn\'t make these'], ['note', 4, 'cand', 'Made up · this has never happened']],
      row(i, st, t) { if (!near(i, sc.c)) return 0; if (st === 'cand') return (t % .5) < .25 ? .9 : 0; if (st === 'count') return sc.on.some(o => t >= o[0] && t < o[1]) ? 1 : 0; return 0; },
      adv(st) { if (st === 'count') { const t = (performance.now() - stT) / 1000, groups = [2, 3, 5, 7, 11, 13]; let tt = .3, shown = []; for (const p of groups) { if (t > tt) shown.push(p); tt += p * .2 + .5; } sc.cnt = shown.length ? shown.join(', ') : '…'; } return st === 'cand' || st === 'count' ? sc.c : null; },
      box: st => st === 'cand' ? ['CANDIDATE', 'amb'] : st === 'count' || st === 'primes' ? ['PRIMES', 'grn'] : null },
    { id: 'planetday', cat: 'madeup', pro: 1, name: 'A planet\'s day', icon: '🔄', kind: 'Made up', sub: 'The drift gives away how fast it spins', desc: 'A made-up signal whose drift swings one way, then the other, then back again. A transmitter on a spinning planet moves towards us and then away as the planet turns, so its frequency wobbles once per day. Measure the wobble and you have measured the length of an alien day.',
      start() { const c = T.filter(t => t.k === 'star' && t.ly && t.ly < 50); cur = c[Math.floor(Math.random() * c.length)]; showTarget(cur); rfi = randRFI().slice(0, 2); sc.h = 14 + Math.floor(Math.random() * 30); },
      steps: [['tune', 1.4, '', 'Tuning'], ['listen', 3, '', 'Listening'], ['wobble', 12, 'ok', 'Drift swings back and forth: a turning planet'], ['day', 4, 'ok', () => 'Its day lasts about ' + sc.h + ' hours'], ['note', 4, 'cand', 'Made up · this has never happened']],
      row(i, st, t) { if (st === 'tune' || st === 'listen') return 0; const c = 100 + 34 * Math.sin((st === 'wobble' ? t : 12) * .55); sc.c = c; return near(i, c, 1.3) ? .95 : 0; },
      adv: st => st === 'wobble' || st === 'day' || st === 'note' ? sc.c : null, box: st => st === 'wobble' ? ['SIGNAL', 'grn'] : null }];
  const AUTO = { id: 'auto', name: 'Auto', icon: '🔁', kind: 'Mix', sub: 'Plays them all in turn', desc: 'Runs a few typical searches, then each replay and simulation in turn.' };
  const CATS = [['search', 'Searches'], ['replay', 'Replays of real moments'], ['nature', 'Natural radio from space'], ['earth', 'Earth\'s own noise'], ['madeup', 'Made up, clearly labelled']];
  const ALL = [AUTO].concat(...CATS.map(c => SCENES.filter(s => s.cat === c[0])));
  const locked = s => s.pro && !S.pro;
  let choice = store.get('sim', 'typical'); if (!ALL.some(s => s.id === choice) || (SCENES.find(s => s.id === choice) || {}).pro && store.get('pro', true) === false) choice = 'typical';
  const AUTO_FREE = ['typical', 'typical', 'wow', 'typical', 'blc1', 'pulsar', 'typical', 'voyager', 'frb', 'typical', 'peryton', 'whatif'];
  const AUTO_PRO = ['typical', 'wow', 'jupiter', 'typical', 'blc1', 'lgm1', 'starlink', 'typical', 'hydrogen', 'voyager', 'shgb', 'typical', 'solar', 'ross128', 'frb', 'typical', 'hd164595', 'radar', 'arecibo', 'pulsar', 'typical', 'peryton', 'earth10', 'decode', 'planetday', 'whatif'];
  function runScene() {
    const seq = S.pro ? AUTO_PRO : AUTO_FREE, id = choice === 'auto' ? seq[autoI++ % seq.length] : (locked(SCENES.find(s => s.id === choice) || {}) ? 'typical' : choice);
    scene = SCENES.find(s => s.id === id); sc = {}; stepI = 0; stT = performance.now(); hist.fill(null);
    scene.start(); enterStep(); paintPill();
  }
  function enterStep() { const st = scene.steps[stepI]; setStatus(st[2], typeof st[3] === 'function' ? st[3]() : st[3]); if (st[2] === 'cand' || st[2] === 'ok') N.haptic(12); }
  function stepState(now) {
    const st = scene.steps[stepI], dt = (now - stT) / 1000;
    if (typeof st[3] === 'function') { const txt = st[3](); if (statusEl.querySelector('span').textContent !== txt) statusEl.querySelector('span').textContent = txt; }
    if (dt > st[1]) { stepI++; stT = now; if (stepI >= scene.steps.length) runScene(); else enterStep(); }
  }
  function addRow(now) {
    const d = row.data, st = scene ? scene.steps[stepI][0] : 'listen', t = scene ? (now - stT) / 1000 : 0;
    for (let i = 0; i < WF; i++) {
      let v = -Math.log(Math.random() + 1e-6) * .16 + .14;
      for (const r of rfi) if (Math.abs(i - r.c) < r.w) v += r.a * (.85 + Math.random() * .3);
      if (scene) v += scene.row(i, st, t);
      if (st === 'tune') v *= .5 + Math.random() * .3;
      const c = CMAP[clamp(Math.round(v * 255), 0, 255)]; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    }
    hist.pop(); hist.unshift(scene ? scene.adv(st) : null);
    wx.drawImage(wf, 0, 0, WF, HF - 1, 0, 1, WF, HF - 1); wx.putImageData(row, 0, 0);
  }
  function clearWF() { const d = row.data; for (let k = 0; k < HF; k++) { for (let i = 0; i < WF; i++) { const v = -Math.log(Math.random() + 1e-6) * .16 + .14, c = CMAP[clamp(Math.round(v * 255), 0, 255)]; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; } wx.putImageData(row, 0, k); } hist.fill(null); }
  const stars = (() => { const r = rng(42); return Array.from({ length: 90 }, () => [r(), r(), r()]); })();
  const BOXC = { amb: 'rgba(255,178,77,.95)', red: 'rgba(255,93,115,.9)', grn: 'rgba(82,224,160,.95)' };
  function frame(now) {
    raf = requestAnimationFrame(frame); if (S.view !== 'listen') return;
    if (!scene) { clearWF(); runScene(); }
    stepState(now); if (now - last > 55) { addRow(now); last = now; }
    const { x, w, h } = hidpi(cv), t = (now - t0) / 1000;
    x.fillStyle = '#01030a'; x.fillRect(0, 0, w, h);
    const top = 58, wb = h * .78, rowH = (wb - top) / HF;
    x.imageSmoothingEnabled = false; x.globalAlpha = .95; x.drawImage(wf, 0, top, w, wb - top); x.globalAlpha = 1;
    x.strokeStyle = 'rgba(63,240,207,.1)'; x.lineWidth = 1; for (let i = 1; i < 8; i++) { x.beginPath(); x.moveTo(i * w / 8, top); x.lineTo(i * w / 8, wb); x.stroke(); }
    // box that follows the signal's actual trace on screen
    const bx = scene && scene.box(scene.steps[stepI][0]);
    if (bx) { let lo = 1e9, hi = -1e9, r0 = -1, r1 = -1; const lim = Math.floor(HF * .88);
      for (let k = 0; k < lim; k++) { const c = hist[k]; if (c == null) continue; if (r0 < 0) r0 = k; r1 = k; lo = Math.min(lo, c); hi = Math.max(hi, c); }
      if (r0 >= 0) { const x0 = lo / WF * w - 14, x1 = hi / WF * w + 14, y0 = top + r0 * rowH - 6, y1 = top + r1 * rowH + 6;
        x.strokeStyle = BOXC[bx[1]]; x.setLineDash([4, 4]); x.lineWidth = 1.5; x.strokeRect(x0, Math.max(top + 18, y0), x1 - x0, y1 - Math.max(top + 18, y0)); x.setLineDash([]);
        x.font = '600 10px Mono'; x.fillStyle = BOXC[bx[1]]; x.fillText(bx[0], clamp(x0, 4, w - 90), Math.max(top + 14, y0 - 5)); } }
    const g = x.createLinearGradient(0, wb - 50, 0, h); g.addColorStop(0, 'rgba(1,3,10,0)'); g.addColorStop(.45, 'rgba(2,5,12,.9)'); g.addColorStop(1, 'rgba(4,6,13,1)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const tg = x.createLinearGradient(0, 0, 0, top + 40); tg.addColorStop(0, 'rgba(4,6,13,1)'); tg.addColorStop(1, 'rgba(4,6,13,0)'); x.fillStyle = tg; x.fillRect(0, 0, w, top + 40);
    for (const s of stars) { if (s[1] < .62) continue; x.globalAlpha = .25 + .35 * Math.sin(t * 1.4 + s[2] * 9); x.fillStyle = '#cfe8ff'; x.fillRect(s[0] * w, s[1] * h * .82, 1.2, 1.2); } x.globalAlpha = 1;
    const ds = Math.min(w, 460) * .13, dx = w - ds * 1.25, dy = h - 26;
    x.save(); x.translate(dx, dy);
    x.fillStyle = '#0b1823'; x.beginPath(); x.moveTo(-ds * .5, 0); x.lineTo(-ds * .18, -ds * .9); x.lineTo(ds * .18, -ds * .9); x.lineTo(ds * .5, 0); x.closePath(); x.fill();
    x.translate(0, -ds * .95); x.rotate(-.62 + Math.sin(t * .12) * .06);
    const bowl = x.createLinearGradient(0, -ds * .2, 0, ds * .55); bowl.addColorStop(0, '#2b5a72'); bowl.addColorStop(1, '#07131c');
    x.fillStyle = bowl; x.beginPath(); x.moveTo(-ds, 0); x.quadraticCurveTo(0, ds * 1.05, ds, 0); x.closePath(); x.fill();
    const rim = x.createLinearGradient(-ds, 0, ds, 0); rim.addColorStop(0, '#9fe9ff'); rim.addColorStop(1, '#3a7f99');
    x.fillStyle = 'rgba(160,230,255,.14)'; x.strokeStyle = rim; x.lineWidth = 1.6; x.beginPath(); x.ellipse(0, 0, ds, ds * .16, 0, 0, 7); x.fill(); x.stroke();
    x.strokeStyle = '#4c8aa3'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(-ds * .82, -ds * .05); x.lineTo(0, -ds * .95); x.lineTo(ds * .82, -ds * .05); x.stroke();
    const fx = 0, fy = -ds * .98;
    for (let k = 0; k < 4; k++) { const p = ((t * .45) + k / 4) % 1; x.strokeStyle = `rgba(63,240,207,${p * .55})`; x.lineWidth = 1.2; x.beginPath(); x.arc(fx, fy, (1 - p) * ds * 1.6 + 3, -Math.PI * .95, -Math.PI * .05); x.stroke(); }
    x.fillStyle = { cand: '#ffb24d', rej: '#ff5d73', ok: '#52e0a0' }[statusCls] || '#3ff0cf'; x.shadowColor = x.fillStyle; x.shadowBlur = 12; x.beginPath(); x.arc(fx, fy, 3, 0, 7); x.fill(); x.shadowBlur = 0;
    x.restore();
    x.font = '500 9.5px Mono'; x.fillStyle = 'rgba(63,240,207,.6)'; x.fillText('FREQUENCY →', 14, top + 12); x.fillText('TIME ↓', w - 58, top + 12);
  }
  let raf = 0;

  /* ----- choosing a simulation ----- */
  function choose(id) {
    const sc0 = SCENES.find(s => s.id === id); if (sc0 && locked(sc0)) { Pro.paywall('Pro simulations'); return; }
    if (id === choice && scene) return; choice = id; store.set('sim', id); autoI = 0; N.haptic(14); clearWF(); runScene(); paintChooser();
    toast(ALL.find(s => s.id === id).name);
  }
  function paintPill() {
    const s = choice === 'auto' ? AUTO : scene; if (!s) return;
    $('#simName').textContent = choice === 'auto' ? 'Auto · ' + scene.name : s.name; $('#simKind').textContent = scene.kind;
  }
  function paintChooser() {
    $('#simRow').innerHTML = ALL.map(s => `<button class="simc ${s.id === choice ? 'on' : ''} ${locked(s) ? 'lk' : ''}" data-s="${s.id}"><span class="si-ic">${s.icon}</span>${s.pro ? '<span class="pro-b sim-pb">PRO</span>' : ''}<b>${esc(s.name)}</b><small>${esc(s.sub)}</small><em>${esc(s.kind)}</em></button>`).join('');
    $$('#simRow .simc').forEach(b => b.onclick = () => { choose(b.dataset.s); dismissHint(); });
    const on = $('#simRow .simc.on'); if (on) { const r = $('#simRow'); r.scrollTo({ left: on.offsetLeft - 14, behavior: 'smooth' }); }
  }
  const simRowHtml = s => `<button class="simrow ${s.id === choice ? 'on' : ''} ${locked(s) ? 'lk' : ''}" data-s="${s.id}"><span class="si-ic">${s.icon}</span><div><b>${esc(s.name)}${s.pro ? ' <span class="pro-b">PRO</span>' : ''}</b><em>${esc(s.kind)}</em><p>${esc(s.desc)}</p></div><span class="tick">${s.id === choice ? '✓' : locked(s) ? '🔒' : ''}</span></button>`;
  function openChooser() {
    dismissHint();
    Sheet.open(`<h2>Choose a simulation</h2><p class="muted" style="font-size:13.5px;margin-bottom:10px">Pick what the dish at the top of Listen plays. Replays recreate real moments in the search; simulations show how it works. Everything else on this tab is real archive data.</p>` +
      `<div class="sim-count">${SCENES.length} simulations${S.pro ? '' : ' · ' + SCENES.filter(s => s.pro).length + ' with Sky Pro'}</div>` +
      [AUTO].map(simRowHtml).join('') + CATS.map(c => `<h3>${c[1]}</h3>` + SCENES.filter(s => s.cat === c[0]).map(simRowHtml).join('')).join(''), el => {
      $$('.simrow', el).forEach(b => b.onclick = () => { const s0 = SCENES.find(s => s.id === b.dataset.s); if (s0 && locked(s0)) { Pro.paywall('Pro simulations'); return; } choose(b.dataset.s); Sheet.close(); $('#v-listen').scrollTo({ top: 0, behavior: 'smooth' }); });
    });
  }
  function dismissHint() { const h = $('#simHint'); if (h) h.classList.remove('on'); $('#simPill').classList.remove('hint'); store.set('simHinted', true); }
  $('#simPill').onclick = openChooser; $('#simAll').onclick = openChooser;
  $('#lsExplore').onclick = () => Pro.explorer(); $('#lsLab').onclick = () => Pro.lab();
  paintChooser();

  /* ----- stats ----- */
  function stats() {
    const st = T.filter(t => t.k === 'star').length, gl = T.filter(t => t.k === 'galaxy').length, rec = T.reduce((a, t) => a + t.n, 0), nights = Object.keys(OBSDAYS).length;
    const nr = T.filter(t => t.ly).sort((a, b) => a.ly - b.ly)[0];
    const items = [[st, 'stars listened to'], [gl, 'nearby galaxies'], [rec, 'on-target recordings'], [nights, 'days with observations'], [nr.ly, 'ly to the nearest: ' + nr.nm, 1], [0, 'confirmed signals', 0, 'zero']];
    $('#lsStats').innerHTML = items.map(i => `<div class="stat ${i[3] || ''}"><b data-to="${i[0]}" data-d="${i[2] || 0}">0</b><small>${esc(i[1])}</small></div>`).join('');
  }
  function countUp() { $$('#lsStats b').forEach(b => { const to = +b.dataset.to, dec = +b.dataset.d, t0 = performance.now(); const f = n => { const p = clamp((n - t0) / 1400, 0, 1), e = 1 - Math.pow(1 - p, 4); b.textContent = dec ? (to * e).toFixed(dec) : fmtN(Math.round(to * e)); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }); }

  /* ----- above you now ----- */
  let sortBy = 'near', page = 0, list = [];
  const PER = 6;
  function above() {
    const M = horMatrix(new Date(), place().lat, place().lon);
    list = T.map(t => ({ t, h: altAz(M, t.ra, t.dec) })).filter(o => o.h.alt > 10 && o.t.k !== 'pulsar' && o.t.k !== 'object');
    $('#lsAboveN').textContent = fmtN(list.length) + ' targets up';
    list.sort(sortBy === 'near' ? (a, b) => (a.t.ly || 1e9) - (b.t.ly || 1e9) : sortBy === 'high' ? (a, b) => b.h.alt - a.h.alt : (a, b) => b.t.n - a.t.n);
    page = clamp(page, 0, Math.max(0, Math.ceil(list.length / PER) - 1)); drawPage(0);
  }
  function drawPage(dir) {
    const pages = Math.max(1, Math.ceil(list.length / PER)), el = $('#lsAbove');
    el.innerHTML = `<div class="pg-list ${dir > 0 ? 'in-r' : dir < 0 ? 'in-l' : ''}">` + list.slice(page * PER, page * PER + PER).map(o => `<button class="tr2" data-i="${idxOf.get(o.t)}"><span class="ring" style="--sc:${o.t.k === 'galaxy' ? '#ffb24d' : spColor(o.t.sp)}"></span><div class="nm"><b>${esc(setiName(o.t))}</b><small>${o.t.k === 'galaxy' ? 'Galaxy' : spWord(o.t.sp)} · ${CONS(o.t.c) || ''} · ${o.t.n} recordings</small></div><div class="r"><b>${o.t.ly ? o.t.ly + ' ly' : o.t.k === 'galaxy' ? '—' : '?'}</b>${Math.round(o.h.alt)}° ${compassS(o.h.az)}</div></button>`).join('') + '</div>' +
      (pages > 1 ? `<div class="pager"><button class="pb" id="pgFirst" ${page ? '' : 'disabled'} aria-label="First page"><svg viewBox="0 0 24 24"><path d="M17 6l-6 6 6 6M7 6v12"/></svg></button><button class="pb" id="pgPrev" ${page ? '' : 'disabled'} aria-label="Previous page"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button><span>Page <b>${page + 1}</b> of ${fmtN(pages)}</span><button class="pb" id="pgNext" ${page < pages - 1 ? '' : 'disabled'} aria-label="Next page"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button></div>` : '');
    $$('#lsAbove .tr2').forEach(b => b.onclick = () => target(T[+b.dataset.i]));
    const go = (np) => { np = clamp(np, 0, pages - 1); if (np === page) return; const d = np > page ? 1 : -1; page = np; N.haptic(8); drawPage(d); };
    const f = $('#pgFirst'), pv = $('#pgPrev'), nx = $('#pgNext');
    if (f) f.onclick = () => go(0); if (pv) pv.onclick = () => go(page - 1); if (nx) nx.onclick = () => go(page + 1);
    el._go = go;
  }
  (() => { const el = $('#lsAbove'); let x0 = null, y0 = 0;
    el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && el._go) el._go(page + (dx < 0 ? 1 : -1)); }); })();
  $$('#lsSort button').forEach(b => b.onclick = () => { sortBy = b.dataset.s; page = 0; $$('#lsSort button').forEach(x => x.classList.toggle('on', x === b)); above(); N.haptic(8); });

  /* ----- target sheet ----- */
  function target(t) {
    const i = idxOf.get(t), dates = (obsDates.get(i) || []).sort(), M = horMatrix(new Date(), place().lat, place().lon), h = altAz(M, t.ra, t.dec);
    let con = ''; try { con = A.Constellation(t.ra / 15, t.dec).name; } catch (e) {}
    const heard = t.ly ? 1920 + t.ly : null, reply = t.ly ? 1920 + 2 * t.ly : null;
    const band = (t.b.includes('L') ? 'L-band 1.1–1.9 GHz' : '') + (t.b.includes('L') && t.b.includes('S') ? ' and ' : '') + (t.b.includes('S') ? 'S-band 1.8–2.7 GHz' : '');
    // next time above 20 degrees
    let nextUp = null; if (h.alt < 20) for (let k = 1; k < 24 * 6; k++) { const d = new Date(Date.now() + k * 6e5); if (altAz(horMatrix(d, place().lat, place().lon), t.ra, t.dec).alt > 20) { nextUp = d; break; } }
    const kind = t.k === 'galaxy' ? 'Galaxy' : t.k === 'pulsar' ? 'Pulsar' : spWord(t.sp);
    Sheet.open(`<div class="seti-hi"><canvas id="tgC"></canvas><div><div class="eyebrow cy">Listened to</div><h2 style="margin:2px 0 0">${esc(setiName(t))}</h2><p>${esc(setiCode(t))} · ${esc(kind)} in ${esc(con)}</p></div></div>
      <div class="sgd"><div class="facts">
        <div><small>Distance</small><b>${t.ly ? t.ly + ' light-years' : t.k === 'galaxy' ? 'Millions of ly' : 'Unknown'}</b></div>
        <div><small>Type</small><b>${t.sp ? esc(t.sp) : esc(kind)}</b></div>
        <div><small>Recordings</small><b>${t.n} at Green Bank</b></div>
        <div><small>Right now</small><b>${h.alt > 0 ? Math.round(h.alt) + '° up, ' + compassS(h.az) : 'Below horizon'}</b></div>
      </div>
      ${t.ly ? `<div class="verdict" style="border-color:var(--cy)"><small style="color:var(--cy)">Light & time</small>The starlight reaching you tonight left it in <b>${Math.round(YEAR - t.ly)}</b>. ${heard < YEAR ? `Our first radio broadcasts washed over it around <b>${Math.round(heard)}</b>. If anyone there answered straight away, the reply ${reply < YEAR ? 'would already have arrived, in ' + Math.round(reply) : 'would reach Earth around <b>' + Math.round(reply) + '</b>'}.` : `Our earliest broadcasts will not reach it until <b>${Math.round(heard)}</b>.`}</div>` : ''}
      <h3>Listening log</h3><p style="margin:0 0 8px;font-size:13.5px;color:var(--tx2)">Breakthrough Listen pointed the 100 m Green Bank Telescope here on ${dates.length} day${dates.length === 1 ? '' : 's'}, in ${band}. Each pointing is paired with "OFF" pointings at nearby empty sky, so a signal that also shows up there can be ruled out as Earth's own noise.</p>
      ${dates.slice(0, 12).map(d => `<div class="ev"><i style="background:var(--cy)"></i><div>${fDm(new Date(d + 'T12:00:00Z'))}<small>${OBSDAYS[d].length} targets observed that day</small></div></div>`).join('')}${dates.length > 12 ? `<p class="muted" style="font-size:12px;margin-top:6px">and ${dates.length - 12} more days</p>` : ''}
      <div class="verdict" style="border-color:var(--grn)"><small style="color:var(--grn)">Result</small>No signal from this target has been confirmed. Every candidate in the published Green Bank searches was traced to human-made interference.</div>
      ${nextUp ? `<p class="muted" style="font-size:13px">Climbs above 20° ${relDay(nextUp).toLowerCase() === 'today' ? 'today' : relDay(nextUp)} at ${fT(nextUp)}.</p>` : ''}
      <button class="btn cy" id="tgSky">Show in the sky</button> <button class="btn" id="tgFav">${Pro.isFav(t) ? '★ Favourite' : '☆ Favourite'}${S.pro ? '' : ' ' + Pro.BADGE}</button> <button class="btn" id="tgCard">Share card${S.pro ? '' : ' ' + Pro.BADGE}</button> <button class="btn" id="tgShare">Share text</button></div>`, el => {
      $('#tgFav', el).onclick = Pro.gate('SETI', () => { const on = Pro.toggleFav(t); $('#tgFav', el).textContent = on ? '★ Favourite' : '☆ Favourite'; toast(on ? 'Added to favourites' : 'Removed from favourites'); });
      $('#tgCard', el).onclick = () => Pro.shareCard(t);
      ringAnim($('#tgC', el), t.k === 'galaxy' ? '#ffb24d' : spColor(t.sp));
      $('#tgSky', el).onclick = () => { Sheet.close(); App.go('sky'); SkyMap.focus({ ra: t.ra, dec: t.dec, seti: t }); };
      $('#tgShare', el).onclick = () => N.share(`${setiName(t)}${t.ly ? ', ' + t.ly + ' light-years away,' : ''} was listened to ${t.n} times by Breakthrough Listen's search for alien signals. Found with Sky.`);
    });
  }

  /* ----- radio bubble 3D ----- */
  const bb = $('#bbC'); let bbPts = null, bbRaf = 0, bbT0 = performance.now(), bbDrag = null, bbYaw = 0, bbPitch = .9;
  function bubbleData() {
    const near = T.filter(t => t.ly && t.ly < 160).map(t => { const d = t.ly, r = t.ra * D2R, de = t.dec * D2R; return { t, p: [d * Math.cos(de) * Math.cos(r), d * Math.cos(de) * Math.sin(r), d * Math.sin(de)] }; });
    const inside = near.filter(o => o.t.ly < BUB);
    $('#bbYears').textContent = BUB + ' light-years and growing';
    const n1 = inside.sort((a, b) => a.t.ly - b.t.ly)[0];
    $('#bbTxt').innerHTML = `Our radio leakage started around 1920, so it is now about <b>${BUB} light-years</b> out. <b>${fmtN(T.filter(t => t.ly && t.ly < BUB).length)}</b> of the stars Breakthrough Listen checked sit inside that bubble, close enough to have heard us already. The nearest, <b>${esc(setiName(n1.t))}</b>, would have caught our first broadcasts around ${Math.round(1920 + n1.t.ly)}. Drag to turn it.`;
    bbPts = near;
  }
  function bubbleFrame(now) {
    bbRaf = requestAnimationFrame(bubbleFrame); if (S.view !== 'listen' || !bbPts) return;
    const r = bb.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
    const { x, w, h } = hidpi(bb), t = (now - bbT0) / 1000;
    if (!bbDrag) bbYaw += .0025;
    const sc = Math.min(w, h) / 2 / 165, cx = w / 2, cy = h / 2, cy1 = Math.cos(bbYaw), sy = Math.sin(bbYaw), cp = Math.cos(bbPitch), sp = Math.sin(bbPitch);
    const P = p => { const X = p[0] * cy1 - p[1] * sy, Y = p[0] * sy + p[1] * cy1, Z = p[2]; const y2 = Y * cp - Z * sp, z2 = Y * sp + Z * cp; const f = 600 / (600 + z2 * sc * .8); return [cx + X * sc * f, cy + y2 * sc * f * .95, z2, f]; };
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * .7); g.addColorStop(0, '#08142a'); g.addColorStop(1, '#02040b'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    // rings (galactic-ish plane grid)
    x.strokeStyle = 'rgba(120,150,220,.12)'; x.lineWidth = 1;
    for (const rr of [50, 100, 150]) { x.beginPath(); for (let a = 0; a <= 64; a++) { const q = P([rr * Math.cos(a / 64 * 6.283), rr * Math.sin(a / 64 * 6.283), 0]); a ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); } x.stroke(); const q = P([rr, 0, 0]); x.font = '400 9px Mono'; x.fillStyle = 'rgba(150,170,230,.4)'; x.fillText(rr + ' ly', q[0] + 3, q[1]); }
    // bubble sphere
    const bR = BUB * sc; const sg = x.createRadialGradient(cx, cy, bR * .2, cx, cy, bR); sg.addColorStop(0, 'rgba(63,240,207,.02)'); sg.addColorStop(.92, 'rgba(63,240,207,.09)'); sg.addColorStop(1, 'rgba(63,240,207,.28)');
    x.fillStyle = sg; x.beginPath(); x.arc(cx, cy, bR, 0, 7); x.fill();
    x.strokeStyle = 'rgba(63,240,207,.55)'; x.lineWidth = 1.2; x.beginPath(); x.arc(cx, cy, bR, 0, 7); x.stroke();
    for (let k = 0; k < 3; k++) { const p = ((t / 4) + k / 3) % 1; x.strokeStyle = `rgba(63,240,207,${(1 - p) * .35})`; x.beginPath(); x.arc(cx, cy, p * bR, 0, 7); x.stroke(); }
    // stars
    const q = bbPts.map(o => [P(o.p), o]).sort((a, b) => b[0][2] - a[0][2]);
    for (const [pp, o] of q) { const ins = o.t.ly < BUB; x.fillStyle = ins ? spColor(o.t.sp) : 'rgba(150,160,190,.5)'; x.globalAlpha = clamp(.35 + pp[3] * .5, .2, 1) * (ins ? 1 : .55); x.beginPath(); x.arc(pp[0], pp[1], (ins ? 1.6 : 1.1) * pp[3], 0, 7); x.fill(); }
    x.globalAlpha = 1;
    for (const [pp, o] of q) if (o.t.nm && o.t.ly < 12) { x.font = '500 9.5px Inter'; x.fillStyle = 'rgba(220,240,255,.8)'; x.fillText(o.t.nm, pp[0] + 4, pp[1] - 3); }
    // sun
    x.fillStyle = '#ffe9a8'; x.shadowColor = '#ffd27a'; x.shadowBlur = 14; x.beginPath(); x.arc(cx, cy, 3.5, 0, 7); x.fill(); x.shadowBlur = 0;
    x.font = '600 10px Inter'; x.fillStyle = '#ffe9a8'; x.fillText('Sun', cx + 6, cy + 12);
  }
  bb.addEventListener('pointerdown', e => { bbDrag = [e.clientX, e.clientY]; bb.setPointerCapture(e.pointerId); });
  bb.addEventListener('pointermove', e => { if (!bbDrag) return; bbYaw -= (e.clientX - bbDrag[0]) * .01; bbPitch = clamp(bbPitch + (e.clientY - bbDrag[1]) * .01, .1, 1.5); bbDrag = [e.clientX, e.clientY]; });
  bb.addEventListener('pointerup', () => bbDrag = null); bb.addEventListener('pointercancel', () => bbDrag = null);
  bb.style.touchAction = 'pan-y';

  /* ----- real recording ----- */
  const WFS = [
    { f: 'img/wf_z0.png', c: 1420.382, cap: '<b>The hydrogen line, 1420.4 MHz.</b> The bright band is real radio emission from cold hydrogen gas in our own Milky Way, caught behind the target star. It splits into two peaks because separate gas clouds are moving at different speeds. Hydrogen is the most common element there is, which is why the first SETI searches listened at exactly this frequency.' },
    { f: 'img/wf_z1.png', c: 1374.975, cap: '<b>A man-made line at 1374.97 MHz.</b> One razor-thin, perfectly vertical streak: it never drifts. A transmitter on another planet would slide across frequency as that planet spins and orbits. A signal that holds dead steady is moving with us, which means it is on or near Earth.' },
    { f: 'img/wf_z2.png', c: 1447.216, cap: '<b>Steady line on a noise hump, 1447.2 MHz.</b> Another zero-drift line sitting on a broad patch of interference. The horizontal stripes across every panel are the receiver itself changing gain during the five-minute recording.' },
    { f: 'img/wf_z3.png', c: 1426.613, cap: '<b>Two faint lines near 1426.6 MHz.</b> Just above the hydrogen line, two weak steady tones. Searches flag thousands of these per star; the pipeline throws out every one that also appears in the OFF pointings.' }];
  const imgs = WFS.map(w => { const i = new Image(); i.src = w.f; return i; });
  function paintWF(c, img, cfreq) {
    const big = c.id === 'wfMainC', W0 = big ? c.clientWidth : 64, H0 = big ? c.clientHeight : 64; const { x, w, h } = hidpi(c, W0, H0);
    const o = document.createElement('canvas'); o.width = img.naturalWidth || 256; o.height = img.naturalHeight || 256; const ox = o.getContext('2d'); ox.drawImage(img, 0, 0);
    let d; try { d = ox.getImageData(0, 0, o.width, o.height); } catch (e) { x.drawImage(img, 0, 0, w, h); return; } for (let i = 0; i < d.data.length; i += 4) { const c3 = CMAP[d.data[i]]; d.data[i] = c3[0]; d.data[i + 1] = c3[1]; d.data[i + 2] = c3[2]; } ox.putImageData(d, 0, 0);
    x.imageSmoothingEnabled = true; x.drawImage(o, 0, 0, w, h);
    if (big) { x.font = '500 10px Mono'; x.fillStyle = 'rgba(200,255,240,.85)'; const half = 128 * .00286;
      x.fillText((cfreq + half).toFixed(3), 6, h - 8); x.textAlign = 'right'; x.fillText((cfreq - half).toFixed(3) + ' MHz', w - 6, h - 8); x.textAlign = 'left';
      x.fillText('0 s', 6, 14); x.fillText('↓ 293 s', 6, 28); }
  }
  let wfSel = 0;
  function realWF() {
    $('#wfThumbs').innerHTML = WFS.map((w, i) => `<button data-i="${i}" class="${i === wfSel ? 'on' : ''}"><canvas></canvas></button>`).join('');
    const draw = () => { $$('#wfThumbs canvas').forEach((c, i) => imgs[i].complete && paintWF(c, imgs[i], WFS[i].c)); if (imgs[wfSel].complete) paintWF($('#wfMainC'), imgs[wfSel], WFS[wfSel].c); $('#wfCap').innerHTML = WFS[wfSel].cap; };
    imgs.forEach(i => i.onload = draw); draw();
    $$('#wfThumbs button').forEach(b => b.onclick = () => { wfSel = +b.dataset.i; $$('#wfThumbs button').forEach(x => x.classList.toggle('on', x === b)); draw(); N.haptic(8); });
  }

  /* ----- Drake ----- */
  const DK = [
    ['R', 'New stars per year in the Milky Way', 0, 1.3, .01, v => Math.pow(10, v), v => v.toFixed(1), Math.log10(1.5)],
    ['fp', 'Share of stars with planets', 0, 1, .01, v => v, v => Math.round(v * 100) + '%', 1],
    ['ne', 'Habitable planets per system', -2, .7, .01, v => Math.pow(10, v), v => v.toFixed(2), Math.log10(.2)],
    ['fl', 'Where life starts', -4, 0, .01, v => Math.pow(10, v), v => pct(v), Math.log10(.1)],
    ['fi', 'Where life becomes intelligent', -4, 0, .01, v => Math.pow(10, v), v => pct(v), Math.log10(.01)],
    ['fc', 'Intelligence that builds radio', -2, 0, .01, v => Math.pow(10, v), v => pct(v), Math.log10(.1)],
    ['L', 'Years a civilisation keeps transmitting', 2, 8, .01, v => Math.pow(10, v), v => v >= 1e6 ? (v / 1e6).toFixed(v < 1e7 ? 1 : 0) + ' million' : fmtN(Math.round(v)), 4]];
  function pct(v) { return v >= .01 ? (v * 100).toFixed(v < .1 ? 1 : 0) + '%' : '1 in ' + fmtN(Math.round(1 / v)); }
  const PRE = { 'Drake, 1961': [0, .35, Math.log10(3), 0, 0, Math.log10(.15), 4], 'Optimist': [Math.log10(3), 1, Math.log10(.4), 0, Math.log10(.5), Math.log10(.5), 6], 'Pessimist': [0, .5, Math.log10(.05), -3, -3, -1, 2.7] };
  let dv = DK.map(d => d[7]);
  function drake() {
    $('#drake').innerHTML = `<div class="presets">${Object.keys(PRE).map(k => `<button data-p="${k}">${k}</button>`).join('')}</div>` + DK.map((d, i) => `<div class="dk"><label>${d[1]}<b id="dkv${i}"></b></label><input type="range" min="${d[2]}" max="${d[3]}" step="${d[4]}" value="${dv[i]}" data-i="${i}"></div>`).join('') + `<div class="dres"><div class="n" id="dkN"></div><p id="dkT"></p></div>`;
    $$('#drake input').forEach(r => r.oninput = () => { dv[+r.dataset.i] = +r.value; calc(); });
    $$('#drake [data-p]').forEach(b => b.onclick = () => { dv = PRE[b.dataset.p].slice(); $$('#drake input').forEach((r, i) => r.value = dv[i]); calc(); N.haptic(10); });
    calc();
  }
  function calc() {
    let n = 1; DK.forEach((d, i) => { const v = d[5](dv[i]); n *= v; $('#dkv' + i).textContent = d[6](v); });
    $('#dkN').textContent = n >= 100 ? fmtN(Math.round(n)) : n >= 1 ? n.toFixed(1) : n.toPrecision(2);
    const sp = 88600 / Math.sqrt(Math.max(n, 1e-9));
    $('#dkT').innerHTML = n < 1 ? `Fewer than one at a time: on these numbers we are most likely <b>alone in the galaxy right now</b>, even if others came before us or will come after.` :
      `civilisations transmitting in the Milky Way right now. The nearest would be roughly <b>${fmtN(Math.round(sp / 100) * 100)} light-years</b> away, so one hello and one reply would take <b>${fmtN(Math.round(sp * 2 / 100) * 100)} years</b>.${sp > BUB ? ' Our own signals have not reached them yet.' : ''}`;
  }

  let built = false;
  return {
    repaint() { if (locked(SCENES.find(s => s.id === choice) || {})) { choice = 'typical'; store.set('sim', 'typical'); if (scene) { clearWF(); runScene(); } } paintChooser(); },
    show() {
      if (!built) { built = true; stats(); try { realWF(); } catch (e) {} drake();
        if (!store.get('simHinted', false)) { $('#simPill').classList.add('hint'); setTimeout(() => $('#simHint').classList.add('on'), 1200); setTimeout(dismissHint, 9000); } }
      countUp(); above(); bubbleData(); Pro.renderFavs();
      if (!raf) raf = requestAnimationFrame(frame); if (!bbRaf) bbRaf = requestAnimationFrame(bubbleFrame);
    },
    placeChanged() { queue = []; if (S.view === 'listen') above(); },
    target
  };
})();
