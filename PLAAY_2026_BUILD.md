# Plaay 2026 redesign: theme build spec

Source of truth for the staging build of the redesign approved on the Claude Design canvas
(https://claude.ai/code/artifact/ef52c02c-c3a8-4a7f-bccc-8e9ca3d65ede, label "v4.3").
Six build agents work on disjoint file sets. Nothing here touches the live theme: the branch is
pushed to `staging-main` only.

## 0. Ground rules (every agent)

- Work only in the worktree `C:\Users\Kushagra\Downloads\Plaay_Theme_30Apr\.claude\worktrees\website-audit-revamp-plan-f0bf1a`.
- Touch ONLY the files listed under your agent in section 9. Never edit another agent's files.
  If you need something from another agent's area, code against the contract in this spec.
- Do not commit, stash, push, or run `shopify theme push/pull/dev`. The main session commits.
- Do NOT edit: `config/settings_data.json`, `config/settings_schema.json`, `locales/*`,
  anything under `templates/page.*`, `templates/blog*`, `templates/article*`, `templates/product.byob.json`,
  `templates/product.shogun.custom.liquid`, `templates/search.bss.product.labels.liquid`,
  `sections/nlb-*`, `sections/byob-*`, any `bundle.*.js/css`, `assets/custom.css`, `assets/bundle.theme.css`.
- Liquid must pass theme check with zero errors. Run it on your files when done:
  `"C:/Users/Kushagra/AppData/Local/Temp/claude/C--Users-Kushagra-Downloads-Plaay-Theme-30Apr--claude-worktrees-website-audit-revamp-plan-f0bf1a/eb4e99d5-f91d-48cf-83b6-df869c091cbb/scratchpad/cli/node_modules/.bin/shopify" theme check --fail-level error`
  (run from the worktree root; warnings are fine, errors are not). Also `python -m json.tool <file>` on every JSON template you write.
- Write files with the Write tool (the Bash tool corrupts backslashes). Windows paths, no `cd`.
- Use modern Liquid: `image_url` + `image_tag` (never `img_url`), `money_without_trailing_zeros`
  for prices (AED, no decimals unless needed), `{% liquid %}` blocks, `{% render %}` (never `include`).
- No Tailwind classes in new markup. No `!important` except when overriding a legacy inline style.
- Every new section/snippet wraps its root in `<div class="pl ...">` so the design system applies.
- Mobile first. Breakpoint: `@media (min-width: 1024px)` is desktop. Max content width `var(--pl-max)` (1280px).
- Accessibility: buttons are `<button type="button">`, icon-only buttons carry `aria-label`,
  sheets/drawers use `aria-modal`, focus trapping is not required but Escape must close.
- Keep the copy exactly as in section 7 (it was approved). British spelling, no exclamation marks.
- JSON templates: no comment header, valid JSON, `"name"` optional. Section settings values for
  images are `"shopify://shop_images/<file>"`, for products the handle, for collections the handle.

## 1. Design system already in the repo

`assets/plaay-ui.css.liquid` (337 lines) is loaded globally by theme.liquid (agent 1 adds the tag).
Read it before writing CSS: reuse its classes and tokens, add section-specific rules in your own
`assets/pl-<area>.css` file loaded from your section with `{{ 'pl-<area>.css' | asset_url | stylesheet_tag }}`.

Tokens (on `:root`): `--pl-yellow #FFB600`, `--pl-navy #081D48`, `--pl-purple #A028B4`, `--pl-cream #FFF7DD`,
`--pl-ground #FFFDF7` (page background), `--pl-white`, `--pl-green #46A140`, `--pl-red`, `--pl-mute` (navy 62%),
`--pl-mute-2`, `--pl-line` (navy 14%), `--pl-line-2`, `--pl-shadow`, `--pl-shadow-up`;
flavour colours `--pl-f-triple/peanut/pistachio/caramel/almond/cookies/mocha/salted/limited/lime/dark`;
type scale `--pl-t1..--pl-t8` = 11/12/13/15/17/22/28/40px (t6/t7/t8 grow to 26/32/56 on desktop);
spacing `--pl-s1..--pl-s8` = 4/8/12/16/20/24/32/48; `--pl-gutter` 16px mobile / 80px desktop;
radii `--pl-r-card 16px`, `--pl-r-input 12px`, `--pl-r-pill`; z-index `--pl-z-sticky 40`, `--pl-z-header 50`,
`--pl-z-overlay`, `--pl-z-drawer`, `--pl-z-tabbar`; `--pl-header-h`, `--pl-tabbar-h`, `--pl-max 1280px`;
font `--pl-font` = "Plaay Walsheim" (weights 400/500/700/900, self-hosted).

Classes (all under `.pl`): layout `pl-wrap` (gutter + max width), `pl-section` (+`--tight`, `--ground`),
`pl-grid pl-grid--2/3/4/d3/d4`, `pl-scroll` (horizontal snap row), `pl-row` (+`--between`, `--center`), `pl-col`,
`pl-gap1`, `pl-flex1`, `pl-center`, `pl-line` (hairline), `pl-brand-line` (yellow rule);
type `pl-h pl-h--1..4` (black weight display), `pl-eyebrow`, `pl-label`, `pl-body` (+`--lg`), `pl-small`, `pl-tiny`,
`pl-mute`, `pl-b` (bold), `pl-strike`, `pl-purple`, `pl-green`;
controls `pl-btn` (+`--full`, `--navy`, `--navy-y` (navy with yellow text), `--ghost`, `--white`, `--sm`, `--md`, `--lg`, `--link`),
`pl-iconbtn` (+`--ghost`), `pl-plus` (round yellow add), `pl-count` (badge), `pl-input`, `pl-select`, `pl-field`,
`pl-stepper` (+`--sm`; markup: `<div class="pl-stepper"><button data-minus>−</button><input><button data-plus>+</button></div>`),
`pl-switch` (checkbox switch), `pl-radio`, `pl-check`;
surfaces `pl-card` (+`--cream`, `--yellow`, `--navy`, `--flat`, `--p0`), `pl-chips > pl-chip`, `pl-pills > pl-pill[aria-pressed]`,
`pl-tag` (+`--green`, `--yellow`, `--navy`), `pl-badge` (positioned tag on images), `pl-stars` (+`--lg`);
product `pl-tile` (+`__img`, `__eyebrow`, `__title`, `__price`, `__sub`, `__foot`, `__add`),
`pl-choice > pl-choice__item[.is-on] > pl-choice__box + pl-choice__name (+ pl-choice__tag)` (flavour row),
`pl-packs > pl-pack[.is-on|.is-off] (pl-pack__l label, pl-pack__p price, pl-pack__tag)` (pack row; `--pl-packs-cols` sets columns),
`pl-buy` (single buy card: `pl-buy__opt--sub` / `pl-buy__opt--one`, `__head`, `__title`, `__price`, `__detail`, `__prices`, `__now`, `__was`, `__save`, `__freq`, `__note`; card gets `.is-sub` when subscribe is selected),
`pl-freq` (frequency select), `pl-video` (+`__play`, `__cap`, `--sm`, `.is-playing`), `pl-acc` (details/summary accordion: `pl-acc__s`, `pl-acc__t`, `pl-acc__ic`, `pl-acc__body`),
`pl-tabs > pl-tab[aria-selected]`, `pl-sticky` (+`.is-on`; bottom sticky bar above the tab bar), `pl-reveal`, `pl-skel`,
visibility `pl-hide-m` (hidden on mobile), `pl-hide-d` (hidden on desktop), `pl-vh` (visually hidden), `pl-mt1`.
Body class `pl-has-tabbar` adds bottom padding for the mobile tab bar.

Snippets:
- `{% render 'pl-icon', name: 'bag', size: 20, stroke: 1.8, class: '' %}` names: search, bag, menu, close, user, heart, heart-fill, star, star-empty, chev-right, chev-down, chev-left, arrow-right, plus, minus, check, truck, refresh, gift, play, leaf, home, grid, filter, sort, share, lock, mail, instagram, tiktok, sparkle, clock, pin.
- `{% render 'pl-tile', product: p, eager: false, show_sub: true, hide_add: false, sizes: '(min-width:1024px) 300px, 46vw' %}` product card with badge, image, title, price, "AED x subscribed" line and a one-tap `<quick-add data-module="quick-add" data-id>` add button (theme JS handles the click and opens the drawer).

## 2. Theme mechanics you must respect

- Module loader: `bundle.theme.js` upgrades every element with `data-module="<name>"` by importing `bundle.<name>.js`. Only use `data-module` for names that exist in `assets/` (quick-add, drawers, drawer-cart, cart-drawer-items, cart-items, cart-remove-button, quantity-adjuster, product-recommendations, cart-recommendations, account-area, addresses, login-template ...). New JS is plain files: `<script src="{{ 'pl-x.js' | asset_url }}" defer></script>` inside the section (Shopify de-duplicates identical script tags per page; guard with `if (!window.plX)` anyway).
- Cart drawer: `snippets/drawers.liquid` renders `<site-drawers data-module="drawers">` with `[data-overlay]` and the cart drawer. Open it with `document.querySelector('site-drawers').activeDrawer = 'cart'`; any element with `data-drawer-trigger="cart"` also opens it (bound by bundle.drawers.js). `.header__icon--cart` is additionally handled by an inline capture-phase handler in theme.liquid.
- Add to cart from JS: `document.querySelector('cart-drawer-items').add(variantId, quantity, sellingPlanIdOrUndefined)` — posts to `/cart/add.js` with `sections: ['cart-drawer-content']`, re-renders `[data-cart-drawer-content]`, and updates `[data-cart-drawer-count]`. On the cart page the element is `cart-items` (`updateQuantity(key, qty)`, `remove(key)`, re-renders section `cart-items`).
- After any cart change, sync the header/tab bar count: read `[data-cart-drawer-content]`'s `data-cart-item-count` and write it into every `[data-cart-count]` (agent 5 ships this in `assets/pl-cart.js`; others just render `[data-cart-count]`).
- `window.plaayRenderCartDrawerSections(json)` (assets/plaay-cart-gift-prompt.js) swaps the drawer HTML from a `/cart/*.js` response that carried `sections: ['cart-drawer-content']`. Reuse it.
- Rewards ladder settings (read via `settings.*`): `cart_tier_ship` 75, `cart_tier_1_spend` 250 + `cart_tier_1_label` "7% off", `cart_tier_2_spend` 350 + label "10% off + Mystery Gift", `cart_tier_3_spend` 500 + label "15% off + Mystery Gift". `snippets/cart-tier-bar.liquid` + `assets/plaay-cart-tier-bar.js` render the drawer ladder; keep their DOM/data attributes (`[data-plaay-tier-bar]`, `data-stop-*`, `.plaay-tier-bar__*`) and restyle by CSS only.
- Subscriptions are native selling plans (Recharge). `product.selling_plan_groups[].selling_plans[]` with names like "Delivery every 4 Weeks" / "Delivery every 2 Weeks" (some products: "4 weeks"/"2 weeks"). Discount = 15% (`plan.price_adjustments[0].value` with `value_type == 'percentage'`). Default frequency = the plan whose name contains "4". Cart line: `item.selling_plan_allocation.selling_plan.name/id`, `item.selling_plan_allocation.compare_at_price`.
- Ratings: `shop.metafields.judgeme.all_reviews_rating` / `all_reviews_count` (store-wide), `product.metafields.reviews.rating.value` (e.g. 4.57) and `product.metafields.reviews.rating_count` (per product). Judge.me widget: `<div id="judgeme_product_reviews" class="jdgm-widget jdgm-review-widget" data-id="{{ product.id }}" data-product-title="{{ product.title | escape }}">{{ product.metafields.judgeme.widget }}</div>` (the app embed fills it).
- Product metafields in use: `arena.subtitle_text`, `arena.exact_ingredients`, `arena.usp_text` (list), `arena.whats_inside_one_pack` (image), `custom.allergens`, `custom.shipping_policy`, `custom.nutrition_facts`, `custom.suitable_for`, `custom.product_benefits`, `custom.usp_image` (list of images), `dev.choose_your_flavour` (list of sibling products = flavour row), `custom.choose_your_size` (list of sibling products = other pack sizes, e.g. 150 g tub vs tubes), `custom.choose_your_variety` (variety packs). Access lists with `.value`.
- Badges come from tags: `badge:bestseller`, `badge:new-launch`, `badge:new`, `badge:limited` or `Limited Edition`, `badge:favourite`, `badge:staff`, `badge:gift` (see pl-tile for the mapping).
- Catalogue: bars 12 x 35 g AED 156 (handles salted-caramel-bar-x12, cookies-and-cream-bar-x12, mocha-almond-bar-x12, salty-peanut-bar-x12, pistachio-chocolate-bar-x-12; type "Baller Pack"); packs: og-plaayer-pack 145 (badge:bestseller), plaayer-pack 127, bar-bunch 63, truffle-mix 60; truffles with option "Pack Size" values `2 X 60G` 49 / `10 X 30G` 128 / `10 X 60G` 238 (triple-chocolate-truffle, peanut-butter-truffle, almond-brownie-truffle, cashew-caramel-truffle, pistachio-truffle; type "Baller Pack"); 150 g tubs triple-chocolate-truffles-150g, pistachio-chocolate-truffles-150g (AED 60, single variant, `custom.choose_your_size` links back to the tubes); limited 2 x 60 g AED 49: plaay-karak-chocolate-truffles-2-x-60g, coffee-date-chocolate-truffles-60g-copy, mexican-chilli-chocolate-truffles-2-x-60g (type "Truffle"); slabs (type "Chocolate Bars", badge:new-launch): plaay-70-dark-chocolate-bar-6-x-80g 154 and -6-x-35g 68, plaay-milk-chocolate-toffee-almond-bar-6-x-80g 154 and -6-x-35g 68, plaay-70-dark-chocolate-hazelnut-bar-6-x-80g, plaay-70-dark-chocolate-sea-salt-bar-6-x-80g, plaay-70-dark-chocolate-caramel-crunch-mousse-bar-6-x-80g, plaay-milk-chocolate-cheesecake-bar-6-x-80g (all 154), new-chocolate-bars-mix-pack-of-5 125.
- Collections: chocolate-bars, chocolate-truffles, new-chocolate-slabs, variety-packs, limited-editions, shop-all, chocolate-big-bars, energy-bars.
- Template suffixes currently assigned: bars + packs + limited + 150 g → `all-products`; tube truffles → `truffle`; slabs → `new-launch-bars`. Keep those file names so no product needs re-assigning.
- Pages that exist and are linked: /pages/for-the-geeks-1 (Our story), /pages/subscribe-save, /pages/retailers, /pages/faqs, /pages/contact, /pages/shipping-policy, /pages/returns-refunds, /pages/wishlist (saved flavours, localStorage key `plaay_wishlist`), Recharge portal `/tools/recurring/login`, Instagram https://www.instagram.com/shopplaay.

## 3. Photography uploaded to Shopify Files (use as `shopify://shop_images/<name>`)

plaay26-hero-pour.jpg (chocolate pouring over stacked slabs, landscape, hero), plaay26-yellow-hero.jpg (range on yellow),
plaay26-stack-pour.jpg (pour over bar stack on yellow), plaay26-founder.jpg (Rashi portrait, white), plaay26-portrait-crimson.jpg,
plaay26-cross-section.jpg (bar cut open), plaay26-teal-board.jpg, plaay26-apartment.jpg (opening a tube on a sofa),
plaay26-truffle-spill.jpg, plaay26-pack-carpet.jpg, plaay26-tube-handheld.jpg, plaay26-truffle-macro.jpg (bitten truffle),
plaay26-tube-open.jpg (pistachio tube), plaay26-range-lineup.jpg, plaay26-card-game.jpg (friends playing cards),
plaay26-truffle-blush.jpg, plaay26-green-tubes.jpg, plaay26-slab-life-1.jpg, plaay26-slab-life-2.jpg.
Existing: `shopify://shop_images/Group_3755_1.png` is the logo (header setting), `Plaay_Rewards_Desktop_banner.jpg` (old hero).

## 4. Canvas screenshots (look at these before building)

`C:\Users\Kushagra\Downloads\Plaay_Design_Handoff\canvas\_m\` — PNG crops of the approved screens:
Main.png (mobile home, 390x4190), DesktopHome.png (1440x5006), DesktopNav.png (desktop mega menu), Product.png (mobile PDP pack),
ProductBars.png / ProductTruffles.png / ProductSlabs.png (mobile type PDPs), DesktopProduct*.png (desktop PDPs),
Collection.png / DesktopCollection.png, ShopAll.png / DesktopShopAll.png, Search.png / DesktopSearch.png,
Cart.png / DesktopCart.png (drawer + page), Account.png / DesktopAccount.png.
Many are 6500px tall with blank space at the bottom. Crop before viewing (Pillow is installed):
`python -c "from PIL import Image; im=Image.open(r'...\\Cart.png'); im.crop((0,0,390,1600)).save(r'<scratchpad>\\cart-1.png')"`
and view slices no taller than 1600px with the Read tool.

## 5. Shell contract (agent 1 builds; everyone relies on it)

- theme.liquid loads, in order: bundle.theme.css, custom.css, `plaay-ui.css` (`{{ 'plaay-ui.css' | asset_url | stylesheet_tag }}`), head.fonts, then per-template bundle CSS only for templates that still use legacy sections (blog, article, page, customers/*, password, 404, gift_card, cart is redesigned). Body: `<body class="pl-body pl-has-tabbar template-…">`.
- Body order: `{% section 'pl-announcement' %}` → `{% section 'pl-header' %}` → `<main id="main">` (keep `.page-overlay` div) → cookie banner, gift-js, countdown snippets, `{% render 'drawers' %}` → `{% section 'pl-footer' %}` → scripts → `{% render 'pl-tabbar' %}` last.
- Header exposes: `[data-cart-count]` (number of items; hidden when 0 via `hidden` attribute), bag button `class="pl-iconbtn header__icon--cart" data-drawer-trigger="cart"`, `window.plOpenSearch()` (opens the search sheet and focuses the input), `window.plOpenMenu()` (mobile menu sheet), `window.plCloseSheets()`. Header is `position: sticky; top: 0; z-index: var(--pl-z-header)` and sets `--pl-header-h` (56px mobile, 72px desktop) on `:root` via CSS.
- Tab bar (mobile only, < 1024px): Home `/`, Shop (plOpenMenu), Search (plOpenSearch), Bag (opens drawer, shows `[data-cart-count]`), Account (`/account`). Height 64px + safe-area; sets `--pl-tabbar-h`.
- Search sheet (in pl-header): full-screen on mobile, centred panel on desktop; input `[data-pl-search-input]` with placeholder "Search flavours, packs, gifts", Cancel button, "Popular right now" chips (Salted caramel → /search?q=salted+caramel, Truffles → /collections/chocolate-truffles, New slabs → /collections/new-chocolate-slabs, Gift packs → /collections/variety-packs, Subscribe & Save → /pages/subscribe-save), "Recent" (localStorage `pl_recent_searches`, max 5, with clear), live results from `/search/suggest.json?q=<q>&resources[type]=product,collection&resources[limit]=6&resources[options][fields]=title,product_type,variants.title` rendered as rows (56px image, title, price from `price`) plus "See all results" → `/search?q=`. Enter submits `/search?q=`.

## 6. Page builds

### 6.1 Homepage (agent 2) — `templates/index.json`, order:
1. `pl-hero`: full-bleed image (mobile 4:5, desktop 16:7) `plaay26-hero-pour.jpg` (desktop) / `plaay26-stack-pour.jpg` (mobile), navy gradient at the bottom, eyebrow "Why Plaay", h1 "No guilt. All Plaay." (yellow "All Plaay."), sub "Zero refined sugar. 100% clean ingredients. Made in the UAE by a nutritionist.", buttons "Shop bestsellers" (yellow, → /collections/shop-all) and "Build your box" (ghost white, → /pages/subscribe-save). Settings: image_mobile, image_desktop, eyebrow, heading, sub, btn1 label/url, btn2 label/url.
2. `pl-claims`: four claims in a single row (scroll on mobile): No refined sugar (icon sparkle), 100% clean (leaf), Nutritionist founded (heart), Made in the UAE (pin). Blocks: icon (select from pl-icon names), label.
3. `pl-featured`: eyebrow "Bestsellers", h2 "4 picks", link "See all 27" (→ /collections/shop-all; count = `collections['shop-all'].products_count` when available). Product list setting (max 8) defaults: og-plaayer-pack, salted-caramel-bar-x12, triple-chocolate-truffle, new-chocolate-bars-mix-pack-of-5. Grid 2 cols mobile / 4 desktop of `pl-tile`.
4. `pl-cravings`: eyebrow "Shop by craving", h2 "Not by category.", four tiles (blocks: title, image, url) 2x2 mobile / 4 desktop, image with title overlaid bottom-left on a colour wash: "The 3:30 pm reset" (plaay26-apartment.jpg → /products/salted-caramel-bar-x12), "Post-workout" (plaay26-cross-section.jpg → /products/bar-bunch), "Netflix o'clock" (plaay26-truffle-spill.jpg → /products/truffle-mix), "The PMS kit" (plaay26-truffle-blush.jpg → /products/triple-chocolate-truffle).
5. `pl-video-row` (shared section, schema in 6.6): heading "Plaay on camera", sub "Reels from the feed. Tap to watch with sound." (desktop sub "Reels from the feed. Hover plays silently, click for sound."), link "More on Instagram" → Instagram. Default reels: plaay26-stack-pour.jpg "How the pour happens", plaay26-founder.jpg "Rashi: why I made Plaay", plaay26-apartment.jpg "The 3:30 pm reset", plaay26-card-game.jpg "Game night, Plaay style".
6. `pl-founder`: image plaay26-founder.jpg (portrait, rounded card), eyebrow "From our nutritionist, Rashi", quote "“You don’t need to earn chocolate.”" (h2), sub "Women don’t have a sugar problem. They have a guilt problem.", byline "Rashi Chowdhary, founder and nutritionist", link "Read why I made this" → /pages/for-the-geeks-1. Desktop: two columns.
7. `pl-rewards`: navy card. Eyebrow "Plaay rewards", h3 "Every order climbs the ladder.", four stops from settings: AED 75 Free delivery · AED 250 7% off · AED 350 10% + gift · AED 500 15% + gift, note "Applied automatically at checkout."
8. `pl-subscribe`: cream card. Eyebrow "Subscribe & Save", h2 "Your favourites, every 4 weeks.", body "Pick your box once. It arrives every 4 weeks at 15% off, and you can change it whenever you like.", bullets with check icons: "15% off every delivery", "Free delivery, always", "Skip, swap or cancel anytime"; small "From AED 41.65 a tube"; button "Build your box" → /pages/subscribe-save. Image plaay26-green-tubes.jpg on desktop right.
9. `pl-in-out`: eyebrow "Chocolate Snack Hack", h2 "What’s in. What’s out.", two lists side by side: In (green checks): Real cocoa, Nuts, Whey protein, Coconut nectar; Out (struck, red-mute): Refined sugar, Gluten, Soy, Palm oil. Blocks for each item (list: in|out, label).
10. `pl-reviews`: stars + "4.7 · 117 reviews" from shop Judge.me metafields (fallback settings.store_rating_value/count), sub "117 reviews across all Plaay products", three quote cards (blocks: quote, name, product) seeded from the current homepage testimonials in `templates/index.json` section `pdp_social_proof_rB7dqT` (read them before overwriting), desktop 3 columns.
Keep the Reelfy app section `1773387152feeb0121` (type apps) AFTER pl-video-row. Drop everything else from the old index.json (Rebuy, marquee, instafeed, related_articles, disabled sections).

### 6.2 Product pages (agent 3) — one section `sections/pl-product.liquid` + thin templates
Templates (identical apart from settings): `product.json` (kind auto, upsell blank), `product.all-products.json` (kind auto, upsell bar-bunch),
`product.truffle.json` (kind truffles, upsell truffle-mix), `product.new-launch-bars.json` (kind slabs, upsell new-chocolate-bars-mix-pack-of-5).
Order: `pl-product` → `pl-video-row` (heading "See it in real life", sub "Plaayers on camera. Tap to watch." / desktop "Plaayers on camera. Hover plays silently, click for sound.", default reels plaay26-truffle-macro.jpg "Inside a truffle", plaay26-green-tubes.jpg "The whole truffle range", plaay26-apartment.jpg "The 3:30 pm reset", plaay26-stack-pour.jpg "How the pour happens") → Reelfy apps section (copy `apps_6td8dD` from the old product.truffle.json) → `pl-recommendations` ("You might also like", Shopify recommendations API, 4 tiles) → `pl-reviews-strip` is NOT needed (reviews live in the tabs).
Drop all other old sections (Rebuy widgets, product_faqs, plaay-recently-viewed, pdp-social-proof, richtext, _blocks, nlb-aplus-*).

`pl-product` layout (mobile top to bottom; desktop = gallery left 55%, sticky buy column right 45%):
- Breadcrumb chips row: "Home › Bars" (kind name links to its collection).
- Gallery: `product.media` (images + videos via `media_tag`), scroll-snap carousel with dots on mobile, main image + thumbnail rail on desktop, `pl-badge` from tags top-left, wishlist heart top-right (toggle localStorage `plaay_wishlist` array of handles; read `snippets/plaay-wishlist-heart.liquid` to match the key format).
- Title h1 `product.title`, then rating row: stars + "4.7 · 117 reviews" (per-product `reviews.rating` if present else shop-wide), anchor to the Reviews tab.
- Sub line: `arena.subtitle_text` if present, else the kind copy: bars "Chocolate-coated bars with a salted caramel centre. Twelve in a box, one flavour, zero refined sugar." (use `product.description | strip_html | truncatewords: 22` instead, do not hard-code flavour copy); truffles/slabs likewise from description.
- Chips: `arena.usp_text` list if present, else No refined sugar · No gluten · No soy · No palm oil · Halal.
- Flavour row (`pl-choice`), label "Flavour": items = `dev.choose_your_flavour.value` (include the current product, mark `.is-on`, keep metafield order; if the current product is not in the list, prepend it). Each item = link to the sibling product; box shows the sibling's featured image on a cream tile with `mix-blend-mode: multiply` so white pack-shot backgrounds disappear; name below; `pl-choice__tag` "Limited" when the sibling carries the limited tag. Bars/slabs/tubes: ≤ 5 items in one row, more wrap. Skip the row when the list is empty and the product has no siblings.
- Pack row (`pl-packs`), label "Pack": 
  - truffles (product has option named "Pack Size"): variants in the order 2 X 60G → 10 X 30G → 10 X 60G, labels "2 x 60g" / "10 x 30g" / "10 x 60g" (tag "Best value" on 10 x 60g), price per tile; PLUS a fourth tile for the 150 g tub when `custom.choose_your_size.value` contains a product whose title contains "150" (label "150g", price, links to that product). Selecting a variant tile updates price, buy card, sticky bar, URL `?variant=`.
  - 150 g tubs: own tile "150g" `.is-on` + tiles for the tube product from `custom.choose_your_size` (link).
  - slabs: tile for self ("6 x 80g" / "6 x 35g" from the title) + sibling with the other size: `custom.choose_your_size.value` if present, else `all_products[handle-with-6-x-35g / 6-x-80g swapped]` when it exists.
  - bars/packs: no pack row.
- Rewards line (`snippets/pl-rewards-line.liquid`): cart-aware, reads the ladder settings and `cart.original_total_price`; text "Add AED 105 more to unlock 7% off" (next tier), or "7% off unlocked · AED 49 more for 10% off + a Mystery Gift", small yellow-track progress bar. Copy the threshold maths from `snippets/plaay-rewards-card.liquid`.
- Buy card (`snippets/pl-buy-box.liquid`, markup per `.pl-buy`): when the product has selling plans, two options in ONE card: "Subscribe & Save 15%" (tag "Most popular", selected by default, shows now price, struck one-time price, "save AED x", frequency `<select class="pl-freq">` listing the product's selling plans with the "4" one selected, note "Free delivery · skip, swap or cancel anytime") and "One-time" (price). No selling plans: card shows just the price. Below: `pl-stepper` (min 1, max 10) and button "Add to bag · AED 145" (yellow, full width) on ONE row. Hidden `<form>` not required; JS calls `cart-drawer-items.add(variantId, qty, sellingPlanId)` then opens the drawer; the button shows "Adding…" while loading, "Added" for 1.2 s.
- Trust row: truck "Free delivery AED 75+ · 1–2 day UAE-wide", refresh "Skip, swap or cancel anytime", leaf "Halal · no refined sugar".
- Tabs (`pl-tabs`): "What you get" (description, `arena.whats_inside_one_pack` image, "What's inside" per-piece line), "Reviews (n)" (Judge.me widget), "FAQ" (accordions: Ingredients `arena.exact_ingredients`, Allergens `custom.allergens`, Nutrition `custom.nutrition_facts`, Storage "Keep refrigerated. Best at room temperature." (truffles: "Keep refrigerated. Best cold."), Suitable for `custom.suitable_for`), "Shipping" (`custom.shipping_policy` else "Free delivery AED 75+ · 1–2 day UAE-wide · GCC 3–5 days"). Tabs are anchors; on desktop they stack as sections below the gallery.
- Upsell card "Pairs well with": section setting `upsell_product`; shows image, title, short line (setting `upsell_line`, default "All five flavours in one box" for bar-bunch, "Try all five flavours" for truffle-mix, "All five slabs, 80 g each" for the mix pack), price and a `pl-plus` add (quick-add).
- Sticky bar (mobile, `.pl-sticky`): appears once the buy card scrolls above the viewport; shows selected price + "Add to bag"; hides when the drawer is open.
- Section settings: kind (select auto/bars/truffles/slabs/packs), upsell_product, upsell_line, show_video (checkbox). Kind auto: option "Pack Size" or title contains "Truffle" → truffles; type "Chocolate Bars" or title contains "Slab" → slabs; title contains "Bar " and "12" → bars; else packs.
- `assets/pl-product.js`: variant selection, buy-mode toggle, frequency, stepper, add, sticky, gallery dots, tabs, wishlist. Keep it dependency-free.
- `sections/pl-recommendations.liquid`: standard Shopify pattern — section renders nothing until fetched via `/recommendations/products?section_id={{ section.id }}&product_id={{ product.id }}&limit=4&intent=related`; render `pl-tile` for `recommendations.products`; heading "You might also like", link "Shop all" → /collections/shop-all.

### 6.3 Collections, shop all, search (agent 4)
`sections/pl-collection.liquid` used by every collection template listed in 9 and by `list-collections.json` (which shows `collections['shop-all']`; set the section setting `collection` = shop-all there and read `section.settings.collection | default: collection`).
- Head: h1 (collection.title; "Shop all" on list-collections), "27 products" (`collection.products_count`), intro (setting `intro`, else `collection.description | strip_html`).
- Type chips (`pl-pills`, scroll row): All → /collections/shop-all, Bars → /collections/chocolate-bars, Truffles → /collections/chocolate-truffles, Slabs → /collections/new-chocolate-slabs, Variety packs → /collections/variety-packs, Limited → /collections/limited-editions; the current one `aria-pressed="true"`.
- Bar: "Filter" button (opens a sheet with `collection.filters` when Search & Discovery provides them; hide the button when `collection.filters.size == 0`) and Sort `pl-select` (options from `collection.sort_options`, submits `?sort_by=`). Desktop: filters as a left rail (Price, Pack size, Type, Flavour — whatever S&D provides).
- Grid: `paginate collection.products by 24`, 2 cols mobile / 4 desktop of `pl-tile` (first 4 eager). After the 4th tile insert a full-width cream card "Build your box · Every 4 weeks. Free shipping. Skip or cancel anytime." with button "Subscribe & Save" → /pages/subscribe-save (setting `show_sub_card`). Empty state: "Nothing here yet." + link to shop all.
- Footer of grid: "Showing 8 of 27" + `pl-btn--ghost` "Load more" (link to `paginate.next.url`; enhance with fetch + `section_id` append in `assets/pl-collection.js`) and numbered pagination fallback.
- Keep the Reelfy apps section (`apps_reelfy_collection`) after the grid in each template. Drop all the old featured_products/marquee/hero/richtext/_blocks/nlb/plaay-recently-viewed sections.
`sections/pl-search.liquid` for `search.json`: search field (form GET /search, input name q, hidden `type=product,collection`), "Popular right now" chips (same five as the header sheet) when no query, results heading "3 results for “pista”" (`search.results_count`, `search.terms`), product grid of `pl-tile` (`paginate search.results by 24`, skip non-products or render collections as simple link cards), empty state "No results for “x”. Try “salted caramel” or browse all flavours." with the chips, pagination. `templates/search.json` = just `main` pl-search.

### 6.4 Cart drawer + cart page (agent 5)
Restyle in place, keeping every JS hook listed in section 2. Drawer (`snippets/drawer-cart.liquid`, `snippets/cart-drawer-content.liquid`, `snippets/cart-drawer-items.liquid`, `snippets/cart-drawer-footer.liquid`, `snippets/cart-recommendations.liquid`, `snippets/plaay-cart-empty-state.liquid`, new `assets/pl-cart.css` + `assets/pl-cart.js`, loaded from `snippets/drawer-cart.liquid`):
- Header "Your bag (2)" with `[data-cart-drawer-count]`, close button. Width 100vw mobile, 440px desktop, background `--pl-ground`, slide from right (keep the transition classes the drawer JS toggles: inspect bundle.drawers.js / bundle.drawer-cart.js for `active` handling; keep `group-active/cart` Tailwind hooks if that is how it shows, or reimplement with the `active` class on `cart-drawer` — the inline theme.liquid fallback adds `.active` to `cart-drawer` and `.overflow-hidden` to body).
- Ladder: existing `cart-tier-bar` snippet, restyled: message line ("AED 49 more unlocks 10% off + a Mystery Gift" / "7% off unlocked"), yellow track, four pills.
- Line item: 72px image on cream, title, variant/pack, "Every 4 weeks · 15% off" tag when subscribed, unit price (struck compare when discounted), `pl-stepper--sm` (works with the existing quantity-adjuster / cart-drawer-items update flow — read `bundle.cart-drawer-items.js` and `bundle.quantity-adjuster.js` for the expected markup and events), remove link.
- Subscription switch per line (new): when `item.product.selling_plan_groups.size > 0` and the line is one-time: a `pl-switch` row "Subscribe & save AED 21.75" + small "Every 4 weeks · free delivery · cancel anytime". Turning it on posts `/cart/change.js` `{id: item.key, quantity: item.quantity, selling_plan: <id of the plan whose name contains "4">, sections: ['cart-drawer-content']}` and re-renders via `window.plaayRenderCartDrawerSections`. When subscribed: label "Every 4 weeks · 15% off" + link "Switch to one-time" (same call with `selling_plan: null`; if Shopify rejects null, remove the line and re-add without a plan). Embed the plan id and saving on the line as data attributes computed in Liquid (`item.product.selling_plan_groups.first.selling_plans`, 15% of `item.original_line_price`).
- "Add" upsell row ("Triple Chocolate Truffles · AED 49 — Takes you to 10% off + a Mystery Gift"): keep `cart-recommendations` module markup, restyle; the line under it is computed from the ladder (next tier minus subtotal).
- Footer: "Subtotal AED 301.00", discount rows ("7% off, applied automatically − AED 19.55", "Subscription, 15% off OG Plaayer Pack − AED 21.75"), "Delivery Free" (when subtotal ≥ tier ship) else "Delivery Calculated at checkout", "Total AED 259.70", button "Checkout" (yellow, full; keep `href="/checkout"` and `data-checkout-url`), trust row "Halal · Easy returns · 1–2 day delivery", discount code field (keep `data-plaay-discount-*` hooks), "Continue shopping" link (`data-close`).
- Empty state: bag icon, "Your bag is empty.", "Start with a bestseller." + 2 tiles (og-plaayer-pack, triple-chocolate-truffle via `all_products`).
- `assets/pl-cart.js`: count sync (see section 2), subscription switch, stepper wiring if quantity-adjuster does not fit the new markup, `plaay:cart:updated` custom event after re-render.
Cart page `sections/main-cart.liquid` + `templates/cart.json`: same components at page width, desktop two columns (items left 60%, summary card right sticky), keep `[data-cart-page-root]` and the `cart-items` module contract (`sections/cart-items.liquid` renders the lines; keep it as the section the JS re-renders).

### 6.5 Account (agent 6)
Sections `account_template`, `login_template`, `register_template`, `order_template`, `address_template`, `reset_password` and the wrappers in `templates/customers/*` (account.liquid becomes just `{% section 'account_template' %}`). New `assets/pl-account.css` (+ `pl-account.js` only if needed).
- Hub (`/account`): "Hey, Plaayer." (use first name when present: "Hey, Nikita."), sub "Orders, your subscription, rewards and alerts, in one place." Cards: "Your last order · AED 259.70" (items summary "OG Plaayer Pack + Salted Caramel Bar", status tag "Delivered", button "Reorder" — keep the existing `data-plaay-reorder` behaviour from the current account_template and its script), "Your subscription" (if customer tag contains "Active Subscriber": "OG Plaayer Pack · every 4 weeks" is not available from Liquid, so show "Next delivery" copy generically and a button "Manage subscription" → /tools/recurring/login; else "No subscription yet" + "Build your box" → /pages/subscribe-save), "Rewards" ladder (settings), "Saved flavours" → /pages/wishlist, "Alerts · Only if you want them" (New drops, Back in stock, The 3:30 pm reset — plain rows linking to /pages/contact or the newsletter form; no fake toggles), "Add Plaay to your Home Screen · Opens like an app, no App Store" (link to a short how-to accordion), nav list Orders / Addresses / Your details / Sign out (`/account/logout`).
- Orders list (mobile cards, desktop table: Items · Status · Total), order page (items, addresses, totals), addresses (existing forms + `addresses` module hooks), login / register / reset (single card forms, yellow primary button, links).
- Keep every `{% form %}` type and input name used today. Read the current sections first; restyle, do not drop functionality.

### 6.6 Shared `pl-video-row` section schema (agent 2 writes it, agent 3 references it in templates)
Settings: `heading` (text, default "Plaay on camera"), `sub` (text), `sub_desktop` (text), `link_label` (text, default "More on Instagram"), `link_url` (url, default https://www.instagram.com/shopplaay), `bg` (select ground|cream|navy, default ground).
Blocks `reel` (max 8): `image` (image_picker), `caption` (text), `video` (text, optional mp4 URL), `link` (url, optional).
Rendering: horizontal snap row of 9:16 `pl-video` tiles (mobile 2.4 per view, desktop 4 + peek), play button, caption at the bottom; with `video` set, tap plays inline with sound on mobile, hover plays muted on desktop; without it the tile links to `link` or `link_url`.

## 7. Copy bank (verbatim)
Home: "Why Plaay" · "No guilt. All Plaay." · "Zero refined sugar. 100% clean ingredients. Made in the UAE by a nutritionist." · "Shop bestsellers" · "Build your box" · "Bestsellers" · "4 picks" · "See all 27" · "Shop by craving" · "Not by category." · "The 3:30 pm reset" · "Post-workout" · "Netflix o'clock" · "The PMS kit" · "Plaay on camera" · "Reels from the feed. Tap to watch with sound." · "More on Instagram" · "From our nutritionist, Rashi" · "You don’t need to earn chocolate." · "Women don’t have a sugar problem. They have a guilt problem." · "Rashi Chowdhary, founder and nutritionist" · "Read why I made this" · "Subscribe & Save" · "Your favourites, every 4 weeks." · "Pick your box once. It arrives every 4 weeks at 15% off, and you can change it whenever you like." · "15% off every delivery" · "Free delivery, always" · "Skip, swap or cancel anytime" · "From AED 41.65 a tube" · "Chocolate Snack Hack" · "What’s in. What’s out." · "117 reviews across all Plaay products".
Nav: Shop · Bars · Truffles · Slabs · Variety packs · Subscribe & Save · Our story · "Shop by type" · "Shop by craving" · "Bestsellers" · "Build your box" · "Every 4 weeks. Free shipping. Skip or cancel anytime." · "Search flavours, packs, gifts" · "Popular right now" · "Recent" · "See all results".
Footer: columns Shop (Bars, Truffles, Slabs, Variety packs, Limited editions, Shop all), Plaay (Our story, Subscribe & Save, Rewards → /pages/subscribe-save, Retailers), Help (Delivery → /pages/shipping-policy, Returns → /pages/returns-refunds, FAQ → /pages/faqs, Contact → /pages/contact); "Plaay mail" · "Fresh drops, flavour votes and a code for your first order." · "you@email.com" · "Sign up"; bottom "Free delivery AED 75+ · 1–2 day UAE-wide · GCC 3–5 days" · "Halal certified" · "Visa · Mastercard · Apple Pay" · Instagram · TikTok · © Plaay.
Announcement default: "Free delivery AED 75+ · 7% off AED 250+ · 10% off + Mystery Gift AED 350+ · 15% off AED 500+".
PDP: "Flavour" · "Pack" · "Best value" · "Limited" · "Subscribe & Save 15%" · "Most popular" · "One-time" · "Every 4 weeks" · "Free delivery · skip, swap or cancel anytime" · "Add to bag · AED 145" · "Add AED 105 more to unlock 7% off" · "Free delivery AED 75+ · 1–2 day UAE-wide" · "What you get" · "Reviews (117)" · "FAQ" · "Shipping" · "Allergens" · "Storage" · "Shipping & returns" · "Pairs well with" · "See it in real life" · "You might also like".
Collection: "Chocolate bars" · "5 products" · "Chocolate-coated bars, 12 × 35 g a box. Zero refined sugar, 100% clean." · "Filter" · "Sort" · "Showing 8 of 27" · "Load more" · "Shop all" · "27 products".
Search: "Search flavours, packs, gifts" · "Cancel" · "Popular right now" · "Recent" · "3 results for “pista”" · "See all results".
Cart: "Your bag (2)" · "AED 49 more unlocks 10% off + a Mystery Gift" · "7% off unlocked" · "Every 4 weeks · 15% off" · "Subscribe & save AED 21.75" · "Every 4 weeks · free delivery · cancel anytime" · "Takes you to 10% off + a Mystery Gift" · "Subtotal" · "7% off, applied automatically" · "Subscription, 15% off OG Plaayer Pack" · "Delivery" · "Free" · "Total" · "Checkout" · "Halal" · "Easy returns" · "1–2 day delivery" · "Your bag is empty." · "Start with a bestseller.".
Account: "Hey, Plaayer." · "Orders, your subscription, rewards and alerts, in one place." · "Your last order" · "Reorder" · "Your subscription" · "Manage subscription" · "Rewards" · "Saved flavours" · "Addresses" · "Your details" · "Alerts" · "Only if you want them" · "New drops" · "Limited editions and new slabs" · "Back in stock" · "Add Plaay to your Home Screen" · "Opens like an app, no App Store" · "Sign out".

## 8. Non-goals
About/Our story page, blog, policy/FAQ/contact pages, BYOB, Shogun pages, checkout, password page, the Recharge portal, Search & Discovery configuration, product data changes, live theme.

## 9. Ownership (disjoint file sets)
1. Shell: `layout/theme.liquid`, `sections/pl-announcement.liquid`, `sections/pl-header.liquid`, `sections/pl-footer.liquid`, `snippets/pl-tabbar.liquid`, `assets/pl-shell.css`, `assets/pl-shell.js`.
2. Home: `sections/pl-hero.liquid`, `pl-claims`, `pl-featured`, `pl-cravings`, `pl-video-row`, `pl-founder`, `pl-rewards`, `pl-subscribe`, `pl-in-out`, `pl-reviews` (all `sections/pl-*.liquid`), `assets/pl-home.css`, `assets/pl-video-row.js`, `templates/index.json`.
3. Product: `sections/pl-product.liquid`, `sections/pl-recommendations.liquid`, `snippets/pl-buy-box.liquid`, `snippets/pl-flavour-row.liquid`, `snippets/pl-pack-row.liquid`, `snippets/pl-gallery.liquid`, `snippets/pl-rewards-line.liquid`, `assets/pl-product.css`, `assets/pl-product.js`, `templates/product.json`, `templates/product.all-products.json`, `templates/product.truffle.json`, `templates/product.new-launch-bars.json`.
4. Catalogue: `sections/pl-collection.liquid`, `sections/pl-search.liquid`, `assets/pl-collection.css`, `assets/pl-collection.js`, `templates/collection.json`, `templates/collection.truffles.json`, `templates/collection.chocolate-bars.json`, `templates/collection.chocolate-truffles.json`, `templates/collection.variety-packs.json`, `templates/collection.limited-edition.json`, `templates/collection.new-chocolate-bars.json`, `templates/collection.plaay-pantry.json`, `templates/collection.chocolate-bars-new.json`, `templates/list-collections.json`, `templates/search.json`.
5. Cart: `snippets/drawer-cart.liquid`, `snippets/cart-drawer-content.liquid`, `snippets/cart-drawer-items.liquid`, `snippets/cart-drawer-footer.liquid`, `snippets/cart-recommendations.liquid`, `snippets/plaay-cart-empty-state.liquid`, `snippets/cart-tier-bar.liquid` (CSS-only restyle allowed via pl-cart.css; markup unchanged), `sections/main-cart.liquid`, `sections/cart-items.liquid`, `sections/cart-page-recommendations.liquid`, `templates/cart.json`, `assets/pl-cart.css`, `assets/pl-cart.js`.
6. Account: `sections/account_template.liquid`, `sections/login_template.liquid`, `sections/register_template.liquid`, `sections/order_template.liquid`, `sections/address_template.liquid`, `sections/reset_password.liquid`, `templates/customers/*.liquid`, `templates/customers/addresses.json`, `assets/pl-account.css`, `assets/pl-account.js`.
Shared, read-only for everyone: `assets/plaay-ui.css.liquid`, `snippets/pl-icon.liquid`, `snippets/pl-tile.liquid`. If you need a change there, describe it in your final report instead of editing.

## 10. Report format (final message of each agent)
Files written (path list) · theme check result line (quote it) · JSON validation result · assumptions made · anything you could not do and why · requests for shared files.
