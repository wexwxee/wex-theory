// Road sign tests 1-4: a separate dashboard block, the ordinary test room and results, and a
// mistake review that names the sign test. Uses the temporary fixture on 8765.
const fs = require('fs');
const path = require('path');
const {chromium} = require('playwright');
const assert = require('node:assert/strict');

const DATA = path.join(__dirname, '../../data/signs');
const tests = JSON.parse(fs.readFileSync(path.join(DATA, 'sign_tests.json'), 'utf8'));
const lessons = JSON.parse(fs.readFileSync(path.join(DATA, 'situations.json'), 'utf8')).situations;
const byId = Object.fromEntries([...lessons, ...tests.extra_situations].map(item => [item.id, item]));
const firstTest = tests.tests[0].situations.map(id => byId[id]);

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

    await page.locator('#signTests').waitFor();
    const signCards = await page.locator('.dw-sign-tests [data-test-card]').evaluateAll(cards => cards.map(card => card.dataset.testUrl));
    assert.deepEqual(signCards, ['/test/101', '/test/102', '/test/103', '/test/104']);
    const practiceCards = await page.locator('.dw-tests:not(.dw-sign-tests) [data-test-card]').evaluateAll(cards => cards.map(card => card.dataset.testUrl));
    assert(!practiceCards.some(url => /\/test\/10[1-4]$/.test(url)), 'sign tests stay out of the practice block');
    assert(await noOverflow());
    console.log('OK dashboard: separate block with Road Signs Tests 1-4');

    await page.goto(base + '/test/101');
    await page.locator('#questionArea').waitFor();
    for (let i = 0; i < firstTest.length; i++) {
      const options = page.locator('#answersContainer .answer-option');
      assert.equal(await options.count(), firstTest[i].statements.length, `question ${i + 1}`);
      for (let k = 0; k < firstTest[i].statements.length; k++) {
        const text = await options.nth(k).textContent();
        const statement = firstTest[i].statements.find(s => text.includes(s.text.en.replace(/\.$/, '')));
        assert(statement, `question ${i + 1}: unknown option`);
        // Question 1 is answered the wrong way round so the mistake review has something to show.
        if (statement.correct !== (i === 0)) await options.nth(k).click();
      }
      if (i + 1 < firstTest.length) await page.locator('#nextBtn').click();
    }
    assert(await noOverflow());
    await page.locator('#finishBtn').click();
    await page.locator('#submitBtn').click();
    await page.waitForURL('**/results/*');
    assert.match(await page.locator('body').innerText(), /24\s*\/\s*25/);
    console.log('OK test room: 25 situations scored like an ordinary test (24/25)');

    await page.goto(base + '/dashboard');
    assert.match(await page.locator('.dw-sign-tests [data-test-card]').first().innerText(), /24\/25/);
    await page.goto(base + '/profile');
    assert.match(await page.locator('.access-date', {hasText: 'tests'}).first().innerText(), /^0\s*\/\s*14\s*tests$/);
    console.log('OK dashboard score shown; profile still counts only the 14 theory tests');

    await page.goto(base + '/signs/lessons');
    const courseLinks = await page.locator('#signTests .sx-exam-test').evaluateAll(links => links.map(link => link.getAttribute('href')));
    assert.deepEqual(courseLinks, ['/test/101', '/test/102', '/test/103', '/test/104']);
    assert.match(await page.locator('#signTests .sx-exam-test').first().innerText(), /24\/25/);
    assert(await noOverflow());
    console.log('OK course page offers the four tests after the lessons, with the latest score');

    await page.goto(base + '/review');
    await page.locator('.question-origin').waitFor();
    // The fixture also seeds two Theory Test 1 mistakes, so look through every due question.
    const origins = [];
    for (let i = 0; i < await page.locator('#reviewDots button').count(); i++) {
      await page.locator('#reviewDots button').nth(i).click();
      origins.push(await page.locator('.question-origin').textContent());
    }
    assert(origins.includes('Road signs test 1 · question 1'), origins.join(' | '));
    assert(await noOverflow());
    assert.deepEqual(errors, []);
    console.log('OK mistake review names the sign test; no JS errors');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
