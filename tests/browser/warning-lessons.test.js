const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { answerSituation, answerCount } = require('./lesson-answers');
const base = process.env.SITE_TEST_BASE || 'http://127.0.0.1:8765';
const additions = ['road-shape', 'surface-weather', 'rail-crossings', 'vehicle-access', 'users-prohibitions'];
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => { if (/^https?:$/.test(location.protocol)) localStorage.setItem('wex-cookie-consent', 'essential'); });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  async function fits() { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
  try {
    const payload = await (await page.request.get(base + '/api/signs')).json();
    assert.equal(payload.lessons.length, 18);
    assert.equal(payload.signs.length, 266);
    assert.equal(payload.signs.filter(sign => sign.teaching.action).length, 163);
    assert(payload.signs.filter(sign => ['A', 'B', 'C', 'D'].includes(sign.group)).every(sign => sign.teaching.action));
    await page.goto(base + '/signs/lessons');
    assert.equal(await page.locator('[data-lesson-card]').count(), 18);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const id of additions) {
        assert.equal((await page.goto(base + '/signs/lesson/' + id)).status(), 200);
        await fits();
        const notes = page.locator('.lesson-note');
        assert(await notes.count() >= 4 && await notes.count() <= 12);
        for (const image of await page.locator('.lesson-note img, .lesson-compare img').all()) {
          await image.evaluate(element => element.decode());
          assert(await image.evaluate(element => element.naturalWidth > 0));
        }
      }
    }
    console.log('OK five new bilingual lesson sets and valid SVGs at three widths, all A/B/C/D signs reviewed');

    await page.setViewportSize({ width: 390, height: 844 });
    for (const id of additions) {
      await page.goto(base + '/signs/lesson/' + id);
      const questions = await page.locator('#lessonQuestions').evaluate(element => JSON.parse(element.textContent));
      assert(questions.length >= 4 && questions.every(q => q.kind === 'statements'));
      await page.locator('[data-lang="en"]').click();
      await page.locator('.sl-stages [data-stage="situations"]').click();
      await answerSituation(page, questions[0], false);
      assert.equal(await page.locator('.lesson-answer p').innerText(), questions[0].explanation.en);
      const saved = await page.evaluate(id => localStorage.getItem('wexSignLesson:guest:' + id), id);
      await page.reload();
      await page.locator('#lessonNext').waitFor();
      assert.equal(await page.evaluate(id => localStorage.getItem('wexSignLesson:guest:' + id), id), saved);
      assert.equal(await page.locator('.lesson-option:disabled').count(), answerCount(questions[0]));
      await page.locator('[data-lang="ru"]').click();
      assert.equal(await page.locator('.lesson-answer p').innerText(), questions[0].explanation.ru);
      await page.locator('#lessonNext').click();
      for (const question of questions.slice(1)) {
        assert.equal(await page.locator('.lesson-question').innerText(), question.prompt.ru);
        await answerSituation(page, question);
        assert.equal(await page.locator('.lesson-answer p').innerText(), question.explanation.ru);
        await page.locator('#lessonNext').click();
      }
      assert.equal(await page.locator('.lesson-score').innerText(), `${questions.length - 1}/${questions.length}`);
      await page.reload();
      assert.equal(await page.locator('.lesson-score').innerText(), `${questions.length - 1}/${questions.length}`);
      await page.locator('#lessonRetry').click();
      assert.match(await page.locator('.lesson-counter').innerText(), /1 из 1/);
      await answerSituation(page, questions[0]);
      await page.locator('#lessonNext').click();
      assert.equal(await page.locator('.lesson-score').innerText(), `${questions.length - 1}/${questions.length}`);
      assert.match(await page.locator('.lesson-reviewed-score').innerText(), new RegExp(`${questions.length}/${questions.length}`));
      await page.goto(base + '/signs/lessons');
      assert.match(await page.locator(`[data-lesson-result="${id}"]`).innerText(), new RegExp(`${questions.length}/${questions.length}`));
    }
    console.log('OK all 16 new situations, EN/RU explanations, exact answer recovery, scores and missed-only retry');

    for (const [id, code] of [['road-shape', 'A43.1'], ['priority', 'B11'], ['restrictions', 'C11.2']]) {
      await page.goto(base + '/signs/lesson/' + id + '#sign-' + code);
      const scene = page.locator(`.lesson-photo img[alt="Road scene with ${code}"]`);
      await scene.scrollIntoViewIfNeeded();
      await scene.evaluate(element => element.decode());
      assert(await scene.evaluate(element => element.naturalWidth > 0));
      await fits();
    }
    await page.goto(base + '/signs/lesson/road-shape#sign-A43.1');
    await page.locator('.lesson-photo').scrollIntoViewIfNeeded();
    await page.locator('.lesson-photo img').evaluate(element => element.decode());
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(__dirname, 'road-shape-scene-mobile.png'), animations: 'disabled' });
    await page.locator('#navThemeBtn').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(__dirname, 'road-shape-scene-mobile-light.png'), animations: 'disabled' });
    console.log('OK three newly linked existing public scenes load, photo question and both mobile themes');

    await page.goto(base + '/signs/lesson/surface-weather');
    await page.locator('.lesson-sources').locator('summary').click();
    assert.equal(await page.locator('.lesson-sources a[href*="vejdirektoratet.dk"]').count(), 1);
    await page.goto(base + '/signs/A36.1');
    assert.equal(await page.locator('a[href*="Ny%20tavle%20til%20Actibump.pdf"]').count(), 1);
    await page.goto(base + '/signs/C59');
    assert.match(await page.locator('body').innerText(), /кроме запретов остановки и стоянки/);
    await page.goto(base + '/signs');
    await page.locator('#signsReviewed').check();
    assert.equal(await page.locator('.sign-card:visible').count(), 163);
    await page.locator('[data-group="A"].signs-chip').click();
    const warningCount = payload.signs.filter(sign => sign.group === 'A').length;
    assert.equal(await page.locator('.sign-card:visible').count(), warningCount);
    await page.reload();
    assert.equal(await page.locator('#signsReviewed').isChecked(), true);
    assert.equal(await page.locator('.sign-card:visible').count(), 163);
    assert.deepEqual(errors, []);
    console.log('OK exact special-source links, C59 exception, reviewed warning filter, restored controls and no JS errors');
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
