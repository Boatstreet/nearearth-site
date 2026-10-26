/* Solar — touch gestures: pull down to refresh and swipe right to dismiss */
(function () {
  'use strict';
  const PULL_MAX = 110, PULL_GO = 64;
  // No indicator: the page follows your finger and springs back. The
  // "Updating… / Updated 20:00" line under the title shows the refresh.
  function showPull(d, tv) { tv.style.transition = 'none'; tv.style.transform = `translateY(${Math.round(d)}px)`; }
  function hidePull(tv) { if (!tv) return; tv.style.transition = 'transform .28s cubic-bezier(.2,.8,.2,1)'; tv.style.transform = ''; }

  // opts: { root, canPull(tabview) -> bool, onRefresh() -> Promise, onSwipe(id, el) }
  function init(opts) {
    let s = null, suppressClick = false;
    opts.root.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) { s = null; return; }
      const t = e.touches[0], tv = e.target.closest('.tabview');
      s = { x: t.clientX, y: t.clientY, dx: 0, dy: 0, mode: null, tv, row: e.target.closest('[data-swipe]') };
    }, { passive: true });
    opts.root.addEventListener('touchmove', (e) => {
      if (!s) return;
      const t = e.touches[0];
      s.dx = t.clientX - s.x; s.dy = t.clientY - s.y;
      if (!s.mode) {
        if (Math.abs(s.dx) < 8 && Math.abs(s.dy) < 8) return;
        if (s.row && Math.abs(s.dx) > Math.abs(s.dy) * 1.3 && s.dx > 0) s.mode = 'swipe';
        else if (s.tv && s.dy > 0 && Math.abs(s.dy) > Math.abs(s.dx) && s.tv.scrollTop <= 0 && opts.canPull(s.tv)) s.mode = 'pull';
        else s.mode = 'none';
      }
      if (s.mode === 'swipe') {
        e.preventDefault();
        const w = s.row.offsetWidth, d = Math.max(0, s.dx);
        s.row.style.transition = 'none';
        s.row.style.transform = `translateX(${d}px)`;
        s.row.style.opacity = String(1 - Math.min(0.7, d / w));
        s.row.classList.toggle('going', d > w * 0.35);
      } else if (s.mode === 'pull') {
        e.preventDefault();
        const d = Math.min(PULL_MAX, s.dy * 0.55);
        showPull(d, s.tv);
      }
    }, { passive: false });
    const end = () => {
      if (!s) return;
      const st = s; s = null;
      if (st.mode === 'swipe') {
        suppressClick = true; setTimeout(() => { suppressClick = false; }, 350);
        const row = st.row, w = row.offsetWidth;
        if (st.dx > w * 0.35) {
          row.style.transition = 'transform .2s ease, opacity .2s ease';
          row.style.transform = `translateX(${w + 20}px)`; row.style.opacity = '0';
          setTimeout(() => {
            row.style.transition = 'height .2s ease, margin .2s ease, padding .2s ease';
            row.style.height = row.offsetHeight + 'px'; row.offsetHeight; // reflow
            row.style.height = '0px'; row.style.marginBottom = '0px'; row.style.paddingTop = '0px'; row.style.paddingBottom = '0px';
            setTimeout(() => opts.onSwipe(row.dataset.swipe, row), 210);
          }, 190);
        } else {
          row.style.transition = 'transform .2s ease, opacity .2s ease';
          row.style.transform = ''; row.style.opacity = ''; row.classList.remove('going');
        }
      } else if (st.mode === 'pull') {
        const d = Math.min(PULL_MAX, st.dy * 0.55);
        if (d >= PULL_GO) opts.onRefresh();
        hidePull(st.tv);
      }
    };
    opts.root.addEventListener('touchend', end);
    opts.root.addEventListener('touchcancel', end);
    opts.root.addEventListener('click', (e) => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); } }, true);
  }

  window.Gestures = { init };
})();
