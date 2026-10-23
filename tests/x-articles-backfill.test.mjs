import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker,{syncArticles,normalizeFeed} from '../worker/index.mjs';
const seed={schemaVersion:1,updatedAt:'2026-10-23T00:00:00.000Z',articles:[{id:'2113450673068965888',postId:'2113455187515916724',title:'Seed',excerpt:'Seed preview.',publishedAt:'2026-10-23T02:19:17.000Z',url:'https://x.com/i/article/2113450673068965888',cover:null}]};
const now=new Date('2026-10-24T12:00:00Z');
const store=()=>{const values=new Map([['x-articles:feed',JSON.stringify(seed)],['x-articles:oauth',JSON.stringify({accessToken:'unit-fixture',refreshToken:'unit-fixture',expiresAt:now.getTime()+72*60*60*1000})]]);return {values,get:async k=>values.get(k)||null,put:async(k,v)=>values.set(k,v)}};
const article=(pid,id,title)=>({id:pid,created_at:'2026-10-20T00:00:00Z',article:{title,preview_text:title},entities:{urls:[{expanded_url:`https://x.com/i/article/${id}`}]}});
const empty=()=>Response.json({meta:{result_count:0}});
test('backfill discovers older Article independently of the newest-post watermark',async()=>{
 const kv=store(),calls=[];await syncArticles({ARTICLES_KV:kv},{now,fetch:async u=>{const x=new URL(u);calls.push(x);return x.searchParams.has('until_id')?Response.json({data:[article('2110000000000000001','2110000000000000011','Older')],meta:{result_count:1}}):empty()}});
 assert.equal(calls.length,2);assert.equal(calls[0].searchParams.get('since_id'),seed.articles[0].postId);assert.equal(calls[1].searchParams.get('until_id'),seed.articles[0].postId);assert.ok(JSON.parse(kv.values.get('x-articles:feed')).articles.some(a=>a.id==='2110000000000000011'));
});
test('foreground and history together cannot exceed three pages / 60 returned Posts',async()=>{
 const kv=store();let foreground=0,total=0,history=0;await syncArticles({ARTICLES_KV:kv},{now,fetch:async u=>{const x=new URL(u),old=x.searchParams.has('until_id');old?history++:foreground++;const base=old?2110000000000000000n:2114000000000000000n;const data=Array.from({length:20},(_,i)=>({id:(base+BigInt(i+foreground*20)).toString()}));total+=data.length;assert.equal(x.searchParams.get('max_results'),'20');return Response.json({data,meta:{result_count:20,next_token:old?'history-next':'fresh-'+foreground}})}});
 assert.equal(foreground,2);assert.equal(history,1);assert.equal(total,60);const state=JSON.parse(kv.values.get('x-articles:sync-state'));assert.equal(state.historyToken,'history-next');assert.equal(state.nextToken,'fresh-2');
});
test('completed history does not make further history calls',async()=>{
 const kv=store();kv.values.set('x-articles:sync-state',JSON.stringify({source:'article-search-v1',sinceId:seed.articles[0].postId,newestId:null,nextToken:null,historyDone:true,historyToken:null}));let calls=0;await syncArticles({ARTICLES_KV:kv},{now,fetch:async()=>{calls++;return empty()}});assert.equal(calls,1);
});
test('a failed history page cannot block successful new-Article publication',async()=>{
 const kv=store();kv.values.set('x-articles:sync-state',JSON.stringify({source:'article-search-v1',sinceId:seed.articles[0].postId,historyDone:false,historyToken:'pending-history',historyUntilId:seed.articles[0].postId}));const result=await syncArticles({ARTICLES_KV:kv},{now,fetch:async u=>new URL(u).searchParams.has('until_id')?new Response('',{status:503}):Response.json({data:[article('2114000000000000001','2114000000000000011','New article')],meta:{result_count:1}})});assert.equal(result.historyDeferred,true);assert.ok(JSON.parse(kv.values.get('x-articles:feed')).articles.some(a=>a.title==='New article'));const state=JSON.parse(kv.values.get('x-articles:sync-state'));assert.equal(state.sinceId,'2114000000000000001');assert.equal(state.historyToken,'pending-history');assert.equal(state.historyDone,false);
});
test('expired history pagination resets only history without losing fresh progress',async()=>{
 const kv=store();kv.values.set('x-articles:sync-state',JSON.stringify({source:'article-search-v1',sinceId:seed.articles[0].postId,historyDone:false,historyToken:'expired',historyUntilId:seed.articles[0].postId}));await syncArticles({ARTICLES_KV:kv},{now,fetch:async u=>new URL(u).searchParams.has('until_id')?new Response('',{status:400}):empty()});const state=JSON.parse(kv.values.get('x-articles:sync-state'));assert.equal(state.historyToken,null);assert.equal(state.historyDone,false);assert.equal(state.sinceId,seed.articles[0].postId);
});
test('publication failure cannot commit either discovery cursor',async()=>{
 const kv=store();const put=kv.put;kv.put=async(k,v)=>{if(k==='x-articles:feed')throw Error('unit storage failure');return put(k,v)};await assert.rejects(syncArticles({ARTICLES_KV:kv},{now,fetch:async()=>empty()}));assert.equal(kv.values.has('x-articles:sync-state'),false);
});
test('an older cached feed cannot hide newly backfilled baseline records',async()=>{
 const full=JSON.parse(fs.readFileSync(new URL('../public/x-articles.json',import.meta.url)));const kv=store();kv.values.set('x-articles:feed',JSON.stringify({...full,articles:full.articles.slice(0,3)}));const env={ARTICLES_KV:kv,ASSETS:{fetch:async()=>Response.json(full)}};const response=await worker.fetch(new Request('https://site.test/api/x-articles'),env);assert.equal((await response.json()).articles.length,full.articles.length);await syncArticles(env,{now,fetch:async()=>empty()});assert.equal(JSON.parse(kv.values.get('x-articles:feed')).articles.length,full.articles.length);
});
test('ordinary posts linking to Articles without Article metadata are ignored safely',()=>{
 const post={id:'2114000000000000001',created_at:now.toISOString(),entities:{urls:[{expanded_url:seed.articles[0].url}]}};assert.deepEqual(normalizeFeed([post]).articles,[]);
});
