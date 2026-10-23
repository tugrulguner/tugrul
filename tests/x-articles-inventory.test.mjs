import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {normalizeFeed,syncArticles} from '../worker/index.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const seed=JSON.parse(fs.readFileSync(new URL('../public/x-articles.json',import.meta.url)));
test('baseline includes every Article from exhausted captured provider pagination',()=>{
 const captured=JSON.parse(fs.readFileSync(new URL('./fixtures/x-article-inventory.json',import.meta.url)));assert.equal(captured.provenance.finalHasMore,false);const expected=normalizeFeed(captured.data,captured.includes.media).articles;assert.equal(expected.length,9);for(const a of expected){const record=seed.articles.find(x=>x.id===a.id);assert.ok(record,`missing verified Article: ${a.title}`);assert.equal(record.url,a.url);assert.equal(record.cover.url,a.cover.url);}
});
test('static article HTML cannot drift from the complete baseline',()=>{
 execFileSync(process.execPath,['scripts/build-x-articles.mjs','--check'],{cwd:root,stdio:'pipe'});
});
test('recorded 454-Post history recovers all nine Articles from the old three-item baseline',async t=>{
 const captured=JSON.parse(fs.readFileSync(new URL('./fixtures/x-article-inventory.json',import.meta.url)));
 const posts=[...captured.data,...captured.ordinaryPostIds.map(id=>({id}))].sort((a,b)=>BigInt(a.id)>BigInt(b.id)?-1:1);
 const initial={...seed,articles:seed.articles.slice(0,3)},now=new Date();const values=new Map([['x-articles:feed',JSON.stringify(initial)],['x-articles:oauth',JSON.stringify({accessToken:'replay-placeholder',refreshToken:'replay-placeholder',expiresAt:now.getTime()+60*60*1000})]]);const kv={get:async k=>values.get(k)||null,put:async(k,v)=>values.set(k,v)};let runs=0;
 while(runs<32){let requests=0,returned=0;await syncArticles({ARTICLES_KV:kv,ASSETS:{fetch:async()=>Response.json(initial)}},{now,fetch:async u=>{requests++;const url=new URL(u);let eligible=posts.filter(p=>(!url.searchParams.has('since_id')||BigInt(p.id)>BigInt(url.searchParams.get('since_id')))&&(!url.searchParams.has('until_id')||BigInt(p.id)<BigInt(url.searchParams.get('until_id'))));const offset=Number(url.searchParams.get('pagination_token')||0),page=eligible.slice(offset,offset+20);returned+=page.length;const meta={result_count:page.length};if(offset+page.length<eligible.length)meta.next_token=String(offset+page.length);return Response.json({data:page,meta,includes:captured.includes})}});assert.ok(requests<=3&&returned<=60,'history cannot increase the approved daily read bound');runs++;if(JSON.parse(values.get('x-articles:sync-state')).historyDone)break;}
 assert.equal(JSON.parse(values.get('x-articles:sync-state')).historyDone,true);const final=JSON.parse(values.get('x-articles:feed'));assert.deepEqual(new Set(final.articles.map(a=>a.id)),new Set(seed.articles.map(a=>a.id)));assert.ok(final.articles.every(a=>a.cover));t.diagnostic(`Recovered ${final.articles.length} verified Articles in ${runs} bounded replay invocations; no live X requests.`);
});
test('article generator escapes source text and only replaces its bounded section',()=>{
 const tmp=process.env.TMPDIR||path.join(root,'.wrangler','test-tmp');fs.mkdirSync(tmp,{recursive:true});const dir=fs.mkdtempSync(path.join(tmp,'article-generator-'));
 try{fs.mkdirSync(path.join(dir,'public'));fs.mkdirSync(path.join(dir,'scripts'));fs.copyFileSync(new URL('../scripts/build-x-articles.mjs',import.meta.url),path.join(dir,'scripts/build-x-articles.mjs'));const data=structuredClone(seed);data.articles[0].title='<img src=x onerror="bad()">';data.articles[0].excerpt='<script>bad()</script> is untrusted source text.';const before='<main id="unchanged-before">Newsletter</main>';const after='<footer id="unchanged-after">Career</footer>';fs.writeFileSync(path.join(dir,'public/index.html'),before+'<section class="x-articles" id="x-articles"></section>'+after);fs.writeFileSync(path.join(dir,'public/x-articles.json'),JSON.stringify(data));execFileSync(process.execPath,[path.join(dir,'scripts/build-x-articles.mjs')],{cwd:dir,stdio:'pipe'});const html=fs.readFileSync(path.join(dir,'public/index.html'),'utf8');assert.ok(html.startsWith(before)&&html.endsWith(after));assert.ok(html.includes('&lt;img src=x onerror=&quot;bad()&quot;&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('<summary>Older articles</summary>'));assert.equal((html.match(/data-article-id=/g)||[]).length,seed.articles.length);}finally{fs.rmSync(dir,{recursive:true,force:true})}
});
