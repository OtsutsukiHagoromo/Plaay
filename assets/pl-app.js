/* Plaay app feel: haptics, photo morph between pages, bag swipe to close, and the home screen
   app extras (back button, pull to refresh).

   Loaded (defer) from layout/theme.liquid on every page. Dependency-free.

   - window.plHaptic(kind): 'tap' on every key control (delegated below). Android vibrates;
     iPhone (iOS 18+) has no vibration API, so a hidden system switch is toggled, which plays the
     switch tick. That only works inside a tap, so 'unlock' (after a request) is Android only.
   - Page transitions are CSS (@view-transition in assets/pl-shell.css). Here: the photo of the
     product card that was tapped is named so it morphs into the product page gallery; the new
     page names its gallery photo from the inline listener in snippets/pl-app-head.liquid.
   - Bag (phones): swipe it to the right to close.
   - Invite to save the app (see the block below), outside the app only.
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

  /* ---------- haptics ----------
     One haptic per action, at the moment of the tap: the bag opening after an add is its own
     confirmation, so there is no second "success" buzz. The reward unlock buzz (Android) is
     skipped when a tap buzz played in the last 1.5 s, so two never land together. */
  var tick = null, lastTap = 0;
  function makeTick() {
    if (tick || !ios || !doc.body) return;
    tick = doc.createElement('label');
    tick.setAttribute('aria-hidden', 'true');
    tick.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;clip-path:inset(50%)';
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
  /* Ready before the first tap, so the tick plays on the tap itself. */
  if (touch && ios) {
    if (window.requestIdleCallback) requestIdleCallback(makeTick, { timeout: 1500 });
    else setTimeout(makeTick, 300);
  }
  function haptic(kind) {
    if (!touch) return;
    kind = kind || 'tap';
    var now = Date.now();
    if (kind === 'tap') lastTap = now;
    else if (now - lastTap < 1500) return;
    if (navigator.vibrate) {
      try { navigator.vibrate(kind === 'unlock' ? [14, 60, 14, 60, 24] : 12); } catch (e) {}
      return;
    }
    if (!ios || kind !== 'tap') return;
    makeTick();
    if (tick) tick.click();
  }
  window.plHaptic = haptic;

  var TAPS = [
    '[data-plo-quick]', '[data-plo-add]', '[data-plo-sticky-add]', 'quick-add [data-add]', '[data-pl-gap-add]',
    '[data-cart-item] [data-minus]', '[data-cart-item] [data-plus]', '.pl-item__remove', '[data-plo-q]',
    '[data-pl-sub-on]', '[data-pl-sub-off]', '.plo-size', '.plo-freq__o', '.plo-freq__l', '[data-plo-heart]',
    '.pl-tabbar__tab', '.plo-tab', '.plo-chip', '.plo-chips a', '.plo-chips button', '.pl-drawer__checkout',
    '[data-plo-mode]', '[data-pl-cookie-close]'
  ].join(',');
  /* On window, capture phase, registered before the other scripts: some add buttons stop the
     click early (assets/pl-opt.js card "+"), and the tick must play on the tap itself. */
  window.addEventListener('click', function (e) {
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

  /* ---------- bag drawer: swipe right to close (phones) ----------
     The bag slides in from the right; a sideways drag to the right follows the finger and
     closes it past a quarter of the width (or on a quick flick). Vertical scrolling and
     sideways scrollers inside the bag (product picks) are left alone. */
  (function () {
    var drawer = doc.querySelector('cart-drawer');
    if (!drawer || !touch) return;
    var panel = drawer.querySelector('.pl-drawer');
    var x0 = 0, y0 = 0, dx = 0, t0 = 0, state = null;
    function sideScroller(el) {
      for (; el && el !== drawer; el = el.parentElement) if (el.scrollWidth > el.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
      return false;
    }
    drawer.addEventListener('touchstart', function (e) {
      state = null;
      if (!drawer.classList.contains('active') || window.innerWidth >= 1024 || e.touches.length !== 1 || sideScroller(e.target)) return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; t0 = Date.now(); state = 'maybe';
    }, { passive: true });
    drawer.addEventListener('touchmove', function (e) {
      if (!state) return;
      dx = e.touches[0].clientX - x0;
      var dy = e.touches[0].clientY - y0;
      if (state === 'maybe') {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.3) { state = 'drag'; panel.style.transition = 'none'; }
        else { state = null; return; }
      }
      if (e.cancelable) e.preventDefault();
      panel.style.transform = 'translateX(' + Math.max(0, dx) + 'px)';
    }, { passive: false });
    function end() {
      if (state !== 'drag') { state = null; return; }
      state = null;
      panel.style.transition = '';
      panel.style.transform = '';
      var fast = dx / Math.max(1, Date.now() - t0) > .6;
      if (dx > panel.offsetWidth * .25 || (fast && dx > 40)) { if (window.plCart) window.plCart.closeDrawer(); }
    }
    drawer.addEventListener('touchend', end);
    drawer.addEventListener('touchcancel', end);
  })();

  /* ---------- invite to save the app ----------
     A bottom sheet with how to add Plaay to the home screen: Android / Chrome get the browser's
     own install prompt behind our button; iPhone gets the Share steps (Apple has no prompt);
     in-app browsers (Instagram, TikTok...) are told to open Safari first.
     Shown by itself at most once a visit (a visit ends after 30 minutes away; iPhone users keep
     one Safari tab for days, so tabs are not visits), only on phones, never inside the app:
       - when the bag closes after an add to bag;
       - on the account page.
     Also opened any time from "Get the Plaay app" in the menu ([data-pl-get-app]).
     Closing it keeps it away for 30 days; once installed it never shows again.
     Events: Clarity "app_invite_<action>", Shopify.analytics "pl_app_invite". */
  (function () {
    function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    var DAY = 864e5;
    var deferred = null, sheet = null, lastFocus = null, source = '';
    var ua = navigator.userAgent;
    var inAppBrowser = /FBAN|FBAV|Instagram|Line\/|TikTok|musical_ly|Bytedance|Snapchat|Pinterest/i.test(ua);

    function track(action) {
      try { if (window.clarity) window.clarity('event', 'app_invite_' + action); } catch (e) {}
      try { if (window.Shopify && Shopify.analytics && Shopify.analytics.publish) Shopify.analytics.publish('pl_app_invite', { action: action, source: source }); } catch (e) {}
    }

    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; });
    window.addEventListener('appinstalled', function () { set('pl-app-installed', '1'); track('installed'); close(0); });

    if (isApp) return;

    var visits = Number(get('pl-visits')) || 0;
    if (Date.now() - (Number(get('pl-last')) || 0) > 30 * 60 * 1000) { visits += 1; set('pl-visits', String(visits)); }
    set('pl-last', String(Date.now()));

    function due() {
      return touch && !get('pl-app-installed') && get('pl-inv-visit') !== String(visits) && Date.now() > (Number(get('pl-inv-snooze')) || 0);
    }

    var ICON = {
      share: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>',
      add: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
      check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
      menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
      safari: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
      close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>'
    };
    function step(icon, html) { return '<li><i aria-hidden="true">' + ICON[icon] + '</i><span>' + html + '</span></li>'; }

    function body() {
      if (deferred) {
        return '<button type="button" class="pl-inv__go" data-inv-install>Add to home screen</button>' +
          '<button type="button" class="pl-inv__later" data-inv-close>Not now</button>';
      }
      var steps;
      if (ios && inAppBrowser) {
        steps = step('safari', 'Open this page in <b>Safari</b>: tap <b>•••</b> or the share icon in this app, then <b>Open in browser</b>.') +
          step('share', 'In Safari, tap <b>Share</b>. On iOS 26, tap <b>•••</b> first.') +
          step('add', 'Choose <b>Add to Home Screen</b>, then <b>Add</b>.');
      } else if (ios) {
        steps = step('share', 'Tap <b>Share</b> in the browser toolbar. On iOS 26, tap <b>•••</b> first.') +
          step('add', 'Choose <b>Add to Home Screen</b>. You may need to scroll down.') +
          step('check', 'Tap <b>Add</b>. Plaay is now on your home screen.');
      } else {
        steps = step('menu', 'Open your browser menu (<b>⋮</b>).') +
          step('add', 'Tap <b>Add to Home screen</b> or <b>Install app</b>.') +
          step('check', 'Confirm. Plaay is now on your home screen.');
      }
      return '<ol class="pl-inv__steps">' + steps + '</ol><button type="button" class="pl-inv__later" data-inv-close>Got it</button>';
    }

    function build() {
      var icon = doc.querySelector('link[rel="apple-touch-icon"]');
      sheet = doc.createElement('div');
      sheet.className = 'pl-inv';
      sheet.hidden = true;
      sheet.innerHTML = '<div class="pl-inv__scrim" data-inv-close></div>' +
        '<div class="pl-inv__card" role="dialog" aria-modal="true" aria-labelledby="pl-inv-t" tabindex="-1">' +
        '<button type="button" class="pl-inv__x" data-inv-close aria-label="Close">' + ICON.close + '</button>' +
        '<div class="pl-inv__head">' + (icon ? '<img src="' + icon.href + '" width="60" height="60" alt="">' : '') +
        '<div><h2 id="pl-inv-t">Get the Plaay app</h2><p>Add Plaay to your home screen. It opens full screen, with your bag one tap away.</p></div></div>' +
        '<div class="pl-inv__body" data-inv-body></div></div>';
      doc.body.appendChild(sheet);
      sheet.addEventListener('click', function (e) {
        if (e.target.closest('[data-inv-close]')) { track('dismissed'); close(30); return; }
        if (e.target.closest('[data-inv-install]') && deferred) {
          var d = deferred;
          deferred = null;
          d.prompt();
          d.userChoice.then(function (c) {
            if (c && c.outcome === 'accepted') { set('pl-app-installed', '1'); track('accepted'); close(0); }
            else { track('declined'); close(30); }
          }, function () { close(30); });
        }
      });
      doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet && !sheet.hidden) close(30); });
    }

    function open(from) {
      if (!sheet) build();
      source = from;
      set('pl-inv-visit', String(visits));
      if (window.plCloseSheets) window.plCloseSheets();
      sheet.querySelector('[data-inv-body]').innerHTML = body();
      lastFocus = doc.activeElement;
      sheet.hidden = false;
      doc.body.classList.add('pl-inv-open');
      void sheet.offsetWidth;
      sheet.classList.add('is-open');
      sheet.querySelector('.pl-inv__card').focus({ preventScroll: true });
      track('shown');
    }

    function close(days) {
      if (!sheet || sheet.hidden) return;
      if (days) set('pl-inv-snooze', String(Date.now() + days * DAY));
      sheet.classList.remove('is-open');
      doc.body.classList.remove('pl-inv-open');
      setTimeout(function () { sheet.hidden = true; }, calm ? 0 : 320);
      if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
    }

    window.plOpenAppInvite = open;

    /* Menu row: on phones, outside the app. */
    if (touch) Array.prototype.forEach.call(doc.querySelectorAll('[data-pl-get-app-row]'), function (r) { r.hidden = false; });
    doc.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-pl-get-app]')) { e.preventDefault(); open('menu'); }
    });

    /* After an add to bag: wait for the bag to close. */
    var afterBag = false, bagSeen = false;
    doc.addEventListener('pl:cart:added', function () { if (due()) { afterBag = true; bagSeen = false; } });
    new MutationObserver(function () {
      if (!afterBag) return;
      if (doc.body.classList.contains('pl-drawer-open')) { bagSeen = true; return; }
      if (!bagSeen) return;
      afterBag = false;
      setTimeout(function () { if (due()) open('after_add'); }, 700);
    }).observe(doc.body, { attributes: true, attributeFilter: ['class'] });

    /* Account page. */
    if (/^\/account\/?$/.test(location.pathname)) setTimeout(function () { if (due()) open('account'); }, 2500);
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
