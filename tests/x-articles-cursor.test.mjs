import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syncArticles} from '../worker/index.mjs';
const seed=JSON.parse(readFileSync(new URL('../public/x-articles.json',import.meta.url)));
const json=body=>Response.json(body);
const now=new Date('2026-10-24T12:00:00Z');
const storage=()=>{const values=new Map([['x-articles:sync-state',JSON.stringify({historyDone:true})],['x-articles:feed',JSON.stringify(seed)],['x-articles:oauth',JSON.stringify({accessToken:'unit-fixture-token',refreshToken:'unit-fixture-refresh',expiresAt:now.getTime()+3*86400000})]]);return {values,get:async k=>values.get(k)||null,put:async(k,v)=>values.set(k,v),delete:async k=>values.delete(k)}};
test('incremental watermark advances over ordinary posts and is reused the next day',async()=>{
 const kv=storage();let n=0;const fetcher=async u=>{const url=new URL(u);n++;if(n===1)return json({data:[{id:'2113460000000000001',text:'Synthetic ordinary-post test fixture'}],meta:{result_count:1}});assert.equal(url.searchParams.get('since_id'),'2113460000000000001');return json({meta:{result_count:0}})};
 await syncArticles({ARTICLES_KV:kv},{fetch:fetcher,now});await syncArticles({ARTICLES_KV:kv},{fetch:fetcher,now:new Date(now.getTime()+86400000)});assert.equal(n,2);assert.equal(JSON.parse(kv.values.get('x-articles:feed')).articles.length,seed.articles.length);
});
test('publishing failure cannot advance the pending pagination checkpoint',async()=>{
 const kv=storage();const original=kv.put;kv.put=async(k,v)=>{if(k==='x-articles:feed')throw Error('unit-fixture storage failure');return original(k,v)};
 let n=0;const fetcher=async()=>json({data:Array.from({length:20},(_,i)=>({id:(2113460000000000000n+BigInt(++n*20+i)).toString()})),meta:{result_count:20,next_token:'unit-fixture-next-page'}});
 await assert.rejects(syncArticles({ARTICLES_KV:kv},{fetch:fetcher,now}));assert.deepEqual(JSON.parse(kv.values.get('x-articles:sync-state')),{historyDone:true},'never commit unseen-page cursor before feed publication');assert.deepEqual(JSON.parse(kv.values.get('x-articles:feed')),seed);
});
test('bounded continuation resumes before advancing the all-post watermark',async()=>{
 const kv=storage();let pages=0;const highest=2113469000000000000n;const initialBoundary=seed.articles.reduce((id,a)=>BigInt(a.postId)>BigInt(id)?a.postId:id,seed.articles[0].postId);
 await syncArticles({ARTICLES_KV:kv},{now,fetch:async u=>{const url=new URL(u);assert.equal(url.searchParams.get('since_id'),initialBoundary);const n=pages++;return json({data:Array.from({length:20},(_,i)=>({id:(highest-BigInt(n*20+i)).toString()})),meta:{result_count:20,next_token:'unit-next-'+pages}})}});
 assert.equal(pages,3);const pending=JSON.parse(kv.values.get('x-articles:sync-state'));assert.equal(pending.nextToken,'unit-next-3');assert.equal(pending.sinceId,initialBoundary);
 await syncArticles({ARTICLES_KV:kv},{now,fetch:async u=>{const url=new URL(u);assert.equal(url.searchParams.get('pagination_token'),'unit-next-3');assert.equal(url.searchParams.get('since_id'),initialBoundary);return json({data:[{id:(highest-61n).toString()}],meta:{result_count:1}})}});
 const completed=JSON.parse(kv.values.get('x-articles:sync-state'));assert.equal(completed.sinceId,highest.toString());assert.equal(completed.nextToken,null);
});
