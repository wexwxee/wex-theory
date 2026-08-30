/* Headless check of the Exam Words workspace.

   Run it with jsdom installed anywhere you like:
       npm install jsdom
       node tests/browser/exam_words.test.js
   It expects the rendered page saved next to it as ew_page.html - produce it
   with the app's test client so the test runs against what the server sends.

   Original note: load the real rendered page, run
   the real scripts, and drive the loop the way a learner would - including the
   keyboard, which is the point of the redesign. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HERE = __dirname;
const APP = path.resolve(__dirname, '..', '..');

const html = fs.readFileSync(path.join(HERE, 'ew_page.html'), 'utf8');
const appJs = fs.readFileSync(path.join(APP, 'static/js/exam-words.js'), 'utf8');
const dataJs = fs.readFileSync(path.join(APP, 'static/js/exam-words-data.js'), 'utf8');

const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://local.test/exam-words' });
const { window } = dom;

window.fetch = () => Promise.resolve({ ok: true, json: async () => ({ success: true, progress: {} }) });
window.sbOpen = () => {};
window.toggleTheme = () => {};
window.confirm = () => true;

const results = [];
function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition), detail: detail || '' });
}

// Two <script> tags share one global lexical scope in a browser; two eval calls do not.
window.eval([dataJs, appJs].join('\n'));

const doc = window.document;
const $ = (sel) => doc.querySelector(sel);
const $$ = (sel) => [...doc.querySelectorAll(sel)];
const stageText = () => $('#ew-body').textContent.replace(/\s+/g, ' ').trim();

function key(k) {
  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
}

// ── The session starts on its own: no intro screen, no extra click ─────────
check('session starts immediately', /What does this mean\?/.test(stageText()), stageText().slice(0, 60));
check('word counter shown', /Word 1 of 10/.test($('.ew-stage-meta').textContent));
check('side list is populated', $$('.ew-list-row').length > 50, 'rows=' + $$('.ew-list-row').length);
check('scope counts filled', $('.ew-scope .ew-scope-count').textContent === '276',
  $('.ew-scope .ew-scope-count').textContent);

// ── Space reveals, 1 grades ────────────────────────────────────────────────
key(' ');
check('space reveals the meaning', /Dansk/.test(stageText()), stageText().slice(0, 90));
key('1');
check('1 grades and moves on', /Word 2 of 10/.test($('.ew-stage-meta').textContent),
  $('.ew-stage-meta').textContent.trim());

// clicking the card also reveals
$('.ew-stage-card').click();
check('clicking the card reveals', /Dansk/.test(stageText()));
key('2');
check('2 sends the word back', /Word 3 of 10/.test($('.ew-stage-meta').textContent));

// ── Third step is a quiz, answerable from the keyboard ─────────────────────
check('third step is a quiz', /Which meaning is right\?/.test(stageText()), stageText().slice(0, 50));
check('four options', $$('.ew-option').length === 4, 'options=' + $$('.ew-option').length);
check('options are distinct', new Set($$('.ew-option').map((o) => o.textContent)).size === 4);
key('1');
check('keyboard answers the quiz', Boolean($('.ew-verdict')), $('.ew-verdict')?.textContent.slice(0, 40));
check('right answer marked', $$('.ew-option.is-right').length === 1);
key('Enter');
check('enter moves to the next word', /Word 4 of 10/.test($('.ew-stage-meta').textContent));

// ── Finish the round ───────────────────────────────────────────────────────
let guard = 0;
while (!/^\d+\/10/.test(stageText()) && guard < 60) {
  guard += 1;
  const typing = $('#ew-body .ew-type');
  if (typing && !$('#ew-body [data-role="next"]')) {
    $('#ew-body .ew-type-input').value = 'x';
    typing.dispatchEvent(new window.Event('submit', { cancelable: true }));
    continue;
  }
  const next = $('#ew-body [data-role="next"]') || $('#ew-body [data-role="reveal"]')
    || $('#ew-body [data-role="knew"]') || $('#ew-body .ew-option:not([disabled])');
  if (!next) break;
  next.click();
}
check('round ends with a score', /Next ten words/.test(stageText()), stageText().slice(0, 60));

const stored = JSON.parse(window.localStorage.getItem('wex-exam-words-2026-full-progress-v1') || '{}');
check('progress is saved', Object.keys(stored).length > 0, 'entries=' + Object.keys(stored).length);

// ── Side list: search, filter, jump ────────────────────────────────────────
const search = $('#ew-search');
search.value = 'oncoming';
search.dispatchEvent(new window.Event('input'));
check('search narrows the list', $$('.ew-list-row').length > 0 && $$('.ew-list-row').length < 8,
  'rows=' + $$('.ew-list-row').length);

const jumpTo = $('.ew-list-row');
const jumpLabel = jumpTo.querySelector('.ew-list-term').textContent;
jumpTo.click();
check('clicking a word studies it', stageText().includes(jumpLabel), jumpLabel);

search.value = '';
search.dispatchEvent(new window.Event('input'));

const repeatChip = $$('.ew-chip').find((c) => /To repeat/.test(c.textContent));
repeatChip.click();
const repeatRows = $$('.ew-list-row').length;
check('filter shows only repeats', repeatRows > 0 && repeatRows < 50, 'rows=' + repeatRows);
$$('.ew-chip').find((c) => /All/.test(c.textContent)).click();

// ── Scope switch rebuilds the set ──────────────────────────────────────────
const before = $$('.ew-list-row').length;
$$('.ew-scope').find((b) => b.dataset.scope === 'all').click();
check('scope switch widens the set', $$('.ew-list-row').length > before,
  `${before} -> ${$$('.ew-list-row').length}`);
check('session restarts on scope change', /Word 1 of 10/.test($('.ew-stage-meta').textContent));

// ── Speaker icon is a real icon, not an emoji ──────────────────────────────
check('speaker is an svg icon', Boolean($('.ew-speak svg')), $('.ew-speak')?.textContent === '' ? 'no text' : 'has text');

// ── Study modes ────────────────────────────────────────────────────────────
const modeButtons = $$('.ew-mode').filter((b) => !b.hidden);
check('modes offered', modeButtons.length >= 5, 'modes=' + modeButtons.map((b) => b.dataset.mode).join(','));

function pickMode(name) {
  $$('.ew-mode').find((b) => b.dataset.mode === name).click();
}

pickMode('cards');
check('cards mode asks for recall', /What does this mean\?/.test(stageText()));

pickMode('quiz');
check('quiz mode asks every word', /Which meaning is right\?/.test(stageText()));
check('quiz mode shows options', $$('.ew-option').length === 4);

pickMode('reverse');
check('reverse mode asks for the English', /Which English does the test use\?/.test(stageText()),
  stageText().slice(0, 60));
const reverseOptions = $$('.ew-option').map((o) => o.textContent);
check('reverse options are english', /[a-z]/.test(reverseOptions[0]) && !/[а-я]/i.test(reverseOptions.join('')),
  reverseOptions[0]);

pickMode('typing');
check('typing mode has an input', Boolean($('.ew-type-input')));
const typed = $('.ew-type-input');
typed.value = 'definitely wrong answer';
$('.ew-type').dispatchEvent(new window.Event('submit', { cancelable: true }));
check('typing checks the answer', Boolean($('.ew-verdict')), $('.ew-verdict')?.textContent.slice(0, 30));
check('wrong typing is marked', typed.classList.contains('is-wrong'));

pickMode('mixed');
check('back to mixed', /What does this mean\?/.test(stageText()));

// ── Report ─────────────────────────────────────────────────────────────────
let failed = 0;
results.forEach((r) => {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail ? '  [' + r.detail + ']' : ''}`);
});
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
