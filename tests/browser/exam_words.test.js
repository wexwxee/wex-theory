/* Headless check of the Exam Words page.

   The study loop lives in the browser, so python tests cannot see it. This
   drives the real rendered page with jsdom: start a session, reveal a card,
   grade it, answer the quiz that follows, finish the round, then search and
   mark words in the dictionary.

   How to run (jsdom is not a project dependency, install it where you like):

       npm install jsdom
       python -c "..."  # save the rendered page as ew_page.html, see below
       node tests/browser/exam_words.test.js

   The page HTML is expected next to this file as ew_page.html; produce it with
   the app's test client so the test runs against what the server really sends.
*/
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HERE = __dirname;
const APP = path.resolve(__dirname, '..', '..');

const html = fs.readFileSync(path.join(HERE, 'ew_page.html'), 'utf8');
const dataJs = fs.readFileSync(path.join(APP, 'static/js/exam-words.js'), 'utf8');
const dictJs = fs.readFileSync(path.join(APP, 'static/js/exam-words-data.js'), 'utf8');

const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://local.test/exam-words' });
const { window } = dom;

// The page talks to the server for progress; answer politely with nothing.
window.fetch = () => Promise.resolve({ ok: true, json: async () => ({ success: true, progress: {} }) });
window.sbOpen = () => {};
window.toggleTheme = () => {};
window.confirm = () => true;

const results = [];
function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition), detail: detail || '' });
}

// Two <script> tags share one global lexical scope in a browser;
// separate eval() calls do not, so run them as one.
window.eval([dictJs, dataJs].join('\n'));

const doc = window.document;
const $ = (sel) => doc.querySelector(sel);
const text = () => $('#ew-body').textContent.replace(/\s+/g, ' ').trim();

// ── Header ─────────────────────────────────────────────────────────────────
check('scope counts filled', $('.ew-scope .ew-scope-count').textContent !== '0',
  'exam=' + $('.ew-scope .ew-scope-count').textContent);
check('legend rendered', /words in this set/.test($('#ew-legend').textContent), $('#ew-legend').textContent);

// ── Study: intro ───────────────────────────────────────────────────────────
check('study intro shown', /Start studying/.test(text()));
const startBtn = [...doc.querySelectorAll('#ew-body button')].find(b => /Start studying/.test(b.textContent));
check('start button exists', Boolean(startBtn));
startBtn.click();

// ── Study: first card ──────────────────────────────────────────────────────
check('card asks for meaning', /What does this mean\?/.test(text()), text().slice(0, 80));
const revealBtn = [...doc.querySelectorAll('#ew-body button')].find(b => /Show the meaning/.test(b.textContent));
check('reveal button exists', Boolean(revealBtn));
revealBtn.click();
check('meaning revealed', /Dansk/.test(text()), text().slice(0, 120));

const knewBtn = [...doc.querySelectorAll('#ew-body button')].find(b => /I knew it/.test(b.textContent));
check('grade buttons exist', Boolean(knewBtn));
knewBtn.click();
check('advanced to card 2', doc.querySelectorAll('.ew-dot.is-done').length === 1,
  'done dots=' + doc.querySelectorAll('.ew-dot.is-done').length);

// second card, then the third step must be a quiz
[...doc.querySelectorAll('#ew-body button')].find(b => /Show the meaning/.test(b.textContent)).click();
[...doc.querySelectorAll('#ew-body button')].find(b => /Repeat later/.test(b.textContent)).click();
check('third step is a quiz', /Choose the meaning/.test(text()), text().slice(0, 60));
const options = [...doc.querySelectorAll('.ew-option')];
check('quiz has four options', options.length === 4, 'options=' + options.length);
check('quiz options are unique', new Set(options.map(o => o.textContent)).size === options.length);
options[0].click();
check('quiz gives a verdict', Boolean($('.ew-verdict')), $('.ew-verdict')?.textContent);
check('quiz marks the right answer', doc.querySelectorAll('.ew-option.is-right').length === 1);
[...doc.querySelectorAll('#ew-body button')].find(b => /Next word/.test(b.textContent)).click();

// finish the round
let guard = 0;
while (!/^\d+\/\d+/.test(text()) && guard < 40) {
  guard += 1;
  const buttons = [...doc.querySelectorAll('#ew-body button')];
  const next = buttons.find(b => /Next word/.test(b.textContent))
    || buttons.find(b => /Show the meaning/.test(b.textContent))
    || buttons.find(b => /I knew it/.test(b.textContent))
    || doc.querySelector('.ew-option:not([disabled])');
  if (!next) break;
  next.click();
}
check('round ends with a summary', /Next ten/.test(text()), text().slice(0, 80));

// ── Progress is stored ─────────────────────────────────────────────────────
const stored = JSON.parse(window.localStorage.getItem('wex-exam-words-2026-full-progress-v1') || '{}');
check('progress saved to storage', Object.keys(stored).length > 0, 'entries=' + Object.keys(stored).length);

// ── Dictionary ─────────────────────────────────────────────────────────────
[...doc.querySelectorAll('.ew-tab')].find(b => b.dataset.tab === 'dictionary').click();
check('dictionary rows render', doc.querySelectorAll('.ew-row').length > 20,
  'rows=' + doc.querySelectorAll('.ew-row').length);
check('search box visible', $('#ew-search-wrap').hidden === false);

const search = $('#ew-search');
search.value = 'oncoming';
search.dispatchEvent(new window.Event('input'));
const found = doc.querySelectorAll('.ew-row').length;
check('search narrows the list', found > 0 && found < 10, 'rows=' + found);

search.value = '';
search.dispatchEvent(new window.Event('input'));

// mark a word learned from the dictionary
const mark = doc.querySelector('.ew-mark');
mark.click();
check('marking from the dictionary works', doc.querySelectorAll('.ew-mark.is-on').length > 0);

// ── Scope switch ───────────────────────────────────────────────────────────
const before = doc.querySelectorAll('.ew-row').length;
[...doc.querySelectorAll('.ew-scope')].find(b => b.dataset.scope === 'all').click();
const after = doc.querySelectorAll('.ew-row').length;
check('scope switch widens the list', after > before, `${before} -> ${after}`);

// ── Report ─────────────────────────────────────────────────────────────────
let failed = 0;
results.forEach((r) => {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? '  [' + r.detail + ']' : ''}`);
});
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
