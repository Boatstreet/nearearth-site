/* First-run tour: after the opening animation on a fresh install, a short spotlight walk through each tab.
   Skippable at any step; can be replayed from Settings › Take the tour. */
(function () {
'use strict';
var app, el, hole, card, i = 0, steps = [], active = false;
function $(id) { return document.getElementById(id); }
function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

function build() {
  var pro = app.PRO;
  steps = [
    { title: 'Welcome to Asteroids & Meteors', text: 'Every asteroid passing Earth and every meteor shower overhead, live from NASA/JPL. Here’s a one-minute tour.', icon: true },
    { tab: 'radar', target: '#radar', title: 'Radar', text: 'The next seven days around Earth. Each dot is a flyby, placed by day around the dial and by distance from the centre. The highlighted one passes next.' },
    { tab: 'radar', target: '#r-zoom', title: 'Zoom in', text: 'Switch between all flybys, those within 5 Moon distances, and the few that pass inside the Moon’s orbit.' },
    { tab: 'up', target: '#ev-box', title: 'Around Earth', text: pro ? 'Each flyby in 3D on its real path past Earth. Slide your finger across to move the asteroid; use the arrows for the next one.' : 'The next flyby in 3D on its real path past Earth, with the Moon and the real stars behind.' },
    { tab: 'up', target: '#u-range', title: 'Every close approach', text: 'The full list for the next 7, 30 or 60 days, with filters for close, big, fast and hazardous. Tap any asteroid for its 3D flyby.' },
    { tab: 'orbit', target: '#orbitbox', title: 'Orbit', text: 'Any asteroid’s path around the Sun, with the planets. Press play to watch a year go by, or drag to explore.' },
    { tab: 'meteor', target: '#m-box', title: 'Meteors', text: 'The shower that’s active now, drawn on your own sky. Meteors stream from the real radiant at their real speed. Tap the sky for a fireball.' },
    { tab: 'meteor', target: '.tabbar [data-tab="sky"]', title: 'Sky', text: 'Hold your phone up to the sky and see where the asteroids are among the stars.' + (pro ? ' Turn on the camera to see them over the live view.' : '') },
    { tab: 'meteor', target: '.tabbar [data-tab="risk"]', title: 'Risk', text: 'NASA’s Sentry list of asteroids with any chance of hitting Earth, and what the risk scales mean.' },
    { tab: 'meteor', target: '.tabbar [data-tab="hist"]', title: 'History', text: 'Every recorded flyby from 1900 to 2200, by day, plus fireballs seen over the Earth.' },
    { tab: 'radar', target: '#p-radar .top [data-act="guide"]', title: 'Help is always here', text: 'Tap ⓘ for the guide, ⚙ for alerts and units. Pull down on any page to refresh.' },
    pro ? { title: 'You’re all set', text: 'Pro is unlocked: every flyby in 3D, the camera sky, meteor reminders and custom alerts. Clear skies! You can take this tour again from Settings.', icon: true, last: true }
        : { title: 'Want more?', text: 'The Pro upgrade adds every flyby in 3D, the full flyby ride, the camera sky, meteor reminders, custom alerts and all three widgets.', icon: true, last: true, pro: true }
  ];
}

function make() {
  el = document.createElement('div'); el.id = 'tour'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = '<div class="t-hole"></div><div class="t-card"><div class="t-icon"><svg viewBox="0 0 64 64" width="64" height="64"><defs><radialGradient id="tg1" cx="35%" cy="30%"><stop offset="0" stop-color="#5a4bb8"/><stop offset="1" stop-color="#1e1650"/></radialGradient><radialGradient id="tg2" cx="35%" cy="30%"><stop offset="0" stop-color="#9fd6ff"/><stop offset="1" stop-color="#2a76d6"/></radialGradient></defs><circle cx="32" cy="32" r="31" fill="url(#tg1)"/><path d="M4 40 Q32 14 62 24" stroke="#c9bfff" stroke-width="1.6" fill="none" opacity=".8"/><circle cx="16" cy="44" r="8" fill="url(#tg2)"/><path d="M36 18l7-4 8 2 4 7-2 8-7 4-8-2-4-7z" fill="#9b8f80"/><circle cx="43" cy="22" r="2" fill="#6d645a"/><circle cx="48" cy="29" r="1.5" fill="#6d645a"/></svg></div><p class="t-step"></p><h3></h3><p class="t-text"></p><div class="t-dots"></div><div class="t-btns"><button class="t-skip">Skip</button><span></span><button class="t-back">Back</button><button class="t-next">Next</button></div></div>';
  document.body.appendChild(el);
  hole = el.querySelector('.t-hole'); card = el.querySelector('.t-card');
  el.querySelector('.t-skip').onclick = function () { end(); };
  el.querySelector('.t-back').onclick = function () { go(i - 1); };
  el.querySelector('.t-next').onclick = function () { var s = steps[i]; if (s.last) { end(); if (s.pro) app.openPro(); } else go(i + 1); };
  el.addEventListener('click', function (e) { if (e.target === el || e.target === hole) e.stopPropagation(); });
  addEventListener('resize', function () { if (active) place(); });
}
function go(n) {
  i = Math.max(0, Math.min(steps.length - 1, n)); var s = steps[i];
  if (s.tab && app.cur() !== s.tab) app.show(s.tab);
  card.querySelector('.t-step').textContent = i && !s.last ? 'Step ' + i + ' of ' + (steps.length - 2) : '';
  card.querySelector('h3').textContent = s.title; card.querySelector('.t-text').textContent = s.text;
  card.querySelector('.t-icon').hidden = !s.icon;
  card.querySelector('.t-dots').innerHTML = steps.map(function (_, k) { return '<i' + (k === i ? ' class="on"' : '') + '></i>'; }).join('');
  el.querySelector('.t-back').style.visibility = i ? 'visible' : 'hidden';
  var nx = el.querySelector('.t-next'); nx.textContent = i === 0 ? 'Start' : s.last ? (s.pro ? 'See Pro' : 'Done') : 'Next'; nx.classList.toggle('gold', !!s.pro);
  el.querySelector('.t-skip').textContent = s.last ? (s.pro ? 'Not now' : '') : 'Skip';
  el.querySelector('.t-skip').style.visibility = s.last && !s.pro ? 'hidden' : 'visible';
  card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
  var t = s.target && document.querySelector(s.target);
  if (t && s.tab && !t.closest('.tabbar')) t.scrollIntoView({ block: 'center' });
  setTimeout(place, t ? 60 : 0);
}
function place() {
  var s = steps[i], t = s.target && document.querySelector(s.target), W = innerWidth, H = innerHeight;
  if (!t) { hole.style.cssText = 'left:' + W / 2 + 'px;top:' + H / 2 + 'px;width:0;height:0;border-color:transparent'; card.style.top = Math.max(20, H / 2 - card.offsetHeight / 2) + 'px'; return; }
  var r = t.getBoundingClientRect(), pad = 8;
  hole.style.cssText = 'left:' + (r.left - pad) + 'px;top:' + (r.top - pad) + 'px;width:' + (r.width + pad * 2) + 'px;height:' + (r.height + pad * 2) + 'px;opacity:1';
  var ch = card.offsetHeight, below = r.bottom + pad + 14, above = r.top - pad - 14 - ch;
  card.style.top = (below + ch < H - 12 ? below : above > 12 ? above : Math.max(12, H - ch - 96)) + 'px';
}
function start(again) {
  if (active) return; app = window.APP; if (!app) return;
  build(); if (!el) make(); active = true; el.hidden = false; document.body.classList.add('touring'); go(0);
}
function end() {
  active = false; el.hidden = true; document.body.classList.remove('touring'); ls('tourDone', '1');
  if (app.cur() !== 'radar') app.show('radar'); window.scrollTo(0, 0);
}
window.Tour = { start: start, end: end, active: function () { return active; }, step: function () { return i; } };

// first launch: wait for the opening animation to finish, then begin
if (!ls('tourDone') && !window.__NOTOUR) {
  var wait = setInterval(function () { if (!document.getElementById('intro') && window.APP) { clearInterval(wait); setTimeout(function () { start(); }, 350); } }, 250);
}
})();
