import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const config=()=>JSON.parse(fs.readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
test('daily article sync is native to the existing Worker without routing static assets through it',()=>{
 const c=config();assert.equal(c.main,'worker/index.mjs');assert.equal(c.assets.binding,'ASSETS');assert.deepEqual(c.assets.run_worker_first,['/api/x-articles','/api/x-articles/*','/api/articles','/api/articles/*']);assert.deepEqual(c.triggers.crons,['0 14 * * *']);assert.deepEqual(c.kv_namespaces,[{binding:'ARTICLES_KV'}]);assert.equal(c.assets.directory,'./public');assert.equal(c.assets.not_found_handling,'404-page');assert.equal(c.routes[0].pattern,'tugrul.modepot.io');assert.equal(c.usage_model,undefined);assert.equal(c.limits?.cpu_ms,undefined);
});
