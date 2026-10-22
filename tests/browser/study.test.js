const{chromium}=require('playwright');const{answerSituation}=require('./lesson-answers');const assert=require('node:assert/strict');const path=require('node:path');
const base=process.env.SITE_TEST_BASE||'http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.addInitScript(()=>localStorage.setItem('wex-cookie-consent','essential'));
 const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 async function login(index){await p.goto(base+'/login');await p.locator('#email').fill(`browser${index}@example.com`);await p.locator('#password').fill('BrowserTest123');await p.locator('#btn').click();await p.waitForURL('**/dashboard');}
 async function fits(){assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 try{
  assert.equal((await p.request.get(base+'/study',{maxRedirects:0})).status(),302);
  await login(4);assert.equal(await p.locator('#resumeTest').isVisible(),false);
  await p.goto(base+'/test/1?wording=original');await p.locator('#answersContainer .answer-option').first().tap();await p.locator('#nextBtn').click();
  const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem(DRAFT_KEY)));
  await p.goto(base+'/dashboard');await p.locator('#resumeTest').waitFor();assert.match(await p.locator('#resumeTestCopy').innerText(),/1\/25 answered/);
  await p.locator('#resumeTestLink').click();await p.locator('#resumeNotice').waitFor();assert.match(await p.locator('#questionCounter').innerText(),/Question 2 /);assert.deepEqual(await p.evaluate(()=>selectedAnswers),saved.selectedAnswers);
  for(let i=1;i<25;i++){await p.locator('#answersContainer .answer-option').first().tap();if(i<24)await p.locator('#nextBtn').click();}
  await p.locator('#finishBtn').click();await p.locator('#submitBtn').click();await p.waitForURL('**/results/*');
  await p.goto(base+'/dashboard');assert.equal(await p.locator('#resumeTest').isVisible(),false);assert.equal(await p.locator('.dashboard-actions a[href="/profile"]').isVisible(),true);
  console.log('OK dashboard resumes exact saved answers, submitted draft disappears and full test history appears');

  await p.goto(base+'/study');await p.locator('#studyTopics summary').click();await p.locator('[data-study-choice="road-shape"]').click();await p.locator('#studyStart').click();
  const ownKey=await p.locator('#studySession').getAttribute('data-study-account');
  const before=await p.evaluate(id=>JSON.parse(localStorage.getItem('wexStudy:v1:'+id)),ownKey);
  await p.reload();assert.equal(await p.locator('#studySessionCount').innerText(),'0 of 2 steps checked');
  await p.locator('[data-study-step="words"]').click();await p.locator('.ew-option').first().waitFor();
  for(let i=0;i<10;i++){await p.locator('.ew-option').first().click();await p.locator('[data-role="next"]').click();}
  await p.locator('[data-study-return]').click();assert.equal(await p.locator('#studySessionCount').innerText(),'1 of 2 steps checked');
  await p.locator('[data-study-step="signs"]').click();await p.locator('.sl-stages [data-stage="situations"]').click();
  const questions=await p.locator('#lessonQuestions').evaluate(e=>JSON.parse(e.textContent));
  for(const question of questions){await answerSituation(p,question);await p.locator('#lessonNext').click();}
  await p.locator('[data-study-return]').click();await p.locator('#studySummary').waitFor();assert.equal(await p.locator('#studySessionCount').innerText(),'2 of 2 steps checked');
  const finished=await p.evaluate(id=>JSON.parse(localStorage.getItem('wexStudy:v1:'+id)),ownKey);assert.equal(finished.id,before.id);assert.equal(finished.steps.words.total,10);assert.equal(finished.steps.signs.score,4);
  await p.reload();assert.equal(await p.locator('#studySessionCount').innerText(),'2 of 2 steps checked');
  for(const width of[320,390,1440]){await p.setViewportSize({width,height:900});await fits();}
  await p.screenshot({path:path.join(__dirname,'study-desktop.png'),fullPage:true});
  await p.setViewportSize({width:390,height:844});await p.locator('#studyTheme').click();await p.waitForTimeout(250);await fits();await p.screenshot({path:path.join(__dirname,'study-mobile-light.png'),fullPage:true});
  console.log('OK real word/lesson completion, persistent step scores, next action, three widths and light theme');

  await p.evaluate(()=>localStorage.setItem('wex-exam-words-2026-full-progress-v1',JSON.stringify({foreignword:'hard'})));
  await login(5);assert.equal(await p.locator('#resumeTest').isVisible(),false);await p.goto(base+'/study?study='+finished.id);assert.equal(await p.locator('#studySetup').isVisible(),true);assert.equal(await p.locator('#studyRoute').isVisible(),false);
  await p.goto(base+'/exam-words');await p.locator('.ew-stage-card').waitFor();await p.waitForTimeout(600);const words=await p.request.get(base+'/api/exam-words/progress');assert.deepEqual((await words.json()).progress,{});
  assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('wex-exam-words-2026-full-user-5-progress-v1')||'{}')),{});
  console.log('OK study session and local word progress stay with their own account');

  await login(3);
  await p.evaluate(()=>{const value={savedAt:Date.now(),ids:[1,2],selectedAnswers:{1:[1]},currentIndex:1,timerSeconds:1000,attemptId:null,flags:[]};localStorage.setItem('wexDraft:v1:3:1:original',JSON.stringify(value));localStorage.setItem('wexDraft:v1:guest:0:original',JSON.stringify(value));});
  await p.reload();assert.equal(await p.locator('#resumeTest').isVisible(),false);await p.goto(base+'/study');await p.locator('#studyStart').click();assert.match(await p.locator('[data-study-step="words"]').getAttribute('href'),/^\/exam-words-demo\?study=/);
  await p.locator('[data-study-step="words"]').click();await p.locator('.ew-option').first().waitFor();await fits();
  assert.deepEqual(errors,[]);console.log('OK expired access uses demo, paid and guest drafts are excluded, no JS errors');
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
