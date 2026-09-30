// Thin client for noon Rider on Demand public API (/public/v1).

export class NoonError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'NoonError';
    this.status = status;
    this.body = body;
  }
}

// Task states in which noon still accepts a cancel.
export const CANCELLABLE_STATUSES = ['pending_assignment', 'created', 'assigned', 'arrived_at_pickup_location'];

export function createNoonClient(cfg, fetchImpl = globalThis.fetch) {
  async function call(method, path, { body, idempotencyKey } = {}) {
    if (!cfg.apiKey) throw new NoonError('NOON_API_KEY is not set', 0, null);
    const headers = {
      'X-API-Key': cfg.apiKey,
      'X-Locale': cfg.locale,
      Accept: 'application/json',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;

    const res = await fetchImpl(`${cfg.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) throw new NoonError(`noon ${method} ${path} failed (${res.status}): ${describe(data)}`, res.status, data);
    return data;
  }

  return {
    createTask: (payload, idempotencyKey) => call('POST', '/public/v1/create-task', { body: payload, idempotencyKey }),
    getTask: (taskNr) => call('GET', `/public/v1/tasks/${encodeURIComponent(taskNr)}`),
    cancelTask: (taskNr) => call('POST', `/public/v1/tasks/${encodeURIComponent(taskNr)}/cancel`, { body: {} }),
    getConfigurations: () => call('GET', '/public/v1/configurations'),
    listOutlets: () => call('GET', '/public/v1/outlets'),
    listPickupPoints: () => call('GET', '/public/v1/pickup-points/list'),
    createPickupPoint: (payload) => call('POST', '/public/v1/pickup-points/create', { body: payload }),
  };
}

// Turn noon's error bodies (FastAPI validation errors or {message}) into one readable line.
function describe(data) {
  if (!data) return 'empty response';
  if (typeof data === 'string') return data.slice(0, 300);
  if (Array.isArray(data.detail)) {
    return data.detail.map((d) => `${(d.loc || []).slice(1).join('.')}: ${d.msg}`).join('; ');
  }
  return String(data.detail || data.message || data.error || JSON.stringify(data)).slice(0, 300);
}
