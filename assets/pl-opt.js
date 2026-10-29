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
    var sticky = root.querySelector('[data-plo-sticky]');
    var sfreq = sticky && sticky.querySelector('[data-plo-sfreq]');
    Array.prototype.forEach.call(root.querySelectorAll('[data-plo-size], [data-plo-mode], [data-plo-freq], [data-plo-smode]'), function (r) { r.checked = r.defaultChecked; });
    if (sfreq) Array.prototype.forEach.call(sfreq.options, function (o) { o.selected = o.defaultSelected; });
    var checked = form.querySelector('[data-plo-size]:checked');
    if (checked && variantInput) variantInput.value = checked.value;
    var price = checked ? Number(checked.getAttribute('data-price')) : 0;

    /* Delivery frequency: index into the plans each pack carries (data-plans, one per frequency).
       The buy box chips and the sticky bar's select both drive it. */
    function freq() {
      var f = form.querySelector('[data-plo-freq]:checked');
      return f ? Number(f.value) : Number(root.getAttribute('data-freq') || 0);
    }
    function syncPlan() {
      if (!planInput) return;
      var src = form.querySelector('[data-plo-size]:checked') || root;
      var plans = (src.getAttribute('data-plans') || root.getAttribute('data-plans') || '').split(',');
      if (plans[freq()]) planInput.value = plans[freq()];
      planInput.disabled = !isSub();
    }
    /* Mirror the buy box into the sticky bar (mode toggle + frequency select). */
    function syncSticky() {
      if (!sticky) return;
      var m = form.querySelector('[data-plo-mode]:checked');
      Array.prototype.forEach.call(sticky.querySelectorAll('[data-plo-smode]'), function (r) { r.checked = !!m && r.value === m.value; });
      if (sfreq) { sfreq.value = String(freq()); sfreq.disabled = !isSub(); }
      sticky.classList.toggle('is-one', !isSub());
    }

    /* Sizes with their own photo (data-img): show it in the gallery, the first thumbnail and the
       sticky bar. */
    function showSizePhoto(r) {
      var img = r.getAttribute('data-img'), th = r.getAttribute('data-thumb');
      if (!img) return;
      if (main) { main.removeAttribute('srcset'); main.src = img; }
      var vt = root.querySelector('[data-plo-vthumb]');
      if (vt) {
        vt.setAttribute('data-src', img);
        var ti = vt.querySelector('img');
        if (ti && th) { ti.removeAttribute('srcset'); ti.src = th; }
        Array.prototype.forEach.call(root.querySelectorAll('[data-plo-thumb]'), function (x) { x.classList.toggle('is-on', x === vt); });
      }
      var si = root.querySelector('[data-plo-sticky-img]');
      if (si && th) { si.removeAttribute('srcset'); si.src = th; }
    }
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
      set('[data-plo-sticky-p]', aed(isSub() ? sub : price));
      set('[data-plo-sticky-was]', aed(price));
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
        showSizePhoto(e.target);
        var sz = root.querySelector('[data-plo-sticky-size]'), lb = e.target.parentNode.querySelector('b');
        if (sz && lb) sz.textContent = lb.textContent.trim();
      }
      syncPlan();
      syncSticky();
      paint();
    });
    syncPlan();
    syncSticky();
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
    /* Swipe on the big photo (galleries without the photo strip): left for the next image, right
       for the previous, by tapping the thumb next to the current one. The photo follows the
       finger a little and slides in from the side it came from. Vertical swipes scroll the page. */
    (function () {
      var stage = root.querySelector('.plo-gal__main');
      if (!stage || !main) return;
      var x0 = 0, y0 = 0, dx = 0, state = null;
      var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      function thumbs() { return Array.prototype.slice.call(root.querySelectorAll('[data-plo-thumb]')); }
      function step(dir) {
        var list = thumbs();
        if (list.length < 2) return false;
        var i = list.findIndex(function (x) { return x.classList.contains('is-on'); });
        var next = list[(Math.max(0, i) + dir + list.length) % list.length];
        next.click();
        if (!calm && main.animate) main.animate([{ transform: 'translateX(' + (dir * 40) + 'px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.2, .7, .2, 1)' });
        return true;
      }
      stage.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1 || thumbs().length < 2) { state = null; return; }
        x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; state = 'maybe';
      }, { passive: true });
      stage.addEventListener('touchmove', function (e) {
        if (!state) return;
        dx = e.touches[0].clientX - x0;
        var dy = e.touches[0].clientY - y0;
        if (state === 'maybe') {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
          if (Math.abs(dx) > Math.abs(dy)) state = 'drag'; else { state = null; return; }
        }
        if (e.cancelable) e.preventDefault();
        main.style.transition = 'none';
        main.style.transform = 'translateX(' + dx * .35 + 'px)';
      }, { passive: false });
      function end() {
        if (state !== 'drag') { state = null; return; }
        state = null;
        main.style.transition = 'transform .2s ease';
        main.style.transform = '';
        if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
      }
      stage.addEventListener('touchend', end);
      stage.addEventListener('touchcancel', end);
    })();
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      /* One add at a time: the sticky bar and Enter in the quantity box also submit. */
      if (addBtn.classList.contains('is-busy')) return;
      var item = { id: Number(variantInput.value), quantity: Number(qty.value) || 1 };
      if (isSub()) item.selling_plan = Number(planInput.value);
      if (window.plCart && window.plCart.add) {
        /* Fly from the photo in view, else from the button pressed (sticky bar or buy box). */
        var stickyOn = sticky && sticky.classList.contains('is-on');
        window.plCart.add([item], {
          button: addBtn,
          from: visiblePhoto(root) || main,
          fallback: stickyOn ? sticky.querySelector('[data-plo-sticky-add]') : addBtn
        });
        return;
      }
      addBtn.classList.add('is-busy');
      post(((window.routes || {}).cart_add_url || '/cart/add') + '.js', { items: [item] })
        .then(function () { addBtn.classList.remove('is-busy'); return flyToBag(root.querySelector('[data-plo-phtrack]') ? { querySelector: function () { return visiblePhoto(root); } } : null); })
        .then(openBag)
        .catch(function (err) { fail(addBtn, err); });
    });

    if (sticky) {
      /* Sticky controls just flip the matching buy box input and let its change handler run. */
      sticky.addEventListener('change', function (e) {
        var target = null;
        if (e.target.matches('[data-plo-smode]')) target = form.querySelector('[data-plo-mode][value="' + e.target.value + '"]');
        if (e.target.matches('[data-plo-sfreq]')) target = form.querySelector('[data-plo-freq][value="' + e.target.value + '"]');
        if (!target) return;
        target.checked = true;
        form.dispatchEvent(new Event('change', { bubbles: true }));
      });
      var stickyAdd = sticky.querySelector('[data-plo-sticky-add]');
      if (stickyAdd) stickyAdd.addEventListener('click', function () {
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
    if (window.plCart && window.plCart.add) {
      window.plCart.add([quickItem(add)], { button: add, from: add.closest('.plo-card, .plo-tile, .plo-prev__card') });
      return;
    }
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
    /* The pack's own photo, when it has one. */
    var cimg = card.querySelector('[data-plo-cimg]');
    if (cimg && opt.getAttribute('data-img')) { cimg.srcset = opt.getAttribute('data-srcset') || ''; cimg.src = opt.getAttribute('data-img'); }
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
      var src = (v.featured_image && v.featured_image.src) || p.featured_image;
      var img = src ? src.replace(/^\/\//, 'https://') : '';
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

  /* Toolbar pop-ups (Filter panel, Sort list) are <details>: one open at a time, Escape and the
     close buttons shut them. A click outside lands on the summary's full-screen ::before (CSS). */
  function initPops() {
    var pops = document.querySelectorAll('[data-plo-pop]');
    if (!pops.length) return;
    Array.prototype.forEach.call(pops, function (d) {
      d.addEventListener('toggle', function () {
        if (d.open) Array.prototype.forEach.call(pops, function (o) { if (o !== d) o.open = false; });
        document.documentElement.classList.toggle('plo-sheet-open', !!document.querySelector('.plo-pop--filter[open]'));
      });
      Array.prototype.forEach.call(d.querySelectorAll('[data-plo-pop-close]'), function (b) {
        b.addEventListener('click', function () { d.open = false; });
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      Array.prototype.forEach.call(pops, function (d) { if (d.open) { d.open = false; d.querySelector('summary').focus(); } });
    });
  }

  /* Collection filters, run in the page over the cards (data-f-prices "id:price,", data-f-sub,
     data-f-tags "|tag|"). Options in one group widen the match (OR); groups narrow it (AND).
     Price is a two-handle slider over the prices on the page, with a small bar chart of where the
     products sit. A pack inside the range counts: the card switches to the cheapest such pack.
     The choice is kept in the address (?filter=sub,t:vegan,p:6000-15000) so back/forward and
     shared links keep it. */
  function initCollFilter(tools) {
    var scope = tools.closest('.plo') || document;
    var cards = Array.prototype.slice.call(scope.querySelectorAll('.plo-card[data-f-prices]'));
    var opts = Array.prototype.slice.call(tools.querySelectorAll('[data-plo-fopt]'));
    var grouped = !!scope.querySelector('.plo-range');
    var count = tools.querySelector('[data-plo-fcount]');
    var total = Number(count.getAttribute('data-total')) || cards.length;
    var badge = tools.querySelector('[data-plo-fbadge]');
    var show = tools.querySelector('[data-plo-fshow]');
    var active = tools.querySelector('[data-plo-factive]');
    var empty = scope.querySelector('[data-plo-fempty]');
    var fbtn = tools.querySelector('.plo-pop--filter');
    var fp = tools.querySelector('[data-plo-fprice]');
    if (!cards.length) { if (fbtn) fbtn.hidden = true; return; }

    function prices(card) {
      return (card.getAttribute('data-f-prices') || '').split(',').filter(Boolean).map(function (x) { var p = x.split(':'); return { id: p[0], price: Number(p[1]) }; });
    }
    function plural(n) { return n + ' product' + (n === 1 ? '' : 's'); }
    /* Shop all rows can hold the same product twice (e.g. Truffles and Limited): count products. */
    function key(c) { var a = c.querySelector('.plo-card__name a'); return a ? a.getAttribute('href') : c; }
    function unique(list) { var seen = []; list.forEach(function (c) { var k = key(c); if (seen.indexOf(k) < 0) seen.push(k); }); return seen.length; }

    /* ---- price slider (whole AED) ---- */
    var all = [];
    cards.forEach(function (c) { prices(c).forEach(function (p) { all.push(p.price); }); });
    var pMin = Math.floor(Math.min.apply(null, all) / 100), pMax = Math.ceil(Math.max.apply(null, all) / 100);
    var lo = pMin, hi = pMax;
    var smin = fp && fp.querySelector('[data-plo-pmin]'), smax = fp && fp.querySelector('[data-plo-pmax]');
    var hasPrice = !!(fp && smin && smax && pMax - pMin >= 10);
    function priceOn() { return hasPrice && (lo > pMin || hi < pMax); }
    function priceLabel() { return 'AED ' + lo + '–' + hi; }
    function inRange(fils) { return fils >= lo * 100 && fils <= hi * 100; }

    function test(card, v) {
      if (v === 'sub') return card.hasAttribute('data-f-sub');
      if (v.indexOf('t:') === 0) return (card.getAttribute('data-f-tags') || '').indexOf('|' + v.slice(2) + '|') > -1;
      /* Catalogue facts (snippets/plo-catalog): c:dark -> |c-dark| and so on. */
      if (/^[cfd]:/.test(v)) return (card.getAttribute('data-f-tags') || '').indexOf('|' + v.replace(':', '-') + '|') > -1;
      return true;
    }
    function group(v) { return v === 'sub' ? 'sub' : v.slice(0, 2); }
    function matches(card, on, usePrice) {
      var groups = {};
      on.forEach(function (v) { (groups[group(v)] = groups[group(v)] || []).push(v); });
      var ok = Object.keys(groups).every(function (g) { return groups[g].some(function (v) { return test(card, v); }); });
      if (ok && usePrice && priceOn()) ok = prices(card).some(function (p) { return inRange(p.price); });
      return ok;
    }
    /* Show the pack that fits the price range (or put the served pack back). */
    function fitSize(card) {
      var sel = card.querySelector('[data-plo-szsel]');
      if (!sel) return;
      var served = Array.prototype.filter.call(sel.options, function (o) { return o.defaultSelected; })[0] || sel.options[0];
      var target = served.value;
      if (priceOn() && !inRange(Number(served.getAttribute('data-price')))) {
        var fit = prices(card).filter(function (p) { return inRange(p.price); }).sort(function (a, b) { return a.price - b.price; })[0];
        if (fit) target = fit.id;
      }
      if (sel.value !== target) { sel.value = target; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    }
    /* Bar chart: how many products have a pack in each slice of the price range. */
    var BINS = 18, hist = fp && fp.querySelector('[data-plo-hist]');
    function drawHist(on) {
      if (!hist) return;
      var span = (pMax - pMin) / BINS, bins = [];
      for (var i = 0; i < BINS; i++) bins.push([]);
      cards.filter(function (c) { return matches(c, on, false); }).forEach(function (c) {
        prices(c).forEach(function (p) {
          var i = Math.min(BINS - 1, Math.floor((p.price / 100 - pMin) / span));
          if (bins[i].indexOf(key(c)) < 0) bins[i].push(key(c));
        });
      });
      var top = Math.max.apply(null, bins.map(function (b) { return b.length; })) || 1;
      hist.innerHTML = bins.map(function (b, i) {
        var a = pMin + i * span, z = a + span;
        var inside = z >= lo && a <= hi;
        return '<i style="height:' + (b.length ? Math.max(8, Math.round(b.length / top * 100)) : 0) + '%"' + (inside ? ' class="is-on"' : '') + '></i>';
      }).join('');
    }
    function paintSlider() {
      if (!hasPrice) return;
      smin.value = lo; smax.value = hi;
      var w = pMax - pMin;
      fp.style.setProperty('--a', String((lo - pMin) / w));
      fp.style.setProperty('--b', String((hi - pMin) / w));
      fp.querySelector('[data-plo-pminv]').textContent = 'AED ' + lo;
      fp.querySelector('[data-plo-pmaxv]').textContent = 'AED ' + hi + (hi === pMax ? '+' : '');
    }

    function apply(push) {
      var on = opts.filter(function (o) { return o.checked; }).map(function (o) { return o.value; });
      var shown = [];
      cards.forEach(function (c) {
        var ok = matches(c, on, true);
        c.hidden = !ok;
        if (ok) { shown.push(c); fitSize(c); }
      });
      var n = unique(shown);
      if (grouped) total = unique(cards);
      Array.prototype.forEach.call(scope.querySelectorAll('.plo-range'), function (row) {
        row.hidden = !row.querySelector('.plo-card:not([hidden])');
      });
      var nOn = on.length + (priceOn() ? 1 : 0);
      count.textContent = nOn ? n + ' of ' + plural(total) : plural(total);
      if (show) show.textContent = n;
      if (badge) { badge.hidden = !nOn; badge.textContent = nOn; }
      if (empty) empty.hidden = n > 0;
      /* Option counts: how many products each option would show with the other choices kept. */
      opts.forEach(function (o) {
        var rest = on.filter(function (v) { return group(v) !== group(o.value); }).concat([o.value]);
        var k = unique(cards.filter(function (c) { return matches(c, rest, true); }));
        var lab = o.closest('.plo-fopt');
        var out = lab.querySelector('[data-plo-fn]');
        if (out) out.textContent = k;
        lab.classList.toggle('is-none', k === 0 && !o.checked);
      });
      paintSlider();
      drawHist(on);
      if (active) {
        active.innerHTML = '';
        var chip = function (label, undo) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'plo-tools__chip';
          b.setAttribute('aria-label', 'Remove filter ' + label);
          b.innerHTML = '<span></span><i aria-hidden="true">&times;</i>';
          b.firstChild.textContent = label;
          b.addEventListener('click', function () { undo(); apply(true); });
          active.appendChild(b);
        };
        on.forEach(function (v) {
          var o = opts.filter(function (x) { return x.value === v; })[0];
          chip(o.getAttribute('data-label'), function () { o.checked = false; });
        });
        if (priceOn()) chip(priceLabel(), function () { lo = pMin; hi = pMax; });
        if (nOn > 1) {
          var c = document.createElement('button');
          c.type = 'button';
          c.className = 'plo-tools__clear';
          c.textContent = 'Clear all';
          c.addEventListener('click', clear);
          active.appendChild(c);
        }
        active.hidden = !nOn;
      }
      if (push && window.history && history.replaceState) {
        var vals = on.slice();
        if (priceOn()) vals.push('p:' + lo * 100 + '-' + hi * 100);
        var u = new URL(window.location.href);
        if (vals.length) u.searchParams.set('filter', vals.join(',')); else u.searchParams.delete('filter');
        history.replaceState(history.state, '', u.toString());
      }
    }
    function clear() { opts.forEach(function (o) { o.checked = false; }); lo = pMin; hi = pMax; apply(true); }

    /* Options that match nothing here go, then empty groups, then the button if nothing is left. */
    /* An option that matches nothing here, or everything here (all truffles are dark), filters
       nothing: leave it out. */
    opts.forEach(function (o) {
      var n = unique(cards.filter(function (c) { return test(c, o.value); }));
      if (!n || n === unique(cards)) o.closest('.plo-fopt').remove();
    });
    Array.prototype.forEach.call(tools.querySelectorAll('.plo-fgroup:not([data-plo-fprice])'), function (g) {
      if (!g.querySelector('[data-plo-fopt]')) g.remove();
    });
    opts = Array.prototype.slice.call(tools.querySelectorAll('[data-plo-fopt]'));
    if (hasPrice) {
      fp.hidden = false;
      [smin, smax].forEach(function (r) { r.min = pMin; r.max = pMax; });
      var GAP = 5;
      smin.addEventListener('input', function () { lo = Math.min(Number(smin.value), hi - GAP); apply(false); });
      smax.addEventListener('input', function () { hi = Math.max(Number(smax.value), lo + GAP); apply(false); });
      [smin, smax].forEach(function (r) { r.addEventListener('change', function () { apply(true); }); });
    } else if (fp) fp.remove();
    if (!opts.length && !hasPrice) { if (fbtn) fbtn.hidden = true; return; }

    var start = (new URL(window.location.href).searchParams.get('filter') || '').split(',');
    opts.forEach(function (o) { o.checked = start.indexOf(o.value) > -1; });
    start.forEach(function (v) {
      var m = /^p:(\d+)-(\d+)$/.exec(v);
      if (m && hasPrice) {
        lo = Math.max(pMin, Math.min(pMax, Math.round(Number(m[1]) / 100)));
        hi = Math.max(lo, Math.min(pMax, Math.round(Number(m[2]) / 100)));
      }
    });
    opts.forEach(function (o) { o.addEventListener('change', function () { apply(true); }); });
    Array.prototype.forEach.call(scope.querySelectorAll('[data-plo-fclear]'), function (b) { b.addEventListener('click', clear); });
    apply(false);
  }

  /* Reviews row: "See more reviews" loads further 4-5 star reviews (with some text) from Judge.me's
     public review feed, six at a time, as cards in the same style. Reviews already shown are
     skipped; the button goes when the feed runs out. Scrolling the row to the end loads too. */
  function initPrevMore(row) {
    var btn = row.querySelector('[data-plo-prev-more]');
    var shop = row.getAttribute('data-shop');
    var model = row.querySelector('.plo-prev__card');
    if (!shop || !model || !window.fetch || !window.DOMParser) { if (btn) btn.remove(); return; }
    var page = 0, busy = false, done = false, queue = [];
    var seen = Array.prototype.map.call(row.querySelectorAll('.plo-prev__card blockquote'), function (q) { return norm(q.textContent); });
    var stars = model.querySelector('.plo-prev__top > :first-child');
    var badge = model.querySelector('.plo-prev__ver');
    function norm(t) { return String(t || '').replace(/[“”"\s.…]+/g, ' ').trim().toLowerCase().slice(0, 60); }
    function handleOf(u) { var m = String(u || '').match(/\/products\/([^/?#]+)/); return m ? m[1] : ''; }
    function words(t, n) { var w = t.split(/\s+/); return w.length > n ? w.slice(0, n).join(' ') + '…' : t; }
    function fetchPage() {
      page++;
      var u = 'https://api.judge.me/reviews/all_reviews_js_based?url=' + encodeURIComponent(shop) + '&shop_domain=' + encodeURIComponent(shop) + '&platform=shopify&per_page=20&page=' + page;
      return fetch(u).then(function (r) { return r.json(); }).then(function (d) {
        var doc = new DOMParser().parseFromString(d.html || '', 'text/html');
        var revs = doc.querySelectorAll('.jdgm-rev');
        if (!revs.length) done = true;
        Array.prototype.forEach.call(revs, function (el) {
          var score = Number((el.querySelector('[data-score]') || {}).getAttribute ? el.querySelector('[data-score]').getAttribute('data-score') : 0);
          var body = ((el.querySelector('.jdgm-rev__body') || {}).textContent || '').replace(/\s+/g, ' ').trim();
          if (score < 4 || body.length < 25) return;
          var key = norm(body);
          if (seen.indexOf(key) > -1) return;
          seen.push(key);
          var a = el.querySelector('.jdgm-rev__prod-link');
          var pic = el.querySelector('.jdgm-rev__pics img');
          queue.push({
            handle: handleOf(a && a.getAttribute('href')),
            body: body,
            name: ((el.querySelector('.jdgm-rev__author') || {}).textContent || '').trim(),
            verified: el.getAttribute('data-verified-buyer') === 'true',
            product: a ? a.textContent.trim() : '',
            url: a ? a.getAttribute('href') : '',
            pic: pic ? (pic.getAttribute('data-src') || pic.getAttribute('src')) : ''
          });
        });
      });
    }
    function card(r) {
      var name = !r.name || /^anonymous$/i.test(r.name) ? 'A Plaayer' : r.name;
      var f = document.createElement('figure');
      f.className = 'plo-prev__card';
      var top = document.createElement('div');
      top.className = 'plo-prev__top';
      if (stars) top.appendChild(stars.cloneNode(true));
      if (r.verified && badge) top.appendChild(badge.cloneNode(true));
      f.appendChild(top);
      if (r.pic) { var im = document.createElement('img'); im.className = 'plo-prev__shot'; im.src = r.pic; im.alt = 'Photo from ' + name; im.loading = 'lazy'; im.width = 160; im.height = 160; f.appendChild(im); }
      var q = document.createElement('blockquote');
      q.textContent = '“' + words(r.body, 34) + '”';
      f.appendChild(q);
      var cap = document.createElement('figcaption');
      var av = document.createElement('span');
      av.className = 'plo-prev__av plo-prev__av--i';
      av.setAttribute('aria-hidden', 'true');
      av.textContent = name.charAt(0).toUpperCase();
      var who = document.createElement('span');
      var b = document.createElement('b'); b.textContent = name; who.appendChild(b);
      if (r.product) { var sm = document.createElement('small'); var l = document.createElement('a'); l.href = r.url; l.textContent = r.product; sm.appendChild(l); who.appendChild(sm); }
      cap.appendChild(av); cap.appendChild(who);
      f.appendChild(cap);
      return f;
    }
    function more() {
      if (busy) return;
      busy = true;
      btn.classList.add('is-busy');
      var fill = function () {
        if (queue.length >= 6 || done || page >= 15) return Promise.resolve();
        return fetchPage().then(fill);
      };
      fill().then(function () {
        queue.splice(0, 6).forEach(function (r) { row.insertBefore(r.nodeType ? r : card(r), btn); });
        if (done && !queue.length) btn.remove();
      }).catch(function () { btn.remove(); }).then(function () { busy = false; btn.classList.remove('is-busy'); });
    }
    /* Product page: this product's own 4-5 star reviews come first, in the same cards; any
       store-wide card that repeats one of them is dropped, and "See more" skips them. With none,
       the row stays exactly as rendered. */
    var pid = row.getAttribute('data-product');
    var cat = (row.getAttribute('data-cat') || '').split(',').filter(Boolean);
    var swiped = false;
    var server = Array.prototype.slice.call(row.querySelectorAll('.plo-prev__card'));
    var own = [];
    if (pid) {
      ['pointerdown', 'touchstart', 'wheel'].forEach(function (ev) { row.addEventListener(ev, function () { swiped = true; }, { passive: true, once: true }); });
      fetch('https://api.judge.me/reviews/reviews_for_widget?url=' + encodeURIComponent(shop) + '&shop_domain=' + encodeURIComponent(shop) + '&platform=shopify&page=1&per_page=20&product_id=' + encodeURIComponent(pid))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var mine = (d.reviews || []).filter(function (r) { return Number(r.rating) >= 4; }).map(function (r) {
            var tmp = document.createElement('div');
            tmp.innerHTML = r.body_html || '';
            return {
              body: (tmp.textContent || '').replace(/\s+/g, ' ').trim(),
              name: r.is_anonymous_reviewer ? '' : (r.reviewer_name || ''),
              verified: !!r.verified_buyer,
              product: r.product_title || '',
              url: r.product_url || '',
              pic: (r.pictures_urls && r.pictures_urls[0] && (r.pictures_urls[0].compact || r.pictures_urls[0].small || r.pictures_urls[0].original)) || ''
            };
          }).filter(function (r) { return r.body; });
          if (!mine.length) return;
          var keys = mine.map(function (r) { return norm(r.body); });
          Array.prototype.forEach.call(row.querySelectorAll('.plo-prev__card'), function (c) {
            var q = c.querySelector('blockquote');
            if (q && keys.indexOf(norm(q.textContent)) > -1) c.remove();
          });
          var first = row.querySelector('.plo-prev__card') || btn;
          mine.forEach(function (r) {
            seen.push(norm(r.body));
            var c = card(r);
            own.push(c);
            if (first) row.insertBefore(c, first); else row.appendChild(c);
          });
          /* The browser keeps the old first card in view (scroll anchoring); start at the new first one. */
          if (!swiped) row.scrollLeft = 0;
        })
        .catch(function () {})
        .then(byRange);
    }
    /* Then reviews of other products in the same range (truffles on a truffle page, bars on a bar
       page...): the whole store feed is read (a few small pages), range reviews take the places of
       the store-wide cards, which move to the front of "See more", and the rest follow. The number
       of cards shown stays the same; with no range reviews the row is left as it is. */
    function byRange() {
      if (!cat.length || !btn || busy) return;
      busy = true;
      var all = function () { return done || page >= 15 ? Promise.resolve() : fetchPage().then(all); };
      return all().then(function () {
        server = server.filter(function (c) { return c.parentNode === row; });
        var inCat = function (h) { return cat.indexOf(h) > -1; };
        var srvCat = server.filter(function (c) { var a = c.querySelector('figcaption a'); return a && inCat(handleOf(a.getAttribute('href'))); });
        var feedCat = queue.filter(function (r) { return inCat(r.handle); });
        if (!srvCat.length && !feedCat.length) return;
        queue = queue.filter(function (r) { return !inCat(r.handle); });
        var others = server.filter(function (c) { return srvCat.indexOf(c) < 0; });
        var slots = Math.max(0, server.length - srvCat.length);
        var add = feedCat.splice(0, slots);
        var held = others.slice(others.length - add.length);
        held.forEach(function (c) { c.remove(); });
        var at = others.filter(function (c) { return held.indexOf(c) < 0; })[0] || btn;
        srvCat.concat(add.map(card)).forEach(function (c) { if (at) row.insertBefore(c, at); else row.appendChild(c); });
        queue = feedCat.concat(held, queue);
        if (!swiped) row.scrollLeft = 0;
      }).catch(function () {}).then(function () { busy = false; });
    }
    if (!pid) byRange();
    if (!btn) return;
    btn.addEventListener('click', more);
    /* Phones: swiping to the end of the row loads the next six without a tap. */
    if ('IntersectionObserver' in window && window.matchMedia('(max-width: 1023px)').matches) {
      new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) more(); }); }, { root: row, rootMargin: '0px 200px 0px 0px' }).observe(btn);
    }
  }

  /* Product page rewards card (snippets/plo-offer-ladder): bag total + this product at the price
     and quantity shown -> which stops are reached and what the next one needs. Follows the pack size,
     quantity and purchase option, and the bag after every change (plaay:cart:updated). */
  function initOfferLadder(box) {
    var pdp = box.closest('[data-plo-pdp]') || document;
    var stops = (box.getAttribute('data-stops') || '').split(',').filter(Boolean).map(function (x) {
      var i = x.indexOf(':'); return { at: Number(x.slice(0, i)) * 100, label: x.slice(i + 1) };
    });
    if (!stops.length) return;
    var cart = Number(box.getAttribute('data-cart')) || 0;
    var ship = box.querySelector('[data-plo-offer-ship] span');
    var pill = box.querySelector('[data-plo-offer-next]');
    var fill = box.querySelector('[data-plo-offer-fill]');
    var steps = box.querySelectorAll('[data-plo-offer-step]');
    var hasShip = stops[0].label === 'Free delivery';
    var max = stops[stops.length - 1].at;
    var short = function (t) { return t === 'Free delivery' ? 'free delivery' : t; };
    function line() {
      var cta = pdp.querySelector('[data-plo-cta]');
      var each = cta ? Math.round(parseFloat(cta.textContent.replace(/[^0-9.]/g, '')) * 100) : Number(box.getAttribute('data-price')) || 0;
      var qty = pdp.querySelector('[data-plo-qty]');
      return each * (qty ? Math.max(1, Number(qty.value) || 1) : 1);
    }
    var last = -2;
    function paint() {
      var total = cart + line();
      var got = -1;
      stops.forEach(function (st, i) { if (total >= st.at) got = i; });
      Array.prototype.forEach.call(steps, function (li, i) { li.classList.toggle('is-on', i <= got); });
      if (fill) fill.style.width = Math.min(100, total / max * 100) + '%';
      var free = hasShip ? got >= 0 : false;
      if (ship) ship.textContent = free ? (box.getAttribute('data-ship-free') || 'Free 1–2 day delivery') : (box.getAttribute('data-ship-base') || '1–2 day UAE delivery');
      box.classList.toggle('is-free', free);
      var next = stops[got + 1];
      if (pill) {
        pill.hidden = false;
        pill.textContent = next ? aed(next.at - total) + ' → ' + short(next.label) : stops[got].label + ' unlocked 🎉';
      }
      box.classList.toggle('is-top', !next);
      /* A little pop when this change crossed a new stop. */
      if (last > -2 && got > last) { box.classList.remove('is-pop'); void box.offsetWidth; box.classList.add('is-pop'); }
      last = got;
    }
    function refresh() {
      if (!window.fetch) return;
      fetch(((window.routes || {}).cart_url || '/cart') + '.js', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (c) { cart = Number(c.original_total_price) || 0; paint(); })
        .catch(function () {});
    }
    pdp.addEventListener('change', function () { setTimeout(paint, 0); });
    pdp.addEventListener('input', function (e) { if (e.target.matches && e.target.matches('[data-plo-qty]')) paint(); });
    pdp.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-plo-q]')) setTimeout(paint, 0); });
    document.addEventListener('plaay:cart:updated', refresh);
    window.addEventListener('pageshow', function (e) { if (e.persisted) refresh(); });
    paint();
  }

  /* Each feature starts on its own: an error in one (missing markup, an app changing the page)
     is logged and the others still start. */
  function safe(fn, arg) {
    try { fn(arg); } catch (e) { if (window.console) console.error('[pl-opt] ' + (fn.name || 'init'), e); }
  }
  function each(sel, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) { safe(fn, el); });
  }
  function init() {
    each('[data-plo-prev]', initPrevMore);
    each('[data-plo-offer]', initOfferLadder);
    safe(initPops);
    safe(initHearts);
    safe(resetCardSizes);
    each('[data-plo-filter]', initCollFilter);
    each('[data-plo-wl]', initWishlist);
    each('[data-plo-faqp]', initFaqPage);
    safe(initReelBand);
    safe(initMore);
    safe(initFades);
    safe(initReveal);
    each('[data-plo-carousel]', initCarousel);
    each('[data-plo-pdp]', initPdp);
    each('[data-plo-photos]', initPhotos);
    safe(initDetailWidgets);
    each('[data-plo-reels]', initReels);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
