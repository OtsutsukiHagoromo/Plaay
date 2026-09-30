// End-to-end check against noon: reads partner config and pickup points, then (with --create)
// books a test task, reads it back and cancels it. Only run --create against STAGING;
// production tasks are real deliveries and cancelling them is charged.
// Usage: node --env-file=.env scripts/noon-smoke.js [--create]

import { loadConfig } from '../lib/config.js';
import { createNoonClient } from '../lib/noon.js';

const cfg = loadConfig();
const noon = createNoonClient(cfg.noon);
const staging = cfg.noon.baseUrl.includes('noonstg');

console.log(`noon ${staging ? 'STAGING' : 'PRODUCTION'} ${cfg.noon.baseUrl}`);
console.log('configurations:', await noon.getConfigurations());

const outlets = await noon.listOutlets();
console.log(`${outlets.length} pickup locations:`);
for (const o of outlets.slice(0, 10)) console.log(`  ${o.code}  ${o.name_en}  serviceable=${o.is_serviceable}`);

if (process.argv.includes('--create')) {
  if (!staging) throw new Error('Refusing to create a task on production');
  const outlet = outlets.find((o) => o.code === cfg.noon.outletCode) || outlets.find((o) => o.is_serviceable);
  const { latitude, longitude } = outlet.address_details;
  const reference = `PLAAY-SMOKE-${Date.now()}`;
  const created = await noon.createTask(
    {
      order_reference: reference,
      outlet_code: outlet.code,
      drop_off_address: {
        lat: latitude + 50000, // ~550 m north of the pickup point
        lng: longitude,
        address: 'Test drop-off, Plaay integration smoke test',
        contact_name: 'Plaay Test',
        contact_phone_number: '+971500000000',
        country_code: 'ae',
        city: 'Dubai',
      },
      prepaid_value: 12500,
      package_count: 1,
    },
    reference,
  );
  console.log('created:', created);
  const task = await noon.getTask(created.mp_task_nr);
  console.log('task status:', task.status_code);
  console.log('cancel:', await noon.cancelTask(created.mp_task_nr));
  console.log('after cancel:', (await noon.getTask(created.mp_task_nr)).status_code);
}
