/* Bottom nav: sheet open/close, accordions, cart badge.

   Extracted from snippets/mobile-bottom-nav.liquid, where it was an inline <script> in the page body -
   4091 bytes of JavaScript re-sent on every navigation instead of being cached once.
   Loaded with defer, so it now runs after the document is parsed rather than at the
   point it appeared; every entry point here is either delegated from `document` or
   guarded on readyState, so later is safe. */

(function() {
    var nav      = document.getElementById('plaay-bottom-nav');
    var sheet    = document.getElementById('pbn-shop-sheet');
    var backdrop = document.getElementById('pbn-sheet-backdrop');
    if (!nav) return;

    /* ── Active tab ── */
    var path = window.location.pathname;
    nav.querySelectorAll('[data-pbn-path]').forEach(function(tab) {
      var p = tab.getAttribute('data-pbn-path');
      if (p === '/' ? path === '/' : path.startsWith(p)) tab.classList.add('is-active');
    });

    /* ── Accordion ── */
    sheet.querySelectorAll('[data-pbn-accordion]').forEach(function(group) {
      var btn      = group.querySelector('.pbn-nav__parent');
      var children = group.querySelector('.pbn-nav__children');
      if (!btn || !children) return;
      btn.addEventListener('click', function() {
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        children.classList.toggle('is-open', !open);
      });
    });

    /* ── Sheet open / close ── */
    var shopBtn   = document.getElementById('pbn-shop-btn');
    var closeBtn  = document.getElementById('pbn-sheet-close');
    var sheetOpen = false;

    function openSheet() {
      sheet.classList.add('is-open');
      backdrop.classList.add('is-open');
      document.body.classList.add('pbn-menu-open');
      shopBtn.classList.add('is-active');
      sheetOpen = true;
    }
    function closeSheet() {
      sheet.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      document.body.classList.remove('pbn-menu-open');
      shopBtn.classList.remove('is-active');
      sheetOpen = false;
    }

    shopBtn.addEventListener('click', function() { sheetOpen ? closeSheet() : openSheet(); });
    closeBtn.addEventListener('click', closeSheet);
    backdrop.addEventListener('click', closeSheet);
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && sheetOpen) closeSheet(); });
    sheet.querySelectorAll('a').forEach(function(a) { a.addEventListener('click', closeSheet); });

    /* ── Cart ── */
    document.getElementById('pbn-cart-btn').addEventListener('click', function() {
      var sd = document.querySelector('site-drawers');
      if (sd) sd.activeDrawer = 'cart';
    });

    /* ── Badge sync ── */
    var badge = document.getElementById('pbn-cart-badge');

    function setBadge(count) {
      if (!badge) return;
      badge.textContent = count;
      badge.classList.toggle('pbn__badge--hidden', count === 0);
    }

    function fetchAndSetBadge() {
      fetch('/cart.js', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(c) { setBadge(c.item_count || 0); })
        .catch(function() {});
    }

    /* Intercept fetch calls to any cart-mutating endpoint */
    var _origFetch = window.fetch;
    window.fetch = function(input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var isCartWrite = /\/cart\/(add|change|update|clear)/.test(url);
      var p = _origFetch.apply(this, arguments);
      if (isCartWrite) {
        p.then(function() { setTimeout(fetchAndSetBadge, 80); }).catch(function() {});
      }
      return p;
    };

    /* Also catch themes that use XMLHttpRequest for cart calls */
    var _origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      if (/\/cart\/(add|change|update|clear)/.test(url)) {
        this.addEventListener('load', function() { setTimeout(fetchAndSetBadge, 80); });
      }
      return _origOpen.apply(this, arguments);
    };

    /* Fallback: watch header count + theme events */
    var headerCount = document.querySelector('[data-cart-count]');
    if (headerCount) {
      new MutationObserver(function() { fetchAndSetBadge(); })
        .observe(headerCount, { childList: true, subtree: true });
    }
    document.addEventListener('cart:updated', fetchAndSetBadge);
    document.addEventListener('cart:refresh', fetchAndSetBadge);
  })();
