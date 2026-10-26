'use strict';
/* ---------- Signals: case files ---------- */
const Signals = (() => {
  const Y = new Date().getFullYear();
  const C = [
    { id: 'wow', n: 'The Wow! signal', yr: 1977, st: 'open', sl: 'Unexplained', viz: 'wow', ra: 291.38, dec: -26.95,
      f: [['Date', '15 Aug 1977'], ['Telescope', 'Big Ear, Ohio'], ['Frequency', '≈1420 MHz'], ['Lasted', '72 seconds']],
      sum: 'A narrow, powerful burst right next to the hydrogen line. It never came back.',
      txt: ['Big Ear did not steer: it let Earth\'s rotation sweep the sky past it, so anything fixed among the stars would rise and fall in strength over exactly 72 seconds. On the night of 15 August 1977 something did precisely that, on a single narrow channel close to 1420 MHz, the frequency SETI pioneers had argued a civilisation would choose.', 'Days later, volunteer Jerry Ehman was reading the computer printout. The intensity column climbed through the letters 6EQUJ5, the strongest reading the system could show. He circled it and wrote "Wow!" in the margin.', 'Astronomers have pointed telescopes back at that patch of Sagittarius dozens of times since, including with far more sensitive instruments. Nothing has ever been heard there again.'],
      v: 'Still unexplained. A 2024 study suggested a natural trigger, a cold hydrogen cloud briefly brightened by a flare from a passing magnetar, but it remains a hypothesis. A one-off signal cannot be confirmed, so it cannot be ruled in or out.' },
    { id: 'blc1', n: 'BLC1 from Proxima Centauri', yr: 2019, st: 'closed', sl: 'Solved: interference', viz: 'narrow', ra: 217.43, dec: -62.68,
      f: [['Date', 'Apr–May 2019'], ['Telescope', 'Parkes (Murriyang)'], ['Frequency', '982.002 MHz'], ['Distance', '4.2 light-years']],
      sum: 'The best candidate Breakthrough Listen ever found, from the nearest star to the Sun.',
      txt: ['While Parkes watched Proxima Centauri for stellar flares, Breakthrough Listen\'s pipeline flagged a narrow tone at 982 MHz that drifted slowly in frequency, just as a transmitter on an orbiting planet would. Better still, it seemed to appear only when the dish pointed at Proxima and vanish when it looked away.', 'It became "Breakthrough Listen Candidate 1". When the story leaked in December 2020 it made headlines worldwide.'],
      v: 'In October 2021 the team published the verdict: BLC1 was an intermodulation product, two ordinary Earth-based signals mixing in electronics to create a phantom. They found dozens of lookalikes at other frequencies, related by simple maths to known local interference.' },
    { id: 'lgm1', n: 'LGM-1: Little Green Men', yr: 1967, st: 'closed', sl: 'Solved: pulsar', viz: 'pulsar', ra: 290.44, dec: 21.88,
      f: [['Date', 'Nov 1967'], ['Telescope', 'Cambridge, UK'], ['Frequency', '81.5 MHz'], ['Repeats', 'every 1.337 s']],
      sum: 'A pulse so regular it was half-jokingly labelled Little Green Men 1.',
      txt: ['Graduate student Jocelyn Bell Burnell spotted a small patch of "scruff" on kilometres of chart-recorder paper. Zoomed in, it was a train of pulses arriving every 1.337 seconds with clock-like precision. Nothing natural was known to do that.', 'The team privately nicknamed it LGM-1, for Little Green Men, while they checked for faults and interference.'],
      v: 'It was the first pulsar ever found: a collapsed star the size of a city, spinning and sweeping a radio beam past Earth like a lighthouse. The discovery won the 1974 Nobel Prize in Physics.' },
    { id: 'peryton', n: 'Perytons: the kitchen mystery', yr: 1998, st: 'closed', sl: 'Solved: microwave oven', viz: 'peryton', ra: null,
      f: [['Seen', '1998–2015'], ['Telescope', 'Parkes, Australia'], ['Frequency', '≈1.4 GHz'], ['Lasted', 'milliseconds']],
      sum: 'Millisecond radio chirps that looked like cosmic bursts and appeared all over the sky.',
      txt: ['For 17 years Parkes kept recording brief radio chirps that swept down in frequency, a lot like the newly discovered fast radio bursts from deep space. They were named perytons, after a mythical creature that casts the shadow of something else.', 'Odd details nagged: they showed up in every beam at once and clustered around lunchtime on weekdays.'],
      v: 'In 2015 astronomers caught one in the act: someone opening the door of the staff microwave oven before the timer finished. The magnetron\'s dying burst leaked out of the building and into the dish.' },
    { id: 'lorimer', n: 'The Lorimer burst', yr: 2007, st: 'half', sl: 'Natural, partly solved', viz: 'frb', ra: 19.5, dec: -75.2,
      f: [['Found', '2007 (2001 data)'], ['Telescope', 'Parkes, Australia'], ['Frequency', '≈1.4 GHz'], ['Lasted', '5 milliseconds']],
      sum: 'The first fast radio burst: more energy in 5 ms than the Sun gives out in days.',
      txt: ['Combing archive data, Duncan Lorimer\'s team found a single, enormously bright flash lasting five thousandths of a second. Its lower frequencies arrived later than the higher ones, the tell-tale smear caused by travelling through billions of light-years of thin intergalactic gas.', 'Thousands of fast radio bursts are now known. Some repeat; most have been seen only once.'],
      v: 'Natural. In 2020 a burst was caught coming from a magnetar inside our own galaxy, so at least some come from these ultra-magnetic dead stars. What powers all the rest is still debated.' },
    { id: 'shgb', n: 'SHGb02+14a', yr: 2003, st: 'half', sl: 'Probably noise', viz: 'narrow2', ra: 27.5, dec: 14,
      f: [['Date', '2003'], ['Source', 'SETI@home, Arecibo'], ['Frequency', '≈1420 MHz'], ['Seen', '3 times']],
      sum: 'Found by millions of home computers, then seen again on the same spot.',
      txt: ['SETI@home farmed Arecibo data out to volunteers\' screensavers. One candidate between Pisces and Aries stood out because it turned up in three separate observations, near the hydrogen line.', 'But the signal drifted in frequency very fast, far faster than any planet\'s motion would explain, and it was weak.'],
      v: 'The project\'s scientists considered it most likely a chance coincidence of noise, the kind you expect when you search billions of channels. It was never seen again.' },
    { id: 'hd164595', n: 'HD 164595', yr: 2015, st: 'closed', sl: 'Solved: Earth origin', viz: 'blip', ra: 270.16, dec: 29.57,
      f: [['Date', 'May 2015'], ['Telescope', 'RATAN-600, Russia'], ['Frequency', '≈11 GHz'], ['Distance', '94 light-years']],
      sum: 'A strong spike from a Sun-like star with a known planet.',
      txt: ['A Russian radio telescope recorded a single strong spike while scanning a Sun-like star in Hercules. When it became public in August 2016, Breakthrough Listen turned the Green Bank Telescope on the star, and the SETI Institute used its Allen Telescope Array.', 'Neither heard anything. The original public archive this app uses even contains Green Bank\'s follow-up files.'],
      v: 'The team that recorded it later concluded it was most likely terrestrial interference.' },
    { id: 'ross128', n: 'The Ross 128 "Weird!" signal', yr: 2017, st: 'closed', sl: 'Solved: satellites', viz: 'pulses', ra: 176.94, dec: 0.8, link: 'GJ447',
      f: [['Date', 'May 2017'], ['Telescope', 'Arecibo'], ['Frequency', '4–5 GHz'], ['Distance', '11 light-years']],
      sum: 'Quasi-periodic pulses from a quiet red dwarf next door.',
      txt: ['Researchers studying red dwarfs at Arecibo saw a peculiar pattern of broad pulses during a ten-minute look at Ross 128, and published it light-heartedly as the "Weird!" signal.', 'Ross 128 is also on Breakthrough Listen\'s list: Green Bank recorded it 18 times in 2016.'],
      v: 'The best explanation: transmissions from geostationary satellites sitting in that part of the sky.' },
    { id: 'tabby', n: 'Tabby\'s Star', yr: 2015, st: 'closed', sl: 'Mostly solved: dust', viz: 'dip', ra: 301.56, dec: 44.46, link: 'KIC8462852',
      f: [['Found', '2015'], ['Telescope', 'Kepler (optical)'], ['Dimming', 'up to 22%'], ['Distance', '≈1,470 light-years']],
      sum: 'A star that dimmed in ways no planet could explain, sparking "alien megastructure" talk.',
      txt: ['Citizen scientists spotted that KIC 8462852 sometimes dimmed by up to a fifth, irregularly, for days at a time. A planet blocks a percent or two on a strict schedule. Speculation about vast structures orbiting it went global.', 'Breakthrough Listen pointed Green Bank at it repeatedly. They heard nothing.'],
      v: 'Later observations found the dips are deeper in blue light than red, the signature of fine dust rather than anything solid. Where so much dust comes from is still debated.' },
    { id: 'ml', n: 'Eight signals found by AI', yr: 2023, st: 'half', sl: 'Unconfirmed', viz: 'narrow3', ra: null,
      f: [['Published', 'Jan 2023'], ['Data', 'Green Bank archive'], ['Stars', '820 searched'], ['Found', '8 signals']],
      sum: 'A neural network reran old Green Bank data and flagged eight new signals of interest.',
      txt: ['A student-led team trained a machine-learning model to spot what a real technosignature should look like and set it loose on the Breakthrough Listen Green Bank data. It found eight drifting signals that appeared ON-target and disappeared OFF-target, exactly the pattern searchers want.'],
      v: 'Follow-up observations of all five stars involved found nothing. They are most likely rare interference, but the method is now part of the toolkit.' },
    { id: 'oumuamua', n: 'ʻOumuamua', yr: 2017, st: 'closed', sl: 'Natural', viz: 'quiet', ra: null, link: 'OUMUAMUA',
      f: [['Date', 'Dec 2017'], ['Telescope', 'Green Bank'], ['Bands', '1–12 GHz'], ['Object', 'interstellar']],
      sum: 'The first visitor from another star system got a listen as it left.',
      txt: ['A cigar- or pancake-shaped object tumbling through the solar system on a path that proved it came from interstellar space. It also sped up slightly as it left, which fed speculation it might be artificial.', 'Breakthrough Listen listened with Green Bank across four radio bands. It is in the public archive index this app uses.'],
      v: 'No signal. Most astronomers think it was a natural fragment, its push explained by gas escaping as it warmed.' },
    { id: 'voyager', n: 'Voyager 1, heard from Earth', yr: 2015, st: 'closed', sl: 'Ours', viz: 'voyager', ra: 258.3, dec: 12,
      f: [['Test', 'Breakthrough Listen'], ['Telescope', 'Green Bank'], ['Frequency', '8.4 GHz'], ['Transmitter', '23 watts']],
      sum: 'What a real alien transmitter would look like: our own spacecraft, beyond the planets.',
      txt: ['To prove the system works, Breakthrough Listen pointed Green Bank at Voyager 1, launched in 1977 and now in interstellar space more than 25 billion kilometres away.', 'Its tiny transmitter, about as powerful as a fridge light bulb, showed up as a bright carrier with sidebands, drifting as Earth turned. Exactly the kind of signal the search is built to catch.'],
      v: 'A human-made spacecraft. It is proof that if someone out there were doing what we do, the method would see it.' },
    { id: 'arecibo', n: 'The Arecibo message', yr: 1974, st: 'sent', sl: 'We sent', viz: 'bits', ra: 250.42, dec: 36.46, dist: 22200, sent: 1974.87,
      f: [['Sent', '16 Nov 1974'], ['From', 'Arecibo, Puerto Rico'], ['Frequency', '2380 MHz'], ['Size', '1,679 bits']],
      sum: 'Three minutes of binary aimed at a cluster of 300,000 stars.',
      txt: ['To celebrate an upgrade, Arecibo beamed a picture made of 1,679 bits, a product of two primes so it can only be laid out as 23 by 73. It showed numbers, DNA, a human figure, the solar system and the telescope itself.', 'It was aimed at the globular cluster M13, mostly as a demonstration.'],
      v: 'Still travelling. It reaches M13 in about 22,000 years, by which time the cluster will have drifted a little from where it was aimed.' },
    { id: 'golden', n: 'The Golden Records', yr: 1977, st: 'sent', sl: 'We sent', viz: 'record', ra: 258.3, dec: 12,
      f: [['Launched', 'Aug & Sep 1977'], ['On board', 'Voyager 1 and 2'], ['Contents', 'sounds, music, images'], ['Speed', '≈17 km/s']],
      sum: 'Gold-plated records carrying greetings in 55 languages and music from around the world.',
      txt: ['Each Voyager carries a copper record with a stylus and instructions etched on its cover, explaining how to play it in the language of physics.', 'It is the slowest message we have ever sent: it will take tens of thousands of years even to pass near another star.'],
      v: 'Still travelling, now in interstellar space. The spacecraft\'s power is expected to run out within a few years; the records will outlast Earth\'s continents.' },
    { id: 'beatles', n: 'Across the Universe', yr: 2008, st: 'sent', sl: 'We sent', viz: 'beam', ra: 37.95, dec: 89.26, dist: 433, sent: 2008.1,
      f: [['Sent', '4 Feb 2008'], ['From', 'NASA Deep Space Network'], ['Target', 'Polaris'], ['Distance', '433 light-years']],
      sum: 'NASA beamed the Beatles song toward the North Star.',
      txt: ['To mark the song\'s 40th anniversary, NASA transmitted "Across the Universe" from its Madrid antenna toward Polaris, the North Star.'],
      v: 'Still travelling. It arrives around the year 2441.' },
    { id: 'gliese581', n: 'A Message From Earth', yr: 2008, st: 'sent', sl: 'We sent', viz: 'beam', ra: 229.86, dec: -7.72, dist: 20.4, sent: 2008.78, link: 'HIP74995',
      f: [['Sent', 'Oct 2008'], ['From', 'RT-70, Yevpatoria'], ['Target', 'Gliese 581'], ['Contents', '501 messages']],
      sum: 'Messages from the public, beamed at a red dwarf with planets.',
      txt: ['Five hundred and one messages, photos and drawings submitted through a social network were transmitted toward Gliese 581, a red dwarf 20 light-years away then thought to have a possibly habitable planet.', 'Breakthrough Listen later listened to the same star with Green Bank, 18 times in 2016.'],
      v: 'Arrives around 2029. A reply, if anyone sent one immediately, could reach Earth around 2049.' }];

  let filter = 'all';
  function list() {
    const L = C.filter(c => filter === 'all' || (filter === 'open' ? c.st === 'open' || c.st === 'half' : filter === 'closed' ? c.st === 'closed' : c.st === 'sent'));
    $('#sgList').innerHTML = L.map(c => `<button class="card sg" data-id="${c.id}"><canvas data-viz="${c.viz}"></canvas><div class="bd"><span class="yr">${c.yr}</span><b>${esc(c.n)}</b><p>${esc(c.sum)}</p><span class="stamp ${c.st}">${c.sl}</span></div></button>`).join('');
    $$('#sgList .sg').forEach(b => b.onclick = () => open(C.find(c => c.id === b.dataset.id)));
    minis = $$('#sgList canvas').map(cv => ({ cv, viz: cv.dataset.viz, seed: Math.random() * 100 }));
  }
  $$('#sgFilter button').forEach(b => b.onclick = () => { filter = b.dataset.f; $$('#sgFilter button').forEach(x => x.classList.toggle('on', x === b)); list(); N.haptic(8); });

  /* visuals */
  function viz(x, w, h, kind, t, seed, big) {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    const r = rng(Math.floor(seed * 1000) + Math.floor(t * 8));
    const noise = (a = .18) => { const n = big ? 900 : 260; for (let i = 0; i < n; i++) { const v = Math.pow(r(), 3) * a; const c = CMAP[Math.round(clamp(v + .05, 0, 1) * 255)]; x.fillStyle = `rgb(${c})`; x.fillRect(r() * w, r() * h, big ? 2 : 1.5, big ? 2 : 1.5); } };
    const line = (fn, col = '#bfffee', wd = 1.6) => { x.strokeStyle = col; x.lineWidth = wd; x.shadowColor = '#3ff0cf'; x.shadowBlur = 8; x.beginPath(); for (let y = 0; y <= h; y += 2) { const xx = fn(y / h); y ? x.lineTo(xx, y) : x.moveTo(xx, y); } x.stroke(); x.shadowBlur = 0; };
    const sc = (t * .25) % 1;
    if (kind === 'wow') {
      const code = '6EQUJ5', vals = [6, 14, 26, 30, 19, 5]; const bw = w / 8;
      x.fillStyle = '#060c06'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) { const p = clamp(t * .8 - i * .25, 0, 1); const bh = vals[i] / 30 * h * .62 * p; const gx = bw * (i + 1);
        const g = x.createLinearGradient(0, h, 0, h - bh); g.addColorStop(0, '#0b6e5e'); g.addColorStop(1, i === 3 ? '#ffffff' : '#3ff0cf'); x.fillStyle = g; x.fillRect(gx, h * .82 - bh, bw * .7, bh);
        x.fillStyle = `rgba(200,255,220,${p})`; x.font = `600 ${big ? 22 : 11}px Mono`; x.fillText(code[i], gx + bw * .12, h * .95); }
      if (t * .8 > 1.6) { x.strokeStyle = '#ff5d73'; x.lineWidth = big ? 3 : 1.5; x.beginPath(); x.ellipse(w * .53, h * .93 - (big ? 8 : 4), w * .42, h * .1, 0, 0, 7); x.stroke(); if (big) { x.font = 'italic 600 26px Sora'; x.fillStyle = '#ff5d73'; x.fillText('Wow!', w * .78, h * .3); } }
    } else if (kind === 'narrow' || kind === 'narrow2' || kind === 'narrow3') {
      noise(); const d = kind === 'narrow2' ? .5 : kind === 'narrow3' ? -.22 : .18, x0 = kind === 'narrow3' ? .7 : .35;
      line(y => w * (x0 + d * y) + Math.sin(y * 40 + t) * .3);
      if (kind === 'narrow') { x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1; [.14, .82].forEach(o => { x.beginPath(); x.moveTo(w * o, 0); x.lineTo(w * o, h); x.stroke(); }); }
    } else if (kind === 'pulsar') {
      x.fillStyle = '#020604'; x.fillRect(0, 0, w, h); x.strokeStyle = '#3ff0cf'; x.lineWidth = big ? 2 : 1.2; x.beginPath();
      for (let i = 0; i <= w; i++) { const ph = ((i / w * 5 - t * 1.3) % 1 + 1) % 1, v = Math.exp(-Math.pow((ph - .5) * 28, 2)) * (.7 + .3 * Math.sin(i * .9 + t * 7)) + (r() - .5) * .06; const y = h * .7 - v * h * .5; i ? x.lineTo(i, y) : x.moveTo(i, y); } x.stroke();
    } else if (kind === 'frb' || kind === 'peryton') {
      noise(.14); const p = (t * .35) % 1.4;
      line(y => { const f = 1 - y; return kind === 'frb' ? w * (.15 + .7 * (1 / Math.pow(.35 + f * .65, 2) - 1) / 7.2) + p * w * .0 : w * (.2 + .6 * y * y); }, `rgba(220,255,245,${clamp(1.2 - p, 0, 1)})`, 2.2);
      if (kind === 'peryton' && big) { x.font = '600 12px Mono'; x.fillStyle = '#ffb24d'; x.fillText('DOOR OPENED 12:42', 10, h - 12); }
    } else if (kind === 'blip') { noise(); const v = Math.exp(-Math.pow(((t * .4) % 1.2 - .5) * 8, 2)); x.fillStyle = `rgba(220,255,245,${v})`; x.shadowColor = '#3ff0cf'; x.shadowBlur = 16; x.fillRect(w * .45, h * .2, w * .1, h * .6); x.shadowBlur = 0; }
    else if (kind === 'pulses') { noise(.14); for (let k = 0; k < 6; k++) { const yy = ((k / 6 + t * .1) % 1) * h; x.fillStyle = 'rgba(200,255,240,.55)'; x.fillRect(0, yy, w, big ? 4 : 2); } }
    else if (kind === 'dip') {
      x.fillStyle = '#05070f'; x.fillRect(0, 0, w, h); x.strokeStyle = '#ffd27a'; x.lineWidth = big ? 2 : 1.3; x.beginPath();
      for (let i = 0; i <= w; i++) { const u = (i / w + t * .05) % 1; let v = 1 - .22 * Math.exp(-Math.pow((u - .3) * 40, 2)) - .15 * Math.exp(-Math.pow((u - .72) * 25, 2)) - .08 * Math.exp(-Math.pow((u - .78) * 60, 2)); v += (r() - .5) * .006; const y = h * (.2 + (1 - v) * 2.4); i ? x.lineTo(i, y) : x.moveTo(i, y); } x.stroke();
      x.fillStyle = 'rgba(255,210,122,.6)'; x.font = `500 ${big ? 11 : 8}px Mono`; x.fillText('BRIGHTNESS', 6, big ? 16 : 10);
    } else if (kind === 'quiet') { noise(.2); if (big) { x.font = '500 12px Mono'; x.fillStyle = 'rgba(160,200,200,.7)'; x.fillText('NO SIGNAL', w / 2 - 34, h / 2); } }
    else if (kind === 'voyager') { noise(.12); line(y => w * (.5 + .04 * y), '#ffffff', 2.4); [-.12, .12].forEach(o => line(y => w * (.5 + o + .04 * y), 'rgba(170,255,235,.6)', 1.1)); }
    else if (kind === 'bits') {
      x.fillStyle = '#05030f'; x.fillRect(0, 0, w, h); const cols = 23, rows = 73, cs = Math.min(w / cols, h / rows * 3.2), rr = rng(1679); const shown = Math.floor((t * 220) % (cols * rows + 300));
      for (let i = 0; i < Math.min(shown, cols * rows); i++) { const cx = i % cols, cy = Math.floor(i / cols); if (cy * cs > h) break; if (rr() < .38) { x.fillStyle = ['#ffffff', '#a68bff', '#3ff0cf', '#ffd27a', '#ff5d73'][Math.floor(cy / 6) % 5]; x.fillRect((w - cols * cs) / 2 + cx * cs, cy * cs, cs * .85, cs * .85); } }
      if (big) { x.font = '500 10px Mono'; x.fillStyle = 'rgba(200,190,255,.6)'; x.fillText('23 × 73 bits · pattern stylised', 8, h - 8); }
    } else if (kind === 'record') {
      x.fillStyle = '#08060a'; x.fillRect(0, 0, w, h); const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .42;
      const g = x.createRadialGradient(cx - R * .3, cy - R * .3, 0, cx, cy, R); g.addColorStop(0, '#ffe7a0'); g.addColorStop(.6, '#c99a3a'); g.addColorStop(1, '#7a5512'); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill();
      x.strokeStyle = 'rgba(90,60,10,.35)'; x.lineWidth = .6; for (let k = R * .35; k < R; k += big ? 3 : 2) { x.beginPath(); x.arc(cx, cy, k, 0, 7); x.stroke(); }
      x.save(); x.translate(cx, cy); x.rotate(t * .6); x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R, -.15, .15); x.fill(); x.restore();
      x.fillStyle = '#2a1d06'; x.beginPath(); x.arc(cx, cy, R * .12, 0, 7); x.fill();
    } else if (kind === 'beam') {
      x.fillStyle = '#04030c'; x.fillRect(0, 0, w, h); const ex = w * .14, ey = h * .78;
      x.fillStyle = '#3b6ee0'; x.beginPath(); x.arc(ex, ey, Math.min(w, h) * .07, 0, 7); x.fill();
      for (let k = 0; k < 5; k++) { const p = ((t * .35) + k / 5) % 1; x.strokeStyle = `rgba(166,139,255,${(1 - p) * .8})`; x.lineWidth = big ? 2 : 1.2; x.beginPath(); x.arc(ex, ey, p * Math.hypot(w, h) * .85, -1.15, -.35); x.stroke(); }
      x.fillStyle = '#fff'; x.shadowColor = '#fff'; x.shadowBlur = 10; x.beginPath(); x.arc(w * .86, h * .18, 2.5, 0, 7); x.fill(); x.shadowBlur = 0;
    }
  }
  let minis = [], raf = 0, t0 = performance.now(), bigC = null, bigK = null, bigT0 = 0;
  function frame(n) {
    raf = requestAnimationFrame(frame); const t = (n - t0) / 1000;
    if (S.view === 'signals') for (const m of minis) { const r = m.cv.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) continue; const { x, w, h } = hidpi(m.cv, 84, 84); viz(x, w, h, m.viz, t + m.seed, m.seed, false); }
    if (bigC && bigC.isConnected) { const { x, w, h } = hidpi(bigC); viz(x, w, h, bigK, (n - bigT0) / 1000, 3, true); }
  }

  function open(c) {
    const link = c.link ? SETIDATA.find(t => t.id === c.link) || (c.link === 'OUMUAMUA' ? window.OUMU : null) : null;
    let journey = '';
    if (c.st === 'sent' && c.dist) { const trav = Y + (new Date().getMonth() / 12) - c.sent, p = clamp(trav / c.dist, 0, 1), arr = c.sent + c.dist;
      journey = `<h3>The journey</h3><div class="dbar" style="height:12px"><i class="bs" style="left:0;width:${Math.max(p * 100, .6)}%;background:linear-gradient(90deg,#5b3fd6,#a68bff)"></i></div><div class="dlbl"><span>${Math.floor(c.sent)}</span><span>${(p * 100).toFixed(p < .01 ? 2 : 1)}% of the way</span><span>${arr > 3000 ? '≈ year ' + fmtN(Math.round(arr / 100) * 100) : Math.round(arr)}</span></div>`; }
    const col = { open: 'var(--red)', half: 'var(--amb)', closed: 'var(--grn)', sent: 'var(--vi)' }[c.st];
    Sheet.open(`<div class="sgd"><span class="stamp ${c.st}">${c.sl}</span><h2 style="margin-top:8px">${esc(c.n)}</h2><canvas class="big" id="sgBig"></canvas>
      <div class="facts">${c.f.map(f => `<div><small>${f[0]}</small><b>${esc(f[1])}</b></div>`).join('')}</div>
      ${c.txt.map(p => `<p>${esc(p)}</p>`).join('')}
      <div class="verdict" style="border-color:${col}"><small style="color:${col}">${c.st === 'sent' ? 'Status' : 'Verdict'}</small>${esc(c.v)}</div>
      ${journey}
      <div>${c.ra != null ? '<button class="btn cy" id="sgSky">Where in the sky</button> ' : ''}${link ? '<button class="btn" id="sgLog">Green Bank listening log</button>' : ''}</div></div>`, el => {
      bigC = $('#sgBig', el); bigK = c.viz; bigT0 = performance.now();
      const b = $('#sgSky', el); if (b) b.onclick = () => { Sheet.close(); App.go('sky'); SkyMap.focus({ ra: c.ra, dec: c.dec, label: c.n, tag: c.st === 'sent' ? 'Message target' : 'Case file · ' + c.yr, sub: c.sum }); };
      const l = $('#sgLog', el); if (l) l.onclick = () => Listen.target(link);
    });
    Sheet.onclose = () => { bigC = null; };
  }

  let built = false;
  return { show() { if (!built) { built = true; list(); } if (!raf) raf = requestAnimationFrame(frame); }, open, cases: C };
})();
