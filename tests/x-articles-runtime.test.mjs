import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSync} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
const seed=JSON.parse(fs.readFileSync(new URL('../public/x-articles.json',import.meta.url)));
test('actual workerd executes the unchanged scheduled handler with native fetch and publishes the feed',async()=>{
 const source=fs.readFileSync(new URL('../worker/index.mjs',import.meta.url),'utf8');let calls=0;
 const substack=buildSync({entryPoints:[new URL('../worker/substack.mjs',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'browser'}).outputFiles[0].text;
 // This separate test entry imports the actual production module byte-for-byte.
 // Await its real scheduled callback and every waitUntil task; do not substitute syncArticles.
 const harness=`import worker from './actual-worker.mjs';export default {async fetch(request,env){const tasks=[];await worker.scheduled({cron:'0 14 * * *',scheduledTime:Date.now()},env,{waitUntil:task=>tasks.push(task)});await Promise.all(tasks);return Response.json({awaited:tasks.length})}};`;
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'article-runtime',modules:[{type:'ESModule',path:'scheduled-harness.mjs',contents:harness},{type:'ESModule',path:'actual-worker.mjs',contents:source},{type:'ESModule',path:'substack.mjs',contents:substack},{type:'ESModule',path:'substack-pairs.mjs',contents:fs.readFileSync(new URL('../worker/substack-pairs.mjs',import.meta.url),'utf8')}],compatibilityDate:'2026-09-28',kvNamespaces:['ARTICLES_KV'],bindings:{X_BEARER_TOKEN:'synthetic-native-runtime-fixture'},outboundService:async request=>{calls++;if(new URL(request.url).hostname==='tugrulguner.substack.com'){return new Response(fs.readFileSync(new URL('./fixtures/substack-official-feed.xml',import.meta.url),'utf8'),{headers:{'content-type':'application/rss+xml'}})}assert.equal(new URL(request.url).pathname,'/2/tweets/search/all');assert.equal(request.headers.get('authorization'),'Bearer synthetic-native-runtime-fixture');return Response.json({meta:{result_count:0}})}}]}));
 try{
  const kv=await mf.getKVNamespace('ARTICLES_KV');await kv.put('x-articles:feed',JSON.stringify(seed));await kv.put('x-articles:sync-state',JSON.stringify({source:'article-search-v1',historyDone:true}));
  const response=await mf.dispatchFetch('http://local.test/');assert.equal(response.status,200);assert.equal((await response.json()).awaited,1);assert.equal(calls,2);
  const rss=JSON.parse(await kv.get('substack:feed'));assert.equal(rss.length,4);assert.equal(rss.filter(r=>r.available).length,2);assert.ok(rss.every(r=>Number.isFinite(Date.parse(r.checkedAt))));
  const published=JSON.parse(await kv.get('x-articles:feed'));assert.equal(published.articles.length,seed.articles.length);assert.notEqual(published.updatedAt,seed.updatedAt,'a swallowed scheduled error must not pass as a successful publication');assert.equal(await kv.get('x-articles:oauth'),null);
 }finally{await mf.dispose()}
});
