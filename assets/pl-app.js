/* Plaay app feel: haptics, photo morph between pages, bag sheet swipe, and the home screen
   app extras (back button, pull to refresh).

   Loaded (defer) from layout/theme.liquid on every page. Dependency-free.

   - window.plHaptic(kind): 'tap' on every key control (delegated below). Android vibrates;
     iPhone (iOS 18+) has no vibration API, so a hidden system switch is toggled, which plays the
     switch tick. That only works inside a tap, so 'success' / 'unlock' (after a request) are
     Android only.
   - Page transitions are CSS (@view-transition in assets/pl-shell.css). Here: the photo of the
     product card that was tapped is named so it morphs into the product page gallery; the new
     page names its gallery photo from the inline listener in snippets/pl-app-head.liquid.
   - Bag sheet (phones): drag the bag down by its top bar, or from the top of its list, to close.
   - Home screen app only (html.pl-app, set by snippets/pl-app-head.liquid): a back arrow in the
     header (saved apps have no browser back button), pull to refresh (saved apps lose
     Safari's), and app visits tagged in Microsoft Clarity. */
(function () {
  if (window.plHaptic) return;
  var doc = document, html = doc.documentElement;
  var isApp = html.classList.contains('pl-app');
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches;
  var ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (/Mac/.test(navigator.userAgent) && 'ontouchend' in doc);

  /* ---------- haptics ---------- */
  var tick = null;
  function haptic(kind) {
    if (!touch) return;
    kind = kind || 'tap';
    if (navigator.vibrate) {
      try { navigator.vibrate(kind === 'success' ? [12, 70, 18] : kind === 'unlock' ? [14, 60, 14, 60, 24] : 8); } catch (e) {}
      return;
    }
    if (!ios || kind !== 'tap') return;
    if (!tick) {
      tick = doc.createElement('label');
      tick.setAttribute('aria-hidden', 'true');
      tick.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden';
      var input = doc.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      tick.appendChild(input);
      /* Keep the synthetic click to itself (outside-click handlers must not see it). */
      tick.addEventListener('click', function (e) { e.stopPropagation(); });
      input.addEventListener('click', function (e) { e.stopPropagation(); });
      doc.body.appendChild(tick);
    }
    tick.click();
  }
  window.plHaptic = haptic;

  var TAPS = [
    '[data-plo-quick]', '[data-plo-add]', '[data-plo-sticky-add]', 'quick-add [data-add]', '[data-pl-gap-add]',
    '[data-cart-item] [data-minus]', '[data-cart-item] [data-plus]', '.pl-item__remove', '[data-plo-q]',
    '[data-pl-sub-on]', '[data-pl-sub-off]', '.plo-size', '.plo-freq__o', '.plo-freq__l', '[data-plo-heart]',
    '.pl-tabbar__tab', '.plo-tab', '.plo-chip', '.plo-chips a', '.plo-chips button', '.pl-drawer__checkout',
    '[data-plo-mode]', '[data-pl-cookie-close]'
  ].join(',');
  doc.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest(TAPS);
    if (t) haptic('tap');
  }, true);

  /* ---------- photo morph: card -> product page ---------- */
  var lastPhoto = null;
  doc.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="/products/"]');
    if (!a) return;
    var card = a.closest('.plo-card, .plo-tile, .pl-tile, .plo-prev__card, .plaay-upsell-card');
    lastPhoto = card ? card.querySelector('img') : null;
  }, true);
  window.addEventListener('pageswap', function (e) {
    if (!e.viewTransition || !lastPhoto) return;
    var to = (e.activation && e.activation.entry && e.activation.entry.url) || '';
    if (to.indexOf('/products/') < 0) return;
    var r = lastPhoto.getBoundingClientRect();
    if (r.bottom > 0 && r.top < window.innerHeight) lastPhoto.style.viewTransitionName = 'pl-photo';
  });
  window.addEventListener('pageshow', function () {
    if (lastPhoto) { lastPhoto.style.viewTransitionName = ''; lastPhoto = null; }
  });

  /* ---------- bag sheet: swipe down to close (phones) ---------- */
  (function () {
    var drawer = doc.querySelector('cart-drawer');
    if (!drawer || !touch) return;
    var sheet = drawer.querySelector('.pl-drawer');
    var startY = 0, dy = 0, dragging = false, from = null, t0 = 0;
    function scroller() { return drawer.querySelector('.pl-drawer__scroll'); }
    drawer.addEventListener('touchstart', function (e) {
      if (!drawer.classList.contains('active') || window.innerWidth >= 1024) return;
      var head = e.target.closest('.pl-drawer__head');
      var sc = scroller();
      var inList = sc && sc.contains(e.target) && sc.scrollTop <= 0;
      if (!head && !inList) return;
      from = head ? 'head' : 'list';
      startY = e.touches[0].clientY; dy = 0; dragging = false; t0 = Date.now();
    }, { passive: true });
    drawer.addEventListener('touchmove', function (e) {
      if (!from) return;
      dy = e.touches[0].clientY - startY;
      if (!dragging) {
        if (dy < 6) { if (dy < -4) from = null; return; }
        dragging = true;
        sheet.style.transition = 'none';
      }
      if (e.cancelable) e.preventDefault();
      sheet.style.transform = 'translateY(' + Math.max(0, dy) + 'px)';
    }, { passive: false });
    function end() {
      if (!from) return;
      from = null;
      if (!dragging) return;
      dragging = false;
      sheet.style.transition = '';
      var fast = dy / Math.max(1, Date.now() - t0) > .6;
      if (dy > sheet.offsetHeight * .25 || (fast && dy > 40)) {
        sheet.style.transform = '';
        if (window.plCart) window.plCart.closeDrawer();
      } else {
        sheet.style.transform = '';
      }
    }
    drawer.addEventListener('touchend', end);
    drawer.addEventListener('touchcancel', end);
  })();

  if (!isApp) return;

  /* ---------- home screen app ---------- */
  try {
    window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
    window.clarity('set', 'app_mode', 'home_screen');
  } catch (e) {}

  /* Back arrow, left of the menu button, on every page but the home page. */
  (function () {
    var left = doc.querySelector('.pl-header__left');
    if (!left || location.pathname === '/' || left.querySelector('.pl-header__back')) return;
    var b = doc.createElement('button');
    b.type = 'button';
    b.className = 'pl-iconbtn pl-iconbtn--ghost pl-header__back';
    b.setAttribute('aria-label', 'Back');
    b.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
    b.addEventListener('click', function () {
      var same = doc.referrer && doc.referrer.indexOf(location.origin) === 0;
      if (same && history.length > 1) history.back();
      else location.href = '/';
    });
    left.insertBefore(b, left.firstChild);
  })();

  /* Pull to refresh: pull down from the very top of the page, let go past the line. */
  (function () {
    var ind = doc.createElement('div');
    ind.className = 'pl-ptr';
    ind.setAttribute('aria-hidden', 'true');
    ind.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';
    doc.body.appendChild(ind);
    var y0 = null, pull = 0, armed = false, LINE = 72;
    function blocked() {
      var b = doc.body;
      return b.classList.contains('overflow-hidden') || b.classList.contains('pl-drawer-open') || b.classList.contains('pl-sheet-open') || doc.querySelector('.pl-sheet.is-open');
    }
    window.addEventListener('touchstart', function (e) {
      y0 = window.scrollY <= 0 && !blocked() && e.touches.length === 1 ? e.touches[0].clientY : null;
      pull = 0; armed = false;
    }, { passive: true });
    window.addEventListener('touchmove', function (e) {
      if (y0 == null) return;
      pull = Math.max(0, (e.touches[0].clientY - y0) * .5);
      if (window.scrollY > 0) { y0 = null; pull = 0; }
      ind.style.transform = 'translate(-50%, ' + Math.min(pull, LINE + 16) + 'px) rotate(' + Math.min(pull / LINE, 1) * 180 + 'deg)';
      ind.style.opacity = String(Math.min(pull / LINE, 1));
      var now = pull >= LINE;
      if (now !== armed) { armed = now; ind.classList.toggle('is-armed', armed); }
    }, { passive: true });
    window.addEventListener('touchend', function () {
      if (y0 == null) return;
      y0 = null;
      if (armed) {
        haptic('tap');
        ind.classList.add('is-loading');
        location.reload();
        return;
      }
      ind.style.transform = '';
      ind.style.opacity = '';
      ind.classList.remove('is-armed');
    }, { passive: true });
  })();
})();
