// Checks the Shopify connection and subscribes the app to the order webhooks it needs.

export const REQUIRED_SCOPES = [
  'read_orders',
  'write_orders',
  'read_merchant_managed_fulfillment_orders',
  'write_merchant_managed_fulfillment_orders',
];

export const WEBHOOK_TOPICS = ['ORDERS_CREATE', 'ORDERS_UPDATED', 'ORDERS_CANCELLED'];

export const webhookUri = (cfg) => `${cfg.appUrl}/api/shopify-webhook`;

// Never throws: returns { ok: false, error } when Shopify cannot be reached.
export async function getConnection(shopify, cfg) {
  try {
    const data = await shopify.graphql(`{
      shop { name myshopifyDomain }
      currentAppInstallation { app { title } accessScopes { handle } }
      webhookSubscriptions(first: 50) { nodes { topic uri } }
    }`);
    const scopes = data.currentAppInstallation.accessScopes.map((s) => s.handle);
    // write_X implies read_X.
    const has = (s) => scopes.includes(s) || scopes.includes(s.replace(/^read_/, 'write_'));
    const uri = webhookUri(cfg);
    const subscribed = data.webhookSubscriptions.nodes.filter((w) => w.uri === uri).map((w) => w.topic);
    return {
      ok: true,
      shop: data.shop.name,
      domain: data.shop.myshopifyDomain,
      app: data.currentAppInstallation.app.title,
      missingScopes: REQUIRED_SCOPES.filter((s) => !has(s)),
      missingWebhooks: WEBHOOK_TOPICS.filter((t) => !subscribed.includes(t)),
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function connectWebhooks(shopify, cfg) {
  if (!cfg.appUrl) throw new Error('APP_URL is not set');
  const status = await getConnection(shopify, cfg);
  if (!status.ok) throw new Error(status.error);
  const results = [];
  for (const topic of status.missingWebhooks) {
    const res = await shopify.graphql(
      `mutation($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) { webhookSubscription { id } userErrors { message } }
      }`,
      { topic, sub: { uri: webhookUri(cfg), format: 'JSON' } },
    );
    const errors = res.webhookSubscriptionCreate.userErrors;
    results.push({ topic, ok: !errors.length, error: errors.map((e) => e.message).join('; ') });
  }
  return results;
}

// Creates a paid Shopify order for noon delivery from the dashboard's "New order" form
// (phone/WhatsApp orders, or deliveries to the team). Uses a custom line item, so stock is
// untouched, and no customer email, so Shopify sends no notifications.
export async function createManualOrder(shopify, f) {
  const [firstName, ...rest] = String(f.name).trim().split(/\s+/);
  const fourHour = f.mode === '4hr_delivery';
  const created = await shopify.graphql(
    `mutation($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) { draftOrder { id } userErrors { field message } }
    }`,
    {
      input: {
        lineItems: [
          {
            title: f.item || 'Plaay order',
            quantity: 1,
            originalUnitPriceWithCurrency: { amount: Number(f.amount || 0).toFixed(2), currencyCode: 'AED' },
            requiresShipping: true,
          },
        ],
        shippingLine: {
          title: `${fourHour ? '4-hour delivery' : 'Express delivery'}${f.test ? ' (TEST)' : ''}`,
          priceWithCurrency: { amount: '0.00', currencyCode: 'AED' },
        },
        shippingAddress: {
          firstName,
          lastName: rest.join(' ') || '-',
          address1: f.address1,
          address2: f.area || '',
          city: f.city || 'Dubai',
          provinceCode: 'DU',
          countryCode: 'AE',
          phone: f.phone,
        },
        note: f.note || '',
        // Tagged up front so the order shows on the dashboard straight away.
        tags: ['noon-express', 'noon-manual', ...(f.test ? ['test', 'noon-test'] : [])],
      },
    },
  );
  const draftErrors = created.draftOrderCreate.userErrors;
  if (draftErrors.length) throw new Error(`draftOrderCreate: ${draftErrors.map((e) => e.message).join('; ')}`);

  const completed = await shopify.graphql(
    `mutation($id: ID!) {
      draftOrderComplete(id: $id) { draftOrder { order { id name legacyResourceId } } userErrors { field message } }
    }`,
    { id: created.draftOrderCreate.draftOrder.id },
  );
  const errors = completed.draftOrderComplete.userErrors;
  if (errors.length) throw new Error(`draftOrderComplete: ${errors.map((e) => e.message).join('; ')}`);
  return completed.draftOrderComplete.draftOrder.order;
}

// Staging-only self test: a paid AED 1 order delivered near noon's staging test outlets.
export function createTestOrder(shopify) {
  return createManualOrder(shopify, {
    name: 'Plaay Test',
    phone: '+971500000000',
    address1: 'Bay Square Building 5',
    area: 'Business Bay',
    item: 'TEST – noon delivery integration (do not fulfil)',
    amount: 1,
    note: 'Test order for the noon delivery integration. Safe to cancel and archive.',
    test: true,
  });
}
