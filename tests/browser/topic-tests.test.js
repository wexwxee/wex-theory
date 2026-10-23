// Topic tests (Car & Equipment Test 1, id 201): their own dashboard block, the ordinary test room and
// results, explanations that name the teaching-plan source, and a mistake review that names the test.
// Uses the temporary fixture on 8765.
const fs = require('fs');
const path = require('path');
const {chromium} = require('playwright');
const assert = require('node:assert/strict');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/topic_tests.json'), 'utf8'));
const test = data.tests[0];

(async () => {
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH});
  const context = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
  await context.addInitScript(() => localStorage.setItem('wex-cookie-consent', 'essential'));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const base = process.env.SITE_TEST_BASE || 'http://127.0.0.1:8765';
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  try {
    await page.goto(base + '/login');
    await page.locator('#email').fill('browser4@example.com');
    await page.locator('#password').fill('BrowserTest123');
    await page.locator('#btn').click();
    await page.waitForURL('**/dashboard');

    await page.locator('#topicTests').waitFor();
    const topicCards = await page.locator('.dw-topic-tests [data-test-card]').evaluateAll(cards => cards.map(card => card.dataset.testUrl));
    assert.deepEqual(topicCards, [`/test/${test.id}`]);
    const otherCards = await page.locator('.dw-tests:not(.dw-topic-tests) [data-test-card]').evaluateAll(cards => cards.map(card => card.dataset.testUrl));
    assert(!otherCards.includes(`/test/${test.id}`), 'the topic test stays out of the other blocks');
    assert.match(await page.locator('.dw-topic-tests [data-test-card]').innerText(), /Car & equipment · 25 questions/);
    const thumb = page.locator('.dw-topic-tests img');
    await thumb.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => { const img = document.querySelector('.dw-topic-tests img'); return img.complete && img.naturalWidth > 0; });
    assert(await noOverflow());
    console.log('OK dashboard: separate Topic tests block with Car & Equipment Test 1');

    await page.goto(base + `/test/${test.id}`);
    await page.locator('#questionArea').waitFor();
    for (let i = 0; i < test.questions.length; i++) {
      const question = test.questions[i];
      const options = page.locator('#answersContainer .answer-option');
      assert.equal(await options.count(), question.statements.length, `question ${i + 1}`);
      for (let k = 0; k < question.statements.length; k++) {
        const text = await options.nth(k).textContent();
        const statement = question.statements.find(s => text.includes(s.text.en.replace(/\.$/, '')));
        assert(statement, `question ${i + 1}: unknown option`);
        // Question 2 is answered the wrong way round so the mistake review has something to show.
        if (statement.correct !== (i === 1)) await options.nth(k).click();
      }
      if (i + 1 < test.questions.length) await page.locator('#nextBtn').click();
    }
    assert(await noOverflow());
    await page.locator('#finishBtn').click();
    await page.locator('#submitBtn').click();
    await page.waitForURL('**/results/*');
    const results = await page.locator('body').innerText();
    assert.match(results, /24\s*\/\s*25/);
    assert((await page.content()).includes('teaching plan for category B (version 1.1, May 2026), 1.2.3 (4), (22).'),
      'the explanation names the teaching-plan points');
    console.log('OK test room: 25 questions scored like an ordinary test (24/25); explanations name their source');

    await page.goto(base + '/dashboard');
    assert.match(await page.locator('.dw-topic-tests [data-test-card]').innerText(), /24\/25/);
    await page.goto(base + '/profile');
    assert.match(await page.locator('.access-date', {hasText: 'tests'}).first().innerText(), /^0\s*\/\s*14\s*tests$/);
    console.log('OK dashboard score shown; profile still counts only the 14 theory tests');

    await page.goto(base + '/review');
    await page.locator('.question-origin').waitFor();
    const origins = [];
    for (let i = 0; i < await page.locator('#reviewDots button').count(); i++) {
      await page.locator('#reviewDots button').nth(i).click();
      origins.push(await page.locator('.question-origin').textContent());
    }
    assert(origins.includes(`${test.title} · question 2`), origins.join(' | '));
    assert(await noOverflow());
    assert.deepEqual(errors, []);
    console.log('OK mistake review names the topic test; no JS errors');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
