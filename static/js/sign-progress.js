/* One record of road-sign learning for every sign page: review levels per sign, finished
   lessons and account sync. Guests keep it in this browser; signed-in learners also keep it
   in their account. Scheduling rules live in sign-review.js. */
(function (root) {
  'use strict';
  const LEARNED_AT = 3;
  const DAY = 86400000;
  const RUN_AGE = 7 * DAY;

  function storage() { try { return root.localStorage; } catch (_) { return null; } }
  function readJson(key, fallback) {
    try { const value = JSON.parse(storage().getItem(key)); return value ?? fallback; } catch (_) { return fallback; }
  }
  function writeJson(key, value) {
    try { storage().setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
  }
  const isObject = value => value && typeof value === 'object' && !Array.isArray(value);

  function validResult(value) {
    return isObject(value) && typeof value.revision === 'string' && Number.isInteger(value.total) && value.total > 0
      && Number.isInteger(value.first) && Number.isInteger(value.reviewed)
      && value.first >= 0 && value.first <= value.reviewed && value.reviewed <= value.total
      && (value.recall_first == null || (Number.isInteger(value.recall_first) && Number.isInteger(value.recall_total)
        && value.recall_first >= 0 && value.recall_first <= value.recall_total));
  }

  function create(options = {}) {
    const review = root.WEXSignReview;
    const userId = String(options.userId || '');
    const account = userId || 'guest';
    const progressKey = userId ? `wexSignsProgress-user-${userId}` : 'wexSignsProgress';
    const reviewKey = `${progressKey}-reviewed-at`;
    const queueKey = `${progressKey}-queue`;
    const lessonKey = userId ? `wexSignLessonResults-user-${userId}` : 'wexSignLessonResults';
    const lessonQueueKey = `${lessonKey}-queue`;
    const listeners = new Set();

    function readProgress() {
      const stored = readJson(progressKey, null);
      if (isObject(stored)) return stored;
      if (userId) return {};
      // The first trainer kept two lists; keep what a returning guest had.
      const known = readJson('wexSignsKnown', []);
      const hard = readJson('wexSignsHard', []);
      const migrated = {};
      (Array.isArray(known) ? known : []).forEach(code => { migrated[code] = { box: LEARNED_AT }; });
      (Array.isArray(hard) ? hard : []).forEach(code => { migrated[code] = { box: 0 }; });
      return migrated;
    }
    function readResults() {
      const stored = readJson(lessonKey, {});
      if (!isObject(stored)) return {};
      return Object.fromEntries(Object.entries(stored).filter(([, value]) => validResult(value)));
    }

    const state = {
      progress: readProgress(),
      reviewedAt: (value => isObject(value) ? value : {})(readJson(reviewKey, {})),
      results: readResults(),
      queue: (value => Array.isArray(value) ? value : [])(readJson(queueKey, [])),
      lessonQueue: (value => Array.isArray(value) ? value : [])(readJson(lessonQueueKey, [])),
      sync: userId ? 'saved' : 'local',
      syncing: false,
    };

    function emit() { listeners.forEach(listener => { try { listener(api); } catch (_) { /* a view failing must not stop sync */ } }); }
    function saveLocal() {
      const saved = writeJson(progressKey, state.progress) && writeJson(reviewKey, state.reviewedAt);
      writeJson(queueKey, state.queue);
      return saved;
    }
    function saveResults() { writeJson(lessonKey, state.results); writeJson(lessonQueueKey, state.lessonQueue); }

    async function flush() {
      if (!userId || state.syncing) return;
      state.syncing = true;
      state.sync = state.queue.length || state.lessonQueue.length ? 'saving' : 'saved';
      emit();
      try {
        while (state.queue.length) {
          const response = await fetch('/api/signs/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.queue[0]) });
          if (!response.ok) throw new Error('sync failed');
          state.queue.shift();
          writeJson(queueKey, state.queue);
        }
        while (state.lessonQueue.length) {
          const response = await fetch('/api/signs/lessons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.lessonQueue[0]) });
          if (response.status === 400) { state.lessonQueue.shift(); saveResults(); continue; } // an outdated result is not retried forever
          if (!response.ok) throw new Error('sync failed');
          state.lessonQueue.shift();
          saveResults();
        }
        state.sync = 'saved';
      } catch (_) {
        state.sync = 'failed';
      } finally {
        state.syncing = false;
        emit();
      }
    }

    async function load() {
      if (!userId) { emit(); return api; }
      try {
        const [signsResponse, lessonsResponse] = await Promise.all([fetch('/api/signs/progress'), fetch('/api/signs/lessons')]);
        if (!signsResponse.ok || !lessonsResponse.ok) throw new Error('load failed');
        const signs = await signsResponse.json();
        const lessons = await lessonsResponse.json();
        state.progress = isObject(signs.progress) ? signs.progress : {};
        state.reviewedAt = isObject(signs.reviewed_at) ? signs.reviewed_at : {};
        state.queue.forEach(operation => {
          if (operation.reset) { state.progress = {}; state.reviewedAt = {}; }
          Object.assign(state.progress, operation.progress || {});
          Object.assign(state.reviewedAt, operation.reviewed_at || {});
        });
        const server = isObject(lessons.results) ? lessons.results : {};
        const merged = {};
        Object.entries(server).forEach(([id, value]) => { if (validResult(value)) merged[id] = value; });
        Object.entries(state.results).forEach(([id, local]) => {
          const remote = merged[id];
          if (!remote || remote.revision !== local.revision) {
            if (!remote) { merged[id] = local; queueResult(id, local); }
            return;
          }
          if (local.reviewed > remote.reviewed || (local.recall_first != null && remote.recall_first == null)) {
            merged[id] = { ...remote, reviewed: Math.max(remote.reviewed, local.reviewed),
              recall_first: remote.recall_first ?? local.recall_first, recall_total: remote.recall_total ?? local.recall_total };
            queueResult(id, merged[id]);
          }
        });
        state.results = merged;
        saveLocal();
        saveResults();
        await flush();
      } catch (_) {
        state.sync = 'failed';
        emit();
      }
      return api;
    }

    function enqueue(change, reset = false) {
      if (!userId) return;
      const reviewed_at = Object.fromEntries(Object.keys(change).map(code => [code, state.reviewedAt[code]]));
      state.queue.push({ progress: change, reset, reviewed_at });
      writeJson(queueKey, state.queue);
      flush();
    }
    function queueResult(id, result) {
      if (!userId) return;
      state.lessonQueue = state.lessonQueue.filter(item => item.lesson !== id);
      state.lessonQueue.push({ lesson: id, revision: result.revision, first: result.first, total: result.total,
        reviewed: result.reviewed, recall_first: result.recall_first ?? null, recall_total: result.recall_total ?? null });
    }

    function entry(code) { return state.progress[code]; }
    function box(code) { return entry(code)?.box || 0; }
    function isDue(code, now = Date.now()) { return review.isDue(entry(code), state.reviewedAt[code], now); }
    function dueAt(code) { return entry(code) ? review.dueAt(entry(code), state.reviewedAt[code]) : null; }
    function status(code, now = Date.now()) {
      if (!entry(code)) return 'new';
      if (isDue(code, now)) return 'due';
      return box(code) >= LEARNED_AT ? 'learned' : 'learning';
    }
    function summary(codes, now = Date.now()) {
      const counts = { total: codes.length, new: 0, due: 0, learning: 0, learned: 0, met: 0 };
      codes.forEach(code => { const value = status(code, now); counts[value] += 1; if (value !== 'new') counts.met += 1; });
      return counts;
    }
    function nextDue(codes, now = Date.now()) {
      const times = codes.map(dueAt).filter(time => time !== null && time > now);
      return times.length ? Math.min(...times) : null;
    }
    function grade(code, right, mode) {
      const result = review.grade(entry(code), state.reviewedAt[code], right, mode);
      if (!result.changed) return false;
      state.progress[code] = result.entry;
      state.reviewedAt[code] = result.reviewedAt;
      saveLocal();
      enqueue({ [code]: result.entry });
      emit();
      return true;
    }
    function reset() {
      state.progress = {};
      state.reviewedAt = {};
      state.results = {};
      state.lessonQueue = [];
      try { storage().removeItem('wexSignsKnown'); storage().removeItem('wexSignsHard'); } catch (_) { /* nothing to clean */ }
      try { Object.keys(storage()).filter(key => key.startsWith(`wexSignLesson:${account}:`) || key.startsWith(`wexSignLessonRun:${account}:`)).forEach(key => storage().removeItem(key)); } catch (_) { /* storage blocked */ }
      saveLocal();
      saveResults();
      enqueue({}, true);
      emit();
    }

    function lessonResult(id, revision) {
      const value = state.results[id];
      return value && (!revision || value.revision === revision) ? value : null;
    }
    function saveLessonResult(id, value) {
      if (!validResult(value)) return null;
      const previous = state.results[id];
      let next = { ...value, completed_at: value.completed_at || new Date().toISOString() };
      if (previous && previous.revision === value.revision) {
        next = { ...previous, reviewed: Math.max(previous.reviewed, value.reviewed),
          recall_first: previous.recall_first ?? value.recall_first ?? null,
          recall_total: previous.recall_total ?? value.recall_total ?? null };
        if (JSON.stringify(next) === JSON.stringify(previous)) return previous;
      }
      state.results[id] = next;
      queueResult(id, next);
      saveResults();
      flush();
      emit();
      return next;
    }

    // A lesson started on another day is a run in this browser, not progress.
    function runKey(lessonId, suffix = '') { return `wexSignLessonRun:${account}:${lessonId}${suffix}`; }
    function readRun(lessonId, revision, suffix = '') {
      const value = readJson(runKey(lessonId, suffix), null);
      if (!isObject(value) || value.version !== 1 || value.revision !== revision || !Number.isFinite(value.createdAt)
        || Date.now() - value.createdAt > RUN_AGE || value.createdAt > Date.now() + 60000) return null;
      return value;
    }
    function writeRun(lessonId, value, suffix = '') { return writeJson(runKey(lessonId, suffix), value); }

    // Another tab changed the record: read it again without writing anything back.
    function refresh() {
      state.progress = readProgress();
      state.reviewedAt = (value => isObject(value) ? value : {})(readJson(reviewKey, {}));
      state.results = readResults();
    }

    if (userId) root.addEventListener?.('online', flush);
    const api = {
      account, userId, LEARNED_AT, load, flush, refresh, grade, reset, status, summary, box, isDue, dueAt, nextDue,
      lessonResult, saveLessonResult, readRun, writeRun,
      get progress() { return state.progress; },
      get reviewedAt() { return state.reviewedAt; },
      get results() { return state.results; },
      get sync() { return state.sync; },
      onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    };
    return api;
  }

  /* The one button on the road signs page: repeat what is due, finish a lesson, fix its
     mistakes, or start the next one. */
  function nextStep(store, lessons, inProgress = () => false) {
    const codes = [...new Set(lessons.flatMap(lesson => lesson.codes))];
    const due = codes.filter(code => store.status(code) === 'due').length;
    if (due) return { kind: 'review', due };
    const mistakes = lessons.find(lesson => { const result = store.lessonResult(lesson.id, lesson.revision); return result && result.reviewed < result.total; });
    if (mistakes) return { kind: 'mistakes', lesson: mistakes };
    const running = lessons.find(lesson => !store.lessonResult(lesson.id, lesson.revision) && inProgress(lesson));
    if (running) return { kind: 'continue', lesson: running };
    const next = lessons.find(lesson => !store.lessonResult(lesson.id, lesson.revision));
    if (next) return { kind: lessons.some(lesson => store.lessonResult(lesson.id, lesson.revision)) ? 'start' : 'first', lesson: next };
    return { kind: 'done' };
  }

  function ruPlural(count, one, few, many) {
    const tens = count % 100, units = count % 10;
    if (tens >= 11 && tens <= 14) return many;
    if (units === 1) return one;
    return units >= 2 && units <= 4 ? few : many;
  }

  function formatDue(time, lang, now = Date.now()) {
    if (time === null) return '';
    const days = Math.max(1, Math.round((new Date(time).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / DAY));
    if (lang === 'ru') return days === 1 ? 'завтра' : `через ${days} ${ruPlural(days, 'день', 'дня', 'дней')}`;
    return days === 1 ? 'tomorrow' : `in ${days} days`;
  }

  root.WEXSignProgress = { create, nextStep, formatDue, ruPlural, LEARNED_AT };
})(typeof window === 'undefined' ? globalThis : window);
