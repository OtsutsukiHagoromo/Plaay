/* Free-shipping / tier progress bar behaviour.

   Extracted from snippets/cart-tier-bar.liquid, where it was an inline <script> in the page body -
   7099 bytes of JavaScript re-sent on every navigation instead of being cached once.
   Loaded with defer, so it now runs after the document is parsed rather than at the
   point it appeared; every entry point here is either delegated from `document` or
   guarded on readyState, so later is safe. */

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

  function renderNormal(total, cfg) {
    var ship = cfg.ship;
    var gift = cfg.gift;
    var giftLabel = cfg.giftLabel;
    var msg, pct, msgDone = false;

    if (total >= gift) {
      msgDone = true;
      msg = CHECK + ' All rewards unlocked! You\'re all set.';
      pct = 100;
    } else if (total >= ship) {
      msg = '🚚 Free shipping unlocked! Add <strong>' + fmtAED(gift - total) + '</strong> more for <strong>' + giftLabel + '</strong>';
      pct = Math.min(100, Math.floor((total - ship) / (gift - ship) * 100));
    } else {
      msg = 'Add <strong>' + fmtAED(ship - total) + '</strong> more for free shipping ' + TRUCK;
      pct = Math.min(100, Math.floor(total / ship * 100));
    }

    var pills = [
      pill(total >= ship, 'Free shipping'),
      pill(total >= gift, 'AED ' + (gift / 100) + ' → ' + giftLabel)
    ].join('');

    return '<p class="plaay-tier-bar__msg' + (msgDone ? ' plaay-tier-bar__msg--done' : '') + '">' + msg + '</p>' +
      track(pct) +
      '<div class="plaay-tier-bar__pills">' + pills + '</div>';
  }

  function renderEid(total, cfg) {
    var ship = cfg.ship;
    var t1 = cfg.eidT1, t1Label = cfg.eidT1Label;
    var t2 = cfg.eidT2, t2Label = cfg.eidT2Label;
    var t3 = cfg.eidT3, t3Label = cfg.eidT3Label;
    var msg, pct, msgDone = false;

    if (total >= t3) {
      msgDone = true;
      msg = CHECK + ' All rewards unlocked! You\'re all set.';
      pct = 100;
    } else if (total >= t2) {
      msg = '🎁 ' + t2Label + ' unlocked! Add <strong>' + fmtAED(t3 - total) + '</strong> more for <strong>' + t3Label + '</strong>';
      pct = Math.min(100, Math.floor(total / t3 * 100));
    } else if (total >= t1) {
      msg = '🎁 ' + t1Label + ' unlocked! Add <strong>' + fmtAED(t2 - total) + '</strong> more for <strong>' + t2Label + '</strong>';
      pct = Math.min(100, Math.floor(total / t3 * 100));
    } else if (total >= ship) {
      msg = '🚚 Free shipping unlocked! Add <strong>' + fmtAED(t1 - total) + '</strong> more for <strong>' + t1Label + '</strong>';
      pct = Math.min(100, Math.floor(total / t3 * 100));
    } else {
      msg = 'Add <strong>' + fmtAED(ship - total) + '</strong> more for free shipping ' + TRUCK;
      pct = Math.min(100, Math.floor(total / t3 * 100));
    }

    var pills = [
      pill(total >= ship, 'Free shipping'),
      pill(total >= t1,   'AED ' + (t1 / 100) + ' → ' + t1Label),
      pill(total >= t2,   'AED ' + (t2 / 100) + ' → ' + t2Label),
      pill(total >= t3,   'AED ' + (t3 / 100) + ' → ' + t3Label)
    ].join('');

    return '<p class="plaay-tier-bar__msg' + (msgDone ? ' plaay-tier-bar__msg--done' : '') + '">' + msg + '</p>' +
      track(pct) +
      '<div class="plaay-tier-bar__pills">' + pills + '</div>';
  }

  // Tracks the last scroll position so we can restore it instantly after innerHTML resets it,
  // and only smooth-animate when the shopper actually unlocks a new tier.
  var lastPillScrollLeft = 0;
  var lastTierIndex = -1; // -1 = uninitialised

  function getTierIndex(total, d) {
    if (d.mode === 'eid') {
      var t3 = parseInt(d.eidT3, 10), t2 = parseInt(d.eidT2, 10),
          t1 = parseInt(d.eidT1, 10), ship = parseInt(d.ship, 10);
      if (total >= t3) return 4;
      if (total >= t2) return 3;
      if (total >= t1) return 2;
      if (total >= ship) return 1;
      return 0;
    } else {
      var gift = parseInt(d.gift, 10), ship = parseInt(d.ship, 10);
      if (total >= gift) return 2;
      if (total >= ship) return 1;
      return 0;
    }
  }

  function scrollPillsToActive(bar, animate) {
    var pillsEl = bar && bar.querySelector('.plaay-tier-bar__pills');
    if (!pillsEl) return;
    var donePills = pillsEl.querySelectorAll('.plaay-tier-bar__pill--done');
    var target = donePills.length ? donePills[donePills.length - 1] : null;
    var targetLeft = target ? Math.max(0, target.offsetLeft - 6) : 0;
    if (animate && targetLeft !== lastPillScrollLeft) {
      // New tier unlocked — smooth scroll to celebrate
      pillsEl.scrollTo({ left: targetLeft, behavior: 'smooth' });
    } else {
      // Same tier or initial load — restore position instantly (no jitter)
      pillsEl.scrollLeft = targetLeft;
    }
    lastPillScrollLeft = targetLeft;
  }

  window.plaayTierBar = {
    update: function(totalFils) {
      var bar   = document.getElementById('plaay-tier-bar');
      var inner = document.getElementById('plaay-tier-bar-inner');
      if (!bar || !inner) return;
      var d = bar.dataset;
      var total = Number(totalFils) || 0;
      var tierIndex = getTierIndex(total, d);
      var tierChanged = lastTierIndex !== -1 && tierIndex > lastTierIndex;
      lastTierIndex = tierIndex;

      if (d.mode === 'eid') {
        inner.innerHTML = renderEid(total, {
          ship:       parseInt(d.ship, 10),
          eidT1:      parseInt(d.eidT1, 10),
          eidT1Label: d.eidT1Label,
          eidT2:      parseInt(d.eidT2, 10),
          eidT2Label: d.eidT2Label,
          eidT3:      parseInt(d.eidT3, 10),
          eidT3Label: d.eidT3Label
        });
      } else {
        inner.innerHTML = renderNormal(total, {
          ship:      parseInt(d.ship, 10),
          gift:      parseInt(d.gift, 10),
          giftLabel: d.giftLabel
        });
      }
      scrollPillsToActive(bar, tierChanged);
    }
  };

  // Initial render — restore position instantly (no animation needed)
  (function initPillScroll() {
    function run() {
      var bar = document.getElementById('plaay-tier-bar');
      if (!bar) return;
      lastTierIndex = getTierIndex(0, bar.dataset); // seed with 0 so first real update detects change correctly
      scrollPillsToActive(bar, false);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }
  })();
})();
