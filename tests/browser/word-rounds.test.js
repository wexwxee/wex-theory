const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = process.env.SITE_TEST_BASE || 'http://127.0.0.1:8765';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    if (!/^https?:$/.test(location.protocol)) return;
    localStorage.setItem('wex-cookie-consent', 'essential');
    window.__spoken = [];
    window.SpeechSynthesisUtterance = function (text) { this.text = text; };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => localStorage.getItem('test-no-voice') ? [] : [{ lang: 'en-GB', localService: true, default: true }],
      cancel() {}, speak(utterance) { window.__spoken.push(utterance.text); }, onvoiceschanged: null,
    } });
  });
  const errors = [];
  let p = await context.newPage();
  context.on('page', page => page.on('pageerror', e => errors.push(e.message)));
  p.on('pageerror', e => errors.push(e.message));
  let release;
  async function login(index) {
    await p.goto(base + '/login');
    await p.locator('#email').fill(`browser${index}@example.com`);
    await p.locator('#password').fill('BrowserTest123');
    await p.locator('#btn').click();
    await p.waitForURL('**/dashboard');
  }
  async function round() {
    return p.evaluate(() => {
      const node = document.querySelector('#exam-words-mode');
      const guided = window.WEXStudy?.active('words');
      const owner = `${node.dataset.examWordsDemo === '1' ? 'demo' : 'full'}-user-${node.dataset.studyAccount}:${guided ? 'study-' + guided.id : 'standalone'}`;
      const key = `wexWordRound:v1:${owner}`;
      return { key, value: JSON.parse(localStorage.getItem(key)) };
    });
  }
  async function options() { return p.locator('.ew-option-meaning').allTextContents(); }
  async function answer(right) {
    const { value } = await round();
    const item = value.queue[value.answers.length];
    const index = value.options.findIndex(id => right ? id === item : id !== item);
    await p.locator('.ew-option').nth(index).click();
    await p.locator('.ew-verdict').waitFor();
  }
  async function fits() { assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
  try {
    await login(1);
    await p.goto(base + '/exam-words');
    await p.locator('[data-mode="cards"]').click();
    await p.locator('[data-role="reveal"]').click();
    const revealed = await round();
    const card = await p.locator('.ew-stage-card').innerText();
    await p.reload();
    assert.deepEqual(await round(), revealed);
    assert.equal(await p.locator('.ew-stage-card').innerText(), card);
    assert.match(await p.locator('#ew-round-status').innerText(), /restored/);
    await p.locator('[data-role="knew"]').click();
    const progressed = await round();
    assert.equal(progressed.value.answers.length, 1);
    const streaks = await p.evaluate(() => localStorage.getItem('wex-exam-words-2026-full-user-1-streaks-v1'));
    await p.close();
    p = await context.newPage();
    await p.goto(base + '/exam-words');
    assert.deepEqual(await round(), progressed);
    assert.equal(await p.evaluate(() => localStorage.getItem('wex-exam-words-2026-full-user-1-streaks-v1')), streaks);
    console.log('OK revealed card, queue, position and grading survive reload and tab close');

    await p.locator('[data-mode="quiz"]').click();
    const quizOptions = await options();
    await answer(false);
    const answered = await round();
    const feedback = await p.locator('.ew-verdict').innerText();
    const progressBefore = await p.evaluate(() => localStorage.getItem('wex-exam-words-2026-full-user-1-streaks-v1'));
    await p.reload();
    assert.deepEqual(await round(), answered);
    assert.deepEqual(await options(), quizOptions);
    assert.equal(await p.locator('.ew-verdict').innerText(), feedback);
    assert.equal(await p.locator('.ew-option:disabled').count(), 4);
    assert.equal(await p.evaluate(() => localStorage.getItem('wex-exam-words-2026-full-user-1-streaks-v1')), progressBefore);
    await p.locator('.ew-chip').filter({ hasText: 'Not started' }).click();
    await p.evaluate(() => window.speechSynthesis.onvoiceschanged());
    assert.deepEqual(await options(), quizOptions);
    assert.equal(await p.locator('.ew-verdict').innerText(), feedback);
    await p.locator('[data-role="next"]').click();
    assert.equal((await round()).value.answers.length, 1);
    await p.reload();
    assert.equal((await round()).value.answers.length, 1);
    console.log('OK answered quiz keeps choices and explanation through reload, filtering and voice refresh');

    // Hold the actual initial server response until after an answer is visible.
    let refreshDone;
    const refreshed = new Promise(resolve => { refreshDone = resolve; });
    await p.route('**/api/exam-words/progress', async route => {
      if (route.request().method() !== 'GET') return route.continue();
      const response = await route.fetch();
      await new Promise(resolve => { release = resolve; });
      await route.fulfill({ response });
      refreshDone();
    });
    await p.reload();
    await p.locator('.ew-option').first().waitFor();
    await answer(true);
    const delayed = await round();
    for (let i = 0; !release && i < 40; i++) await p.waitForTimeout(50);
    assert(release);
    release();
    await refreshed;
    await p.waitForTimeout(100);
    assert.deepEqual(await round(), delayed);
    assert.equal(await p.locator('.ew-verdict.is-right').count(), 1);
    await p.unroute('**/api/exam-words/progress');
    console.log('OK late server-progress response preserves the selected answer and choices');

    for (const mode of ['reverse', 'listening']) {
      await p.locator(`[data-mode="${mode}"]`).click();
      await answer(true);
      const before = await round();
      const choices = await options();
      await p.reload();
      assert.deepEqual(await round(), before);
      assert.deepEqual(await options(), choices);
      assert.equal(await p.locator('.ew-verdict.is-right').count(), 1);
      assert.equal(await p.evaluate(() => window.__spoken.length), 0);
      await p.locator('[data-role="next"]').click();
    }
    await p.evaluate(() => localStorage.setItem('test-no-voice', '1'));
    await p.reload();
    assert.match(await p.locator('.ew-listen').innerText(), /Read the phrase instead/);
    assert.equal(await p.locator('.ew-play').isDisabled(), true);
    await p.evaluate(() => localStorage.removeItem('test-no-voice'));
    await p.reload();
    assert.equal(await p.evaluate(() => window.__spoken.length), 0);
    await p.locator('.ew-play').click();
    assert.equal(await p.evaluate(() => window.__spoken.length), 1);
    console.log('OK reverse/listening recovery is silent, with a visible fallback if no voice exists');

    await p.locator('[data-mode="quiz"]').click();
    for (let i = 0; i < 10; i++) { await answer(i !== 2); await p.locator('[data-role="next"]').click(); }
    assert.equal(await p.locator('.ew-done-score').innerText(), '9/10');
    const complete = await round();
    await p.reload();
    assert.deepEqual(await round(), complete);
    assert.equal(await p.locator('.ew-done-score').innerText(), '9/10');
    assert.equal(await p.locator('.ew-done-row').count(), 1);
    const learned = await p.evaluate(() => localStorage.getItem('wex-exam-words-2026-full-user-1-progress-v1'));
    p.once('dialog', dialog => dialog.dismiss());
    await p.locator('#ew-new-round').click();
    assert.deepEqual(await round(), complete);
    p.once('dialog', dialog => dialog.accept());
    await p.locator('#ew-new-round').click();
    assert.equal((await round()).value.answers.length, 0);
    assert.equal(await p.evaluate(() => localStorage.getItem('wex-exam-words-2026-full-user-1-progress-v1')), learned);
    console.log('OK completed score restores, cancelled restart keeps it and confirmed restart preserves learned words');

    await answer(false);
    const standalone = await round();
    await p.goto(base + '/study');
    await p.locator('#studyStart').click();
    await p.locator('[data-study-step="words"]').click();
    const guidedUrl = p.url();
    await answer(true);
    const guided = await round();
    assert.notEqual(guided.key, standalone.key);
    assert.equal(await p.locator('[data-mode="cards"]').isDisabled(), true);
    await p.goto(base + '/exam-words');
    assert.deepEqual(await round(), standalone);
    await p.goto(guidedUrl);
    assert.deepEqual(await round(), guided);
    await p.locator('[data-role="next"]').click();
    for (let i = 1; i < 10; i++) { await answer(true); await p.locator('[data-role="next"]').click(); }
    await p.locator('[data-study-return]').click();
    assert.equal(await p.locator('#studySessionCount').innerText(), '1 of 2 steps checked');
    await p.locator('[data-study-step="words"]').click();
    await p.reload();
    assert.equal(await p.locator('.ew-done-score').innerText(), '10/10');
    console.log('OK standalone and guided rounds are independent, recovered guided work completes its real step');

    await p.goto(base + '/exam-words-demo');
    const demo = await round();
    assert.match(demo.key, /demo-user-1:standalone/);
    assert.notDeepEqual(demo.value.queue, standalone.value.queue);
    await p.goto(base + '/exam-words');
    assert.deepEqual(await round(), standalone);
    await login(2);
    await p.goto(base + '/exam-words');
    const accountTwo = await round();
    assert.match(accountTwo.key, /full-user-2:standalone/);
    assert.equal(accountTwo.value.answered, null);
    // Copy another account's blob into this account's key: ownership must still reject it.
    await p.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: accountTwo.key, value: standalone.value });
    await p.reload();
    assert.equal((await round()).value.owner, 'full-user-2:standalone');
    assert.equal((await round()).value.answered, null);
    console.log('OK demo/full and account boundaries, including a forged foreign-owner cache');

    for (const kind of ['expired', 'broken', 'invalid-options']) {
      await p.locator('[data-mode="quiz"]').click();
      const cached = await round();
      await p.evaluate(({ key, value, kind }) => {
        if (kind === 'expired') value.startedAt = Date.now() - 8 * 86400000;
        if (kind === 'invalid-options') value.options = [value.queue[0], value.queue[0]];
        localStorage.setItem(key, kind === 'broken' ? '{bad' : JSON.stringify(value));
      }, { ...cached, kind });
      await p.reload();
      const fresh = await round();
      assert.equal(fresh.value.answers.length, 0);
      assert.equal(fresh.value.answered, null);
      assert(fresh.value.startedAt >= cached.value.startedAt);
      assert.equal(new Set(fresh.value.options).size, 4);
    }
    await answer(false);
    for (const width of [320, 390, 1440]) { await p.setViewportSize({ width, height: 900 }); await fits(); }
    await p.screenshot({ path: path.join(__dirname, 'word-round-desktop.png'), fullPage: true, animations: 'disabled' });
    await p.setViewportSize({ width: 390, height: 844 });
    await p.locator('#ew-theme').click();
    await p.waitForTimeout(300);
    await fits();
    await p.screenshot({ path: path.join(__dirname, 'word-round-mobile.png'), fullPage: true, animations: 'disabled' });
    console.log('OK stale/corrupt round replacement and three viewport widths, both themes');

    const blocked = await browser.newContext();
    await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw Error('Blocked storage'); } }));
    const offline = await blocked.newPage();
    const offlineErrors = [];
    offline.on('pageerror', e => offlineErrors.push(e.message));
    await offline.goto(base + '/exam-words-demo');
    await offline.locator('[data-role="reveal"]').click();
    await offline.locator('[data-role="knew"]').click();
    assert.match(await offline.locator('#ew-round-status').innerText(), /unavailable/);
    assert.match(await offline.locator('.ew-stage-count').innerText(), /2 OF 10/i);
    const theme = await offline.locator('html').getAttribute('data-theme');
    await offline.locator('#ew-theme').click();
    assert.notEqual(await offline.locator('html').getAttribute('data-theme'), theme);
    assert.deepEqual(offlineErrors, []);
    await blocked.close();
    assert.deepEqual(errors, []);
    console.log('OK blocked storage still permits practice, no JavaScript errors');
  } finally {
    release?.();
    await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
