/*
  Plaay 2026 product page + recommendations.
  Dependency-free. One IIFE, guarded by window.plProduct. Initialises every [data-pl-product]
  root (variant selection, buy mode, frequency, stepper, add-to-bag, sticky bar, gallery, tabs,
  wishlist, rewards line) and every [data-pl-recommendations] root (Shopify recommendations API).
  Adds through the theme's cart module: document.querySelector('cart-drawer-items').add(id, qty, plan).
*/
(function () {
  'use strict';
  if (window.plProduct) return;
  window.plProduct = { version: 1 };

  var DESKTOP = window.matchMedia('(min-width: 1024px)');
  var DOT = '·';

  function fmt(fils) {
    var n = Math.round(Number(fils) || 0) / 100;
    return 'AED ' + (n === Math.floor(n) ? n : n.toFixed(2));
  }
  function qs(root, sel) { return root ? root.querySelector(sel) : null; }
  function qsa(root, sel) { return root ? Array.prototype.slice.call(root.querySelectorAll(sel)) : []; }
  function parseJSON(el) {
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }

  /* ---------- wishlist (localStorage "plaay_wishlist": array of handles) ---------- */
  var WL_KEY = 'plaay_wishlist';
  function wlGet() {
    try {
      var v = JSON.parse(localStorage.getItem(WL_KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function wlSet(list) {
    try { localStorage.setItem(WL_KEY, JSON.stringify(list)); } catch (e) { /* storage blocked */ }
  }
  function initWish(btn) {
    if (btn.plInit) return;
    btn.plInit = true;
    var handle = btn.getAttribute('data-handle');
    var refresh = function () {
      var on = wlGet().indexOf(handle) > -1;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('is-on', on);
    };
    refresh();
    window.addEventListener('plaay:wishlist:change', refresh);
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var list = wlGet();
      var i = list.indexOf(handle);
      if (i > -1) list.splice(i, 1); else list.push(handle);
      wlSet(list);
      window.dispatchEvent(new CustomEvent('plaay:wishlist:change'));
    });
  }

  /* ---------- cart drawer ---------- */
  function openDrawer() {
    var sd = document.querySelector('site-drawers');
    if (sd && 'activeDrawer' in sd) {
      if (sd.activeDrawer !== 'cart') sd.activeDrawer = 'cart';
      return;
    }
    var trigger = document.querySelector('[data-drawer-trigger="cart"]');
    if (trigger) trigger.click();
  }
  function drawerOpen() {
    var cd = document.querySelector('cart-drawer');
    return document.body.classList.contains('overflow-hidden') || !!(cd && cd.classList.contains('active'));
  }
  function syncCount() {
    var content = document.querySelector('[data-cart-drawer-content]');
    if (!content) return;
    var n = content.getAttribute('data-cart-item-count');
    if (n === null) return;
    qsa(document, '[data-cart-count]').forEach(function (el) {
      el.textContent = n;
      if (Number(n) > 0) el.removeAttribute('hidden'); else el.setAttribute('hidden', '');
    });
  }

  /*
    Adds a variant and resolves once the drawer has re-rendered. The theme's add() does not
    return a promise, so completion is detected from the drawer content mutating (or the
    plaay:cart:updated event from pl-cart.js), with a 4 s safety timeout. Falls back to a
    direct /cart/add.js call when the module is missing.
  */
  function addToCart(variantId, qty, planId) {
    return new Promise(function (resolve, reject) {
      var el = document.querySelector('cart-drawer-items') || document.querySelector('cart-items');
      var content = document.querySelector('[data-cart-drawer-content]');
      var settled = false;
      var mo = null;
      var timer = null;
      var onEvt = function () { done(true); };
      var cleanup = function () {
        if (mo) mo.disconnect();
        if (timer) clearTimeout(timer);
        document.removeEventListener('plaay:cart:updated', onEvt);
      };
      var done = function (ok) {
        if (settled) return;
        settled = true;
        cleanup();
        if (ok) resolve(); else reject(new Error('add failed'));
      };

      if (el && typeof el.add === 'function') {
        document.addEventListener('plaay:cart:updated', onEvt);
        if (content && window.MutationObserver) {
          mo = new MutationObserver(function () { done(true); });
          mo.observe(content, { childList: true, subtree: true });
        }
        timer = setTimeout(function () { done(true); }, 4000);
        try {
          el.add(variantId, qty, planId);
          return;
        } catch (e) {
          cleanup();
        }
      }

      var body = { id: Number(variantId), quantity: Number(qty) || 1, sections: ['cart-drawer-content'] };
      if (planId) body.selling_plan = planId;
      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then(function (json) {
          if (json && json.sections) {
            if (window.plaayRenderCartDrawerSections) {
              window.plaayRenderCartDrawerSections(json.sections);
            } else if (content && json.sections['cart-drawer-content']) {
              var doc = new DOMParser().parseFromString(json.sections['cart-drawer-content'], 'text/html');
              var fresh = doc.querySelector('[data-cart-drawer-content]');
              if (fresh) content.innerHTML = fresh.innerHTML;
            }
          }
          syncCount();
          document.dispatchEvent(new CustomEvent('plaay:cart:updated'));
          done(true);
        })
        .catch(function () { done(false); });
    });
  }

  /* ---------- rewards line (re-rendered from /cart.js after a cart change) ---------- */
  function initRewards(root) {
    var box = qs(root, '[data-pl-rewards]');
    if (!box) return null;
    var amounts = (box.getAttribute('data-amounts') || '').split(',').map(Number).filter(function (n) { return n > 0; });
    var labels = (box.getAttribute('data-labels') || '').split('|');
    var msg = qs(box, '[data-pl-rw-msg]');
    var fill = qs(box, '[data-pl-rw-fill]');
    var stops = qsa(box, '[data-pl-rw-stop]');
    var aform = function (l) { return (l || '').replace('+ Mystery Gift', '+ a Mystery Gift'); };

    var render = function (total) {
      if (!amounts.length) return;
      var reached = -1;
      amounts.forEach(function (a, i) { if (total >= a * 100) reached = i; });
      var last = amounts.length - 1;
      var text;
      if (reached === last) {
        text = labels[last] + ' unlocked ' + DOT + ' applied automatically at checkout';
      } else {
        var next = reached + 1;
        var remaining = amounts[next] * 100 - total;
        var nextLabel = next === 0 ? 'free delivery' : aform(labels[next]);
        text = reached <= 0
          ? 'Add ' + fmt(remaining) + ' more to unlock ' + nextLabel
          : labels[reached] + ' unlocked ' + DOT + ' ' + fmt(remaining) + ' more for ' + nextLabel;
      }
      if (msg) msg.textContent = text;
      if (fill) fill.style.width = Math.min(100, Math.round(total / amounts[last])) + '%';
      stops.forEach(function (s, i) { s.classList.toggle('is-done', i <= reached); });
      box.setAttribute('data-total', String(total));
    };
    var refresh = function () {
      fetch('/cart.js', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (cart) {
          if (cart && typeof cart.original_total_price === 'number') render(cart.original_total_price);
        })
        .catch(function () { /* keep the server-rendered line */ });
    };
    return { refresh: refresh };
  }

  /* ---------- gallery ---------- */
  function initGallery(root) {
    var gal = qs(root, '[data-pl-gallery]');
    var noop = { goToMedia: function () {} };
    if (!gal) return noop;
    var track = qs(gal, '[data-pl-track]');
    var slides = qsa(gal, '.pl-gal__slide');
    var dots = qsa(gal, '[data-pl-dot]');
    var thumbs = qsa(gal, '[data-pl-thumb]');
    var current = 0;

    var pauseOthers = function (except) {
      slides.forEach(function (s, j) {
        if (j === except) return;
        var vid = s.querySelector('video');
        if (vid && !vid.paused) vid.pause();
      });
    };
    var setCurrent = function (i) {
      current = i;
      dots.forEach(function (d, j) {
        d.classList.toggle('is-on', j === i);
        if (j === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
      thumbs.forEach(function (t, j) { t.classList.toggle('is-on', j === i); });
      pauseOthers(i);
    };
    var goTo = function (i) {
      if (!track || !slides[i]) return;
      var left = i * track.clientWidth;
      if (typeof track.scrollTo === 'function') track.scrollTo({ left: left, behavior: 'smooth' });
      else track.scrollLeft = left;
      setCurrent(i);
    };

    if (track) {
      var raf = null;
      track.addEventListener('scroll', function () {
        if (raf) return;
        raf = window.requestAnimationFrame(function () {
          raf = null;
          var w = track.clientWidth || 1;
          var i = Math.round(track.scrollLeft / w);
          if (i !== current && slides[i]) setCurrent(i);
        });
      }, { passive: true });
    }
    dots.forEach(function (d) { d.addEventListener('click', function () { goTo(Number(d.getAttribute('data-pl-dot'))); }); });
    thumbs.forEach(function (t) { t.addEventListener('click', function () { goTo(Number(t.getAttribute('data-pl-thumb'))); }); });

    return {
      goToMedia: function (mediaId) {
        for (var i = 0; i < slides.length; i++) {
          if (slides[i].getAttribute('data-media-id') === String(mediaId)) { goTo(i); return; }
        }
      }
    };
  }

  /* ---------- tabs (mobile: one panel at a time; desktop: stacked, tab bar = anchors) ---------- */
  function initTabs(root) {
    var wrap = qs(root, '[data-pl-tabs]');
    if (!wrap) return;
    var tabs = qsa(wrap, '[data-pl-tab]');
    var panels = qsa(wrap, '[data-pl-panel]');

    var mark = function (id) {
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-pl-tab') === id;
        t.classList.toggle('is-on', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    };
    var select = function (id, scroll) {
      mark(id);
      panels.forEach(function (p) { p.classList.toggle('is-on', p.getAttribute('data-pl-panel') === id); });
      if (scroll) {
        var target = DESKTOP.matches ? document.getElementById(id) : wrap;
        if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    tabs.forEach(function (t) {
      t.addEventListener('click', function (e) {
        e.preventDefault();
        var id = t.getAttribute('data-pl-tab');
        select(id, true);
        try { history.replaceState(history.state, '', '#' + id); } catch (err) { /* ignore */ }
      });
    });
    qsa(root, '[data-pl-goto]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        select(a.getAttribute('data-pl-goto'), true);
      });
    });

    var hash = (window.location.hash || '').replace('#', '');
    if (hash && panels.some(function (p) { return p.getAttribute('data-pl-panel') === hash; })) select(hash, false);

    if ('IntersectionObserver' in window) {
      var spy = new IntersectionObserver(function (entries) {
        if (!DESKTOP.matches) return;
        entries.forEach(function (en) {
          if (en.isIntersecting) mark(en.target.getAttribute('data-pl-panel'));
        });
      }, { rootMargin: '-25% 0px -65% 0px', threshold: 0 });
      panels.forEach(function (p) { spy.observe(p); });
    }
  }

  /* ---------- product root ---------- */
  function initProduct(root) {
    if (root.plInit) return;
    root.plInit = true;

    var variants = parseJSON(qs(root, '[data-pl-variants]')) || [];
    var plans = parseJSON(qs(root, '[data-pl-plans]')) || [];
    var unit = root.getAttribute('data-unit') || '';
    var subPct = Number(root.getAttribute('data-sub-pct')) || 0;
    var hasSub = plans.length > 0 && subPct > 0;
    var byId = {};
    variants.forEach(function (v) { byId[String(v.id)] = v; });

    var state = {
      variant: byId[root.getAttribute('data-variant')] || variants[0] || null,
      mode: hasSub ? 'sub' : 'one',
      planId: null,
      pct: subPct,
      qty: 1
    };

    var els = {
      buy: qs(root, '[data-pl-buy]'),
      buybox: qs(root, '[data-pl-buybox]'),
      modes: qsa(root, '[data-pl-mode]'),
      freq: qs(root, '[data-pl-freq]'),
      subPrice: qs(root, '[data-pl-sub-price]'),
      subWas: qs(root, '[data-pl-sub-was]'),
      subSave: qs(root, '[data-pl-sub-save]'),
      onePrice: qs(root, '[data-pl-one-price]'),
      compare: qs(root, '[data-pl-compare]'),
      stock: qs(root, '[data-pl-stock]'),
      qty: qs(root, '[data-pl-qty]'),
      stepper: qs(root, '[data-pl-stepper]'),
      add: qs(root, '[data-pl-add]'),
      cta: qs(root, '[data-pl-cta]'),
      sticky: qs(root, '[data-pl-sticky]'),
      stickyAdd: qs(root, '[data-pl-sticky-add]'),
      stickyCta: qs(root, '[data-pl-sticky-cta]'),
      packs: qsa(root, '[data-pl-pack]'),
      piece: qs(root, '[data-pl-piece]')
    };

    var gallery = initGallery(root);
    var rewards = initRewards(root);
    initTabs(root);
    qsa(root, '[data-pl-wish]').forEach(initWish);

    var readPlan = function () {
      if (!els.freq) {
        var fallback = plans.filter(function (p) { return /4/.test(p.name || ''); })[0] || plans[0];
        state.planId = fallback ? fallback.id : null;
        state.pct = fallback && fallback.percentage > 0 ? fallback.percentage : subPct;
        return;
      }
      var opt = els.freq.options[els.freq.selectedIndex];
      state.planId = opt ? Number(opt.value) : null;
      var p = opt ? Number(opt.getAttribute('data-pct')) : 0;
      state.pct = p > 0 ? p : subPct;
    };
    readPlan();

    var subPrice = function (v) { return Math.round(v.price * (100 - state.pct) / 100); };
    var isSub = function () { return hasSub && state.mode === 'sub'; };
    var ctaPrice = function (v) { return isSub() ? subPrice(v) : v.price; };
    var setCta = function (text) {
      if (els.cta) els.cta.textContent = text;
      if (els.stickyCta) els.stickyCta.textContent = text;
    };
    var setBtnState = function (s) {
      if (els.add) els.add.setAttribute('data-state', s);
      if (els.stickyAdd) els.stickyAdd.setAttribute('data-state', s);
    };

    var render = function () {
      var v = state.variant;
      if (!v) return;
      var sp = subPrice(v);
      if (els.subPrice) els.subPrice.textContent = fmt(sp);
      if (els.subWas) els.subWas.textContent = fmt(v.price);
      if (els.subSave) els.subSave.textContent = 'save ' + fmt(v.price - sp);
      if (els.onePrice) els.onePrice.textContent = fmt(v.price);
      if (els.compare) {
        if (v.compare_at_price && v.compare_at_price > v.price) {
          els.compare.textContent = fmt(v.compare_at_price);
          els.compare.hidden = false;
        } else {
          els.compare.hidden = true;
        }
      }
      if (els.stock) els.stock.hidden = !!v.available;
      if (els.buy) els.buy.classList.toggle('is-sub', isSub());
      setCta(v.available ? 'Add to bag ' + DOT + ' ' + fmt(ctaPrice(v)) : 'Sold out');
      if (els.add) els.add.disabled = !v.available;
      if (els.stickyAdd) els.stickyAdd.disabled = !v.available;
      els.packs.forEach(function (p) {
        var on = p.getAttribute('data-pl-pack') === String(v.id);
        p.classList.toggle('is-on', on);
        if (p.tagName === 'BUTTON') p.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (els.piece) {
        if (v.pieces > 0 && unit) {
          els.piece.textContent = fmt(v.price / v.pieces) + ' a ' + unit;
          els.piece.hidden = false;
        } else {
          els.piece.hidden = true;
        }
      }
    };

    var selectVariant = function (id) {
      var v = byId[String(id)];
      if (!v) return;
      state.variant = v;
      render();
      try {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', String(v.id));
        history.replaceState(history.state, '', url.toString());
      } catch (e) { /* ignore */ }
      if (v.media_id) gallery.goToMedia(v.media_id);
    };

    els.packs.forEach(function (p) {
      if (p.tagName !== 'BUTTON') return;
      p.addEventListener('click', function () { selectVariant(p.getAttribute('data-pl-pack')); });
    });
    els.modes.forEach(function (r) {
      r.addEventListener('change', function () {
        if (r.checked) { state.mode = r.value === 'sub' ? 'sub' : 'one'; render(); }
      });
    });
    if (els.freq) {
      els.freq.addEventListener('change', function () { readPlan(); render(); });
    }

    var setQty = function (n) {
      n = Math.floor(Number(n));
      if (!n || n < 1) n = 1;
      if (n > 10) n = 10;
      state.qty = n;
      if (els.qty) els.qty.value = String(n);
    };
    if (els.stepper) {
      var minus = qs(els.stepper, '[data-minus]');
      var plus = qs(els.stepper, '[data-plus]');
      if (minus) minus.addEventListener('click', function () { setQty(state.qty - 1); });
      if (plus) plus.addEventListener('click', function () { setQty(state.qty + 1); });
      if (els.qty) els.qty.addEventListener('change', function () { setQty(els.qty.value); });
    }

    var adding = false;
    var add = function () {
      var v = state.variant;
      if (!v || !v.available || adding) return;
      adding = true;
      var planId = isSub() && state.planId ? state.planId : undefined;
      setBtnState('adding');
      setCta('Adding…');
      var p = addToCart(v.id, state.qty, planId);
      openDrawer();
      p.then(function () {
        setBtnState('added');
        setCta('Added');
        if (rewards) rewards.refresh();
        setTimeout(function () { adding = false; setBtnState('idle'); render(); }, 1200);
      }).catch(function () {
        adding = false;
        setBtnState('idle');
        render();
      });
    };
    if (els.add) els.add.addEventListener('click', add);
    if (els.stickyAdd) els.stickyAdd.addEventListener('click', add);

    /* sticky bar: on once the buy box has scrolled above the viewport, off while the drawer is open */
    if (els.sticky && els.buybox && 'IntersectionObserver' in window) {
      var pastBuy = false;
      var applySticky = function () {
        var on = pastBuy && !DESKTOP.matches && !drawerOpen();
        els.sticky.classList.toggle('is-on', on);
        els.sticky.setAttribute('aria-hidden', on ? 'false' : 'true');
        if ('inert' in els.sticky) els.sticky.inert = !on;
      };
      new IntersectionObserver(function (entries) {
        var e = entries[0];
        pastBuy = !e.isIntersecting && e.boundingClientRect.top < 0;
        applySticky();
      }, { threshold: 0 }).observe(els.buybox);
      if (window.MutationObserver) {
        new MutationObserver(applySticky).observe(document.body, { attributes: true, attributeFilter: ['class'] });
        var cd = document.querySelector('cart-drawer');
        if (cd) new MutationObserver(applySticky).observe(cd, { attributes: true, attributeFilter: ['class'] });
      }
      if (DESKTOP.addEventListener) DESKTOP.addEventListener('change', applySticky);
    }

    if (rewards) document.addEventListener('plaay:cart:updated', function () { rewards.refresh(); });

    render();
  }

  /* ---------- recommendations (Shopify product recommendations API) ---------- */
  function initRecs(el) {
    if (el.plInit) return;
    el.plInit = true;
    var url = el.getAttribute('data-url');
    if (!url) return;
    var run = function () {
      fetch(url, { headers: { Accept: 'text/html' } })
        .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var fresh = doc.querySelector('[data-pl-recommendations]');
          if (fresh && fresh.innerHTML.trim()) el.innerHTML = fresh.innerHTML;
        })
        .catch(function () { /* leave empty */ });
    };
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); run(); }
      }, { rootMargin: '400px 0px' });
      io.observe(el);
    } else {
      run();
    }
  }

  /*
    <quick-add> elements injected after page load (recommendation tiles) only upgrade when the
    theme's quick-add module was loaded for an element present at scan time. When it was not,
    handle the click here with the same add + open-drawer behaviour.
  */
  document.addEventListener('click', function (e) {
    var target = e.target && e.target.nodeType === 1 ? e.target : (e.target ? e.target.parentElement : null);
    var btn = target && target.closest ? target.closest('quick-add [data-add]') : null;
    if (!btn) return;
    if (window.customElements && customElements.get('quick-add')) return;
    var qa = btn.closest('quick-add');
    if (!qa) return;
    e.preventDefault();
    var input = qa.querySelector('input[name="quantity"]');
    btn.disabled = true;
    addToCart(qa.getAttribute('data-id'), input ? input.value : 1, undefined)
      .then(function () { openDrawer(); btn.disabled = false; })
      .catch(function () { btn.disabled = false; });
  });

  function init() {
    qsa(document, '[data-pl-product]').forEach(initProduct);
    qsa(document, '[data-pl-recommendations]').forEach(initRecs);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  document.addEventListener('shopify:section:load', init);
})();
