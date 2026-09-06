/* Plaay 2026 shell: sheets (search + mobile menu), mega menu, search suggest,
   recent searches, tab bar, bag count sync. Dependency-free. Loaded with defer from
   sections/pl-header.liquid and snippets/pl-tabbar.liquid; the guard below makes a
   second execution a no-op. */
(function () {
  if (window.plShell) return;
  window.plShell = true;

  var d = document;
  var body = d.body;
  var RECENT_KEY = 'pl_recent_searches';
  var RECENT_MAX = 5;
  var active = null;
  var lastFocus = null;

  function q(sel, root) { return (root || d).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || d).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function icon(name) {
    var paths = {
      clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
      close: '<path d="M6 6l12 12M18 6L6 18"/>',
      chev: '<path d="M9 6l6 6-6 6"/>',
      arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
    };
    return '<svg class="pl-ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + paths[name] + '</svg>';
  }

  /* ---------- sheets ---------- */
  function sheet(name) { return q('[data-pl-sheet="' + name + '"]'); }
  function overlay() { return q('[data-pl-overlay]'); }

  function openSheet(name) {
    var el = sheet(name);
    if (!el) return false;
    if (active && active !== name) {
      var prev = sheet(active);
      if (prev) { prev.classList.remove('is-open'); prev.setAttribute('aria-hidden', 'true'); }
    }
    if (!active) lastFocus = d.activeElement;
    active = name;
    body.classList.add('pl-lock');
    var ov = overlay();
    if (ov) ov.classList.add('is-open');
    /* Added synchronously (the sheet is visibility-hidden, not display-none, so the
       transition still runs) so that a focus() call in the same user gesture works on iOS. */
    el.setAttribute('aria-hidden', 'false');
    el.classList.add('is-open');
    qa('[data-pl-open-menu],[data-pl-tab="menu"]').forEach(function (b) {
      b.setAttribute('aria-expanded', name === 'menu' ? 'true' : 'false');
    });
    return true;
  }

  function closeSheets() {
    if (!active) return;
    var el = sheet(active);
    if (el) { el.classList.remove('is-open'); el.setAttribute('aria-hidden', 'true'); }
    var ov = overlay();
    if (ov) ov.classList.remove('is-open');
    body.classList.remove('pl-lock');
    active = null;
    qa('[data-pl-open-menu],[data-pl-tab="menu"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    if (lastFocus && lastFocus.focus && d.contains(lastFocus)) {
      try { lastFocus.focus({ preventScroll: true }); } catch (e) { lastFocus.focus(); }
    }
    lastFocus = null;
  }

  window.plOpenSearch = function (seed) {
    if (!openSheet('search')) return;
    var input = q('[data-pl-search-input]');
    if (!input) return;
    if (typeof seed === 'string' && seed) input.value = seed;
    renderRecent();
    toggleClear();
    input.focus();
    try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
    if (input.value.trim().length >= 2) runSuggest(input.value.trim());
    setTimeout(function () { if (d.activeElement !== input && active === 'search') input.focus(); }, 40);
  };
  window.plOpenMenu = function () {
    if (active === 'menu') { closeSheets(); return; }
    if (!openSheet('menu')) return;
    var first = q('[data-pl-sheet="menu"] a, [data-pl-sheet="menu"] button');
    if (first) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) {} }, 60);
  };
  window.plCloseSheets = closeSheets;

  /* ---------- bag ---------- */
  function openBag() {
    closeSheets();
    if (body.classList.contains('template-cart')) return;
    var sd = q('site-drawers');
    if (sd && sd.activeDrawer !== undefined && sd.querySelector('[data-drawer="cart"]')) {
      sd.activeDrawer = 'cart';
      return;
    }
    var btn = q('.header__icon--cart');
    if (btn) { btn.click(); return; }
    window.location.href = (window.routes && window.routes.cart_url) || '/cart';
  }

  /* ---------- count sync ---------- */
  function readCount() {
    var c = q('[data-cart-drawer-content]');
    if (c && c.hasAttribute('data-cart-item-count')) return parseInt(c.getAttribute('data-cart-item-count'), 10) || 0;
    var dc = q('[data-cart-drawer-count]');
    if (dc) return parseInt(dc.textContent, 10) || 0;
    return null;
  }
  function syncCount(n) {
    qa('[data-cart-count]').forEach(function (el) {
      if (n !== null && n !== undefined && String(n) !== el.textContent.trim()) el.textContent = String(n);
      var v = parseInt(el.textContent, 10) || 0;
      if (v === 0) el.setAttribute('hidden', ''); else el.removeAttribute('hidden');
    });
  }
  var countTimer;
  function scheduleSync() {
    clearTimeout(countTimer);
    countTimer = setTimeout(function () { syncCount(readCount()); }, 60);
  }

  /* ---------- mega menu ---------- */
  function initMega() {
    qa('[data-pl-mega-parent]').forEach(function (li) {
      var link = q('.pl-header__link', li);
      var timer;
      function open() { clearTimeout(timer); li.classList.add('is-open'); if (link) link.setAttribute('aria-expanded', 'true'); }
      function close() { li.classList.remove('is-open'); if (link) link.setAttribute('aria-expanded', 'false'); }
      li.addEventListener('mouseenter', function () { clearTimeout(timer); timer = setTimeout(open, 60); });
      li.addEventListener('mouseleave', function () { clearTimeout(timer); timer = setTimeout(close, 140); });
      li.addEventListener('focusin', open);
      li.addEventListener('focusout', function (e) { if (!li.contains(e.relatedTarget)) close(); });
      if (link) {
        link.addEventListener('click', function (e) {
          /* touch: first tap opens the panel, second tap follows the link */
          if (window.matchMedia('(hover: none)').matches && !li.classList.contains('is-open')) { e.preventDefault(); open(); }
        });
      }
      li._plClose = close;
    });
  }
  function closeMegas(refocus) {
    qa('[data-pl-mega-parent].is-open').forEach(function (li) {
      if (li._plClose) li._plClose();
      var link = q('.pl-header__link', li);
      if (refocus && link) link.focus();
    });
  }

  /* ---------- recent searches ---------- */
  function getRecent() {
    try {
      var a = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(a) ? a.filter(function (t) { return typeof t === 'string' && t.trim(); }).slice(0, RECENT_MAX) : [];
    } catch (e) { return []; }
  }
  function setRecent(a) { try { localStorage.setItem(RECENT_KEY, JSON.stringify(a.slice(0, RECENT_MAX))); } catch (e) {} }
  function saveRecent(term) {
    term = (term || '').trim();
    if (!term) return;
    var a = getRecent().filter(function (t) { return t.toLowerCase() !== term.toLowerCase(); });
    a.unshift(term);
    setRecent(a);
  }
  function removeRecent(term) {
    setRecent(getRecent().filter(function (t) { return t !== term; }));
    renderRecent();
  }
  function renderRecent() {
    var wrap = q('[data-pl-search-recent]');
    var list = q('[data-pl-search-recent-list]');
    if (!wrap || !list) return;
    var a = getRecent();
    if (!a.length) { wrap.setAttribute('hidden', ''); list.innerHTML = ''; return; }
    var results = q('[data-pl-search-results]');
    if (results && !results.hasAttribute('hidden')) { wrap.setAttribute('hidden', ''); return; }
    wrap.removeAttribute('hidden');
    list.innerHTML = a.map(function (t) {
      return '<li class="pl-search__recent">' +
        '<button type="button" class="pl-search__recent-term" data-pl-recent-term="' + esc(t) + '">' + icon('clock') + '<span>' + esc(t) + '</span></button>' +
        '<button type="button" class="pl-search__recent-x" data-pl-recent-remove="' + esc(t) + '" aria-label="Remove ' + esc(t) + '">' + icon('close') + '</button>' +
        '</li>';
    }).join('');
  }

  /* ---------- live suggest ---------- */
  var suggestTimer, controller, currency = 'AED';
  function searchUrl() {
    var f = q('[data-pl-search-form]');
    return (f && f.getAttribute('action')) || '/search';
  }
  function money(p) {
    var s = String(p == null ? '' : p);
    if (!s) return '';
    s = s.replace(/\.00$/, '');
    return currency + ' ' + s;
  }
  function imgSize(url, w) {
    if (!url) return '';
    if (url.indexOf('width=') > -1) return url;
    return url + (url.indexOf('?') > -1 ? '&' : '?') + 'width=' + w;
  }
  function showIdle() {
    var results = q('[data-pl-search-results]');
    var popular = q('[data-pl-search-popular]');
    if (results) { results.setAttribute('hidden', ''); results.innerHTML = ''; }
    if (popular) popular.removeAttribute('hidden');
    renderRecent();
  }
  function renderResults(json, term) {
    var results = q('[data-pl-search-results]');
    var popular = q('[data-pl-search-popular]');
    var recent = q('[data-pl-search-recent]');
    if (!results) return;
    var res = (json && json.resources && json.resources.results) || {};
    var products = res.products || [];
    var cols = res.collections || [];
    var html = '';
    if (!products.length && !cols.length) {
      html = '<p class="pl-search__empty">No results for “' + esc(term) + '”. Try “salted caramel” or browse all flavours.</p>';
    } else {
      html += '<p class="pl-label">Results</p><ul class="pl-search__list">';
      products.forEach(function (p) {
        var img = p.image || (p.featured_image && p.featured_image.url) || '';
        html += '<li><a class="pl-search__row" href="' + esc(p.url) + '">' +
          (img ? '<img class="pl-search__thumb" src="' + esc(imgSize(img, 112)) + '" width="56" height="56" alt="" loading="lazy">' : '<span class="pl-search__thumb"></span>') +
          '<span class="pl-search__info"><span class="pl-search__title">' + esc(p.title) + '</span>' +
          (p.price ? '<span class="pl-search__price">' + esc(money(p.price)) + '</span>' : '') + '</span>' +
          icon('chev') + '</a></li>';
      });
      cols.forEach(function (c) {
        var img = (c.featured_image && c.featured_image.url) || '';
        html += '<li><a class="pl-search__row" href="' + esc(c.url) + '">' +
          (img ? '<img class="pl-search__thumb" src="' + esc(imgSize(img, 112)) + '" width="56" height="56" alt="" loading="lazy">' : '<span class="pl-search__thumb"></span>') +
          '<span class="pl-search__info"><span class="pl-search__title">' + esc(c.title) + '</span><span class="pl-search__price">Collection</span></span>' +
          icon('chev') + '</a></li>';
      });
      html += '</ul>';
    }
    html += '<a class="pl-search__all" href="' + esc(searchUrl()) + '?q=' + encodeURIComponent(term) + '" data-pl-search-all>See all results ' + icon('arrow') + '</a>';
    results.innerHTML = html;
    results.removeAttribute('hidden');
    if (popular) popular.setAttribute('hidden', '');
    if (recent) recent.setAttribute('hidden', '');
  }
  function runSuggest(term) {
    if (controller) controller.abort();
    controller = window.AbortController ? new AbortController() : null;
    var url = searchUrl() + '/suggest.json?q=' + encodeURIComponent(term) +
      '&resources[type]=product,collection&resources[limit]=6&resources[options][fields]=title,product_type,variants.title';
    var opts = { credentials: 'same-origin' };
    if (controller) opts.signal = controller.signal;
    fetch(url, opts).then(function (r) { return r.json(); }).then(function (json) {
      var input = q('[data-pl-search-input]');
      if (!input || input.value.trim() !== term) return;
      renderResults(json, term);
    }).catch(function () {});
  }
  function toggleClear() {
    var input = q('[data-pl-search-input]');
    var clear = q('[data-pl-search-clear]');
    if (!input || !clear) return;
    if (input.value.trim()) clear.removeAttribute('hidden'); else clear.setAttribute('hidden', '');
  }
  function initSearch() {
    var input = q('[data-pl-search-input]');
    var form = q('[data-pl-search-form]');
    if (!input || !form) return;
    currency = form.getAttribute('data-currency') || currency;
    input.addEventListener('input', function () {
      var v = input.value.trim();
      toggleClear();
      clearTimeout(suggestTimer);
      if (v.length < 2) { showIdle(); return; }
      suggestTimer = setTimeout(function () { runSuggest(v); }, 200);
    });
    form.addEventListener('submit', function (e) {
      var v = input.value.trim();
      if (!v) { e.preventDefault(); input.focus(); return; }
      saveRecent(v);
    });
    /* header pill: focusing it opens the full sheet with whatever was typed */
    qa('[data-pl-search-trigger]').forEach(function (pill) {
      pill.addEventListener('focus', function () {
        var v = pill.value;
        pill.blur();
        window.plOpenSearch(v);
      });
    });
  }

  /* ---------- tab bar active state ---------- */
  function initTabbar() {
    var path = window.location.pathname;
    qa('[data-pl-tab-path]').forEach(function (tab) {
      var p = tab.getAttribute('data-pl-tab-path');
      var on = p === '/' ? path === '/' : path.indexOf(p) === 0;
      tab.classList.toggle('is-on', on);
      if (on) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
    });
  }

  /* ---------- events ---------- */
  d.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-pl-open-search],[data-pl-open-menu],[data-pl-close],[data-pl-overlay],[data-pl-tab],[data-pl-search-clear],[data-pl-search-clear-recent],[data-pl-recent-term],[data-pl-recent-remove],[data-pl-search-all],[data-pl-search-results] a') : null;
    if (!t) return;
    if (t.hasAttribute('data-pl-open-search')) { e.preventDefault(); window.plOpenSearch(); return; }
    if (t.hasAttribute('data-pl-open-menu')) { e.preventDefault(); window.plOpenMenu(); return; }
    if (t.hasAttribute('data-pl-close') || t.hasAttribute('data-pl-overlay')) { e.preventDefault(); closeSheets(); return; }
    if (t.hasAttribute('data-pl-tab')) {
      var which = t.getAttribute('data-pl-tab');
      if (which === 'menu') { e.preventDefault(); window.plOpenMenu(); }
      else if (which === 'search') { e.preventDefault(); if (active === 'search') closeSheets(); else window.plOpenSearch(); }
      else if (which === 'bag') { e.preventDefault(); openBag(); }
      return;
    }
    if (t.hasAttribute('data-pl-search-clear')) {
      var input = q('[data-pl-search-input]');
      if (input) { input.value = ''; input.focus(); }
      toggleClear();
      showIdle();
      return;
    }
    if (t.hasAttribute('data-pl-search-clear-recent')) { setRecent([]); renderRecent(); return; }
    if (t.hasAttribute('data-pl-recent-remove')) { removeRecent(t.getAttribute('data-pl-recent-remove')); return; }
    if (t.hasAttribute('data-pl-recent-term')) {
      var term = t.getAttribute('data-pl-recent-term');
      saveRecent(term);
      window.location.href = searchUrl() + '?q=' + encodeURIComponent(term);
      return;
    }
    /* a result row or "See all results": remember the query, then follow the link */
    var cur = q('[data-pl-search-input]');
    if (cur) saveRecent(cur.value);
  });

  d.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (active) { e.preventDefault(); closeSheets(); return; }
    closeMegas(true);
  });

  /* close the sheets when the cart drawer opens on top of them */
  d.addEventListener('click', function (e) {
    var trig = e.target.closest && e.target.closest('[data-drawer-trigger="cart"]');
    if (trig && active) closeSheets();
  }, true);

  ['plaay:cart:updated', 'cart:updated', 'cart:refresh'].forEach(function (ev) { d.addEventListener(ev, scheduleSync); });

  function init() {
    initMega();
    initSearch();
    initTabbar();
    syncCount(null);
    qa('[data-cart-count]').forEach(function (el) {
      new MutationObserver(function () { syncCount(null); }).observe(el, { childList: true, characterData: true, subtree: true });
    });
    var drawer = q('cart-drawer');
    if (drawer) new MutationObserver(scheduleSync).observe(drawer, { childList: true, subtree: true });
    /* theme editor: re-bind when the header section is re-rendered */
    d.addEventListener('shopify:section:load', function (e) {
      if (e.target && e.target.querySelector && e.target.querySelector('[data-pl-header]')) { active = null; initMega(); initSearch(); }
    });
  }
  /* Theme-preview bar (staging review): lift the tab bar above it. */
  function previewBarOffset() {
    var bar = d.getElementById('preview-bar-iframe');
    var h = bar ? Math.round(bar.getBoundingClientRect().height) : 0;
    d.documentElement.style.setProperty('--pl-preview-bar', h + 'px');
  }
  [0, 800, 2500].forEach(function (t) { setTimeout(previewBarOffset, t); });
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
})();
