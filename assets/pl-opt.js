/* Plaay redesign preview (Option A / Option B templates only).
   1. Banner carousel: dots follow the scroll position, auto-advance until the shopper touches it.
   2. Cart page: quantity, remove, subscribe switch and upsell add, each a /cart/*.js call
      followed by a reload so the page (and its ?view= option) re-renders from Liquid. */
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

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-plo-carousel]'), initCarousel);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
