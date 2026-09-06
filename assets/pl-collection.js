/*
 * Plaay 2026 catalogue: filter sheet (mobile), auto-submit (sort + desktop rail), load more.
 * Dependency-free. Everything works without this file: the filter form has an Apply button,
 * the sort form has a noscript Go button, and Load more is a real link to the next page.
 */
(function () {
  if (window.plCollection) return;
  window.plCollection = true;

  var DESKTOP = '(min-width: 1024px)';
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled])';

  function isDesktop() {
    return window.matchMedia(DESKTOP).matches;
  }

  function init(root) {
    if (!root || root.dataset.plReady) return;
    root.dataset.plReady = '1';

    var sectionId = root.getAttribute('data-section-id') || '';
    var rail = root.querySelector('[data-pl-rail]');
    var overlay = root.querySelector('[data-pl-overlay]');
    var openBtn = root.querySelector('[data-pl-filter-open]');
    var filterForm = root.querySelector('[data-pl-filter-form]');
    var sortSelect = root.querySelector('[data-pl-sort]');
    var lastFocus = null;

    /* ---------- filter sheet (mobile only; on desktop the rail is static) ---------- */
    function openSheet() {
      if (!rail || isDesktop()) return;
      lastFocus = document.activeElement;
      rail.classList.add('is-open');
      rail.setAttribute('role', 'dialog');
      rail.setAttribute('aria-modal', 'true');
      if (overlay) overlay.classList.add('is-on');
      if (openBtn) openBtn.setAttribute('aria-expanded', 'true');
      document.body.classList.add('pl-coll-lock');
      var first = rail.querySelector(FOCUSABLE);
      if (first) first.focus({ preventScroll: true });
    }

    function closeSheet() {
      if (!rail || !rail.classList.contains('is-open')) return;
      rail.classList.remove('is-open');
      rail.removeAttribute('role');
      rail.removeAttribute('aria-modal');
      if (overlay) overlay.classList.remove('is-on');
      if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('pl-coll-lock');
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
      lastFocus = null;
    }

    if (openBtn) openBtn.addEventListener('click', openSheet);
    root.querySelectorAll('[data-pl-filter-close]').forEach(function (btn) {
      btn.addEventListener('click', closeSheet);
    });
    if (overlay) overlay.addEventListener('click', closeSheet);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSheet();
    });
    window.matchMedia(DESKTOP).addEventListener('change', function (mq) {
      if (mq.matches) closeSheet();
    });

    /* ---------- sort: submit its own form on change ---------- */
    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        if (sortSelect.form) sortSelect.form.submit();
      });
    }

    /* ---------- desktop rail: submit on change (mobile keeps the Apply button) ---------- */
    if (filterForm) {
      filterForm.addEventListener('change', function (e) {
        if (!isDesktop()) return;
        var t = e.target;
        if (!t || !t.matches('input[type="checkbox"], input[type="number"]')) return;
        filterForm.submit();
      });
    }

    /* ---------- load more ---------- */
    var grid = root.querySelector('[data-pl-grid]');
    var more = root.querySelector('[data-pl-more]');
    var count = root.querySelector('[data-pl-count]');
    var pages = root.querySelector('[data-pl-pages]');

    if (pages && more) pages.hidden = true;

    if (grid && more) {
      more.addEventListener('click', function (e) {
        var href = more.getAttribute('href');
        if (!href || more.getAttribute('aria-busy') === 'true') {
          e.preventDefault();
          return;
        }
        if (!window.fetch || !window.DOMParser) return; /* let the link navigate */
        e.preventDefault();

        var url = href + (href.indexOf('?') > -1 ? '&' : '?') + 'section_id=' + encodeURIComponent(sectionId);
        var label = more.textContent;
        more.setAttribute('aria-busy', 'true');
        more.textContent = 'Loading…';

        fetch(url, { credentials: 'same-origin' })
          .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
          })
          .then(function (html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var tiles = doc.querySelectorAll('[data-pl-grid] [data-pl-tile]');
            var markup = '';
            tiles.forEach(function (t) { markup += t.outerHTML; });
            var before = grid.children.length;
            grid.insertAdjacentHTML('beforeend', markup);

            var nextCount = doc.querySelector('[data-pl-count]');
            if (nextCount && count) count.textContent = nextCount.textContent;

            var nextPages = doc.querySelector('[data-pl-pages]');
            if (pages && nextPages) pages.innerHTML = nextPages.innerHTML;

            var nextMore = doc.querySelector('[data-pl-more]');
            if (nextMore && nextMore.getAttribute('href')) {
              more.setAttribute('href', nextMore.getAttribute('href'));
              more.textContent = label;
              more.removeAttribute('aria-busy');
            } else {
              more.hidden = true;
            }

            var firstNew = grid.children[before];
            if (firstNew) {
              firstNew.setAttribute('tabindex', '-1');
              firstNew.focus({ preventScroll: true });
            }
          })
          .catch(function () {
            more.textContent = label;
            more.removeAttribute('aria-busy');
            window.location.href = href;
          });
      });
    }
  }

  function boot() {
    document.querySelectorAll('[data-pl-collection]').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', function (e) {
    var r = e.target && e.target.querySelector ? e.target.querySelector('[data-pl-collection]') : null;
    if (r) init(r);
  });
})();
