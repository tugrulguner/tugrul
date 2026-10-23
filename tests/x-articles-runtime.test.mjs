import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
const seed=JSON.parse(fs.readFileSync(new URL('../public/x-articles.json',import.meta.url)));
test('actual workerd performs an authenticated sync through native fetch and persists the feed',async()=>{
 const source=fs.readFileSync(new URL('../worker/index.mjs',import.meta.url),'utf8').replace('fetch: handle,','async fetch(request,env){return Response.json(await syncArticles(env))},');let calls=0;
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'article-runtime',modules:true,script:source,compatibilityDate:'2026-09-28',kvNamespaces:['ARTICLES_KV'],bindings:{X_BEARER_TOKEN:'synthetic-native-runtime-fixture'},outboundService:async request=>{calls++;assert.equal(new URL(request.url).pathname,'/2/tweets/search/all');assert.equal(request.headers.get('authorization'),'Bearer synthetic-native-runtime-fixture');return Response.json({meta:{result_count:0}})}}]}));
 try{const kv=await mf.getKVNamespace('ARTICLES_KV');await kv.put('x-articles:feed',JSON.stringify(seed));await kv.put('x-articles:sync-state',JSON.stringify({source:'article-search-v1',historyDone:true}));const response=await mf.dispatchFetch('http://local.test/');assert.equal(response.status,200);const result=await response.json();assert.equal(result.synced,true);assert.equal(result.count,seed.articles.length);assert.equal(calls,1);assert.ok(JSON.parse(await kv.get('x-articles:feed')).updatedAt>=seed.updatedAt);assert.equal(await kv.get('x-articles:oauth'),null)}finally{await mf.dispose()}
});
