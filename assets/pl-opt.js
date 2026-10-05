/* Plaay redesign preview (Option A / Option B templates only).
   1. Banner carousel: dots follow the scroll position, auto-advance until the shopper touches it.
   2. Cart page: quantity, remove, subscribe switch and upsell add, each a /cart/*.js call
      followed by a reload so the page (and its ?view= option) re-renders from Liquid.
   3. Product page: gallery thumbs, pack size and subscribe/one-time prices, quantity, add to
      bag via /cart/add.js then the cart in the same option, and the sticky add bar. */
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
  function initPdp(root) {
    var form = root.querySelector('[data-plo-form]');
    if (!form) return;
    var pct = Number(root.getAttribute('data-pct') || 0);
    var view = root.getAttribute('data-view') || '';
    var variantInput = form.querySelector('[data-plo-variant]');
    var planInput = form.querySelector('[data-plo-plan]');
    var qty = form.querySelector('[data-plo-qty]');
    var addBtn = form.querySelector('[data-plo-add]');
    var main = root.querySelector('.plo-gal__img');
    var checked = form.querySelector('[data-plo-size]:checked');
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
    }
    form.addEventListener('change', function (e) {
      if (e.target.matches('[data-plo-size]')) {
        variantInput.value = e.target.value;
        price = Number(e.target.getAttribute('data-price'));
      }
      if (planInput) planInput.disabled = !isSub();
      paint();
    });
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
        .then(function () { window.location.href = ((window.routes || {}).cart_url || '/cart') + (view ? '?view=' + view : ''); })
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


  /* ---------- bag: stay inside the option being previewed ----------
     The theme's bag icon and quick-add open the live cart drawer, which is the same in both
     options. On the preview templates the bag icon goes to the option's own cart page, and
     the card "+" adds in place and shows a small toast with a link to that cart.
     Window capture runs before the theme's document-capture cart handler. */
  function viewName() {
    var m = document.body.className.match(/pl-skin-([ab])/);
    return m ? 'option-' + m[1] : '';
  }
  function cartHref() {
    var v = viewName();
    return ((window.routes || {}).cart_url || '/cart') + (v ? '?view=' + v : '');
  }
  var toastTimer = null;
  function toast(msg) {
    var el = document.querySelector('.plo-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'plo-toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.innerHTML = '<span></span><a href="' + cartHref() + '">View bag</a>';
    el.firstChild.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, 4000);
  }
  function syncCount() {
    fetch(((window.routes || {}).cart_url || '/cart') + '.js', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (c) {
        Array.prototype.forEach.call(document.querySelectorAll('[data-cart-count]'), function (el) {
          el.textContent = c.item_count;
          el.hidden = c.item_count === 0;
        });
      }).catch(function () {});
  }
  window.addEventListener('click', function (e) {
    if (!viewName() || !e.target.closest) return;
    var bag = e.target.closest('.header__icon--cart, [data-drawer-trigger="cart"], [data-pl-tab="bag"]');
    if (bag) {
      e.preventDefault();
      e.stopImmediatePropagation();
      window.location.href = cartHref();
      return;
    }
    var add = e.target.closest('[data-plo-quick]');
    if (add) {
      e.preventDefault();
      e.stopImmediatePropagation();
      var card = add.closest('.plo-card');
      var name = card && card.querySelector('.plo-card__name') ? card.querySelector('.plo-card__name').textContent.trim() : 'Item';
      add.classList.add('is-busy');
      post(((window.routes || {}).cart_add_url || '/cart/add') + '.js', { items: [{ id: Number(add.getAttribute('data-plo-quick')), quantity: 1 }] })
        .then(function () { add.classList.remove('is-busy'); toast(name + ' added to your bag'); syncCount(); })
        .catch(function (err) { fail(add, err); });
    }
  }, true);


  /* ---------- photo gallery (refreshed photography) ---------- */
  function initPhotos(root) {
    var track = root.querySelector('[data-plo-phtrack]');
    var thumbs = Array.prototype.slice.call(root.querySelectorAll('[data-plo-go]'));
    if (!track) return;
    function mark(i) { thumbs.forEach(function (t, n) { t.classList.toggle('is-on', n === i); }); }
    thumbs.forEach(function (t) {
      t.addEventListener('click', function () {
        var i = Number(t.getAttribute('data-plo-go'));
        var img = track.children[i];
        if (img) track.scrollTo({ left: img.offsetLeft - track.offsetLeft, behavior: 'smooth' });
        mark(i);
      });
    });
    var raf = null;
    track.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = null; mark(Math.round(track.scrollLeft / Math.max(1, track.clientWidth))); });
    }, { passive: true });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-plo-carousel]'), initCarousel);
    Array.prototype.forEach.call(document.querySelectorAll('[data-plo-pdp]'), initPdp);
    Array.prototype.forEach.call(document.querySelectorAll('[data-plo-photos]'), initPhotos);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
