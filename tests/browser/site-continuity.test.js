// Local isolated fixture only. No reports, messages, invitations or payments are sent.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = process.env.SITE_TEST_BASE || 'http://127.0.0.1:8765';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => { localStorage.setItem('wex-cookie-consent', 'essential'); });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  async function fits(label) { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label); }
  try {
    await page.goto(base + '/exam-words-demo');
    await page.locator('[data-role="reveal"]').waitFor();
    assert.equal(await page.locator('h1').innerText(), 'Exam words');
    await page.locator('[data-mode="quiz"]').focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-mode="quiz"]').getAttribute('aria-pressed'), 'true');
    await page.locator('.ew-option').first().waitFor();
    await page.locator('[data-mode="cards"]').click();
    await page.locator('#ew-theme').focus(); const theme = await page.locator('html').getAttribute('data-theme');
    await page.keyboard.press('Enter');
    assert.notEqual(await page.locator('html').getAttribute('data-theme'), theme);
    assert.equal(await page.locator('[data-role="reveal"]').count(), 1, 'native theme activation must not reveal a card');
    await page.locator('#ew-body').click({position:{x:2,y:2}});
    await page.keyboard.press('Space'); await page.locator('[data-role="knew"]').waitFor();
    assert.equal(await page.evaluate(() => document.activeElement.dataset.role), 'knew');
    await page.keyboard.press('Enter');
    assert.match(await page.locator('.ew-stage-count').innerText(), /Word 2 of 10/i);
    assert(await page.locator('.ew-term').evaluate(node => node === document.activeElement));
    await page.keyboard.press('Space'); await page.locator('[data-role="knew"]').waitFor();
    await page.keyboard.press('2'); assert.match(await page.locator('.ew-stage-count').innerText(), /Word 3 of 10/i);
    await page.locator('#examWordsBurgerBtn').click();
    assert.equal(await page.locator('#sidebar').getAttribute('aria-hidden'), 'false');
    assert(await page.locator('.ew-app').evaluate(node => node.inert));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sbCloseBtn');
    await page.keyboard.press('Shift+Tab'); assert(await page.locator('#sidebar').evaluate(node => node.contains(document.activeElement)));
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'sbCloseBtn');
    await page.keyboard.press('1'); await page.keyboard.press('Space');
    assert.equal(await page.locator('[data-role="reveal"]').count(), 1, 'menu must isolate study shortcuts');
    // Space activates Close naturally. Reopen to check Escape and restored focus.
    if (await page.locator('#sidebar').evaluate(node => node.classList.contains('open'))) await page.keyboard.press('Escape');
    await page.locator('#examWordsBurgerBtn').click(); await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'examWordsBurgerBtn');
    assert(await page.locator('#sidebar').evaluate(node => node.inert));
    assert.equal(await page.locator('#examWordsBurgerBtn').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    assert.equal(await page.locator('.ew-app').evaluate(node => node.inert), false);
    await page.locator('#examWordsBurgerBtn').click();
    await page.locator('#sidebar [data-cookie-settings]').click();
    await page.locator('#cookieConsentBanner.show').waitFor();
    assert.equal(await page.locator('#sidebar').getAttribute('aria-hidden'), 'true');
    assert.equal(await page.locator('#cookieConsentBanner').evaluate(node => node.inert), false);
    await page.locator('#cookieEssentialBtn').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'examWordsBurgerBtn');
    await page.locator('[data-mode="quiz"]').click(); await page.locator('.ew-option').first().click();
    assert(await page.locator('.ew-option-state').filter({hasText:'Your answer'}).count());
    assert(await page.locator('.ew-option-state').filter({hasText:'Correct meaning'}).count());
    await page.locator('[data-role="next"]').click();
    assert(await page.locator('.ew-term').evaluate(node => node === document.activeElement));
    await page.locator('#ew-search').fill('zzzzzzzz'); await page.keyboard.press('1');
    assert.equal(await page.locator('[data-role="next"]').count(), 0, 'typing must not answer a word');
    await page.locator('#ew-search').fill('');
    await page.locator('[data-filter="new"]').click();
    assert.equal(await page.locator('[data-filter="new"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.filter), 'new');
    console.log('OK native keyboard actions, word feedback/focus, menu focus/inert and cookie-settings handoff');

    await page.goto(base + '/faq');
    await page.locator('#abtn-1').click();
    assert.equal(await page.locator('#abtn-0').getAttribute('aria-expanded'), 'false');
    assert(await page.locator('#abody-0').evaluate(node => node.inert));
    assert.equal(await page.locator('#abtn-1').getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('#abody-1').evaluate(node => node.inert), false);
    await page.goto(base + '/study-guide');
    assert.equal(await page.locator('.info-card').count(), 6);
    assert(await page.locator('a[href="/signs/lessons"]').count());
    assert(await page.locator('main a[href="/test/0"]').count());
    assert(await page.locator('main a[href="/register"]').count());

    await page.goto(base + '/login'); await page.locator('#email').fill('browser2@example.com'); await page.locator('#password').fill('BrowserTest123'); await page.locator('#btn').click(); await page.waitForURL('**/dashboard');
    await page.goto(base + '/study'); await page.locator('#studyStart').click();
    assert.equal(await page.locator('#studyProgress').getAttribute('value'), '0');
    assert.equal(await page.locator('.study-steps .is-next [data-study-step]').getAttribute('data-study-step'), 'words');
    const session = await page.evaluate(() => window.WEXStudy.read());
    page.once('dialog', d => d.accept()); await page.locator('#studyNew').click();
    await page.locator('#studyCancelNew').click();
    assert.equal((await page.evaluate(() => window.WEXStudy.read())).id, session.id);
    assert.equal(await page.locator('#studyRoute').isVisible(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'studyNew');
    // A completed words step makes signs the next action, keeping the first result.
    await page.evaluate(() => {const value=window.WEXStudy.read();value.steps.words={score:8,total:10,mode:'quiz',completedAt:Date.now()};localStorage.setItem('wexStudy:v1:'+value.account,JSON.stringify(value));});
    await page.reload(); assert.equal(await page.locator('#studyProgress').getAttribute('value'), '1');
    assert.equal(await page.locator('.study-steps .is-next [data-study-step]').getAttribute('data-study-step'), 'signs');
    await page.locator('#studyBurger').click(); assert.equal(await page.locator('#sidebar [aria-current="page"]').getAttribute('href'), '/study'); await page.keyboard.press('Escape');
    await page.goto(base+'/signs/learn'); await page.locator('#learnStage [data-code]').first().waitFor();
    await page.locator('.burger-btn').click(); await page.keyboard.press('1');
    assert.equal(await page.locator('#nextBtn').count(),0);await page.keyboard.press('Escape');
    console.log('OK guide and FAQ state, study next step, first result, reversible session setup and navigation');

    for(const width of [320,390,1440]){
      await page.setViewportSize({width,height:900});
      for(const theme of ['light','dark']){
        await page.evaluate(theme=>localStorage.setItem('wex-theme-v2',theme),theme);
        for(const route of ['/dashboard','/study','/exam-words','/referrals','/profile','/study-guide','/pricing','/contact','/privacy','/exam-day','/exam-language','/rules-2026']){
          const response=await page.goto(base+route);assert.equal(response.status(),200,route);await fits(`${route} ${width} ${theme}`);
          if(route==='/referrals'){
            assert(await page.locator('.ref-hero-inner').evaluate(node=>[...node.children].every(child=>child.getBoundingClientRect().right<=node.getBoundingClientRect().right+1)),`referral content clipped ${width}`);
            assert.equal(await page.locator('.ref-page').evaluate(node=>getComputedStyle(node).color),await page.locator('body').evaluate(node=>getComputedStyle(node).color));
          }
          if(route==='/profile'&&width<620){assert(await page.locator('.history-table').evaluate(node=>node.getBoundingClientRect().right<=innerWidth));assert(await page.locator('.history-review-link').first().isVisible());}
          if(width===390&&['/study','/referrals','/profile','/exam-words'].includes(route))await page.screenshot({path:path.join(__dirname,`continuity-${route.slice(1)}-${theme}.png`),fullPage:true,animations:'disabled'});
        }
      }
    }
    assert.deepEqual(errors, []);
    console.log('OK twelve previous pages at 320/390/1440, both themes, mobile history/referral containment and no JS errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
