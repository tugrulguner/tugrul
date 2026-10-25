import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url);
const {chromium}=require('@playwright/test');
let processHandle,origin,browser,logs='',state;
before(async()=>{
 const tmp=process.env.TMPDIR||path.join(root,'.wrangler','test-tmp');await fs.mkdir(tmp,{recursive:true});state=await fs.mkdtemp(path.join(tmp,'article-stack-'));
 processHandle=spawn(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),'dev','--local','--test-scheduled','--port','0','--inspector-port','0','--ip','127.0.0.1','--persist-to',state,'--show-interactive-dev-session=false'],{cwd:root,env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Worker readiness timeout: '+logs)),45000);const consume=data=>{logs+=data;const match=logs.match(/Ready on (http:\/\/127\.0\.0\.1:\d+)/);if(match){origin=match[1];clearTimeout(timer);resolve();}};processHandle.stdout.on('data',consume);processHandle.stderr.on('data',consume);processHandle.once('error',e=>{clearTimeout(timer);reject(e)});processHandle.once('exit',code=>{if(!origin){clearTimeout(timer);reject(Error('Worker exited '+code+': '+logs));}});});
 browser=await chromium.launch();
},{timeout:55000});
after(async()=>{await browser?.close();if(processHandle&&processHandle.exitCode===null){processHandle.kill('SIGTERM');await Promise.race([new Promise(r=>processHandle.once('exit',r)),new Promise(r=>setTimeout(r,5000))]);if(processHandle.exitCode===null)processHandle.kill('SIGKILL');}if(state)await fs.rm(state,{recursive:true,force:true});});
test('actual workerd serves a safe public seed feed and static website/PDF routes',async()=>{
 const response=await fetch(origin+'/api/x-articles');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/json/);const feed=await response.json();assert.equal(feed.schemaVersion,1);assert.equal(feed.articles.length,JSON.parse(await fs.readFile(path.join(root,'public/x-articles.json'),'utf8')).articles.length);assert.ok(feed.articles.every(a=>a.title&&/^https:\/\/x\.com\/i\/article\/\d+$/.test(a.url)));assert.doesNotMatch(JSON.stringify(feed),/access_token|refresh_token|client_secret/);
 const page=await fetch(origin+'/');assert.equal(page.status,200);assert.match(await page.text(),/x-articles/);const pdf=await fetch(origin+'/tugrul-guner-resume.pdf');assert.equal(pdf.status,200);assert.deepEqual(Buffer.from(await pdf.arrayBuffer()),await fs.readFile(path.join(root,'public/tugrul-guner-resume.pdf')));const missing=await fetch(origin+'/definitely-missing-resource');assert.equal(missing.status,404);
});
test('scheduled event fails closed without deployed OAuth secrets',async()=>{
 const r=await fetch(origin+'/__scheduled?cron=0%209%20*%20*%20*');assert.equal(r.status,200);const cached=await(await fetch(origin+'/api/x-articles')).json();assert.ok(cached.articles.length>=3);
});
test('real local KV publication replaces the seed at the public Worker boundary',async()=>{
 const seed=JSON.parse(await fs.readFile(path.join(root,'public/x-articles.json'),'utf8'));const stored={...seed,updatedAt:new Date().toISOString()};const fixture=path.join(state,'feed-fixture.json');await fs.writeFile(fixture,JSON.stringify(stored));let output='';const child=spawn(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),'kv','key','put','x-articles:feed','--binding','ARTICLES_KV','--local','--persist-to',state,'--path',fixture],{cwd:root,env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);const code=await new Promise((r,j)=>{child.once('error',j);child.once('exit',r)});assert.equal(code,0,output);const published=await(await fetch(origin+'/api/x-articles')).json();assert.deepEqual(published,stored);const unified=await(await fetch(origin+'/api/articles')).json();assert.equal(unified.articles.length,stored.articles.length);assert.equal(unified.articles.filter(a=>a.substackUrl).length,4);
});
test('actual public refresh route cannot trigger metered sync without authorization',async()=>{
 const r=await fetch(origin+'/api/x-articles/refresh',{method:'POST'});assert.ok([401,403,404].includes(r.status));assert.doesNotMatch(await r.text(),/client_secret|refresh_token|access_token/);
});
test('actual Worker stack renders published article cover and feed at desktop/mobile without live analytics',async()=>{
 for(const width of[320,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});await context.route('**/*',r=>r.request().method()==='POST'||r.request().url().includes('posthog.com')?r.abort():r.continue());const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const requests=[];page.on('request',r=>{if(r.url().includes('api.x.com'))requests.push(r.url())});await page.goto(origin,{waitUntil:'domcontentloaded'});const section=page.locator('#x-articles');await section.waitFor();await page.waitForFunction(()=>document.querySelector('#x-articles')?.dataset.feedState==='live');assert.equal(await section.locator('[data-article-id]').count(),JSON.parse(await fs.readFile(path.join(root,'public/x-articles.json'),'utf8')).articles.length);await section.locator('.x-archive summary').click();assert.equal(await section.locator('.x-archive [data-article-id]:visible').count(),JSON.parse(await fs.readFile(path.join(root,'public/x-articles.json'),'utf8')).articles.length-6);await section.scrollIntoViewIfNeeded();await section.locator('.x-featured img').evaluate(i=>i.decode());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);await section.screenshot({path:path.join(process.env.ARTICLE_EVIDENCE_DIR||state,'worker-stack-'+width+'.png')});await context.close();
 }
});
