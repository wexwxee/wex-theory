const {chromium}=require('playwright');
const {answerSituation}=require('./lesson-answers');
const assert=require('node:assert/strict');
const path=require('node:path');
const base=process.env.SITE_TEST_BASE||'http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark'});
 await context.addInitScript(()=>{if(location.protocol==='http:')localStorage.setItem('wex-cookie-consent','essential');});
 const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 async function snapshot(name){await p.screenshot({path:path.join(__dirname,'navigation-'+name+'.png'),fullPage:true,animations:'disabled'});}
 try{
  await p.goto(base+'/login');assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');
  await p.locator('#email').fill('browser2@example.com');await p.locator('#password').fill('BrowserTest123');await p.locator('#btn').click();await p.waitForURL('**/dashboard');
  assert.equal(await p.locator('.learning-entry-card').count(),3);assert.equal(await p.getByText('Worth practising',{exact:true}).count(),0);assert.equal(await p.getByText('Recent full tests',{exact:true}).count(),0);
  assert.equal(await p.locator('.logo').evaluate(e=>getComputedStyle(e,'::after').content),'none');
  await snapshot('dashboard');
  await p.locator('#dashboardBurgerBtn').click();const signs=p.locator('#sidebar a[href^="/signs"]');assert.equal(await signs.count(),1);await p.keyboard.press('Escape');
  await p.goto(base+'/study');assert.equal(await p.locator('#studyLesson').isVisible(),false);assert.equal(await p.locator('#studyTopics').getAttribute('open'),null);
  await snapshot('study');await p.locator('#studyTopics summary').click();assert.equal(await p.locator('[data-study-choice]').count(),18);
  await snapshot('topic-picker');await p.locator('[data-study-choice="crossings-stops"]').click();
  assert.match(await p.locator('#studySelectedTitle').innerText(),/Crossings/);assert.equal(await p.locator('[data-study-choice="crossings-stops"]').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('#studyTopics').getAttribute('open'),null);
  await p.locator('#studyStart').click();await p.locator('[data-study-step="words"]').click();await p.locator('.ew-option').first().waitFor();
  for(let i=0;i<10;i++){await p.locator('.ew-option').first().click();await p.locator('[data-role="next"]').click();}
  await p.locator('[data-study-return]').click();assert.equal(await p.locator('#studySessionCount').innerText(),'1 of 2 steps checked');
  await p.locator('[data-study-step="signs"]').click();await p.locator('.sl-stages [data-stage="situations"]').click();const questions=await p.locator('#lessonQuestions').evaluate(e=>JSON.parse(e.textContent));
  for(const q of questions){await answerSituation(p,q);await p.locator('#lessonNext').click();}
  await p.locator('[data-study-return]').click();assert.equal(await p.locator('#studySessionCount').innerText(),'2 of 2 steps checked');
  await p.reload();assert.equal(await p.locator('#studySessionCount').innerText(),'2 of 2 steps checked');
  p.once('dialog',d=>d.accept());await p.locator('#studyNew').click();await p.locator('#studyCancelNew').click();assert.equal(await p.locator('#studySessionCount').innerText(),'2 of 2 steps checked');
  console.log('OK compact dashboard, one signs menu item, no wordmark punctuation, visual picker, real words/lesson completion and persistent first summary');
  const routes=['/dashboard','/study','/signs/lessons','/signs/lesson/lanes-merging','/signs','/signs/learn?lesson=priority','/signs/E45'];
  for(const width of [320,390,1440]){
   await p.setViewportSize({width,height:900});
   for(const theme of ['light','dark']){
    await p.evaluate(theme=>localStorage.setItem('wex-theme-v2',theme),theme);
    for(const route of routes){await p.goto(base+route);assert.equal(await p.locator('html').getAttribute('data-theme'),theme);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' '+width+' '+theme);
     if(route.startsWith('/signs')){assert.equal(await p.locator('.learning-navigation').count(),1);assert.equal(await p.locator('.learning-tabs [aria-current="page"]').count(),1);}
     if(width===390&&theme==='light'&&['/dashboard','/signs/lessons'].includes(route))await snapshot(route==='/dashboard'?'dashboard-mobile':'signs-mobile');
    }
   }
  }
  await p.locator('#signsBurgerBtn').click();assert.equal(await p.locator('#sidebar a[aria-current="page"][href="/signs/lessons"]').count(),1);await p.keyboard.press('Escape');
  await p.goto(base+'/login');await p.locator('#email').fill('browser1@example.com');await p.locator('#password').fill('BrowserTest123');await p.locator('#btn').click();await p.waitForURL('**/dashboard');
  const review=await(await p.request.get(base+'/api/review/questions')).json();const q2=review.questions.find(q=>q.test_id===1&&q.question_index===2);assert.deepEqual(q2.signs.map(s=>s.code),['E45']);
  await p.goto(base+'/review');await p.locator('.review-dot').nth(1).click();await p.locator('.review-option').first().click();await p.getByRole('button',{name:'Check',exact:true}).click();
  await p.locator('.sign-chip').waitFor();assert.equal(await p.locator('.sign-chip').count(),1);assert.match(await p.locator('.sign-chip').innerText(),/E45/);await snapshot('scene-reference');
  assert.deepEqual(errors,[]);console.log('OK seven routes at 320/390/1440 in both themes, unified signs navigation, and only E45 under the photographed road ending');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
