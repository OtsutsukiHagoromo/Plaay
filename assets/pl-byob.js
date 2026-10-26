/* Plaay 2026 — Build your box.
   Pieces are priced one by one: every tile carries its type's variant and price (truffle or
   slab). Any mix, at least data-min pieces, no upper limit. The box goes to the bag as one
   line per type (that type's variant x pieces), both tagged with the same hidden _box id and
   a visible "Flavours" list. Subscribe applies the product's selling plan to both lines. */
(function () {
  'use strict';

  var root = document.querySelector('[data-pl-byob]');
  if (!root) return;

  function q(sel, el) { return (el || root).querySelector(sel); }
  function qa(sel, el) { return Array.prototype.slice.call((el || root).querySelectorAll(sel)); }

  var items = qa('[data-pl-item]');
  var grid = q('[data-pl-grid]');
  var addBtn = q('[data-pl-add]');
  var addLabel = q('[data-pl-add-label]');
  var progressEl = q('[data-pl-progress]');
  var totalEl = q('[data-pl-total]');
  var fillEl = q('[data-pl-fill]');

  var min = Number(root.getAttribute('data-min')) || 1;
  var hasSub = root.getAttribute('data-has-sub') === 'true';
  var planId = root.getAttribute('data-plan') || '';
  var picks = {};           // tile key -> pieces

  /* ---------- money ---------- */
  function aed(fils) {
    var v = Math.round(Number(fils) || 0) / 100;
    return 'AED ' + v.toFixed(2).replace(/\.00$/, '');
  }

  /* ---------- state ---------- */
  function keyOf(item) { return item.getAttribute('data-cat') + '|' + item.getAttribute('data-name'); }
  function count() {
    var n = 0;
    for (var k in picks) if (Object.prototype.hasOwnProperty.call(picks, k)) n += picks[k];
    return n;
  }
  function subscribing() {
    if (!hasSub) return false;
    var on = q('[data-pl-plan-opt][value="sub"]');
    return !!(on && on.checked);
  }
  function totals() {
    var full = 0, sub = 0;
    items.forEach(function (item) {
      var n = picks[keyOf(item)] || 0;
      if (!n) return;
      full += n * (Number(item.getAttribute('data-price')) || 0);
      sub += n * (Number(item.getAttribute('data-sub-price')) || 0);
    });
    return { full: full, sub: sub, now: subscribing() ? sub : full };
  }

  /* ---------- render ---------- */
  function render() {
    var have = count();
    var t = totals();

    items.forEach(function (item) {
      var n = picks[keyOf(item)] || 0;
      var nEl = q('[data-pl-n]', item);
      var badge = q('[data-pl-badge]', item);
      var dec = q('[data-pl-dec]', item);
      if (nEl) nEl.textContent = String(n);
      if (badge) { badge.textContent = String(n); badge.hidden = n === 0; }
      if (dec) dec.disabled = n === 0;
      item.classList.toggle('is-picked', n > 0);
    });

    var ready = have >= min;
    if (fillEl) fillEl.style.width = Math.min(100, Math.round((have / min) * 100)) + '%';
    if (progressEl) {
      progressEl.textContent = !have
        ? 'Pick ' + min + ' or more'
        : ready
          ? have + (have === 1 ? ' piece' : ' pieces')
          : (min - have) + ' more to go';
      progressEl.classList.toggle('is-full', ready);
    }
    if (totalEl) totalEl.textContent = have ? aed(t.now) : '';
    if (addBtn) addBtn.disabled = !ready;
    if (addLabel) addLabel.textContent = ready ? 'Add to bag · ' + aed(t.now) : 'Add to bag';

    if (hasSub) {
      var subNow = q('[data-pl-sub-price]');
      var subWas = q('[data-pl-sub-was]');
      var subSave = q('[data-pl-sub-save]');
      var oneNow = q('[data-pl-one-price]');
      if (subNow) subNow.textContent = have ? aed(t.sub) : '';
      if (subWas) subWas.textContent = have ? aed(t.full) : '';
      if (subSave) subSave.textContent = have ? 'save ' + aed(t.full - t.sub) : '';
      if (oneNow) oneNow.textContent = have ? aed(t.full) : '';
    }
  }

  /* ---------- flavours ---------- */
  if (grid) {
    grid.addEventListener('click', function (e) {
      var inc = e.target.closest('[data-pl-inc]');
      var dec = e.target.closest('[data-pl-dec]');
      if (!inc && !dec) return;
      var item = e.target.closest('[data-pl-item]');
      if (!item) return;
      var k = keyOf(item);
      var n = picks[k] || 0;
      if (inc) picks[k] = n + 1;
      else if (n <= 1) delete picks[k];
      else picks[k] = n - 1;
      if (window.plHaptic) window.plHaptic('tap');
      render();
    });
  }

  /* ---------- type tabs ---------- */
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
  // Names are held lower-cased so pack wording folds away whatever the casing in Shopify; they
  // travel to the order email and packing slip, so put the casing back before they leave.
  function title(name) {
    return name.replace(/(^|[\s-])([a-z])/g, function (m, lead, ch) { return lead + ch.toUpperCase(); });
  }

  function lines() {
    var box = 'B' + Date.now().toString(36).toUpperCase();
    var byVariant = {};
    items.forEach(function (item) {
      var n = picks[keyOf(item)] || 0;
      if (!n) return;
      var v = item.getAttribute('data-variant');
      var l = byVariant[v] || (byVariant[v] = { id: Number(v), quantity: 0, names: [], img: '', top: 0 });
      l.quantity += n;
      l.names.push(title(item.getAttribute('data-name')) + ' × ' + n);
      /* The bag shows the box with the photo of its most-picked flavour of each type. */
      var im = q('.pl-byob__pic img', item);
      if (im && n > l.top) { l.top = n; l.img = (im.currentSrc || im.src || '').replace(/^http:/, 'https:'); }
    });
    return Object.keys(byVariant).map(function (v) {
      var l = byVariant[v];
      var props = { Flavours: l.names.join(', '), _box: box };
      if (l.img) props._img = l.img;
      var line = { id: l.id, quantity: l.quantity, properties: props };
      if (subscribing() && planId) line.selling_plan = Number(planId);
      return line;
    });
  }

  function done() {
    picks = {};
    render();
  }

  function addToBag() {
    if (!addBtn || addBtn.disabled) return;
    var items = lines();
    if (!items.length) return;

    if (window.plCart && window.plCart.add) {
      window.plCart.add(items, { button: addBtn }).then(function (r) { if (r) done(); });
      return;
    }

    addBtn.disabled = true;
    if (addLabel) addLabel.textContent = 'Adding…';
    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ items: items })
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (j) { throw new Error((j && j.description) || String(r.status)); });
        location.href = '/cart';
      })
      .catch(function (err) {
        addBtn.disabled = false;
        if (addLabel) addLabel.textContent = 'Could not add — try again';
        if (window.console) console.warn('[pl-byob]', err && err.message);
      });
  }

  if (addBtn) addBtn.addEventListener('click', addToBag);

  render();
})();
