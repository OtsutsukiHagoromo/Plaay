// Server-rendered HTML for the staff dashboard and the customer tracking page.

import { defaultDeliveryMode, DELIVERY_MODES, isCashOnDelivery, normalizePhone } from './mapping.js';
import { bucket, CANCELLABLE, countByView, filterOrders, VIEWS } from './orders.js';

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const dubaiTime = (d, opts = { dateStyle: 'medium', timeStyle: 'short' }) =>
  d ? new Date(d).toLocaleString('en-GB', { timeZone: 'Asia/Dubai', ...opts }) : '';

// "12 min ago" for recent orders, a date otherwise.
function ago(d) {
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)} h ${mins % 60} min ago`;
  return dubaiTime(d, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function money(set) {
  const m = set?.shopMoney;
  return m ? `${m.currencyCode} ${Number(m.amount).toFixed(2)}` : '';
}

const STAFF_CSS = `
  @font-face { font-family: walsheim; src: url(/fonts/walsheim-regular.static.woff2) format("woff2"); font-weight: 400; font-display: swap; }
  @font-face { font-family: walsheim; src: url(/fonts/walsheim-bold.static.woff2) format("woff2"); font-weight: 700; font-display: swap; }
  @font-face { font-family: walsheim; src: url(/fonts/walsheim-black.static.woff2) format("woff2"); font-weight: 900; font-display: swap; }
  :root { --navy: #081D48; --navy-rgb: 8 29 72; --yellow: #FFB600; --cream: #FFF7DD; --bg: #FFFDF7; --card: #fff;
    --muted: rgba(8, 29, 72, .66); --line: rgba(8, 29, 72, .12); --ok: #2E7D32; --ok-bg: #E7F5E8; --warn: #9A5B00; --warn-bg: #FFF1CC; --bad: #C62828; --bad-bg: #FDECEC; --info: #1D4ED8; --info-bg: #E6EEFF; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 400 15px/1.45 walsheim, system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--navy); -webkit-font-smoothing: antialiased; }
  a { color: inherit; }
  .top { background: var(--navy); color: #fff; }
  .top-in { max-width: 1180px; margin: 0 auto; padding: 12px 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .top img { height: 24px; filter: brightness(0) invert(1); display: block; }
  .top .badge { background: var(--yellow); color: var(--navy); font-weight: 900; font-size: 11px; letter-spacing: .06em; padding: 3px 9px 2px; border-radius: 99px; text-transform: uppercase; }
  .top .title { font-weight: 700; opacity: .9; }
  .top .sp { flex: 1; }
  .env { font-size: 11px; font-weight: 700; letter-spacing: .05em; padding: 3px 9px; border-radius: 99px; border: 1px solid currentColor; }
  .env.stg { color: var(--yellow); } .env.prod { color: #7CE38B; }
  main { max-width: 1180px; margin: 0 auto; padding: 18px 16px 48px; }
  h1 { font-weight: 900; font-size: 26px; margin: 0; letter-spacing: -.01em; }
  .muted { color: var(--muted); font-size: 13px; }
  .flash { background: var(--card); border: 1px solid var(--line); border-left: 4px solid var(--yellow); padding: 10px 12px; border-radius: 10px; margin-bottom: 14px; font-weight: 700; }
  .panel { background: var(--card); border: 1px solid var(--line); border-left: 4px solid var(--muted); padding: 10px 12px; border-radius: 10px; margin-bottom: 14px; font-size: 14px; }
  .panel ul { margin: 6px 0 10px; padding-left: 18px; } .ok-b { border-left-color: var(--ok); } .warn-b { border-left-color: var(--yellow); } .bad-b { border-left-color: var(--bad); }
  .err { color: var(--bad); font-size: 13px; margin-top: 4px; }
  .b { display: inline-block; font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 99px; background: rgba(var(--navy-rgb) / .08); white-space: nowrap; }
  .b.ok { color: var(--ok); background: var(--ok-bg); } .b.warn { color: var(--warn); background: var(--warn-bg); } .b.bad { color: var(--bad); background: var(--bad-bg); } .b.info { color: var(--info); background: var(--info-bg); }
  button, .btn { font: inherit; font-weight: 700; font-size: 14px; padding: 8px 16px; border-radius: 99px; border: 1.5px solid var(--navy); background: var(--navy); color: #fff; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
  button.yellow, .btn.yellow { background: var(--yellow); color: var(--navy); border-color: var(--yellow); }
  button.ghost, .btn.ghost { background: transparent; color: var(--navy); }
  button.danger { background: transparent; color: var(--bad); border-color: var(--bad); }
  form { margin: 0; display: inline; }
  code { font-size: 12px; background: rgba(var(--navy-rgb) / .06); padding: 1px 5px; border-radius: 5px; }
`;

function shell({ cfg, title, body, refresh }) {
  const staging = cfg.noon.baseUrl.includes('noonstg');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Plaay Express</title><meta name="robots" content="noindex"><link rel="icon" href="/plaay-logo.png">
<style>${STAFF_CSS}</style></head><body>
<div class="top"><div class="top-in"><a href="/" aria-label="All orders"><img src="/plaay-logo.png" alt="Plaay" width="64" height="24"></a><span class="badge">Express</span><span class="title">Dispatch</span><span class="sp"></span><span class="env ${staging ? 'stg' : 'prod'}">noon ${staging ? 'STAGING' : 'LIVE'}</span></div></div>
<main>${body}</main>
${refresh ? `<script>
  // Refresh the list every minute unless someone is typing in the search box.
  setInterval(() => { if (document.activeElement?.tagName !== 'INPUT') location.reload(); }, 60000);
</script>` : ''}
</body></html>`;
}

function statusBadge(order, labels) {
  if (order.cancelledAt) return '<span class="b bad">Order cancelled</span>';
  const s = order.noon.status;
  if (order.noon.error && !['delivered', ...CANCELLABLE, 'picked_up', 'arrived_at_delivery'].includes(s)) return '<span class="b bad">Booking failed</span>';
  if (!s) return order.displayFulfillmentStatus === 'FULFILLED' ? '<span class="b">Fulfilled in Shopify</span>' : '<span class="b">Not dispatched</span>';
  const tone = s === 'delivered' ? 'ok' : ['undelivered', 'cancelled'].includes(s) ? 'bad' : ['picked_up', 'arrived_at_delivery'].includes(s) ? 'info' : 'warn';
  return `<span class="b ${tone}">${esc(labels[s] || s)}</span>`;
}

// Dispatch / cancel buttons; `back` is where to return after the action.
// `both` offers Express and 4-hour side by side (order page); otherwise the order's default mode.
function actions(order, back, cfg, { size = '', both = false } = {}) {
  if (order.cancelledAt) return '';
  const s = order.noon.status;
  const hidden = (fields) => Object.entries(fields).map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`).join('');
  const form = (action, label, cls, mode = '') =>
    `<form method="post" action="/api/dashboard">${hidden({ order: order.legacyResourceId, action, back, ...(mode ? { mode } : {}) })}<button class="${cls} ${size}" onclick="return confirm('${
      action === 'cancel'
        ? `Cancel the noon rider for ${esc(order.name)}? On production, noon charges for cancellations.`
        : mode === '4hr_delivery'
          ? `Book noon 4-hour delivery for ${esc(order.name)}?`
          : `Book an express noon rider for ${esc(order.name)} now? Make sure it is packed: the rider arrives within minutes.`
    }')">${label}</button></form>`;
  if (s === 'delivered' || ACTIVE_NOT_CANCELLABLE.includes(s)) return '';
  if (!order.noon.taskNr || ['cancelled', 'undelivered'].includes(s)) {
    const again = order.noon.taskNr ? ' again' : '';
    if (both) return form('dispatch', `Express rider${again}`, 'yellow', 'standard') + ' ' + form('dispatch', `4-hour delivery${again}`, 'ghost', '4hr_delivery');
    const mode = defaultDeliveryMode(order, cfg);
    return form('dispatch', order.noon.taskNr ? 'Book again' : mode === '4hr_delivery' ? 'Book 4-hour' : 'Dispatch rider', 'yellow', mode);
  }
  if (CANCELLABLE.includes(s)) return form('cancel', 'Cancel rider', 'danger');
  return '';
}

const modeBadge = (order, cfg) =>
  (order.noon.mode || defaultDeliveryMode(order, cfg)) === '4hr_delivery' ? ' <span class="b info">4-hour</span>' : '';
const ACTIVE_NOT_CANCELLABLE = ['picked_up', 'arrived_at_delivery'];

function connectionPanel(c) {
  if (!c) return '';
  const button = `<form method="post" action="/api/dashboard"><input type="hidden" name="action" value="connect"><button>Connect Shopify</button></form>`;
  if (!c.ok) return `<div class="panel bad-b"><strong>Shopify is not connected.</strong><div class="err">${esc(c.error)}</div></div>`;
  const problems = [];
  if (c.missingScopes.length) problems.push(`The app is missing permissions: <code>${c.missingScopes.map(esc).join(', ')}</code>. Add them in the Shopify Dev Dashboard and reinstall.`);
  if (c.ordersError) problems.push(`Could not read orders: ${esc(c.ordersError)}`);
  if (c.missingWebhooks.length) problems.push(`Not yet receiving order notifications (${c.missingWebhooks.map(esc).join(', ')}). Press Connect Shopify.`);
  if (!problems.length) return '';
  return `<div class="panel warn-b">Connected to <strong>${esc(c.shop)}</strong> via “${esc(c.app)}”<ul>${problems.map((p) => `<li>${p}</li>`).join('')}</ul>${c.missingWebhooks.length ? button : ''}</div>`;
}

export function renderDashboard({ orders, cfg, flash, labels, connection, view = 'todo', q = '' }) {
  const counts = countByView(orders);
  const visible = filterOrders(orders, view, q);
  const staging = cfg.noon.baseUrl.includes('noonstg');
  const here = `/?view=${encodeURIComponent(view)}${q ? `&q=${encodeURIComponent(q)}` : ''}`;

  const tabs = VIEWS.map(
    (v) => `<a class="tab ${v.key === view ? 'on' : ''} ${v.key === 'attention' && counts.attention ? 'alert' : ''}" href="/?view=${v.key}${q ? `&q=${encodeURIComponent(q)}` : ''}">${v.label}<span class="n">${counts[v.key]}</span></a>`,
  ).join('');

  const rows = visible
    .map((o) => {
      const a = o.shippingAddress || {};
      const cod = isCashOnDelivery(o, cfg);
      const href = `/order/${esc(o.legacyResourceId)}`;
      const items = (o.lineItems?.nodes || []).reduce((n, li) => n + li.quantity, 0);
      return `<tr class="row" data-href="${href}">
        <td data-l="Order"><a class="olink" href="${href}">${esc(o.name)}</a><div class="muted">${esc(ago(o.createdAt))}</div></td>
        <td data-l="Customer"><strong>${esc(a.name || '—')}</strong><div class="muted">${esc([a.address2 || a.address1, a.city].filter(Boolean).join(', '))}${a.latitude == null ? ' · <b class="bad-t">no map pin</b>' : ''}</div></td>
        <td data-l="Items">${items} item${items === 1 ? '' : 's'}</td>
        <td data-l="Payment">${cod ? `<span class="b warn">COD</span> ${esc(money(o.totalOutstandingSet))}` : `<span class="b">Prepaid</span> ${esc(money(o.totalPriceSet))}`}</td>
        <td data-l="Rider">${statusBadge(o, labels)}${modeBadge(o, cfg)}${o.noon.error && bucket(o) === 'attention' ? `<div class="err">${esc(o.noon.error)}</div>` : ''}</td>
        <td class="act" data-l="">${actions(o, here, cfg, { size: 'sm' })}</td>
      </tr>`;
    })
    .join('');

  const empty = {
    todo: 'Nothing to dispatch. New express orders appear here.',
    active: 'No riders out right now.',
    attention: 'All good. Failed bookings and undelivered orders show up here.',
    delivered: 'No deliveries yet.',
    all: 'No express orders yet.',
  }[view];

  const body = `
${flash ? `<div class="flash">${esc(flash)}</div>` : ''}
${connectionPanel(connection)}
<div class="head"><div><h1>Express orders</h1><div class="muted">Pack the order first, then press <strong>Dispatch rider</strong>. The rider arrives within minutes.</div></div>
<div class="hbtns">${staging && connection?.ok ? `<form method="post" action="/api/dashboard"><input type="hidden" name="action" value="test-order"><input type="hidden" name="back" value="/?view=todo"><button class="ghost" onclick="return confirm('Create a paid AED 1 test order in the Shopify store?')">+ Test order</button></form>` : ''}${connection?.ok ? '<a class="btn" href="/new">+ New order</a>' : ''}</div></div>
<div class="bar"><nav class="tabs">${tabs}</nav>
<form class="search" method="get" action="/"><input type="hidden" name="view" value="${esc(view)}"><input type="search" name="q" value="${esc(q)}" placeholder="Search order #, name, phone, area" aria-label="Search orders"></form></div>
<table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Payment</th><th>Rider</th><th></th></tr></thead>
<tbody>${rows || `<tr><td colspan="6" class="empty">${esc(q ? `No orders match “${q}”.` : empty)}</td></tr>`}</tbody></table>
<p class="muted foot">Showing the latest ${orders.length} express orders · updates every minute · pickup point <code>${esc(cfg.noon.outletCode || 'not set')}</code></p>
<style>
  .head { display: flex; justify-content: space-between; align-items: end; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
  .hbtns { display: flex; gap: 8px; flex-wrap: wrap; }
  .bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
  .tabs { display: flex; gap: 6px; flex-wrap: wrap; }
  .tab { text-decoration: none; font-weight: 700; font-size: 14px; padding: 7px 12px 7px 14px; border-radius: 99px; border: 1.5px solid var(--line); background: var(--card); display: inline-flex; gap: 8px; align-items: center; }
  .tab .n { font-size: 12px; min-width: 22px; text-align: center; padding: 1px 6px; border-radius: 99px; background: rgba(var(--navy-rgb) / .08); }
  .tab.on { background: var(--navy); color: #fff; border-color: var(--navy); } .tab.on .n { background: var(--yellow); color: var(--navy); }
  .tab.alert:not(.on) .n { background: var(--bad); color: #fff; }
  .search { display: block; flex: 0 1 360px; }
  .search input { font: inherit; width: 100%; padding: 8px 14px; border-radius: 99px; border: 1.5px solid var(--line); background: var(--card); color: var(--navy); }
  .search input:focus { outline: 2px solid var(--yellow); border-color: var(--navy); }
  table { width: 100%; border-collapse: separate; border-spacing: 0; background: var(--card); border: 1.5px solid var(--line); border-radius: 16px; overflow: hidden; }
  th, td { text-align: left; padding: 12px 14px; border-bottom: 1px solid var(--line); vertical-align: middle; }
  tbody tr:last-child td { border-bottom: 0; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); background: var(--cream); }
  .row { cursor: pointer; } .row:hover td { background: #FFFBEB; }
  .olink { font-weight: 900; font-size: 16px; text-decoration: none; } .olink:hover { text-decoration: underline; }
  .bad-t { color: var(--bad); }
  .act { text-align: right; } button.sm { padding: 6px 12px; font-size: 13px; }
  .empty { text-align: center; color: var(--muted); padding: 36px 14px; }
  .foot { margin-top: 12px; }
  @media (max-width: 760px) {
    thead { display: none; } table, tbody, tr, td { display: block; width: 100%; }
    tr.row { border-bottom: 1px solid var(--line); padding: 10px 0; } td { border: 0; padding: 3px 14px; }
    td[data-l="Items"], td[data-l="Payment"] { display: inline-block; width: auto; padding-right: 0; }
    .act { text-align: left; padding-top: 8px; }
    .search, .search input { width: 100%; }
    .bar { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
    .search { order: -1; }
    .tabs { min-width: 0; flex-wrap: nowrap; overflow-x: auto; margin: 0 -16px; padding: 0 16px 4px; scrollbar-width: none; }
    .tab { flex: none; }
  }
</style>
<script>
  // Whole row opens the order, except clicks on buttons and links.
  document.querySelectorAll('tr.row').forEach((tr) => tr.addEventListener('click', (e) => {
    if (e.target.closest('a, button, form')) return;
    location.href = tr.dataset.href;
  }));
</script>`;
  return shell({ cfg, title: 'Express orders', body, refresh: true });
}

export function renderOrderDetail({ order: o, task, taskError, cfg, flash, labels, links }) {
  const a = o.shippingAddress || {};
  const cod = isCashOnDelivery(o, cfg);
  const phone = normalizePhone(a.phone) || normalizePhone(o.phone) || normalizePhone(o.billingAddress?.phone);
  const da = task?.da_details;
  const lat = a.latitude, lng = a.longitude;
  const back = `/order/${o.legacyResourceId}`;

  const timeline = [{ label: 'Order placed', time: o.createdAt }];
  for (const u of task?.da_updates || []) {
    if (u.status && u.time) timeline.push({ label: labels[u.status] || u.status, time: `${u.time.replace(' ', 'T')}Z` });
  }

  const row = (k, v) => (v ? `<div class="kv"><div class="k">${k}</div><div class="v">${v}</div></div>` : '');
  const items = (o.lineItems?.nodes || []).map((li) => `<li><span class="q">${li.quantity}×</span>${esc(li.title)}</li>`).join('');

  const body = `
<a class="backlink" href="/">← All express orders</a>
${flash ? `<div class="flash">${esc(flash)}</div>` : ''}
<div class="dhead">
  <div><h1>${esc(o.name)}</h1><div class="muted">${esc(dubaiTime(o.createdAt))} · ${esc(ago(o.createdAt))}</div></div>
  <div class="dact">${statusBadge(o, labels)}${modeBadge(o, cfg)} ${actions(o, back, cfg, { both: true })}</div>
</div>
<div class="links">
  <a class="btn ghost" href="${esc(links.shopify)}" target="_blank" rel="noopener">Open in Shopify ↗</a>
  ${links.tracking ? `<a class="btn ghost" href="${esc(links.tracking)}" target="_blank" rel="noopener">Customer tracking page ↗</a><button class="ghost" type="button" data-copy="${esc(links.tracking)}">Copy tracking link</button>` : ''}
  ${lat != null ? `<a class="btn ghost" href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener">Delivery pin on Google Maps ↗</a>` : ''}
</div>
${o.noon.error && bucket(o) === 'attention' ? `<div class="panel bad-b"><strong>Booking failed:</strong> ${esc(o.noon.error)}</div>` : ''}
<div class="grid">
  <section class="card">
    <h2>Customer</h2>
    ${row('Name', esc(a.name))}
    ${row('Phone', phone ? `<a href="tel:${esc(phone)}">${esc(phone)}</a> · <a href="https://wa.me/${esc(phone.replace('+', ''))}" target="_blank" rel="noopener">WhatsApp</a>` : '<span class="bad-t">No usable phone number</span>')}
    ${row('Address', esc([a.company, a.address1, a.address2, a.city, a.province].filter(Boolean).join(', ')))}
    ${row('Map pin', lat != null ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : '<span class="bad-t">Missing: ask the customer for a location pin</span>')}
    ${row('Note', o.note ? esc(o.note) : '')}
  </section>
  <section class="card">
    <h2>Order</h2>
    <ul class="items">${items || '<li class="muted">No items</li>'}</ul>
    ${row('Payment', cod ? `<span class="b warn">Cash on delivery</span> rider collects <strong>${esc(money(o.totalOutstandingSet))}</strong>` : `<span class="b">Prepaid</span> ${esc(money(o.totalPriceSet))}`)}
    ${row('Shipping', esc(o.shippingLine?.title))}
    ${row('noon service', esc(DELIVERY_MODES[o.noon.mode || defaultDeliveryMode(o, cfg)].short) + (o.noon.mode ? '' : ' <span class="muted">(default for this shipping method)</span>'))}
    ${row('Shopify status', esc([o.displayFinancialStatus, o.displayFulfillmentStatus].filter(Boolean).join(' · ').toLowerCase().replace(/_/g, ' ')))}
  </section>
  <section class="card">
    <h2>Rider</h2>
    ${o.noon.taskNr ? '' : '<p class="muted">No rider booked yet. Once it’s packed, press <strong>Express rider</strong> (within 20 km of the warehouse) or <strong>4-hour delivery</strong> (further out).</p>'}
    ${taskError ? `<div class="err">Could not reach noon: ${esc(taskError)}</div>` : ''}
    ${row('noon task', o.noon.taskNr ? `<code>${esc(o.noon.taskNr)}</code>` : '')}
    ${da ? row('Rider', `${esc(da.name || da.first_name || '')}${da.phone_number ? ` · <a href="tel:${esc(da.phone_number)}">${esc(da.phone_number)}</a>` : ''}`) : ''}
    ${da?.location?.latitude ? row('Rider location', `<a href="https://www.google.com/maps?q=${esc(toDeg(da.location.latitude))},${esc(toDeg(da.location.longitude))}" target="_blank" rel="noopener">See on Google Maps ↗</a>`) : ''}
    ${task && cod ? row('Cash collected', task.order_cash_collected != null ? esc(`AED ${(task.order_cash_collected / 100).toFixed(2)}`) : 'Not yet') : ''}
    ${o.noon.taskNr ? `<h3>Timeline</h3><ol class="tl">${timeline.map((t) => `<li><span>${esc(t.label)}</span><span class="muted">${esc(dubaiTime(t.time, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }))}</span></li>`).join('')}</ol>` : ''}
  </section>
</div>
<style>
  .backlink { display: inline-block; margin-bottom: 12px; font-weight: 700; text-decoration: none; color: var(--muted); }
  .backlink:hover { color: var(--navy); }
  .dhead { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  .dhead h1 { font-size: 34px; }
  .dact { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .links { display: flex; gap: 8px; flex-wrap: wrap; margin: 14px 0 6px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; margin-top: 12px; }
  .card { background: var(--card); border: 1.5px solid var(--line); border-radius: 16px; padding: 16px 18px; }
  h2 { font-weight: 900; font-size: 15px; text-transform: uppercase; letter-spacing: .04em; margin: 0 0 10px; }
  h3 { font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin: 16px 0 6px; }
  .kv { display: grid; grid-template-columns: 110px 1fr; gap: 10px; padding: 7px 0; border-top: 1px dashed var(--line); }
  .kv:first-of-type { border-top: 0; }
  .k { color: var(--muted); font-size: 13px; font-weight: 700; } .v { overflow-wrap: anywhere; }
  .items { list-style: none; margin: 0 0 6px; padding: 0; } .items li { display: flex; gap: 10px; padding: 5px 0; font-weight: 700; }
  .q { min-width: 32px; height: 24px; border-radius: 99px; background: var(--cream); display: inline-grid; place-items: center; font-size: 12px; }
  .tl { list-style: none; margin: 0; padding: 0 0 0 14px; border-left: 2px solid var(--yellow); }
  .tl li { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; position: relative; font-weight: 700; font-size: 14px; }
  .tl li::before { content: ""; position: absolute; left: -20px; top: 11px; width: 10px; height: 10px; border-radius: 50%; background: var(--navy); }
  .bad-t { color: var(--bad); }
</style>
<script>
  document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copied ✓'; } catch { prompt('Copy this link', b.dataset.copy); }
  }));
</script>`;
  return shell({ cfg, title: o.name, body });
}

export function renderNewOrder({ cfg, flash }) {
  const staging = cfg.noon.baseUrl.includes('noonstg');
  const field = (name, label, attrs = '', hint = '') =>
    `<label class="f"><span>${label}</span><input name="${name}" ${attrs}>${hint ? `<small>${hint}</small>` : ''}</label>`;
  const body = `
<a class="backlink" href="/">← All express orders</a>
${flash ? `<div class="flash">${esc(flash)}</div>` : ''}
<h1>New delivery order</h1>
<p class="muted">Creates a paid order in Shopify (no stock change, no customer email) and adds it to the dispatch list. Dispatch it from the order page once it's packed.</p>
<form class="card nf" method="post" action="/api/dashboard">
  <input type="hidden" name="action" value="create-order"><input type="hidden" name="back" value="/new">
  <div class="cols">
    ${field('name', 'Customer name', 'required maxlength="100" autocomplete="off"')}
    ${field('phone', 'Phone', 'required inputmode="tel" placeholder="050 123 4567"', 'The rider calls this number.')}
  </div>
  ${field('address1', 'Building, flat / villa, street', 'required minlength="5" maxlength="200" placeholder="510, New Bridge Hills 3"')}
  <div class="cols">
    ${field('area', 'Area', 'maxlength="100" placeholder="Motor City"', 'Used to place the map pin.')}
    ${field('city', 'City', 'value="Dubai" maxlength="60"')}
  </div>
  <div class="cols">
    ${field('item', "What's in the box", 'maxlength="200" placeholder="Triple Chocolate Truffles × 2"')}
    ${field('amount', 'Order value (AED, prepaid)', 'type="number" min="0" step="0.01" value="0"')}
  </div>
  ${field('note', 'Delivery note for the rider', 'maxlength="250" placeholder="Call on arrival"')}
  <fieldset class="modes"><legend>noon service</legend>
    <label><input type="radio" name="mode" value="standard" checked> <strong>Express</strong> <span class="muted">on-demand rider, within 20 km of the warehouse</span></label>
    <label><input type="radio" name="mode" value="4hr_delivery"> <strong>4-hour delivery</strong> <span class="muted">for addresses further out</span></label>
  </fieldset>
  <label class="chk"><input type="checkbox" name="test" ${staging ? 'checked' : ''}> Mark as a test order <span class="muted">(tagged “test” so it can be filtered out of reports)</span></label>
  <div><button class="yellow" type="submit">Create order</button></div>
</form>
<style>
  .backlink { display: inline-block; margin-bottom: 12px; font-weight: 700; text-decoration: none; color: var(--muted); }
  h1 { margin-bottom: 4px; }
  .nf { background: var(--card); border: 1.5px solid var(--line); border-radius: 16px; padding: 18px; max-width: 720px; margin-top: 14px; display: grid; gap: 14px; }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; align-items: start; }
  .f { display: grid; gap: 5px; } .f span { font-weight: 700; font-size: 13px; } .f small { color: var(--muted); font-size: 12px; }
  .f input { font: inherit; padding: 9px 12px; border-radius: 10px; border: 1.5px solid var(--line); background: #fff; color: var(--navy); }
  .f input:focus { outline: 2px solid var(--yellow); border-color: var(--navy); }
  .modes { border: 1.5px solid var(--line); border-radius: 12px; padding: 10px 14px; display: grid; gap: 8px; margin: 0; }
  .modes legend { font-weight: 700; font-size: 13px; padding: 0 4px; }
  .chk { font-size: 14px; }
</style>`;
  return shell({ cfg, title: 'New order', body });
}

const toDeg = (v) => { const n = Number(v); return Math.abs(n) > 180 ? n / 1e7 : n; };

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
<header><img src="/plaay-logo.png" alt="Plaay" width="80" height="30"><span class="badge" id="badge">Express</span></header>
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
    let [title, sub, stage] = COPY[d.status] || COPY.not_dispatched;
    if (d.mode === '4hr_delivery' && ['created', 'pending_assignment'].includes(d.status)) {
      [title, sub] = ['Booked for delivery', 'Your order is packed and booked. It will reach you within 4 hours, and we’ll show your rider here once they’re on the way.'];
    }
    const name = d.rider ? d.rider.name : 'Your rider';
    $('orderNo').textContent = 'Order ' + d.order;
    if (d.mode === '4hr_delivery') $('badge').textContent = 'Delivery';
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
