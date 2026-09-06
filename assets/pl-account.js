/* Plaay 2026 — account area behaviour.
   1. Reorder ([data-plaay-reorder]) — moved verbatim in spirit from the old account_template inline script.
   2. Saved flavours count (localStorage plaay_wishlist, same key as snippets/plaay-wishlist-heart.liquid).
   3. Sign in: open the reset panel when the URL carries #recover.
   4. Addresses: scoped port of customer.static.js (edit / add toggles, delete confirm, country + province).
   Dependency-free. Guarded so a duplicate script tag is a no-op. */
(function () {
  'use strict';
  if (window.plAccount) return;
  window.plAccount = { version: 1 };

  /* ---------- shared cart helpers ---------- */
  function syncCartCount() {
    var content = document.querySelector('[data-cart-drawer-content]');
    if (!content) return;
    var n = content.getAttribute('data-cart-item-count');
    if (n === null) return;
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = n;
      if (Number(n) > 0) el.removeAttribute('hidden'); else el.setAttribute('hidden', '');
    });
  }

  function openCartDrawer() {
    var sd = document.querySelector('site-drawers');
    if (sd && sd.activeDrawer !== undefined) { sd.activeDrawer = 'cart'; return; }
    var cd = document.querySelector('cart-drawer');
    if (cd) { cd.classList.add('active'); document.body.classList.add('overflow-hidden'); }
  }

  /* ---------- 1. reorder ---------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-plaay-reorder]');
    if (!btn || btn.disabled) return;

    var items;
    try { items = JSON.parse(btn.getAttribute('data-plaay-reorder')); } catch (err) { return; }
    if (!items || !items.length) return;

    var label = btn.querySelector('[data-label]') || btn;
    var original = label.textContent;
    btn.disabled = true;
    label.textContent = 'Adding…';

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ items: items, sections: ['cart-drawer-content'] })
    })
      .then(function (r) {
        return r.json().then(function (json) {
          if (!r.ok) { var err = new Error(json && json.description || 'add failed'); err.status = r.status; throw err; }
          return json;
        });
      })
      .then(function (json) {
        if (json && json.sections && window.plaayRenderCartDrawerSections) return window.plaayRenderCartDrawerSections(json.sections);
        if (window.plaayRefreshCartDrawer) return window.plaayRefreshCartDrawer();
      })
      .then(function () {
        syncCartCount();
        btn.disabled = false;
        label.textContent = 'Added';
        setTimeout(function () { label.textContent = original; }, 1200);
        openCartDrawer();
        document.dispatchEvent(new CustomEvent('plaay:cart:updated'));
      })
      .catch(function (err) {
        btn.disabled = false;
        label.textContent = err && err.status === 422 ? 'Sold out' : 'Try again';
        setTimeout(function () { label.textContent = original; }, 2000);
      });
  });

  /* ---------- 2. saved flavours count ---------- */
  function wishlistCount() {
    var slots = document.querySelectorAll('[data-pl-wishlist-count]');
    if (!slots.length) return;
    var list = [];
    try { list = JSON.parse(localStorage.getItem('plaay_wishlist') || '[]'); } catch (e) { list = []; }
    var n = Array.isArray(list) ? list.length : 0;
    var text = n === 0 ? 'Nothing saved yet' : (n === 1 ? '1 flavour saved' : n + ' flavours saved');
    slots.forEach(function (el) { el.textContent = text; });
  }

  /* ---------- 3. sign in: #recover opens the reset panel ---------- */
  function recoverFromHash() {
    if (window.location.hash !== '#recover') return;
    var panel = document.querySelector('[data-forgotten-password]');
    if (panel) panel.classList.remove('hidden');
  }

  /* ---------- 4. addresses ---------- */
  function bindCountry(select) {
    var formId = select.getAttribute('data-form-id');
    var province = document.getElementById('AddressProvince_' + formId);
    var wrap = document.getElementById('AddressProvinceContainer_' + formId);
    var def = select.getAttribute('data-default') || 'United Arab Emirates';
    var provinceDef = province ? (province.getAttribute('data-default') || '') : '';

    Array.prototype.some.call(select.options, function (o, i) {
      if (o.value === def || o.text === def) { select.selectedIndex = i; return true; }
      return false;
    });

    function update() {
      if (!province || !wrap) return;
      var opt = select.options[select.selectedIndex];
      var list = [];
      try { list = JSON.parse((opt && opt.getAttribute('data-provinces')) || '[]'); } catch (e) { list = []; }
      province.innerHTML = '';
      if (!list.length) { wrap.hidden = true; return; }
      list.forEach(function (p) {
        var o = document.createElement('option');
        o.value = p[0]; o.textContent = p[1];
        if (p[0] === provinceDef || p[1] === provinceDef) o.selected = true;
        province.appendChild(o);
      });
      wrap.hidden = false;
    }
    select.addEventListener('change', update);
    update();
  }

  function setPanel(button, open) {
    button.setAttribute('aria-expanded', String(open));
    var id = button.getAttribute('aria-controls');
    var panel = id && document.getElementById(id);
    if (!panel) return;
    panel.hidden = !open;
    panel.classList.toggle('show', open);
    if (open) {
      var first = panel.querySelector('input:not([type="hidden"]):not([type="checkbox"]), select');
      if (first) first.focus();
    }
  }

  function addresses() {
    var root = document.querySelector('[data-customer-addresses]');
    if (!root) return;

    root.querySelectorAll('[data-address-country-select]').forEach(bindCountry);

    root.querySelectorAll('button[aria-expanded]').forEach(function (b) {
      b.addEventListener('click', function () {
        setPanel(b, b.getAttribute('aria-expanded') !== 'true');
      });
    });

    root.querySelectorAll('button[type="reset"]').forEach(function (b) {
      b.addEventListener('click', function () {
        var wrap = b.closest('[data-address]');
        var toggle = wrap && wrap.querySelector('button[aria-expanded]');
        if (toggle) { setPanel(toggle, false); toggle.focus(); }
      });
    });

    root.querySelectorAll('button[data-confirm-message]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        if (!window.confirm(b.getAttribute('data-confirm-message'))) { e.preventDefault(); return; }
        if (b.closest('form')) return; /* the delete form posts _method=delete itself */
        e.preventDefault();
        var form = document.createElement('form');
        form.method = 'post';
        form.action = b.getAttribute('data-target');
        var m = document.createElement('input');
        m.type = 'hidden'; m.name = '_method'; m.value = 'delete';
        form.appendChild(m);
        document.body.appendChild(form);
        form.submit();
      });
    });
  }

  function init() {
    wishlistCount();
    recoverFromHash();
    addresses();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
