import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncArticles,normalizeFeed} from '../worker/index.mjs';
const seed=JSON.parse(fs.readFileSync(new URL('../public/x-articles.json',import.meta.url)));
const captured=JSON.parse(fs.readFileSync(new URL('./fixtures/x-article-search.json',import.meta.url)));
const source='article-search-v1';
const store=state=>{const values=new Map([['x-articles:feed',JSON.stringify(seed)],['x-articles:oauth',JSON.stringify({accessToken:'unit-placeholder',refreshToken:'unit-placeholder',expiresAt:Date.now()+60*60*1000})],['x-articles:sync-state',JSON.stringify(state||{})]]);return {values,get:async k=>values.get(k)||null,put:async(k,v)=>values.set(k,v)}};
const empty=()=>Response.json({meta:{result_count:0}});
const newest=seed.articles.reduce((id,a)=>BigInt(a.postId)>BigInt(id)?a.postId:id,seed.articles[0].postId);
test('all discovery uses a fixed Article URL search, never the ordinary timeline',async()=>{
 const kv=store();const calls=[];await syncArticles({ARTICLES_KV:kv},{fetch:async u=>{const url=new URL(u);calls.push(url);assert.equal(url.origin,'https://api.x.com');assert.equal(url.pathname,'/2/tweets/search/all');assert.equal(url.searchParams.get('query'),captured.provenance.query);assert.equal(url.searchParams.has('exclude'),false);assert.equal(url.searchParams.get('expansions'),'article.cover_media');return empty()}});assert.equal(calls.length,2);
});
test('legacy timeline watermarks/tokens cannot contaminate the search checkpoint',async()=>{
 const kv=store({sinceId:'2999999999999999999',nextToken:'legacy-timeline-cursor',newestId:'2999999999999999999',historyDone:true,historyToken:'legacy-history-cursor'});const calls=[];await syncArticles({ARTICLES_KV:kv},{fetch:async u=>{const url=new URL(u);calls.push(url);assert.equal(url.searchParams.has('next_token'),false);assert.equal(url.searchParams.has('pagination_token'),false);return empty()}});assert.equal(calls[0].searchParams.get('since_id'),newest);const state=JSON.parse(kv.values.get('x-articles:sync-state'));assert.equal(state.source,source);assert.equal(state.historyDone,true);
});
test('search pagination uses next_token with source-versioned progress',async()=>{
 const kv=store({source,sinceId:newest,historyDone:true});let calls=0;await syncArticles({ARTICLES_KV:kv},{fetch:async u=>{const url=new URL(u);assert.equal(url.searchParams.has('pagination_token'),false);calls++;if(calls===1)return Response.json({meta:{result_count:0,next_token:'search-page-2'}});assert.equal(url.searchParams.get('next_token'),'search-page-2');return empty()}});assert.equal(calls,2);assert.equal(JSON.parse(kv.values.get('x-articles:sync-state')).nextToken,null);
});
test('search authorization failures retain the baseline without broad-timeline fallback',async()=>{
 const kv=store({source,historyDone:true});const before=kv.values.get('x-articles:feed');let calls=0;await assert.rejects(syncArticles({ARTICLES_KV:kv},{fetch:async u=>{calls++;assert.equal(new URL(u).pathname,'/2/tweets/search/all');return new Response('',{status:403})}}),error=>error.status===403);assert.equal(calls,1);assert.equal(kv.values.get('x-articles:feed'),before);
});
test('older matching references cannot overwrite newer Article metadata',async()=>{
 const kv=store(),original=seed.articles[1];await syncArticles({ARTICLES_KV:kv},{fetch:async u=>new URL(u).searchParams.has('until_id')?Response.json({data:[{id:'2100000000000000001',created_at:'2026-09-01T00:00:00Z',article:{title:'Older reference must not replace the publication',preview_text:'Older reference.'},entities:{urls:[{expanded_url:original.url}]}}],meta:{result_count:1}}):empty()});const record=JSON.parse(kv.values.get('x-articles:feed')).articles.find(a=>a.id===original.id);assert.equal(record.postId,original.postId);assert.equal(record.title,original.title);
});
test('captured complete filtered search returns all nine verified Articles with covers',()=>{
 const articles=normalizeFeed(captured.pages.flatMap(p=>p.data),captured.pages.flatMap(p=>p.includes.media||[])).articles;assert.equal(captured.provenance.finalHasMore,false);assert.equal(captured.provenance.returnedPosts,9);assert.deepEqual(new Set(articles.map(a=>a.id)),new Set(seed.articles.map(a=>a.id)));assert.ok(articles.every(a=>a.cover));
});
