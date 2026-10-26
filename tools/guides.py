"""Guide articles for nearspace.app. Imported by build.py.
Eclipse and Moon figures were calculated with Astronomy Engine (python astronomy-engine) on 27 Oct 2026."""

GUIDES = [
# --------------------------------------------------------------------------------------------- ISS
dict(slug='see-the-iss', app='overhead',
 title='How to See the International Space Station (ISS) Tonight',
 short='How to see the ISS',
 desc='When and where to look for the International Space Station, why you can only see it at dawn and dusk, and how to know which passes are worth going outside for.',
 lede="The International Space Station is the third-brightest thing in the night sky after the Moon and Venus, and you don't need a telescope to see it. Here is when to look, where to look, and what you'll see.",
 body='''
<h2>What you will see</h2>
<p>The ISS looks like a bright, steady white light moving smoothly across the sky. It doesn't blink and has no coloured lights, which is how you tell it apart from a plane. A good pass takes four to six minutes from one side of the sky to the other, and the brightest ones outshine every star.</p>
<p>The station orbits about 420 km up at around 28,000 km/h, going round the Earth roughly every 92 minutes. It passes over most of the populated world, between about 52° north and 52° south.</p>

<h2>Why only at dawn and dusk</h2>
<p>The ISS doesn't make its own light. You see it because it reflects sunlight. That only works when your sky is dark but the station, high above you, is still in sunshine. This happens in the hour or two after sunset and before sunrise.</p>
<p>In the middle of the night the station is usually in Earth's shadow and invisible, even when it passes straight overhead. Sometimes you'll see it fade out mid-sky as it enters the shadow.</p>
<p>Around midsummer the Sun never sets far below the horizon at higher latitudes, so the station stays lit all night. That is why the UK, Ireland and northern Europe get runs of visible passes all night long in June.</p>

<h2>Which passes are worth it</h2>
<ul>
<li><strong>Height:</strong> how high the station climbs, in degrees above the horizon. Above 40° is good; near 90° means almost straight overhead. Low passes are dimmer and easily hidden by buildings and trees.</li>
<li><strong>Brightness:</strong> given as a magnitude, where lower is brighter. Magnitude −3 or below is dazzling; around 0 is still easy to see; above +2 is faint in a town.</li>
<li><strong>Darkness:</strong> the darker your sky, the better. Passes right after sunset against a blue twilight sky are harder to spot.</li>
<li><strong>Cloud and Moon:</strong> obvious, but worth checking before you go out.</li>
</ul>
<p>Overhead combines all of these into a 0 to 100 viewing score, so you can see at a glance which passes are worth the trip outside.</p>

<h2>Where to look</h2>
<p>Every pass has a direction it appears from (for example, from the west), the direction it climbs to, and where it vanishes. Be outside a couple of minutes early, face the direction it rises from, and look about 10° above the horizon, roughly the width of your fist at arm's length.</p>

<h2>Other stations and satellites you can see</h2>
<ul>
<li><strong>Tiangong</strong>, China's space station, is smaller and a little fainter than the ISS but still easy to see.</li>
<li><strong>Hubble</strong> orbits at a low inclination, so it is only visible from about 35° north to 35° south.</li>
<li>Crew and cargo ships often fly just ahead of or behind the ISS for a few hours after launch or before docking.</li>
</ul>
''',
 faq=[('What time can I see the ISS tonight?', 'It depends on where you are. Visible passes happen in the hour or two after sunset or before sunrise, on some days and not others. An app such as Overhead calculates the exact times for your location.'),
      ('How do I tell the ISS from a plane?', 'The ISS is a steady white light with no blinking or coloured lights, and it moves in a smooth, straight path. Planes flash and usually show red and green lights.'),
      ('Can I see the ISS from the UK?', 'Yes. The ISS passes over the UK and Ireland several times a day, and there are usually a few visible evening or morning passes every week or two.')]),

# --------------------------------------------------------------------------------------------- Kp / aurora
dict(slug='kp-index-aurora', app='solar',
 title='The Kp Index Explained: How Far South Can You See the Aurora?',
 short='The Kp index and the aurora',
 desc='What the Kp index measures, which Kp you need to see the northern lights where you live, and why a high Kp alone does not guarantee an aurora.',
 lede="The Kp index is the number most aurora forecasts are built on. It runs from 0 to 9, and the higher it goes, the further from the poles the northern lights can be seen.",
 body='''
<h2>What the Kp index measures</h2>
<p>Kp measures how disturbed Earth's magnetic field is, based on magnetometers around the world. It is given for each three-hour block of the day on a scale from 0 (calm) to 9 (extreme storm). NOAA's Space Weather Prediction Center publishes the current value and a three-day forecast.</p>
<p>When a burst of solar wind or a coronal mass ejection (CME) hits Earth, the magnetic field is shaken up, Kp rises, and the auroral oval, the ring of aurora around each pole, grows and pushes towards the equator.</p>

<h2>Which Kp you need where you live</h2>
<p>These are rough guides for a dark, clear sky. At the lower end of each range the aurora will be low on the northern horizon (southern horizon in the southern hemisphere), and often easier to see in a phone photo than with the naked eye.</p>
<div class="tbl"><table>
<thead><tr><th>Kp</th><th>NOAA storm level</th><th>Europe</th><th>North America</th></tr></thead>
<tbody>
<tr><td>3</td><td>None</td><td>Iceland, northern Norway, Finland and Sweden</td><td>Alaska, northern Canada</td></tr>
<tr><td>4</td><td>None</td><td>Central Scandinavia, Shetland, northern Scotland</td><td>Southern Canada</td></tr>
<tr><td>5</td><td>G1 (minor)</td><td>Scotland, southern Norway and Sweden</td><td>Northern US states such as Washington, Minnesota and Maine</td></tr>
<tr><td>6</td><td>G2 (moderate)</td><td>Northern England, Ireland, Denmark, northern Germany and the Netherlands</td><td>New York, Wisconsin, Oregon</td></tr>
<tr><td>7</td><td>G3 (strong)</td><td>Most of the UK, Germany and Poland</td><td>Illinois, Pennsylvania, northern California</td></tr>
<tr><td>8</td><td>G4 (severe)</td><td>Central Europe, northern France and the Alps</td><td>Virginia, Kansas</td></tr>
<tr><td>9</td><td>G5 (extreme)</td><td>Southern Europe, as in May 2024</td><td>Southern states, as in May 2024</td></tr>
</tbody></table></div>

<h2>Why a high Kp is not the whole story</h2>
<ul>
<li><strong>Kp is a three-hour average.</strong> The aurora comes in bursts, often lasting 15 to 30 minutes, so the best show can be over by the time a high Kp is published.</li>
<li><strong>The Bz matters.</strong> The direction of the magnetic field in the solar wind, called Bz, decides how much energy gets in. When Bz points south (negative) for a while, the aurora strengthens. Solar shows the live Bz from spacecraft 1.5 million km upstream of Earth, which gives about 30 to 60 minutes' warning.</li>
<li><strong>Darkness, cloud and the Moon</strong> decide whether you can see it at all. A bright Moon washes out a faint aurora.</li>
</ul>
<p>That is why Solar's aurora score combines NOAA's OVATION aurora model with the cloud forecast, how dark your sky gets and the Moon, and turns it into a simple go, maybe or stay-in answer for your location.</p>

<h2>Where the storms come from</h2>
<p>Most strong storms are caused by CMEs, huge clouds of magnetised gas thrown out by the Sun, often alongside a solar flare. They take one to four days to reach Earth. NASA models each one and estimates when it will arrive and how strong the storm could be.</p>
<p>Smaller, regular storms come from fast solar wind streaming out of coronal holes, which can return every 27 days as the Sun rotates.</p>
''',
 faq=[('What Kp do I need to see the northern lights in the UK?', 'Usually Kp 5 or more for Scotland, Kp 6 for northern England and Ireland, and Kp 7 or more for southern England, with a dark, clear sky.'),
      ('What Kp is needed for Germany?', 'Around Kp 6 for the north of Germany, Kp 7 for the centre and Kp 8 for the south, low on the northern horizon.'),
      ('How long does a CME take to reach Earth?', 'Usually one to four days. The fastest CMEs have arrived in under a day.')]),

# --------------------------------------------------------------------------------------------- meteors
dict(slug='meteor-showers-2026-2027', app='asteroids',
 title='Meteor Shower Calendar 2026–2027: Dates, Rates and Moon Phases',
 short='Meteor showers 2026–2027',
 desc='Every major meteor shower from November 2026 to December 2027, with peak dates, how many meteors to expect and how much the Moon will get in the way.',
 lede="Meteor showers happen when Earth passes through the dust left behind by a comet or asteroid. The same showers return on the same dates every year, but the Moon changes, and it makes the biggest difference to how many you'll see.",
 body='''
<h2>The calendar</h2>
<p>Peak dates are the night most worth watching; most showers are active for a few nights either side. The rate is the ZHR, the number an observer would see per hour under a perfectly dark sky with the radiant overhead. In practice expect a third to half of that.</p>
<div class="tbl"><table>
<thead><tr><th>Shower</th><th>Peak night</th><th>Rate (ZHR)</th><th>Moon</th><th>Verdict</th></tr></thead>
<tbody>
<tr><td>Leonids</td><td>17 Nov 2026</td><td>~15</td><td>46%, sets around midnight</td><td>Good after midnight</td></tr>
<tr><td>Geminids</td><td>13–14 Dec 2026</td><td>~150</td><td>21% crescent, sets early</td><td>Excellent</td></tr>
<tr><td>Ursids</td><td>22 Dec 2026</td><td>~10</td><td>94%</td><td>Poor</td></tr>
<tr><td>Quadrantids</td><td>3–4 Jan 2027</td><td>~110</td><td>12% crescent before dawn</td><td>Very good</td></tr>
<tr><td>Lyrids</td><td>22 Apr 2027</td><td>~18</td><td>98%, full Moon</td><td>Poor</td></tr>
<tr><td>Eta Aquariids</td><td>6 May 2027</td><td>~50</td><td>New Moon</td><td>Excellent, best in the southern hemisphere</td></tr>
<tr><td>Southern Delta Aquariids</td><td>30 Jul 2027</td><td>~25</td><td>16% crescent</td><td>Good, best in the south</td></tr>
<tr><td>Perseids</td><td>12–13 Aug 2027</td><td>~100</td><td>85%, sets after midnight</td><td>Fair: watch before dawn</td></tr>
<tr><td>Draconids</td><td>8 Oct 2027</td><td>~10</td><td>56%</td><td>Fair, best in the evening</td></tr>
<tr><td>Orionids</td><td>21 Oct 2027</td><td>~20</td><td>68%, rises late evening</td><td>Poor to fair</td></tr>
<tr><td>Leonids</td><td>17 Nov 2027</td><td>~15</td><td>89%</td><td>Poor</td></tr>
<tr><td>Geminids</td><td>13–14 Dec 2027</td><td>~150</td><td>100%, full Moon</td><td>Poor</td></tr>
</tbody></table></div>
<p>Moon figures are the share of the Moon lit on the peak night, calculated for this calendar.</p>

<h2>The best ones to plan for</h2>
<ul>
<li><strong>Geminids, 13–14 December 2026.</strong> The strongest shower of the year, with a thin crescent Moon that sets in the early evening. Meteors start from about 9 pm and continue all night.</li>
<li><strong>Quadrantids, 3–4 January 2027.</strong> A short, sharp peak lasting only a few hours, but rich when you catch it. Best from northern Europe and North America in the hours before dawn.</li>
<li><strong>Eta Aquariids, 6 May 2027.</strong> Debris from Halley's Comet, with a new Moon. Best from the southern hemisphere and the tropics, in the last hours before dawn.</li>
</ul>

<h2>How to watch</h2>
<ul>
<li>Get away from street lights and give your eyes 20 minutes to adjust. Don't look at your phone, or use a red screen.</li>
<li>Lie back and look at a wide area of sky about halfway up. Meteors appear anywhere, not just near the radiant.</li>
<li>After midnight is usually better: your side of Earth then faces the direction Earth is travelling, so it meets more meteors.</li>
<li>Dress warmly, even in summer. You'll be still for a long time.</li>
</ul>
<p>The Meteors tab in Asteroids &amp; Meteors shows each shower's radiant in your sky, its height and the Moon, and lists recent fireballs.</p>
''',
 faq=[('When is the next big meteor shower?', 'The Geminids, peaking on the night of 13–14 December 2026, with up to about 150 meteors an hour under dark skies and little moonlight.'),
      ('What time is best to watch a meteor shower?', 'Usually after midnight and before dawn, when the radiant is high. The Geminids are an exception and are good from mid-evening.'),
      ('Do I need a telescope?', 'No. Meteors move too fast and across too much sky for a telescope or binoculars. Your eyes are the best tool.')]),

# --------------------------------------------------------------------------------------------- eclipses
dict(slug='eclipses-2027-2030', app='solar',
 title='Solar & Lunar Eclipses 2027–2030: Dates & Where to See Them',
 short='Eclipses 2027–2030',
 desc='Every solar and lunar eclipse from 2027 to 2030, and how much of the Sun is covered from London, Paris, Madrid, Rome, Cairo, New York and Sydney.',
 lede="The next big one is the total solar eclipse of 2 August 2027, with over six minutes of darkness near Luxor and a deep partial eclipse across most of Europe. Here is every eclipse until 2030 and what it will look like from major cities.",
 body='''
<h2>Solar eclipses</h2>
<div class="tbl"><table>
<thead><tr><th>Date</th><th>Type</th><th>Where it is total or annular</th></tr></thead>
<tbody>
<tr><td>6 Feb 2027</td><td>Annular</td><td>Chile, Argentina, the South Atlantic and West Africa</td></tr>
<tr><td>2 Aug 2027</td><td>Total</td><td>Southern Spain near Cádiz and Gibraltar, Morocco, Algeria, Tunisia, Libya, Egypt, Saudi Arabia and Yemen. Longest near Luxor, over six minutes.</td></tr>
<tr><td>26 Jan 2028</td><td>Annular</td><td>Ecuador, Peru, Brazil, then Portugal and Spain at sunset</td></tr>
<tr><td>22 Jul 2028</td><td>Total</td><td>Australia, including Sydney, and New Zealand</td></tr>
<tr><td>14 Jan 2029</td><td>Partial</td><td>North America</td></tr>
<tr><td>1 Jun 2030</td><td>Annular</td><td>North Africa, Greece, Turkey, Russia and Japan</td></tr>
<tr><td>25 Nov 2030</td><td>Total</td><td>Southern Africa, the Indian Ocean and southern Australia</td></tr>
</tbody></table></div>

<h3>How much of the Sun is covered from your city</h3>
<p>Maximum share of the Sun's disc covered, and the time of the maximum in UTC. Calculated for the city centre.</p>
<div class="tbl"><table>
<thead><tr><th>City</th><th>2 Aug 2027</th><th>26 Jan 2028</th><th>1 Jun 2030</th></tr></thead>
<tbody>
<tr><td>London</td><td>42% at 09:00</td><td>Starts before sunset, very low in the south-west</td><td>48% at 05:21, early morning</td></tr>
<tr><td>Dublin</td><td>36% at 08:56</td><td>47% at sunset</td><td>41% at 05:26</td></tr>
<tr><td>Edinburgh</td><td>27% at 09:00</td><td>Starts before sunset</td><td>40% at 05:29</td></tr>
<tr><td>Paris</td><td>51% at 09:01</td><td>Starts before sunset</td><td>53% at 05:16</td></tr>
<tr><td>Amsterdam</td><td>38% at 09:05</td><td>Starts before sunset</td><td>50% at 05:22</td></tr>
<tr><td>Berlin</td><td>34% at 09:13</td><td>Not visible</td><td>57% at 05:21</td></tr>
<tr><td>Madrid</td><td>86% at 08:51</td><td>82% at sunset</td><td>63% at sunrise</td></tr>
<tr><td>Seville</td><td>98% at 08:47</td><td>Annular, 83%, low at sunset</td><td>66% at sunrise</td></tr>
<tr><td>Rome</td><td>74% at 09:12</td><td>Starts before sunset</td><td>75% at 05:04</td></tr>
<tr><td>Stockholm</td><td>13% at 09:19</td><td>Not visible</td><td>50% at 05:35</td></tr>
<tr><td>Cairo</td><td>95% at 09:55</td><td>Not visible</td><td>63% at 04:46</td></tr>
<tr><td>Luxor</td><td>Total, 100% at 10:05</td><td>Not visible</td><td>51% at 04:40</td></tr>
</tbody></table></div>
<p>From North America, the eclipse of 14 January 2029 covers about 41% of the Sun from New York and 52% from Los Angeles. Sydney sees a total eclipse on 22 July 2028.</p>

<h2>Lunar eclipses</h2>
<p>A lunar eclipse is visible from anywhere the Moon is up at the time, so they are much easier to catch than solar eclipses. A total lunar eclipse turns the Moon a deep red.</p>
<div class="tbl"><table>
<thead><tr><th>Date</th><th>Type</th><th>Totality</th><th>Visible from (of the cities above)</th></tr></thead>
<tbody>
<tr><td>20 Feb 2027</td><td>Penumbral</td><td>None</td><td>Europe, Egypt, New York. A subtle darkening only.</td></tr>
<tr><td>12 Jan 2028</td><td>Partial</td><td>None</td><td>Europe, Egypt and North America</td></tr>
<tr><td>6 Jul 2028</td><td>Partial</td><td>None</td><td>Egypt and Australia</td></tr>
<tr><td>31 Dec 2028</td><td>Total</td><td>72 minutes</td><td>Most of Europe, Egypt and Australia</td></tr>
<tr><td>26 Jun 2029</td><td>Total</td><td>103 minutes</td><td>Western Europe and the Americas</td></tr>
<tr><td>20 Dec 2029</td><td>Total</td><td>55 minutes</td><td>Europe, Egypt and eastern North America</td></tr>
</tbody></table></div>

<h2>Watching a solar eclipse safely</h2>
<p>Never look at the Sun without certified eclipse glasses (ISO 12312-2) or a proper solar filter, even when most of it is covered. Sunglasses are not safe. You can also project the Sun through a pinhole onto card. Only during the few minutes of totality, when the Sun is completely covered, is it safe to look directly.</p>
<p>The Eclipse tab in Solar shows each eclipse as it will look from your location, with the exact local times of each stage.</p>
''',
 faq=[('When is the next total solar eclipse in Europe?', 'On 2 August 2027, totality crosses the far south of Spain near Cádiz and Gibraltar. Most of Europe sees a partial eclipse that morning.'),
      ('How much of the eclipse will London see in 2027?', 'About 42% of the Sun will be covered from London at around 09:00 UTC (10:00 BST) on 2 August 2027.'),
      ('When is the next total lunar eclipse visible from the UK?', 'On 31 December 2028, followed by a long one on 26 June 2029.')]),

# --------------------------------------------------------------------------------------------- asteroid risk
dict(slug='will-an-asteroid-hit-earth', app='asteroids',
 title='Will an Asteroid Hit Earth? How the Risk Is Tracked',
 short='Will an asteroid hit Earth?',
 desc='How NASA finds and tracks near-Earth asteroids, what the Torino scale means, and why the chance of a dangerous impact in our lifetimes is very small.',
 lede="Asteroids pass between the Earth and the Moon several times a month, and small ones hit the atmosphere every day. A dangerous impact is very unlikely in our lifetimes, and the large asteroids that could cause one are the ones we know best.",
 body='''
<h2>How often things hit us</h2>
<ul>
<li><strong>Dust and pebbles</strong> hit the atmosphere constantly. They are the meteors you see on any clear night.</li>
<li><strong>Metre-sized rocks</strong> arrive every few weeks and explode high up as fireballs. US government sensors detect the biggest ones, and NASA publishes them.</li>
<li><strong>Around 20 metres</strong>, like the Chelyabinsk meteor over Russia in 2013, happens every few decades. Its air burst broke windows across a city.</li>
<li><strong>Around 50 metres</strong>, like the Tunguska event in Siberia in 1908, is thought to happen every few centuries and can flatten a forest.</li>
<li><strong>A kilometre or more</strong> could cause global damage, but impacts like this happen only every few hundred thousand years, and surveys have found nearly all of them. None is on a collision course.</li>
</ul>

<h2>How the risk is tracked</h2>
<p>Telescopes around the world scan the sky every clear night for moving objects. When a new near-Earth asteroid is found, its orbit is calculated and projected a century ahead. NASA's Sentry system at the Jet Propulsion Laboratory lists every object that has any chance of hitting Earth in the next 100 years.</p>
<p>A new object often appears on the list with a small impact chance because its orbit is uncertain. As more observations come in the uncertainty shrinks, and in almost every case the chance drops to zero and the object is removed. That is the normal process, not a near miss.</p>
<p>NASA says no known asteroid larger than 140 metres has a significant chance of hitting Earth in the next 100 years.</p>

<h2>The Torino and Palermo scales</h2>
<p>The <strong>Torino scale</strong> rates the hazard from 0 to 10, combining the impact chance with the size. 0 means no hazard; 1 means routine discovery, with an extremely unlikely collision that will almost certainly be ruled out. Higher levels have only ever been reached briefly, and later observations brought them back to 0.</p>
<p>The <strong>Palermo scale</strong> is used by scientists. It compares an object's risk with the normal background risk from all asteroids. Values below −2 mean the object is of no real concern.</p>

<h2>Close approaches to look forward to</h2>
<p>On 13 April 2029, the 340-metre asteroid Apophis will pass about 32,000 km above Earth's surface, closer than many satellites. It will be visible to the naked eye from Europe, Africa and western Asia. There is no chance of it hitting us.</p>

<h2>Could we stop one?</h2>
<p>In 2022 NASA's DART spacecraft deliberately crashed into the small asteroid moon Dimorphos and shortened its orbit by about 32 minutes. It was the first test showing that an asteroid's path can be changed. With enough warning, a spacecraft could nudge a threatening asteroid aside.</p>
<p>Asteroids &amp; Meteors shows every upcoming close approach on a live radar, and NASA's Sentry list explained in plain words.</p>
''',
 faq=[('Is an asteroid going to hit Earth soon?', 'No known asteroid larger than 140 metres has a significant chance of hitting Earth in the next 100 years. Small rocks hit regularly but burn up or explode high in the atmosphere.'),
      ('What does Torino scale 1 mean?', 'A routine discovery with an extremely unlikely chance of collision, which further observations will almost certainly reduce to zero.'),
      ('Will Apophis hit Earth in 2029?', 'No. On 13 April 2029 it will pass about 32,000 km above the surface, close enough to see with the naked eye, with no chance of impact.')]),
]
