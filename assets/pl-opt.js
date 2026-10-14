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
  function fail(el, err) {
    if (el) el.classList.remove('is-busy');
    window.alert(err && err.message ? err.message : 'Something went wrong. Please try again.');
  }


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
    if (checked && planInput && checked.getAttribute('data-plan')) planInput.value = checked.getAttribute('data-plan');
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
      set('[data-plo-sticky-p]', aed(isSub() ? sub : price) + (isSub() ? ' · ' + (root.getAttribute('data-every') || 'every 4 weeks') : ''));
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
        /* Each pack carries the subscription plan it can use. */
        if (planInput && e.target.getAttribute('data-plan')) planInput.value = e.target.getAttribute('data-plan');
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
      /* One add at a time: the sticky bar and Enter in the quantity box also submit. */
      if (addBtn.classList.contains('is-busy')) return;
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

  /* ---------- product cards: size swatches ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-plo-sz]');
    if (!b) return;
    var card = b.closest('[data-plo-sizes]');
    if (!card) return;
    e.preventDefault();
    Array.prototype.forEach.call(card.querySelectorAll('[data-plo-sz]'), function (x) { var on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-checked', on ? 'true' : 'false'); });
    var id = b.getAttribute('data-plo-sz'), price = Number(b.getAttribute('data-price')), pct = Number(card.getAttribute('data-pct')) || 0;
    Array.prototype.forEach.call(card.querySelectorAll('[data-plo-quick]'), function (q) { q.setAttribute('data-plo-quick', id); });
    Array.prototype.forEach.call(card.querySelectorAll('[data-plo-cp]'), function (el) { el.textContent = aed(price); });
    Array.prototype.forEach.call(card.querySelectorAll('[data-plo-cp-sub]'), function (el) { el.textContent = aed(Math.floor(price * (100 - pct) / 100)); });
  });

  /* Card size picker (select): same effect as the swatches. */
  document.addEventListener('change', function (e) {
    var sel = e.target;
    if (!sel.matches || !sel.matches('[data-plo-szsel]')) return;
    var card = sel.closest('[data-plo-sizes]');
    if (!card) return;
    var opt = sel.options[sel.selectedIndex];
    var price = Number(opt.getAttribute('data-price')), pct = Number(card.getAttribute('data-pct')) || 0;
    Array.prototype.forEach.call(card.querySelectorAll('[data-plo-quick]'), function (q) { q.setAttribute('data-plo-quick', sel.value); });
    Array.prototype.forEach.call(card.querySelectorAll('[data-plo-cp]'), function (el) { el.textContent = aed(price); });
    Array.prototype.forEach.call(card.querySelectorAll('[data-plo-cp-sub]'), function (el) { el.textContent = aed(Math.floor(price * (100 - pct) / 100)); });
  });

  /* ---------- range tabs (Subscribe & Save, All collections): filter the cards in place ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-plo-range]');
    if (!t) return;
    var box = t.closest('[data-plo-sub]');
    if (!box) return;
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

  /* Video band: play only while on screen; keep the poster for reduced motion. */
  function initReelBand() {
    var vids = document.querySelectorAll('[data-plo-rband]');
    if (!vids.length) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var play = function (v, on) { if (on) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause(); };
    if (!('IntersectionObserver' in window)) { Array.prototype.forEach.call(vids, function (v) { play(v, true); }); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { play(e.target, e.isIntersecting); }); }, { threshold: 0.25 });
    Array.prototype.forEach.call(vids, function (v) { io.observe(v); });
  }

  /* FAQ page: topic tabs and the search box filter the questions in place. A search opens
     the matching answers; empty groups hide; a note shows when nothing matches. */
  function initFaqPage(root) {
    var q = root.querySelector('[data-plo-faqp-q]');
    var tabs = root.querySelectorAll('[data-plo-faqp-cat]');
    var groups = root.querySelectorAll('[data-plo-faqp-group]');
    var none = root.querySelector('[data-plo-faqp-none]');
    var cat = '';
    var apply = function () {
      var term = q ? q.value.trim().toLowerCase() : '';
      var shown = 0;
      Array.prototype.forEach.call(groups, function (g) {
        var n = 0;
        var inCat = !cat || g.getAttribute('data-plo-faqp-group') === cat;
        Array.prototype.forEach.call(g.querySelectorAll('.plo-pfaq__i'), function (d) {
          var hit = inCat && (!term || d.textContent.toLowerCase().indexOf(term) > -1);
          d.hidden = !hit;
          if (term) d.open = hit;
          if (hit) n++;
        });
        g.hidden = n === 0;
        shown += n;
      });
      if (none) none.hidden = shown > 0;
    };
    Array.prototype.forEach.call(tabs, function (t) {
      t.addEventListener('click', function () {
        cat = t.getAttribute('data-plo-faqp-cat');
        Array.prototype.forEach.call(tabs, function (x) {
          x.classList.toggle('is-on', x === t);
          x.setAttribute('aria-selected', x === t ? 'true' : 'false');
        });
        apply();
      });
    });
    if (q) q.addEventListener('input', apply);
  }

  /* Wishlist page: product handles from localStorage "plaay_wishlist" (written by the product
     page heart), each fetched as /products/{handle}.js and drawn as a card v3 with a remove
     button. "+" is the sitewide quick add ([data-plo-quick]). */
  function initWishlist(root) {
    var KEY = 'plaay_wishlist';
    var grid = root.querySelector('[data-plo-wl-grid]');
    var empty = root.querySelector('[data-plo-wl-empty]');
    var loading = root.querySelector('[data-plo-wl-loading]');
    var count = root.querySelector('[data-plo-wl-count]');
    var intro = count ? count.textContent : '';
    var read = function () { try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { return []; } };
    var write = function (l) {
      try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) {}
      window.dispatchEvent(new CustomEvent('plaay:wishlist:change'));
    };
    var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var aed = function (f) { var w = Math.floor(f / 100), r = f % 100; return 'AED ' + w + (r ? '.' + (r < 10 ? '0' : '') + r : ''); };
    var split = function (title) {
      var m = title.match(/^(.*?)\s+(\d+)\s*[xX×]\s*(\d+)\s*g$/);
      if (m) return [m[1], m[2] + ' × ' + m[3] + 'g'];
      m = title.match(/^(.*?)\s+[xX]\s*(\d+)$/);
      if (m) return [m[1], m[2] + ' pack'];
      return [title, ''];
    };
    var card = function (p) {
      var v = null;
      p.variants.forEach(function (x) { if (!v && x.available && x.title.replace(/\s/g, '').toLowerCase() === '10x60g') v = x; });
      p.variants.forEach(function (x) { if (!v && x.available) v = x; });
      v = v || p.variants[0];
      var ns = split(p.title);
      var size = ns[1] || (v.title !== 'Default Title' ? v.title.replace(/ [xX] /, ' × ').replace(/G$/, 'g') : '');
      var img = p.featured_image ? p.featured_image.replace(/^\/\//, 'https://') : '';
      if (img) img += (img.indexOf('?') > -1 ? '&' : '?') + 'width=600';
      var url = '/products/' + p.handle;
      return '<article class="plo-card plo-c3 plo-wl__card" data-handle="' + esc(p.handle) + '">' +
        '<a class="plo-card__img" href="' + url + '" tabindex="-1" aria-hidden="true">' +
          (img ? '<img src="' + esc(img) + '" alt="' + esc(p.title) + '" loading="lazy" width="600" height="600">' : '') +
        '</a>' +
        '<button type="button" class="plo-wl__x" data-plo-wl-x="' + esc(p.handle) + '" aria-label="Remove ' + esc(p.title) + ' from wishlist">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
        '<div class="plo-card__body">' +
          '<h3 class="plo-card__name"><a href="' + url + '">' + esc(ns[0]) + '</a></h3>' +
          '<div class="plo-card__detail">' + (size ? '<span>' + esc(size) + '</span>' : '') + '</div>' +
          '<div class="plo-card__foot">' +
            '<div class="plo-card__prices"><span class="plo-card__price"><span>' + aed(v.price) + '</span></span>' +
              (v.compare_at_price > v.price ? '<s class="plo-card__was">' + aed(v.compare_at_price) + '</s>' : '') + '</div>' +
            (v.available
              ? '<button type="button" class="plo-add plo-c3__add" data-plo-quick="' + v.id + '" aria-label="Add ' + esc(p.title) + ' to bag"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>'
              : '<span class="plo-card__soldout">Sold out</span>') +
          '</div>' +
        '</div>' +
      '</article>';
    };
    var setCount = function (n) {
      if (!count) return;
      count.textContent = n ? n + (n === 1 ? ' saved favourite' : ' saved favourites') + ', ready when you are.' : intro;
    };
    var render = function () {
      var list = read();
      if (!list.length) {
        grid.innerHTML = '';
        loading.hidden = true;
        empty.hidden = false;
        setCount(0);
        return;
      }
      empty.hidden = true;
      Promise.all(list.map(function (h) {
        return fetch('/products/' + encodeURIComponent(h) + '.js').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
      })).then(function (ps) {
        ps = ps.filter(Boolean);
        loading.hidden = true;
        grid.innerHTML = ps.map(card).join('');
        empty.hidden = ps.length > 0;
        setCount(ps.length);
      });
    };
    var removing = false;
    /* A heart tapped elsewhere on this page (e.g. the suggestions) updates the list. */
    window.addEventListener('plaay:wishlist:change', function () { if (!removing) render(); });
    grid.addEventListener('click', function (e) {
      var x = e.target.closest('[data-plo-wl-x]');
      if (!x) return;
      var h = x.getAttribute('data-plo-wl-x');
      var c = x.closest('.plo-wl__card');
      if (c) c.classList.add('is-out');
      setTimeout(function () {
        removing = true;
        write(read().filter(function (k) { return k !== h; }));
        removing = false;
        if (c) c.remove();
        var n = grid.children.length;
        setCount(n);
        if (!n) empty.hidden = false;
      }, 220);
    });
    render();
  }

  /* Wishlist hearts (snippets/plo-heart): toggle the product handle in localStorage
     "plaay_wishlist" (the list the Wishlist page and the product page heart share). Delegated,
     so hearts in cards added later work too; every heart for the same product stays in sync. */
  function initHearts() {
    var KEY = 'plaay_wishlist';
    var read = function () { try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { return []; } };
    var paint = function () {
      var list = read();
      Array.prototype.forEach.call(document.querySelectorAll('[data-plo-heart]'), function (b) {
        var on = list.indexOf(b.getAttribute('data-plo-heart')) > -1;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    };
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-plo-heart]');
      if (!b) return;
      e.preventDefault();
      var h = b.getAttribute('data-plo-heart'), list = read(), i = list.indexOf(h);
      if (i > -1) list.splice(i, 1); else { list.push(h); b.classList.add('is-pop'); setTimeout(function () { b.classList.remove('is-pop'); }, 400); }
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (err) {}
      window.dispatchEvent(new CustomEvent('plaay:wishlist:change'));
    });
    window.addEventListener('plaay:wishlist:change', paint);
    window.addEventListener('storage', function (e) { if (e.key === KEY) paint(); });
    window.addEventListener('pageshow', paint);
    paint();
  }

  /* Card size pickers: browsers can restore a different choice on back/forward or reload
     while the card's price and "+" still hold the served pack. Put them back to the served one. */
  function resetCardSizes() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-plo-szsel]'), function (sel) {
      Array.prototype.forEach.call(sel.options, function (o) { o.selected = o.defaultSelected; });
    });
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted) resetCardSizes(); });

  function init() {
    initHearts();
    resetCardSizes();
    Array.prototype.forEach.call(document.querySelectorAll('[data-plo-wl]'), initWishlist);
    Array.prototype.forEach.call(document.querySelectorAll('[data-plo-faqp]'), initFaqPage);
    initReelBand();
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
