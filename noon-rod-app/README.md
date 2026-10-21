# Plaay × noon express delivery

Connects Plaay's Shopify store to **noon Rider on Demand (RoD)**. The app books a noon rider for express orders and syncs rider progress back to Shopify. Customers get Shopify's normal shipping emails, with a link to a live tracking page.

```
Customer picks "Express delivery" at checkout
        │  orders/create webhook
        ▼
Order tagged noon-express ──► shows on the dispatch dashboard
        │  staff pack it, then press Dispatch (or add the noon-dispatch tag)
        ▼
noon task created (POST /public/v1/create-task) ──► rider assigned within minutes
        │  noon status webhooks
        ▼
picked_up    → order fulfilled with tracking link, customer gets "out for delivery"
delivered    → fulfillment marked delivered, customer notified
undelivered  → order tagged noon-undelivered for the team to follow up
Order cancelled in Shopify before pickup → noon rider cancelled
```

The app has no database. All state lives on the Shopify order as tags and `noon.*` metafields.

## What's in here

| Path | Purpose |
|---|---|
| `api/shopify-webhook.js` | Receives `orders/create`, `orders/updated`, `orders/cancelled` (HMAC-verified) |
| `api/noon-status.js` | noon task status webhook (checks our `X-API-Key`) |
| `api/noon-location.js` | noon rider location webhook (acknowledged; the tracking page reads live position from task details) |
| `api/dashboard.js` | Staff dispatch dashboard at `/` (password protected) |
| `api/track.js`, `api/track-data.js` | Customer tracking page at `/track/<signed token>` |
| `lib/mapping.js` | Shopify order → noon payload (coordinates ×10⁷, money in fils, UAE phone normalisation, COD vs prepaid) |
| `lib/dispatch.js`, `lib/status.js` | Booking/cancelling riders and applying status updates |
| `scripts/noon-smoke.js` | Checks the noon credentials; with `--create`, books and cancels a test task on staging |
| `lib/setup.js` | Shopify connection check and webhook registration (dashboard **Connect Shopify** button) |
| `scripts/register-webhooks.js` | Same as the button, from the command line |

## Setup

### 1. noon
1. Ask the noon RoD integrations team for a **production API key**.
2. Create the Plaay warehouse as a pickup point. You can call `POST /public/v1/pickup-points/create` or ask noon to add it. Put its `code` in `NOON_OUTLET_CODE`.
3. Choose a random secret for `NOON_WEBHOOK_KEY`. Send noon these two webhook URLs along with that key:
   - status: `https://<APP_URL>/api/noon-status`
   - rider location: `https://<APP_URL>/api/noon-location`
4. Confirm with noon:
   - the per-delivery price
   - cancellation charges
   - the COD limit
   - the delivery radius. The API spec says **15 km max** pickup-to-drop-off; the PDF says 20 km.

### 2. Shopify checkout option
In **Settings → Shipping and delivery → Local delivery**, enable local delivery for the warehouse location:
- Set a delivery zone by **distance of 15 km or less**.
- Give the rate a name containing "Express", e.g. *Express delivery (Dubai, ~60 min)*. That name is how the app spots express orders (`EXPRESS_SHIPPING_MATCH`).
- Set the delivery hours to when the team can pack.

### 3. Shopify app (API access)
**Current setup:** the app connects through **TMS DataMonitorPlaay**, The Marketing Samurai's partner app, which is installed on `plaay-store.myshopify.com`.
- **Access token:** that app's offline access token (`shpca_…`) is stored in Vercel as `SHOPIFY_ADMIN_TOKEN`.
- **Webhook secret:** its client secret is stored as `SHOPIFY_CLIENT_SECRET`, because Shopify signs the order webhooks with it.
- **Dependency:** if that app is uninstalled from Plaay or its secret is rotated, update these two values.

A partner-owned app can't use the client-credentials grant on a client's store, so it needs the token. An app created from the Plaay store's own Dev Dashboard can instead use just `SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET`.

Required Admin API scopes:
- `read_orders`, `write_orders`
- `read_merchant_managed_fulfillment_orders`, `write_merchant_managed_fulfillment_orders`
- protected customer data: name, address and phone

The dashboard panel flags any that are missing.

### 4. Deploy (Vercel)
1. Create a Vercel project with **Root Directory = `noon-rod-app`**. No build step is needed.
2. Add every variable from `.env.example` in the Vercel project settings. Keep `NOON_BASE_URL` on staging until testing is done.
3. Open the dashboard and press **Connect Shopify**. The panel at the top shows the connected store and app, any missing permissions, and whether order notifications (webhooks) are set up. `scripts/register-webhooks.js` does the same from the command line.

### 5. Test on staging
```
npm test                                             # unit + flow tests, no network
node --env-file=.env scripts/noon-smoke.js           # checks the key, lists pickup points
node --env-file=.env scripts/noon-smoke.js --create  # books + cancels a staging task
```
Then place a test express order on the store and dispatch it from the dashboard. To see the whole rider journey on staging, book a call with the noon integrations team; they drive the staging rider app. After that, switch `NOON_BASE_URL` to `https://food-api-team.noon.team` and use the production key.

## Daily use

- Open the dashboard at `APP_URL`. The username can be anything; the password is `DASHBOARD_PASSWORD`. Express orders are listed newest first.
- **Pack the order first, then press Dispatch.** The rider arrives within minutes.
- You can also add the tag `noon-dispatch` to the order in Shopify admin, or use Shopify Flow to do it.
- A failed booking shows the reason on the dashboard and tags the order `noon-error`. Typical reasons are a missing map pin, a missing phone number, being out of range, or no riders available. Fix the problem and press Dispatch again.
- `AUTO_DISPATCH=true` books the rider as soon as the order is placed. Only turn this on if orders are always ready within minutes.
- Cancelling a Shopify order cancels the rider if they haven't picked it up yet. **Production cancellations are charged by noon.**

### Tags and metafields

| Tag | Meaning |
|---|---|
| `noon-express` | Customer chose express delivery |
| `noon-dispatch` | Staff: book a rider now |
| `noon-dispatched` | A noon task is active |
| `noon-error` | Booking failed; reason in metafield `noon.error` |
| `noon-delivered` / `noon-undelivered` / `noon-cancelled` | Final outcome |

Metafields (namespace `noon`): `task_nr`, `status`, `error`, `fulfillment_id`.

## Notes
- **Map pins:** noon needs exact coordinates. Shopify usually works them out from the address; orders without them are flagged "no map pin" on the dashboard.
- **Maps:** the tracking page uses OpenStreetMap tiles. That's fine at low volume; switch to a paid tile provider if traffic grows.
- **Keys:** the noon API key only ever lives in Vercel env vars. Never put it in theme code.
- **Heat:** chocolate travels by motorbike, so pack express orders in insulated packaging.
