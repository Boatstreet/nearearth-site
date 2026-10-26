#!/usr/bin/env python3
"""Captures screens and a short tour video of each app (served on :8801). Output: /root/work/caps, /root/work/vid"""
import os, glob, shutil, sys
from playwright.sync_api import sync_playwright
PLAN = {
 'solar': ['Sun', 'Events', 'Activity', 'Earth', 'Aurora', 'Eclipse'],
 'overhead': ['Now', 'Passes', 'Sky', 'Radar', 'Satellites'],
 'asteroids': ['Radar', 'Upcoming', 'Orbit', 'Meteors', 'Risk', 'History'],
 'sky': ['Tonight', 'Sky', 'Listen', 'Signals', 'Calendar'],
}
def tab(pg, name):
    pg.evaluate("""(n)=>{const bs=[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().top>820&&b.textContent.trim()===n);if(bs.length)bs[bs.length-1].click();}""", name)
def route(r): return r.continue_() if r.request.url.startswith('http://localhost') else r.abort()
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--use-gl=swiftshader', '--ignore-gpu-blocklist'])
    for app, tabs in PLAN.items():
        if len(sys.argv) > 1 and app not in sys.argv[1:]: continue
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2, has_touch=True); ctx.route('**/*', route)
        pg = ctx.new_page(); pg.goto(f'http://localhost:8801/apps/{app}/index.html'); pg.wait_for_timeout(8000)
        for i, t in enumerate(tabs):
            tab(pg, t); pg.wait_for_timeout(3500)
            pg.screenshot(path=f'/root/work/caps/{app}-{i}.png')
        ctx.close()
        # tour video (1x scale)
        vd = f'/root/work/vid/{app}'; shutil.rmtree(vd, ignore_errors=True)
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, record_video_dir=vd, record_video_size={'width': 412, 'height': 916}); ctx.route('**/*', route)
        pg = ctx.new_page(); pg.goto(f'http://localhost:8801/apps/{app}/index.html'); pg.wait_for_timeout(7000)
        for t in tabs[1:] + tabs[:1]:
            tab(pg, t); pg.wait_for_timeout(2600)
        ctx.close()
    b.close()
print('captured')
