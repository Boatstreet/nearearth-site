/* Solar — line icons (24px grid) */
(function () {
  'use strict';
  const P = {
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>',
    spots: '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1.6" fill="currentColor"/><circle cx="14.5" cy="13.5" r="2.1" fill="currentColor"/><circle cx="15.5" cy="8.5" r=".9" fill="currentColor"/>',
    pulse: '<path d="M2.5 12.5h4l2.4-6 4.2 12 2.6-7.2 1.6 1.2h4.2"/>',
    bolt: '<path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.5 2.5a7.6 7.6 0 0 0-2.6 1.5l-2.3-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.3-.9a7.6 7.6 0 0 0 2.6 1.5l.5 2.5h4l.5-2.5a7.6 7.6 0 0 0 2.6-1.5l2.3.9 2-3.4z"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4.5V11h-6.5"/>',
    gps: '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    right: '<path d="m9 5 7 7-7 7"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    wind: '<path d="M3 8.5h11a3 3 0 1 0-3-3M3 12.5h16a3 3 0 1 1-3 3M3 16.5h8"/>',
    magnet: '<path d="M6 3.5v8a6 6 0 0 0 12 0v-8h-4v8a2 2 0 0 1-4 0v-8z"/><path d="M6 7.5h4M14 7.5h4"/>',
    aurora: '<path d="M3 20c2-6 3-12 4-15M8 20c1.5-5 3-10 5-14M13 20c1-4 3-8 6-11"/><path d="M2.5 20.5h19"/>',
    alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    density: '<circle cx="7" cy="8" r="1.4"/><circle cx="14" cy="6" r="1.4"/><circle cx="17" cy="13" r="1.4"/><circle cx="9" cy="15" r="1.4"/><circle cx="13" cy="19" r="1.4"/><circle cx="5" cy="19" r="1.4"/>',
    cycle: '<path d="M2.5 17c2.5 0 3.5-11 6-11s3.5 11 6 11 3.5-11 6-11"/>',
    cme: '<circle cx="7" cy="12" r="3.5"/><path d="M12.5 7.5c2 1.2 3 2.7 3 4.5s-1 3.3-3 4.5M16 5c3 1.7 4.5 4 4.5 7S19 17.3 16 19"/>',
    thermo: '<path d="M10 4.5a2 2 0 0 1 4 0v9.2a4 4 0 1 1-4 0z"/><path d="M12 10v6"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12.5 9 5 9-5"/><path d="m3 16.5 9 5 9-5" opacity=".5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    link: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r="2"/>',
    book: '<path d="M12 6.5c-1.8-1.6-4.5-2-8-1.8v13.5c3.5-.2 6.2.2 8 1.8 1.8-1.6 4.5-2 8-1.8V4.7c-3.5-.2-6.2.2-8 1.8z"/><path d="M12 6.5V20"/>',
    eclipse: '<circle cx="12" cy="12" r="8.5"/><path d="M15.2 4.1a8.5 8.5 0 0 1 0 15.8 8.5 8.5 0 0 1 0-15.8z" fill="currentColor"/>',
    incoming: '<circle cx="17.5" cy="12" r="3.3"/><path d="M2.5 12h10M9.5 8.5 13 12l-3.5 3.5M4 7.5h4M4 16.5h4"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    widget: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="3.5" y="13" width="17" height="7.5" rx="2"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    earth: '<circle cx="12" cy="12" r="9"/><path d="M5.2 7.2c1.6.2 2.6 1.1 2.4 2.4-.2 1.2.9 2 2.1 2.1 1.4.2 1.7 1.5 1.1 2.7-.5 1.1.2 2.3 1 3.1M14 3.3c-.5 1.2.3 2.2 1.5 2.4 1.3.3 1.6 1.5 1.1 2.6-.4 1 .4 1.9 1.6 1.9h1.6M15.5 20.2c.2-1.3 1.2-2.1 2.5-2.3"/>',
    trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
  };
  window.ic = function (n, cls) {
    return '<span class="ic' + (cls ? ' ' + cls : '') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (P[n] || '') + '</svg></span>';
  };
})();
