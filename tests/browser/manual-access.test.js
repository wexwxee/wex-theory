// All Telegram navigation is intercepted: no external messages or payments.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => localStorage.setItem('wex-cookie-consent', 'essential'));
  await context.route('https://t.me/**', route => route.fulfill({ contentType: 'text/plain', body: 'Telegram draft intercepted by local test.' }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => { errors.push(`Unexpected dialog: ${dialog.message()}`); dialog.dismiss(); });
  const base = process.env.SITE_TEST_BASE || 'http://127.0.0.1:8765';
  async function width(label) {
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow: ${label}`);
  }
  async function login(index) {
    await context.clearCookies();
    await page.goto(base + '/login');
    await page.locator('#email').fill(`browser${index}@example.com`);
    await page.locator('#password').fill('BrowserTest123');
    await page.locator('#btn').click();
    await page.waitForURL('**/dashboard');
  }
  try {
    await page.goto(base + '/');
    await width('home mobile');
    await page.getByRole('link', { name: 'How to get full access', exact: true }).click();
    await width('guest pricing mobile');
    assert.equal(await page.getByRole('link', { name: 'Create an account to get access', exact: true }).getAttribute('href'), '/register');
    await page.screenshot({ path: path.join(__dirname, 'access-guest-mobile.png'), fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: path.join(__dirname, 'access-guest-desktop.png'), fullPage: true, animations: 'disabled' });
    console.log('OK homepage, guest access page, registration link, mobile and desktop');

    await login(3);
    await page.goto(base + '/pricing?from=exam-words');
    assert(await page.getByRole('link', { name: 'Open the free demo', exact: true }).isVisible());
    const link = page.locator('#pricingPurchaseBtn');
    const url = new URL(await link.getAttribute('href'));
    assert.equal(url.origin, 'https://t.me');
    assert.equal(url.pathname, '/wexwxeee');
    const message = url.searchParams.get('text');
    assert(message.includes('WEX-BROWSER-3'));
    assert(message.includes('confirm the price'));
    assert(!message.includes('99') && !message.includes('30 days') && !message.includes('@example.com'));
    const popupPromise = page.waitForEvent('popup');
    await link.click();
    const popup = await popupPromise;
    await popup.waitForLoadState();
    assert.equal(await popup.locator('body').textContent(), 'Telegram draft intercepted by local test.');
    await popup.close();
    await page.setViewportSize({ width: 390, height: 844 });
    await width('signed-in access mobile');
    await page.locator('#navThemeBtn').click();
    await page.screenshot({ path: path.join(__dirname, 'access-user-light-mobile.png'), fullPage: true, animations: 'disabled' });
    console.log('OK account-linked Telegram draft, single tab, no confirmation dialogs, light mobile');

    await page.goto(base + '/subscription-expired');
    await width('expired access mobile');
    assert.equal(await page.getByRole('link', { name: 'Continue free practice', exact: true }).getAttribute('href'), '/test/0');
    await page.getByRole('link', { name: 'Extend access via Telegram', exact: true }).click();
    await page.waitForURL('**/pricing');
    assert(await page.locator('#pricingPurchaseBtn').isVisible());
    console.log('OK expired access offers renewal and free practice');

    await login(1);
    await page.goto(base + '/pricing');
    assert(await page.getByRole('link', { name: 'Continue practising', exact: true }).isVisible());
    assert(await page.getByRole('link', { name: 'Ask about extending access', exact: true }).isVisible());
    assert((await page.locator('.access-active').textContent()).includes('active until'));
    assert.deepEqual(errors, []);
    console.log('OK active account sees expiry, dashboard and extension option; no JS errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
