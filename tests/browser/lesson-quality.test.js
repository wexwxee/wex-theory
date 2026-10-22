const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { answerSituation } = require('./lesson-answers');
const base = process.env.SITE_TEST_BASE || 'http://127.0.0.1:8765';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    if (location.protocol !== 'http:') return;
    localStorage.setItem('wex-cookie-consent', 'essential'); localStorage.setItem('wexSignsLang', 'ru');
  });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  async function choose(question, right = true) { await answerSituation(page, question, right); }
  async function questions() { return page.locator('#lessonQuestions').evaluate(element => JSON.parse(element.textContent)); }
  async function quiz() {
    await page.locator('.lesson-jump a[href="#lessonQuiz"]').click();
    await page.waitForFunction(() => { const panel = document.querySelector('#lessonQuiz:not([hidden]), #lessonResult:not([hidden])'); const top = panel?.getBoundingClientRect().top; return top >= 55 && top < 260; });
  }
  async function fits() {
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert(await page.locator('.lesson-compare-signs').evaluateAll(elements => elements.every(element => {
      const box = element.getBoundingClientRect();
      return [...element.querySelectorAll('img')].every(image => { const rect = image.getBoundingClientRect(); return rect.left >= box.left - 1 && rect.right <= box.right + 1; });
    })));
  }
  try {
    await page.goto(base + '/signs/lessons');
    assert.equal(await page.locator('[data-lesson-card]:visible').count(), 18);
    await page.locator('[data-lesson-topic="hazards"]').click();
    assert.equal(await page.locator('[data-lesson-card]:visible').count(), 4);
    await page.locator('#lessonSearch').fill('переезды');
    assert.equal(await page.locator('[data-lesson-card]:visible').count(), 1);
    assert.equal(await page.locator('[data-lesson-card="rail-crossings"]').isVisible(), true);
    await page.locator('[data-lang="en"]').click();
    assert.equal(await page.locator('[data-lang="en"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('[data-lesson-card]:visible').count(), 1);
    await page.locator('#lessonSearch').fill('not-a-lesson'); await page.locator('#lessonEmpty').waitFor();
    await page.locator('#lessonShowAll').click();
    assert.equal(await page.locator('[data-lesson-card]:visible').count(), 18);
    console.log('OK topic/search intersection, empty recovery, bilingual labels and pressed states');

    await page.goto(base + '/signs/lesson/road-shape');
    const qs = await questions();
    await quiz();
    const order = await page.locator('.lesson-option').evaluateAll(elements => elements.map(element => element.dataset.answer));
    await choose(qs[0], false);
    assert.match(await page.locator('.lesson-answer').innerText(), /Разберите/);
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains('lesson-answer')), true);
    const saved = await page.evaluate(() => localStorage.getItem('wexSignLesson:guest:road-shape'));
    await page.reload();
    assert.deepEqual(await page.locator('.lesson-option').evaluateAll(elements => elements.map(element => element.dataset.answer)), order);
    assert.equal(await page.evaluate(() => localStorage.getItem('wexSignLesson:guest:road-shape')), saved);
    await page.locator('[data-lang="en"]').click(); await page.locator('[data-lang="ru"]').click();
    assert.equal(await page.evaluate(() => localStorage.getItem('wexSignLesson:guest:road-shape')), saved);
    await page.locator('#lessonNext').click();
    for (const question of qs.slice(1)) { await choose(question); await page.locator('#lessonNext').click(); }
    assert.equal(await page.locator('.lesson-score').innerText(), '3/4');
    assert.equal(await page.locator('.lesson-mistake').count(), 1);
    const overview = await context.newPage(); overview.on('pageerror', error => errors.push(error.message));
    await overview.goto(base + '/signs/lessons');
    assert.match(await overview.locator('#lessonSuggested').getAttribute('href'), /road-shape#lessonQuiz$/);
    await page.locator('[data-review-code]').click();
    assert.equal(await page.locator(`[id="sign-${qs[0].code}"]`).isVisible(), true);
    assert.equal(await page.locator('.sl-stages [data-stage="learn"]').getAttribute('aria-current'), 'step');
    await quiz(); await page.locator('#lessonRetry').click(); await choose(qs[0]); await page.locator('#lessonNext').click();
    assert.equal(await page.locator('.lesson-score').innerText(), '3/4');
    assert.match(await page.locator('.lesson-reviewed-score').innerText(), /4\/4/);
    await overview.waitForFunction(() => !document.getElementById('lessonSuggested').href.includes('road-shape#lessonQuiz'));
    await overview.close();
    await page.reload(); assert.equal(await page.locator('.lesson-score').innerText(), '3/4');
    await quiz(); await page.screenshot({ path: path.join(__dirname, 'lesson-first-score-mobile.png'), animations: 'disabled' });
    assert.match(await page.locator('.lesson-summary-next a').getAttribute('href'), /surface-weather$/);
    console.log('OK stable shuffled choices, focused feedback, honest first score, useful error links and next lesson');

    await page.goto(base + '/signs/lesson/road-shape#sign-A43.1');
    const image = page.locator('.lesson-photo [data-lesson-image]');
    await image.click();
    await page.locator('.lbz-overlay.is-open').waitFor();
    assert.equal(await page.locator('.lbz-overlay').getAttribute('role'), 'dialog');
    assert.equal(await page.locator('#signLesson').evaluate(element => element.inert), true);
    assert.equal(await page.evaluate(() => document.activeElement.className), 'lbz-close');
    await page.locator('[data-lbz="plus"]').click(); assert.equal(await page.locator('.lbz-scale').innerText(), '125%');
    await page.keyboard.press('+'); assert.notEqual(await page.locator('.lbz-scale').innerText(), '125%');
    await page.keyboard.press('0'); assert.equal(await page.locator('.lbz-scale').innerText(), '100%');
    await page.locator('[data-lbz="reset"]').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'lbz-close');
    await page.keyboard.press('Escape'); await page.locator('.lbz-overlay').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#signLesson').evaluate(element => element.inert), false);
    assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-lesson-image')), true);
    console.log('OK enlarged scene, zoom controls, keyboard, focus containment and return focus');

    await page.goto(base + '/signs/lesson/directions');
    const legacyQuestions = await questions();
    await page.evaluate(({ questions }) => {
      const revision = document.getElementById('signLesson').dataset.revision;
      localStorage.setItem('wexSignLesson:guest:directions', JSON.stringify({ version: 1, revision, createdAt: Date.now(),
        deck: questions.map(q => q.id), index: questions.length - 1, answers: Object.fromEntries(questions.map(q => [q.id, q.correct])), finished: true, score: 999, total: 999 }));
    }, { questions: legacyQuestions });
    const legacyAll = `${legacyQuestions.length}/${legacyQuestions.length}`;
    await page.reload(); assert.equal(await page.locator('.lesson-score').innerText(), legacyAll);
    assert.match(await page.locator('#lessonResultStage .lesson-kicker').first().innerText(), /ранее сохранённая/i);
    const legacy = await page.evaluate(() => JSON.parse(localStorage.getItem('wexSignLesson:guest:directions')));
    assert.equal(legacy.legacy, true); assert.equal(legacy.firstAnswers, null);
    page.once('dialog', dialog => dialog.dismiss()); await page.locator('#lessonRestart').click(); assert.equal(await page.locator('.lesson-score').innerText(), legacyAll);
    page.once('dialog', dialog => dialog.accept()); await page.locator('#lessonRestart').click(); assert.equal(await page.locator('.lesson-counter').innerText(), `Ситуация 1 из ${legacyQuestions.length}`);
    console.log('OK unchanged legacy results migrate without fabricated first scores, restart needs confirmation');

    await page.goto(base + '/signs/lesson/priority');
    const revisedQuestions = await questions();
    await page.evaluate(questions => localStorage.setItem('wexSignLesson:guest:priority', JSON.stringify({
      version: 1, revision: '2026-10-16.2', createdAt: Date.now(), deck: questions.map(q => q.id),
      index: questions.length - 1, answers: Object.fromEntries(questions.map(q => [q.id, q.correct])), finished: true,
    })), revisedQuestions);
    await page.reload();
    assert.match(await page.locator('#lessonSaveState').innerText(), /обновлены/);
    assert.equal(await page.locator('.lesson-counter').innerText(), `Ситуация 1 из ${revisedQuestions.length}`);

    await page.goto(base + '/login'); await page.locator('#email').fill('browser2@example.com'); await page.locator('#password').fill('BrowserTest123'); await page.locator('#btn').click(); await page.waitForURL('**/dashboard');
    await page.goto(base + '/signs/lessons'); assert.match(await page.locator('#lessonOverviewProgress').innerText(), /^0\/18/);
    await page.goto(base + '/study'); await page.locator('#studyTopics summary').click(); await page.locator('[data-study-choice=\"road-shape\"]').click(); await page.locator('#studyStart').click();
    await page.locator('[data-study-step="words"]').click();
    for (let i = 0; i < 10; i++) { await page.locator('.ew-option').first().click(); await page.locator('[data-role="next"]').click(); }
    await page.locator('[data-study-return]').click(); await page.locator('[data-study-step="signs"]').click();
    await page.locator('.sl-stages [data-stage="situations"]').click();
    const guidedQuestions = await questions();
    for (let i = 0; i < guidedQuestions.length; i++) { await choose(guidedQuestions[i], i > 0); await page.locator('#lessonNext').click(); }
    const firstStep = await page.evaluate(() => window.WEXStudy.read().steps.signs);
    assert.equal(firstStep.score, 3);
    await page.reload(); await page.locator('[data-lang="en"]').click();
    await page.locator('#lessonRetry').click(); await choose(guidedQuestions[0]); await page.locator('#lessonNext').click();
    assert.match(await page.locator('.lesson-reviewed-score').innerText(), /4\/4/);
    assert.deepEqual(await page.evaluate(() => window.WEXStudy.read().steps.signs), firstStep);
    await page.locator('[data-study-return]').click(); assert.equal(await page.locator('#studySessionCount').innerText(), '2 of 2 steps checked');
    console.log('OK account boundary and actual study journey: first score/time stay fixed after reload, language change and corrected mistakes');

    const all = (await (await page.request.get(base + '/api/signs')).json()).lessons;
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const lesson of all) { assert.equal((await page.goto(base + '/signs/lesson/' + lesson.id)).status(), 200); await fits(); }
    }
    await page.goto(base + '/signs/lessons'); await page.screenshot({ path: path.join(__dirname, 'lessons-quality-desktop.png'), animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 900 }); await page.goto(base + '/signs/lesson/road-shape');
    await page.locator('#navThemeBtn').click(); await page.waitForTimeout(350); await fits();
    await page.screenshot({ path: path.join(__dirname, 'lesson-quality-mobile-light.png'), animations: 'disabled' });
    console.log('OK all 18 lessons at three widths, comparison images stay inside their containers, both themes');

    const blocked = await browser.newContext();
    await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw Error('Blocked storage'); } }));
    const offline = await blocked.newPage(); const blockedErrors = []; offline.on('pageerror', error => blockedErrors.push(error.message));
    await offline.goto(base + '/signs/lesson/priority'); await offline.locator('[data-lang="ru"]').click();
    await offline.locator('.sl-stages [data-stage="situations"]').click();
    const question = await offline.locator('#lessonQuestions').evaluate(element => JSON.parse(element.textContent)[0]);
    assert.equal(await offline.locator('.lesson-question').innerText(), question.prompt.ru);
    await answerSituation(offline, question);
    assert.match(await offline.locator('#lessonSaveState').innerText(), /недоступно/);
    assert.match(await offline.locator('.lesson-answer').innerText(), /Верно/);
    assert.deepEqual(blockedErrors, []); await blocked.close();
    assert.deepEqual(errors, []); console.log('OK unavailable storage remains usable in Russian, no JavaScript errors');
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
