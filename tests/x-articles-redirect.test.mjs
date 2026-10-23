import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncArticles} from '../worker/index.mjs';
const seed=JSON.parse(fs.readFileSync(new URL('../public/x-articles.json',import.meta.url)));
function env(){const values=new Map([['x-articles:feed',JSON.stringify(seed)],['x-articles:sync-state',JSON.stringify({source:'article-search-v1',historyDone:true})]]);return {values,bindings:{X_BEARER_TOKEN:'unit-app-bearer',ARTICLES_KV:{get:async key=>values.get(key)||null,put:async(key,value)=>values.set(key,value)}}}}
test('provider fetch uses the redirect mode supported by Cloudflare Workers',async()=>{
 const e=env();let calls=0;const result=await syncArticles(e.bindings,{fetch:async(url,init)=>{calls++;assert.equal(init.redirect,'manual');return Response.json({meta:{result_count:0}})}});assert.equal(result.synced,true);assert.equal(calls,1);
});
test('redirect responses fail closed without following Location or changing the feed/checkpoint',async()=>{
 for(const status of [301,302,303,307,308]){const e=env(),before=[...e.values];let calls=0;await assert.rejects(syncArticles(e.bindings,{fetch:async(url,init)=>{calls++;assert.equal(init.redirect,'manual');assert.equal(new URL(url).hostname,'api.x.com');return new Response(null,{status,headers:{location:'https://untrusted.example/token-capture'}})}}),error=>error.status===status);assert.equal(calls,1);assert.deepEqual([...e.values],before)}
});
