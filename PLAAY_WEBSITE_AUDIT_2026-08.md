# Plaay — Website UI/UX, Code & Brand Audit

**Site:** shopplaay.com (Shopify, theme `Plaay/main`, theme id `t/84`)
**Audited:** 10 August 2026
**Scope:** Code (Liquid/CSS/JS), live front-end measurement, mobile-first UX, visual design system, brand compliance, accessibility, SEO hygiene, plus a proposed motion/interaction system.
**Status:** Research only. No files were changed.

**Reference material used**
- Theme source: `Plaay_Theme_30Apr` (103 assets, 96 sections, 122 snippets, 7 AI blocks)
- `PLAAY GUIDELINES 2024 v2.pdf` (72pp) — visual identity, colour, type, tone
- `Plaay_Brand_Pillars__Territories.pdf` (17pp) — positioning, pillars, territories
- `1. Plaay Brand Overview.pdf` (15pp) — product, founder, audience
- Live measurement of `/`, `/products/og-plaayer-pack`, `/collections/all` at 375×812 (mobile) and 1440×900 (desktop)

---

## 0. Update — post speed release (verified live, 10 Aug 2026)

A performance commit landed and **is live on theme `t/84`** — verified by fetching the served `custom.css` (now minified by Shopify, 83 KB) and finding every marker from the branch: `.plaay-search-icon-wrap`, `.plaay-sticky-mobile__qty-wrap`, `env(safe-area-inset-bottom)`, the `prefers-reduced-motion` block and the 16 px form-control floor.

Source: `claude/website-theme-speed-mobile-ed7f06` — *"perf(mobile): fix LCP images, drop dead third-party, mobile UX pass"* — 35 files, **+335 / −4,226 lines**.

> **Git hygiene note:** that commit is live on Shopify but **is not merged into the local `main` branch** (`main` is still at `da28937`). Anything branched off `main` today will silently re-introduce the old code. Merge it before the next piece of work starts.

### What shipped (verified live, not just in the diff)

| # | Change | Verified how | Audit item closed |
|---|---|---|---|
| 1 | **Hotjar and BugHerd removed** (script + dns-prefetch) | 0 network requests to either host on the live homepage | P0 #1 (partly), §2.4 |
| 2 | **Hero LCP fixed** — `image_url: width:` + 4-candidate `srcset` + `sizes="100vw"` + `width`/`height`, first slide `loading="eager" fetchpriority="high"`, slides 2–6 `loading="lazy"` | Live hero `img` now serves `…&width=750` instead of the 1000 × 1648 master | P0 #3 |
| 3 | **Product-tile hover image is desktop-only** — wrapped in `<picture>` with `media="(min-width:1024px)"`, mobile gets a 43-byte transparent GIF | **33 / 33** secondary images on the homepage and **27 / 27** on the PLP are the data-URI placeholder on mobile | P0 #6 (partly) |
| 4 | **Expired campaigns switched off** — `fathers_day_sale_enabled` and `summer_sale_enabled` → `false` | `config/settings_data.json` | P0 #8 (partly) |
| 5 | **Dead assets deleted** — `glide.modular.static.js` (3,867 lines), `waypoints.static.min.js`, `test.css`, `bundle.test.js`, `plaay-perf.liquid`, `scratch-sticker-alternate.liquid`, and **5 legacy `.woff` files** (~307 KB) | 0 requests for `glide.modular` or `waypoints` live | §6.1 |
| 6 | **`snippets/img.liquid` rewritten** — real `sizes` parameter (was generating a broken `sizes` list from breakpoints), leaner 5-step `srcset`, single `<img>` output path | Snippet source | §6.2 |
| 7 | **iOS focus-zoom fixed** — 16 px floor on all form controls under 1023 px | `custom.css` live | §3.2 |
| 8 | **Tap targets raised to 44 px** on search icon, sheet close, cookie close, cart close, sticky qty stepper | `custom.css` live | §3.2 (partly) |
| 9 | **Cookie banner no longer collides** with the WhatsApp float, and is bottom-anchored on product templates instead of pinned over the header | `custom.css` live | §3.1 |
| 10 | **Global `prefers-reduced-motion` block added** (was zero coverage) | `custom.css` live | §4.1, §7 |
| 11 | **`layout/checkout.liquid` preloads fixed** — asset names contained literal spaces (`'bundle.checkou t.css'`), so both preloads were 404ing | Source | new |
| 12 | Header logo now eager + correctly sized; flavour-option thumbnails get `loading`/`decoding`/dimensions | Source | §7 |

### Measured effect

| Metric (homepage, mobile 375×812) | Before | After | Note |
|---|---|---|---|
| **Long tasks** | 36, **4,079 ms** total, 3 over 200 ms | 26, **2,069 ms** total, **0 over 200 ms** | ≈ **−49 % main-thread blocking**; largest single task now under 200 ms |
| Hotjar / BugHerd requests | present | **0** | |
| Secondary tile images downloaded on mobile | 1 per tile | **0** (43-byte GIF) | 33 fewer image fetches on home, 27 on PLP |
| Hero image served | 1000 × 1648 master, no priority hint | width-750 candidate, `fetchpriority="high"` | |
| JS files | 201 | 188 | |
| `<script>` tags | 155 | 149 | |
| HTML decoded | 850 KB | 836 KB | barely moved — see below |
| Inline script in document | 213.6 KB | 209.9 KB | |
| DOM nodes | 4,269 | 4,428 | `<picture>` wrappers add nodes |
| Stylesheets | 17 | 17 | |
| Font files | 6 (incl. one duplicate) | 6 (incl. one duplicate) | |

> **Caveat on timings:** the "after" pass ran with a warm HTTP cache, so `load`/TTFB/transfer figures are not comparable to the cold "before" numbers and are deliberately omitted. Long-task totals are dominated by script *execution*, not fetching, so that comparison holds — but the official before/after should be a cold Lighthouse or PageSpeed run on `shopplaay.com` in mobile mode.

### What the release did **not** change

Every one of these is still true on the live site:

1. **HTML is still ~836 KB on the homepage and ~1,042 KB on `/collections/all`.** The cause is untouched: `snippets/product-tile.liquid` still emits a `{% style %}` block per tile. Live count: **77 `<style>` tags / 122 KB on the homepage, 61 tags / 100 KB on the PLP.** This is now the single biggest remaining perf item.
2. **4.9 MB of decoded JavaScript** across 188 files — unchanged. The theme's own bundles are a minority of this; apps are the bulk.
3. **Rebuy still ships 19 requests** (16 `cdn.rebuyengine.com` + 3 `cached.rebuyengine.com`) while being destroyed at runtime. This is an app-uninstall job, not a theme edit.
4. **Fonts untouched** — still 5 preloaded families, still `walsheim-regular.static.woff2` fetched twice, still `GTWalsheimPro-Bold` used without an `@font-face`.
5. **No `<h1>`** on homepage or `/collections/all`; `<title>` on the PLP is still `"Products"`.
6. **PLP is still one column, no filters, no sort** — page height still **14,012 px**.
7. **Hero still has 6 slides for 2 unique images.** Slides 2–6 are now lazy, so the cost is much lower, but the duplicate blocks should be deleted in the customiser.
8. **Sticky ATC is still 146 px**; total fixed mobile chrome unchanged at 316 px.
9. **Consent gating still absent** — Clarity, Meta Pixel, GA4, Klaviyo and Recharge all fire before any cookie choice. Removing Hotjar reduced the exposure; it did not fix it.
10. **Cookie banner is still top-anchored on non-product templates** (including the homepage), so the first-load overlay over the hero persists there.

### Two new findings from this pass

- **`id="[object HTMLSelectElement]"` appears 54 times on `/collections/all`.** Something is assigning a DOM element where a string id is expected. Alongside it, `id="productSelect"` is also duplicated **54 times**. Both are invalid HTML and will break any `getElementById` lookup. Worth tracing before the next JS change.
- **Klaviyo (12 requests across `static.klaviyo.com` + `static-tracking.klaviyo.com`) and Recharge (`static.rechargecdn.com`)** are now visible in the third-party mix, plus the still-unidentified `api.config-security.com`. Third-party budget needs an owner.

### How the plan changes

- **P0 shrinks from 10 items to 6.** Items 1, 3, 8 are done or mostly done; item 6 is half done.
- **The remaining P0 is now dominated by one job:** moving the per-tile `{% style %}` block out of `product-tile.liquid` into `custom.css`. That single change should take the homepage from 836 KB → roughly 200 KB of HTML and the PLP from 1,042 KB → roughly 250 KB, which is a larger win than everything in the release combined.
- **Effort saved:** roughly 1.75 days of the original 5-day P0.
- **P1 and P2 are unaffected** — the release was pure performance and mobile ergonomics. Nothing in the design system, brand-compliance, IA or storytelling sections has moved.

Revised P0, in priority order:

| # | Action | Effort | Status |
|---|---|---|---|
| 1 | Move `{% style %}` out of `product-tile.liquid`; drop the duplicate `productSelect` id and the `[object HTMLSelectElement]` id bug; remove the dead `product.collections` loop and the Yotpo remnants | 1 d | **open — do first** |
| 2 | Add a real `<h1>` to homepage + collection; fix the `"Products"` title | 0.5 d | open |
| 3 | Collection grid → 2 columns on mobile | 0.25 d | open |
| 4 | Font pass: preload 2 not 5, one family with weights, add the missing `GTWalsheimPro-Bold` face, kill the duplicate `walsheim-regular` fetch | 0.5 d | open |
| 5 | Uninstall Rebuy properly; gate Clarity/Pixel/GA4/Klaviyo behind consent; identify `config-security.com` | 0.5 d | open |
| 6 | Slim the sticky ATC 146 px → 64 px; bottom-anchor the cookie banner on all templates; fix the double cart-button handler race in `theme.liquid` | 0.75 d | open |
| — | **Merge `claude/website-theme-speed-mobile-ed7f06` into `main`** | 5 min | **do before anything else** |

---

## 1. Executive summary

> Sections 1–10 describe the state **before** the speed release. See **§0** for what has since shipped, what it measurably changed, and the revised P0. Findings 2–5 below are all still live.

The store is functional and the brand's product photography carries it, but the site is **running on ~2 years of stacked patches**. Nothing has been removed, so every campaign, every app trial and every "quick fix" is still shipping to every visitor. The result is a mobile experience that is slow, chrome-heavy, and — most importantly — **says nothing about what Plaay actually is**.

### The five things that matter most

| # | Finding | Evidence | Impact |
|---|---------|----------|--------|
| 1 | **Mobile page weight and main-thread cost are extreme.** | Homepage: 258 requests, 1.70 MB transferred, **4.9 MB of JavaScript decoded across 201 files**, **850 KB of HTML**, 36 long tasks totalling **4,079 ms** of blocked main thread. `load` fired at 23.9 s on a warm connection. | Every 1 s of mobile delay is worth roughly 7–10 % of conversion. This is the single biggest revenue leak on the site. |
| 2 | **The homepage has no `<h1>` and no words.** The hero headline is baked into the banner JPG; hero `alt` is empty. | `sections/two-sections-hero.liquid:165–169`; live DOM `h1: []` | Google sees a page about nothing. A first-time visitor sees a picture and a "SHOP NOW" and has to guess. |
| 3 | **Collection pages are a single column on mobile with no filters and no sort.** 27 products = **13,995 px** of scroll (≈17 screens). | `.collection.grid.grid-cols-1` (mobile), `main-collection.liquid`; live: `tiles: 27, pageH: 13995, filters: []` | Kills browse-and-compare, the single most valuable behaviour on a PLP. |
| 4 | **39 % of the mobile viewport is permanently occupied by fixed chrome.** Announcement 40 px + header 54 px + 16 px gap + sticky ATC 146 px + bottom nav 60 px = 316 px of 812 px. Plus a cookie dialog pinned over the top 182 px on first load. | Live rects on `/products/og-plaayer-pack` | Content window is 496 px. On first load, less than that. |
| 5 | **The site does not tell the brand's story.** The brand book positions Plaay as *"emotionally safe indulgence… a mindset brand… emotional freedom in edible form."* The site leads with macros-adjacent product claims and has zero founder presence — despite a nutritionist founder with 455 K followers. | `Plaay_Brand_Pillars__Territories.pdf` p.1–12 vs live homepage copy | The website is the only owned channel where the brand argument is completely missing. |

### Scorecard

| Area | Score | One-line verdict |
|---|---|---|
| Mobile performance | **3 / 10** | 4.9 MB JS, 4.1 s blocked main thread, 850 KB HTML |
| Mobile UX / ergonomics | **4 / 10** | Fixed chrome eats the screen; 53 % of tap targets under 44 px |
| Information architecture | **4 / 10** | Categories hidden behind hover; no filters/sort; two competing mobile menus |
| PDP conversion design | **6 / 10** | Good bones (sticky ATC, FAQ, social proof) but bloated and buried |
| Visual design system | **3 / 10** | No tokens, 16 font sizes, 9 corner radii, 21 breakpoints, 136 `!important` |
| Brand compliance | **3 / 10** | Wrong yellow, wrong navy, wrong purple, wrong typeface cut, zero signature devices |
| Brand storytelling | **2 / 10** | Product-led site for a mindset brand |
| Accessibility | **4 / 10** | No `h1`, 85 images without alt, 13 unlabelled controls, 17 unlabelled inputs |
| Code health / maintainability | **3 / 10** | 22 unused sections, 4 near-duplicate PDP templates, 9 files of hardcoded campaign dates |
| Motion & delight | **2 / 10** | 4 animation libraries loaded, almost no animation shipped, no reduced-motion support |

---

## 2. Measured data

All figures captured live on 10 Aug 2026. Mobile = 375 × 812.

### 2.1 Homepage (`/`, mobile)

| Metric | Value | Healthy target |
|---|---|---|
| Requests | 258 | < 80 |
| Transferred | 1,698 KB | < 900 KB |
| **HTML decoded** | **850 KB** | < 120 KB |
| **JS decoded** | **4,904 KB across 201 files** | < 500 KB |
| CSS decoded | 541 KB across 42 files | < 120 KB |
| Stylesheets in `<head>` | 17 | ≤ 4 |
| `<script>` tags | 155 | < 25 |
| Inline script in document | 213.6 KB | < 5 KB |
| DOM nodes | 4,269 | < 1,500 |
| Long tasks | 36, totalling 4,079 ms | < 300 ms TBT |
| `DOMContentLoaded` | 3,811 ms | < 1,500 ms |
| `load` | 23,895 ms | < 5,000 ms |
| TTFB | 1,407 ms | < 600 ms |
| Images | 219 (85 without alt, 77 without dimensions) | — |
| Page height | 6,430 px | — |

### 2.2 PDP (`/products/og-plaayer-pack`, mobile)

| Metric | Value |
|---|---|
| Requests / transferred | 338 / 1,155 KB |
| DOM nodes | 2,739 |
| Page height | 4,405 px |
| Main "Add to bag" position | y = 699 px (below the 718 px content fold) |
| Images | 113 (33 without alt) |
| Sections rendering at 0 px height | 4 of 11 |

### 2.3 Collection (`/collections/all`, mobile)

| Metric | Value |
|---|---|
| Requests / transferred | 403 / 2,265 KB |
| DOM nodes | 4,592 |
| Page height | **13,995 px** |
| Grid | `grid-cols-1`, gap 40 px, tile 343 × 415 |
| Filters / sort | **none** |
| `<h1>` | **none** |
| `<title>` | `"Products"` |
| Images | 235 |

### 2.4 Third-party load (homepage)

| Host | Requests | Notes |
|---|---|---|
| connect.facebook.net | 2 | 170 KB, `fbevents.js` alone blocked 3,051 ms |
| cdn.shopify.com (app extensions) | 15 | Reelfy, Judge.me, BSS labels, Rebuy |
| cdn.rebuyengine.com + cached.rebuyengine.com | 19 | **Smart Cart is explicitly disabled in `theme.liquid:224–229` but the app still ships 6 CSS files and its JS, then gets destroyed at runtime** |
| clarity.ms + y.clarity.ms + scripts.clarity.ms | 10 | Microsoft Clarity |
| static.hotjar.com | — | Hotjar (id 5268120) |
| **www.bugherd.com** | — | **QA/bug-reporting sidebar running on production** (`theme.liquid:161`) |
| instafeed.nfcube.com + cdn.nfcube.com | 4 | Instafeed |
| gravity-apps.com | — | Infinite scroll (collection/search only) |
| conf.config-security.com / api.config-security.com | 4 | **Unidentified — audit which app injects this** |
| api.country.is | 1 | Geo lookup on every pageview |

Three analytics/session-recording tools (Hotjar, Clarity, GA4) plus Meta Pixel are all firing, and **none of them is gated by the cookie banner** — the banner renders at `z-index: 9400` while `theme.liquid:135–166` loads Hotjar and BugHerd on `load` regardless of consent. For a UAE/EU-facing store this is a consent-compliance gap, not just a performance one.

---

## 3. Mobile UX — the priority

### 3.1 The screen budget problem

On a 375 × 812 device on a product page:

```
   0 ─ 40    announcement bar   (fixed, z-10)
  40 ─ 56    dead gap           (header is positioned top-16 = 64px, bar is 40px tall)
  56 ─ 110   header             (fixed, z-9)
 110 ─ 292   cookie dialog      (fixed, z-9400, first visit only)
 ...
 606 ─ 752   sticky ATC bar     (146px tall)
 752 ─ 812   bottom nav         (60px)
```

- **316 px (39 %) of the viewport is permanently chrome.** Usable content window: 496 px.
- The **sticky ATC bar is 146 px tall** — it carries a purchase-mode label, a plan row, a price row *and* the button. Industry norm is 56–72 px.
- The **cookie banner is pinned to the top on first load**, over the hero. It is the first thing a new visitor sees and it covers the LCP element.
- A **16 px gap** between the announcement bar and the header lets the page show through — reads as a rendering bug (`layout/theme.liquid` + `.announcement_bar` 40 px vs `header.fixed.top-16` = 64 px).
- The WhatsApp float sits at y 684–740, i.e. **12 px above the bottom nav** and overlapping the sticky ATC zone on non-PDP pages.

**Fix direction:** collapse to one top chrome unit (announcement + header, 88 px total, auto-hiding on scroll-down), shrink sticky ATC to 64 px, move the cookie banner to a bottom sheet, and hide the WhatsApp float whenever the bottom nav or sticky ATC is visible.

### 3.2 Tap targets and legibility

- **86 of 163 tappable elements (53 %) are smaller than 44 × 44 px.** Worst offenders: nav links at 20 px and 18 px height, glide arrows at 35 × 35, the wishlist heart at 34 × 34, footer links at 14 px height, the header logo link at 80 × 30.
- Text as small as **8 px** (`.plaay-badge--new-launch`), 9 px (`.plaay-menu-badge`, marquee separators), 10 px (mobile menu trust labels), 11 px (announcement bar). Minimum legible size on mobile is 12 px, and 14 px for anything a customer needs to read.
- Grey price text `rgb(158,158,158)` on white = **2.68:1 contrast** at 12.6 px — fails WCAG AA (needs 4.5:1). This is on the *price*, which is the most consequential number on the page.

### 3.3 Collection page — the biggest UX defect

- 27 products, one per row, 40 px gaps → **13,995 px of scroll**. At a typical mobile scroll velocity that is 40–60 s of thumbing to reach the last product.
- **No filters. No sort. No product count. No collection description. No `h1`.** `collection_hero` and `collection-hero-basic` sections both exist and both are `disabled: true` in `templates/collection.json`.
- The container adds `py-20` (80 px) top and bottom on mobile before the first tile.
- Infinite scroll is delegated to a third-party script (`gravity-apps.com`) rather than the theme.

**Fix direction:** 2-column grid on mobile (the standard for D2C food/CPG), a sticky filter/sort bar, an eyebrow row with product count, and a compact tile (image, name, price, one-tap add).

### 3.4 Navigation

- **Two mobile menus ship on every page**: the legacy `.mobile_menu` from `sections/header.liquid` (fixed, full-height, 812 px) *and* the newer `.pbn-sheet` bottom sheet from `snippets/mobile-bottom-nav.liquid` (708 lines). Both are in the DOM simultaneously.
- On **desktop**, the visible top-level nav is only *Subscribe & Save / About Us / Contact Us*. Every product category — Bars, Truffles, Variety Packs, Limited Editions — is hidden behind a hover-only "Shop" dropdown. For a 27-SKU store this is a self-inflicted discovery problem.
- Search input exists twice (`.plaay-search-panel__input` × 2, both hidden) and is not surfaced in the bottom nav (which is Home / Menu / Cart / Account).
- Z-index is unmanaged: `2, 9, 10, 16, 20, 9010, 9020, 9030, 9400, 16000` across header, drawers, sheets, cookie banner and search.

### 3.5 PDP

Good: the sticky ATC exists, FAQs are on-page (21 blocks), social proof section, recently-viewed, delivery promise.

Problems:
- Primary "Add to bag" sits at **y 699 px**, effectively at/below the fold, and the gallery is only 300 px tall.
- **4 of 11 sections render at 0 px height** (two empty `apps` sections, recently-viewed, one more) — they still cost markup, requests and script.
- The sticky bar duplicates the price and purchase mode with **inline styles on every element** (`style="padding:10px 16px 14px"`, `style="font-size:11px;letter-spacing:0.12em…"`), which cannot be themed, cached or overridden.
- 113 images on a single product page.

### 3.6 Homepage flow

Current mobile order and heights:

| # | Section | Height |
|---|---|---|
| 1 | Hero carousel (6 slides, 2 unique images) | 618 px |
| 2 | Marquee | 64 px |
| 3 | Featured products — "Newest" (8 items) | 1,424 px |
| 4 | Featured products — "Bestsellers" (5 items) | 1,120 px |
| 5 | Marquee (again) | 42 px |
| 6 | Shop by category | 589 px |
| 7 | Richtext | 66 px |
| 8 | App block (Reelfy UGC) | 425 px |
| 9 | Featured products — "Variety packs" | 626 px |
| 10 | Social proof / testimonials | 489 px |
| 11–15 | Instafeed + 4 empty sections | 40 px |

- **2,544 px of product grid before any story, proof or reason to believe.**
- The hero carousel has **6 slides but only 2 unique banner images**, each loaded immediately (315 KB of banner JPGs on a mobile connection for one visible image).
- Two marquees repeat the same claim set ("No Refined Sugars / 100 % Clean Ingredients / Nutritionist Founded…").
- The "Variety packs" carousel visibly repeats the same 4 products twice.
- 8 of the 23 configured homepage sections are `disabled: true` — dead config that still bloats the template JSON and confuses anyone editing in the customiser.
- Testimonials in `pdp-social-proof` are **hardcoded block text with invented-looking attributions** ("Aisha K. — Verified buyer", "Omar J. — Verified buyer") while Judge.me is installed and holding real reviews. If these are not real customer quotes, that is a consumer-protection risk in the UAE and a trust risk everywhere. **Verify or replace with live Judge.me content.**

---

## 4. Visual design system

### 4.1 There is no design system

`getComputedStyle(document.documentElement)` returns **no CSS custom properties** for colour, spacing, type or radius. Every value is hardcoded at the point of use, in three places: `assets/bundle.theme.css` (100 KB), `assets/custom.css` (118 KB), and **31 sections that emit their own `{% style %}` block**.

Symptoms measured on the live homepage:

| Dimension | Count in use | Consequence |
|---|---|---|
| Font sizes | 16 distinct, including 12.6 px, 10.4 px, 18.24 px | No type scale; unrounded values are em-inheritance artefacts |
| Border radii | 9 distinct: 3, 8, 12, 14, 18, 24 px, 50 %, 999px, 9999px | Cards, buttons and badges disagree with each other |
| Yellows | 2: `#F9C61D` and `#F5C320` | Visible inconsistency between components |
| Breakpoints | 21 distinct in `custom.css` alone: 375, 479, 600, 639, 640, 749, 767, 768, 1023, 1024, 1279, 1280, 1298, 1535, 1536, 1600 | Off-by-one gaps between `max-width: 767px` and `min-width: 768px` rules that use different base values |
| `!important` | **136** in `custom.css` (6 in `bundle.theme.css`) | Specificity war; safe changes become unsafe |
| `prefers-reduced-motion` | **0 occurrences in any stylesheet** | Accessibility failure once motion is added |

### 4.2 Brand compliance — colour

From `PLAAY GUIDELINES 2024 v2.pdf` p.16–18 versus what the site actually renders:

| Role | Brand book | Site renders | Delta |
|---|---|---|---|
| Primary yellow | **`#FFB600`** (Pantone 7549C) | `#F9C61D` (and `#F5C320`) | Site yellow is lighter and greener. Not the brand yellow. |
| Primary navy | **`#081D48`** (Pantone 2768C) / `#071D49` | `#021D49` | Close but wrong; site navy is darker/bluer |
| Accent purple | **`#A028B4`** / `#9B26B6` (Pantone 2592C) | `#813D87` | Site purple is desaturated and muddy — reads dusty, not vibrant |
| SKU palette | Orange `#FF9115`, amber `#FFB819`/`#FFB81C`, green `#46A140`/`#47A23F`, teal `#00BCB4`, pink `#FF3EB5`, lime `#E0E622`, blue `#213B8B`, yellow `#F9E547` | **None used on the site** | The entire flavour-colour system — the thing that makes Plaay packaging recognisable — is absent from the website |

The guidelines describe the palette as *"bright, bold hues… lively and inviting… positivity and a splash of excitement."* The live site renders a duller, flatter version of it and throws away the flavour colours entirely.

### 4.3 Brand compliance — typography

| Brand book | Site |
|---|---|
| **GT Walsheim Pro Condensed** — Regular / Medium / Bold / Black (p.8) | Non-condensed Walsheim cuts: `walsheim-regular`, `-medium`, `-bold`, `-black`, plus `GTWalsheimPro-Regular` |
| Secondary: **Delicious Handrawn** | Not present anywhere |
| Arabic: **Noto Kufi Arabic** | Not present; no Arabic locale on a UAE store |

Additional font problems:

- **`GTWalsheimPro-Bold` is used by 10 elements but never declared in `@font-face`** (`snippets/head.fonts.liquid` declares only the Regular). Those elements silently fall back to a system font.
- Each weight is registered as a **separate `font-family`** rather than one family with `font-weight` values, so `font-weight: bold` does nothing and the browser cannot synthesise or subset intelligently.
- **All five fonts are `<link rel="preload">`d on every page** (~205 KB) — they compete with the LCP image for bandwidth on the critical path.
- `walsheim-regular.static.woff2` is **downloaded twice** (once with a `?v=` cache-buster from `head.fonts`, once without, from a stylesheet `url()`).

### 4.4 Brand devices that exist in the guidelines and nowhere on the site

These are the assets that would make the site unmistakably Plaay, and none of them ship:

1. **"WARNING — Highly Indulgent"** sticker/seal (guidelines p.13, 48, 58, 66, 67) — a signature device across packaging, banners and merch.
2. **"100 % CLEAN"** roundel (p.12, 47, 53, 69).
3. **The horizontal line** — described in the guidelines as *"a simple design element that is ownable and helps tell different stories"* (p.41), with a whole photography direction built around the colour split (p.62). Completely absent.
4. **Doodle illustration style** — *"adds a playful and approachable touch"* (p.11, 70).
5. **The tagline system** — `NO GUILT. ALL PLAAY.` / `ALL IN. ALL PLAAY.` with a swappable middle word "thoughtfully chosen to match the context" (p.22–23). The site never uses it once.
6. **"Chocolate Snack-Hack"** descriptor lockup (p.9–10). Partially used in section headings only.
7. **Bubbles motif and blooper end-cards** (Brand Pillars p.17) — the standard visual signature across all content.

---

## 5. Brand strategy gap

This is the finding with the highest ceiling.

**What the brand book says Plaay is:**
> "Plaay is not being built like a typical chocolate brand… Most chocolate brands compete on taste, ingredients, health claims, macros, calories. Those are product conversations. But Plaay is built on a deeper human insight… Women do not struggle with chocolate itself. They struggle with how they feel about chocolate."
> "Plaay is not a healthy chocolate brand. Plaay is a mindset brand. Chocolate is simply the vehicle. The real promise is: **emotional freedom in edible form.**"

**What the website says:**
> "No Refined Sugars · 100 % Clean Ingredients · Nutritionist Founded · Everyday Indulgence · Made in UAE"
> "Fresh slabs. Big flavour. Zero refined sugar."

The site is running the exact "product conversation" the brand book instructs the team to avoid, and none of the five pillars — Emotionally Safe Indulgence, Breaking the Guilt Economy, Plaay Moments, Pleasure With Personality, Founder Perspective — appear anywhere in the customer journey.

**Specific misses:**

- **Founder is invisible.** Rashi Chowdhary — nutritionist, 15 years practising, 455 K community, built the product after her own diagnosis — appears nowhere on the homepage. This is the single most credible, most differentiating and most conversion-relevant asset the brand owns.
- **No "why", only "what".** There is no section that answers *why does this exist* before asking for the sale.
- **Zero emotional copy.** Every heading is a product noun. The brand's own founder lines are ready-made headline copy: *"You don't need to earn chocolate."* / *"Women don't have a sugar problem. They have a guilt problem."* / *"Pleasure doesn't need permission."*
- **Plaay Moments** (the 3:30 pm reset, the post-meeting bite, PMS, late-night Netflix) is a fully-specified content territory and a ready-made homepage section — it doesn't exist.
- **Footer typo:** "So we made chocolate that 100% clean." (missing "is").

---

## 6. Code architecture

### 6.1 Dead weight

| Item | Detail |
|---|---|
| **22 unused sections** | `test`, `test-animation-scroll`, `fudge-example`, `shogun-above/below/helper`, `play_vs_them`, `media_text`, `why-plaay`, `choose-flavour-sec`, `cu-faq`, `pdp-ingredients`, `plaay-frequently-bought`, `featured_products_v2`, `custom-featured-product-v2`, `product_upsell_media`, `review_gif_video_product`, `byob-custom-messages`, `gifting-main-product`, `main-index`, `main-page-contact`, `main-product` |
| **4 near-duplicate PDP templates** | `bars-main-product` (1,201 lines), `truffle-main-product` (1,385), `main-product` (849), `gifting-main-product` (943) — 4,378 lines where one parameterised section would do. A diff of bars vs truffle shows 1,102 differing lines, i.e. they have already drifted apart. |
| **Animation libraries loaded but barely used** | GSAP + ScrollTrigger + ScrollMagic bundle **510 KB** (used only by the About page's `for-the-geeks-vertical`), anime.js 44 KB, Waypoints 10 KB, canvas-confetti 19 KB, Glide 28 KB (loaded on **every** page via `theme.liquid:128` whether or not a slider exists) |
| **Rebuy** | Smart Cart destroyed at runtime (`theme.liquid:224–229`) but the app still ships 19 requests and 6 stylesheets |
| **Yotpo remnants** | `snippets/product-tile.liquid:223–230` still emits Yotpo review divs; the store now uses Judge.me |
| **Hotjar + BugHerd** | `theme.liquid:135–166` — **BugHerd is a QA annotation tool and should never run on production** |
| **8 disabled homepage sections** | Still stored in `templates/index.json` |

### 6.2 Structural problems

**`layout/theme.liquid`**
- Two competing cart-button handlers: one attached at parse time (`:168–194`), and a second (`:225–252`) that **clones and replaces the cart button 1,000 ms after `load`**, destroying the first. Between DOMContentLoaded and load+1 s the behaviour differs from after. This is a race condition with a `setTimeout` for a fuse.
- Three seasonal countdown snippets render on **every page of the site**: `plaay-eid-countdown-js`, `plaay-fd-countdown-js`, `plaay-summer-countdown-js` (`:117–119`). All three campaigns have expired (Eid 1 Jul, Father's Day 22 Jun, Summer 1 Aug 2026).
- `glide.static.min.js` is loaded unconditionally.

**Hardcoded campaign dates in 9 files** — `snippets/cart-drawer-content.liquid`, `plaay-eid-countdown-js`, `plaay-fd-countdown-js`, `plaay-fd-countdown`, `plaay-fd-offer-strip`, `plaay-summer-cart`, `plaay-summer-countdown-js`, `plaay-summer-countdown`, `product-tile`. Every campaign requires a code deploy, and every expired campaign leaves code behind.

**`snippets/product-tile.liquid`** (rendered 20–27× per page)
- Emits a `{% style %}` block **per tile**, re-declaring the same global `.product_tile::after`, `.product_flip_back`, `.product_flip_front` rules every time. This is the main driver of the **850 KB HTML document**.
- `<select id="productSelect">` — a **duplicate DOM id on every tile** (invalid HTML, breaks `getElementById`, confuses assistive tech).
- Renders **two `<img>` per tile** (featured + secondary hover image) on mobile, where hover does not exist — this is why the homepage carries 219 images and the PLP 235.
- Product title is output twice per tile (once inside a `.text-0` link, once as the visible `<p>`), so screen readers announce it twice.
- Dead loop: `{% for collection in product.collections %}{% if … contains 'Limited Editions' %}{% endif %}{% endfor %}` with an empty body — an expensive `product.collections` call for nothing.
- Typo class `flex justify flex-col` (`justify` is not a Tailwind class).

**`sections/two-sections-hero.liquid`**
- Hero images use `img_url: 'master'` (`:162`, `:167`) — **no width parameter, no `srcset`, no `width`/`height`, no `fetchpriority="high"`**. The mobile banner is served at 1000 × 1648 to a 375 px viewport.
- `alt` falls back to `title_mobile | default: title`, which are blank when the banner is a full-bleed image — so **the LCP image has an empty alt**.
- 6 slides configured for 2 unique creatives.

**CSS**
- 218 KB of render-blocking theme CSS (`bundle.theme.css` + `custom.css`) before any app CSS.
- 136 `!important` declarations.
- Tailwind utility classes and hand-written CSS and per-section `{% style %}` blocks and inline `style=""` attributes, all fighting (`main-returns.liquid` has 37 inline style attributes, `bars-main-product` 31, `main-shipping` 29).

---

## 7. Accessibility

| Issue | Count / location |
|---|---|
| No `<h1>` | Homepage, `/collections/all` |
| Images without `alt` | 85 on homepage, 33 on PDP |
| Images without `width`/`height` | 77 on homepage (CLS risk) |
| Interactive elements with no accessible name | 13 on homepage |
| Inputs with no label, `aria-label` or placeholder | 17 on homepage |
| Tap targets < 44 px | 86 of 163 |
| Text below 12 px | 8 px, 9 px, 10 px, 11 px in production |
| Contrast failures | Price text 2.68:1 (needs 4.5:1) |
| `prefers-reduced-motion` support | none |
| Duplicate DOM ids | `productSelect` on every product tile |
| Focus management | Two competing mobile menus; no visible focus-trap convention; z-index stack unmanaged |
| Skip link | none |
| Arabic / RTL | none, on a UAE-first store |

---

## 8. SEO & content hygiene

- **No `<h1>`** on homepage or collection pages.
- `<title>` on `/collections/all` is literally **"Products"** — no brand, no keyword.
- Hero headline copy exists only inside a JPG; the crawler sees no text above the first product grid.
- Empty `alt` on the highest-value images (hero banners).
- 4,269 DOM nodes and 850 KB HTML on the homepage will hurt crawl efficiency.
- No structured data audit performed here, but `Product`, `AggregateRating`, `FAQPage`, `Organization` and `BreadcrumbList` should be verified given Judge.me and the on-page FAQs.
- Footer copy error: *"So we made chocolate that 100% clean."*
- Duplicate product-title text in tiles reads as keyword stuffing to a crawler.

---

## 9. Reimagining the experience

This section is the "what should it be" — grounded in the brand book, costed against performance.

### 9.1 Design system foundation (prerequisite for everything else)

Ship one token file, then refactor toward it. Nothing below is possible cleanly without this.

```css
:root{
  /* Brand — from PLAAY GUIDELINES 2024 v2, p.16–18 */
  --plaay-yellow:#FFB600;      /* Pantone 7549C — the real one */
  --plaay-navy:#081D48;        /* Pantone 2768C */
  --plaay-purple:#A028B4;      /* Pantone 2592C */
  --plaay-cream:#FFF7DD;

  /* Flavour system — currently unused, should drive PDP + category theming */
  --f-triple:#9B26B6; --f-peanut:#FFB600; --f-pistachio:#46A140;
  --f-caramel:#FF9115; --f-almond:#A028B4; --f-cookies:#00BCB4;
  --f-mocha:#213B8B;  --f-salted:#FFB81C; --f-limited:#FF3EB5;

  /* Type scale — one ratio, 8 steps, replaces the current 16 ad-hoc sizes */
  --t-xs:0.75rem; --t-sm:0.875rem; --t-base:1rem; --t-lg:1.125rem;
  --t-xl:1.375rem; --t-2xl:1.75rem; --t-3xl:2.25rem; --t-4xl:clamp(2.5rem,7vw,4.5rem);

  /* Spacing — 4px base, 8 steps */
  --s-1:.25rem; --s-2:.5rem; --s-3:.75rem; --s-4:1rem;
  --s-6:1.5rem; --s-8:2rem; --s-12:3rem; --s-16:4rem;

  /* Radius — 3 values, not 9 */
  --r-sm:8px; --r-md:16px; --r-pill:999px;

  /* Elevation */
  --e-1:0 1px 2px rgba(8,29,72,.06);
  --e-2:0 6px 20px rgba(8,29,72,.10);

  /* Motion */
  --d-1:120ms; --d-2:200ms; --d-3:320ms; --d-4:480ms; --d-5:720ms;
  --ease-out:cubic-bezier(.22,1,.36,1);      /* calm confidence */
  --ease-pop:cubic-bezier(.34,1.56,.64,1);   /* the playful overshoot */
}
```

Plus: one `@font-face` family (`Plaay Sans` → GT Walsheim Pro **Condensed**, weights 400/500/700/900), one accent family (Delicious Handrawn) loaded **only** where used, and Noto Kufi Arabic behind an `:lang(ar)` rule.

### 9.2 Motion & interaction system — "Plaay Motion"

**Design principle, derived from the brand book:** *calm confidence, not outrage; playful, not chaotic; effortless, not trying too hard.* Motion should feel like a confident person moving through a room — nothing bounces for attention, but everything has weight and a little wit.

**Performance rule:** the entire motion system must ship in **≤ 6 KB CSS + ≤ 3 KB JS**, animate only `transform` and `opacity`, and be **net-negative** on bundle size because it lets us delete GSAP + ScrollMagic + ScrollTrigger + anime.js + Waypoints (**≈ 615 KB**).

#### The primitive: one reveal utility

```css
/* Progressive enhancement: scroll-driven where supported, IO fallback elsewhere */
@media (prefers-reduced-motion:no-preference){
  [data-reveal]{opacity:0;transform:translate3d(0,var(--reveal-y,16px),0)}
  [data-reveal].is-in{opacity:1;transform:none;
    transition:opacity var(--d-4) var(--ease-out),transform var(--d-4) var(--ease-out)}
  [data-reveal-stagger]>*{transition-delay:calc(var(--i,0)*60ms)}
}
@supports (animation-timeline:view()){
  @media (prefers-reduced-motion:no-preference){
    [data-reveal]{animation:reveal linear both;animation-timeline:view();animation-range:entry 10% cover 28%}
  }
}
@keyframes reveal{from{opacity:0;transform:translate3d(0,16px,0)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){[data-reveal]{opacity:1!important;transform:none!important;animation:none!important}}
```

~40 lines of JS for the IntersectionObserver fallback, capped at 6 items per stagger group so a 27-product grid never turns into a slow drip.

#### Section-by-section motion map

| # | Where | Effect | Why it's on-brand | Cost |
|---|---|---|---|---|
| 1 | Global | **Cross-document view transitions** (`@view-transition{navigation:auto}`) — the hero image morphs into the PDP gallery image on tap | Removes the white flash between pages; makes a multi-page Shopify site feel like an app | 2 lines CSS |
| 2 | Header | Auto-hide on scroll-down, reveal on scroll-up, solidify with a blur backdrop after 80 px | Buys back 54 px of the mobile viewport | ~15 lines |
| 3 | Hero | Real text headline with a **per-line clip reveal** (mask-based, 60 ms stagger), image with slow 1.00 → 1.06 scale over 12 s, and a −8 % parallax drift on scroll | Restores the `h1`, gives the brand a voice, adds depth without weight | CSS only |
| 4 | Section joins | **The horizontal line device** as a scroll-driven wipe: a 3 px brand line draws left→right (`scaleX 0→1`) as a section enters, and the colour block above/below splits along it | This is the ownable device from p.41 of the guidelines, finally used | CSS only |
| 5 | Everywhere | **Bubbles** — 6–8 CSS-only circles drifting at different speeds behind hero and story sections, `will-change:transform`, paused off-screen | The standard visual cue named in the Pillars doc (p.17) | ~1 KB |
| 6 | Product grids | Staggered reveal (16 px rise, 60 ms apart, max 6), image micro-zoom on press, and the tile card lifting 2 px with a shadow on hover | Makes browsing feel alive without a carousel | CSS only |
| 7 | Add to bag | Button → spinner → **checkmark morph**, a short **confetti burst in the flavour colour**, cart icon spring-bounce, drawer slide-in, `navigator.vibrate(8)` | "Pleasure with personality." canvas-confetti is *already bundled* — currently unused on this path | 0 new KB |
| 8 | Cart drawer | Free-shipping progress bar fills with a spring; crossing AED 75 triggers a colour flip + one confetti pop + copy change | Turns a threshold into a small win | ~20 lines |
| 9 | PDP | Sticky bar (64 px) springs up once the main ATC scrolls past; gallery gets scroll-snap + a thumbnail rail + pinch-zoom | Fixes both the fold problem and the 146 px chrome problem | ~30 lines |
| 10 | PDP | Restore the **ingredient flip** already half-built in `product-tile.liquid:27–41` (currently commented out) as a tap-to-flip 3D card | Product truth without a wall of text | already written |
| 11 | Proof | **Count-up numbers** on enter: 455 K community, 4.9★, 5× growth, 13 % category share | Real numbers from the brand deck, currently unused | ~15 lines |
| 12 | Signature | The **"WARNING — Highly Indulgent"** seal as a slowly rotating sticker (360° / 20 s, paused under reduced-motion), pinned to indulgence-led imagery | The brand's most distinctive device, absent from the site | CSS only |
| 13 | Marquee | Speed subtly linked to scroll velocity (clamped), pausing on touch | The marquee already exists; this makes it feel responsive rather than decorative | ~10 lines |
| 14 | Micro | Quantity stepper spring, wishlist heart burst, yellow focus rings, toast on add, skeleton shimmer on lazy tiles | Consistency of feel across every touch | ~1 KB |
| 15 | Global | **Full `prefers-reduced-motion` kill switch**, plus `@media (update:slow)` to disable parallax on low-end devices | Currently zero support | 1 block |

**Scroll effects to explicitly avoid:** full-page scroll-jacking, horizontal-scroll story sections on mobile, pinned sections that hold the viewport, and video autoplay above the fold. They fight the user, and on a 4 s-blocked main thread they will jank.

### 9.3 Page-level redesign proposals

**Homepage — proposed mobile order**

1. **Hero** — real `<h1>` in text. Headline from the brand's own voice: *"No guilt. All Plaay."* with the swappable middle word. One image, `fetchpriority="high"`, sized for the viewport. One CTA.
2. **The claim strip** — 4 icons, brand flavour colours, 88 px tall (replaces one marquee).
3. **Shop by craving, not by category** — "3:30 pm reset", "Post-workout", "Netflix o'clock", "PMS kit". This is the *Plaay Moments* pillar rendered as merchandising, and it makes 27 SKUs shoppable by intent.
4. **Bestsellers** — 6 items max, 2-column, one-tap add.
5. **The founder** — Rashi, 30 s video or portrait + one truth-bomb line + "why I made this". The highest-trust asset on the site, currently unused.
6. **The guilt break-up** — one full-bleed emotional statement using the horizontal-line device. *"You don't need to earn chocolate."*
7. **What's inside / what's not** — the clean-ingredient argument, told visually (the doodle style), not as a marquee.
8. **Real reviews** — live Judge.me, with photos, replacing the hardcoded testimonials.
9. **UGC / Instafeed** — kept, but lazy-mounted below the fold.
10. **Newsletter + footer.**

Target: **< 4,000 px** on mobile (from 6,430 px), with the founder and the "why" both above 3,000 px.

**Collection page**
- 2-column grid, 12 px gutter, compact tile.
- Sticky filter/sort bar (Type · Flavour · Pack size · Price · Sort), with the flavour filter using the brand SKU colours as swatches.
- Collection eyebrow: title, one-line description, product count.
- Real `h1` and a proper `<title>`.
- Quick-add without leaving the grid.
- Target: **< 6,000 px** for 27 products (from 13,995 px).

**PDP**
- Gallery to 60 vh with snap + thumbnails; price, name, rating and ATC all above 700 px.
- Flavour selector as colour swatches from the SKU palette.
- Subscription vs one-time as a two-card choice, not a hidden mode label.
- Delivery promise, returns and Halal/clean badges in one row under the ATC.
- Reviews and FAQ as sticky-tabbed sections, not a 4,405 px scroll.
- Slim sticky bar (64 px) that appears only after the main ATC leaves the viewport.

**Cart / drawer**
- Free-delivery progress to AED 75 with the spring fill.
- One relevant upsell (not an app-injected carousel).
- Trust row: Halal, returns, delivery window.

**Navigation**
- Bottom nav becomes Home · Shop · Search · Cart · Account (Search is currently missing and Menu is redundant with Shop).
- Delete the legacy `.mobile_menu`; keep the bottom sheet only.
- Desktop: surface Bars / Truffles / Variety Packs / Limited Edition as top-level links.

---

## 10. Roadmap

Effort is engineering days for one developer. Impact is my estimate of revenue effect.

### P0 — Do first (≈ 5 days, highest impact per hour)

| # | Action | Effort | Impact |
|---|---|---|---|
| 1 | **Remove BugHerd from production**; gate Hotjar/Clarity/Pixel behind cookie consent | 0.5 d | High (perf + compliance) |
| 2 | **Uninstall / fully remove Rebuy** rather than destroying it at runtime | 0.5 d | High (19 requests, 6 stylesheets) |
| 3 | **Fix hero images**: `image_url: width:` + `srcset` + `width`/`height` + `fetchpriority="high"`; reduce to 2 slides; real `alt` | 0.5 d | High (LCP) |
| 4 | **Add a real `<h1>`** to homepage and collection pages; fix `/collections/all` `<title>` | 0.5 d | High (SEO) |
| 5 | **Collection grid → 2 columns on mobile** | 0.25 d | High (PLP conversion) |
| 6 | **Move the `{% style %}` block out of `product-tile.liquid`** into `custom.css`; drop the duplicate `productSelect` id; drop the second image on mobile; remove the dead `product.collections` loop and Yotpo remnants | 1 d | High (HTML 850 KB → ~200 KB) |
| 7 | **Preload only 2 fonts**, declare one family with weights, fix the missing `GTWalsheimPro-Bold` face, remove the duplicate `walsheim-regular` request | 0.5 d | Medium-High |
| 8 | **Delete the expired campaign snippets** (Eid / Father's Day / Summer) from `theme.liquid` and move sale windows into theme settings | 0.5 d | Medium |
| 9 | **Slim the PDP sticky bar** 146 px → 64 px; move the cookie banner to the bottom | 0.5 d | Medium-High |
| 10 | **Fix the double cart-button handler race** in `theme.liquid` | 0.25 d | Medium (reliability) |

Expected outcome: HTML ~200 KB, requests ~150, TBT roughly halved, LCP materially better on mobile.

### P1 — Structural (≈ 8 days)

11. Ship the design-token file; migrate colours to the **real brand hexes**; collapse 16 font sizes → 8, 9 radii → 3, 21 breakpoints → 4. (2 d)
12. Merge the 4 PDP sections into one parameterised `main-product`; delete the 22 unused sections. (2 d)
13. Add filters + sort + collection header to the PLP. (1.5 d)
14. Load Glide/GSAP/anime/Waypoints only where used; drop GSAP+ScrollMagic entirely once the About page is ported to the new reveal primitive. (1 d)
15. Fix accessibility set: alt text, labels, 44 px targets, min 12 px type, price contrast, skip link, focus management, single mobile menu. (1.5 d)

### P2 — The reimagination (≈ 10 days)

16. Ship **Plaay Motion** (§9.2) as one CSS file + one 3 KB module. (2 d)
17. Rebuild the homepage to the §9.3 order, including the founder section and *Plaay Moments* merchandising. (3 d)
18. PDP redesign: gallery, flavour swatches, subscription cards, tabbed proof. (2 d)
19. Introduce the brand devices: WARNING seal, 100 % CLEAN roundel, horizontal-line section joins, doodles, bubbles, flavour-colour theming. (2 d)
20. Replace hardcoded testimonials with live Judge.me; add Arabic locale + RTL. (1 d)

### Verify before acting

- Are the eight testimonials in `pdp-social-proof` real customer quotes? If not, remove them.
- What app injects `config-security.com`? It is unaccounted for.
- Is Hotjar still actively used, or can it go alongside Clarity (two session recorders is one too many)?
- Confirm the licensed weights of GT Walsheim Pro Condensed for web use before swapping typefaces.

---

## Appendix A — Files that carry the most risk

| File | Lines | Why it matters |
|---|---|---|
| `layout/theme.liquid` | 257 | Cart handler race, 3 expired countdowns, BugHerd, unconditional Glide |
| `snippets/product-tile.liquid` | 279 | Rendered 20–27×/page; per-tile `<style>`, duplicate ids, double images |
| `sections/two-sections-hero.liquid` | 814 | LCP element; `img_url:'master'`, empty alt, 6 slides / 2 images |
| `sections/bars-main-product.liquid` | 1,201 | One of 4 near-duplicate PDP sections |
| `sections/truffle-main-product.liquid` | 1,385 | Diverged 1,102 lines from `bars-` |
| `snippets/mobile-bottom-nav.liquid` | 708 | Good implementation, but duplicates the legacy `.mobile_menu` |
| `sections/header.liquid` | 639 | Legacy mobile menu, duplicate search panels, z-index chaos |
| `assets/custom.css` | 118 KB | 136 `!important`, 21 breakpoints, no tokens |
| `snippets/head.fonts.liquid` | 40 | 5 preloads, missing Bold face, family-per-weight |
| `templates/index.json` | — | 8 disabled sections still stored |

## Appendix B — Brand colour reference (from the guidelines)

| Name | Hex | Pantone | Currently on site? |
|---|---|---|---|
| Plaay Yellow | `#FFB600` | 7549C | No — site uses `#F9C61D` / `#F5C320` |
| Plaay Navy | `#081D48` / `#071D49` | 2768C | Approximately — site uses `#021D49` |
| Plaay Purple | `#A028B4` / `#9B26B6` | 2592C / 1495C | No — site uses `#813D87` |
| Orange | `#FF9115` | 1495C | No |
| Amber | `#FFB819` / `#FFB81C` | 1235C | No |
| Green | `#46A140` / `#47A23F` | 7738C | No |
| Teal | `#00BCB4` | 3262C | No |
| Pink | `#FF3EB5` | 806C | No |
| Lime | `#E0E622` | 388C | No |
| Blue | `#213B8B` | 7738C | No |
| Light Yellow | `#F9E547` | 106C | No |
