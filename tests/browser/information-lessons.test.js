const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const{answerSituation}=require('./lesson-answers');
const base=process.env.SITE_TEST_BASE||'http://127.0.0.1:8765';
const additions=['lanes-merging','crossings-stops','road-speed','shared-areas'];
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const context=await browser.newContext({viewport:{width:390,height:900},isMobile:true,hasTouch:true});
 await context.addInitScript(()=>{if(location.protocol==='http:'){localStorage.setItem('wex-cookie-consent','essential');}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const response=await page.request.get(base+'/api/signs');assert.equal(response.status(),200);
  const payload=await response.json();assert.equal(payload.lessons.length,18);
  assert.equal(payload.signs.filter(s=>s.teaching.action).length,163);
  await page.goto(base+'/signs/lessons');
  await page.locator('[data-lesson-topic="road-rules"]').click();
  assert.equal(await page.locator('[data-lesson-card]:visible').count(),3);
  await page.locator('#lessonSearch').fill('жилые');
  assert.equal(await page.locator('[data-lesson-card="shared-areas"]:visible').count(),1);
  for(const id of additions){
   await page.goto(base+'/signs/lesson/'+id);await page.locator('[data-lang="en"]').click();
   const questions=await page.locator('#lessonQuestions').evaluate(e=>JSON.parse(e.textContent));assert(questions.length>=4&&questions.every(q=>q.kind==='statements'));
   const revision=await page.locator('#signLesson').getAttribute('data-revision');assert.equal(revision,'2026-10-21.situations1');
   await page.locator('.sl-stages [data-stage="situations"]').click();
   await answerSituation(page,questions[0],false);
   const saved=await page.evaluate(id=>localStorage.getItem('wexSignLesson:guest:'+id),id);
   const order=await page.locator('.lesson-statement').evaluateAll(els=>els.map(e=>e.textContent+'|'+e.getAttribute('aria-checked')));
   await page.reload();await page.locator('#lessonNext').waitFor();
   assert.equal(await page.evaluate(id=>localStorage.getItem('wexSignLesson:guest:'+id),id),saved);
   assert.deepEqual(await page.locator('.lesson-statement').evaluateAll(els=>els.map(e=>e.textContent+'|'+e.getAttribute('aria-checked'))),order);
   await page.locator('[data-lang="ru"]').click();
   assert.equal(await page.locator('.lesson-answer p').innerText(),questions[0].explanation.ru);
   assert.equal(await page.evaluate(id=>localStorage.getItem('wexSignLesson:guest:'+id),id),saved);
   await page.locator('#lessonNext').click();
   for(const q of questions.slice(1)){
    assert.equal(await page.locator('.lesson-question').innerText(),q.prompt.ru);
    await answerSituation(page,q);
    assert.equal(await page.locator('.lesson-answer p').innerText(),q.explanation.ru);
    await page.locator('#lessonNext').click();
   }
   const missOne=(questions.length-1)+'/'+questions.length,all=questions.length+'/'+questions.length;
   assert.equal(await page.locator('.lesson-score').innerText(),missOne);
   await page.reload();assert.equal(await page.locator('.lesson-score').innerText(),missOne);
   await page.locator('#lessonRetry').click();await answerSituation(page,questions[0]);await page.locator('#lessonNext').click();
   assert.equal(await page.locator('.lesson-score').innerText(),missOne);
   assert.match(await page.locator('.lesson-reviewed-score').innerText(),new RegExp(all));
   await page.goto(base+'/signs/lessons');assert.match(await page.locator(`[data-lesson-result="${id}"]`).innerText(),new RegExp(all));
  }
  console.log('OK 16 situations, EN/RU, reload, stable options, first score and missed-only review');
  for(const width of [320,390,1440]){
   await page.setViewportSize({width,height:900});
   for(const id of additions){
    assert.equal((await page.goto(base+'/signs/lesson/'+id)).status(),200);
    for(const image of await page.locator('.lesson-note img,.lesson-compare img,.lesson-photo img').all()){
     await image.evaluate(el=>el.decode());assert(await image.evaluate(el=>el.naturalWidth>0));
    }
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   }
  }
  await page.setViewportSize({width:390,height:900});await page.goto(base+'/signs/lesson/crossings-stops#sign-E17');
  const scene=page.locator('.lesson-photo [data-lesson-image]');await scene.click();
  await page.locator('.lbz-overlay.is-open').waitFor();await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-lesson-image')),true);
  await page.goto(base+'/login');await page.locator('#email').fill('browser1@example.com');await page.locator('#password').fill('BrowserTest123');await page.locator('#btn').click();await page.waitForURL('**/dashboard');
  await page.goto(base+'/study');
  for(const id of additions)assert.equal(await page.locator(`#studyLesson option[value="${id}"]`).count(),1);
  await page.goto(base+'/signs');await page.locator('#signsReviewed').check();
  assert.equal(await page.locator('.sign-card:visible').count(),163);
  await page.goto(base+'/signs/E34');await page.locator('[data-lang="en"]').click();
  assert.match(await page.locator('h1').innerText(),/Emergency/);assert.match(await page.locator('body').innerText(),/2029/);
  await page.goto(base+'/signs/lesson/shared-areas');
  await page.screenshot({path:path.join(__dirname,'information-areas-mobile.png'),animations:'disabled'});
  await page.locator('#navThemeBtn').click();await page.waitForTimeout(300);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:path.join(__dirname,'information-areas-mobile-alt.png'),animations:'disabled'});
  await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/signs/lesson/lanes-merging');
  await page.screenshot({path:path.join(__dirname,'information-lanes-desktop.png'),animations:'disabled'});
  assert.deepEqual(errors,[]);
  console.log('OK images and layout at 320/390/1440, scene dialog, study selection, reviewed filter, sources and themes');
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
