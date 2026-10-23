import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker,{syncArticles} from '../worker/index.mjs';
const seed=JSON.parse(fs.readFileSync(new URL('../public/x-articles.json',import.meta.url)));
test('malformed explicitly configured Bearer values fail closed without attempting OAuth or provider calls',async()=>{
 for(const value of [null,42,'',' unit-token','unit token','unit-token\n','unit-token\r\nInjected: header']){
  let calls=0;const result=syncArticles({X_BEARER_TOKEN:value,ARTICLES_KV:{get:async()=>null,put:async()=>{}}},{fetch:async()=>{calls++;throw Error('Provider must not run')}});
  await assert.rejects(result,error=>error.message==='Bearer token configuration invalid');assert.equal(calls,0);
 }
});
test('a rejected app Bearer preserves the feed and never falls back to user OAuth or exposes the token',async()=>{
 const bearer='unit-rejected-app-token',values=new Map([['x-articles:feed',JSON.stringify(seed)]]);let oauthReads=0,calls=0;
 const env={X_BEARER_TOKEN:bearer,X_CLIENT_ID:'legacy-client',X_CLIENT_SECRET:'legacy-secret',X_REFRESH_TOKEN:'legacy-refresh',ARTICLES_KV:{get:async key=>{if(key==='x-articles:oauth')oauthReads++;return values.get(key)||null},put:async(key,value)=>values.set(key,value)}};
 await assert.rejects(syncArticles(env,{fetch:async(url,init)=>{calls++;assert.equal(new URL(url).pathname,'/2/tweets/search/all');assert.equal(new Headers(init.headers).get('authorization'),'Bearer '+bearer);return new Response(JSON.stringify({debug:bearer}),{status:401})}}),error=>error.status===401&&!error.message.includes(bearer));
 assert.equal(calls,1);assert.equal(oauthReads,0);assert.deepEqual(JSON.parse(values.get('x-articles:feed')),seed);const response=await worker.fetch(new Request('https://site.test/api/x-articles'),env);const body=await response.text();assert.ok(!body.includes(bearer));assert.equal(JSON.parse(body).articles.length,seed.articles.length);assert.equal(calls,1);
});
test('one app-only Bearer secret syncs Articles without reading or writing user OAuth tokens',async()=>{
 const values=new Map([['x-articles:feed',JSON.stringify(seed)],['x-articles:sync-state',JSON.stringify({source:'article-search-v1',historyDone:true})]]),reads=[];
 const kv={get:async key=>{reads.push(key);if(key==='x-articles:oauth')throw Error('OAuth storage must not be used for app-only access');return values.get(key)||null},put:async(key,value)=>values.set(key,value)};
 const bearer='unit-app-token/%2B=';let calls=0;const result=await syncArticles({ARTICLES_KV:kv,X_BEARER_TOKEN:bearer},{fetch:async(url,init)=>{calls++;assert.equal(new URL(url).pathname,'/2/tweets/search/all');assert.equal(new Headers(init.headers).get('authorization'),'Bearer '+bearer);return Response.json({meta:{result_count:0}})}});
 assert.equal(result.synced,true);assert.equal(calls,1);assert.equal(reads.includes('x-articles:oauth'),false);assert.equal(values.has('x-articles:oauth'),false);assert.equal(JSON.parse(values.get('x-articles:feed')).articles.length,seed.articles.length);assert.equal([...values.values()].some(value=>value.includes(bearer)),false);
});
