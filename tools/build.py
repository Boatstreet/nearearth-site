#!/usr/bin/env python3
"""Builds the Near Space website into ../nearearth-site/ (the folder Cloudflare publishes).

Run:  python3 tools/build.py
Edit the content in this file, run it, commit, push. Cloudflare deploys automatically.
"""
import json, os, html, datetime, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from guides import GUIDES

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'nearearth-site')
SITE = 'https://nearspace.app'
TODAY = datetime.date.today().isoformat()
NAME = 'Near Space'
EMAIL = 'hello@nearspace.app'

def esc(s): return html.escape(s, quote=True)

# ---------------------------------------------------------------- shared bits
BADGE = {
    'solar': '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.4" fill="#fff"/><g stroke="#fff" stroke-width="1.5" stroke-linecap="round"><path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9 13 13M3 13l1.1-1.1M11.9 4.1 13 3"/></g></svg>',
    'overhead': '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="6" y="6" width="4" height="4" rx="1" fill="#fff"/><rect x="1" y="6.6" width="4" height="2.8" fill="#fff"/><rect x="11" y="6.6" width="4" height="2.8" fill="#fff"/></svg>',
    'asteroids': '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 4.5 9.5 3l3 3-.5 4.5L8 13l-4-2-1-3.5z" fill="#fff"/></svg>',
    'sky': '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 5.5a7 7 0 0 0 8 8z" fill="#fff"/><path d="M6.5 9.5 11 5" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><circle cx="11.6" cy="4.4" r="1.4" fill="#fff"/><path d="M5 14h5" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></svg>',
}
MARK = '<svg class="brand-mark" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="5" fill="var(--sun)"/><ellipse cx="13" cy="13" rx="11.5" ry="5" fill="none" stroke="var(--orbit)" stroke-width="1.4" transform="rotate(-25 13 13)"/><circle cx="22.4" cy="8.8" r="1.8" fill="var(--rock)"/></svg>'
ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
SBAR = '<div class="sbar" aria-hidden="true"><b class="clk">21:42</b><i><svg viewBox="0 0 16 12"><path d="M1 11h2V8H1zM5 11h2V6H5zM9 11h2V3H9zM13 11h2V0h-2z"/></svg><svg viewBox="0 0 22 12"><rect x="0.5" y="0.5" width="18" height="11" rx="2.5" fill="none" stroke="#e9ecf7"/><rect x="2" y="2" width="12" height="8" rx="1.2"/><rect x="19.5" y="3.5" width="2" height="5" rx="1"/></svg></i></div>'

def phone(app):
    return f'''<div class="phone-col">
      <div class="note" aria-hidden="true"><span>It's the real app. <br>Try it.</span><svg viewBox="0 0 90 60"><path d="M4 8c22-6 52 0 66 22 4 7 6 14 6 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M66 42l10 10 6-13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="phone"><div class="screen" data-app="{app['key']}">
        {SBAR}
        <div class="boot" aria-hidden="true"><span></span></div>
        <iframe title="{esc(app['name'])} app, running live" data-src="/apps/{app['key']}/index.html" tabindex="0" loading="lazy"></iframe>
      </div></div>
      <p class="caption"><svg class="hand" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1-6 6h-1.2a6 6 0 0 1-4.6-2.2L4.4 15a1.5 1.5 0 0 1 2.2-2L9 15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><b class="verb">Tap</b> around. It's the real app · <span class="src">sample data</span></p>
    </div>'''

# ---------------------------------------------------------------- the apps
APPS = [
 dict(key='solar', slug='solar', cls='s-app', badge='b-sun', name='Solar', store='Solar: Sun, Aurora & Eclipse',
  title='Solar: Space Weather, Aurora & Sunspot App for Android',
  desc='Live Sun with numbered sunspots, solar flare and CME alerts, the Kp index, an aurora forecast and eclipses for your location. Free Android app, no account.',
  category='WeatherApplication', pro=True,
  pitch="Space weather you can actually read. A live view of the Sun with every numbered sunspot region, and a clear warning when a flare or CME is on its way to Earth.",
  feats=[('Live Sun','NASA SDO imagery with numbered active regions, rotated to the current time.'),
         ('Earth','An animated magnetosphere showing what the solar wind and CMEs are doing to it right now.'),
         ('Aurora tonight','A go, maybe or stay-in score from aurora chance, cloud cover, darkness and the Moon.'),
         ('Eclipses','How each coming eclipse will look from where you are.'),
         ('History','A calendar back to 1818 for sunspots and 1932 for geomagnetic storms.'),
         ('Alerts & widgets','Notifications for flares, storms and CMEs, plus six home-screen widgets.')],
  sources='Data: <b>NOAA SWPC</b>, <b>NASA SDO</b> &amp; <b>DONKI</b>, <b>SILSO</b>, <b>GFZ Potsdam</b>, <b>Open-Meteo</b>',
  pills=['Free · Pro upgrade','App Store planned'],
  intro=[
   "Solar is a space weather app for anyone who wants to know what the Sun is doing and whether it matters for them tonight. It turns the same data that forecasters at NOAA's Space Weather Prediction Center use into a few clear screens: the Sun as it looks right now, what is heading towards Earth, and what that means for the aurora where you are.",
   "Open the app and the first thing you see is a live picture of the Sun from NASA's Solar Dynamics Observatory, with every numbered sunspot region marked on it. Tap a region to see its size, its magnetic class and how likely it is to produce a flare. Switch to other wavelengths to see the corona, flares and coronal holes."],
  sections=[
   ('Solar flare and CME alerts', [
     "When a flare goes off, Solar shows its class (C, M or X) and the radio blackout level on NOAA's R scale. When NASA's models show a coronal mass ejection (CME) heading for Earth, the app shows when it is expected to arrive and how strong the geomagnetic storm could be.",
     "Alerts clear themselves once the event is over. With Solar Pro you set your own levels for storms, flares and radiation storms, and quiet hours for the night."]),
   ('Aurora forecast and the Kp index', [
     "The Kp index measures how disturbed Earth's magnetic field is, on a scale from 0 to 9. The higher it goes, the further from the poles the northern lights can be seen. Solar shows the current Kp, NOAA's three-day forecast and the solar wind readings measured by spacecraft 1.5 million km upstream of Earth.",
     "With Solar Pro, the Aurora tab combines NOAA's OVATION aurora model with the cloud forecast, how dark it will get and the Moon, then gives you a simple answer for your location: go, maybe, or stay in. It also shows both poles on spinning globes."]),
   ('Eclipses from where you are', [
     "The Eclipse tab, part of Solar Pro, plays out every eclipse as it will look from your place, with the exact local times, world path maps and every eclipse past and future."]),
   ('Sunspot and storm history', [
     "The free version shows the last seven days. With Solar Pro, a calendar goes back to any day since 1818 for the sunspot number, to 1932 for geomagnetic storms, and shows the Sun's picture for every day since 1996."]),
  ],
  tiers=(['Live Sun with numbered sunspot regions','Kp index, solar wind and NOAA scales','Flare, CME and storm events and alerts','The last 7 days of history','Sun, Kp, strip and classic widgets'],
         ['Full Earth, Aurora and Eclipse tabs','All 8 views of the Sun and a 48-hour time-lapse','Pro charts: X-ray flux and the 3-day Kp forecast','Your own alert levels and quiet hours','The full history back to 1818','Aurora tonight and full-page widgets']),
  trial='Try Pro free for 7 days.',
  faq=[
   ('What is the Kp index?', "The Kp index is a 0 to 9 scale of how disturbed Earth's magnetic field is, measured every three hours. Kp 5 and above counts as a geomagnetic storm (G1 to G5 on NOAA's scale), and that is when the aurora starts to be seen further from the poles."),
   ('Can Solar tell me if I will see the northern lights tonight?', "Yes, with Solar Pro. The Aurora tab combines NOAA's OVATION aurora forecast, the cloud forecast for your location, how dark it will be and the Moon into one score with a clear go, maybe or stay-in answer."),
   ('How much warning is there before a CME reaches Earth?', "A coronal mass ejection usually takes one to four days to reach Earth. Solar shows the arrival time estimated by NASA's models as soon as one is published, and can notify you when a CME is expected."),
   ('Where do the pictures of the Sun come from?', "From NASA's Solar Dynamics Observatory (SDO), which photographs the whole Sun every few minutes. The app also uses Helioviewer when the SDO images are delayed."),
   ('Does Solar have home-screen widgets?', "Yes, six: the Sun, the Kp index, a compact strip and a classic layout are free, and the aurora tonight and full-page widgets come with Solar Pro."),
   ('What does Solar Pro add?', "The full Earth, Aurora and Eclipse tabs, all eight views of the Sun with a 48-hour time-lapse, extra charts, your own alert levels, the full history back to 1818 and two extra widgets. You can try it free for 7 days."),
  ],
  data=[('NOAA SWPC','Kp index, solar wind, X-ray flux, R/S/G scales, alerts, OVATION aurora model'),('NASA SDO & Helioviewer','Images of the Sun'),('NASA DONKI','Flare, CME and geomagnetic storm records'),('SILSO','Sunspot numbers since 1818'),('GFZ Potsdam','Kp since 1932 and F10.7 radio flux'),('Open-Meteo','Cloud forecast and place search')]),

 dict(key='overhead', slug='overhead', cls='o-app', badge='b-orbit', name='Overhead', store='ISS & satellite passes',
  title='Overhead: ISS Tracker & Satellite Pass Times for Android',
  desc='Predicts every visible ISS and satellite pass over you, rates how good each will look and shows where to look. Free Android ISS tracker, no account.',
  category='ReferenceApplication', pro=True,
  pitch="Never miss the ISS again. Overhead works out every pass from your location, tells you how good it will look, and points your camera to where it will appear.",
  feats=[('Pass predictions','Rise, peak and set times with height and brightness for the ISS and other satellites.'),
         ('Viewing score','Each pass rated 0–100 from height, brightness, darkness, Moon and cloud.'),
         ('Sky & Look','Drag around the sky, or hold up your phone and the camera view marks where to watch.'),
         ('Orbit','A 3D Earth with satellites circling it in their real orbits, plus a radar of the passes ahead.'),
         ('Planets & night vision','Mercury to Saturn on the sky chart, and a red mode that keeps your eyes dark-adapted.'),
         ('Widgets & alerts','Next-pass countdown, upcoming passes and a live map on your home screen.')],
  sources='Data: <b>CelesTrak</b> orbital elements, <b>Open-Meteo</b> cloud cover, <b>Wikipedia</b> &amp; <b>Wikidata</b> satellite details',
  pills=['Free · Pro upgrade'],
  intro=[
   "Overhead is an ISS tracker and satellite pass predictor. It works out when the International Space Station, China's Tiangong station, the Hubble Space Telescope and other bright satellites will cross your sky, and whether you will actually be able to see them.",
   "Every pass is calculated on your phone from the latest orbital elements, using the same SGP4 model that satellite trackers around the world use. You get the time it rises, the highest point and where it fades, with a countdown to the next one."],
  sections=[
   ('Which passes are worth going outside for', [
     "Not every pass is a good one. Overhead rates each one from 0 to 100 using how high it climbs, how bright it will be, how dark your sky is, the Moon and the cloud forecast, so you can see at a glance which ones are worth the trip outside.",
     "Satellites shine by reflecting sunlight, so you see them best for an hour or two after sunset and before sunrise, when you are in darkness and they are still in sunlight. Overhead shows where each pass appears out of Earth's shadow or fades into it."]),
   ('Find it in the sky', [
     "The Sky tab shows the whole sky with each pass drawn across it. Its Look view, part of Overhead Pro, uses your camera and compass: hold up your phone and it marks where the satellite will appear and the path it will take. The planets from Mercury to Saturn and the constellations are drawn in, and a red night-vision mode keeps your eyes adjusted to the dark."]),
   ('Where is the ISS right now?', [
     "The Now tab shows where the ISS is over the Earth this second, Orbit shows a 3D globe with the satellites you follow circling it in their real orbits, and Radar shows where the coming passes rise and set."]),
   ('On your home screen', [
     "Alerts remind you a few minutes before a good ISS pass starts. With Overhead Pro, home-screen widgets show a countdown to the next pass, a list of upcoming passes and a live map, and you can get alerts for other satellites too."]),
  ],
  tiers=(['ISS, Tiangong and Hubble passes','Viewing score and cloud forecast','Live position, 3D orbit globe and radar','Planets and night vision'],
         ['Look: the camera view in the Sky tab','Home-screen widgets','Alerts for several satellites','Follow up to five satellites']),
  faq=[
   ('When can I see the International Space Station?', "The ISS is easiest to see in the hour or two after sunset or before sunrise, when your sky is dark but the station, about 420 km up, is still lit by the Sun. Overhead lists every pass like this for your location and rates how good it will be."),
   ('How accurate are the pass times?', "Passes are calculated with the standard SGP4 model from orbital elements published by CelesTrak, which the app refreshes regularly. With fresh elements, times are typically accurate to within seconds."),
   ('Which satellites can Overhead track?', "The ISS, China's Tiangong space station, the Hubble Space Telescope and other bright satellites that are easy to see with the naked eye."),
   ('What does the viewing score mean?', "It is a 0 to 100 rating of how good a pass will look, based on how high it climbs, how bright it will be, how dark the sky is, the Moon and forecast cloud."),
   ('Does Overhead need my camera?', "Only for the Look view in the Sky tab (part of Overhead Pro), which shows where to point your phone. Everything else works without it, and nothing from the camera leaves your phone."),
  ],
  data=[('CelesTrak','Orbital elements for the ISS and tracked satellites'),('Open-Meteo','Cloud forecast and place search'),('Wikipedia & Wikidata','Satellite photos, size and mass')]),

 dict(key='asteroids', slug='asteroids-meteors', cls='a-app', badge='b-rock', name='Asteroids & Meteors', store='Near-Earth flybys and meteor showers',
  title='Asteroids & Meteors: Near-Earth Asteroid Tracker App',
  desc='Every asteroid passing close to Earth on a live radar, NASA impact-risk data, 3D flybys and meteor showers. Free Android app using NASA/JPL data.',
  category='EducationalApplication', pro=False,
  pitch="See what's passing Earth this week. Every close approach on a live radar, real impact-risk data from NASA, and a 3D flyby you can ride alongside.",
  feats=[('Radar','A live dial of this week\'s flybys, with the next one counted down.'),
         ('3D flyby','Follow an asteroid past Earth on its real path, with the true Sun, Moon and stars.'),
         ('Risk',"NASA's Sentry list of objects with any chance of impact, explained plainly."),
         ('Meteors','Showers with real radiants and rates, plus recent fireballs.'),
         ('Sky','Point your phone up to find stars, planets and asteroids.'),
         ('History','A calendar of close approaches from 1900 to 2200.')],
  sources='Data: <b>NASA/JPL</b> Close Approach, <b>Sentry</b>, <b>Small-Body Database</b> &amp; <b>Fireball</b> APIs',
  pills=[],
  intro=[
   "Asteroids & Meteors is a near-Earth asteroid tracker. Several asteroids pass between the Earth and the Moon every month, and most are only spotted days before they arrive. This app shows every close approach NASA's Jet Propulsion Laboratory has on record, with how close it comes, how fast it is going and roughly how big it is.",
   "Distances are given in lunar distances (LD), the distance from Earth to the Moon, about 384,400 km. Anything inside 1 LD passes closer than the Moon."],
  sections=[
   ('A radar of this week\'s flybys', [
     "The Radar tab shows the next seven days as a dial around Earth, with each asteroid placed by when and how close it passes. The next one is highlighted with a countdown. Upcoming lists the next 60 days, which you can filter by size and distance."]),
   ('Ride along with a 3D flyby', [
     "For each close approach you can watch a 3D flyby: the asteroid follows its real path past Earth, with the Earth turned to the right time, lit from where the Sun really is, and the real stars behind it."]),
   ('Is anything going to hit us?', [
     "The Risk tab shows NASA's Sentry list: every known object with any chance of hitting Earth in the next century, with the Torino and Palermo scale ratings explained in plain words. Almost all of these chances are tiny and drop to zero as more observations come in."]),
   ('Meteor showers and fireballs', [
     "The Meteors tab shows each meteor shower's radiant, the point in the sky the meteors seem to come from, its peak date and how many meteors an hour to expect. It also lists recent fireballs, the bright meteors that US government sensors detect exploding in the atmosphere."]),
  ],
  tiers=None,
  faq=[
   ('Is an asteroid going to hit Earth?', "No known asteroid larger than about 140 metres has a significant chance of hitting Earth in the next 100 years. The Risk tab shows NASA's Sentry list of the objects that have any chance at all, and almost all of those chances are tiny."),
   ('What is a lunar distance (LD)?', "One lunar distance is the average distance from Earth to the Moon, about 384,400 km. An asteroid that passes at 0.5 LD comes halfway between Earth and the Moon."),
   ('How do you know how big an asteroid is?', "For most asteroids only the brightness is known, so the size is estimated from how much light it reflects. The app shows that range, for example 20 to 45 metres, and the measured size when one exists."),
   ('What is a fireball?', "A fireball is a meteor brighter than any planet. The largest ones are picked up by US government sensors, and NASA/JPL publishes their time, location, speed and energy."),
   ('Where does the data come from?', "From NASA's Jet Propulsion Laboratory: the Close Approach Data, Sentry, Small-Body Database and Fireball services."),
  ],
  data=[('NASA/JPL Close Approach Data','Every asteroid and comet flyby from 1900 to 2200'),('NASA/JPL Sentry','Objects with any chance of impact'),('NASA/JPL Small-Body Database','Orbits and physical data'),('NASA/JPL Fireball data','Bright meteors detected in the atmosphere')]),

 dict(key='sky', slug='sky', cls='k-app', badge='b-seti', name='Sky', store='Night sky & the search for alien signals',
  title='Sky: Stargazing & SETI Night Sky App for Android',
  desc="Tonight's stargazing score, a live star map and the stars Breakthrough Listen has searched for alien signals, plus the Wow! signal. Free Android app.",
  category='EducationalApplication', pro=False,
  pitch="Your night sky, with the search for life running through it. See what's up tonight, then find the stars that radio telescopes have listened to for a signal.",
  feats=[('Tonight','A live horizon scene with the real Moon, planets and meteors, a 0–100 stargazing score and the best nights ahead.'),
         ('Sky map','A star map that follows your phone, with a slider to wind the sky 12 hours either way.'),
         ('Listen','Over 5,500 stars and 94 galaxies that Breakthrough Listen pointed the Green Bank Telescope at.'),
         ('Our radio bubble','A 3D view of the stars close enough to have already heard our broadcasts.'),
         ('Signals','The Wow! signal, BLC1, fast radio bursts and more, marked solved or still unexplained.'),
         ('Calendar','Moon phases, meteor showers, eclipses and the days Green Bank was listening.')],
  sources='Data: <b>Breakthrough Listen</b> open data, <b>NOAA SWPC</b> aurora, <b>Open-Meteo</b> cloud cover',
  pills=['Free · Pro upgrade'],
  intro=[
   "Sky is a stargazing app with the search for extraterrestrial intelligence (SETI) built in. It tells you how good tonight is for looking up, shows you what is in the sky, and lets you explore the real stars that the Breakthrough Listen project has searched for radio signals from other civilisations.",
   "The SETI side uses Breakthrough Listen's public index of observations made with the 100-metre Green Bank Telescope between 2016 and 2018: over 5,500 stars and 94 nearby galaxies, each matched to its distance and star type."],
  sections=[
   ('Is tonight good for stargazing?', [
     "The Tonight tab draws your horizon with the real Moon phase, the planets and the stars, and gives the night a 0 to 100 score from cloud, darkness and moonlight. A timeline shows when true darkness starts and ends, and cards cover the Moon, the aurora chance and the listened-to star highest over you."]),
   ('A star map that follows your phone', [
     "Hold your phone up and the Sky map follows where you point it. Drag the time slider to wind the sky 12 hours forwards or back. Rings mark the stars that Breakthrough Listen has pointed its telescopes at."]),
   ('Listen: how the search works', [
     "Each target was observed in pairs with nearby empty sky. A real signal disappears when the telescope looks away, while interference from Earth does not. The app shows how that works with a waterfall plot, the frequency-against-time picture SETI researchers use, and explains why every candidate so far turned out to be human-made."]),
   ('Our radio bubble and famous signals', [
     "Radio broadcasts strong enough to leak into space began around a century ago, so a bubble about 100 light-years across now carries them. Sky shows the listened-to stars inside it. The Signals tab tells the stories of the Wow! signal, BLC1, pulsars and fast radio bursts, marked solved, likely solved or still unexplained."]),
  ],
  tiers=(["Tonight's stargazing score and darkness timeline", 'The live star map', 'Breakthrough Listen targets and simulations', 'Famous signals and the sky calendar'],
         ['Camera view: hold up your phone to find things', 'Best-night finder and your own alerts', "Jupiter's moons, live", 'Time machine for the sky', 'SETI extras and the signal lab', 'Home-screen widgets']),
  faq=[
   ('What is Breakthrough Listen?', "Breakthrough Listen is the largest scientific search for signs of intelligent life beyond Earth. It uses large radio telescopes, including the Green Bank Telescope in West Virginia, and makes its data public."),
   ('Has anyone found an alien signal?', "No. Every candidate signal found by Breakthrough Listen so far has been traced to human-made interference. Sky explains how each one is checked and ruled out."),
   ('What was the Wow! signal?', "A strong, narrow radio signal picked up by Ohio State University's Big Ear telescope in August 1977. It lasted about 72 seconds and has never been detected again. Its origin is still debated."),
   ('What is the stargazing score?', "A 0 to 100 rating for tonight at your location, based on the cloud forecast, how dark the sky gets and how much moonlight there is."),
   ('What does Sky Pro add?', "A camera view that shows what you are pointing at, a best-night finder with your own alerts, Jupiter's moons live, a time machine for the sky, extra SETI tools and home-screen widgets."),
   ('Does Sky work without an internet connection?', "Mostly. The star catalogue and the Breakthrough Listen data are built into the app. It only goes online for the cloud forecast and the aurora outlook."),
  ],
  data=[('Breakthrough Listen','Public index of Green Bank Telescope observations, 2016–2018'),('NOAA SWPC','Kp forecast for the aurora chance'),('Open-Meteo','Cloud forecast and temperature')]),
]
for a in APPS: a['url'] = f'/{a["slug"]}/'

GENERAL_FAQ = [
 ('Are the apps free?', "Yes, all four are free to download. Solar, Overhead and Sky also have an optional Pro upgrade that unlocks extra features. There are no ads in any of them."),
 ('When can I download them?', "The apps are coming to Google Play for Android. An iPhone version of Solar is planned."),
 ('Do I need an account?', "No. Open the app and it works. There is nothing to sign up for."),
 ('Do the apps collect my data?', 'No. There are no analytics, no ads and no tracking. Your location is used on your phone to work out what is above you and is never sent to us. See the <a href="/privacy/">privacy policy</a>.'),
 ('Where does the data come from?', "From public science agencies: NOAA's Space Weather Prediction Center, NASA, NASA's Jet Propulsion Laboratory, CelesTrak, Breakthrough Listen and Open-Meteo."),
 ('Do the apps work offline?', "Each app keeps the latest data it downloaded and shows it when you are offline, so you can still check the last forecast or pass times."),
]


SCREENS = {
 'solar': ['The live Sun with numbered sunspot regions', 'CMEs on their way, with arrival times', 'Kp, X-ray and solar wind charts', 'What is hitting Earth right now', "Tonight's aurora verdict for your place", 'The next eclipse as seen from you'],
 'overhead': ['The next pass and its viewing score', 'Every pass tonight, on a sky chart', 'The whole sky, with the next pass marked', 'A 3D globe with the satellites you follow', 'Where each pass rises and sets', 'Follow the ISS, Tiangong, Hubble and more'],
 'asteroids': ["This week's flybys on a live radar", 'Every close approach, with a 3D view', "Each asteroid's path around the Sun", 'Meteor showers with real radiants', "NASA's impact-risk list, explained", 'A calendar of flybys from 1900 to 2200'],
 'sky': ["Tonight's score and the best nights ahead", 'A star map with planets and listened-to stars', 'Breakthrough Listen targets and simulations', 'The Wow! signal and other mysteries', 'Moon phases and sky events, day by day'],
}

TOUR_TABS = {'solar': 'Sun, Events, Activity, Earth, Aurora and Eclipse', 'overhead': 'Now, Passes, Sky, Orbit, Radar and Satellites',
             'asteroids': 'Radar, Upcoming, Orbit, Meteors, Risk and History', 'sky': 'Tonight, Sky, Listen, Signals and Calendar'}
def tour_html(a):
    k = a['key']; n = esc(a['name'])
    return f'''<section class="tour {a['cls']}" aria-labelledby="tour-h">
  <div class="wrap">
    <div class="tour-copy">
      <p class="label">See it in action</p>
      <h2 id="tour-h" style="margin-top:14px">A 20-second tour of {n}</h2>
      <p>Recorded from the real app, stepping through every tab: {TOUR_TABS[k]}.</p>
      <button type="button" class="tour-btn" data-tour-toggle aria-pressed="false"><span class="ico" aria-hidden="true"></span><span class="txt">Play the tour</span></button>
    </div>
    <div class="tour-phone">
      <div class="frame">
        <video muted loop playsinline preload="none" poster="/media/{k}-tour.webp" data-src="/media/{k}-tour.mp4" aria-label="Video tour of {n}" width="412" height="916"></video>
        <button type="button" class="tour-play" data-tour-toggle aria-label="Play the tour"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></button>
      </div>
    </div>
  </div>
</section>
'''

def screens_html(a):
    caps = SCREENS[a['key']]; k = a['key']; n = esc(a['name'])
    items = ''
    items += ''.join(f'<li class="shot"><figure><div class="frame"><img src="/media/{k}-{i}.webp" alt="{n}: {esc(c)}" width="540" height="1199" loading="lazy" decoding="async"></div><figcaption>{esc(c)}</figcaption></figure></li>' for i, c in enumerate(caps))
    return f'''<section class="screens {a['cls']}" aria-labelledby="scr-h">
  <div class="wrap">
    <div class="scr-head"><div><p class="label">Inside the app</p><h2 id="scr-h" style="margin-top:14px">{n}, screen by screen</h2></div>
    <div class="scr-nav"><button type="button" class="sn" data-dir="-1" aria-label="Previous screens">‹</button><button type="button" class="sn" data-dir="1" aria-label="Next screens">›</button></div></div>
  </div>
  <ul class="strip" tabindex="0" aria-label="{n} screens">{items}</ul>
  <div class="wrap"><p class="scr-note">Screens shown with sample data.</p></div>
</section>
'''

# ---------------------------------------------------------------- page shell
def head(title, desc, path, og_img, jsonld, extra=''):
    url = SITE + path
    t = esc(title)
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{t}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{url}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#0b0f1f">
<meta name="color-scheme" content="dark">
<link rel="icon" href="/favicon.ico?v=2" sizes="48x48">
<link rel="icon" href="/favicon.svg?v=2" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png?v=2" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2">
<link rel="manifest" href="/site.webmanifest?v=2">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{NAME}">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}{og_img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_GB">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{t}">
<meta name="twitter:description" content="{esc(desc)}">
<meta name="twitter:image" content="{SITE}{og_img}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;600;700&family=Figtree:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Caveat:wght@600&display=swap">
<link rel="stylesheet" href="/assets/site.css?v={VER}">
{extra}<script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False, separators=(',', ':'))}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
'''

def nav(current=''):
    items = [('/solar/', 'Solar', 'solar'), ('/overhead/', 'Overhead', 'overhead'), ('/asteroids-meteors/', 'Asteroids', 'asteroids-meteors'), ('/sky/', 'Sky', 'sky'), ('/guides/', 'Guides', 'guides')]
    li = ''.join(f'<li{" class=\"opt\"" if s == "guides" else ""}><a href="{h}"{" aria-current=\"page\"" if s == current else ""}>{n}</a></li>' for h, n, s in items)
    return f'''<nav aria-label="Main">
  <div class="wrap">
    <a class="brand" href="/">{MARK}<span class="bt">{NAME}</span></a>
    <ul>{li}</ul>
  </div>
</nav>
'''

def footer():
    apps = ''.join(f'<li><a href="{a["url"]}">{esc(a["name"])}</a></li>' for a in APPS)
    return f'''<footer>
  <div class="wrap">
    <div class="foot">
      <div>
        <a class="brand" href="/">{MARK}<span>{NAME}</span></a>
        <p>Android apps for space weather, ISS passes, near-Earth asteroids and the night sky. No accounts, no ads, no tracking.</p>
      </div>
      <div><h2>Apps</h2><ul>{apps}</ul></div>
      <div><h2>Guides</h2><ul>{''.join(f'<li><a href="/guides/{g["slug"]}/">{esc(g["short"])}</a></li>' for g in GUIDES)}</ul></div>
      <div><h2>More</h2><ul><li><a href="/guides/">All guides</a></li><li><a href="/#faq">Questions</a></li><li><a href="/#data">Data sources</a></li><li><a href="/privacy/">Privacy policy</a></li><li><a href="/#contact">Contact</a></li></ul></div>
    </div>
    <div class="fine"><span>© 2026 {NAME}</span><span>Not affiliated with NOAA, NASA, JPL, CelesTrak or Breakthrough Listen.</span></div>
  </div>
</footer>
<script src="/assets/site.js?v={VER}" defer></script>
</body>
</html>
'''

CONTACT = f'''<section class="contact" id="contact" aria-labelledby="contact-h">
  <div class="wrap">
    <div>
      <h2 id="contact-h">Questions or ideas?</h2>
      <p>Found a bug, want a feature, or spotted something odd in the sky data? Get in touch.</p>
    </div>
    <div class="mail">
      <code id="addr">{EMAIL}</code>
      <button type="button" id="copy">Copy</button>
    </div>
  </div>
</section>
'''

def app_section(a, top=False, flip=False):
    h = 'h1' if top else 'h2'
    feats = ''.join(f'<li><div><b>{esc(t)}</b></div><span>{esc(d)}</span></li>' for t, d in a['feats'])
    pills = ''.join(f'<span class="pill">{esc(p)}</span>' for p in a['pills'])
    more = '' if top else f'<a class="more" href="{a["url"]}">More about {esc(a["name"])} {ARROW}</a>'
    return f'''<section class="app {a['cls']}{' flip' if flip else ''}{' top' if top else ''}" id="{a['slug']}" aria-labelledby="{a['slug']}-h">
  <div class="wrap">
    <div class="copy">
      <div class="app-head">
        <span class="badge {a['badge']}">{BADGE[a['key']]}</span>
        <div><{h} id="{a['slug']}-h">{esc(a['name'])}</{h}><p class="storetitle">{esc(a['store'])}</p></div>
      </div>
      <p class="pitch">{esc(a['pitch'])}</p>
      <ul class="feats">{feats}</ul>
      <p class="sources">{a['sources']}</p>
      <div class="meta"><span class="pill soon">Coming to Google Play</span>{pills}</div>
      {more}
    </div>
    {phone(a)}
  </div>
</section>
'''

def faq_html(items, hid='faq-h', title='Questions'):
    rows = ''.join(f'<details><summary>{esc(q)}</summary><div class="a"><p>{a}</p></div></details>' for q, a in items)
    return f'''<section class="faq-sec" id="faq" aria-labelledby="{hid}">
  <div class="wrap">
    <p class="label">Good to know</p>
    <h2 id="{hid}" style="margin-top:14px">{title}</h2>
    <div class="faq">{rows}</div>
  </div>
</section>
'''

def faq_ld(items):
    import re
    strip = lambda s: re.sub('<[^>]+>', '', s)
    return {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': strip(a)}} for q, a in items]}

ORG = {'@type': 'Organization', '@id': SITE + '/#org', 'name': NAME, 'url': SITE + '/', 'logo': SITE + '/icon-512.png', 'email': EMAIL}
WEBSITE = {'@type': 'WebSite', '@id': SITE + '/#website', 'name': NAME, 'url': SITE + '/', 'publisher': {'@id': SITE + '/#org'}, 'inLanguage': 'en'}

def app_ld(a):
    return {'@type': 'MobileApplication', '@id': SITE + a['url'] + '#app', 'name': a['name'], 'alternateName': a['store'] if a['store'] != a['name'] else None,
            'operatingSystem': 'Android', 'applicationCategory': a['category'], 'description': a['desc'], 'url': SITE + a['url'],
            'image': SITE + f'/assets/og-{a["slug"]}.jpg', 'publisher': {'@id': SITE + '/#org'},
            'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'EUR'}, 'isAccessibleForFree': True}

def clean(o):
    if isinstance(o, dict): return {k: clean(v) for k, v in o.items() if v is not None}
    if isinstance(o, list): return [clean(v) for v in o]
    return o

def write(path, text):
    p = os.path.join(OUT, path.strip('/'), 'index.html') if path.endswith('/') else os.path.join(OUT, path)
    if path == '/': p = os.path.join(OUT, 'index.html')
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w').write(text)


NOWBAR = '''<section class="now" id="now" aria-label="The sky right now" hidden>
  <div class="wrap">
    <div class="now-head"><span class="live-dot" aria-hidden="true"></span><span class="label">The sky right now</span><span class="now-at" data-n="at"></span></div>
    <div class="now-grid">
      <a class="nc s-app" href="/solar/" data-n="kp"><span class="k">Kp index</span><b>…</b><span class="s"> </span></a>
      <a class="nc s-app" href="/solar/" data-n="flare"><span class="k">Latest solar flare</span><b>…</b><span class="s"> </span></a>
      <a class="nc s-app" href="/solar/" data-n="regions"><span class="k">Sunspot groups</span><b>…</b><span class="s"> </span></a>
      <a class="nc o-app" href="/overhead/" data-n="iss"><span class="k">ISS right now</span><b>…</b><span class="s"> </span></a>
      <a class="nc a-app" href="/asteroids-meteors/" data-n="flyby"><span class="k">Next asteroid flyby</span><b>…</b><span class="s"> </span></a>
    </div>
  </div>
</section>
'''

# ---------------------------------------------------------------- home
def home():
    hero = f'''<header class="hero" id="top">
  <canvas id="herosky" aria-hidden="true"></canvas>
  <div class="wrap">
    <p class="label">Android apps · live data from NOAA, NASA, CelesTrak &amp; Breakthrough Listen</p>
    <h1 style="margin-top:18px">Know what's <em>happening above you</em>.</h1>
    <p class="lede">Four free Android apps for the sky. Watch the Sun's storms head for Earth, catch the ISS crossing overhead, see which asteroids are passing by this week, and find the stars we've listened to for alien signals.</p>
    <div class="chips">{''.join(f'<a class="chip {c}" href="#{a["slug"]}"><span class="badge {a["badge"]}">{BADGE[a["key"]]}</span>{esc(a["name"])}</a>' for a, c in zip(APPS, ['s', 'o', 'a', 'k']))}</div>
    <div class="readout" aria-label="What the apps track">
      <span>Kp index <b>0–9</b></span>
      <span>ISS altitude <b>~420 km</b></span>
      <span>Miss distance in <b>LD</b> (Moon distances)</span>
      <span>Sunspot record from <b>1818</b></span>
      <span>Hydrogen line <b>1420 MHz</b></span>
    </div>
  </div>
</header>
'''
    sections = ''.join(app_section(a, flip=i % 2 == 1) for i, a in enumerate(APPS))
    promise = '''<section class="promise" id="promises" aria-labelledby="promise-h">
  <div class="wrap">
    <p class="label">Built the same way</p>
    <h2 id="promise-h" style="margin-top:14px">Your sky, your phone. Nothing leaves it.</h2>
    <div class="grid">
      <div><h3>No account</h3><p>Open the app and it works. There's nothing to sign up for.</p></div>
      <div><h3>No tracking</h3><p>No analytics, no ads, no cookies. Your location is used on the phone to work out what's above you and isn't sent to us. <a href="/privacy/" style="color:var(--orbit)">Privacy policy</a>.</p></div>
      <div><h3>Official data</h3><p>Every number comes from public science agencies, so you see what the scientists see.</p></div>
      <div><h3>Made to match</h3><p>All four share one look: dark, compact, with tabs at the bottom and home-screen widgets.</p></div>
    </div>
  </div>
</section>
'''
    rows = [('NOAA SWPC', 'Kp index, solar wind, X-ray flux, R/S/G scales, alerts, OVATION aurora model', 'sk'),
            ('NASA SDO &amp; DONKI', 'Images of the Sun, flare, CME and storm records', 's'),
            ('SILSO &amp; GFZ Potsdam', 'Sunspot numbers since 1818, Kp since 1932, F10.7 radio flux', 's'),
            ('CelesTrak', 'Orbital elements for the ISS and tracked satellites', 'o'),
            ('NASA/JPL', 'Close approaches, Sentry impact risk, small-body orbits, fireballs', 'a'),
            ('Breakthrough Listen', 'Public index of Green Bank Telescope SETI observations, 2016–2018, and a sample recording', 'k'),
            ('Open-Meteo', 'Cloud cover forecasts and place search', 'sok')]
    names = {'s': 'Solar', 'o': 'Overhead', 'a': 'Asteroids &amp; Meteors', 'k': 'Sky'}
    trs = ''.join(f'<tr><td>{s}</td><td>{d}</td><td><span class="dots">{"".join(f"<i class=\"d-{c}\" title=\"{names[c]}\"></i>" for c in u)}</span></td></tr>' for s, d, u in rows)
    data = f'''<section class="data" id="data" aria-labelledby="data-h">
  <div class="wrap">
    <p class="label">Where the numbers come from</p>
    <h2 id="data-h" style="margin-top:14px">Data sources</h2>
    <p class="intro">All free, public services. Thank you to the teams who keep them running.</p>
    <div class="tbl"><table><thead><tr><th>Source</th><th>What it provides</th><th>Used in</th></tr></thead><tbody>{trs}</tbody></table></div>
  </div>
</section>
'''
    ld = clean({'@context': 'https://schema.org', '@graph': [ORG, WEBSITE,
        {'@type': 'WebPage', '@id': SITE + '/#page', 'url': SITE + '/', 'name': 'Near Space: Space Weather, ISS, Asteroid & Sky Apps', 'isPartOf': {'@id': SITE + '/#website'}, 'about': [{'@id': SITE + a['url'] + '#app'} for a in APPS]},
        {'@type': 'ItemList', 'name': 'Near Space apps', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'url': SITE + a['url'], 'name': a['name']} for i, a in enumerate(APPS)]},
        *[app_ld(a) for a in APPS], faq_ld(GENERAL_FAQ)]})
    page = head('Near Space: Space Weather, ISS, Asteroid & Sky Apps',
                'Four free Android apps for the sky: space weather and aurora alerts, ISS pass times, near-Earth asteroid flybys, and stargazing with SETI. No accounts, no ads.',
                '/', '/assets/og-home.jpg', ld)
    page += nav() + '<main id="main">\n' + hero + NOWBAR + sections + promise + guides_section() + data + faq_html(GENERAL_FAQ) + CONTACT + '</main>\n' + footer()
    write('/', page)

# ---------------------------------------------------------------- app pages
def app_page(a):
    others = [o for o in APPS if o is not a]
    crumbs = f'<div class="wrap crumbs"><nav aria-label="Breadcrumb"><ol><li><a href="/">{NAME}</a></li><li aria-current="page">{esc(a["name"])}</li></ol></nav></div>\n'
    intro = ''.join(f'<p>{esc(p)}</p>' for p in a['intro'])
    secs = ''.join(f'<div><h3>{esc(t)}</h3>{"".join(f"<p>{esc(p)}</p>" for p in ps)}</div>' for t, ps in a['sections'])
    tiers = ''
    if a['tiers']:
        free, pro = a['tiers']
        tiers = f'''<h2 style="margin-top:28px">Free, with an optional Pro upgrade</h2>
      <p>{esc(a['name'])} is free to download with no ads. The Pro upgrade unlocks extra features for people who use it every day. {esc(a.get('trial',''))}</p>
      <div class="tiers"><div class="tier"><h3>Free</h3><ul>{''.join(f'<li>{esc(x)}</li>' for x in free)}</ul></div><div class="tier pro"><h3>Pro</h3><ul>{''.join(f'<li>{esc(x)}</li>' for x in pro)}</ul></div></div>'''
    data_rows = ''.join(f'<li><strong>{esc(s)}</strong>: {esc(d)}</li>' for s, d in a['data'])
    body = f'''<section class="prose-sec {a['cls']}" aria-labelledby="about-h">
  <div class="wrap">
    <div class="prose" style="max-width:none">
      <p class="label">About the app</p>
      <h2 id="about-h">What {esc(a['name'])} does</h2>
      <div class="prose">{intro}</div>
      <div class="two" style="margin-top:18px">{secs}</div>
      {tiers}
      <h2 style="margin-top:28px">Where the data comes from</h2>
      <ul>{data_rows}</ul>
      <p>The app fetches this data directly from each source. It doesn't go through our servers, and there is no account or tracking. <a href="/privacy/">Privacy policy</a>.</p>
      {''.join(f'<p>Read the guide: <a href="/guides/{g["slug"]}/">{esc(g["title"])}</a></p>' for g in GUIDES if g['app'] == a['key'])}
    </div>
  </div>
</section>
'''
    cards = ''.join(f'<a class="card-link {o["cls"]}" href="{o["url"]}"><span class="badge {o["badge"]}">{BADGE[o["key"]]}</span><div><b>{esc(o["name"])}</b><span class="t">{esc(o["store"])}</span></div></a>' for o in others)
    oth = f'''<section class="others" aria-labelledby="others-h">
  <div class="wrap">
    <p class="label">From the same maker</p>
    <h2 id="others-h" style="margin-top:14px">More apps for the sky</h2>
    <div class="cards">{cards}</div>
  </div>
</section>
'''
    ld = clean({'@context': 'https://schema.org', '@graph': [ORG, WEBSITE,
        {'@type': 'WebPage', '@id': SITE + a['url'] + '#page', 'url': SITE + a['url'], 'name': a['title'], 'description': a['desc'], 'isPartOf': {'@id': SITE + '/#website'}, 'about': {'@id': SITE + a['url'] + '#app'},
         'breadcrumb': {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': 1, 'name': NAME, 'item': SITE + '/'}, {'@type': 'ListItem', 'position': 2, 'name': a['name'], 'item': SITE + a['url']}]}},
        app_ld(a), faq_ld(a['faq'])]})
    page = head(a['title'], a['desc'], a['url'], f'/assets/og-{a["slug"]}.jpg', ld)
    page += nav(a['slug']) + '<main id="main">\n' + crumbs + app_section(a, top=True) + tour_html(a) + screens_html(a) + body + faq_html(a['faq'], title=f'{esc(a["name"])} questions') + oth + CONTACT + '</main>\n' + footer()
    write(a['url'], page)


# ---------------------------------------------------------------- guides
APP_BY_KEY = {a['key']: a for a in APPS}
TOPIC = {'solar': 'Space weather', 'overhead': 'Satellites', 'asteroids': 'Asteroids & meteors', 'sky': 'Night sky'}
def gcard(g):
    a = APP_BY_KEY[g['app']]
    return f'<a class="gcard {a["cls"]}" href="/guides/{g["slug"]}/"><span class="k">{esc(TOPIC[g["app"]])}</span><b>{esc(g["title"])}</b><span class="t">{esc(g["desc"])}</span></a>'

def guides_section(title='Guides to the sky', items=None, hid='guides-h'):
    items = items or GUIDES
    return f'''<section class="guides-sec" id="guides" aria-labelledby="{hid}">
  <div class="wrap">
    <p class="label">Learn more</p>
    <h2 id="{hid}" style="margin-top:14px">{title}</h2>
    <div class="gcards">{''.join(gcard(g) for g in items)}</div>
  </div>
</section>
'''

def guide_page(g):
    a = APP_BY_KEY[g['app']]; url = f'/guides/{g["slug"]}/'
    d = datetime.date.today().strftime('%-d %B %Y')
    crumbs = f'<div class="wrap crumbs"><nav aria-label="Breadcrumb"><ol><li><a href="/">{NAME}</a></li><li><a href="/guides/">Guides</a></li><li aria-current="page">{esc(g["short"])}</li></ol></nav></div>\n'
    cta = f'<div class="cta {a["cls"]}"><span class="badge {a["badge"]}">{BADGE[a["key"]]}</span><div><b>{esc(a["name"])}</b><span>{esc(a["store"])}. Free for Android.</span></div><a class="go" href="{a["url"]}">See the app {ARROW}</a></div>'
    rel = ''.join(f'<a href="/guides/{o["slug"]}/">{esc(o["short"])}</a>' for o in GUIDES if o is not g)
    art = f'''<article class="guide {a['cls']}" aria-labelledby="g-h"><div class="wrap">
  <p class="label">{esc(TOPIC[g['app']])} guide</p>
  <h1 id="g-h" style="margin-top:14px">{esc(g['title'])}</h1>
  <p class="lede">{esc(g['lede'])}</p>
  <p class="updated">Updated {d}</p>
  {cta}
  <div class="prose">{g['body']}</div>
  {cta}
  <div class="related"><span class="label" style="align-self:center;margin-right:4px">More guides</span>{rel}</div>
</div></article>
'''
    ld = clean({'@context': 'https://schema.org', '@graph': [ORG, WEBSITE,
        {'@type': 'Article', '@id': SITE + url + '#article', 'headline': g['title'], 'description': g['desc'], 'url': SITE + url, 'mainEntityOfPage': SITE + url,
         'image': SITE + f'/assets/og-{a["slug"]}.jpg', 'datePublished': '2026-10-26', 'dateModified': TODAY, 'inLanguage': 'en',
         'author': {'@id': SITE + '/#org'}, 'publisher': {'@id': SITE + '/#org'}, 'about': {'@id': SITE + a['url'] + '#app'}},
        {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': 1, 'name': NAME, 'item': SITE + '/'}, {'@type': 'ListItem', 'position': 2, 'name': 'Guides', 'item': SITE + '/guides/'}, {'@type': 'ListItem', 'position': 3, 'name': g['short'], 'item': SITE + url}]},
        faq_ld(g['faq'])]})
    page = head(g['title'], g['desc'], url, f'/assets/og-{a["slug"]}.jpg', ld).replace('<meta property="og:type" content="website">', '<meta property="og:type" content="article">')
    page += nav('guides') + '<main id="main">\n' + crumbs + art + faq_html(g['faq'], title='Quick answers') + CONTACT + '</main>\n' + footer()
    write(url, page)

def guides_index():
    ld = clean({'@context': 'https://schema.org', '@graph': [ORG, WEBSITE,
        {'@type': 'CollectionPage', '@id': SITE + '/guides/#page', 'url': SITE + '/guides/', 'name': 'Guides to the sky', 'isPartOf': {'@id': SITE + '/#website'},
         'hasPart': [{'@type': 'Article', 'headline': g['title'], 'url': SITE + f'/guides/{g["slug"]}/'} for g in GUIDES]},
        {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': 1, 'name': NAME, 'item': SITE + '/'}, {'@type': 'ListItem', 'position': 2, 'name': 'Guides', 'item': SITE + '/guides/'}]}]})
    page = head('Guides to the Sky: ISS, Aurora, Meteors & Eclipses',
                'Plain-English guides to seeing the ISS, the Kp index and the aurora, meteor showers, upcoming eclipses and asteroid impact risk.', '/guides/', '/assets/og-home.jpg', ld)
    crumbs = f'<div class="wrap crumbs"><nav aria-label="Breadcrumb"><ol><li><a href="/">{NAME}</a></li><li aria-current="page">Guides</li></ol></nav></div>\n'
    intro = '''<section class="guide" aria-labelledby="gi-h"><div class="wrap">
  <p class="label">Guides</p>
  <h1 id="gi-h" style="margin-top:14px">Guides to the sky</h1>
  <p class="lede">Plain-English answers to the questions people ask most: when to see the ISS, how far south the aurora reaches, the best meteor showers, the next eclipses, and whether an asteroid will hit us.</p>
</div></section>
'''
    page += nav('guides') + '<main id="main">\n' + crumbs + intro + guides_section('All guides', hid='all-h') + CONTACT + '</main>\n' + footer()
    write('/guides/', page)

# ---------------------------------------------------------------- privacy
PRIVACY = [
 ('The short version', ["The Near Space apps (Solar, Overhead, Asteroids &amp; Meteors and Sky) don't have accounts, ads, analytics or tracking. We don't collect, store, sell or share any personal data. What you set up in an app stays on your phone."]),
 ('Your location', ["The apps use your location, or a place you search for, to work out what is above you: sunrise and darkness, satellite passes, the aurora chance, the stars overhead. This happens on your phone. Your location is never sent to us.",
   "To get a cloud forecast, an app sends the rounded coordinates of your chosen place to Open-Meteo. Place searches you type are sent to Open-Meteo's geocoding service, and some apps look up the name of a place with BigDataCloud or OpenStreetMap. No other information about you is included."]),
 ('Data the apps download', ["The apps download public science data directly from its sources: NOAA's Space Weather Prediction Center, NASA, NASA's Jet Propulsion Laboratory, CelesTrak, Wikipedia and Wikidata, GFZ Potsdam, SILSO and Open-Meteo. Like any website you visit, these services can see your IP address when your phone asks them for data. Their own privacy policies apply to that. Nothing is sent through our servers."]),
 ('Camera and sensors', ["Overhead's Look tab and the sky views use your camera, compass and motion sensors to show where to look. The camera picture is shown on screen only. It is never recorded, saved or sent anywhere."]),
 ('Notifications', ["Alerts, such as an approaching CME or a good ISS pass, are worked out on your phone from the public data above. We don't run a notification server and don't know which alerts you have turned on."]),
 ('Purchases', ["Optional Pro upgrades are sold through Google Play. Google handles the payment, and the app only receives confirmation that the upgrade is unlocked. We never see your payment details."]),
 ('Crash reports', ["If an app crashes, it may keep a short crash log on your phone to help fix the problem. It is only sent to us if you choose to share it, and personal details such as your location are removed first."]),
 ('Children', ["The apps are suitable for all ages and don't collect personal data from anyone, including children."]),
 ('This website', ["nearspace.app doesn't use cookies, analytics or tracking. It is hosted by Cloudflare, which processes basic technical information such as IP addresses to deliver and protect the site. The app demos on the website run in your browser and keep nothing once you close the page."]),
 ('Changes and contact', [f'If this policy changes, the new version will be posted here with a new date. Questions? Email <a href="mailto:{EMAIL}">{EMAIL}</a>.']),
]
def privacy():
    secs = ''.join(f'<h2>{t}</h2>' + ''.join(f'<p>{p}</p>' for p in ps) for t, ps in PRIVACY)
    ld = clean({'@context': 'https://schema.org', '@graph': [ORG, WEBSITE, {'@type': 'WebPage', '@id': SITE + '/privacy/#page', 'url': SITE + '/privacy/', 'name': 'Privacy policy', 'isPartOf': {'@id': SITE + '/#website'}, 'dateModified': TODAY,
        'breadcrumb': {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': 1, 'name': NAME, 'item': SITE + '/'}, {'@type': 'ListItem', 'position': 2, 'name': 'Privacy policy', 'item': SITE + '/privacy/'}]}}]})
    page = head('Privacy Policy | Near Space', 'How the Near Space apps (Solar, Overhead, Asteroids & Meteors and Sky) handle your data: no accounts, no ads, no analytics and no tracking.', '/privacy/', '/assets/og-home.jpg', ld)
    d = datetime.date.today().strftime('%-d %B %Y')
    page += nav('privacy') + f'''<main id="main">
<div class="wrap crumbs"><nav aria-label="Breadcrumb"><ol><li><a href="/">{NAME}</a></li><li aria-current="page">Privacy policy</li></ol></nav></div>
<section class="legal" aria-labelledby="pp-h"><div class="wrap">
  <h1 id="pp-h">Privacy policy</h1>
  <p class="updated">Last updated {d}</p>
  <div class="prose">{secs}</div>
</div></section>
</main>
''' + footer()
    write('/privacy/', page)

def notfound():
    chips = ''.join(f'<a class="chip {c}" href="{a["url"]}"><span class="badge {a["badge"]}">{BADGE[a["key"]]}</span>{esc(a["name"])}</a>' for a, c in zip(APPS, ['s', 'o', 'a', 'k']))
    page = head('Page not found | Near Space', 'This page does not exist.', '/404', '/assets/og-home.jpg', {'@context': 'https://schema.org', '@type': 'WebPage', 'name': 'Page not found'},
                extra='<meta name="robots" content="noindex">\n')
    page = page.replace('<meta name="robots" content="index,follow,max-image-preview:large">\n', '')
    page += nav() + f'''<main id="main"><section class="lost"><div class="wrap">
  <p class="label">Error 404</p>
  <h1 style="margin-top:14px">Lost in space.</h1>
  <p>This page drifted out of orbit. Try one of the apps, or head back to the <a href="/" style="color:var(--orbit)">home page</a>.</p>
  <div class="chips">{chips}</div>
</div></section></main>
''' + footer()
    open(os.path.join(OUT, '404.html'), 'w').write(page)

def seo_files():
    urls = ['/'] + [a['url'] for a in APPS] + ['/guides/'] + [f'/guides/{g["slug"]}/' for g in GUIDES] + ['/privacy/']
    pri = {'/': '1.0', '/privacy/': '0.3'}
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(
        f'  <url><loc>{SITE}{u}</loc><lastmod>{TODAY}</lastmod><priority>{pri.get(u, "0.8")}</priority></url>\n' for u in urls) + '</urlset>\n'
    open(os.path.join(OUT, 'sitemap.xml'), 'w').write(sm)
    open(os.path.join(OUT, 'robots.txt'), 'w').write(f'User-agent: *\nAllow: /\nDisallow: /apps/\n\nSitemap: {SITE}/sitemap.xml\n')
    # app demos must not appear in search as separate pages
    open(os.path.join(OUT, '_headers'), 'w').write('/apps/*\n  X-Robots-Tag: noindex\n/assets/*\n  Cache-Control: public, max-age=604800\n')

def css():
    base = open(os.path.join(ROOT, 'tools', 'base.css')).read()
    extra = open(os.path.join(ROOT, 'tools', 'extra.css')).read()
    open(os.path.join(OUT, 'assets', 'site.css'), 'w').write(base + '\n' + extra)

VER = TODAY.replace('-', '') + 'j'
if __name__ == '__main__':
    css(); home(); [app_page(a) for a in APPS]; [guide_page(g) for g in GUIDES]; guides_index(); privacy(); notfound(); seo_files()
    print('built', OUT)
