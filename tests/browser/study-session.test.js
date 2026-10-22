const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
let clock = Date.now();
const id = 'session-id-123456789';
const memory = new Map([['wexStudy:v1:1', JSON.stringify({ version: 1, account: '1', id, lesson: 'priority',
  revision: 'current', startedAt: clock, steps: {} })]]);
const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
const node = { id: 'signLesson', dataset: { studyAccount: '1', lessonId: 'priority' } };
const sandbox = { window: {}, localStorage: storage, URLSearchParams, location: { search: '?study=' + id },
  Date: { now: () => clock }, document: { querySelector: selector => selector === '[data-study-account]' ? node : null,
    createElement: () => ({ dataset: {} }) }, crypto: { randomUUID: () => id } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../static/js/study-session.js'), 'utf8'), sandbox);
const container = { links: [], append(link) { this.links.push(link); } };
for (const [step, first, second, total] of [['signs', 2, 3, 3], ['words', 4, 10, 10]]) {
  sandbox.window.WEXStudy.returnLink(container, step, first, total, 'quiz');
  const before = JSON.parse(memory.get('wexStudy:v1:1')).steps[step];
  clock += 1000;
  sandbox.window.WEXStudy.returnLink(container, step, second, total, 'quiz');
  assert.deepEqual(JSON.parse(memory.get('wexStudy:v1:1')).steps[step], before);
}
assert.equal(container.links.length, 4);
assert.equal(JSON.parse(memory.get('wexStudy:v1:1')).steps.words.score, 4);
assert.equal(JSON.parse(memory.get('wexStudy:v1:1')).steps.signs.score, 2);
console.log('OK first word/sign scores and completion times cannot be overwritten by re-render or retry');
