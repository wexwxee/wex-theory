// Local fixture only. Mail is captured in memory; Telegram is never contacted.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.SITE_TEST_BASE || 'http://127.0.0.1:8765';
(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => localStorage.setItem('wex-cookie-consent', 'essential'));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const email = `journey${Date.now()}@example.com`;
  async function submit(selector, endpoint) {
    let resolveResponse;
    const response = new Promise(resolve => { resolveResponse = resolve; });
    await page.route('**' + endpoint, async route => {
      const result = await route.fetch();
      resolveResponse(await result.json());
      await route.fulfill({ response: result });
    }, { times: 1 });
    await page.locator(selector).click();
    return response;
  }
  async function mail() {
    const messages = await (await context.request.get(base + '/__test/mailbox')).json();
    return messages.filter(m => m.email === email).at(-1);
  }
  async function login(password) {
    await page.goto(base + '/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    return submit('#btn', '/api/auth/login');
  }
  try {
    await page.goto(base + '/register');
    await page.locator('#name').fill('Journey Learner');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill('OriginalPass123');
    assert((await submit('#btn', '/api/auth/register')).success);
    const verification = await mail();
    await page.locator('#verifyCode').fill(verification.code === '000000' ? '111111' : '000000');
    assert.match((await submit('#verifyBtn', '/api/auth/register/verify')).error, /Invalid/);
    await page.locator('#verifyCode').fill(verification.code);
    assert((await submit('#verifyBtn', '/api/auth/register/verify')).success);
    await page.waitForURL('**/dashboard');
    const me = await (await context.request.get(base + '/api/auth/me')).json();
    assert(me.id, JSON.stringify(me));
    const oldSession = await context.storageState();
    await page.goto(base + '/test/1?wording=original');
    assert(page.url().includes('/pricing'));
    console.log('OK registration, wrong code, verification, free account cannot open paid test');

    const adminContext = await browser.newContext();
    await adminContext.addInitScript(() => localStorage.setItem('wex-cookie-consent', 'essential'));
    const admin = await adminContext.newPage();
    await admin.goto(base + '/login');
    await admin.locator('#email').fill('browser-admin@example.com');
    await admin.locator('#password').fill('BrowserAdmin123');
    await admin.locator('#btn').click();
    await admin.waitForURL('**/admin');
    await admin.goto(base + '/admin');
    const row = admin.locator('tr').filter({ hasText: email });
    await row.locator('.user-edit-btn').click();
    assert.equal(await admin.locator('#editUserId').inputValue(), String(me.id));
    await admin.locator('#editDays').fill('7');
    const saved = admin.waitForResponse(r => r.url().endsWith('/api/admin/users/' + me.id) && r.request().method() === 'PUT');
    saved.catch(() => {});
    await admin.locator('#saveEditBtn').click();
    assert((await (await saved).json()).success);
    await page.goto(base + '/test/1?wording=original');
    assert(new URL(page.url()).pathname === '/test/1');
    let expiry = (await (await context.request.get(base + '/api/auth/me')).json()).expires_at;
    assert(Date.parse(expiry + 'Z') > Date.now() + 6 * 86400000);
    console.log('OK admin grants seven days through UI; same learner session unlocks paid test');

    // Reload after the save's delayed navigation has completed.
    await admin.goto(base + '/admin');
    await admin.locator('#userrow-' + me.id + ' .user-edit-btn').click();
    await admin.locator('#editEmail').fill('browser1@example.com');
    await admin.locator('#saveEditBtn').click();
    await admin.locator('#editMsg').filter({ hasText: 'Email already registered' }).waitFor();
    await admin.locator('#editEmail').fill(email);
    await admin.locator('#editDays').fill('1.5');
    await admin.locator('#saveEditBtn').click();
    await admin.locator('#editMsg').filter({ hasText: 'whole number' }).waitFor();
    await admin.locator('#editDays').fill('2');
    await admin.locator('[data-unit-target="editDurationUnit"] [data-unit="hours"]').click();
    const extended = admin.waitForResponse(r => r.url().endsWith('/api/admin/users/' + me.id) && r.request().method() === 'PUT');
    await admin.locator('#saveEditBtn').click();
    assert((await (await extended).json()).success);
    const extendedExpiry = (await (await context.request.get(base + '/api/auth/me')).json()).expires_at;
    assert.equal(Date.parse(extendedExpiry + 'Z') - Date.parse(expiry + 'Z'), 7200000);
    expiry = extendedExpiry;
    console.log('OK duplicate email and fractional duration rejected; two hours added to remaining seven days');
    await adminContext.close();

    await page.goto(base + '/logout');
    await page.goto(base + '/forgot-password');
    await page.locator('#email').fill(email);
    assert((await submit('#btn', '/api/auth/forgot-password')).success);
    await page.locator('#resetCodeLink').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#resetCodeLink a').getAttribute('href'), '/reset-password?email=' + encodeURIComponent(email));
    const reset = await mail();
    await page.goto(reset.url);
    assert.equal(await page.locator('#code').inputValue(), reset.code);
    await page.locator('#password').fill('ReplacementPass456');
    assert((await submit('#btn', '/api/auth/reset-password')).success);
    await page.waitForURL('**/login?reset=1');
    const staleContext = await browser.newContext({ storageState: oldSession });
    assert.equal((await staleContext.request.get(base + '/api/auth/me')).status(), 401);
    const stalePage = await staleContext.newPage();
    await stalePage.goto(base + '/dashboard');
    assert(new URL(stalePage.url()).pathname === '/login');
    assert.equal((await staleContext.request.get(base + '/api/auth/me')).status(), 401);
    await staleContext.close();
    assert((await login('OriginalPass123')).error);
    assert((await login('ReplacementPass456')).success);
    await page.waitForURL('**/dashboard');
    assert.equal((await (await context.request.get(base + '/api/auth/me')).json()).id, me.id);
    assert.equal((await (await context.request.get(base + '/api/auth/me')).json()).expires_at, expiry);
    await page.goto(reset.url);
    await page.locator('#password').fill('ThirdPassword789');
    assert.match((await submit('#btn', '/api/auth/reset-password')).error, /not found/i);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    console.log('OK email reset link, old password and sessions rejected, new login preserves paid access, one-use code');

    await context.clearCookies();
    await page.goto(base + '/register');
    const linkEmail = 'link-' + email;
    await page.locator('#name').fill('Link Learner');
    await page.locator('#email').fill(linkEmail);
    await page.locator('#password').fill('LinkPassword123');
    assert((await submit('#btn', '/api/auth/register')).success);
    const messages = await (await context.request.get(base + '/__test/mailbox')).json();
    const confirmation = messages.find(m => m.email === linkEmail);
    const linkContext = await browser.newContext({ storageState: oldSession });
    const linkPage = await linkContext.newPage();
    await linkPage.goto(confirmation.url);
    assert.equal((await (await linkContext.request.get(base + '/api/auth/me')).json()).email, linkEmail);
    await linkContext.close();
    console.log('OK email confirmation link signs in the correct account even with a stale cookie');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
