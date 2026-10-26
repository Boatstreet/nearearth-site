# Near Space website (nearspace.app)

Cloudflare publishes the `nearearth-site/` folder (see `wrangler.jsonc`) on every push to `main`.

- `tools/build.py` holds all page content and generates the HTML pages, `sitemap.xml`, `robots.txt` and `_headers`.
- `tools/og.py` renders the share images; `tools/favicon.svg` is the icon source.
- `nearearth-site/apps/` contains the four real apps that run inside the phones on the site.

To change text: edit `tools/build.py`, run `python3 tools/build.py`, commit, push.
