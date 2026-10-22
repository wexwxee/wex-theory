const{chromium}=require('playwright');const{answerSituation}=require('./lesson-answers');const assert=require('node:assert/strict');const path=require('node:path');
const base=process.env.SITE_TEST_BASE||'http://127.0.0.1:8765';
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await context.addInitScript(()=>localStorage.setItem('wex-cookie-consent','essential'));const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.goto(base+'/signs/lesson/priority');
 assert.equal(await p.locator('.lesson-note').count(),7);assert.equal(await p.locator('.lesson-compare').count(),2);
 // The lesson opens on its first step: one sign at a time, with the next sign one tap away.
 assert.equal(await p.locator('.lesson-note:visible').count(),1);assert.equal(await p.locator('#learnCounter').innerText(),'Sign 1 of 7');
 await p.locator('#learnNext').click();assert.equal(await p.locator('#sign-B13').isVisible(),true);assert.equal(await p.locator('#learnCounter').innerText(),'Sign 2 of 7');
 const questions=await p.locator('#lessonQuestions').evaluate(e=>JSON.parse(e.textContent));
 await p.locator('.sl-stages [data-stage="situations"]').click();
 await answerSituation(p,questions[0],false);
 const saved=await p.evaluate(()=>localStorage.getItem('wexSignLesson:guest:priority'));
 await p.reload();await p.locator('#lessonNext').waitFor();
 assert.equal(await p.evaluate(()=>localStorage.getItem('wexSignLesson:guest:priority')),saved);
 await p.locator('[data-lang="ru"]').click();assert.equal(await p.evaluate(()=>localStorage.getItem('wexSignLesson:guest:priority')),saved);
 await p.locator('#lessonNext').click();
 for(let i=1;i<questions.length;i++){await answerSituation(p,questions[i]);await p.locator('#lessonNext').click();}
 assert.equal(await p.locator('.lesson-score').innerText(),(questions.length-1)+'/'+questions.length);
 await p.reload();assert.equal(await p.locator('.lesson-score').innerText(),(questions.length-1)+'/'+questions.length);
 await p.locator('#lessonRetry').click();assert.equal(await p.locator('.lesson-counter').innerText(),'Разбор ошибок · Ситуация 1 из 1');
 await answerSituation(p,questions[0]);await p.locator('#lessonNext').click();assert.equal(await p.locator('.lesson-score').innerText(),(questions.length-1)+'/'+questions.length);assert.match(await p.locator('.lesson-reviewed-score').innerText(),new RegExp(questions.length+'/'+questions.length));
 const kept=await p.evaluate(()=>JSON.parse(localStorage.getItem('wexSignLessonResults')).priority);assert.deepEqual([kept.first,kept.reviewed,kept.total],[questions.length-1,questions.length,questions.length]);
 await p.goto(base+'/signs/lessons');assert.match(await p.locator('[data-lesson-result="priority"]').innerText(),new RegExp(questions.length+'/'+questions.length));assert.equal(await p.locator('[data-lesson-state="priority"]').getAttribute('data-state'),'done');
 console.log('OK one sign at a time, bilingual situations, exact answered-state recovery, lasting result and missed-only retry');

 // Recall names each sign with look-alikes from the same lesson; a miss comes back at the end and starts its review.
 await p.goto(base+'/signs/lesson/priority#lessonRecall');await p.locator('.recall-option').first().waitFor();
 const deck=await p.evaluate(()=>JSON.parse(localStorage.getItem('wexSignLessonRun:guest:priority')).recall.deck);assert.equal(deck.length,7);
 const lessonCodes=await p.locator('#lessonRecallData').evaluate(e=>JSON.parse(e.textContent).signs.map(s=>s.code));
 const firstOptions=await p.locator('.recall-option').evaluateAll(es=>es.map(e=>e.dataset.code));assert.equal(firstOptions.length,4);assert(firstOptions.filter(code=>lessonCodes.includes(code)).length>=3);
 await p.locator(`.recall-option:not([data-code="${deck[0]}"])`).first().click();assert.equal(await p.locator('.sl-why.is-wrong').count(),1);
 assert.equal(await p.evaluate(code=>JSON.parse(localStorage.getItem('wexSignsProgress'))[code].box,deck[0]),0);
 await p.reload();assert.equal(await p.locator('.recall-option:disabled').count(),4);await p.locator('#recallNext').click();
 for(let i=1;i<8;i++){const code=await p.evaluate(()=>{const r=JSON.parse(localStorage.getItem('wexSignLessonRun:guest:priority')).recall;return r.deck[r.index];});await p.locator(`.recall-option[data-code="${code}"]`).click();await p.locator('#recallNext').click();}
 assert.equal(await p.locator('.sl-recall-score').innerText(),'6/7');
 const boxes=await p.evaluate(()=>JSON.parse(localStorage.getItem('wexSignsProgress')));assert.equal(Object.keys(boxes).filter(code=>lessonCodes.includes(code)).length,7);assert.equal(boxes[deck[0]].box,1);
 await p.goto(base+'/signs/lessons');assert.match(await p.locator('#gantryLessons').innerText(),/1/);
 console.log('OK recall from lesson look-alikes, repeated miss, review levels for every lesson sign');

 for(const width of[320,390,1440]){await p.setViewportSize({width,height:900});for(const lesson of['starter','priority','restrictions','parking','directions','warnings']){const response=await p.goto(base+'/signs/lesson/'+lesson);assert.equal(response.status(),200);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const material=await p.locator('#lessonQuestions').evaluate(e=>JSON.parse(e.textContent));assert(material.length>=3);if(width===390&&lesson==='parking'){await p.locator('.sl-stages [data-stage="compare"]').click();await p.locator('.lesson-compare').first().scrollIntoViewIfNeeded();await p.screenshot({path:path.join(__dirname,'parking-lesson-mobile.png'),fullPage:true,animations:'disabled'});}if(width===390&&lesson==='warnings'){await p.goto(base+'/signs/lesson/warnings#sign-A26');await p.locator('.lesson-photo').first().scrollIntoViewIfNeeded();await p.locator('.lesson-photo img').first().evaluate(i=>i.decode());assert(await p.locator('.lesson-photo img').first().evaluate(i=>i.complete&&i.naturalWidth>0));}}}
 assert.equal((await p.request.get(base+'/signs/lesson/unknown')).status(),404);
 console.log('OK six lessons at three widths, manually linked scenes and unknown lesson response');

 await p.setViewportSize({width:390,height:844});await p.goto(base+'/privacy');
 await p.evaluate(()=>{localStorage.setItem('wexSignsProgress',JSON.stringify({B11:{box:1}}));localStorage.setItem('wexSignsProgress-reviewed-at',JSON.stringify({B11:Date.now()-2*86400000}));localStorage.setItem('wexSignsLang','en');});
 await p.goto(base+'/signs/learn?group=B&review=due');await p.locator('#learnStage [data-code]').first().waitFor();assert.equal(await p.locator('#sessionCounter').innerText(),'Question 1 of 1');
 await p.locator('#learnStage [data-code="B11"]').click();assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('wexSignsProgress')).B11.box),2);
 await p.reload();await p.locator('#nextBtn').waitFor();assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('wexSignsProgress')).B11.box),2);
 await p.locator('#nextBtn').click();await p.getByRole('button',{name:'New round',exact:true}).click();await p.getByText('No signs are due now.',{exact:false}).waitFor();
 console.log('OK due-only practice, review promotion, no repeat promotion on reload and empty schedule');

 await p.goto(base+'/signs/learn?lesson=directions');for(let i=0;i<10;i++){await p.locator('#nextBtn, #learnStage [data-code]').first().waitFor();const options=await p.locator('#learnStage [data-code]').evaluateAll(es=>es.map(e=>e.dataset.code));assert(!(options.includes('D11.2')&&options.includes('D11.4')));assert(!(options.includes('D11.3')&&options.includes('D11.5')));await p.locator('#learnStage [data-code]').first().click();await p.locator('#nextBtn').click();}
 assert.deepEqual(errors,[]);console.log('OK equivalent arrow variants excluded from ambiguous choices, no JS errors');
 }finally{await context.close();await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
