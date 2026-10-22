const assert = require('node:assert/strict');
const store = require('../../static/js/word-round-store.js');
const now = Date.now();
const terms = Array.from({ length: 14 }, (_, i) => ({ id: `word${i}`, en: `English ${i}`,
  ru: `Русский ${i}`, dk: `Dansk ${i}`, scope: i < 10 ? 'exam' : i < 12 ? 'car' : 'other' }));
const context = { owner: 'full-user-1:standalone', terms, revision: store.revision(terms), guided: false };
const base = { version: 1, owner: context.owner, revision: context.revision, startedAt: now,
  mode: 'quiz', scope: 'exam', queue: terms.slice(0, 10).map(x => x.id), answers: [],
  revealed: false, answered: null, options: terms.slice(0, 4).map(x => x.id) };
let checks = 0;
function valid(value, expected = true, ctx = context, time = now) {
  assert.equal(Boolean(store.validate(value, ctx, time)), expected);
  checks++;
}
valid(base);
valid({ ...base, answered: 'word1' });
valid({ ...base, answers: [true, false], answered: 'word2' });
valid({ ...base, answers: Array(10).fill(true), options: [] });
valid({ ...base, mode: 'cards', options: [], revealed: true });
valid({ ...base, mode: 'mixed', options: [], revealed: true });
valid({ ...base, mode: 'mixed', answers: [false, true] });
valid({ ...base, mode: 'reverse' });
valid({ ...base, mode: 'listening' });
valid({ ...base, scope: 'car' });
valid({ ...base, scope: 'all' });
valid({ ...base, startedAt: now - store.MAX_AGE });
for (const patch of [
  { version: 2 }, { owner: 'full-user-2:standalone' }, { owner: 'demo-user-1:standalone' },
  { owner: 'full-user-1:study-another-id' }, { revision: 'old' }, { startedAt: now + 60001 },
  { startedAt: now - store.MAX_AGE - 1 }, { startedAt: 'today' }, { scope: 'bad' }, { mode: 'bad' },
  { queue: [] }, { queue: ['word0'] }, { queue: Array(10).fill('word0') },
  { queue: [...base.queue.slice(0, 9), 'unknown'] }, { queue: [...base.queue.slice(0, 9), 'word13'] },
  { answers: [1] }, { answers: Array(11).fill(true) }, { answers: null },
  { revealed: true }, { revealed: 'yes' }, { answered: 'word8' }, { answered: false },
  { options: ['word1', 'word2'] }, { options: ['word0', 'word0'] }, { options: [] },
  { options: ['word0', 'word1'] },
  { options: ['word0', 'word1', 'word2', 'word3', 'word4'] },
  { mode: 'cards', answered: 'word0', options: [] },
  { answers: Array(10).fill(true), options: [], revealed: true },
]) valid({ ...base, ...patch }, false);
valid(base, true, { ...context, guided: true });
valid({ ...base, scope: 'all' }, false, { ...context, guided: true });
valid({ ...base, mode: 'cards', options: [] }, false, { ...context, guided: true });
const duplicates = terms.map(x => ({ ...x }));
duplicates[1].ru = duplicates[0].ru;
valid(base, false, { ...context, terms: duplicates });
duplicates[1].ru = terms[1].ru;
duplicates[1].en = duplicates[0].en;
valid({ ...base, mode: 'reverse' }, false, { ...context, terms: duplicates });
assert.notEqual(store.revision(duplicates), context.revision);
const memory = new Map();
const storage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
assert.equal(store.write(storage, 'round', base), true);
assert.deepEqual(store.read(storage, 'round', context, now), base);
memory.set('round', '{broken');
assert.equal(store.read(storage, 'round', context, now), null);
memory.set('round', 'null');
assert.equal(store.read(storage, 'round', context, now), null);
const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
assert.equal(store.read(blocked, 'round', context, now), null);
assert.equal(store.write(blocked, 'round', base), false);
assert.equal(store.read(null, 'round', context, now), null);
assert.equal(store.write(null, 'round', base), false);
assert.deepEqual([0, 1, 2, 3, 4, 5].map(i => store.kind('mixed', i)), ['recall', 'recall', 'quiz', 'recall', 'recall', 'quiz']);
console.log(`OK ${checks} round-validation cases, dictionary revision, storage failures and mixed scheduling`);
