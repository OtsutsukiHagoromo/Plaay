/* Plaay 2026 — Build your box.
   One box variant goes to the cart; the chosen flavours ride along as visible
   line-item properties. No discount is applied here: the price shown is the
   variant price (or the selling plan's, when Subscribe is chosen). */
(function () {
  'use strict';

  var root = document.querySelector('[data-pl-byob]');
  if (!root) return;

  function q(sel, el) { return (el || root).querySelector(sel); }
  function qa(sel, el) { return Array.prototype.slice.call((el || root).querySelectorAll(sel)); }

  var sizes = qa('[data-pl-size]');
  var items = qa('[data-pl-item]');
  var grid = q('[data-pl-grid]');
  var bar = q('[data-pl-bar]');
  var addBtn = q('[data-pl-add]');
  var addLabel = q('[data-pl-add-label]');
  var progressEl = q('[data-pl-progress]');
  var totalEl = q('[data-pl-total]');
  var fillEl = q('[data-pl-fill]');

  var hasSub = root.getAttribute('data-has-sub') === 'true';
  var planId = root.getAttribute('data-plan') || '';
  var picks = {};           // name -> qty
  var current = null;       // selected size button

  /* ---------- money ---------- */
  function aed(fils) {
    var v = (Number(fils) || 0) / 100;
    var s = v.toFixed(2).replace(/\.00$/, '');
    return 'AED ' + s;
  }

  /* ---------- state ---------- */
  function required() { return current ? Number(current.getAttribute('data-qty')) || 0 : 0; }
  function chosen() {
    var n = 0;
    for (var k in picks) { if (Object.prototype.hasOwnProperty.call(picks, k)) n += picks[k]; }
    return n;
  }
  function subscribing() {
    if (!hasSub) return false;
    var on = q('[data-pl-plan-opt][value="sub"]');
    return !!(on && on.checked);
  }
  function unitPrice() {
    if (!current) return 0;
    var key = subscribing() ? 'data-sub-price' : 'data-price';
    return Number(current.getAttribute(key)) || 0;
  }

  /* ---------- render ---------- */
  function renderBuyBox() {
    if (!hasSub || !current) return;
    var full = Number(current.getAttribute('data-price')) || 0;
    var sub = Number(current.getAttribute('data-sub-price')) || 0;
    var subNow = q('[data-pl-sub-price]');
    var subWas = q('[data-pl-sub-was]');
    var subSave = q('[data-pl-sub-save]');
    var oneNow = q('[data-pl-one-price]');
    if (subNow) subNow.textContent = aed(sub);
    if (subWas) subWas.textContent = aed(full);
    if (subSave) subSave.textContent = 'save ' + aed(full - sub);
    if (oneNow) oneNow.textContent = aed(full);
  }

  function render() {
    var need = required();
    var have = chosen();

    items.forEach(function (item) {
      var name = item.getAttribute('data-name');
      var n = picks[name] || 0;
      var nEl = q('[data-pl-n]', item);
      var badge = q('[data-pl-badge]', item);
      var dec = q('[data-pl-dec]', item);
      var inc = q('[data-pl-inc]', item);
      if (nEl) nEl.textContent = String(n);
      if (badge) { badge.textContent = String(n); badge.hidden = n === 0; }
      if (dec) dec.disabled = n === 0;
      if (inc) inc.disabled = have >= need;
      item.classList.toggle('is-picked', n > 0);
    });

    var pct = need ? Math.min(100, Math.round((have / need) * 100)) : 0;
    if (fillEl) fillEl.style.width = pct + '%';

    var full = have === need && need > 0;
    var over = have > need;
    if (progressEl) {
      progressEl.textContent = over
        ? 'Remove ' + (have - need) + ' to fit this box'
        : have + ' of ' + need + ' chosen';
      progressEl.classList.toggle('is-full', full);
    }
    if (totalEl) totalEl.textContent = need ? aed(unitPrice()) : '';
    if (addBtn) addBtn.disabled = !full;
    if (addLabel) addLabel.textContent = full ? 'Add to bag · ' + aed(unitPrice()) : 'Add to bag';

    renderBuyBox();
  }

  /* ---------- size ---------- */
  function selectSize(btn) {
    if (!btn || btn.disabled) return;
    current = btn;
    sizes.forEach(function (b) {
      var on = b === btn;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    render();
  }
  sizes.forEach(function (b) {
    b.addEventListener('click', function () { selectSize(b); });
  });

  /* ---------- flavours ---------- */
  if (grid) {
    grid.addEventListener('click', function (e) {
      var inc = e.target.closest('[data-pl-inc]');
      var dec = e.target.closest('[data-pl-dec]');
      if (!inc && !dec) return;
      var item = e.target.closest('[data-pl-item]');
      if (!item) return;
      var name = item.getAttribute('data-name');
      var n = picks[name] || 0;
      if (inc) {
        if (chosen() >= required()) return;
        picks[name] = n + 1;
      } else {
        if (n <= 1) delete picks[name]; else picks[name] = n - 1;
      }
      render();
    });
  }

  /* ---------- category tabs ---------- */
  qa('[data-pl-cat]').forEach(function (tab) {
    tab.addEventListener('click', function () {
      var cat = tab.getAttribute('data-pl-cat');
      qa('[data-pl-cat]').forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('is-on', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      items.forEach(function (item) {
        item.hidden = cat !== 'all' && item.getAttribute('data-cat') !== cat;
      });
    });
  });

  /* ---------- subscribe toggle ---------- */
  qa('[data-pl-plan-opt]').forEach(function (input) {
    input.addEventListener('change', function () {
      var buy = q('[data-pl-buy]');
      if (buy) buy.classList.toggle('is-sub', subscribing());
      render();
    });
  });

  /* ---------- cart ---------- */
  function openDrawer() {
    var sd = document.querySelector('site-drawers');
    if (sd && 'activeDrawer' in sd) {
      if (sd.activeDrawer !== 'cart') sd.activeDrawer = 'cart';
      return;
    }
    var trigger = document.querySelector('[data-drawer-trigger="cart"]');
    if (trigger) trigger.click();
  }

  function addToBag() {
    if (!current || addBtn.disabled) return;
    // Names are held lower-cased so pack wording folds away whatever the casing in
    // Shopify; the grid restores it in CSS, but these keys travel to the order email
    // and the packing slip, so put the casing back before they leave the page.
    var props = {};
    Object.keys(picks).forEach(function (name) {
      var label = name.replace(/(^|[\s-])([a-z])/g, function (m, lead, ch) {
        return lead + ch.toUpperCase();
      });
      props[label] = 'x' + picks[name];
    });

    var body = {
      id: Number(current.getAttribute('data-variant')),
      quantity: 1,
      properties: props,
      sections: ['cart-drawer-content']
    };
    if (subscribing() && planId) body.selling_plan = Number(planId);

    addBtn.disabled = true;
    if (addLabel) addLabel.textContent = 'Adding…';

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (j) { throw new Error((j && j.description) || String(r.status)); });
        return r.json();
      })
      .then(function (json) {
        var content = document.querySelector('[data-cart-drawer-content]');
        if (json && json.sections) {
          if (window.plaayRenderCartDrawerSections) {
            window.plaayRenderCartDrawerSections(json.sections);
          } else if (content && json.sections['cart-drawer-content']) {
            var doc = new DOMParser().parseFromString(json.sections['cart-drawer-content'], 'text/html');
            var fresh = doc.querySelector('[data-cart-drawer-content]');
            if (fresh) content.innerHTML = fresh.innerHTML;
          }
        }
        document.dispatchEvent(new CustomEvent('plaay:cart:updated'));
        openDrawer();
        picks = {};
        render();
      })
      .catch(function (err) {
        if (addLabel) addLabel.textContent = 'Could not add — try again';
        addBtn.disabled = false;
        if (window.console) console.warn('[pl-byob]', err && err.message);
      });
  }

  if (addBtn) addBtn.addEventListener('click', addToBag);

  /* ---------- init ---------- */
  selectSize(sizes.filter(function (b) { return !b.disabled; })[0] || sizes[0]);
  render();
})();
