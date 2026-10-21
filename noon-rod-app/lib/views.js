// Server-rendered HTML for the staff dashboard and the customer tracking page.

import { isCashOnDelivery } from './mapping.js';

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const BASE_CSS = `
  :root { --navy: #081D48; --bg: #f7f5f0; --card: #fff; --muted: #5b6478; --line: #e4e0d6; --ok: #1f7a4d; --warn: #b45309; --bad: #b42318; }
  @media (prefers-color-scheme: dark) {
    :root { --navy: #c9d4f2; --bg: #0e1424; --card: #172036; --muted: #9aa4bd; --line: #26314d; --ok: #5fd39a; --warn: #f5b25c; --bad: #ff8a80; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; background: var(--bg); color: var(--navy); }
  main { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: var(--muted); font-size: 13px; }
`;

function money(set) {
  const m = set?.shopMoney;
  return m ? `${m.currencyCode} ${Number(m.amount).toFixed(2)}` : '';
}

function statusBadge(order, labels) {
  if (order.cancelledAt) return '<span class="b bad">Order cancelled</span>';
  if (order.noon.error && !order.noon.taskNr) return '<span class="b bad">Booking failed</span>';
  const s = order.noon.status;
  if (!s) return '<span class="b">Not dispatched</span>';
  const tone = s === 'delivered' ? 'ok' : ['undelivered', 'cancelled'].includes(s) ? 'bad' : 'warn';
  return `<span class="b ${tone}">${esc(labels[s] || s)}</span>`;
}

function actions(order) {
  if (order.cancelledAt) return '';
  const s = order.noon.status;
  const form = (action, label, cls = '') =>
    `<form method="post"><input type="hidden" name="order" value="${esc(order.legacyResourceId)}"><input type="hidden" name="action" value="${action}"><button class="${cls}" ${action === 'cancel' ? `onclick="return confirm('Cancel the noon rider for ${esc(order.name)}? Cancellations on production are charged.')"` : ''}>${label}</button></form>`;
  if (!order.noon.taskNr || ['cancelled', 'undelivered'].includes(s)) return form('dispatch', order.noon.taskNr ? 'Book again' : 'Dispatch');
  if (['created', 'pending_assignment', 'assigned', 'arrived_at_pickup_location'].includes(s)) return form('cancel', 'Cancel rider', 'ghost');
  return '';
}

function connectionPanel(c) {
  if (!c) return '';
  const button = `<form method="post"><input type="hidden" name="action" value="connect"><button>Connect Shopify</button></form>`;
  if (!c.ok) return `<div class="panel bad-b"><strong>Shopify is not connected.</strong><div class="err">${esc(c.error)}</div></div>`;
  const problems = [];
  if (c.missingScopes.length) problems.push(`The app is missing permissions: <code>${c.missingScopes.map(esc).join(', ')}</code>. Add them in the Shopify Dev Dashboard and reinstall.`);
  if (c.ordersError) problems.push(`Could not read orders: ${esc(c.ordersError)}`);
  if (c.missingWebhooks.length) problems.push(`Not yet receiving order notifications (${c.missingWebhooks.map(esc).join(', ')}). Press Connect Shopify.`);
  const head = `Connected to <strong>${esc(c.shop)}</strong> (${esc(c.domain)}) via app “${esc(c.app)}”`;
  if (!problems.length) return `<div class="panel ok-b">${head}</div>`;
  return `<div class="panel warn-b">${head}<ul>${problems.map((p) => `<li>${p}</li>`).join('')}</ul>${c.missingWebhooks.length ? button : ''}</div>`;
}

export function renderDashboard({ orders, cfg, flash, labels, connection }) {
  const env = cfg.noon.baseUrl.includes('noonstg') ? 'STAGING' : 'PRODUCTION';
  const rows = orders
    .map((o) => {
      const a = o.shippingAddress || {};
      const pay = isCashOnDelivery(o, cfg) ? `COD ${money(o.totalOutstandingSet)}` : `Prepaid ${money(o.totalPriceSet)}`;
      return `<tr>
        <td data-l="Order"><strong>${esc(o.name)}</strong><div class="muted">${esc(new Date(o.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Dubai', dateStyle: 'short', timeStyle: 'short' }))}</div></td>
        <td data-l="Customer">${esc(a.name)}<div class="muted">${esc([a.address1, a.city].filter(Boolean).join(', '))}${a.latitude == null ? ' · <b class="bad-t">no map pin</b>' : ''}</div></td>
        <td data-l="Payment">${esc(pay)}</td>
        <td data-l="Rider">${statusBadge(o, labels)}${o.noon.taskNr ? `<div class="muted">Task ${esc(o.noon.taskNr)}</div>` : ''}${o.noon.error ? `<div class="err">${esc(o.noon.error)}</div>` : ''}</td>
        <td data-l="">${actions(o)}</td>
      </tr>`;
    })
    .join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plaay Express · Dispatch</title><meta http-equiv="refresh" content="60">
<style>${BASE_CSS}
  header { display: flex; justify-content: space-between; align-items: end; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
  .env { font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 99px; border: 1px solid currentColor; color: ${env === 'STAGING' ? 'var(--warn)' : 'var(--ok)'}; }
  .panel { background: var(--card); border: 1px solid var(--line); border-left: 4px solid var(--muted); padding: 10px 12px; border-radius: 8px; margin-bottom: 16px; }
  .panel ul { margin: 6px 0 10px; padding-left: 18px; } .ok-b { border-left-color: var(--ok); } .warn-b { border-left-color: var(--warn); } .bad-b { border-left-color: var(--bad); }
  .head-r { display: flex; gap: 10px; align-items: center; }
  .flash { background: var(--card); border: 1px solid var(--line); border-left: 4px solid var(--navy); padding: 10px 12px; border-radius: 8px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  .b { display: inline-block; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 99px; background: var(--line); }
  .b.ok { color: var(--ok); } .b.warn { color: var(--warn); } .b.bad { color: var(--bad); } .bad-t { color: var(--bad); }
  .err { color: var(--bad); font-size: 13px; margin-top: 4px; max-width: 320px; }
  button { font: inherit; font-weight: 600; padding: 7px 14px; border-radius: 8px; border: 1px solid var(--navy); background: var(--navy); color: var(--bg); cursor: pointer; }
  button.ghost { background: transparent; color: var(--navy); }
  form { margin: 0; }
  @media (max-width: 720px) {
    thead { display: none; } table, tbody, tr, td { display: block; width: 100%; }
    tr { border-bottom: 1px solid var(--line); padding: 8px 0; } td { border: 0; padding: 4px 12px; }
    td[data-l]:not([data-l=""])::before { content: attr(data-l); display: block; font-size: 11px; text-transform: uppercase; color: var(--muted); }
  }
</style></head><body><main>
<header><div><h1>Plaay Express dispatch</h1><div class="muted">Orders tagged <code>noon-express</code>. Pack first, then press Dispatch: a rider arrives within minutes.</div></div><div class="head-r">${env === 'STAGING' && connection?.ok ? `<form method="post"><input type="hidden" name="action" value="test-order"><button class="ghost" onclick="return confirm('Create a paid AED 1 test order in the live Shopify store?')">Create test order</button></form>` : ''}<span class="env">noon ${env}</span></div></header>
${flash ? `<div class="flash">${esc(flash)}</div>` : ''}
${connectionPanel(connection)}
<table><thead><tr><th>Order</th><th>Customer</th><th>Payment</th><th>Rider</th><th></th></tr></thead>
<tbody>${rows || '<tr><td colspan="5" class="muted">No express orders yet.</td></tr>'}</tbody></table>
<p class="muted">Pickup point <code>${esc(cfg.noon.outletCode || 'not set')}</code> · refreshes every minute</p>
</main></body></html>`;
}

// Customer-facing "Plaay Express" tracking page, styled after shopplaay.com.
export function renderTrackingPage({ token }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Plaay Express · Track your order</title>
<meta name="theme-color" content="#081D48">
<meta name="robots" content="noindex">
<link rel="icon" href="/plaay-logo.png">
<link rel="preload" href="/fonts/walsheim-black.static.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<style>
  @font-face { font-family: walsheim; src: url(/fonts/walsheim-regular.static.woff2) format("woff2"); font-weight: 400; font-display: swap; }
  @font-face { font-family: walsheim; src: url(/fonts/walsheim-bold.static.woff2) format("woff2"); font-weight: 700; font-display: swap; }
  @font-face { font-family: walsheim; src: url(/fonts/walsheim-black.static.woff2) format("woff2"); font-weight: 900; font-display: swap; }
  :root {
    --navy: #081D48; --navy-rgb: 8 29 72; --yellow: #FFB600; --cream: #FFF7DD; --bg: #FFFDF7;
    --muted: rgba(8, 29, 72, .68); --line: rgba(8, 29, 72, .12); --ok: #46A140; --bad: #E5484D;
    --ease-pop: cubic-bezier(.34, 1.56, .64, 1); --ease-out: cubic-bezier(.22, 1, .36, 1);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--navy); }
  body { font: 400 15px/1.45 walsheim, system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
  a { color: inherit; }

  .strip { background: var(--navy); color: var(--yellow); font-weight: 700; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; overflow: hidden; white-space: nowrap; padding: 9px 0; }
  .strip span { display: inline-block; padding-left: 100%; animation: marquee 22s linear infinite; }
  @media (prefers-reduced-motion: reduce) { .strip span { animation: none; padding-left: 16px; } }
  @keyframes marquee { to { transform: translateX(-100%); } }

  header { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 18px 16px 6px; }
  header img { height: 30px; width: auto; display: block; }
  .badge { background: var(--yellow); color: var(--navy); font-weight: 900; font-size: 13px; letter-spacing: .06em; padding: 5px 11px 4px; border-radius: 999px; text-transform: uppercase; transform: rotate(-3deg); box-shadow: 2px 2px 0 var(--navy); }

  main { max-width: 520px; margin: 0 auto; padding: 8px 16px 40px; }
  .card { background: #fff; border: 1.5px solid var(--line); border-radius: 22px; padding: 20px; margin-top: 14px; }

  .hero { background: var(--yellow); border: 2px solid var(--navy); box-shadow: 4px 4px 0 var(--navy); position: relative; overflow: hidden; }
  .hero.done { background: var(--cream); }
  .hero.bad { background: #fff; }
  .order-no { font-weight: 700; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; opacity: .75; }
  h1 { font-weight: 900; font-size: clamp(30px, 9vw, 40px); line-height: .98; letter-spacing: -.01em; margin: 8px 0 10px; text-transform: uppercase; }
  .sub { font-size: 16px; line-height: 1.4; margin: 0; max-width: 34ch; }
  .skeleton { background: rgba(var(--navy-rgb) / .12); border-radius: 8px; color: transparent !important; }

  .steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 18px; }
  .step { font-weight: 700; font-size: 11px; letter-spacing: .03em; text-transform: uppercase; opacity: .45; }
  .step i { display: block; height: 7px; border-radius: 99px; background: rgba(var(--navy-rgb) / .18); margin-bottom: 7px; position: relative; overflow: hidden; }
  .step.on { opacity: 1; } .step.on i { background: var(--navy); }
  .step.now i::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,.7), transparent); animation: shimmer 1.4s infinite; }
  @keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }

  #map { height: 300px; border-radius: 22px; border: 1.5px solid var(--line); margin-top: 14px; display: none; z-index: 0; }
  .pin-rider { width: 40px; height: 40px; border-radius: 50%; background: var(--yellow); border: 3px solid var(--navy); display: grid; place-items: center; font-size: 20px; box-shadow: 0 4px 12px rgba(8,29,72,.3); }
  .pin-home { width: 36px; height: 36px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: var(--navy); display: grid; place-items: center; box-shadow: 0 4px 12px rgba(8,29,72,.3); }
  .pin-home span { transform: rotate(45deg); font-size: 16px; }
  .pulse { position: absolute; inset: -10px; border-radius: 50%; border: 3px solid var(--yellow); animation: pulse 1.8s var(--ease-out) infinite; }
  @keyframes pulse { from { transform: scale(.6); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }

  .rider { display: flex; align-items: center; gap: 14px; }
  .avatar { width: 52px; height: 52px; flex: none; border-radius: 50%; background: var(--yellow); border: 2px solid var(--navy); display: grid; place-items: center; font-weight: 900; font-size: 22px; }
  .rider .who { flex: 1; min-width: 0; }
  .label { font-weight: 700; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
  .name { font-weight: 700; font-size: 18px; }
  .btn { display: inline-flex; align-items: center; gap: 8px; text-decoration: none; font-weight: 700; font-size: 15px; padding: 11px 18px; border-radius: 999px; background: var(--navy); color: #fff; border: 0; transition: transform .2s var(--ease-pop); }
  .btn:active { transform: scale(.96); }
  .btn.yellow { background: var(--yellow); color: var(--navy); }
  .btn svg { width: 18px; height: 18px; }

  h2 { font-weight: 900; font-size: 18px; text-transform: uppercase; margin: 0 0 10px; letter-spacing: .01em; }
  .items { list-style: none; margin: 0; padding: 0; }
  .items li { display: flex; gap: 10px; padding: 8px 0; border-top: 1px dashed var(--line); font-weight: 700; }
  .items li:first-child { border-top: 0; }
  .qty { min-width: 34px; height: 26px; border-radius: 99px; background: var(--cream); display: grid; place-items: center; font-size: 13px; }

  .help { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .help p { margin: 2px 0 0; color: var(--muted); font-size: 14px; }

  footer { text-align: center; padding: 26px 16px 40px; color: var(--muted); font-size: 13px; }
  footer img { height: 20px; opacity: .9; display: block; margin: 0 auto 10px; }
  footer a { font-weight: 700; color: var(--navy); }

  .confetti { position: absolute; inset: 0; pointer-events: none; }
  .confetti b { position: absolute; top: -12px; width: 8px; height: 14px; border-radius: 2px; animation: fall 2.6s var(--ease-out) forwards; }
  @keyframes fall { to { transform: translateY(260px) rotate(540deg); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .confetti { display: none; } .step.now i::after, .pulse { animation: none; } }
  [hidden] { display: none !important; }
</style></head><body>
<div class="strip" aria-hidden="true"><span>Plaay Express ✦ Clean chocolate, delivered fast ✦ Zero refined sugar ✦ Nutritionist founded ✦ Plaay Express ✦ Clean chocolate, delivered fast</span></div>
<header><img src="/plaay-logo.png" alt="Plaay" width="80" height="30"><span class="badge">Express</span></header>
<main>
  <section class="card hero" id="hero" aria-live="polite">
    <div class="order-no" id="orderNo"><span class="skeleton">Order #00000</span></div>
    <h1 id="headline"><span class="skeleton">Loading…</span></h1>
    <p class="sub" id="sub"><span class="skeleton">Fetching the latest from your rider</span></p>
    <div class="steps" id="steps">
      <div class="step"><i></i>Packed</div><div class="step"><i></i>Rider</div><div class="step"><i></i>On the way</div><div class="step"><i></i>Delivered</div>
    </div>
  </section>

  <div id="map" role="img" aria-label="Map showing your rider and delivery address"></div>

  <section class="card rider" id="riderCard" hidden>
    <div class="avatar" id="avatar">P</div>
    <div class="who"><div class="label">Your Plaay Express rider</div><div class="name" id="riderName"></div></div>
    <a class="btn yellow" id="callBtn" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>Call</a>
  </section>

  <section class="card" id="itemsCard" hidden>
    <h2>Your order</h2>
    <ul class="items" id="items"></ul>
  </section>

  <section class="card help">
    <div><div class="name">Need a hand?</div><p>Our team is on WhatsApp.</p></div>
    <a class="btn" id="waBtn" href="https://wa.me/971569969522" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.7-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3z"/></svg>WhatsApp us</a>
  </section>
</main>
<footer>
  <img src="/plaay-logo.png" alt="Plaay" width="54" height="20">
  Clean chocolate, made in the UAE.<br>
  <a href="https://shopplaay.com" target="_blank" rel="noopener">Shop more at shopplaay.com</a> · <a href="https://instagram.com/shopplaay" target="_blank" rel="noopener">@shopplaay</a><br>
  <span style="opacity:.7">Delivery powered by noon</span>
</footer>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
  const token = ${JSON.stringify(token)};
  const COPY = {
    not_dispatched: ['We’ve got your order', 'We’re packing your chocolate right now. We’ll call a rider the moment it’s ready.', 1],
    created: ['Finding your rider', 'Your order is packed. We’re matching it with the nearest rider.', 1],
    pending_assignment: ['Finding your rider', 'Your order is packed. We’re matching it with the nearest rider.', 1],
    assigned: ['Rider assigned', '{name} is heading to Plaay to collect your order.', 2],
    arrived_at_pickup_location: ['Picking it up', '{name} is at Plaay collecting your chocolate.', 2],
    picked_up: ['On its way!', '{name} has your order and is heading to you. Keep your phone close.', 3],
    arrived_at_delivery: ['Knock knock', '{name} is outside. Time for chocolate.', 3],
    delivered: ['Delivered. Enjoy!', 'Clean chocolate, zero guilt. Share the moment and tag @shopplaay.', 4],
    undelivered: ['We couldn’t deliver', 'Sorry about that. Our team will reach out to sort it, or message us on WhatsApp.', 0],
    cancelled: ['Delivery cancelled', 'This express delivery was cancelled. Questions? We’re on WhatsApp.', 0],
  };
  const FLAVOURS = ['#FFB600', '#A028B4', '#00BCB4', '#FF3EB5', '#46A140', '#FF9115', '#213B8B'];
  const $ = (id) => document.getElementById(id);
  let map, riderMarker, dropMarker, lastStatus;

  function confetti() {
    const box = document.createElement('div'); box.className = 'confetti';
    for (let i = 0; i < 40; i++) {
      const b = document.createElement('b');
      b.style.left = Math.random() * 100 + '%';
      b.style.background = FLAVOURS[i % FLAVOURS.length];
      b.style.animationDelay = Math.random() * .6 + 's';
      box.appendChild(b);
    }
    $('hero').appendChild(box);
  }

  function icon(html, size) { return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] }); }

  function render(d) {
    const [title, sub, stage] = COPY[d.status] || COPY.not_dispatched;
    const name = d.rider ? d.rider.name : 'Your rider';
    $('orderNo').textContent = 'Order ' + d.order;
    $('headline').textContent = title;
    $('sub').textContent = sub.replace('{name}', name);
    document.title = 'Plaay Express · ' + title;
    const hero = $('hero');
    hero.classList.toggle('done', d.status === 'delivered');
    hero.classList.toggle('bad', ['undelivered', 'cancelled'].includes(d.status));
    document.querySelectorAll('.step').forEach((el, i) => {
      el.classList.toggle('on', i < stage);
      el.classList.toggle('now', i === stage - 1 && stage < 4);
    });
    if (d.status === 'delivered' && lastStatus && lastStatus !== 'delivered') confetti();
    if (d.status === 'delivered' && !lastStatus) confetti();
    lastStatus = d.status;

    const showRider = d.rider && !['delivered', 'undelivered', 'cancelled'].includes(d.status);
    $('riderCard').hidden = !showRider;
    if (showRider) {
      $('riderName').textContent = name;
      $('avatar').textContent = name.trim().charAt(0).toUpperCase() || 'P';
      const call = $('callBtn');
      call.hidden = !d.rider.phone;
      if (d.rider.phone) call.href = 'tel:' + d.rider.phone;
    }

    if (d.items && d.items.length && !$('items').children.length) {
      for (const it of d.items) {
        const li = document.createElement('li');
        const q = document.createElement('span'); q.className = 'qty'; q.textContent = it.quantity + '×';
        const t = document.createElement('span'); t.textContent = it.title;
        li.append(q, t); $('items').appendChild(li);
      }
      $('itemsCard').hidden = false;
    }
    $('waBtn').href = 'https://wa.me/971569969522?text=' + encodeURIComponent('Hi Plaay! Checking on my express order ' + d.order);

    if (!window.L) return;
    const pts = [];
    if (d.drop && d.drop.lat) pts.push([d.drop.lat, d.drop.lng]);
    const riderPt = showRider && d.rider.lat ? [d.rider.lat, d.rider.lng] : null;
    if (riderPt) pts.push(riderPt);
    if (!pts.length) return;
    const el = $('map');
    if (!map) {
      el.style.display = 'block';
      map = L.map(el, { zoomControl: false, attributionControl: true }).setView(pts[0], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(map);
    }
    if (d.drop && d.drop.lat && !dropMarker) {
      dropMarker = L.marker([d.drop.lat, d.drop.lng], { icon: icon('<div class="pin-home"><span>🏠</span></div>', 36), title: 'You' }).addTo(map);
    }
    if (riderPt) {
      if (!riderMarker) riderMarker = L.marker(riderPt, { icon: icon('<div style="position:relative"><div class="pulse"></div><div class="pin-rider">🛵</div></div>', 40), title: name, zIndexOffset: 1000 }).addTo(map);
      riderMarker.setLatLng(riderPt);
    } else if (riderMarker) { riderMarker.remove(); riderMarker = null; }
    if (pts.length > 1) map.fitBounds(pts, { padding: [50, 50], maxZoom: 16 });
  }

  async function refresh() {
    try {
      const r = await fetch('/api/track-data?t=' + encodeURIComponent(token), { cache: 'no-store' });
      if (r.ok) render(await r.json());
    } catch {}
  }
  refresh();
  setInterval(refresh, 15000);
</script></body></html>`;
}
