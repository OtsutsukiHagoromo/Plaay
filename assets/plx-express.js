/* Plaay Express: the delivery promise on the product page, in the sticky bar and the bag, and
   the "Where should we deliver?" sheet.

   The delivery app (settings.express_api) decides:
     ?areas=1                       Dubai areas and their speed
     ?q=<text>                      suggestions as the shopper types (areas, then buildings/streets)
     ?area= | ?lat=&lng=&reverse=1 | ?address=   the promise right now (+ the address at a pin)

   Where: the shopper's own pick on this device (an area, an exact address/pin, or a saved
   address; kept 30 days), else a signed-in customer's default address, else unknown.

   An exact pick (pin confirmed on the map, then building / flat / street) also
     - goes on every bag line as _plx_pin, which checkout's rate check uses when the checkout
       address is in the same place, and on the cart as attributes for the team and noon;
     - pre-fills the checkout address (building and street, flat/villa, area, emirate).
   The pin is optional: an area or a saved address still gets Express when it is in range, and
   checkout (Apple Pay / Google Pay too) judges the typed address. The box only suggests it.

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
  // Express: AED 15, free from AED 199 (Standard delivery is free from AED 99, set in Shopify).
  var minAed = cfg.expressFreeOver || 199;
  var fee = cfg.expressFee || 15;
  var free = 'AED ' + fee + ', or free on orders of AED ' + minAed + '+.';
  var cartTotal = null; // fils, from /cart.js

  function placeLabel() {
    var p = place();
    if (!p) return '';
    if (p.kind === 'address') return (p.home ? 'Home · ' : '') + p.label;
    if (p.kind === 'location') return (p.tag ? p.tag + ' · ' : '') + [p.flat, p.label].filter(Boolean).join(', ');
    return (current && current.area && current.area.name) || p.label || '';
  }
  function subChosen() {
    var m = document.querySelector('[data-plo-mode]:checked');
    return !!(m && m.value === 'sub');
  }
  // No exact pin yet (an area, or a saved address): suggest one, never require it.
  function edgeNote(c) {
    var p = place();
    if (!p || p.kind === 'location' || c.tier === 'unknown' || c.tier === 'error') return '';
    if (c.edge && c.tier === 'express') {
      return '<span class="plx__edge">Parts of ' + esc(c.area.name) + ' are right at the edge of the Express zone. <button type="button" class="plx__link" data-plx-open="pin">Pin your building</button> to be sure.</span>';
    }
    // Outside Express: a pin only matters where part of the area may be in range.
    if (c.tier !== 'express') {
      return c.edge ? '<span class="plx__edge">Live in a part of ' + esc(c.area.name) + ' closer to us? <button type="button" class="plx__link" data-plx-open="pin">Pin your building</button> to check Express.</span>' : '';
    }
    return '<span class="plx__edge"><button type="button" class="plx__link" data-plx-open="pin">Pin your building</button> <span class="plx__opt">optional, helps the rider find you</span></span>';
  }

  // ---------- look ----------
  // Line icons (brand style, currentColor) instead of emoji.
  var SVG = function (d, extra) { return '<svg class="plx-i" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + d + '</svg>'; };
  var I = {
    bolt: SVG('<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" fill="currentColor" stroke="none"/>'),
    truck: SVG('<path d="M3 6h11v9H3zM14 9h4l3 3v3h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>'),
    pin: SVG('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
    clock: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    check: SVG('<path d="m5 12 5 5 9-10"/>'),
    locate: SVG('<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
    map: SVG('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>'),
    search: SVG('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    home: SVG('<path d="M3 11 12 4l9 7M5 10v10h14V10"/>')
  };

  // now: Express goes out today; soon: Express, but from 9 am / tomorrow; std: 1–2 days.
  function stateOf(c) {
    if (!c || c.tier === 'unknown' || c.tier === 'error') return c && c.tier === 'error' ? 'error' : 'unknown';
    if (c.tier === 'standard') return 'std';
    if (subChosen()) return 'sub';
    return c.when === 'today' && !c.beforeOpen ? 'now' : 'soon';
  }
  function whenLabel(c) { return ((c.title || '').split('· ')[1] || c.day || '').replace(/^\w/, function (x) { return x.toLowerCase(); }); }
  function shortPlace() {
    var p = place();
    if (!p) return '';
    if (p.kind === 'location') return p.area || p.community || (p.label || '').split(',')[0];
    return (p.label || '').split(',')[0];
  }
  var priceLine = function () { return 'AED&nbsp;' + fee + ' · free from AED&nbsp;' + minAed; };
  // How far the bag is from free Express (only once we know the bag).
  function progressHTML() {
    if (cartTotal == null || cartTotal <= 0) return '';
    if (cartTotal >= minAed * 100) return '<span class="plx__prog plx__prog--ok">' + I.check + 'Free Express on your bag</span>';
    var gap = Math.ceil((minAed * 100 - cartTotal) / 100);
    var pct = Math.max(4, Math.min(100, Math.round(cartTotal / (minAed * 100) * 100)));
    return '<span class="plx__prog"><span class="plx__bar"><i style="width:' + pct + '%"></i></span>AED ' + gap + ' more for free Express</span>';
  }

  function pdpHTML() {
    var c = current || { tier: 'unknown' };
    var st = stateOf(c);
    if (st === 'unknown' || st === 'error') {
      return '<div class="plx__top"><span class="plx__t">' + I.bolt + 'Express delivery in Dubai</span>' +
        '<span class="plx__s">Within 2 hours, order by 5 pm Mon–Sat · ' + priceLine() + '</span></div>' +
        '<div class="plx__bot"><span class="plx__q">' + (st === 'error' ? 'Couldn’t check just now.' : 'Does it reach you?') + '</span>' +
        '<button type="button" class="plx__btn plx__btn--ghost" data-plx-open>' + I.pin + 'Check address</button></div>';
    }
    var head, sub;
    if (st === 'sub') {
      head = I.truck + 'Subscribe &amp; Save ships in 1–2 days';
      sub = 'Want it today? Choose one-time purchase for Express.';
    } else if (st === 'now') {
      var sec = secondsLeft();
      head = I.bolt + 'Express today' + (sec > 0 ? ' · order within <b class="plx__count" data-plx-count>' + left(sec) + '</b>' : '');
      sub = 'Arrives within 2 hours · ' + priceLine();
    } else if (st === 'soon') {
      head = I.clock + 'Express ' + esc(whenLabel(c));
      sub = (c.beforeOpen ? 'Riders start at 9 am, yours goes in the first run' : 'Order now, it goes out first thing') + ' · ' + priceLine();
    } else {
      head = I.truck + 'Standard delivery · 1–2 days';
      sub = 'Free from AED ' + (cfg.freeOver || 99) + ' · ' + esc(c.detail || '');
    }
    return '<div class="plx__top"><span class="plx__t">' + head + '</span>' +
      '<span class="plx__s">' + sub + '</span>' + (st === 'now' || st === 'soon' ? progressHTML() : '') + edgeNote(c) + '</div>' +
      '<div class="plx__bot"><span class="plx__addr">' + I.pin + esc(placeLabel()) + '</span>' +
      '<button type="button" class="plx__link" data-plx-open>Change</button></div>';
  }
  function cartHTML() {
    var c = current || { tier: 'unknown' };
    var st = cartHasSub && c.tier !== 'standard' && c.tier !== 'unknown' && c.tier !== 'error' ? 'sub' : stateOf(c);
    if (st === 'unknown' || st === 'error') {
      return '<span class="plx__row"><span class="plx__t">' + I.bolt + 'Express in Dubai, within 2 hours</span>' +
        '<button type="button" class="plx__link" data-plx-open>Check address</button></span>';
    }
    var name = esc(shortPlace());
    var head;
    if (st === 'sub') head = I.truck + 'Standard to ' + name + ' · 1–2 days';
    else if (st === 'now') {
      var sec = secondsLeft();
      head = I.bolt + 'Express today to ' + name + (sec > 0 ? ' · <b data-plx-count>' + left(sec) + '</b>' : '');
    } else if (st === 'soon') head = I.clock + 'Express ' + esc(whenLabel(c)) + ' to ' + name;
    else head = I.truck + 'Standard to ' + name + ' · 1–2 days';
    var line = st === 'sub' ? '<span class="plx__s">No Express with Subscribe &amp; Save items in the bag.</span>'
      : st === 'std' ? ''
      : (progressHTML() || '<span class="plx__s">' + priceLine() + '</span>');
    return '<span class="plx__row"><span class="plx__t">' + head + '</span>' +
      '<button type="button" class="plx__link" data-plx-open>Change</button></span>' + line;
  }
  function chipHTML() {
    var st = stateOf(current);
    if (st === 'now') return I.bolt + 'Today';
    if (st === 'soon') return I.clock + esc(whenLabel(current).replace(/ from .*/, ''));
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
      var st = stateOf(current);
      if (mode === 'cart' && cartHasSub && (st === 'now' || st === 'soon')) st = 'sub';
      el.className = 'plx plx--' + mode + ' plx--' + tier + ' plx--s-' + st;
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
    if (!document.querySelector('[data-plx]') || Date.now() - cartAt < 1500) return;
    cartAt = Date.now();
    nativeFetch('/cart.js', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (cart) {
      var has = (cart.items || []).some(function (i) { return !!i.selling_plan_allocation; });
      var total = cart.total_price;
      if (has !== cartHasSub || total !== cartTotal) { cartHasSub = has; cartTotal = total; renderAll(); }
    }).catch(function () {});
  }
  function pinOf(p) { return p && p.kind === 'location' ? p.lat + ',' + p.lng : ''; }
  // Put the pin on every bag line (Shopify only passes line properties to the rate check).
  var syncing = null;
  function syncLines(p) {
    var pin = pinOf(p);
    syncing = nativeFetch('/cart.js', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (cart) {
      var todo = (cart.items || []).filter(function (i) {
        var props = i.properties || {};
        if (Object.keys(props).some(function (k) { return k.indexOf('_plaay') === 0; })) return false;
        return (props._plx_pin || '') !== pin;
      });
      return todo.reduce(function (chain, i) {
        return chain.then(function () {
          var props = Object.assign({}, i.properties || {}, { _plx: '1', _plx_pin: pin });
          return nativeFetch('/cart/change.js', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ id: i.key, quantity: i.quantity, properties: props })
          });
        });
      }, Promise.resolve()).then(function () {
        if (todo.length && typeof window.plaayRenderCartDrawerSections === 'function') {
          try { window.plaayRenderCartDrawerSections(); } catch (e) {}
        }
      });
    }).catch(function () {}).then(function () { syncing = null; });
    return syncing;
  }
  function syncCartAttributes(p) {
    syncLines(p);
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
    var pin = pinOf(readPick());
    if (pin) props._plx_pin = pin;
    if (item.selling_plan) props._plx_sub = '1'; else delete props._plx_sub;
    return Object.assign({}, item, { properties: props });
  }
  function markBody(url, body) {
    if (body instanceof FormData) {
      if (/\/cart\/add/.test(url)) {
        body.set('properties[_plx]', '1');
        if (pinOf(readPick())) body.set('properties[_plx_pin]', pinOf(readPick()));
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
      f.address1 = [p.address1 || p.label, p.street].filter(Boolean).join(', ');
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
  var TAG = { express: '<span class="plx-tag plx-tag--x">Express</span>', '4hr': '<span class="plx-tag plx-tag--h">4-hour</span>', standard: '<span class="plx-tag">1–2 days</span>' };

  function buildSheet() {
    sheet = document.createElement('div');
    sheet.className = 'plx-sheet';
    sheet.hidden = true;
    var saved = (cfg.addresses || []).map(function (a, i) {
      return '<li><button type="button" class="plx-row" data-plx-addr="' + i + '">' + I.home + '<span><b>' + esc(a.isDefault ? 'Default address' : 'Saved address') + '</b><small>' + esc(a.label) + '</small></span><span data-plx-addr-tag="' + i + '"></span></button></li>';
    }).join('');
    sheet.innerHTML =
      '<div class="plx-sheet__dim" data-plx-close></div>' +
      '<div class="plx-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="plx-sheet-h">' +
        '<div class="plx-sheet__head"><button type="button" class="plx-sheet__back" data-plx-view="search" aria-label="Back" hidden>←</button>' +
        '<h2 id="plx-sheet-h">Where should we deliver?</h2>' +
        '<button type="button" class="plx-sheet__x" data-plx-close aria-label="Close">✕</button></div>' +
        '<ol class="plx-steps" aria-label="Steps"><li data-plx-step="search">Find</li><li data-plx-step="map">Pin</li><li data-plx-step="confirm">Details</li></ol>' +

        '<div class="plx-view" data-plx-v="search">' +
          (navigator.geolocation ? '<button type="button" class="plx-row plx-row--main" data-plx-loc>' + I.locate + '<span data-plx-loc-t>Use my current location<small>Fastest on your phone</small></span></button>' : '') +
          '<label class="plx-sheet__lbl" for="plx-q">Or search a building, street or area</label>' +
          '<div class="plx-search">' + I.search + '<input id="plx-q" class="plx-sheet__in" type="search" autocomplete="off" placeholder="e.g. Bloom Towers, JVC, Dubai Marina"></div>' +
          '<ul class="plx-list" data-plx-results aria-live="polite"></ul>' +
          (saved ? '<p class="plx-sheet__lbl">Saved addresses</p><ul class="plx-list plx-list--saved">' + saved + '</ul>' : '') +
          '<div data-plx-recent-wrap></div>' +
          '<button type="button" class="plx-row plx-row--loc" data-plx-view="map">' + I.map + 'Pick on the map</button>' +
          (cfg.signedIn ? '' : '<p class="plx-sheet__note">Have an account? <a href="' + esc(cfg.loginUrl) + '">Sign in</a> to use your saved addresses.</p>') +
          '<p class="plx-sheet__note">2-hour Express covers much of Dubai, Monday to Saturday, order by 5 pm. Express is ' + free + '</p>' +
        '</div>' +

        '<div class="plx-view" data-plx-v="map" hidden>' +
          '<p class="plx-sheet__step" data-plx-maphint>Move the map so the pin sits on your building.</p>' +
          '<div class="plx-map"><div class="plx-map__canvas" data-plx-map></div><span class="plx-map__pin" aria-hidden="true">' + I.pin + '</span></div>' +
          '<button type="button" class="plx__btn plx__btn--full" data-plx-pin>Yes, the pin is on my building</button>' +
        '</div>' +

        '<div class="plx-view" data-plx-v="confirm" hidden>' +
          '<div class="plx-confirm" data-plx-confirm aria-live="polite"></div>' +
          '<label class="plx-sheet__lbl" for="plx-bld">Building or villa</label>' +
          '<input id="plx-bld" class="plx-sheet__in" type="text" autocomplete="address-line1" placeholder="e.g. Bloom Towers A">' +
          '<label class="plx-sheet__lbl" for="plx-flat">Flat, villa or office no.</label>' +
          '<input id="plx-flat" class="plx-sheet__in" type="text" autocomplete="address-line2" placeholder="e.g. Apt 1203">' +
          '<label class="plx-sheet__lbl" for="plx-street">Street or landmark (optional)</label>' +
          '<input id="plx-street" class="plx-sheet__in" type="text" placeholder="e.g. Dana Road, near Spinneys">' +
          '<div class="plx-tags" role="radiogroup" aria-label="Save as">' +
            ['Home', 'Work', 'Other'].map(function (x, i) { return '<label><input type="radio" name="plx-tag" value="' + x + '"' + (i === 0 ? ' checked' : '') + '><span>' + x + '</span></label>'; }).join('') +
          '</div>' +
          '<button type="button" class="plx__btn plx__btn--full" data-plx-save disabled>Deliver here</button>' +
          '<button type="button" class="plx__link" data-plx-view="map">Not quite right? Move the pin</button>' +
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
    var order = ['search', 'map', 'confirm'];
    [].forEach.call(sheet.querySelectorAll('[data-plx-step]'), function (li) {
      var k = order.indexOf(li.getAttribute('data-plx-step')), now = order.indexOf(name);
      li.className = k < now ? 'is-done' : k === now ? 'is-on' : '';
    });
    if (name === 'search') renderRecent();
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
          ? '<li><button type="button" class="plx-row" data-plx-res="' + i + '">' + I.map + '<span><b>' + esc(r.name) + '</b><small>Area</small></span>' + (TAG[r.tier] || '') + '</button></li>'
          : '<li><button type="button" class="plx-row" data-plx-res="' + i + '">' + I.pin + '<span><b>' + esc(r.address1) + '</b><small>' + esc([r.community, r.emirate].filter(Boolean).join(', ')) + '</small></span></button></li>';
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
      box.innerHTML = '<p class="plx-confirm__addr">' + I.pin + esc(chosen.label) + '</p>' +
        '<p class="plx-confirm__tier">' + (TAG[res.tier] || '') + ' ' + esc(res.title || '') + '</p>';
      // Pre-fill what the pin (or the search result) tells us; the shopper corrects it.
      var bld = sheet.querySelector('#plx-bld');
      if (!bld.value) bld.value = chosen.address1 === 'Pinned location' ? '' : chosen.address1;
      btn.disabled = false;
      setTimeout(function () { (bld.value ? sheet.querySelector('#plx-flat') : bld).focus(); }, 30);
    }).catch(function () {
      box.innerHTML = '<p class="plx-empty">Couldn’t check this spot. Try again in a moment.</p>';
    });
  }

  // Where the map opens: a spot to confirm (search result, my location), else the last pin.
  var mapTarget = null;
  var pendingKnown = null;
  function showMap() {
    var el = sheet.querySelector('[data-plx-map]');
    var p = readPick();
    var exact = p && p.kind === 'location';
    var t = mapTarget || (chosen ? { lat: chosen.lat, lng: chosen.lng } : exact ? { lat: p.lat, lng: p.lng } : null);
    sheet.querySelector('[data-plx-maphint]').textContent = t
      ? 'Is the pin on your building? Move the map if it isn’t.'
      : 'Move the map so the pin sits on your building.';
    loadMapLibre().then(function (ml) {
      if (!map) {
        map = new ml.Map({ container: el, style: MAP_STYLE, center: t ? [+t.lng, +t.lat] : [DUBAI[1], DUBAI[0]], zoom: t ? (t.zoom || 17) : 11, attributionControl: { compact: true } });
        map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-left');
        map.on('load', function () {
          var a = el.querySelector('.maplibregl-ctrl-attrib');
          if (a) a.classList.remove('maplibregl-compact-show');
        });
      } else if (t) {
        map.jumpTo({ center: [+t.lng, +t.lat], zoom: t.zoom || 17 });
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
    var t = e.target.closest('[data-plx-close],[data-plx-view],[data-plx-res],[data-plx-recent],[data-plx-addr],[data-plx-loc],[data-plx-pin],[data-plx-save]');
    if (!t) return;
    if (t.hasAttribute('data-plx-close')) return close();
    if (t.hasAttribute('data-plx-view')) return view(t.getAttribute('data-plx-view'));
    if (t.hasAttribute('data-plx-recent')) {
      var rc = recent()[+t.getAttribute('data-plx-recent')];
      if (rc) { savePick(Object.assign({}, rc)); return done(); }
      return;
    }
    if (t.hasAttribute('data-plx-res')) {
      var r = lastResults[+t.getAttribute('data-plx-res')];
      if (!r) return;
      if (r.kind === 'area') { savePick({ kind: 'area', id: r.id, label: r.name }); return done(); }
      // Step 1: confirm the pin on the map. Step 2: building / flat / street.
      mapTarget = { lat: r.lat, lng: r.lng };
      pendingKnown = r;
      return view('map');
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
      // Keep the search result's address when the pin stayed on it (within ~150 m).
      var known = pendingKnown && Math.abs(c.lat - pendingKnown.lat) < 0.0014 && Math.abs(c.lng - pendingKnown.lng) < 0.0015 ? pendingKnown : null;
      mapTarget = null; pendingKnown = null;
      return confirmSpot(c.lat.toFixed(5), c.lng.toFixed(5), known);
    }
    if (t.hasAttribute('data-plx-save') && chosen) {
      var bld = sheet.querySelector('#plx-bld').value.trim().slice(0, 80);
      if (bld) chosen.address1 = bld;
      chosen.flat = sheet.querySelector('#plx-flat').value.trim().slice(0, 80);
      chosen.street = sheet.querySelector('#plx-street').value.trim().slice(0, 80);
      chosen.label = [chosen.address1, chosen.community].filter(Boolean).join(', ') || chosen.label;
      var tag = sheet.querySelector('input[name="plx-tag"]:checked');
      chosen.tag = tag && tag.value !== 'Other' ? tag.value : '';
      savePick(chosen);
      remember(chosen);
      return done();
    }
  }
  function locateMe(btn) {
    btn.disabled = true;
    var lt = btn.querySelector('[data-plx-loc-t]') || btn;
    lt.textContent = 'Finding you…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      btn.disabled = false;
      lt.innerHTML = 'Use my current location<small>Fastest on your phone</small>';
      mapTarget = { lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) };
      view('map');
    }, function () {
      btn.disabled = false;
      lt.innerHTML = 'Location is off<small>Search below or pick on the map</small>';
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
    popups(true);
    sheet.querySelector('#plx-q').value = '';
    sheet.querySelector('[data-plx-results]').innerHTML = '';
    ['#plx-flat', '#plx-bld', '#plx-street'].forEach(function (s) { sheet.querySelector(s).value = ''; });
    chosen = null; mapTarget = null; pendingKnown = null;
    if (start === 'pin') return pinFromPlace();
    view(start === 'map' ? 'map' : 'search');
  }
  // Recent pinned addresses on this device (guests too), newest first, 3 kept.
  var RECENT = 'plx-recent';
  function recent() { try { return JSON.parse(localStorage.getItem(RECENT) || '[]'); } catch (e) { return []; } }
  function remember(p) {
    if (!p || p.kind !== 'location') return;
    var list = recent().filter(function (x) { return Math.abs(x.lat - p.lat) > 0.0005 || Math.abs(x.lng - p.lng) > 0.0005; });
    list.unshift(p);
    try { localStorage.setItem(RECENT, JSON.stringify(list.slice(0, 3))); } catch (e) {}
  }
  function renderRecent() {
    var wrap = sheet.querySelector('[data-plx-recent-wrap]');
    var list = recent();
    wrap.innerHTML = list.length ? '<p class="plx-sheet__lbl">Recent</p><ul class="plx-list plx-list--saved">' + list.map(function (r, i) {
      return '<li><button type="button" class="plx-row" data-plx-recent="' + i + '">' + (r.tag === 'Home' ? I.home : I.pin) + '<span><b>' + esc(r.tag || r.address1 || 'Pinned spot') + '</b><small>' + esc([r.flat, r.label].filter(Boolean).join(', ')) + '</small></span></button></li>';
    }).join('') + '</ul>' : '';
  }

  // Email pop-ups (Klaviyo) stay out of the way while the sheet is open.
  function popups(hide) {
    [].forEach.call(document.body.children, function (n) {
      if (n === sheet || !n.classList || !n.classList.contains('needsclick')) return;
      if (hide) { if (!n.hasAttribute('data-plx-hid')) n.setAttribute('data-plx-hid', n.style.visibility || ''); n.style.visibility = 'hidden'; }
      else if (n.hasAttribute('data-plx-hid')) { n.style.visibility = n.getAttribute('data-plx-hid'); n.removeAttribute('data-plx-hid'); }
    });
  }

  // "Pin your building": straight to the map, centred on what we already know (the saved
  // address, else the area), so the shopper only nudges the pin onto their building.
  var areaCoords = null;
  function pinFromPlace() {
    var p = place();
    mapTarget = null; pendingKnown = null;
    view('map');
    if (!p) return;
    var found = p.kind === 'address'
      ? api('q=' + encodeURIComponent(p.address)).then(function (res) {
          var list = res.results || [];
          var hit = list.filter(function (r) { return r.kind === 'address' && r.lat != null; })[0] || list.filter(function (r) { return r.lat != null; })[0];
          if (hit && hit.kind === 'address') pendingKnown = hit;
          return hit;
        })
      : (areaCoords ? Promise.resolve(areaCoords) : api('areas=1').then(function (res) { areaCoords = res.areas || []; return areaCoords; }))
          .then(function (areas) { return areas.filter(function (a) { return a.id === p.id; })[0]; });
    found.then(function (hit) {
      if (!hit || hit.lat == null || sheet.hidden) return;
      mapTarget = { lat: hit.lat, lng: hit.lng, zoom: hit.kind === 'address' ? 17 : 15 };
      showMap();
    }).catch(function () {});
  }

  function close() {
    if (!sheet) return;
    sheet.hidden = true;
    document.documentElement.classList.remove('plx-lock');
    popups(false);
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

  // Phones: the narrow "25% OFF" side tab (Klaviyo teaser) covers the delivery card's edge, so it
  // steps aside while the card is on screen.
  if ('IntersectionObserver' in window) {
    var teaserOff = false;
    var setTeaser = function (hide) {
      if (hide === teaserOff) return;
      teaserOff = hide;
      [].forEach.call(document.body.children, function (n) {
        if (n === sheet || !n.classList || !n.classList.contains('needsclick')) return;
        var r = n.getBoundingClientRect();
        var narrow = r.width > 0 && r.width < 240;
        if (hide && narrow) { n.setAttribute('data-plx-teaser', '1'); n.style.opacity = '0'; n.style.pointerEvents = 'none'; }
        if (!hide && n.hasAttribute('data-plx-teaser')) { n.removeAttribute('data-plx-teaser'); n.style.opacity = ''; n.style.pointerEvents = ''; }
      });
    };
    var io = new IntersectionObserver(function (es) {
      setTeaser(window.innerWidth < 768 && es.some(function (x) { return x.isIntersecting; }));
    }, { threshold: 0.2 });
    var watchCard = function () { var c = document.querySelector('[data-plx="pdp"]'); if (c && !c.hasAttribute('data-plx-watched')) { c.setAttribute('data-plx-watched', ''); io.observe(c); } };
    watchCard();
    setTimeout(watchCard, 2000);
  }
  window.PlaayExpress.open = open;
  refresh(false);
  checkCart();
})();
