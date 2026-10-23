import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
test('all three verified published issues retain exact canonical URLs and real local covers',()=>{
 const feed=JSON.parse(fs.readFileSync(new URL('public/science-issues.json',root)));assert.equal(feed.issues.length,3);assert.equal(new Set(feed.issues.map(i=>i.url)).size,3);
 for(const issue of feed.issues){const u=new URL(issue.url);assert.equal(u.origin,'https://tugrulguner.beehiiv.com');assert.equal(u.search,'');assert.ok(Number.isFinite(Date.parse(issue.publishedAt)));assert.match(issue.cover,/^\/newsletter\/[a-z]+\.webp$/);assert.ok(fs.statSync(new URL('public'+issue.cover,root)).size>0)}
 assert.ok(feed.issues.find(i=>i.content==='when-learning-happens-all-at-once').url.endsWith('when-learning-happens-all-at-oncest'));
});
test('generated science markup rejects drift and escapes source without changing X or essays',()=>{
 const temp=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'science-shelf-'));
 try{
  fs.mkdirSync(path.join(temp,'scripts'));fs.mkdirSync(path.join(temp,'public'));fs.cpSync(new URL('public/newsletter',root),path.join(temp,'public/newsletter'),{recursive:true});
  for(const f of ['scripts/build-science-issues.mjs','public/index.html','public/science-issues.json'])fs.copyFileSync(new URL(f,root),path.join(temp,f));
  const run=(...args)=>spawnSync(process.execPath,[path.join(temp,'scripts/build-science-issues.mjs'),...args],{encoding:'utf8'});
  assert.equal(run('--check').status,0);const file=path.join(temp,'public/science-issues.json'),data=JSON.parse(fs.readFileSync(file));data.issues[0].title='<script>test-source</script>';fs.writeFileSync(file,JSON.stringify(data));assert.notEqual(run('--check').status,0);
  const before=fs.readFileSync(path.join(temp,'public/index.html'),'utf8');assert.equal(run().status,0);assert.equal(run('--check').status,0);const after=fs.readFileSync(path.join(temp,'public/index.html'),'utf8');assert.ok(after.includes('&lt;script&gt;test-source&lt;/script&gt;'));assert.ok(!after.includes('<script>test-source</script>'));
  const x=html=>html.match(/<section class="x-articles"[\s\S]*?<\/section>/)?.[0];assert.equal(x(after),x(before));assert.equal(after.slice(after.indexOf('<div class="essay-spotlight">')),before.slice(before.indexOf('<div class="essay-spotlight">')));
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
test('Passionately Curious belongs to an independent science section, never the X/essay umbrella',()=>{
 const html=fs.readFileSync(new URL('public/index.html',root),'utf8');
 assert.ok(html.includes('id="science-newsletter"'),'Science newsletter needs its own editorial section');
 const science=html.match(/<section\b[^>]*\bid="science-newsletter"[^>]*>[\s\S]*?<\/section>/)?.[0];assert.ok(science);
 assert.ok(science.includes('Passionately Curious'));assert.ok(!science.includes('id="x-articles"'));assert.ok(!science.includes('essay-spotlight'));
 const marker=html.slice(html.indexOf('id="writing"')).match(/class="section-marker"[^>]*>([\s\S]*?)<\/div>/)?.[1];assert.ok(marker?.includes('Writing'));assert.ok(!marker?.includes('Passionately Curious'));
});
