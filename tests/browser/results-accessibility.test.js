const {chromium}=require('playwright');const assert=require('node:assert/strict');
const base=process.env.SITE_TEST_BASE||'http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844}});const errors=[];
 await context.addInitScript(()=>localStorage.setItem('wex-cookie-consent','essential'));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base+'/login');await page.locator('#email').fill('browser1@example.com');await page.locator('#password').fill('BrowserTest123');await page.locator('#btn').click();await page.waitForURL('**/dashboard');
  await page.goto(base+'/test/1/results/1');
  const card=page.locator('[data-modal-index="0"]');await card.focus();await page.keyboard.press('Enter');await page.locator('#qModal.open').waitFor();
  assert.equal(await page.locator('#qModal').getAttribute('aria-hidden'),'false');assert.equal(await page.evaluate(()=>document.activeElement.id),'modalCloseBtn');
  assert(await card.evaluate(node=>Boolean(node.closest('[inert]'))));
  const controls=page.locator('#qModal button:not(:disabled),#qModal a[href],#qModal [tabindex="0"]');
  const ids=await controls.evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>n.id));
  await page.locator('#'+ids.at(-1)).focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),ids[0]);
  const question=await page.locator('#modalQuestion').innerText();
  await page.locator('#modalImgWrap').focus();await page.keyboard.press('Enter');await page.locator('.lbz-overlay.is-open').waitFor();
  await page.keyboard.press('+');await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#modalQuestion').innerText(),question,'image pan must not change the underlying question');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#qModal').getAttribute('aria-hidden'),'false');assert.equal(await page.evaluate(()=>document.activeElement.id),'modalImgWrap');
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
  await page.keyboard.press('ArrowRight');assert.notEqual(await page.locator('#modalQuestion').innerText(),question);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#qModal').getAttribute('aria-hidden'),'true');assert(await page.locator('#qModal').evaluate(n=>n.inert));
  assert.equal(await card.evaluate(node=>node===document.activeElement),true);assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  await page.keyboard.press('Space');await page.locator('#qModal.open').waitFor();await page.locator('#modalCloseBtn').click();
  console.log('OK result cards by keyboard, review focus trap/return, nested image zoom/pan, Escape and background restoration');
  const blocked=await browser.newContext({viewport:{width:320,height:800}});await blocked.addCookies(await context.cookies());
  await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Unavailable','SecurityError');}});});
  const p=await blocked.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/test/1/results/1');await p.locator('#cookieEssentialBtn').click();
  await p.locator('[data-modal-index="0"]').click();await p.locator('#qModal.open').waitFor();await p.locator('#modalNext').click();await p.locator('#modalCloseBtn').click();
  await p.goto(base+'/test/1?wording=original');await p.locator('#cookieEssentialBtn').click();await p.locator('#answersContainer .answer-option').first().click();
  await p.locator('#answersContainer .answer-option.selected').first().waitFor();assert.equal(await p.locator('#answersContainer .answer-option.selected').count(),1);await p.locator('#nextBtn').click();assert.match(await p.locator('#questionCounter').innerText(),/Question 2/);
  assert.deepEqual(errors,[]);await blocked.close();
  console.log('OK paid test and saved result remain usable with browser storage blocked; no JS errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
