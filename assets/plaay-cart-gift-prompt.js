/* Cart drawer: gift message prompt and discount-code field.

   Extracted from snippets/drawer-cart.liquid, where it was an inline <script> in the page body -
   8514 bytes of JavaScript re-sent on every navigation instead of being cached once.
   Loaded with defer, so it now runs after the document is parsed rather than at the
   point it appeared; every entry point here is either delegated from `document` or
   guarded on readyState, so later is safe. */

(function() {
    if (window.plaayCartGiftPromptReady) return;
    window.plaayCartGiftPromptReady = true;

    function getSectionInnerHTML(html, selector) {
      var parsed = new DOMParser().parseFromString(html, 'text/html');
      var node = parsed.querySelector(selector || '.shopify-section');
      return node ? node.innerHTML : html;
    }

    function updateDrawerCount(count) {
      var countValue = Number(count) || 0;
      var badgeWrapper = document.querySelector('[data-cart-drawer-count-wrapper]');
      var badgeValue = document.querySelector('[data-cart-drawer-count]');

      if (!badgeWrapper || !badgeValue) return;

      badgeValue.textContent = String(countValue);
      badgeWrapper.classList.toggle('hidden', countValue === 0);
    }

    function renderCartSections(sections) {
      var cartContent = document.querySelector('[data-cart-drawer-content]');

      if (cartContent && sections['cart-drawer-content']) {
        var parsed = new DOMParser().parseFromString(sections['cart-drawer-content'], 'text/html');
        var contentNode = parsed.querySelector('[data-cart-drawer-content]');

        if (contentNode) {
          cartContent.setAttribute('data-cart-item-count', contentNode.getAttribute('data-cart-item-count') || '0');
          cartContent.innerHTML = contentNode.innerHTML;
          updateDrawerCount(contentNode.getAttribute('data-cart-item-count'));
        }
      }

      if (sections['cart-count']) {
        var cartCountHtml = getSectionInnerHTML(sections['cart-count']);
        document.querySelectorAll('[data-cart-count]').forEach(function(element) {
          element.innerHTML = cartCountHtml;
        });
      }

      setTimeout(function() {
        var recommendations = document.querySelector('cart-drawer cart-recommendations');
        if (recommendations && recommendations.getRecommendations) {
          recommendations.getRecommendations();
        }
      }, 150);
    }

    function refreshCartDrawer() {
      var cartUrl = (window.routes && window.routes.cart_url ? window.routes.cart_url : '/cart') + '?sections=cart-drawer-content,cart-count';
      return fetch(cartUrl)
        .then(function(r) { return r.json(); })
        .then(renderCartSections);
    }

    function refreshCartPage() {
      var cartPageRoot = document.querySelector('[data-cart-page-root]');
      if (!cartPageRoot) return Promise.resolve();

      return fetch('/cart?section_id=main-cart')
        .then(function(r) { return r.text(); })
        .then(function(html) {
          var parsed = new DOMParser().parseFromString(html, 'text/html');
          var nextRoot = parsed.querySelector('[data-cart-page-root]');
          if (nextRoot) {
            cartPageRoot.innerHTML = nextRoot.innerHTML;
          }
        });
    }

    function refreshVisibleCart() {
      var tasks = [];
      if (window.plaayRefreshCartDrawer) {
        tasks.push(window.plaayRefreshCartDrawer().catch(function() {}));
      }
      tasks.push(refreshCartPage().catch(function() {}));
      return Promise.all(tasks);
    }

    window.plaayRenderCartDrawerSections = renderCartSections;
    window.plaayRefreshCartDrawer = refreshCartDrawer;
    window.plaayRefreshCartPage = refreshCartPage;

    /*
      Tier bar real-time update via fetch intercept.
      Wraps window.fetch once, detects cart mutations,
      then refreshes the tier bar against /cart.js.
    */
    (function() {
      if (window.plaayFetchPatched) return;
      window.plaayFetchPatched = true;

      var CART_MUTATION = /\/cart\/(add|change|update|clear)(\.js)?(\?|$)/;
      var _origFetch = window.fetch;

      window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input
                  : (input && input.url) ? input.url : '';

        var promise = _origFetch.apply(this, arguments);

        if (CART_MUTATION.test(url)) {
          promise.then(function() {
            if (window.plaayRefreshCartDrawer) {
              window.plaayRefreshCartDrawer().catch(function() {});
            }

            _origFetch.call(window, '/cart.js')
              .then(function(r) { return r.json(); })
              .then(function(cart) {
                if (window.plaayTierBar) {
                  window.plaayTierBar.update(cart.total_price);
                }
              })
              .catch(function() {});
          }).catch(function() {});
        }

        return promise;
      };
    })();

    function setDiscountMessage(scope, message, type) {
      if (!scope) return;
      var msgEl = scope.querySelector('[data-plaay-discount-msg]');
      if (!msgEl) return;
      msgEl.textContent = message || '';
      msgEl.className = 'plaay-discount-msg' + (type ? ' plaay-discount-msg--' + type : '');
    }

    function updateCartDiscount(discountCode) {
      return fetch('/cart/update.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          discount: discountCode
        })
      })
        .then(function(r) {
          if (!r.ok) throw new Error('Unable to update discount.');
          return r.json();
        })
        .then(function(cart) {
          if (window.plaayTierBar) {
            window.plaayTierBar.update(cart.total_price);
          }
          return refreshVisibleCart().then(function() { return cart; });
        });
    }

    function liveScope() {
      return document.querySelector('[data-plaay-discount-scope]');
    }

    function applyDiscountCode(scope) {
      if (!scope) return;
      var input = scope.querySelector('[data-plaay-discount-input]');
      if (!input) return;
      var code = input.value.trim();
      if (!code) {
        setDiscountMessage(scope, 'Please enter a discount code.', 'error');
        return;
      }

      setDiscountMessage(scope, 'Applying code...', '');
      updateCartDiscount(code)
        .then(function(cart) {
          var s = liveScope() || scope;
          var applied = cart && (
            (cart.cart_level_discount_applications && cart.cart_level_discount_applications.length > 0) ||
            cart.total_discount > 0
          );
          if (applied) {
            setDiscountMessage(s, 'Promo applied.', 'success');
          } else {
            setDiscountMessage(s, 'That code is not valid or not applicable to your cart.', 'error');
          }
        })
        .catch(function() {
          setDiscountMessage(liveScope() || scope, 'Unable to apply that code.', 'error');
        });
    }

    function removeDiscountCode(scope) {
      setDiscountMessage(scope, 'Removing promo...', '');
      updateCartDiscount('')
        .then(function() {
          setDiscountMessage(liveScope() || scope, 'Promo removed.', 'success');
        })
        .catch(function() {
          setDiscountMessage(liveScope() || scope, 'Unable to remove promo.', 'error');
        });
    }

    document.addEventListener('click', function(e) {
      var toggle = e.target.closest && e.target.closest('.plaay-discount-toggle');
      if (toggle) {
        var scope = toggle.closest('[data-plaay-discount-scope]');
        var body = document.getElementById('plaay-discount-body');
        if (!body) return;
        var isOpen = body.getAttribute('aria-hidden') === 'false';
        body.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
        body.classList.toggle('plaay-discount-body--open', !isOpen);
        toggle.setAttribute('aria-expanded', String(!isOpen));
        if (!isOpen) {
          var inp = scope ? scope.querySelector('[data-plaay-discount-input]') : null;
          if (inp) setTimeout(function() { inp.focus(); }, 150);
        }
        return;
      }

      var applyBtn = e.target.closest && e.target.closest('[data-plaay-discount-apply]');
      if (applyBtn) {
        applyDiscountCode(applyBtn.closest('[data-plaay-discount-scope]'));
        return;
      }

      var removeBtn = e.target.closest && e.target.closest('[data-plaay-discount-remove]');
      if (removeBtn) {
        removeDiscountCode(removeBtn.closest('[data-plaay-discount-scope]') || document.querySelector('[data-plaay-discount-scope]'));
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && e.target && e.target.matches('[data-plaay-discount-input]')) {
        applyDiscountCode(e.target.closest('[data-plaay-discount-scope]'));
      }
    });

  })();
