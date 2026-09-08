const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => localStorage.setItem('wex-cookie-consent', 'essential'));
  let page = await context.newPage();
  const base = 'http://127.0.0.1:8765';
  async function login(index) {
    await page.goto(base + '/login');
    await page.locator('#email').fill(`browser${index}@example.com`);
    await page.locator('#password').fill('BrowserTest123');
    await page.locator('#btn').click();
    await page.waitForURL('**/dashboard');
  }
  async function partial(url) {
    await page.goto(base + url);
    await page.locator('#answersContainer .answer-option').first().click();
    assert.equal(await page.locator('.answer-option.selected').count(), 1, 'initial answer selection');
    await page.locator('#flagBtn').click();
    const first = await page.locator('#questionText').textContent();
    await page.locator('#nextBtn').click();
    await page.waitForTimeout(2100);
    const timer = await page.locator('#timerDisplay').textContent();
    const attempt = new URL(page.url()).searchParams.get('attempt_id');
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem(DRAFT_KEY)));
    await page.close();
    page = await context.newPage();
    await page.goto(base + url);
    await page.locator('#resumeNotice').waitFor();
    assert.match(await page.locator('#questionCounter').textContent(), /Question 2 /);
    assert((await page.locator('#timerDisplay').textContent()) <= timer);
    assert.equal(new URL(page.url()).searchParams.get('attempt_id'), attempt);
    assert.deepEqual(await page.evaluate(() => selectedAnswers), before.selectedAnswers);
    await page.locator('#prevBtn').click();
    assert.equal(await page.locator('#questionText').textContent(), first);
    assert.equal(await page.locator('.answer-option.selected').count(), 1);
    assert.equal(await page.locator('#flagBtn').getAttribute('aria-pressed'), 'true');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  try {
    await partial('/test/0');
    await page.route('**/api/tests/0/check/free', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }), { times: 1 });
    await page.locator('#finishBtn').click();
    await page.locator('#submitBtn').click();
    await page.getByText(/Failed to submit:/).waitFor();
    await page.reload();
    await page.locator('#resumeNotice').waitFor();
    assert.equal(await page.locator('.answer-option.selected').count(), 1);
    console.log('OK guest sample restores after tab close and failed submission without losing answers');
    await login(1);
    await partial('/test/1?wording=original');
    const popupPromise = page.waitForEvent('popup');
    await page.locator('#reportQuestionLink').click();
    const report = await popupPromise;
    await report.waitForLoadState();
    assert.equal(await report.locator('#cSubject').inputValue(), 'Content');
    assert.match(await report.locator('#cMsg').inputValue(), /Test 1, question 1 \(ID \d+, original\)/);
    await report.close();
    await page.goto(base + '/test/1?wording=exam');
    assert.equal(await page.locator('.answer-option.selected').count(), 0);
    await login(2);
    await page.goto(base + '/test/1?wording=original');
    await page.locator('#questionArea').waitFor();
    assert.equal(await page.locator('.answer-option.selected').count(), 0);
    assert.equal(await page.locator('#resumeNotice').isVisible(), false);
    console.log('OK paid draft, report form without sending, account and wording isolation');
    await partial('/test/14');
    page.once('dialog', d => d.accept());
    await page.locator('#restartDraftBtn').click();
    await page.waitForFunction(() => document.querySelector('#questionCounter')?.textContent.includes('Question 1 ') && document.querySelector('#resumeNotice').hidden);
    assert.equal(await page.locator('.answer-option.selected').count(), 0);
    console.log('OK random exam keeps its question set on resume; explicit restart clears draft');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
