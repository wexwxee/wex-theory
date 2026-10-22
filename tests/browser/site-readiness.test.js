// Uses only serve_learning.py dummy accounts on localhost:8765.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.SITE_TEST_BASE||'http://127.0.0.1:8765';
 try{
  let events=0;page.on('request',r=>{if(r.url().includes('/api/activity/'))events++});
  await page.goto(base+'/');await page.locator('#cookieAcceptBtn').click();
  assert.equal(await page.evaluate(()=>window.hasAnalyticsConsent()),true);
  await page.reload();
  assert.equal(await page.locator('#cookieConsentBanner').isVisible(),false);
  await page.locator('.site-trust-links [data-cookie-settings]').click();
  await page.locator('#cookieEssentialBtn').click();
  assert.equal(await page.evaluate(()=>window.hasAnalyticsConsent()),false);
  await page.waitForTimeout(200);const afterWithdrawal=events;
  await page.evaluate(async()=>{await window.sendActivityPing('check');await window.sendJourneyEvent('important_click','study');});
  assert.equal(events,afterWithdrawal,'withdrawal stops subsequent analytics');
  const other=await context.newPage();await other.goto(base+'/privacy');
  await page.locator('.site-trust-links [data-cookie-settings]').click();await page.locator('#cookieAcceptBtn').click();
  await other.waitForFunction(()=>window.hasAnalyticsConsent());
  await other.locator('.site-trust-links [data-cookie-settings]').click();await other.locator('#cookieEssentialBtn').click();
  await page.waitForFunction(()=>!window.hasAnalyticsConsent());await other.close();
  console.log('OK cookie choice can be changed, withdrawn and shared across tabs');

  await page.goto(base+'/register');
  assert.match(await page.locator('.card-sub').innerText(),/purchased separately/);
  assert.equal(await page.locator('a[href="/privacy"]').count()>0,true);
  await page.locator('.site-trust-links [data-cookie-settings]').click();
  await page.locator('#cookieEssentialBtn').click();
  console.log('OK registration explains paid access and exposes privacy/settings');

  await page.goto(base+'/signs/lessons');
  assert.equal(await page.locator('[data-lesson-card]').count(),18);
  await page.locator('[data-lesson-card="priority"] [data-read-lesson]').click();await page.waitForURL('**/signs/lesson/priority');
  await page.goto(base+'/signs/learn?lesson=priority');await page.locator('#learnStage [data-code]').first().waitFor();
  assert.match(await page.locator('#learnScope').innerText(),/Lesson 02/);
  assert.equal(await page.locator('#sessionCounter').innerText(),'Question 1 of 7');
  const firstBottom=await page.locator('#learnStage [data-code]').first().evaluate(e=>e.getBoundingClientRect().bottom);
  assert(firstBottom<=844,`first answer should fit mobile viewport, got ${firstBottom}`);
  const firstQuestion=await page.locator('#learnStage').innerHTML();
  await page.locator('#learnStage [data-code]').first().click();await page.locator('#nextBtn').click();
  const secondQuestion=await page.locator('#learnStage').innerHTML();assert.notEqual(secondQuestion,firstQuestion);
  await page.reload();await page.locator('#learnStage [data-code]').first().waitFor();
  assert.equal(await page.locator('#sessionCounter').innerText(),'Question 2 of 7');
  assert.equal(await page.locator('#learnStage').innerHTML(),secondQuestion);

  const options=await page.locator('#learnStage [data-code]').evaluateAll(es=>es.map(e=>e.dataset.code));
  await page.locator('#learnStage [data-code]').first().click();
  const progress=await page.evaluate(()=>localStorage.getItem('wexSignsProgress'));
  const score=await page.locator('#sessionScore').innerText();
  await page.reload();await page.locator('#nextBtn').waitFor();
  assert.deepEqual(await page.locator('#learnStage .learn-option, #learnStage .image-option').evaluateAll(es=>es.map(e=>e.dataset.code)),options);
  assert.equal(await page.locator('#sessionScore').innerText(),score);
  assert.equal(await page.evaluate(()=>localStorage.getItem('wexSignsProgress')),progress,'restoring an answer must not grade twice');
  await page.locator('[data-lang="ru"]').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('wexSignsProgress')),progress);
  await page.screenshot({path:path.join(__dirname,'signs-recovery-mobile.png'),fullPage:true});
  await page.locator('#practiceSettings summary').click();
  page.once('dialog',d=>d.dismiss());await page.locator('#learnReset').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('wexSignsProgress')),progress);
  page.once('dialog',d=>d.accept());await page.locator('#learnReset').click();
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('wexSignsProgress'))),{});
  console.log('OK lessons, mobile action, exact round/options recovery, no double grading, reset confirmation');

  await page.goto(base+'/login');await page.locator('#email').fill('browser3@example.com');await page.locator('#password').fill('BrowserTest123');await page.locator('#btn').click();await page.waitForURL('**/dashboard');
  await page.goto(base+'/signs/learn?lesson=priority');await page.locator('#learnStage [data-code]').first().waitFor();
  assert.match(await page.locator('#sessionCounter').innerText(),/^(Question 1 of 7|Вопрос 1 из 7)$/,'another account must not inherit the guest round');
  await page.goto(base+'/dashboard');
  assert.equal(await page.locator('body').innerText().then(t=>/AI wording not added yet|Not available/.test(t)),false);
  assert.equal(await page.locator('a[href="/signs/lessons"]').count()>0,true);
  assert.deepEqual(errors,[]);
  console.log('OK account isolation, useful dashboard and no JavaScript errors');
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
