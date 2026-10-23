import test from 'node:test';
import assert from 'node:assert/strict';
import {syncArticles} from '../worker/index.mjs';
test('provider response size is bounded before JSON parsing/publication',async()=>{
 const now=new Date();const values=new Map([['x-articles:oauth',JSON.stringify({accessToken:'unit-placeholder',refreshToken:'unit-placeholder',expiresAt:now.getTime()+3600000})]]);const kv={get:async k=>values.get(k)||null,put:async(k,v)=>values.set(k,v)};
 await assert.rejects(syncArticles({ARTICLES_KV:kv},{now,fetch:async()=>Response.json({meta:{result_count:0},padding:'x'.repeat(600000)})}),/response too large/);assert.equal(values.has('x-articles:feed'),false);
});
