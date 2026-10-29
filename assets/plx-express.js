/* Plaay Express — delivery promise on the product page and in the bag, and the "Where should we
   deliver?" sheet.

   The delivery app (settings.express_api) decides: GET ?areas=1 lists Dubai areas with their
   speed; ?area=<id>, ?lat=&lng= or ?address=<text> returns the promise for that place right now
   ({ tier: express | 4hr | standard | unknown, title, detail, secondsLeft, area }).

   Which place: the shopper's own pick on this device (area, location or one of their saved
   addresses; kept 30 days), else a signed-in customer's default address, else unknown (the box
   shows the general Dubai Express message and "Check your area").

   Boxes are any [data-plx] element: data-plx="pdp" (full box) or "cart" (one line). The bag is
   re-rendered by the cart scripts, so new boxes are picked up by a MutationObserver. */
(function () {
  'use strict';
  var cfg = window.PlaayExpress;
  if (!cfg || !cfg.api) return;

  var KEY = 'plx-place';
  var MAX_AGE = 30 * 24 * 3600 * 1000;
  var current = null;      // the promise being shown
  var fetchedAt = 0;
  var pending = null;
  var areas = null;
  var tickTimer = null;

  // ---------- where ----------
  function readPick() {
    try {
      var p = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (p && Date.now() - p.at < MAX_AGE) return p;
    } catch (e) {}
    return null;
  }
  function savePick(p) {
    p.at = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
  }
  function defaultAddress() {
    var list = cfg.addresses || [];
    for (var i = 0; i < list.length; i++) if (list[i].isDefault) return list[i];
    return list[0] || null;
  }
  function place() {
    var p = readPick();
    if (p) return p;
    var a = defaultAddress();
    if (a) return { kind: 'address', address: a.query, label: a.label, home: a.isDefault };
    return null;
  }
  function query(p) {
    if (!p) return null;
    if (p.kind === 'area') return 'area=' + encodeURIComponent(p.id);
    if (p.kind === 'location') return 'lat=' + p.lat + '&lng=' + p.lng;
    if (p.kind === 'address') return 'address=' + encodeURIComponent(p.address);
    return null;
  }

  // ---------- data ----------
  function getJSON(qs) {
    return fetch(cfg.api + (cfg.api.indexOf('?') > -1 ? '&' : '?') + qs, { credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function refresh(force) {
    var q = query(place());
    if (!q) { current = { tier: 'unknown' }; fetchedAt = Date.now(); renderAll(); return Promise.resolve(current); }
    if (!force && current && Date.now() - fetchedAt < 60000) { renderAll(); return Promise.resolve(current); }
    if (pending) return pending;
    pending = getJSON(q).then(function (res) {
      current = res; fetchedAt = Date.now(); renderAll(); return res;
    }).catch(function () {
      current = { tier: 'error' }; renderAll();
    }).then(function (r) { pending = null; return r; });
    return pending;
  }
  function loadAreas() {
    if (areas) return Promise.resolve(areas);
    try {
      var c = JSON.parse(sessionStorage.getItem('plx-areas') || 'null');
      if (c) { areas = c; return Promise.resolve(areas); }
    } catch (e) {}
    return getJSON('areas=1').then(function (res) {
      areas = res.areas || [];
      try { sessionStorage.setItem('plx-areas', JSON.stringify(areas)); } catch (e) {}
      return areas;
    });
  }

  // ---------- render ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function left(sec) {
    var h = Math.floor(sec / 3600), m = Math.max(1, Math.ceil((sec % 3600) / 60));
    if (m === 60) { h += 1; m = 0; }
    return (h ? h + ' h ' : '') + (m ? m + ' min' : '');
  }
  function secondsLeft() {
    if (!current || !current.secondsLeft) return 0;
    return Math.max(0, current.secondsLeft - Math.round((Date.now() - fetchedAt) / 1000));
  }
  var ICON = { express: '⚡', '4hr': '🕓', standard: '📦', unknown: '⚡', error: '📦' };
  var free = 'Free over AED ' + (cfg.freeOver || 99) + '.';

  function placeLabel() {
    var p = place();
    if (!p) return '';
    if (p.kind === 'address') return (p.home ? 'Home · ' : '') + p.label;
    return (current && current.area && current.area.name) || p.label || '';
  }

  function pdpHTML() {
    var c = current || { tier: 'unknown' };
    if (c.tier === 'unknown' || c.tier === 'error') {
      return '<div class="plx__top"><span class="plx__t">⚡ Express delivery in Dubai</span>' +
        '<span class="plx__s">Today, usually within 2 hours. ' + free + '</span></div>' +
        '<div class="plx__bot"><span>' + (c.tier === 'error' ? 'Couldn’t check delivery just now.' : 'Is your area covered?') + '</span>' +
        '<button type="button" class="plx__btn" data-plx-open>Check your area</button></div>';
    }
    var sec = secondsLeft();
    var sub = esc(c.detail || '');
    if (c.when === 'today' && sec > 0) sub += ' · order within <b class="plx__count" data-plx-count>' + left(sec) + '</b>';
    else sub += ' ' + free;
    return '<div class="plx__top"><span class="plx__t">' + ICON[c.tier] + ' ' + esc(c.title) + '</span>' +
      '<span class="plx__s">' + sub + '</span></div>' +
      '<div class="plx__bot"><span>📍 ' + esc(placeLabel()) + '</span>' +
      '<button type="button" class="plx__link" data-plx-open>Change</button></div>';
  }
  function cartHTML() {
    var c = current || { tier: 'unknown' };
    if (c.tier === 'unknown' || c.tier === 'error') {
      return '<span class="plx__t">⚡ Express delivery in Dubai, today</span>' +
        '<button type="button" class="plx__link" data-plx-open>Check your area</button>';
    }
    var sec = secondsLeft();
    var name = c.area && c.area.name ? c.area.name : placeLabel();
    var head = c.tier === 'express' ? '⚡ Express to ' + esc(name) : c.tier === '4hr' ? '🕓 4-hour delivery to ' + esc(name) : '📦 ' + esc(name) + ': 1–2 working days';
    var when = c.tier === 'standard' ? '' : (c.when === 'today' ? 'today' + (sec > 0 ? ', order within <b data-plx-count>' + left(sec) + '</b>' : '') : esc(c.title.split('· ')[1] || ''));
    return '<span class="plx__t">' + head + '</span>' + (when ? '<span class="plx__s">' + when + '</span>' : '') +
      '<span class="plx__s">You’ll pick the speed at checkout.</span>' +
      '<button type="button" class="plx__link" data-plx-open>Change area</button>';
  }
  function renderAll() {
    var nodes = document.querySelectorAll('[data-plx]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var tier = (current && current.tier) || 'unknown';
      el.className = 'plx plx--' + el.getAttribute('data-plx') + ' plx--' + tier;
      el.innerHTML = el.getAttribute('data-plx') === 'cart' ? cartHTML() : pdpHTML();
      el.hidden = false;
    }
    clearInterval(tickTimer);
    if (secondsLeft() > 0) tickTimer = setInterval(tick, 30000);
  }
  function tick() {
    var sec = secondsLeft();
    if (sec <= 0) { refresh(true); return; }
    var c = document.querySelectorAll('[data-plx-count]');
    for (var i = 0; i < c.length; i++) c[i].textContent = left(sec);
  }

  // ---------- sheet ----------
  var sheet, lastFocus;
  var TAG = { express: '<span class="plx-tag plx-tag--x">⚡ Express</span>', '4hr': '<span class="plx-tag plx-tag--h">🕓 4-hour</span>', standard: '<span class="plx-tag">1–2 days</span>' };

  function buildSheet() {
    sheet = document.createElement('div');
    sheet.className = 'plx-sheet';
    sheet.hidden = true;
    var saved = (cfg.addresses || []).map(function (a, i) {
      return '<li><button type="button" class="plx-row" data-plx-addr="' + i + '"><span><b>' + esc(a.isDefault ? 'Default address' : 'Saved address') + '</b> · ' + esc(a.label) + '</span><span data-plx-addr-tag="' + i + '"></span></button></li>';
    }).join('');
    sheet.innerHTML =
      '<div class="plx-sheet__dim" data-plx-close></div>' +
      '<div class="plx-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="plx-sheet-h">' +
        '<div class="plx-sheet__head"><h2 id="plx-sheet-h">Where should we deliver?</h2>' +
        '<button type="button" class="plx-sheet__x" data-plx-close aria-label="Close">✕</button></div>' +
        (saved ? '<ul class="plx-list plx-list--saved">' + saved + '</ul>' : '') +
        '<label class="plx-sheet__lbl" for="plx-q">Your area or community</label>' +
        '<input id="plx-q" class="plx-sheet__in" type="search" autocomplete="off" placeholder="e.g. JVC, Dubai Marina, Al Qusais">' +
        (navigator.geolocation ? '<button type="button" class="plx-row plx-row--loc" data-plx-loc>📍 Use my current location</button>' : '') +
        '<ul class="plx-list" data-plx-results aria-live="polite"></ul>' +
        (cfg.signedIn ? '' : '<p class="plx-sheet__note">Have an account? <a href="' + esc(cfg.loginUrl) + '">Sign in</a> to use your saved address.</p>') +
        '<p class="plx-sheet__note">Express: Dubai, Monday to Saturday, order by 5 pm. You’ll confirm at checkout.</p>' +
      '</div>';
    document.body.appendChild(sheet);
    var input = sheet.querySelector('#plx-q');
    input.addEventListener('input', function () { list(input.value); });
    sheet.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    sheet.addEventListener('click', function (e) {
      var t = e.target.closest('[data-plx-close],[data-plx-area],[data-plx-addr],[data-plx-loc]');
      if (!t) return;
      if (t.hasAttribute('data-plx-close')) return close();
      if (t.hasAttribute('data-plx-area')) {
        savePick({ kind: 'area', id: t.getAttribute('data-plx-area'), label: t.getAttribute('data-name') });
        return choose();
      }
      if (t.hasAttribute('data-plx-addr')) {
        var a = cfg.addresses[+t.getAttribute('data-plx-addr')];
        savePick({ kind: 'address', address: a.query, label: a.label, home: a.isDefault });
        return choose();
      }
      if (t.hasAttribute('data-plx-loc')) locate(t);
    });
  }
  var POPULAR = ['dubai-marina', 'jumeirah-village-circle-jvc', 'downtown-dubai', 'business-bay', 'arabian-ranches', 'sharjah'];
  function list(q) {
    var box = sheet.querySelector('[data-plx-results]');
    loadAreas().then(function (all) {
      q = String(q || '').trim().toLowerCase();
      var hits = q
        ? all.filter(function (a) { return a.name.toLowerCase().indexOf(q) > -1; }).slice(0, 8)
        : POPULAR.map(function (id) { return all.filter(function (a) { return a.id === id; })[0]; }).filter(Boolean);
      box.innerHTML = hits.length ? hits.map(function (a) {
        return '<li><button type="button" class="plx-row" data-plx-area="' + esc(a.id) + '" data-name="' + esc(a.name) + '"><span>' + esc(a.name) + '</span>' + TAG[a.tier] + '</button></li>';
      }).join('') : '<li class="plx-empty">No match yet. Try your community name, or use your location.</li>';
    }).catch(function () {
      box.innerHTML = '<li class="plx-empty">Couldn’t load areas. Check your connection and try again.</li>';
    });
  }
  function locate(btn) {
    btn.disabled = true;
    btn.textContent = '📍 Finding you…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      savePick({ kind: 'location', lat: +pos.coords.latitude.toFixed(4), lng: +pos.coords.longitude.toFixed(4), label: 'Your location' });
      choose();
    }, function () {
      btn.disabled = false;
      btn.textContent = '📍 Location is off. Type your area instead.';
    }, { timeout: 10000, maximumAge: 600000 });
  }
  function tagSaved() {
    (cfg.addresses || []).forEach(function (a, i) {
      getJSON('address=' + encodeURIComponent(a.query)).then(function (r) {
        var el = sheet.querySelector('[data-plx-addr-tag="' + i + '"]');
        if (el && TAG[r.tier]) el.innerHTML = TAG[r.tier];
      }).catch(function () {});
    });
  }
  function open() {
    if (!sheet) { buildSheet(); tagSaved(); }
    lastFocus = document.activeElement;
    sheet.hidden = false;
    document.documentElement.classList.add('plx-lock');
    list('');
    var input = sheet.querySelector('#plx-q');
    input.value = '';
    setTimeout(function () { input.focus(); }, 30);
  }
  function close() {
    if (!sheet) return;
    sheet.hidden = true;
    document.documentElement.classList.remove('plx-lock');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function choose() {
    close();
    refresh(true);
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-plx-open]');
    if (!t) return;
    e.preventDefault();
    open();
  });

  // New boxes (bag re-renders) get the current promise.
  var seen = 0;
  new MutationObserver(function () {
    var n = document.querySelectorAll('[data-plx]:not(.plx)').length;
    if (n && n !== seen) { seen = n; renderAll(); } else if (!n) seen = 0;
  }).observe(document.body, { childList: true, subtree: true });

  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(false); });
  window.PlaayExpress.open = open;
  refresh(false);
})();
