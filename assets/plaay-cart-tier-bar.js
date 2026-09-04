/* Free-shipping / rewards-ladder progress bar behaviour.

   Extracted from snippets/cart-tier-bar.liquid, where it was an inline <script> in the page body -
   7099 bytes of JavaScript re-sent on every navigation instead of being cached once.
   Loaded with defer, so it now runs after the document is parsed rather than at the
   point it appeared; every entry point here is either delegated from `document` or
   guarded on readyState, so later is safe.

   One generic ladder renderer drives every variant. The bar reads an ordered list of
   stops from its own data attributes (data-stop-count + data-stop-N / data-stop-N-label),
   so the permanent 4-stop rewards ladder, the 2-stop pre-launch bar and the Eid sale
   ladder are all the same code path - snippets/cart-tier-bar.liquid decides which stops
   to emit and renders identical markup server-side.

   Every stop threshold is in fils and compared against the cart's ORIGINAL (pre-discount)
   total, so a percentage tier discount can never knock a shopper back down a tier. */

(function() {
  if (window.plaayTierBarDefined) return;
  window.plaayTierBarDefined = true;

  function fmtAED(fils) {
    var n = fils / 100;
    return 'AED ' + (n === Math.floor(n) ? n : n.toFixed(2));
  }

  var CHECK = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
  var TRUCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline;vertical-align:-2px"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 4v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';

  function pill(done, label) {
    return '<span class="plaay-tier-bar__pill' + (done ? ' plaay-tier-bar__pill--done' : '') + '">' +
      (done ? CHECK : '') + label + '</span>';
  }

  function track(pct) {
    return '<div class="plaay-tier-bar__track" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100">' +
      '<div class="plaay-tier-bar__fill" style="width:' + pct + '%"></div></div>';
  }

  // Ordered stops straight off the element, so markup stays the single source of truth.
  // Read with getAttribute, NOT dataset: `data-stop-1` lands in the dataset under the key
  // 'stop-1', not 'stop1', because the camel-casing rule only fires on a hyphen followed by
  // a letter. Reading dataset.stop1 returns undefined, every stop is dropped, and the bar
  // silently stops updating while still looking correct server-rendered.
  function readStops(bar) {
    var n = parseInt(bar.getAttribute('data-stop-count'), 10) || 0;
    var stops = [];
    for (var i = 1; i <= n; i += 1) {
      var fils = parseInt(bar.getAttribute('data-stop-' + i), 10);
      if (isNaN(fils)) continue;
      stops.push({ fils: fils, label: bar.getAttribute('data-stop-' + i + '-label') || '' });
    }
    return stops;
  }

  // Index of the highest stop already unlocked, -1 when none are.
  function reachedIndex(total, stops) {
    var reached = -1;
    for (var i = 0; i < stops.length; i += 1) {
      if (total >= stops[i].fils) reached = i;
    }
    return reached;
  }

  function renderLadder(total, stops) {
    if (!stops.length) return '';
    var last = stops[stops.length - 1].fils;
    var reached = reachedIndex(total, stops);
    var msg, msgDone = false;

    if (reached === stops.length - 1) {
      msgDone = true;
      msg = CHECK + ' All rewards unlocked! You\'re all set.';
    } else if (reached < 0) {
      msg = 'Add <strong>' + fmtAED(stops[0].fils - total) + '</strong> more for free delivery ' + TRUCK;
    } else {
      var next = stops[reached + 1];
      msg = (reached === 0 ? '🚚 ' : '🎁 ') + stops[reached].label + ' unlocked! Add <strong>' +
        fmtAED(next.fils - total) + '</strong> more for <strong>' + next.label + '</strong>';
    }

    // Fill is proportional to the whole ladder so it only ever moves forwards.
    // Multiply before dividing. `total / last * 100` routes through a binary fraction:
    // 14500/25000*100 is 57.99999999999999, which floors to 57 while Liquid's integer
    // maths gives 58, so the bar twitched back a percent on the first client update.
    var pct = Math.min(100, Math.floor(total * 100 / last));

    var pills = '';
    for (var i = 0; i < stops.length; i += 1) {
      var label = i === 0 ? stops[i].label : 'AED ' + (stops[i].fils / 100) + ' → ' + stops[i].label;
      pills += pill(total >= stops[i].fils, label);
    }

    return '<p class="plaay-tier-bar__msg' + (msgDone ? ' plaay-tier-bar__msg--done' : '') + '">' + msg + '</p>' +
      track(pct) +
      '<div class="plaay-tier-bar__pills">' + pills + '</div>';
  }

  // Scroll position and unlocked-tier index are tracked per bar, because the drawer bar
  // and the /cart page bar can both be in the document at once.
  function scrollPillsToActive(bar, animate) {
    var pillsEl = bar && bar.querySelector('.plaay-tier-bar__pills');
    if (!pillsEl) return;
    var donePills = pillsEl.querySelectorAll('.plaay-tier-bar__pill--done');
    var target = donePills.length ? donePills[donePills.length - 1] : null;
    var targetLeft = target ? Math.max(0, target.offsetLeft - 6) : 0;
    var prev = Number(bar.getAttribute('data-pill-scroll')) || 0;
    if (animate && targetLeft !== prev) {
      // New tier unlocked — smooth scroll to celebrate
      pillsEl.scrollTo({ left: targetLeft, behavior: 'smooth' });
    } else {
      // Same tier or initial load — restore position instantly (no jitter)
      pillsEl.scrollLeft = targetLeft;
    }
    bar.setAttribute('data-pill-scroll', targetLeft);
  }

  function bars() {
    return document.querySelectorAll('[data-plaay-tier-bar]');
  }

  window.plaayTierBar = {
    update: function(totalFils) {
      var total = Number(totalFils) || 0;
      var all = bars();
      for (var i = 0; i < all.length; i += 1) {
        var bar = all[i];
        var inner = bar.querySelector('[data-plaay-tier-bar-inner]');
        if (!inner) continue;
        var stops = readStops(bar);
        if (!stops.length) continue;

        var tierIndex = reachedIndex(total, stops);
        var prevAttr = bar.getAttribute('data-tier-index');
        var prevIndex = prevAttr === null ? -1 : Number(prevAttr);
        var tierChanged = prevAttr !== null && tierIndex > prevIndex;
        bar.setAttribute('data-tier-index', tierIndex);

        inner.innerHTML = renderLadder(total, stops);
        scrollPillsToActive(bar, tierChanged);
      }
    }
  };

  // Initial render — restore position instantly (no animation needed)
  (function initPillScroll() {
    function run() {
      var all = bars();
      for (var i = 0; i < all.length; i += 1) {
        var bar = all[i];
        // Seed from the tier the SERVER actually rendered, counted off the ticked pills.
        // reachedIndex(0, ...) was always -1, so a page loaded with an already-qualifying
        // cart treated its first update as a tier gain and fired the unlock celebration
        // scroll when nothing had been crossed.
        var doneCount = bar.querySelectorAll('.plaay-tier-bar__pill--done').length;
        bar.setAttribute('data-tier-index', doneCount - 1);
        scrollPillsToActive(bar, false);
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }
  })();
})();
