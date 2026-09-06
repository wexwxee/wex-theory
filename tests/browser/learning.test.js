// Run serve_learning.py first. Uses only dummy accounts on localhost.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => localStorage.setItem('wex-cookie-consent', 'essential'));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const base = 'http://127.0.0.1:8765';
  try {
    await page.goto(`${base}/login`);
    await page.locator('#email').fill('browser1@example.com');
    await page.locator('#password').fill('BrowserTest123');
    await page.locator('#btn').click();
    await page.waitForURL('**/dashboard');
    console.log('OK login through the real form');

    for (const url of ['/dashboard', '/profile', '/test/0', '/test/14', '/signs/learn', '/review']) {
      const response = await page.goto(base + url);
      assert.equal(response.status(), 200, url);
      await page.waitForLoadState('networkidle');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Mobile overflow: ${url}`);
    }
    await page.screenshot({ path: path.join(__dirname, 'review-mobile.png'), fullPage: true });
    console.log('OK six mobile pages, no horizontal overflow');

    const questions = await page.evaluate(async () => (await (await fetch('/api/review/questions')).json()).questions);
    for (const [index, question] of questions.entries()) {
      for (const [answerIndex, answer] of question.answers.entries()) {
        if (answer.is_correct) await page.locator('.review-option').nth(answerIndex).click();
      }
      if (index === 0) {
        // The server saves, but the response is lost: retry must not advance twice.
        await page.route('**/api/review/answer', async route => { await route.fetch(); await route.abort(); }, { times: 1 });
      }
      await page.getByRole('button', { name: 'Check', exact: true }).click();
      if (index === 0) await page.getByRole('button', { name: 'Could not save — retry' }).click();
      await page.getByRole('button', { name: index + 1 === questions.length ? 'Finish round' : 'Next question →', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Next ten', exact: true }).click();
    await page.getByText('All done for today', { exact: true }).waitFor();
    await page.reload();
    await page.getByText('All done for today', { exact: true }).waitFor();
    console.log('OK review persists, lost-response retry, next round and reload');

    await page.goto(base + '/signs/learn');
    await page.locator('#revealBtn').click();
    await page.route('**/api/signs/progress', route => route.request().method() === 'POST' ? route.abort() : route.continue());
    await page.getByRole('button', { name: 'Show me again', exact: true }).click();
    await page.locator('#learnSyncRetry').waitFor({ state: 'visible' });
    await page.reload();
    await page.locator('#learnSyncRetry').waitFor({ state: 'visible' });
    await page.unroute('**/api/signs/progress');
    await page.locator('#learnSyncRetry').click();
    await page.locator('#learnSyncRetry').waitFor({ state: 'hidden' });
    const saved = await page.evaluate(async () => (await (await fetch('/api/signs/progress')).json()).progress);
    assert.equal(Object.keys(saved).length, 1);
    console.log('OK sign progress survives failed sync and reload');

    const secondDevice = await browser.newContext({ storageState: { cookies: await context.cookies(), origins: [] },
                                                   viewport: { width: 1440, height: 900 } });
    await secondDevice.addInitScript(() => localStorage.setItem('wex-cookie-consent', 'essential'));
    const desktop = await secondDevice.newPage();
    await desktop.goto(base + '/signs/learn');
    await desktop.locator('#revealBtn').waitFor();
    assert.deepEqual(await desktop.evaluate(() => JSON.parse(localStorage.getItem('wexSignsProgress-user-1'))), saved);
    await desktop.goto(base + '/profile');
    await desktop.getByText('Signs to practise', { exact: true }).waitFor();
    assert.equal(await desktop.locator('#profileAvatarImg').isVisible(), false);
    await desktop.screenshot({ path: path.join(__dirname, 'profile-desktop.png'), fullPage: true, animations: 'disabled' });
    await desktop.goto(base + '/test/1/review/1');
    assert(desktop.url().endsWith('/test/1/results/1?review=1'));
    await secondDevice.close();
    assert.deepEqual(errors, []);
    console.log('OK second device, weak signs in profile, old review URL, no JS errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
