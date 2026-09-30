import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { verifyWebhookHmac } from '../lib/shopify.js';
import { trackingToken, trackingUrl, verifyTrackingToken } from '../lib/tracking.js';
import { cfg } from './helpers.js';

test('tracking tokens round-trip and reject tampering', () => {
  const t = trackingToken('s', '5550001');
  assert.equal(verifyTrackingToken('s', t), '5550001');
  assert.equal(verifyTrackingToken('other', t), null);
  assert.equal(verifyTrackingToken('s', t.replace('5550001', '5550002')), null);
  assert.equal(verifyTrackingToken('s', '5550001'), null);
  assert.equal(verifyTrackingToken('s', '../x.y'), null);
  assert.equal(verifyTrackingToken('', t), null);
  assert.equal(trackingUrl(cfg, '1'), `https://noon.example.com/track/${trackingToken('track-secret', '1')}`);
});

test('Shopify webhook HMAC verification', () => {
  const body = '{"id":1}';
  const good = crypto.createHmac('sha256', 'k').update(body).digest('base64');
  assert.equal(verifyWebhookHmac(body, good, 'k'), true);
  assert.equal(verifyWebhookHmac(body + ' ', good, 'k'), false);
  assert.equal(verifyWebhookHmac(body, good, ''), false);
  assert.equal(verifyWebhookHmac(body, null, 'k'), false);
  assert.equal(verifyWebhookHmac(body, 'short', 'k'), false);
});
