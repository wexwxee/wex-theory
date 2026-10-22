/* A completed first check and a later error review are different evidence.
   Scores are always derived from answers; cached totals are never trusted. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WEXLessonCheck = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const AGE = 7 * 86400000;
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const count = question => question.optionCount || question.options.length;
  function shuffle(values, random) {
    const copy = values.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  function fresh(context, now = Date.now(), random = Math.random) {
    return { version: 2, revision: context.revision, owner: context.owner, createdAt: now,
      deck: context.questions.map(q => q.id), index: 0, answers: {}, firstAnswers: null,
      orders: Object.fromEntries(context.questions.map(q => [q.id, shuffle(Array.from({ length: count(q) }, (_, i) => i), random)])),
      finished: false, legacy: false };
  }
  function score(answers, questions) { return questions.filter(q => answers?.[q.id] === q.correct).length; }
  function validate(raw, context, now = Date.now()) {
    if (!object(raw) || ![1, 2].includes(raw.version) || raw.revision !== context.revision
      || !Number.isFinite(raw.createdAt) || raw.createdAt > now + 60000 || now - raw.createdAt > AGE) return null;
    const lookup = new Map(context.questions.map(q => [q.id, q]));
    const ids = context.questions.map(q => q.id);
    const own = (value, id) => Object.hasOwn(value, id);
    const answersValid = answers => object(answers) && Object.entries(answers).every(([id, answer]) => lookup.has(id)
      && Number.isInteger(answer) && answer >= 0 && answer < count(lookup.get(id)));
    const full = answers => answersValid(answers) && ids.every(id => own(answers, id));
    if (!Array.isArray(raw.deck) || !raw.deck.length || raw.deck.length > ids.length
      || new Set(raw.deck).size !== raw.deck.length || raw.deck.some(id => !lookup.has(id))
      || !Number.isInteger(raw.index) || raw.index < 0 || raw.index >= raw.deck.length
      || !answersValid(raw.answers) || typeof raw.finished !== 'boolean') return null;
    const legacy = raw.version === 1 || raw.legacy === true;
    if (raw.version === 2 && (raw.owner !== context.owner || typeof raw.legacy !== 'boolean'
      || !(raw.firstAnswers === null || full(raw.firstAnswers)) || !object(raw.orders))) return null;
    const firstAnswers = raw.version === 1 ? null : raw.firstAnswers;
    if (!firstAnswers && !legacy && (raw.deck.length !== ids.length || raw.deck.some((id, i) => id !== ids[i]))) return null;
    if ((firstAnswers || raw.deck.length < ids.length) && ids.some(id => !raw.deck.includes(id) && !own(raw.answers, id))) return null;
    if (raw.deck.slice(0, raw.index).some(id => !own(raw.answers, id))) return null;
    if (raw.deck.slice(raw.index + 1).some(id => own(raw.answers, id))) return null;
    if (raw.finished && (raw.index !== raw.deck.length - 1 || !full(raw.answers))) return null;
    if (raw.version === 2 && raw.finished && !legacy && !firstAnswers) return null;
    const orders = {};
    for (const question of context.questions) {
      const order = raw.version === 1 ? Array.from({ length: count(question) }, (_, i) => i) : raw.orders[question.id];
      if (!Array.isArray(order) || order.length !== count(question) || new Set(order).size !== order.length
        || order.some(i => !Number.isInteger(i) || i < 0 || i >= count(question))) return null;
      orders[question.id] = order.slice();
    }
    return { version: 2, revision: context.revision, owner: context.owner, createdAt: raw.createdAt,
      deck: raw.deck.slice(), index: raw.index, answers: { ...raw.answers }, firstAnswers: firstAnswers ? { ...firstAnswers } : null,
      orders, finished: raw.finished, legacy };
  }
  function read(storage, key, context, now) {
    try { return validate(JSON.parse(storage.getItem(key)), context, now); } catch (_) { return null; }
  }
  function write(storage, key, state) {
    try { storage.setItem(key, JSON.stringify(state)); return true; } catch (_) { return false; }
  }
  function answer(state, context, choice) {
    const id = state.deck[state.index];
    const question = context.questions.find(q => q.id === id);
    if (state.finished || Object.hasOwn(state.answers, id) || !Number.isInteger(choice) || choice < 0 || choice >= count(question)) return false;
    state.answers[id] = choice;
    return true;
  }
  function advance(state) {
    if (state.finished || !Object.hasOwn(state.answers, state.deck[state.index])) return false;
    if (state.index + 1 < state.deck.length) state.index++;
    else {
      if (!state.firstAnswers && !state.legacy) state.firstAnswers = { ...state.answers };
      state.finished = true;
    }
    return true;
  }
  function retry(state, context) {
    if (!state.finished) return false;
    const missed = context.questions.filter(q => state.answers[q.id] !== q.correct).map(q => q.id);
    if (!missed.length) return false;
    state.deck = missed;
    missed.forEach(id => delete state.answers[id]);
    state.index = 0;
    state.finished = false;
    return true;
  }
  return { AGE, fresh, score, validate, read, write, answer, advance, retry };
});
