/* Plaay Express: the delivery promise on the product page, in the sticky bar and the bag, and
   the "Where should we deliver?" sheet.

   The delivery app (settings.express_api) decides:
     ?areas=1                       Dubai areas and their speed
     ?q=<text>                      suggestions as the shopper types (areas, then buildings/streets)
     ?area= | ?lat=&lng=&reverse=1 | ?address=   the promise right now (+ the address at a pin)

   Where: the shopper's own pick on this device (an area, an exact address/pin, or a saved
   address; kept 30 days), else a signed-in customer's default address, else unknown.

   An exact pick also
     - goes on the cart as attributes ("Delivery area", _plx_pin) so the team, and noon, get the
       exact pin even if the checkout address has none;
     - pre-fills the checkout address (address, flat/villa, area, emirate).

   Bag lines get hidden properties: _plx (bag built here; checkout offers Express to these while
   Express is in preview) and _plx_sub (Subscribe & Save: no Express). */
(function () {
  'use strict';
  var cfg = window.PlaayExpress;
  if (!cfg || !cfg.api) return;

  var KEY = 'plx-place';
  var MAX_AGE = 30 * 24 * 3600 * 1000;
  var MAPLIBRE = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/';
  var MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'; // OpenFreeMap: free, no key
  var DUBAI = [25.08, 55.2];
  var current = null;
  var fetchedAt = 0;
  var pending = null;
  var tickTimer = null;
  var cartHasSub = false;
  var nativeFetch = window.fetch.bind(window);

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
    syncCartAttributes(p);
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
  function api(qs) {
    return nativeFetch(cfg.api + (cfg.api.indexOf('?') > -1 ? '&' : '?') + qs, { credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function refresh(force) {
    var q = query(place());
    if (!q) { current = { tier: 'unknown' }; fetchedAt = Date.now(); renderAll(); return Promise.resolve(current); }
    if (!force && current && Date.now() - fetchedAt < 60000) { renderAll(); return Promise.resolve(current); }
    if (pending) return pending;
    pending = api(q).then(function (res) {
      current = res; fetchedAt = Date.now(); renderAll(); return res;
    }).catch(function () {
      current = { tier: 'error' }; renderAll();
    }).then(function (r) { pending = null; return r; });
    return pending;
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
    if (p.kind === 'location') return [p.flat, p.label].filter(Boolean).join(', ');
    return (current && current.area && current.area.name) || p.label || '';
  }
  function subChosen() {
    var m = document.querySelector('[data-plo-mode]:checked');
    return !!(m && m.value === 'sub');
  }
  function edgeNote(c) {
    var p = place();
    return c.edge && p && p.kind === 'area'
      ? '<span class="plx__edge">Parts of ' + esc(c.area.name) + ' are just outside the Express zone. <button type="button" class="plx__link" data-plx-open="search">Add your building</button> to confirm.</span>'
      : '';
  }

  function pdpHTML() {
    var c = current || { tier: 'unknown' };
    if (c.tier === 'unknown' || c.tier === 'error') {
      return '<div class="plx__top"><span class="plx__t">⚡ Express delivery in Dubai</span>' +
        '<span class="plx__s">Today, usually within 2 hours. ' + free + '</span></div>' +
        '<div class="plx__bot"><span>' + (c.tier === 'error' ? 'Couldn’t check delivery just now.' : 'Is your address covered?') + '</span>' +
        '<button type="button" class="plx__btn" data-plx-open>Check your address</button></div>';
    }
    if (subChosen() && c.tier !== 'standard') {
      return '<div class="plx__top plx__top--muted"><span class="plx__t">📦 Subscribe &amp; Save ships in 1–2 days</span>' +
        '<span class="plx__s">Want it today? Choose one-time purchase for ' + (c.tier === 'express' ? 'Plaay Express' : '4-hour delivery') + '.</span></div>' +
        '<div class="plx__bot"><span>📍 ' + esc(placeLabel()) + '</span><button type="button" class="plx__link" data-plx-open>Change</button></div>';
    }
    var sec = secondsLeft();
    var sub = esc(c.detail || '');
    sub += c.when === 'today' && sec > 0 ? ' · order within <b class="plx__count" data-plx-count>' + left(sec) + '</b>' : ' ' + free;
    return '<div class="plx__top"><span class="plx__t">' + ICON[c.tier] + ' ' + esc(c.title) + '</span>' +
      '<span class="plx__s">' + sub + '</span>' + edgeNote(c) + '</div>' +
      '<div class="plx__bot"><span>📍 ' + esc(placeLabel()) + '</span>' +
      '<button type="button" class="plx__link" data-plx-open>Change</button></div>';
  }
  function cartHTML() {
    var c = current || { tier: 'unknown' };
    if (c.tier === 'unknown' || c.tier === 'error') {
      return '<span class="plx__t">⚡ Express delivery in Dubai, today</span>' +
        '<button type="button" class="plx__link" data-plx-open>Check your address</button>';
    }
    var name = placeLabel();
    if (cartHasSub && c.tier !== 'standard') {
      return '<span class="plx__t">📦 Delivery to ' + esc(name) + ' in 1–2 days</span>' +
        '<span class="plx__s">Express isn’t available with Subscribe &amp; Save. Switch to one-time for ' + (c.tier === 'express' ? 'Express today.' : '4-hour delivery.') + '</span>' +
        '<button type="button" class="plx__link" data-plx-open>Change address</button>';
    }
    var sec = secondsLeft();
    var head = c.tier === 'express' ? '⚡ Express to ' + esc(name) : c.tier === '4hr' ? '🕓 4-hour delivery to ' + esc(name) : '📦 ' + esc(name) + ': 1–2 working days';
    var when = c.tier === 'standard' ? '' : (c.when === 'today' ? 'today' + (sec > 0 ? ', order within <b data-plx-count>' + left(sec) + '</b>' : '') : esc(c.day || ''));
    return '<span class="plx__t">' + head + '</span>' + (when ? '<span class="plx__s">' + when + '</span>' : '') +
      (c.tier === 'standard' ? '' : '<span class="plx__s">Pick it at checkout, it’s listed first.</span>') +
      '<button type="button" class="plx__link" data-plx-open>Change address</button>';
  }
  function chipHTML() {
    var c = current || {};
    if (subChosen()) return '';
    if (c.tier === 'express') return c.when === 'today' ? '⚡ Today' : '⚡ ' + esc(c.day || '');
    if (c.tier === '4hr') return c.when === 'today' ? '🕓 Today' : '';
    return '';
  }
  function renderAll() {
    var nodes = document.querySelectorAll('[data-plx]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var mode = el.getAttribute('data-plx');
      var tier = (current && current.tier) || 'unknown';
      if (mode === 'chip') {
        var t = chipHTML();
        el.className = 'plx plx--chip';
        el.innerHTML = t;
        el.hidden = !t;
        continue;
      }
      el.className = 'plx plx--' + mode + ' plx--' + tier;
      el.innerHTML = mode === 'cart' ? cartHTML() : pdpHTML();
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

  // ---------- the bag ----------
  var cartAt = 0;
  function checkCart() {
    if (!document.querySelector('[data-plx="cart"]') || Date.now() - cartAt < 1500) return;
    cartAt = Date.now();
    nativeFetch('/cart.js', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (cart) {
      var has = (cart.items || []).some(function (i) { return !!i.selling_plan_allocation; });
      if (has !== cartHasSub) { cartHasSub = has; renderAll(); }
    }).catch(function () {});
  }
  function syncCartAttributes(p) {
    var exact = p.kind === 'location';
    var area = (exact ? p.area : p.label) || '';
    nativeFetch('/cart/update.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ attributes: { 'Delivery area': area, _plx_pin: exact ? p.lat + ',' + p.lng : '' } })
    }).catch(function () {});
  }

  // Mark lines added on this theme (_plx) and Subscribe & Save lines (_plx_sub). Lines the cart
  // scripts add for rewards (_plaay_*) are left alone.
  function mark(item) {
    var props = Object.assign({}, item.properties || {});
    if (Object.keys(props).some(function (k) { return k.indexOf('_plaay') === 0; })) return item;
    props._plx = '1';
    if (item.selling_plan) props._plx_sub = '1'; else delete props._plx_sub;
    return Object.assign({}, item, { properties: props });
  }
  function markBody(url, body) {
    if (body instanceof FormData) {
      if (/\/cart\/add/.test(url)) {
        body.set('properties[_plx]', '1');
        if (body.get('selling_plan')) body.set('properties[_plx_sub]', '1');
      }
      return body;
    }
    if (typeof body !== 'string' || body.charAt(0) !== '{') return body;
    var data = JSON.parse(body);
    if (/\/cart\/add/.test(url)) {
      if (Array.isArray(data.items)) data.items = data.items.map(mark);
      else if (data.id) data = mark(data);
      return JSON.stringify(data);
    }
    // /cart/change switching a line between one-time and Subscribe & Save.
    if (!('selling_plan' in data)) return body;
    return nativeFetch('/cart.js', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (cart) {
      var items = cart.items || [];
      var line = data.line ? items[data.line - 1] : items.filter(function (i) { return i.key === data.id || String(i.id) === String(data.id); })[0];
      if (!line) return body;
      var props = Object.assign({}, line.properties || {}, data.properties || {});
      if (data.selling_plan) props._plx_sub = '1'; else delete props._plx_sub;
      props._plx = '1';
      data.properties = props;
      return JSON.stringify(data);
    }).catch(function () { return body; });
  }
  window.fetch = function (input, init) {
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (init && init.body && /^post$/i.test(init.method || '') && /\/cart\/(add|change)(\.js)?(\?|$)/.test(url.replace(location.origin, ''))) {
        var out = markBody(url, init.body);
        if (out && typeof out.then === 'function') {
          return out.then(function (b) { return nativeFetch(input, Object.assign({}, init, { body: b })); });
        }
        return nativeFetch(input, Object.assign({}, init, { body: out }));
      }
    } catch (e) {}
    return nativeFetch(input, init);
  };

  // Checkout: pre-fill the address picked here (guests, or a new address); Shopify keeps the
  // shopper's own entry if they change it.
  function checkoutUrl(href) {
    var p = readPick();
    if (!p || p.kind === 'address') return href;
    var f = {};
    if (p.kind === 'location') {
      f.address1 = p.address1 || p.label;
      if (p.flat) f.address2 = p.flat;
      f.city = p.area || p.community || 'Dubai';
      f.province = p.emirate || 'Dubai';
    } else if (p.kind === 'area') {
      f.city = p.label;
      f.province = 'Dubai';
    }
    f.country = 'United Arab Emirates';
    var u = new URL(href, location.origin);
    Object.keys(f).forEach(function (k) { if (f[k]) u.searchParams.set('checkout[shipping_address][' + k + ']', f[k]); });
    return u.pathname + u.search;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="/checkout"]');
    if (a) a.setAttribute('href', checkoutUrl(a.getAttribute('data-checkout-url') || '/checkout'));
  }, true);

  // ---------- sheet ----------
  var sheet, lastFocus, map, chosen;
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
        '<div class="plx-sheet__head"><button type="button" class="plx-sheet__back" data-plx-view="search" aria-label="Back" hidden>←</button>' +
        '<h2 id="plx-sheet-h">Where should we deliver?</h2>' +
        '<button type="button" class="plx-sheet__x" data-plx-close aria-label="Close">✕</button></div>' +

        '<div class="plx-view" data-plx-v="search">' +
          (saved ? '<ul class="plx-list plx-list--saved">' + saved + '</ul>' : '') +
          '<label class="plx-sheet__lbl" for="plx-q">Building, street or area</label>' +
          '<input id="plx-q" class="plx-sheet__in" type="search" autocomplete="off" placeholder="e.g. Bloom Towers, JVC, Dubai Marina">' +
          '<ul class="plx-list" data-plx-results aria-live="polite"></ul>' +
          '<div class="plx-sheet__btns">' +
            (navigator.geolocation ? '<button type="button" class="plx-row plx-row--loc" data-plx-loc>📍 Use my current location</button>' : '') +
            '<button type="button" class="plx-row plx-row--loc" data-plx-view="map">🗺️ Pick on the map</button>' +
          '</div>' +
          (cfg.signedIn ? '' : '<p class="plx-sheet__note">Have an account? <a href="' + esc(cfg.loginUrl) + '">Sign in</a> to use your saved addresses.</p>') +
          '<p class="plx-sheet__note">Express: within 20 km of our Dubai kitchen, Monday to Saturday, order by 5 pm.</p>' +
        '</div>' +

        '<div class="plx-view" data-plx-v="map" hidden>' +
          '<p class="plx-sheet__note">Move the map so the pin sits on your building.</p>' +
          '<div class="plx-map"><div class="plx-map__canvas" data-plx-map></div><span class="plx-map__pin" aria-hidden="true">📍</span></div>' +
          '<button type="button" class="plx__btn plx__btn--full" data-plx-pin>Use this spot</button>' +
        '</div>' +

        '<div class="plx-view" data-plx-v="confirm" hidden>' +
          '<div class="plx-confirm" data-plx-confirm aria-live="polite"></div>' +
          '<label class="plx-sheet__lbl" for="plx-flat">Flat, villa or office no. (optional)</label>' +
          '<input id="plx-flat" class="plx-sheet__in" type="text" autocomplete="address-line2" placeholder="e.g. Apt 1203">' +
          '<button type="button" class="plx__btn plx__btn--full" data-plx-save disabled>Deliver here</button>' +
          '<button type="button" class="plx__link" data-plx-view="map">Not quite right? Adjust the pin</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(sheet);

    var input = sheet.querySelector('#plx-q');
    var timer;
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { search(input.value); }, 250); });
    sheet.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    sheet.addEventListener('click', onSheetClick);
  }

  function view(name) {
    var vs = sheet.querySelectorAll('[data-plx-v]');
    for (var i = 0; i < vs.length; i++) vs[i].hidden = vs[i].getAttribute('data-plx-v') !== name;
    sheet.querySelector('.plx-sheet__back').hidden = name === 'search';
    if (name === 'map') showMap();
    if (name === 'search') setTimeout(function () { sheet.querySelector('#plx-q').focus(); }, 30);
  }

  var lastResults = [];
  function search(q) {
    var box = sheet.querySelector('[data-plx-results]');
    q = String(q || '').trim();
    if (q.length < 2) { box.innerHTML = ''; return; }
    box.innerHTML = '<li class="plx-empty">Searching…</li>';
    api('q=' + encodeURIComponent(q)).then(function (res) {
      if (sheet.querySelector('#plx-q').value.trim() !== q) return;
      lastResults = res.results || [];
      box.innerHTML = lastResults.length ? lastResults.map(function (r, i) {
        return r.kind === 'area'
          ? '<li><button type="button" class="plx-row" data-plx-res="' + i + '"><span><b>' + esc(r.name) + '</b><small>Area</small></span>' + (TAG[r.tier] || '') + '</button></li>'
          : '<li><button type="button" class="plx-row" data-plx-res="' + i + '"><span><b>' + esc(r.address1) + '</b><small>' + esc([r.community, r.emirate].filter(Boolean).join(', ')) + '</small></span></button></li>';
      }).join('') : '<li class="plx-empty">No match. Try your building or street name, or pick on the map.</li>';
    }).catch(function () {
      box.innerHTML = '<li class="plx-empty">Couldn’t search just now. Pick on the map instead.</li>';
    });
  }

  // A spot was chosen (search result, location or map): show what it gets, ask for the flat no.
  function confirmSpot(lat, lng, known) {
    view('confirm');
    var box = sheet.querySelector('[data-plx-confirm]');
    var btn = sheet.querySelector('[data-plx-save]');
    btn.disabled = true;
    box.innerHTML = '<p class="plx-empty">Checking delivery…</p>';
    chosen = null;
    api('lat=' + lat + '&lng=' + lng + '&reverse=1').then(function (res) {
      var addr = known || res.address || {};
      chosen = {
        kind: 'location', lat: +(+lat).toFixed(5), lng: +(+lng).toFixed(5),
        address1: addr.address1 || addr.label || 'Pinned location',
        community: addr.community || '', emirate: addr.emirate || 'Dubai',
        area: (res.area && res.area.name !== 'Dubai' && res.area.name !== 'Outside Dubai' ? res.area.name : '') || addr.community || '',
        label: [addr.address1 || addr.label, addr.community].filter(Boolean).join(', ') || 'Pinned location'
      };
      box.innerHTML = '<p class="plx-confirm__addr">📍 ' + esc(chosen.label) + '</p>' +
        '<p class="plx-confirm__tier">' + (TAG[res.tier] || '') + ' ' + esc(res.title || '') + '</p>';
      btn.disabled = false;
      setTimeout(function () { sheet.querySelector('#plx-flat').focus(); }, 30);
    }).catch(function () {
      box.innerHTML = '<p class="plx-empty">Couldn’t check this spot. Try again in a moment.</p>';
    });
  }

  function showMap() {
    var el = sheet.querySelector('[data-plx-map]');
    var p = readPick();
    var exact = p && p.kind === 'location';
    loadMapLibre().then(function (ml) {
      if (!map) {
        map = new ml.Map({ container: el, style: MAP_STYLE, center: exact ? [p.lng, p.lat] : [DUBAI[1], DUBAI[0]], zoom: exact ? 16.5 : 11, attributionControl: { compact: true } });
        map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-left');
      }
      setTimeout(function () { map.resize(); }, 50);
    }).catch(function () {
      el.innerHTML = '<p class="plx-empty">The map couldn’t load. Search for your building instead.</p>';
    });
  }
  function loadMapLibre() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    return new Promise(function (resolve, reject) {
      var css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = MAPLIBRE + 'maplibre-gl.min.css';
      document.head.appendChild(css);
      var s = document.createElement('script');
      s.src = MAPLIBRE + 'maplibre-gl.min.js';
      s.onload = function () { resolve(window.maplibregl); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function onSheetClick(e) {
    var t = e.target.closest('[data-plx-close],[data-plx-view],[data-plx-res],[data-plx-addr],[data-plx-loc],[data-plx-pin],[data-plx-save]');
    if (!t) return;
    if (t.hasAttribute('data-plx-close')) return close();
    if (t.hasAttribute('data-plx-view')) return view(t.getAttribute('data-plx-view'));
    if (t.hasAttribute('data-plx-res')) {
      var r = lastResults[+t.getAttribute('data-plx-res')];
      if (!r) return;
      if (r.kind === 'area') { savePick({ kind: 'area', id: r.id, label: r.name }); return done(); }
      return confirmSpot(r.lat, r.lng, r);
    }
    if (t.hasAttribute('data-plx-addr')) {
      var a = cfg.addresses[+t.getAttribute('data-plx-addr')];
      savePick({ kind: 'address', address: a.query, label: a.label, home: a.isDefault });
      return done();
    }
    if (t.hasAttribute('data-plx-loc')) return locateMe(t);
    if (t.hasAttribute('data-plx-pin')) {
      if (!map) return;
      var c = map.getCenter();
      return confirmSpot(c.lat.toFixed(5), c.lng.toFixed(5));
    }
    if (t.hasAttribute('data-plx-save') && chosen) {
      chosen.flat = sheet.querySelector('#plx-flat').value.trim().slice(0, 80);
      savePick(chosen);
      return done();
    }
  }
  function locateMe(btn) {
    btn.disabled = true;
    btn.textContent = '📍 Finding you…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      btn.disabled = false;
      btn.textContent = '📍 Use my current location';
      confirmSpot(pos.coords.latitude.toFixed(5), pos.coords.longitude.toFixed(5));
    }, function () {
      btn.disabled = false;
      btn.textContent = '📍 Location is off. Search or pick on the map.';
    }, { timeout: 10000, maximumAge: 600000, enableHighAccuracy: true });
  }
  function tagSaved() {
    (cfg.addresses || []).forEach(function (a, i) {
      api('address=' + encodeURIComponent(a.query)).then(function (r) {
        var el = sheet.querySelector('[data-plx-addr-tag="' + i + '"]');
        if (el && TAG[r.tier]) el.innerHTML = TAG[r.tier];
      }).catch(function () {});
    });
  }
  function open(start) {
    if (!sheet) { buildSheet(); tagSaved(); }
    lastFocus = document.activeElement;
    sheet.hidden = false;
    document.documentElement.classList.add('plx-lock');
    sheet.querySelector('#plx-q').value = '';
    sheet.querySelector('[data-plx-results]').innerHTML = '';
    sheet.querySelector('#plx-flat').value = '';
    view(start === 'map' ? 'map' : 'search');
  }
  function close() {
    if (!sheet) return;
    sheet.hidden = true;
    document.documentElement.classList.remove('plx-lock');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function done() {
    close();
    refresh(true);
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-plx-open]');
    if (!t) return;
    e.preventDefault();
    open(t.getAttribute('data-plx-open'));
  });
  document.addEventListener('change', function (e) {
    if (e.target.matches && e.target.matches('[data-plo-mode]')) renderAll();
  });

  // New boxes (the bag re-renders) get the current promise.
  new MutationObserver(function () {
    if (document.querySelector('[data-plx]:not(.plx)')) renderAll();
    checkCart();
  }).observe(document.body, { childList: true, subtree: true });

  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(false); });
  window.PlaayExpress.open = open;
  refresh(false);
  checkCart();
})();
