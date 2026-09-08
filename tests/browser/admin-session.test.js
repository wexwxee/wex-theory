const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  const context = await browser.newContext();
  await context.addInitScript(() => localStorage.setItem('wex-cookie-consent', 'essential'));
  const base = process.env.PREVIEW_URL || 'http://127.0.0.1:8010';
  const admin = await context.newPage();
  async function login(page, email, password) {
    await page.goto(base + '/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.locator('#btn').click();
    await page.waitForURL(url => ['/admin', '/dashboard'].includes(url.pathname));
  }
  try {
    await login(admin, 'admin@local.test', 'LocalAdmin123!');
    await admin.locator('#userSearch').waitFor({ state: 'visible' });
    assert((await context.request.get(base + '/admin')).headers()['cache-control'].includes('no-store'));
    const learner = await context.newPage();
    await login(learner, 'free@local.test', 'LocalStudent123!');
    for (const path of ['/api/admin/users', '/api/admin/users/1/activity', '/api/admin/messages', '/admin/api/stats']) {
      assert.equal((await context.request.get(base + path)).status(), 403, path);
    }
    await learner.goto(base + '/admin');
    assert.equal(new URL(learner.url()).pathname, '/dashboard');
    assert.equal(await learner.locator('#userSearch').count(), 0);
    await admin.bringToFront();
    await admin.waitForURL('**/dashboard');
    assert.equal(await admin.locator('#userSearch').count(), 0);
    console.log('OK learner cannot read admin pages/APIs; old admin tab redirects after account switch');
    await login(admin, 'admin@local.test', 'LocalAdmin123!');
    await admin.locator('#userSearch').waitFor({ state: 'visible' });
    await learner.goto(base + '/logout');
    await admin.bringToFront();
    await admin.waitForURL('**/login');
    assert.equal(await admin.locator('#userSearch').count(), 0);
    console.log('OK old admin tab clears after logout; no user records changed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
