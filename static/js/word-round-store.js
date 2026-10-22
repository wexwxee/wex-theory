/* Only dictionary IDs and answer state are stored. Never trust cached markup,
   scores, ownership or an out-of-date set of translations. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WEXWordRoundStore = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const MAX_AGE = 7 * 86400000;
  const MODES = ['mixed', 'cards', 'quiz', 'reverse', 'listening'];
  const SCOPES = ['exam', 'car', 'all'];
  function kind(mode, index) {
    if (mode === 'cards') return 'recall';
    if (mode !== 'mixed') return mode;
    return index % 3 === 2 ? 'quiz' : 'recall';
  }
  function inScope(item, scope) {
    return scope === 'all' || (scope === 'car' ? item.scope !== 'other' : item.scope === 'exam');
  }
  function revision(terms) {
    const content = JSON.stringify(terms.map(item => [item.id, item.scope, item.en, item.ru, item.dk]));
    let hash = 2166136261;
    for (let i = 0; i < content.length; i++) hash = Math.imul(hash ^ content.charCodeAt(i), 16777619);
    return (hash >>> 0).toString(16);
  }
  function validate(value, context, now = Date.now()) {
    if (!value || value.version !== 1 || value.owner !== context.owner || value.revision !== context.revision
      || !Number.isFinite(value.startedAt) || value.startedAt > now + 60000 || now - value.startedAt > MAX_AGE
      || !MODES.includes(value.mode) || !SCOPES.includes(value.scope)
      || (context.guided && (value.mode !== 'quiz' || value.scope !== 'exam'))) return null;
    const allowed = new Map(context.terms.filter(item => inScope(item, value.scope)).map(item => [item.id, item]));
    const validIds = ids => Array.isArray(ids) && ids.every(id => typeof id === 'string' && allowed.has(id))
      && new Set(ids).size === ids.length;
    if (!validIds(value.queue) || !value.queue.length || value.queue.length !== Math.min(10, allowed.size)
      || !Array.isArray(value.answers) || value.answers.length > value.queue.length
      || !value.answers.every(answer => typeof answer === 'boolean') || typeof value.revealed !== 'boolean'
      || !(value.answered === null || typeof value.answered === 'string') || !validIds(value.options)) return null;
    const index = value.answers.length;
    if (index === value.queue.length || kind(value.mode, index) === 'recall') {
      if (value.options.length || value.answered !== null || (index === value.queue.length && value.revealed)) return null;
    } else {
      const item = allowed.get(value.queue[index]);
      const label = option => value.mode === 'reverse' ? option.en : option.ru;
      const choices = value.options.map(id => allowed.get(id));
      const choiceCount = Math.min(4, new Set([...allowed.values()].map(label)).size);
      if (value.revealed || choiceCount < 2 || choices.length !== choiceCount || !value.options.includes(item.id)
        || new Set(choices.map(label)).size !== choices.length
        || (value.answered !== null && !value.options.includes(value.answered))) return null;
    }
    return {
      version: 1, owner: value.owner, revision: value.revision, startedAt: value.startedAt,
      mode: value.mode, scope: value.scope, queue: value.queue.slice(), answers: value.answers.slice(),
      revealed: value.revealed, answered: value.answered, options: value.options.slice(),
    };
  }
  function read(storage, key, context, now) {
    try { return validate(JSON.parse(storage.getItem(key)), context, now); }
    catch (_) { return null; }
  }
  function write(storage, key, value) {
    try { storage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { return false; }
  }
  return { MAX_AGE, MODES, SCOPES, kind, inScope, revision, validate, read, write };
});
