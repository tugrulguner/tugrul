import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
const root=resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;const file=resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));if(!file.startsWith(root+sep))throw Error('invalid path');const content=await readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html','.css':'text/css','.jpg':'image/jpeg','.pdf':'application/pdf','.json':'application/json'})[extname(file)]??'application/octet-stream'});res.end(content);}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}`;
const evidence=process.env.PROFILE_EVIDENCE_DIR;
if(evidence)await mkdir(evidence,{recursive:true});
const browser=await chromium.launch();
try{
for(const viewport of [{width:320,height:800},{width:390,height:844},{width:768,height:1024},{width:1440,height:1000}]){
 const context=await browser.newContext({viewport,reducedMotion:'reduce'});
 // Keep acceptance probes out of production analytics; do not load the external SDK.
 await context.route('**/*posthog.com/**',r=>r.abort());
 const page=await context.newPage();await page.goto(url);await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'horizontal overflow');
 const buttons=page.locator('.hero-actions a');assert.equal(await buttons.count(),2);
 for(const button of await buttons.all()){const box=await button.boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=viewport.height,`${viewport.width}px primary action below first fold: ${JSON.stringify(box)}`);assert.ok(box.height>=44,'action hit target');}
 const socials=page.locator('.hero-social a');assert.deepEqual(await socials.allTextContents(),['X','LinkedIn','GitHub','Newsletter']);
 for(const social of await socials.all()){const box=await social.boundingBox();assert.ok(box&&box.height>=44&&box.y+box.height<=viewport.height,'social visibility/target');}
 const results=page.locator('#leadership-results');assert.equal(await results.count(),1);
 const proof=await results.boundingBox();const portrait=await page.locator('.portrait-frame').boundingBox();
 if(viewport.width<=850)assert.ok(proof.y+proof.height<=portrait.y,'mobile evidence must precede portrait');
 const metricBoxes=await page.locator('.spotlight-metrics > div').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width};}));
 assert.equal(metricBoxes.length,4);assert.ok(Math.abs(metricBoxes[0].y-metricBoxes[1].y)<1,'two-column metric row');assert.ok(metricBoxes[2].y>metricBoxes[0].y,'second metric row');
 await page.locator('.hero-actions a[href="#leadership-results"]').click();
 const after=await results.boundingBox();assert.ok(after.y>=0&&after.y<viewport.height,'results CTA must reach actual evidence');
 await page.goto(url);await page.keyboard.press('Tab');assert.equal(await page.locator('.skip-link').evaluate(e=>document.activeElement===e),true,'keyboard skip access');
 const download=await context.request.get(url+'/tugrul-guner-resume.pdf');assert.equal(download.status(),200);assert.ok((await download.body()).subarray(0,5).equals(Buffer.from('%PDF-')),'real PDF');
 if(evidence){await page.goto(url);await page.screenshot({path:resolve(evidence,`hero-${viewport.width}.png`)});await page.screenshot({path:resolve(evidence,`full-${viewport.width}.png`),fullPage:true});await results.screenshot({path:resolve(evidence,`results-${viewport.width}.png`)});await page.locator('.timeline-item--group').screenshot({path:resolve(evidence,`quotograph-${viewport.width}.png`)});}
 const roleCards=page.locator('.timeline-role');assert.equal(await roleCards.count(),2);
 for(const role of await roleCards.all()){const box=await role.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=viewport.width,'grouped role clipping');}
 const projects=page.locator('.project-list > a.project');assert.equal(await projects.count(),6,'current ModePot inventory');
 for(const project of await projects.all()){const box=await project.boundingBox();const desc=await project.locator('.project-description').boundingBox();const name=await project.locator('.project-name').boundingBox();const arrow=await project.locator('.arrow').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=viewport.width&&box.height>=44,'project link clipping/target');assert.ok(desc.x>=0&&desc.x+desc.width<=viewport.width,'project description clipping');assert.ok(arrow.x>=name.x+name.width&&arrow.y<name.y+name.height&&arrow.y+arrow.height>name.y,'project arrow stays beside its title');}
 if(evidence){await page.locator('#hero-title').click();await page.locator('.project-list').screenshot({path:resolve(evidence,`modepot-${viewport.width}.png`)});}
 const writingX=page.locator('#writing a[data-posthog-network="x"]');assert.equal(await writingX.count(),1);assert.equal(await writingX.getAttribute('href'),'https://x.com/Tugrul_Guner');const writingBox=await writingX.boundingBox();assert.ok(writingBox.height>=44&&writingBox.x>=0&&writingBox.x+writingBox.width<=viewport.width,'writing X link target/clipping');
 if(evidence){await writingX.screenshot({path:resolve(evidence,`writing-x-${viewport.width}.png`)});}
 await page.goto(url);
 console.log(`Profile hierarchy ${viewport.width}px: passed; primary actions ${JSON.stringify(await buttons.evaluateAll(els=>els.map(e=>({label:e.textContent.trim(),bottom:e.getBoundingClientRect().bottom}))))}`);
 await context.close();
}
}finally{await browser.close();await new Promise(r=>server.close(r));}
