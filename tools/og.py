#!/usr/bin/env python3
"""Renders the 1200x630 share images into nearearth-site/assets/.
Needs: a local server on :8801 serving nearearth-site/ (for the fonts) and app screenshots in /root/work/og_<app>.png."""
import base64, sys
from playwright.sync_api import sync_playwright

SHOTS = sys.argv[1] if len(sys.argv) > 1 else '/root/work'
OUT = '/home/claude/nearearth-site/nearearth-site/assets'
def b64(p): return 'data:image/png;base64,' + base64.b64encode(open(p, 'rb').read()).decode()
FONT = """@font-face{font-family:Sora;font-weight:700;src:url(/apps/sky/fonts/sora-latin-700-normal.woff2)}@font-face{font-family:Inter;src:url(/apps/sky/fonts/inter-latin-500-normal.woff2)}@font-face{font-family:JM;src:url(/apps/sky/fonts/jetbrains-mono-latin-400-normal.woff2)}"""
CSS = FONT + """*{box-sizing:border-box}body{margin:0;width:1200px;height:630px;overflow:hidden;background:radial-gradient(900px 600px at 85% 20%,rgba(255,150,70,.18),transparent 60%),radial-gradient(700px 500px at 10% 100%,rgba(92,184,255,.14),transparent 60%),#0b0f1f;color:#e9ecf7;font-family:Inter,sans-serif;position:relative}
.st{position:absolute;inset:0}
.txt{position:absolute;left:72px;top:0;bottom:0;width:600px;display:flex;flex-direction:column;justify-content:center;gap:22px}
.brand{display:flex;align-items:center;gap:12px;font-family:Sora;font-weight:700;font-size:22px;letter-spacing:.02em}
h1{margin:0;font-family:Sora;font-weight:700;font-size:64px;line-height:1.04;letter-spacing:-.01em}
p{margin:0;font-size:26px;line-height:1.35;color:#b8c0e0;max-width:540px}
.url{font-family:JM;font-size:20px;color:#9aa3c7;letter-spacing:.04em}
.badge{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;box-shadow:inset 0 -5px 10px rgba(0,0,0,.35)}
.badge svg{width:34px;height:34px}
.phone{position:absolute;width:300px;border-radius:44px;padding:10px;background:linear-gradient(160deg,#3a4064,#14182c 40%,#2a3050);box-shadow:0 30px 70px rgba(0,0,0,.55),0 0 0 1px #3b4370}
.phone img{display:block;width:100%;border-radius:34px}
"""
BADGE = {'solar': ('radial-gradient(circle at 35% 30%,#ffa94d,#ff6b3d)', '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="3.4" fill="#fff"/><g stroke="#fff" stroke-width="1.5" stroke-linecap="round"><path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9 13 13M3 13l1.1-1.1M11.9 4.1 13 3"/></g></svg>'),
         'overhead': ('radial-gradient(circle at 35% 30%,#5cb8ff,#2d7dff)', '<svg viewBox="0 0 16 16"><rect x="6" y="6" width="4" height="4" rx="1" fill="#fff"/><rect x="1" y="6.6" width="4" height="2.8" fill="#fff"/><rect x="11" y="6.6" width="4" height="2.8" fill="#fff"/></svg>'),
         'asteroids': ('radial-gradient(circle at 35% 30%,#b9a0ff,#7f5cff)', '<svg viewBox="0 0 16 16"><path d="M5 4.5 9.5 3l3 3-.5 4.5L8 13l-4-2-1-3.5z" fill="#fff"/></svg>'),
         'sky': ('radial-gradient(circle at 35% 30%,#4fe0d2,#139e9a)', '<svg viewBox="0 0 16 16"><path d="M2.5 5.5a7 7 0 0 0 8 8z" fill="#fff"/><path d="M6.5 9.5 11 5" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><circle cx="11.6" cy="4.4" r="1.4" fill="#fff"/><path d="M5 14h5" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></svg>')}
MARK = open('/home/claude/nearearth-site/tools/favicon.svg').read().replace('<svg ', '<svg width="40" height="40" ')
import random
_r = random.Random(7)
STARS = '<svg class="st" viewBox="0 0 1200 630">' + ''.join(f'<circle cx="{_r.uniform(0,1200):.1f}" cy="{_r.uniform(0,630):.1f}" r="{_r.uniform(.5,1.5):.2f}" fill="#dfe6ff" opacity="{_r.uniform(.15,.7):.2f}"/>' for i in range(150)) + '</svg>'
PAGES = {'solar': ('Solar', 'Space weather, the aurora and sunspots, live.', 'solar'),
         'overhead': ('Overhead', 'Every ISS and satellite pass over you, rated.', 'overhead'),
         'asteroids-meteors': ('Asteroids &amp; Meteors', 'Every asteroid passing Earth, on a live radar.', 'asteroids'),
         'sky': ('Sky', 'Stargazing, with the search for alien signals.', 'sky')}

with sync_playwright() as pw:
    b = pw.chromium.launch(); pg = b.new_page(viewport={'width': 1200, 'height': 630})
    def shoot(html, path):
        pg.goto('http://localhost:8801/404.html'); pg.set_content(html); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(300)
        pg.screenshot(path=path.replace('.png', '.jpg'), type='jpeg', quality=86)
    for slug, (name, line, k) in PAGES.items():
        bg, svg = BADGE[k]
        shoot(f"""<html><head><style>{CSS}</style></head><body>{STARS}<div class="txt"><div class="brand">{MARK}Near Space</div><div class="badge" style="background:{bg}">{svg}</div><h1>{name}</h1><p>{line}</p><div class="url">nearspace.app/{slug}</div></div>
        <div class="phone" style="right:120px;top:60px;transform:rotate(4deg)"><img src="{b64(f'{SHOTS}/og_{k}.png')}"></div></body></html>""", f'{OUT}/og-{slug}.png')
    phones = ''.join(f'<div class="phone" style="width:210px;left:{600+i*140}px;top:{70+(i%2)*40}px;transform:rotate({-6+i*4}deg);z-index:{i}"><img src="{b64(f"{SHOTS}/og_{k}.png")}"></div>' for i, k in enumerate(['solar', 'overhead', 'asteroids', 'sky']))
    shoot(f"""<html><head><style>{CSS}</style></head><body>{STARS}<div class="txt" style="width:500px"><div class="brand">{MARK}Near Space</div><h1 style="font-size:50px">Know what's happening above you.</h1><p style="font-size:24px">Four Android apps: space weather, ISS passes, asteroids and the night sky.</p><div class="url">nearspace.app</div></div>{phones}</body></html>""", f'{OUT}/og-home.png')
    b.close()
print('og done')
