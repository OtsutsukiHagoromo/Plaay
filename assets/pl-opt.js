/* Plaay redesign preview (Option A / Option B templates only).
   1. Banner carousel: dots follow the scroll position, auto-advance until the shopper touches it.
   2. Cart page: quantity, remove, subscribe switch and upsell add, each a /cart/*.js call
      followed by a reload so the page (and its ?view= option) re-renders from Liquid.
   3. Product page: gallery thumbs, pack size and subscribe/one-time prices, quantity, add to
      bag via /cart/add.js then the cart drawer, and the sticky add bar. */
(function () {
  'use strict';

  /* ---------- carousel ---------- */
  function initCarousel(root) {
    var track = root.querySelector('[data-plo-track]');
    var dots = Array.prototype.slice.call(root.querySelectorAll('[data-plo-dot]'));
    var dotsWrap = root.querySelector('[data-plo-dots]');
    if (!track || dots.length < 2) return;
    var slides = Array.prototype.slice.call(track.children);
    var current = 0;
    var timer = null;
    var interval = Number(root.getAttribute('data-interval') || 6) * 1000;

    function paint(i) {
      current = i;
      dots.forEach(function (d, n) { d.setAttribute('aria-current', n === i ? 'true' : 'false'); });
      var s = slides[i];
      if (dotsWrap && s) {
        dotsWrap.style.setProperty('--dots-bg', s.getAttribute('data-bg') || 'transparent');
        dotsWrap.classList.toggle('is-dark', s.getAttribute('data-dark') === 'true');
      }
    }
    function go(i) {
      var s = slides[i];
      if (!s) return;
      track.scrollTo({ left: s.offsetLeft - track.offsetLeft, behavior: 'smooth' });
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function start() {
      if (interval <= 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      stop();
      timer = setInterval(function () { go((current + 1) % slides.length); }, interval);
    }

    var raf = null;
    track.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        if (i !== current) paint(Math.max(0, Math.min(slides.length - 1, i)));
      });
    }, { passive: true });
    dots.forEach(function (d, n) { d.addEventListener('click', function () { stop(); go(n); }); });
    ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach(function (ev) {
      track.addEventListener(ev, stop, { passive: true });
    });
    paint(0);
    start();
  }

  /* ---------- cart ---------- */
  function post(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (json) {
        if (!r.ok) throw new Error(json.description || json.message || 'Cart update failed');
        return json;
      });
    });
  }
  function reload() { window.location.reload(); }
  function fail(el, err) {
    if (el) el.classList.remove('is-busy');
    window.alert(err && err.message ? err.message : 'Something went wrong. Please try again.');
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-plo-cart]');
    if (!btn) return;
    e.preventDefault();
    var action = btn.getAttribute('data-plo-cart');
    var line = btn.closest('[data-plo-line]');
    if (line) line.classList.add('is-busy');
    btn.classList.add('is-busy');
    var root = window.routes || {};
    var changeUrl = (root.cart_change_url || '/cart/change') + '.js';
    var addUrl = (root.cart_add_url || '/cart/add') + '.js';
    var key = line && line.getAttribute('data-key');
    var qty = line ? Number(line.getAttribute('data-qty')) : 0;
    var req;

    if (action === 'inc') req = post(changeUrl, { id: key, quantity: qty + 1 });
    else if (action === 'dec') req = post(changeUrl, { id: key, quantity: Math.max(0, qty - 1) });
    else if (action === 'remove') req = post(changeUrl, { id: key, quantity: 0 });
    else if (action === 'subscribe') {
      req = post(changeUrl, { id: key, quantity: qty, selling_plan: Number(btn.getAttribute('data-plan')) });
    } else if (action === 'add') {
      req = post(addUrl, { items: [{ id: Number(btn.getAttribute('data-variant')), quantity: 1 }] });
    }
    if (!req) return;
    req.then(reload).catch(function (err) {
      if (line) line.classList.remove('is-busy');
      fail(btn, err);
    });
  });


  /* ---------- product page ---------- */
  function aed(fils) {
    var whole = Math.floor(fils / 100), frac = fils % 100;
    return 'AED ' + whole + (frac ? '.' + (frac < 10 ? '0' : '') + frac : '');
  }
  /* The gallery photo currently in view (the swipe track holds all of them side by side). */
  function visiblePhoto(root) {
    var track = root.querySelector('[data-plo-phtrack]');
    if (!track) return null;
    var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    return track.querySelectorAll('img')[i] || track.querySelector('img');
  }

  function initPdp(root) {
    var form = root.querySelector('[data-plo-form]');
    if (!form) return;
    var pct = Number(root.getAttribute('data-pct') || 0);
    var variantInput = form.querySelector('[data-plo-variant]');
    var planInput = form.querySelector('[data-plo-plan]');
    var qty = form.querySelector('[data-plo-qty]');
    var addBtn = form.querySelector('[data-plo-add]');
    var main = root.querySelector('.plo-gal__img');
    /* Browsers (Safari, Firefox) restore the last-tapped radio on reload, which would open
       the page on a pack size other than the default and out of step with the hidden variant
       id. Put every choice back to what the page was served with. */
    Array.prototype.forEach.call(form.querySelectorAll('[data-plo-size], [data-plo-mode]'), function (r) { r.checked = r.defaultChecked; });
    var checked = form.querySelector('[data-plo-size]:checked');
    if (checked && variantInput) variantInput.value = checked.value;
    var price = checked ? Number(checked.getAttribute('data-price')) : 0;

    function isSub() {
      var m = form.querySelector('[data-plo-mode]:checked');
      return !!(m && m.value === 'sub' && planInput);
    }
    function paint() {
      if (!price) return;
      var sub = Math.floor(price * (100 - pct) / 100);
      var set = function (sel, txt) { Array.prototype.forEach.call(root.querySelectorAll(sel), function (el) { el.textContent = txt; }); };
      set('[data-plo-sub]', aed(sub));
      set('[data-plo-was]', aed(price));
      set('[data-plo-save]', 'save ' + aed(price - sub));
      set('[data-plo-one]', aed(price));
      set('[data-plo-cta]', aed(isSub() ? sub : price));
      set('[data-plo-sticky-p]', aed(isSub() ? sub : price) + (isSub() ? ' · every 4 weeks' : ''));
      /* Pack chips: price per truffle at the price the shopper is about to pay. */
      Array.prototype.forEach.call(form.querySelectorAll('[data-plo-size][data-pcs]'), function (r) {
        var out = r.parentNode.querySelector('[data-plo-per]');
        var p = Number(r.getAttribute('data-price')), n = Number(r.getAttribute('data-pcs'));
        if (!out || !p || !n) return;
        var eff = isSub() ? Math.floor(p * (100 - pct) / 100) : p;
        out.textContent = aed(Math.round(eff / n)) + ' / truffle';
      });
    }
    form.addEventListener('change', function (e) {
      if (e.target.matches('[data-plo-size]')) {
        variantInput.value = e.target.value;
        price = Number(e.target.getAttribute('data-price'));
      }
      if (planInput) planInput.disabled = !isSub();
      paint();
    });
    paint();
    Array.prototype.forEach.call(form.querySelectorAll('[data-plo-q]'), function (b) {
      b.addEventListener('click', function () {
        var n = Math.max(1, Math.min(20, (Number(qty.value) || 1) + Number(b.getAttribute('data-plo-q'))));
        qty.value = n;
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-plo-thumb]'), function (t) {
      t.addEventListener('click', function () {
        if (main) { main.removeAttribute('srcset'); main.src = t.getAttribute('data-src'); }
        Array.prototype.forEach.call(root.querySelectorAll('[data-plo-thumb]'), function (x) { x.classList.toggle('is-on', x === t); });
      });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var item = { id: Number(variantInput.value), quantity: Number(qty.value) || 1 };
      if (isSub()) item.selling_plan = Number(planInput.value);
      addBtn.classList.add('is-busy');
      post(((window.routes || {}).cart_add_url || '/cart/add') + '.js', { items: [item] })
        .then(function () { addBtn.classList.remove('is-busy'); return flyToBag(root.querySelector('[data-plo-phtrack]') ? { querySelector: function () { return visiblePhoto(root); } } : null); })
        .then(openBag)
        .catch(function (err) { fail(addBtn, err); });
    });

    var sticky = root.querySelector('[data-plo-sticky]');
    if (sticky) {
      sticky.querySelector('[data-plo-sticky-add]').addEventListener('click', function () {
        if (form.requestSubmit) form.requestSubmit(); else addBtn.click();
      });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { sticky.classList.toggle('is-on', !en.isIntersecting && en.boundingClientRect.top < 0); });
        }).observe(addBtn);
      }
    }
    if (!price) {
      var m = (root.querySelector('[data-plo-one]') || {}).textContent || '';
      var num = parseFloat(m.replace(/[^0-9.]/g, ''));
      if (num) price = Math.round(num * 100);
    }
  }


  /* ---------- bag: the theme's cart drawer ----------
     The bag icon is left to the theme (it opens the cart drawer). Adding from the product form
     or a card "+" refreshes the drawer and opens it; without the drawer, go to the cart page. */
  function openBag() {
    var pc = window.plCart;
    if (pc && document.querySelector('cart-drawer')) {
      pc.refresh().then(function () { pc.open(); });
    } else {
      window.location.href = (window.routes || {}).cart_url || '/cart';
    }
  }
  /* Fly-to-bag: a small copy of the product photo arcs from where it was added to the bag
     icon (the drawer then slides in). Purely decorative; skipped for reduced motion or when
     there is no photo / bag icon on screen. Resolves when the flight lands. */
  function flyToBag(from) {
    var img = from && from.querySelector && from.querySelector('img');
    var bag = document.querySelector('.pl-header .header__icon--cart');
    if (!img || !bag || !img.animate || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return Promise.resolve();
    var a = img.getBoundingClientRect(), b = bag.getBoundingClientRect();
    if (!a.width || !b.width || a.bottom < 0 || a.top > window.innerHeight) return Promise.resolve();
    var size = Math.min(a.width, a.height, 120);
    var ghost = document.createElement('img');
    ghost.src = img.currentSrc || img.src;
    ghost.alt = '';
    ghost.className = 'plo-fly';
    ghost.style.cssText = 'left:' + (a.left + a.width / 2 - size / 2) + 'px;top:' + (a.top + a.height / 2 - size / 2) + 'px;width:' + size + 'px;height:' + size + 'px';
    document.body.appendChild(ghost);
    var dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    var anim = ghost.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: 'translate(' + dx * .45 + 'px,' + (dy * .45 - 60) + 'px) scale(.6)', opacity: 1, offset: .5 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.12)', opacity: .4 }
    ], { duration: 520, easing: 'cubic-bezier(.5,0,.6,1)' });
    return anim.finished.then(function () {
      ghost.remove();
      if (bag.animate) bag.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
    }, function () { ghost.remove(); });
  }
  window.ploFlyToBag = flyToBag;

  /* Card "+": one unit of the card's variant, on a selling plan when the card carries one
     (subscribe page). */
  function quickItem(btn) {
    var item = { id: Number(btn.getAttribute('data-plo-quick')), quantity: 1 };
    var plan = btn.getAttribute('data-plo-plan');
    if (plan) item.selling_plan = Number(plan);
    return item;
  }

  window.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var add = e.target.closest('[data-plo-quick]');
    if (!add) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    add.classList.add('is-busy');
    post(((window.routes || {}).cart_add_url || '/cart/add') + '.js', { items: [quickItem(add)] })
      .then(function () { add.classList.remove('is-busy'); return flyToBag(add.closest('.plo-card, .plo-tile, .plo-prev__card') || null); })
      .then(openBag)
      .catch(function (err) { fail(add, err); });
  }, true);


  /* ---------- reels (plo-videos) ----------
     Videos play muted while on screen. A tap opens the pop-up: the video with sound, or the
     exact Instagram post (embed) when there is no video; no video and no post -> profile. */
  function initReels(root) {
    var lb = root.querySelector('[data-plo-lb]');
    var media = root.querySelector('[data-plo-lb-media]');
    var ig = root.querySelector('[data-plo-lb-ig]');
    var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var vids = Array.prototype.slice.call(root.querySelectorAll('.plo-vid video'));
    if ('IntersectionObserver' in window && !calm) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var v = e.target;
          if (e.isIntersecting) { if (!v.src) v.src = v.getAttribute('data-src'); v.play().catch(function () {}); v.closest('.plo-vid').classList.add('is-playing'); }
          else v.pause();
        });
      }, { threshold: .5 });
      vids.forEach(function (v) { io.observe(v); });
    }
    function close() {
      lb.hidden = true; media.innerHTML = ''; document.body.classList.remove('pl-lock');
    }
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-plo-lb-close]') || e.target === lb) { close(); return; }
      var t = e.target.closest('[data-plo-reel]');
      if (!t) return;
      var v = t.getAttribute('data-video'), em = t.getAttribute('data-embed'), post = t.getAttribute('data-post');
      if (!v && !em) { if (post) window.open(post, '_blank', 'noopener'); return; }
      media.innerHTML = '';
      if (v) {
        var el = document.createElement('video');
        el.src = v; el.controls = true; el.autoplay = true; el.playsInline = true; el.loop = true;
        media.appendChild(el);
        media.className = 'plo-lb__media is-video';
      } else {
        var f = document.createElement('iframe');
        f.src = em; f.setAttribute('allow', 'autoplay; encrypted-media'); f.setAttribute('title', 'Instagram post'); f.setAttribute('loading', 'lazy');
        media.appendChild(f);
        media.className = 'plo-lb__media is-ig';
      }
      ig.href = post || ig.href;
      lb.hidden = false; document.body.classList.add('pl-lock');
      root.querySelector('[data-plo-lb-close]').focus();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !lb.hidden) close(); });
  }

  /* ---------- product grid tabs (plo-products) ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-plo-tabsel]');
    if (!b) return;
    var root = b.closest('.plo-wrap');
    var i = b.getAttribute('data-plo-tabsel');
    Array.prototype.forEach.call(root.querySelectorAll('[data-plo-tabsel]'), function (x) { var on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); });
    Array.prototype.forEach.call(root.querySelectorAll('[data-plo-tabpan]'), function (pnl) { var on = pnl.getAttribute('data-plo-tabpan') === i; pnl.hidden = !on; if (on) { pnl.classList.remove('is-in'); void pnl.offsetWidth; pnl.classList.add('is-in'); } });
  });

  /* ---------- Subscribe & Save page: range filter + delivery frequency ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-plo-range], [data-plo-freq]');
    if (!t) return;
    var box = t.closest('[data-plo-sub]');
    if (!box) return;
    if (t.hasAttribute('data-plo-range')) {
      var r = t.getAttribute('data-plo-range'), shown = 0;
      Array.prototype.forEach.call(box.querySelectorAll('[data-plo-range]'), function (x) { var on = x === t; x.classList.toggle('is-on', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); });
      Array.prototype.forEach.call(box.querySelectorAll('.plo-card[data-range]'), function (c) {
        var on = !r || c.getAttribute('data-range') === r;
        c.hidden = !on;
        if (on) shown++;
      });
      var empty = box.querySelector('[data-plo-sub-empty]');
      if (empty) empty.hidden = shown > 0;
      /* Filtering while scrolled down: bring the top of the grid back into view. */
      if (box.getBoundingClientRect().top < 0) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      var w = t.getAttribute('data-plo-freq');
      Array.prototype.forEach.call(box.querySelectorAll('[data-plo-freq]'), function (x) { var on = x === t; x.classList.toggle('is-on', on); x.setAttribute('aria-checked', on ? 'true' : 'false'); });
      Array.prototype.forEach.call(box.querySelectorAll('[data-plo-plan' + w + ']'), function (b) { b.setAttribute('data-plo-plan', b.getAttribute('data-plo-plan' + w)); });
      Array.prototype.forEach.call(box.querySelectorAll('[data-plo-freq-l]'), function (l) { l.textContent = 'every ' + w + ' weeks'; });
    }
  });

  /* ---------- product details tabs ---------- */
  document.addEventListener('click', function (e) {
    var tab = e.target.closest && e.target.closest('[data-plo-tab]');
    if (!tab) return;
    var box = tab.closest('[data-plo-tabs]');
    Array.prototype.forEach.call(box.querySelectorAll('[data-plo-tab]'), function (t) {
      var on = t === tab;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      var pan = document.getElementById(t.getAttribute('aria-controls'));
      if (pan) pan.hidden = !on;
    });
    tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });


  /* ---------- product details: ingredients / allergens / nutrition widgets ----------
     The metafields are free text. Each panel is rebuilt into a small widget when its text
     matches the usual shape; otherwise the text is left as it is. */
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function clean(s) { return (s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); }
  function linesOf(el) {
    // Paragraphs split on <br>, as plain text, with any <b>Label:</b> kept as "Label:".
    var out = [];
    Array.prototype.forEach.call(el.querySelectorAll('p'), function (p) {
      p.innerHTML.split(/<br\s*\/?>/i).forEach(function (h) {
        var d = document.createElement('div'); d.innerHTML = h;
        var t = clean(d.textContent); if (t) out.push(t);
      });
    });
    return out;
  }
  function splitTop(s) {
    // Split on commas that are not inside () or [].
    var parts = [], depth = 0, cur = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
      if (c === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += c;
    }
    parts.push(cur);
    return parts.map(clean).filter(Boolean);
  }
  function listItems(s) {
    return clean(s).replace(/\.$/, '').split(/\s*,\s*|\s*&\s*|\s+and\s+/i).map(clean).filter(Boolean);
  }

  function nutritionWidget(el) {
    var rows = [], notes = [], serving = '';
    linesOf(el).forEach(function (l) {
      var m = l.match(/^([A-Za-z][A-Za-z ]{1,30}):\s*(.+)$/);
      if (!m) { notes.push(l); return; }
      var k = clean(m[1]), v = clean(m[2]);
      if (/serving/i.test(k)) { serving = v; return; }
      var r = v.match(/^([\d.]+)\s*(kcal|g)?\s*[–-]\s*([\d.]+)\s*(kcal|g)?$/i);
      var unit = /calor/i.test(k) ? 'kcal' : 'g';
      if (r) v = r[1] + '–' + r[3] + ' ' + (r[2] || r[4] || unit).toLowerCase();
      else if (/^[\d.]+\s*(kcal|g)?$/i.test(v)) v = parseFloat(v) + ' ' + (v.match(/kcal|g/i) || [unit])[0].toLowerCase();
      k = k.replace(/^Total /i, '').replace(/Carbohydrates?/i, 'Carbs');
      rows.push({ k: k, v: v });
    });
    if (rows.length < 3) return;
    var cal = rows.filter(function (r) { return /calor/i.test(r.k); })[0];
    var rest = rows.filter(function (r) { return r !== cal; });
    var h = '<div class="plo-nf"><p class="plo-nf__t">Nutrition facts</p>';
    if (serving) h += '<p class="plo-nf__s"><span>Serving size</span><b>' + esc(serving.replace(/(\d)\s*g\b/i, '$1 g')) + '</b></p>';
    if (cal) h += '<p class="plo-nf__cal"><span>Calories</span><b>' + esc(cal.v) + '</b></p>';
    h += '<dl class="plo-nf__rows">';
    rest.forEach(function (r) {
      var zero = /^0\s*g$/.test(r.v) && /sugar/i.test(r.k);
      h += '<div' + (zero ? ' class="is-zero"' : '') + '><dt>' + esc(r.k) + '</dt><dd>' + esc(r.v) + '</dd></div>';
    });
    h += '</dl>';
    var note = notes.filter(function (n) { return /differ|sugar|sweeten/i.test(n); })[0];
    if (note) h += '<p class="plo-nf__n">' + esc(note.replace(/\.?$/, '.')) + '</p>';
    el.innerHTML = h + '</div>';
  }

  function allergenWidget(el) {
    var t = clean(el.textContent);
    var mc = t.match(/contains:?\s*(.+?)(?=\s*\.?\s*may contain|$)/i);
    var mm = t.match(/may contain:?\s*(?:traces of\s*)?(.+)$/i);
    if (!mc && !mm) return;
    var note = '';
    var may = mm ? mm[1] : '';
    var dep = may.match(/\s+(depending on [^.]+)\.?$/i);
    if (dep) { note = dep[1]; may = may.slice(0, dep.index); }
    function pills(list, cls) { return list.map(function (x) { return '<li class="' + cls + '">' + esc(x.replace(/^traces of\s*/i, '')) + '</li>'; }).join(''); }
    var h = '<div class="plo-al">';
    if (mc) h += '<div class="plo-al__g"><p class="plo-al__l">Contains</p><ul>' + pills(listItems(mc[1]), 'is-in') + '</ul></div>';
    if (may) h += '<div class="plo-al__g"><p class="plo-al__l">May contain traces of</p><ul>' + pills(listItems(may), 'is-may') + '</ul></div>';
    if (note) h += '<p class="plo-al__n">' + esc(note.charAt(0).toUpperCase() + note.slice(1)) + '.</p>';
    el.innerHTML = h + '</div>';
  }

  function ingredientWidget(el) {
    var lines = linesOf(el);
    if (!lines.length) return;
    // The list itself can wrap over several <br> lines; a later line in that paragraph is a
    // separate fact only when it reads "Label: value" with no comma (e.g. "Chocolate: Cocoa Solids 70% Min.").
    var first = el.querySelector('p');
    var firstLines = first ? linesOf({ querySelectorAll: function () { return [first]; } }) : [lines[0]];
    var list = firstLines[0], extra = [];
    firstLines.slice(1).forEach(function (l) {
      if (/^[A-Z][A-Za-z ]{1,30}:\s/.test(l) && l.indexOf(',') < 0) extra.push(l);
      else if (!extra.length) list += ' ' + l;
      else extra.push(l);
    });
    lines = [list].concat(extra, lines.slice(firstLines.length));
    var items = splitTop(list);
    if (items.length < 3) return;
    var facts = [];
    lines.slice(1).forEach(function (l) {
      var m = l.match(/^([A-Za-z][A-Za-z ]{1,30}):\s*(.+)$/);
      if (m && /allergen/i.test(m[1])) return; // shown on the Allergens tab
      if (m) facts.push({ k: clean(m[1]), v: clean(m[2]) });
      else if (!/^contains|^may contain/i.test(l)) facts.push({ k: '', v: l });
    });
    var h = '<div class="plo-ig"><ul class="plo-ig__list">';
    items.forEach(function (it) {
      var m = it.match(/^([^(\[]+?)\s*[(\[](.+)[)\]]$/);
      h += m ? '<li><b>' + esc(m[1]) + '</b><small>' + esc(m[2]) + '</small></li>' : '<li><b>' + esc(it) + '</b></li>';
    });
    h += '</ul>';
    if (facts.length) {
      h += '<dl class="plo-ig__facts">';
      facts.forEach(function (f) {
        var k = f.k.replace(/ (Details|Guidelines)$/i, '');
        h += '<div' + (/disclaimer/i.test(k) ? ' class="is-note"' : '') + '>' + (k ? '<dt>' + esc(k) + '</dt>' : '') + '<dd>' + esc(f.v.replace(/\s*\|\s*/g, ' · ')) + '</dd></div>';
      });
      h += '</dl>';
    }
    el.innerHTML = h + '</div>';
  }

  function initDetailWidgets() {
    var map = { nutrition: nutritionWidget, allergens: allergenWidget, ingredients: ingredientWidget };
    Array.prototype.forEach.call(document.querySelectorAll('[data-plo-tabs] .plo-pan[data-kind]'), function (pan) {
      var fn = map[pan.getAttribute('data-kind')];
      if (!fn || pan.querySelector('img')) return;
      try { fn(pan); } catch (e) { /* keep the plain text */ }
    });
  }


  /* ---------- photo gallery (refreshed photography) ---------- */
  function initPhotos(root) {
    var track = root.querySelector('[data-plo-phtrack]');
    var row = root.querySelector('[data-plo-thumbrow]');
    var count = root.querySelector('[data-plo-count]');
    var thumbs = Array.prototype.slice.call(root.querySelectorAll('[data-plo-go]'));
    if (!track) return;
    var current = 0;
    /* Highlight the thumb for photo i, bring it to the middle of the thumb row and update the
       counter. Runs only when the index changes, so the row glides once per photo. */
    function mark(i) {
      if (i === current && thumbs[i] && thumbs[i].classList.contains('is-on')) return;
      current = i;
      thumbs.forEach(function (t, n) { t.classList.toggle('is-on', n === i); t.setAttribute('aria-current', n === i ? 'true' : 'false'); });
      if (count) count.textContent = i + 1;
      var t = thumbs[i];
      if (row && t && row.scrollWidth > row.clientWidth) {
        row.scrollTo({ left: t.offsetLeft - (row.clientWidth - t.offsetWidth) / 2, behavior: 'smooth' });
      }
    }
    thumbs.forEach(function (t) {
      t.addEventListener('click', function () {
        var i = Number(t.getAttribute('data-plo-go'));
        var img = track.children[i];
        if (img) track.scrollTo({ left: img.offsetLeft - track.offsetLeft, behavior: 'smooth' });
        mark(i);
      });
    });
    var raf = null;
    /* The "1 / 8" counter shows while the photos move (swipe or thumb tap) and fades out
       1.2s after they settle. It also shows briefly when the page opens, as a hint. */
    var badge = root.querySelector('.plo-gal__count'), idle;
    function wake() {
      if (!badge) return;
      badge.classList.add('is-live');
      clearTimeout(idle);
      idle = setTimeout(function () { badge.classList.remove('is-live'); }, 1200);
    }
    wake();
    track.addEventListener('scroll', function () {
      wake();
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = null; mark(Math.round(track.scrollLeft / Math.max(1, track.clientWidth))); });
    }, { passive: true });
  }

  /* Scroll reveal: cards and headings below the fold rise in as they enter the viewport,
     staggered within each row. Anything already on screen at load is left alone (no flash),
     and nothing animates when the visitor prefers reduced motion. */
  function initReveal() {
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var sel = '.plo-head, .plo-px__head, .plo-card, .plo-cat, .plo-perk, .plo-why2__usp, .plo-prev__card, .plo-vid, .plo-range, .plo-pfaq__i';
    var els = document.querySelectorAll(sel);
    var vh = window.innerHeight;
    var io = new IntersectionObserver(function (es) {
      var n = 0;
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        e.target.style.transitionDelay = Math.min(n++ * 60, 300) + 'ms';
        e.target.classList.add('is-in');
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    Array.prototype.forEach.call(els, function (el) {
      if (el.getBoundingClientRect().top < vh) return;
      el.classList.add('plo-rv');
      io.observe(el);
    });
    /* Once shown, hand the element back to its own styles (hover transitions etc.). */
    document.addEventListener('transitionend', function (e) {
      var t = e.target;
      if (e.propertyName !== 'transform' || !t.classList || !t.classList.contains('is-in')) return;
      t.style.transitionDelay = '';
      t.classList.remove('plo-rv', 'is-in');
    });
  }

  /* Page transitions (cross-document View Transitions, Chrome/Edge/Safari 18+): the product
     photo the visitor tapped morphs into the product page's first photo. The name is set on
     the clicked card only (names must be unique), and on the gallery's first photo when the
     product page is revealed. */
  function initTransitions() {
    var card = null;
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href*="/products/"]');
      if (!a || e.defaultPrevented) return;
      var c = a.closest('.plo-card, .plo-tile, .pl-search__row');
      var img = c && c.querySelector('img');
      if (card) card.style.viewTransitionName = '';
      if (img) { img.style.viewTransitionName = 'plo-photo'; card = img; }
    }, true);
    window.addEventListener('pageshow', function () { if (card) { card.style.viewTransitionName = ''; card = null; } });
    window.addEventListener('pagereveal', function (e) {
      if (!e.viewTransition) return;
      var hero = document.querySelector('[data-plo-phtrack] img');
      if (!hero) return;
      hero.style.viewTransitionName = 'plo-photo';
      e.viewTransition.finished.then(function () { hero.style.viewTransitionName = ''; });
    });
  }
  initTransitions();

  /* Lazy photos fade in when they arrive. Only images still loading get the class, so cached
     and above-the-fold photos never flicker. */
  function initFades() {
    var imgs = document.querySelectorAll('.plo-card__img img, .plo-cat img, .plo-prev__shot, .plo-gal__track img[loading="lazy"]');
    Array.prototype.forEach.call(imgs, function (img) {
      if (img.complete || img.getAttribute('loading') !== 'lazy') return;
      img.classList.add('plo-fade');
      var done = function () { img.classList.add('is-loaded'); };
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
  }

  /* PDP description: clamped to two lines; "More" appears only when the text overflows. */
  function initMore() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-plo-more]'), function (w) {
      var p = w.querySelector('p'), b = w.querySelector('button');
      if (!p || !b) return;
      if (p.scrollHeight - p.clientHeight > 2) b.hidden = false;
      b.addEventListener('click', function () {
        var open = w.classList.toggle('is-open');
        b.setAttribute('aria-expanded', open ? 'true' : 'false');
        b.textContent = open ? 'Less' : 'More';
      });
    });
  }

  function init() {
    initMore();
    initFades();
    initReveal();
    Array.prototype.forEach.call(document.querySelectorAll('[data-plo-carousel]'), initCarousel);
    Array.prototype.forEach.call(document.querySelectorAll('[data-plo-pdp]'), initPdp);
    Array.prototype.forEach.call(document.querySelectorAll('[data-plo-photos]'), initPhotos);
    initDetailWidgets();
    Array.prototype.forEach.call(document.querySelectorAll('[data-plo-reels]'), initReels);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
