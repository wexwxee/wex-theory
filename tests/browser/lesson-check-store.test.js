const assert = require('node:assert/strict');
const store = require('../../static/js/lesson-check-store.js');
const now = Date.now();
const questions = [0, 1, 2].map(i => ({ id: 'q' + i, optionCount: 3, correct: i }));
const context = { owner: 'user-1:priority:standalone', revision: 'current', questions };
const fresh = () => store.fresh(context, now, () => .2);
const state = fresh();
assert.notDeepEqual(state.orders, store.fresh(context, now, () => .99).orders);
assert.equal(store.advance(state), false);
for (const question of questions) {
  assert.deepEqual([...state.orders[question.id]].sort(), [0, 1, 2]);
  assert(store.answer(state, context, question.id === 'q0' ? 1 : question.correct));
  assert.equal(store.answer(state, context, question.correct), false);
  assert(store.advance(state));
}
assert.equal(store.score(state.firstAnswers, questions), 2);
assert.equal(store.score(state.answers, questions), 2);
assert(store.validate(state, context, now));
assert(store.retry(state, context));
assert.deepEqual(state.deck, ['q0']);
assert(store.answer(state, context, 0));
assert(store.advance(state));
assert.equal(store.score(state.answers, questions), 3);
assert.equal(store.score(state.firstAnswers, questions), 2);
assert.equal(state.createdAt, now);
assert.deepEqual(store.validate(state, context, now), state);
assert.equal(store.retry(state, context), false);
const clone = value => JSON.parse(JSON.stringify(value));
let checks = 0;
for (const patch of [
  { revision: 'other' }, { owner: 'user-2:priority:standalone' }, { createdAt: now + 60001 },
  { createdAt: now - store.AGE - 1 }, { version: 3 }, { index: -1 }, { index: 3 }, { deck: [] },
  { deck: ['q0', 'q0'] }, { deck: ['unknown'] }, { answers: { q0: 3 } }, { answers: { q0: -1 } },
  { answers: { q0: 1.5 } }, { answers: { q0: '1' } }, { answers: [] }, { answers: { q1: 1 } },
  { orders: { q0: [0, 0, 1], q1: [0, 1, 2], q2: [0, 1, 2] } },
  { orders: {} }, { firstAnswers: {} }, { firstAnswers: [] }, { finished: true },
  { deck: ['q0'] }, { answers: { unknown: 0 } }, { answers: { q2: 2 } },
]) { assert.equal(store.validate({ ...fresh(), ...patch }, context, now), null); checks++; }
assert.equal(store.validate({ ...state, firstAnswers: null }, context, now), null);
const identityOrders = Object.fromEntries(questions.map(q => [q.id, [0, 1, 2]]));
const legacy = { version: 1, revision: context.revision, createdAt: now, deck: ['q0', 'q1', 'q2'], index: 2,
  answers: { q0: 0, q1: 1, q2: 2 }, finished: true, score: 999, total: 999 };
const migrated = store.validate(legacy, context, now);
assert(migrated.legacy);
assert.equal(migrated.firstAnswers, null); // A prior corrected result must not be invented as a first result.
assert.equal(store.score(migrated.answers, questions), 3);
assert.deepEqual(migrated.orders, identityOrders);
assert.equal(store.validate(legacy, { ...context, revision: 'revised' }, now), null);
const memory = new Map();
const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
assert(store.write(storage, 'own', state));
assert.deepEqual(store.read(storage, 'own', context, now), state);
memory.set('own', '{bad'); assert.equal(store.read(storage, 'own', context, now), null);
assert.equal(store.read(null, 'own', context, now), null);
assert.equal(store.write(null, 'own', state), false);
assert(store.validate(fresh(), context, now + store.AGE));
assert.equal(store.validate(fresh(), context, now + store.AGE + 1), null);
console.log(`OK first-score preservation, retry, stable options, legacy migration, unavailable storage and ${checks} invalid cache cases`);
