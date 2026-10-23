import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syncArticles} from '../worker/index.mjs';
test('bootstrap starts at oldest real seed article rather than crawling account history',async()=>{
 const seed=JSON.parse(readFileSync(new URL('../public/x-articles.json',import.meta.url)));const now=new Date();const values=new Map([['x-articles:oauth',JSON.stringify({accessToken:'unit-placeholder',refreshToken:'unit-placeholder',expiresAt:now.getTime()+3600000})]]);const kv={get:async k=>values.get(k)||null,put:async(k,v)=>values.set(k,v)};const oldest=seed.articles.reduce((id,a)=>BigInt(a.postId)<BigInt(id)?a.postId:id,seed.articles[0].postId);let calls=0;
 await syncArticles({ARTICLES_KV:kv,ASSETS:{fetch:async()=>Response.json(seed)}},{now,fetch:async u=>{calls++;assert.equal(new URL(u).searchParams.get('since_id'),(BigInt(oldest)-1n).toString());return Response.json({meta:{result_count:0}})}});assert.equal(calls,1);assert.equal(JSON.parse(values.get('x-articles:feed')).articles.length,3);
});
