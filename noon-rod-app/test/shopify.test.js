import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createShopifyClient } from '../lib/shopify.js';

const cfg = { shop: 's.myshopify.com', apiVersion: '2026-07', clientId: 'id', clientSecret: 'secret' };

test('token errors include Shopify\'s reason', async () => {
  const fetchImpl = async () => Response.json({ error: 'shop_not_permitted', error_description: 'App is not installed on this shop' }, { status: 400 });
  const shopify = createShopifyClient(cfg, fetchImpl);
  await assert.rejects(shopify.graphql('{ shop { name } }'), /failed \(400\): App is not installed on this shop/);
});

test('client credentials token is fetched once and reused', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith('/access_token')) return Response.json({ access_token: 'tok', expires_in: 86399 });
    return Response.json({ data: { shop: { name: 'Plaay' } } });
  };
  const shopify = createShopifyClient(cfg, fetchImpl);
  await shopify.graphql('{ shop { name } }');
  await shopify.graphql('{ shop { name } }');
  assert.equal(calls.filter((u) => u.endsWith('/access_token')).length, 1);
});
