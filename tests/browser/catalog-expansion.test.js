const{chromium}=require('playwright');const{answerSituation}=require('./lesson-answers');const assert=require('node:assert/strict');const path=require('node:path');
const base=process.env.SITE_TEST_BASE||'http://127.0.0.1:8765';
(async()=>{const b=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await c.addInitScript(()=>localStorage.setItem('wex-cookie-consent','essential'));const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 const payload=await(await p.request.get(base+'/api/signs')).json();assert.equal(payload.lessons.length,18);assert.equal(payload.signs.filter(s=>s.teaching.action).length,163);
 for(const width of[320,390,1440]){await p.setViewportSize({width,height:900});for(const lesson of payload.lessons){assert.equal((await p.goto(base+'/signs/lesson/'+lesson.id)).status(),200);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}}
 await p.setViewportSize({width:390,height:844});
 for(const id of['vehicle-limits','subpanels','passage-paths']){
  await p.goto(base+'/signs/lesson/'+id);const qs=await p.locator('#lessonQuestions').evaluate(e=>JSON.parse(e.textContent));assert(qs.length>=4&&qs.every(q=>q.kind==='statements'));await p.locator('[data-lang="ru"]').click();await p.locator('.sl-stages [data-stage="situations"]').click();
  for(const q of qs){await answerSituation(p,q);await p.locator('#lessonNext').click();}
  assert.equal(await p.locator('.lesson-score').innerText(),qs.length+'/'+qs.length);await p.reload();assert.equal(await p.locator('.lesson-score').innerText(),qs.length+'/'+qs.length);
 }
 console.log('OK eighteen lessons at three widths and all three new situation checks in Russian, including reload');
 await p.goto(base+'/signs');assert.equal(await p.locator('.sign-card:visible').count(),266);await p.locator('#signsReviewed').check();assert.equal(await p.locator('.sign-card:visible').count(),163);await p.reload();assert.equal(await p.locator('#signsReviewed').isChecked(),true);assert.equal(await p.locator('.sign-card:visible').count(),163);
 await p.locator('[data-group="D"].signs-chip').click();assert.equal(await p.locator('.sign-card:visible').count(),25);await p.locator('#signsSearch').fill('всадники');assert((await p.locator('.sign-card:visible').count())>0);assert.deepEqual(await p.locator('.sign-card:visible').evaluateAll(es=>[...new Set(es.map(e=>e.dataset.reviewed))]),['true']);
 await p.locator('#signsSearch').fill('nothing-matches-this');await p.locator('#signsEmpty').waitFor();await p.locator('#signsSearch').fill('D26.1');await p.locator('.sign-card:visible').first().click();await p.getByRole('heading',{name:'Пешеходы слева, всадники справа',exact:true}).waitFor();
 await p.screenshot({path:path.join(__dirname,'catalog-path-mobile.png'),fullPage:true,animations:'disabled'});
 await p.goto(base+'/signs/lesson/subpanels#lessonCompare');await p.locator('.lesson-compare').first().scrollIntoViewIfNeeded();await p.screenshot({path:path.join(__dirname,'subpanels-mobile.png'),animations:'disabled'});
 assert.deepEqual(errors,[]);console.log('OK checked-note filter, restored controls, group/search intersection, corrected variant detail and no JS errors');
 }finally{await c.close();await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
