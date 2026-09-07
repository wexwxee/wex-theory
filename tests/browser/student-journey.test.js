// Run serve_learning.py first. Full learner journeys on a touch viewport.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => localStorage.setItem('wex-cookie-consent', 'essential'));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const base = 'http://127.0.0.1:8765';
  async function width(label) {
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow: ${label}`);
  }
  async function completeTest(url, total) {
    await page.goto(base + url);
    await page.locator('#questionArea').waitFor({ state: 'visible' });
    for (let index = 0; index < total; index++) {
      await page.locator('#answersContainer .answer-option').first().tap();
      await page.locator('#answersContainer .answer-option.selected').first().waitFor();
      if (index === 0) {
        await page.locator('#flagBtn').tap();
        await page.locator('#mapBtn').tap();
        await page.locator('#questionMap').waitFor({ state: 'visible' });
        await page.locator('#mapCloseBtn').tap();
        if (total === 25) await page.locator('#bookmarkBtn').tap();
      }
      if (index === 1) {
        await page.locator('#prevBtn').tap();
        assert.equal(await page.locator('#answersContainer .answer-option.selected').count(), 1);
        assert.equal(await page.locator('#flagBtn').getAttribute('aria-pressed'), 'true');
        await page.locator('#nextBtn').tap();
      }
      await page.locator('#nextBtn').tap();
    }
    await page.locator('#submitBtn').tap();
    await page.waitForURL(/results/);
    await width(`results ${total}`);
    console.log(`OK complete ${total}-question test by touch`);
  }
  try {
    await completeTest('/test/0', 15);
    await page.screenshot({ path: path.join(__dirname, 'sample-results-mobile.png'), fullPage: true, animations: 'disabled' });
    await page.goto(base + '/login');
    await page.locator('#email').fill('browser2@example.com');
    await page.locator('#password').fill('BrowserTest123');
    await page.locator('#btn').tap();
    await page.waitForURL('**/dashboard');
    await completeTest('/test/1?wording=original', 25);
    const expected = await page.evaluate(() => JSON.parse(document.getElementById('resultsDataJson').value).filter(q => q.is_correct).length);
    assert.equal(Number(await page.locator('#scoreDisplay').textContent()), expected);
    await page.reload();
    assert.equal(Number(await page.locator('#scoreDisplay').textContent()), expected);
    await page.screenshot({ path: path.join(__dirname, 'test-results-mobile.png'), fullPage: true, animations: 'disabled' });
    console.log('OK score agrees with question results and survives reload');
    await page.locator('.result-card').first().tap();
    await page.locator('#modalQuestion').waitFor({ state: 'visible' });
    const firstQuestion = await page.locator('#modalQuestion').textContent();
    await page.locator('#modalNext').tap();
    assert.notEqual(await page.locator('#modalQuestion').textContent(), firstQuestion);
    await page.locator('#modalPrev').tap();
    assert.equal(await page.locator('#modalQuestion').textContent(), firstQuestion);
    await width('answer breakdown modal');
    await page.screenshot({ path: path.join(__dirname, 'answer-breakdown-mobile.png'), fullPage: true, animations: 'disabled' });
    await page.locator('#modalCloseBtn').tap();
    await page.goto(base + '/saved');
    assert.equal((await page.request.get(base + '/api/bookmarks')).status(), 200);
    console.log('OK result breakdown navigation and saved questions');
    await completeTest('/test/14', 25);
    console.log('OK random exam mode');

    await page.goto(base + '/review');
    await page.locator('.review-option').first().waitFor();
    await width('mistake review');
    await page.locator('.review-option').first().tap();
    await page.getByRole('button', { name: 'Check', exact: true }).tap();
    await page.locator('.review-verdict').waitFor();
    console.log('OK test mistakes can be practised');

    await page.goto(base + '/exam-words');
    for (const mode of ['cards', 'quiz', 'reverse', 'mixed']) {
      await page.locator(`.ew-mode[data-mode="${mode}"]`).tap();
      for (let index = 0; index < 10; index++) {
        const reveal = page.locator('#ew-body [data-role="reveal"]');
        if (await reveal.count()) {
          await reveal.tap();
          await page.locator('#ew-body [data-role="repeat"]').tap();
        } else {
          await page.locator('#ew-body .ew-option').first().tap();
          await page.locator('#ew-body [data-role="next"]').tap();
        }
      }
      await page.locator('.ew-done-score').waitFor();
      await width(`words ${mode}`);
      console.log(`OK ten-word round: ${mode}`);
    }
    await page.screenshot({ path: path.join(__dirname, 'words-mobile.png'), fullPage: true });
    const words = await page.evaluate(async () => (await (await fetch('/api/exam-words/progress')).json()).progress);
    assert(Object.keys(words).length > 0);

    await page.goto(base + '/signs/learn');
    await page.locator('#revealBtn').waitFor();
    for (const mode of ['cards', 'name', 'image']) {
      await page.locator(`.mode-btn[data-mode="${mode}"]`).tap();
      for (let index = 0; index < 12; index++) {
        if (mode === 'cards') {
          await page.locator('#revealBtn').tap();
          await page.getByRole('button', { name: 'I knew it', exact: true }).tap();
        } else {
          await page.locator('.learn-option, .image-option').first().tap();
        }
        const next = page.locator('#nextBtn');
        if (await next.count()) await next.tap();
      }
      await page.getByText('Round finished', { exact: true }).waitFor();
      await width(`signs ${mode}`);
      console.log(`OK twelve-sign round: ${mode}`);
    }
    await page.screenshot({ path: path.join(__dirname, 'signs-mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('OK no JavaScript errors throughout learner journey');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
