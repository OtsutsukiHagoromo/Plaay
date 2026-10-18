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

  /* Always the .js endpoints: Shopify's add-to-cart tracking (web pixels) watches those. */
  var CHANGE_URL = ((window.routes && window.routes.cart_change_url) || '/cart/change').replace(/\.js$/, '') + '.js';
  var ADD_URL = ((window.routes && window.routes.cart_add_url) || '/cart/add').replace(/\.js$/, '') + '.js';
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

  /* ---------- reward moments ----------
     The drawer is swapped wholesale after every change, so the tier reached, the bar fill and the
     line keys are remembered here and compared after each render:
       - the fill slides from its old width to the new one;
       - a newly reached stop pops, throws a little confetti and shows a short "unlocked" pill;
       - a newly added Mystery Gift line slides in with a shine. */
  var lastTier = null, lastPct = null, lastKeys = null;
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COLORS = ['#FFB600', '#8A2BE2', '#FF3EB5', '#2F8A3B', '#081D48', '#00BCB4'];

  function confetti(dot) {
    if (calm || !dot) return;
    var host = dot.parentNode;
    for (var i = 0; i < 16; i += 1) {
      var s = document.createElement('i');
      s.className = 'pl-confetti';
      var a = (Math.PI * 2 * i) / 16 + Math.random() * .4;
      var r = 26 + Math.random() * 26;
      s.style.left = dot.style.left;
      s.style.setProperty('--dx', Math.round(Math.cos(a) * r) + 'px');
      s.style.setProperty('--dy', Math.round(Math.sin(a) * r - 10) + 'px');
      s.style.setProperty('--rot', Math.round(Math.random() * 360) + 'deg');
      s.style.background = COLORS[i % COLORS.length];
      host.appendChild(s);
    }
    setTimeout(function () { qa('.pl-confetti', host).forEach(function (n) { n.remove(); }); }, 1100);
  }

  function pill(card, text) {
    if (!card) return;
    var old = q('.pl-ladder__pop', card);
    if (old) old.remove();
    var el = document.createElement('p');
    el.className = 'pl-ladder__pop';
    el.setAttribute('role', 'status');
    el.textContent = text;
    card.appendChild(el);
    setTimeout(function () { el.remove(); }, 2800);
  }

  function rewardMoments() {
    var root = q('[data-cart-drawer-content]') || q('[data-cart-page-root]');
    if (!root) return;
    var bar = q('[data-plaay-tier-bar]', root);
    var fill = bar && q('.plaay-tier-bar__fill', bar);
    var dots = bar ? qa('.plaay-tier-bar__dot', bar) : [];
    var done = bar ? qa('.plaay-tier-bar__dot.is-done', bar).length : 0;
    var pct = fill ? parseFloat(fill.style.width) || 0 : 0;

    if (fill && lastPct !== null && pct !== lastPct && !calm) {
      fill.style.transition = 'none';
      fill.style.width = lastPct + '%';
      void fill.offsetWidth;
      fill.style.transition = '';
      fill.style.width = pct + '%';
    }

    if (bar && lastTier !== null && done > lastTier) {
      for (var i = lastTier; i < done; i += 1) if (dots[i]) dots[i].classList.add('is-new');
      var top = done - 1;
      var label = bar.getAttribute('data-stop-' + (top + 1) + '-label') || '';
      setTimeout(function () { confetti(dots[top]); }, 380);
      if (window.plHaptic) window.plHaptic('unlock');
      pill(bar.closest('.pl-ladder'), (top === 0 ? '🚚 ' : '🎉 ') + label + ' unlocked!');
    }

    var lines = qa('[data-cart-item]', root);
    var keys = lines.map(function (l) { return l.getAttribute('data-key'); });
    if (lastKeys) {
      lines.forEach(function (l) {
        if (l.classList.contains('pl-item--gift') && lastKeys.indexOf(l.getAttribute('data-key')) < 0) l.classList.add('is-new');
      });
    }
    if (bar) { lastTier = done; lastPct = pct; }
    lastKeys = keys;
  }

  function afterRender() {
    syncCount();
    decorateUpsell();
    clearStuckLoading();
    observers.forEach(function (o) { o.takeRecords(); });
    document.dispatchEvent(new CustomEvent('plaay:cart:updated', { detail: { count: readCount() } }));
  }

  /* ---------- seamless re-renders ----------
     Every renderer swaps the drawer's HTML wholesale. MutationObserver callbacks run before the
     browser paints, so here (synchronously) the scroll position is put back, every line glides
     from where it was to where it is now (FLIP), and the reward moments start in the same frame
     as the swap. Nothing is ever painted in an in-between state. */
  var savedScroll = 0, linePos = {};
  document.addEventListener('scroll', function (e) {
    var t = e.target;
    if (t && t.matches && t.matches('cart-drawer .pl-drawer__scroll')) savedScroll = t.scrollTop;
  }, true);

  function measureLines() {
    linePos = {};
    qa('cart-drawer [data-cart-item], [data-cart-page-root] [data-cart-item]').forEach(function (l) {
      linePos[l.getAttribute('data-key')] = l.offsetTop;
    });
  }

  function settleSync() {
    var sc = q('cart-drawer .pl-drawer__scroll');
    if (sc && Math.abs(sc.scrollTop - savedScroll) > 1) sc.scrollTop = savedScroll;
    if (!calm) {
      qa('cart-drawer [data-cart-item], [data-cart-page-root] [data-cart-item]').forEach(function (l) {
        var was = linePos[l.getAttribute('data-key')];
        if (was == null || l.classList.contains('is-new')) return;
        var dy = was - l.offsetTop;
        if (!dy) return;
        l.style.transition = 'none';
        l.style.transform = 'translateY(' + dy + 'px)';
        void l.offsetHeight;
        l.style.transition = 'transform .45s cubic-bezier(.2, .7, .2, 1)';
        l.style.transform = '';
        setTimeout(function () { l.style.transition = ''; }, 500);
      });
    }
    rewardMoments();
    measureLines();
    var gap = q('cart-drawer [data-pl-gap]');
    if (gap && gapOpen && !gap.open) gap.open = true;
  }

  function onMutation() {
    settleSync();
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
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Pl-Cart': '1' },
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

  function subscribe(line, input, planId) {
    var d = lineData(line);
    var plan = planId || d.planId;
    if (!d.key || !plan) return;
    setBusy(line, true);
    post(CHANGE_URL, { id: d.key, quantity: d.qty, selling_plan: Number(plan), sections: SECTIONS })
      .then(function (res) {
        if (!res.ok) throw new Error((res.json && res.json.description) || 'Could not switch to a subscription');
        return render(res.json);
      })
      .catch(function () {
        if (input) input.checked = false;
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

  /* Purchase option buttons: One-time drops the plan, Subscribe adds the default (4-week) plan.
     A tap on the option already chosen does nothing. */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-pl-sub-off], [data-pl-sub-on]');
    if (!btn) return;
    e.preventDefault();
    var line = btn.closest('[data-cart-item]');
    if (!line || line.classList.contains('is-busy')) return;
    var subbed = line.classList.contains('is-sub');
    if (btn.hasAttribute('data-pl-sub-off') && subbed) unsubscribe(line);
    if (btn.hasAttribute('data-pl-sub-on') && !subbed) subscribe(line, null);
  });

  /* Next-reward picks: one tap adds the product and re-renders the bag (the rewards bar then
     celebrates the new tier). The panel's open state survives the re-render. */
  var gapOpen = false;
  document.addEventListener('toggle', function (e) {
    if (e.target && e.target.matches && e.target.matches('[data-pl-gap]')) gapOpen = e.target.open;
  }, true);
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-pl-gap-add]');
    if (!btn || btn.classList.contains('is-busy')) return;
    e.preventDefault();
    gapOpen = false;
    add([{ id: Number(btn.getAttribute('data-pl-gap-add')), quantity: 1 }], { button: btn, open: false });
  });

  /* Frequency picker: move the line to the chosen plan. */
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || !t.matches || !t.matches('[data-pl-sub-freq]')) return;
    e.stopPropagation();
    e.stopImmediatePropagation();
    var line = t.closest('[data-cart-item]');
    if (line) subscribe(line, null, t.value);
  }, true);

  /* ---------- fast lane: add, quantity, remove ----------
     Every bag action is one request, tagged X-Pl-Cart so the fetch watchers in
     plaay-cart-gift-prompt.js and plaay-gift.js leave it alone, and asking for the re-rendered
     drawer / cart page in the same response (Section Rendering API), so nothing is fetched twice.

     - add(items, opts): the fly-to-bag animation runs while the request is in flight; the drawer
       opens as soon as both are done. Used by the product page, cards, tiles, the drawer picks.
     - Quantity steppers, typed quantities and remove buttons are taken over in the capture
       phase (the legacy cart-items module would grey the whole bag out on every tap). The line
       updates on the spot: new quantity, line price, bag count; a removed line folds away.
       Taps are batched per line (280 ms) and only the newest answer re-renders the bag, once
       every request has settled, so fast tapping never flickers.
     - Errors (sold out, stock limits) show a short toast and the bag reloads from the server. */
  function send(url, body) {
    return post(url, body).then(function (res) {
      if (!res.ok) {
        var err = new Error((res.json && (res.json.description || res.json.message)) || 'Something went wrong. Please try again.');
        err.status = res.status;
        throw err;
      }
      return res.json;
    });
  }

  function wanted() {
    var list = [];
    if (q('[data-cart-drawer-content]')) list.push('cart-drawer-content');
    if (q('[data-cart-page-root]')) list.push('main-cart');
    return list;
  }

  function settled() {
    qa('[data-cart-drawer-content].is-syncing, [data-cart-page-root].is-syncing').forEach(function (el) { el.classList.remove('is-syncing'); });
  }

  function paint(sections) {
    if (sections && sections['cart-drawer-content']) renderDrawerSections(sections);
    if (sections && sections['main-cart']) {
      var root = q('[data-cart-page-root]');
      var next = new DOMParser().parseFromString(sections['main-cart'], 'text/html').querySelector('[data-cart-page-root]');
      if (root && next) root.innerHTML = next.innerHTML;
    }
    settled();
    if (window.plaayGiftActive && window.plaaySyncMysteryGift) window.plaaySyncMysteryGift();
  }

  function toast(msg) {
    var t = q('.pl-cart-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'pl-cart-toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove('is-on'); }, 3200);
  }

  function bagIcon() {
    var list = qa('.header__icon--cart, [data-pl-tab="bag"]');
    for (var i = 0; i < list.length; i += 1) {
      var r = list[i].getBoundingClientRect();
      if (r.width && r.bottom > 0 && r.top < window.innerHeight) return list[i];
    }
    return null;
  }

  /* A small round copy of the product photo arcs into the bag icon. It starts on the photo when
     that is on screen, otherwise on `fallback` (the button that was pressed). */
  function fly(from, fallback) {
    var img = from && (from.tagName === 'IMG' ? from : from.querySelector && from.querySelector('img'));
    var bag = bagIcon();
    if (calm || !img || !bag || !img.animate) return Promise.resolve();
    var a = img.getBoundingClientRect(), b = bag.getBoundingClientRect();
    var onScreen = a.width && a.bottom > 0 && a.top < window.innerHeight;
    var start = onScreen ? a : fallback && fallback.getBoundingClientRect();
    if (!start || !start.width) return Promise.resolve();
    var size = onScreen ? Math.min(a.width, a.height, 110) : 56;
    var cx = start.left + start.width / 2, cy = start.top + start.height / 2;
    var ghost = document.createElement('img');
    ghost.src = img.currentSrc || img.src;
    ghost.alt = '';
    ghost.className = 'plo-fly';
    ghost.style.cssText = 'left:' + (cx - size / 2) + 'px;top:' + (cy - size / 2) + 'px;width:' + size + 'px;height:' + size + 'px';
    document.body.appendChild(ghost);
    var dx = b.left + b.width / 2 - cx, dy = b.top + b.height / 2 - cy;
    var anim = ghost.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: 'translate(' + dx * .45 + 'px,' + (dy * .45 - 50) + 'px) scale(.6)', opacity: 1, offset: .5 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.14)', opacity: .5 }
    ], { duration: 460, easing: 'cubic-bezier(.5,0,.6,1)' });
    return anim.finished.then(function () {
      ghost.remove();
      if (bag.animate) bag.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 280, easing: 'ease-out' });
    }, function () { ghost.remove(); });
  }

  function openOrGo() {
    if (q('cart-drawer')) { window.plCart.open(); return; }
    if (!q('[data-cart-page-root]')) window.location.href = CART_URL;
  }

  function add(items, opts) {
    opts = opts || {};
    var btn = opts.button;
    if (btn) {
      if (btn.classList.contains('is-busy')) return Promise.resolve(null);
      btn.classList.add('is-busy');
      btn.setAttribute('aria-busy', 'true');
    }
    var flight = opts.from ? fly(opts.from, opts.fallback || btn) : Promise.resolve();
    var request = send(ADD_URL, { items: items, sections: wanted() });
    return Promise.all([request, flight]).then(function (r) {
      paint(r[0].sections);
      if (btn) {
        btn.classList.remove('is-busy');
        btn.removeAttribute('aria-busy');
        btn.classList.add('is-added');
        setTimeout(function () { btn.classList.remove('is-added'); }, 1400);
      }
      if (window.plHaptic) window.plHaptic('success');
      document.dispatchEvent(new CustomEvent('pl:cart:added'));
      if (opts.open !== false) openOrGo();
      return r[0];
    }, function (err) {
      if (btn) { btn.classList.remove('is-busy'); btn.removeAttribute('aria-busy'); }
      toast(err.status === 422 ? err.message : 'Could not add to your bag. Please try again.');
      return null;
    });
  }

  /* ---------- quantity + remove ---------- */
  var timers = {}, pending = {}, seq = 0, inflight = 0, newest = { seq: 0, json: null };

  function lineOf(el) {
    var line = el.closest && el.closest('[data-cart-item]');
    return line && line.closest('cart-drawer, [data-cart-page-root]') ? line : null;
  }

  function unitOf(line) {
    var u = Number(line.getAttribute('data-unit'));
    if (!u) {
      var now = parsePriceFils((q('.pl-item__now', line) || {}).textContent);
      u = now ? Math.round(now / (Number(line.getAttribute('data-quantity')) || 1)) : 0;
      line.setAttribute('data-unit', String(u));
    }
    return u;
  }

  function fold(line) {
    if (calm) { line.style.display = 'none'; return; }
    line.style.height = line.offsetHeight + 'px';
    line.style.overflow = 'hidden';
    void line.offsetHeight;
    line.style.transition = 'height .26s ease, opacity .18s ease, padding .26s ease, margin .26s ease';
    line.style.height = '0px';
    line.style.opacity = '0';
    line.style.paddingTop = line.style.paddingBottom = '0px';
    line.style.marginTop = line.style.marginBottom = '0px';
    line.style.pointerEvents = 'none';
  }

  function setQty(line, n) {
    n = Math.max(0, Math.min(99, n | 0));
    var key = line.getAttribute('data-key');
    if (!idents[key]) idents[key] = line.getAttribute('data-variant-id') + '|' + (line.classList.contains('is-sub') ? 's' : 'o');
    var unit = unitOf(line);
    line.setAttribute('data-quantity', String(n));
    var input = q('input[name="quantity"]', line);
    if (input) input.value = n;
    var now = q('.pl-item__now', line);
    if (now && unit && n) now.textContent = fmtAED(unit * n);
    var was = q('.pl-item__was', line);
    if (was) was.style.visibility = 'hidden';
    if (n === 0) fold(line);
    var root = line.closest('[data-cart-drawer-content], [data-cart-page-root]');
    if (root) {
      root.classList.add('is-syncing');
      var total = 0;
      qa('[data-cart-item]', root).forEach(function (l) { total += Number(l.getAttribute('data-quantity')) || 0; });
      syncCount(total);
      var dc = q('[data-cart-drawer-count]');
      if (dc && root.matches('[data-cart-drawer-content]')) dc.textContent = String(total);
    }
    pending[key] = n;
    clearTimeout(timers[key]);
    timers[key] = setTimeout(function () { flush(key); }, n === 0 ? 0 : 280);
  }

  /* Shopify re-keys lines when the bag's discounts change (crossing a reward tier does), so
     changes run one after another and each finds its line again in the latest bag by variant
     and one-time / subscription before it is sent; a stale key gets one retry. */
  var chain = Promise.resolve(), lastCart = null, idents = {};

  function identOf(item) { return item.variant_id + '|' + (item.selling_plan_allocation ? 's' : 'o'); }

  function freshKey(key) {
    if (!lastCart || !lastCart.items) return key;
    var items = lastCart.items;
    for (var i = 0; i < items.length; i += 1) if (items[i].key === key) return key;
    for (var j = 0; j < items.length; j += 1) if (identOf(items[j]) === idents[key]) return items[j].key;
    return key;
  }

  function change(key, n) {
    var body = function () { return { id: freshKey(key), quantity: n, sections: wanted() }; };
    return send(CHANGE_URL, body()).catch(function (err) {
      if (err.status !== 400) throw err;
      return fetch(CART_URL + '.js', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (cart) { lastCart = cart; return send(CHANGE_URL, body()); });
    });
  }

  function flush(key) {
    delete timers[key];
    var n = pending[key];
    delete pending[key];
    var mine = ++seq;
    inflight += 1;
    chain = chain.then(function () { return change(key, n); })
      .then(function (json) {
        lastCart = json;
        if (mine > newest.seq) newest = { seq: mine, json: json };
      }, function (err) {
        toast(err.status === 422 ? err.message : 'Could not update your bag. Please try again.');
        newest = { seq: mine, json: null };
      })
      .then(function () {
        inflight -= 1;
        if (inflight || Object.keys(timers).length) return;
        if (newest.json) paint(newest.json.sections);
        else refreshAll().then(settled);
        newest = { seq: seq, json: null };
      });
  }

  /* Capture phase: these never reach quantity-adjuster / cart-remove-button / cart-items. */
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-cart-item] [data-minus], [data-cart-item] [data-plus], [data-cart-item] .pl-item__remove');
    if (!t) return;
    var line = lineOf(t);
    if (!line) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var cur = Number(line.getAttribute('data-quantity')) || 0;
    if (t.matches('.pl-item__remove')) setQty(line, 0);
    else setQty(line, cur + (t.hasAttribute('data-plus') ? 1 : -1));
  }, true);

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || !t.matches || !t.matches('[data-cart-item] input[name="quantity"]')) return;
    var line = lineOf(t);
    if (!line) return;
    e.stopImmediatePropagation();
    setQty(line, parseInt(t.value, 10) || 0);
  }, true);

  /* Legacy quick-add buttons (tiles, the drawer's "You might also like"). Inside the open drawer
     there is nothing to fly to and nothing to open. */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('quick-add [data-add]');
    if (!b) return;
    var host = b.closest('quick-add');
    var id = Number(host.getAttribute('data-id'));
    if (!id) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var qty = Number((q('input[name="quantity"]', host) || {}).value) || 1;
    var inDrawer = !!b.closest('cart-drawer, [data-cart-page-root]');
    add([{ id: id, quantity: qty }], {
      button: b,
      from: inDrawer ? null : b.closest('.pl-tile, .plaay-upsell-card, article'),
      open: !inDrawer
    });
  }, true);

  /* ---------- boot ---------- */
  function init() {
    rewardMoments();
    measureLines();
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
    add: add,
    fly: fly,
    toast: toast,
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
