/* Plaay 2026 cart: count sync, subscription switch, drawer helpers.

   Loaded (defer) from snippets/drawer-cart.liquid and sections/main-cart.liquid. Dependency-free.

   - Mirrors the live item count into every [data-cart-count] after each render (MutationObserver on
     <cart-drawer> and [data-cart-page-root]) and dispatches `plaay:cart:updated` on document.
   - Per-line subscription switch: posts /cart/change.js with a selling plan (or null), re-renders the
     drawer through window.plaayRenderCartDrawerSections when present, and falls back to remove + re-add
     when Shopify refuses to drop the plan.
   - Stops the switch's `change` event before bundle.cart-items.js sees it (its onChange would post the
     checkbox value as a quantity).
   - Delegated [data-close] so buttons inside re-rendered drawer content still close the drawer.
   - Adds body.pl-drawer-open while <cart-drawer> carries `active`, for sticky bars that must hide. */

(function () {
  if (window.plCart) return;

  var CHANGE_URL = (window.routes && window.routes.cart_change_url) || '/cart/change.js';
  var ADD_URL = (window.routes && window.routes.cart_add_url) || '/cart/add.js';
  var CART_URL = (window.routes && window.routes.cart_url) || '/cart';
  var SECTIONS = ['cart-drawer-content'];

  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function fmtAED(fils) {
    var n = fils / 100;
    return 'AED ' + (n === Math.floor(n) ? n : n.toFixed(2));
  }

  function parsePriceFils(text) {
    if (!text) return null;
    var m = String(text).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
    if (!m) return null;
    return Math.round(parseFloat(m[0]) * 100);
  }

  function parseJSON(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch (e) { return null; }
  }

  /* ---------- count sync ---------- */
  function readCount() {
    var src = q('[data-cart-drawer-content]') || q('[data-pl-cart-count-source]');
    if (!src) return null;
    var n = parseInt(src.getAttribute('data-cart-item-count'), 10);
    return isNaN(n) ? null : n;
  }

  function syncCount(n) {
    if (n == null) n = readCount();
    if (n == null) return;
    var text = String(n);
    qa('[data-cart-count]').forEach(function (el) {
      if (el.textContent.trim() !== text) el.textContent = text;
      if (el.getAttribute('data-count') !== text) el.setAttribute('data-count', text);
      el.hidden = n === 0;
    });
  }

  /* ---------- upsell row decoration (legacy card markup from sections/cart-recommendations.liquid) ---------- */
  function decorateUpsell() {
    qa('[data-pl-upsell]').forEach(function (wrap) {
      var remaining = parseInt(wrap.getAttribute('data-remaining'), 10) || 0;
      var label = wrap.getAttribute('data-next-label') || '';
      var allDone = wrap.getAttribute('data-all-done') === 'true';

      qa('[data-cart-recommendation-item]', wrap).forEach(function (card) {
        var btn = q('.plaay-upsell-card__btn', card);
        if (btn && btn.textContent.trim() !== 'Add') btn.textContent = 'Add';

        if (allDone || !label || q('.pl-upsell__line', card)) return;
        var priceRow = q('.plaay-upsell-card__price-row', card);
        var priceEl = q('.plaay-upsell-card__price', card);
        var fils = parsePriceFils(priceEl && priceEl.textContent);
        var line = document.createElement('span');
        line.className = 'pl-upsell__line';
        if (fils != null && fils >= remaining) {
          line.textContent = 'Takes you to ' + label;
        } else {
          line.textContent = fmtAED(remaining - (fils || 0)) + ' more after this for ' + label;
        }
        (priceRow || q('.plaay-upsell-card__body', card) || card).appendChild(line);
      });
    });
  }

  /* bundle.cart-items.js sets `loading` before its fetch and only clears it after rendering every
     section it asked for; the `cart-count` section does not exist, so on the cart page the render
     throws after the lines are swapped in and the class would stay on forever. */
  function clearStuckLoading() {
    qa('cart-items.loading').forEach(function (el) { el.classList.remove('loading'); });
  }

  /* ---------- render observers ---------- */
  var observers = [];
  var renderTimer = null;

  function afterRender() {
    syncCount();
    decorateUpsell();
    clearStuckLoading();
    observers.forEach(function (o) { o.takeRecords(); });
    document.dispatchEvent(new CustomEvent('plaay:cart:updated', { detail: { count: readCount() } }));
  }

  function onMutation() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(afterRender, 60);
  }

  function observe() {
    [q('cart-drawer'), q('[data-cart-page-root]')].forEach(function (target) {
      if (!target) return;
      var o = new MutationObserver(onMutation);
      o.observe(target, { childList: true, subtree: true });
      observers.push(o);
    });

    var drawer = q('cart-drawer');
    if (drawer) {
      var syncOpen = function () {
        var open = drawer.classList.contains('active');
        document.body.classList.toggle('pl-drawer-open', open);
        if (open) {
          var panel = q('[data-drawer]', drawer);
          if (panel && typeof panel.focus === 'function') panel.focus({ preventScroll: true });
        }
      };
      new MutationObserver(syncOpen).observe(drawer, { attributes: true, attributeFilter: ['class'] });
      syncOpen();
    }
  }

  document.addEventListener('plaay:cart:updated', function () { syncCount(); });

  /* ---------- drawer close (delegated, survives re-renders) ---------- */
  function closeDrawer() {
    var sd = q('site-drawers');
    if (sd && typeof sd.close === 'function') { sd.close(); return; }
    var cd = q('cart-drawer');
    if (cd) cd.classList.remove('active');
    document.body.classList.remove('overflow-hidden');
    var ov = q('site-drawers [data-overlay]');
    if (ov) ov.classList.remove('active');
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('cart-drawer [data-close]');
    if (!btn) return;
    e.preventDefault();
    closeDrawer();
  });

  /* ---------- cart requests ---------- */
  function post(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (json) {
        return { ok: r.ok, status: r.status, json: json };
      });
    });
  }

  function renderDrawerSections(sections) {
    var live = q('[data-cart-drawer-content]');
    if (!live || !sections || !sections['cart-drawer-content']) return;
    var parsed = new DOMParser().parseFromString(sections['cart-drawer-content'], 'text/html');
    var next = parsed.querySelector('[data-cart-drawer-content]');
    if (!next) return;
    var n = parseInt(next.getAttribute('data-cart-item-count'), 10) || 0;
    live.setAttribute('data-cart-item-count', String(n));
    live.innerHTML = next.innerHTML;
    var countEl = q('[data-cart-drawer-count]');
    var wrap = q('[data-cart-drawer-count-wrapper]');
    if (countEl) countEl.textContent = String(n);
    if (wrap) wrap.classList.toggle('hidden', n === 0);
    setTimeout(function () {
      var recs = q('cart-drawer cart-recommendations');
      if (recs && typeof recs.getRecommendations === 'function') recs.getRecommendations();
    }, 150);
  }

  function refreshPage() {
    if (!q('[data-cart-page-root]')) return Promise.resolve();
    if (typeof window.plaayRefreshCartPage === 'function') return window.plaayRefreshCartPage();
    return fetch(CART_URL + '?section_id=main-cart')
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var root = q('[data-cart-page-root]');
        var next = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-cart-page-root]');
        if (root && next) root.innerHTML = next.innerHTML;
      });
  }

  function refreshDrawer() {
    if (typeof window.plaayRefreshCartDrawer === 'function') return window.plaayRefreshCartDrawer();
    return fetch(CART_URL + '?sections=cart-drawer-content')
      .then(function (r) { return r.json(); })
      .then(function (sections) { renderDrawerSections(sections); });
  }

  function render(json) {
    var sections = json && json.sections;
    var drawerPromise = Promise.resolve();
    if (q('[data-cart-drawer-content]')) {
      if (sections && sections['cart-drawer-content']) {
        if (typeof window.plaayRenderCartDrawerSections === 'function') {
          window.plaayRenderCartDrawerSections(sections);
        } else {
          renderDrawerSections(sections);
        }
      } else {
        drawerPromise = refreshDrawer();
      }
    }
    return Promise.all([drawerPromise, refreshPage()]);
  }

  function refreshAll() {
    var tasks = [];
    if (q('[data-cart-drawer-content]')) tasks.push(refreshDrawer().catch(function () {}));
    tasks.push(refreshPage().catch(function () {}));
    return Promise.all(tasks);
  }

  /* ---------- subscription switch ---------- */
  function lineData(line) {
    var input = q('input[name="quantity"]', line);
    var qty = parseInt(line.getAttribute('data-quantity'), 10);
    if (!qty && input) qty = parseInt(input.value, 10);
    return {
      key: line.getAttribute('data-key'),
      variantId: line.getAttribute('data-variant-id'),
      qty: qty > 0 ? qty : 1,
      planId: line.getAttribute('data-plan-id'),
      properties: parseJSON(line.getAttribute('data-properties'))
    };
  }

  function setBusy(line, busy) {
    line.classList.toggle('is-busy', !!busy);
    var host = line.closest('cart-drawer-items, cart-items');
    if (host) host.classList.toggle('loading', !!busy);
  }

  function lineStillHasPlan(cart, key) {
    var items = (cart && cart.items) || [];
    for (var i = 0; i < items.length; i += 1) {
      if (items[i].key === key) return !!items[i].selling_plan_allocation;
    }
    return false;
  }

  function subscribe(line, input) {
    var d = lineData(line);
    if (!d.key || !d.planId) return;
    setBusy(line, true);
    post(CHANGE_URL, { id: d.key, quantity: d.qty, selling_plan: Number(d.planId), sections: SECTIONS })
      .then(function (res) {
        if (!res.ok) throw new Error((res.json && res.json.description) || 'Could not switch to a subscription');
        return render(res.json);
      })
      .catch(function () {
        input.checked = false;
        setBusy(line, false);
        refreshAll();
      });
  }

  function unsubscribe(line) {
    var d = lineData(line);
    if (!d.key) return;
    setBusy(line, true);
    post(CHANGE_URL, { id: d.key, quantity: d.qty, selling_plan: null, sections: SECTIONS })
      .then(function (res) {
        if (res.ok && !lineStillHasPlan(res.json, d.key)) return render(res.json);

        /* Shopify kept the plan (422 or unchanged line): drop the line and add it back one-time. */
        return post(CHANGE_URL, { id: d.key, quantity: 0 }).then(function (rm) {
          if (!rm.ok) throw new Error('Could not remove the line');
          var body = { id: Number(d.variantId), quantity: d.qty, sections: SECTIONS };
          if (d.properties && typeof d.properties === 'object' && Object.keys(d.properties).length) {
            body.properties = d.properties;
          }
          return post(ADD_URL, body);
        }).then(function (add) {
          if (!add.ok) throw new Error('Could not re-add the line');
          return render(add.json);
        });
      })
      .catch(function () {
        setBusy(line, false);
        refreshAll();
      });
  }

  /* Capture phase so the change never reaches cart-drawer-items / cart-items, whose onChange treats
     every change inside [data-cart-item] as a quantity update. */
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || !t.matches || !t.matches('[data-pl-sub-toggle]')) return;
    e.stopPropagation();
    e.stopImmediatePropagation();
    var line = t.closest('[data-cart-item]');
    if (!line) return;
    if (t.checked) subscribe(line, t);
  }, true);

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-pl-sub-off]');
    if (!btn) return;
    e.preventDefault();
    var line = btn.closest('[data-cart-item]');
    if (line) unsubscribe(line);
  });

  /* ---------- boot ---------- */
  function init() {
    observe();
    syncCount();
    decorateUpsell();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.plCart = {
    syncCount: syncCount,
    refresh: refreshAll,
    closeDrawer: closeDrawer,
    open: function () {
      var sd = q('site-drawers');
      if (sd && sd.activeDrawer !== undefined) { sd.activeDrawer = 'cart'; return; }
      var cd = q('cart-drawer');
      if (cd) cd.classList.add('active');
      document.body.classList.add('overflow-hidden');
      var ov = q('site-drawers [data-overlay]');
      if (ov) ov.classList.add('active');
    }
  };
})();
