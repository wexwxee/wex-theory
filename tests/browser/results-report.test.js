const {chromium} = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH});
  const context = await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(() => localStorage.setItem('wex-cookie-consent','essential'));
  const page = await context.newPage();
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  const base=process.env.SITE_TEST_BASE || 'http://127.0.0.1:8765';
  async function checkReport(test, attempt) {
    await page.locator('[data-modal-index]').first().click();
    await page.locator('#modalReportLink').waitFor();
    const initial=new URL(await page.locator('#modalReportLink').getAttribute('href'),base);
    assert.equal(initial.searchParams.get('test'),String(test));
    assert.match(initial.searchParams.get('question'),/^\d+$/);
    assert.equal(initial.searchParams.get('attempt'),attempt);
    await page.locator('#modalNext').click();
    const next=new URL(await page.locator('#modalReportLink').getAttribute('href'),base);
    assert.notEqual(next.searchParams.get('question'),initial.searchParams.get('question'));
    const popupPromise=page.waitForEvent('popup');
    await page.locator('#modalReportLink').click();
    const popup=await popupPromise;
    await popup.waitForLoadState();
    const message=await popup.locator('#cMsg').inputValue();
    assert(message.includes('ID '+next.searchParams.get('question')));
    if(attempt) assert(message.includes('Attempt '+attempt));
    assert.equal(await popup.locator('#cSubject').inputValue(),'Content');
    await popup.close();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  try {
    await page.goto(base+'/login');
    await page.locator('#email').fill('browser1@example.com');
    await page.locator('#password').fill('BrowserTest123');
    await page.locator('#btn').click();
    await page.waitForURL('**/dashboard');
    await page.goto(base+'/test/1/results/1');
    await checkReport(1,'1');
    console.log('OK paid review: current question, attempt and mobile form; no report sent');
    await page.goto(base+'/test/0');
    await page.locator('#questionArea').waitFor();
    await page.locator('#finishBtn').click();
    await page.locator('#submitBtn').click();
    await page.waitForURL('**/results/free');
    await checkReport(0,null);
    assert.deepEqual(errors,[]);
    console.log('OK sample review: correct question after navigation, no JS errors');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
