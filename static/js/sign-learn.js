/* Repeat road signs: short rounds of checked signs. Due signs come first; a correct answer on
   the due day moves a sign to its next review (1, 3, 7, 14, 30 days), a mistake starts it again.
   Questions alternate between naming a sign and finding it from its explanation. */
(function () {
  'use strict';
  const shell = document.getElementById('learnShell');
  const stage = document.getElementById('learnStage');
  if (!shell || !stage || !window.WEXSignProgress) return;

  const userId = shell.dataset.userId || '';
  const store = window.WEXSignProgress.create({ userId });
  const PROGRESS_KEY = userId ? `wexSignsProgress-user-${userId}` : 'wexSignsProgress';
  const ROUND_KEY = `${PROGRESS_KEY}-round-v2`;
  const params = new URLSearchParams(location.search);
  const REVIEW_ONLY = params.get('review') === 'due';
  const SCOPE_KEY = location.search || 'auto';
  const ROUND_SIZE = 12;
  const MAX_AGE = 7 * 86400000;
  const courseCodes = JSON.parse(document.getElementById('courseCodes').textContent);
  const lang = () => (document.documentElement.lang === 'ru' ? 'ru' : 'en');
  const plural = (count, one, few, many) => window.WEXSignProgress.ruPlural(count, one, few, many);

  const T = {
    en: {
      title: 'Repeat road signs', due: 'to repeat now', learning: 'learning', learned: 'learned',
      scopeDue: count => `Due now: ${count} ${count === 1 ? 'sign' : 'signs'}. Answer them today to move them on.`,
      scopePractice: 'Nothing is due today. This round is extra practice with signs you have already met.',
      scopeFresh: 'You have not started the lessons yet. This round uses the signs of lesson 01.',
      scopeLesson: (number, title) => `Lesson ${number} · ${title}`, scopeGroup: label => `${label}: signs with a checked explanation`,
      dueOnly: 'Only signs that are due now.',
      counter: (index, total) => `Question ${index} of ${total}`, score: (right, asked) => (asked ? `${right}/${asked} correct` : ''),
      askName: 'What does this sign mean?', askMeaning: 'Which sign has this meaning?', askFind: 'Find this sign', correct: 'Correct.', wrong: 'Not quite.',
      yourAnswer: 'Your answer', rightAnswer: 'Correct answer', next: 'Next sign', last: 'See the result',
      action: 'Your action', mistake: 'Common mistake', card: 'Full card and sources →',
      summary: 'Round finished', summaryLine: (right, total) => `${right} of ${total} right`, missed: 'Look at these again',
      roundSigns: 'Signs in this round', gotRight: 'Right', gotWrong: 'Missed', testsLink: 'Check yourself in the road sign tests →',
      practiseMissed: 'Repeat the missed ones', newRound: 'New round', lessons: 'Back to lessons', practiseAnyway: 'Practise anyway',
      nextDue: when => `Your next signs are due ${when}.`, noneDue: 'No signs are due now. Come back when the next ones are due, or start the next lesson.',
      empty: 'There are no signs with a checked explanation in this set yet.',
      hint: account => `${account ? 'Progress is saved to your account.' : 'Progress stays in this browser. Sign in to keep it in your account.'} A sign moves on only when you answer it right on its due day; a mistake starts it again.`,
      keys: 'Keyboard: 1–4 to answer, Enter to continue.', settings: 'Progress settings',
      resetCopy: 'This clears every sign level and lesson result for road signs.', reset: 'Reset my progress',
      resetConfirm: 'Reset all your road sign progress? This also clears your lesson results and the current round.',
      saving: 'Saving…', saved: 'Saved to your account', failed: 'Saved in this browser. Account sync is pending.', retry: 'Retry sync',
      failedLoad: 'Could not load the signs. Reload the page to try again.', sign: 'Road sign', option: index => `Option ${index}`,
    },
    ru: {
      title: 'Повторение знаков', due: 'повторить сейчас', learning: 'изучаются', learned: 'выучено',
      scopeDue: count => `Пора повторить: ${count} ${plural(count, 'знак', 'знака', 'знаков')}. Ответьте сегодня, и они перейдут дальше.`,
      scopePractice: 'Сегодня повторять нечего. Это дополнительная тренировка по знакам, которые вы уже видели.',
      scopeFresh: 'Вы ещё не начали уроки. В этом круге — знаки урока 01.',
      scopeLesson: (number, title) => `Урок ${number} · ${title}`, scopeGroup: label => `${label}: знаки с проверенным пояснением`,
      dueOnly: 'Только знаки, которым пора на повторение.',
      counter: (index, total) => `Вопрос ${index} из ${total}`, score: (right, asked) => (asked ? `${right}/${asked} верно` : ''),
      askName: 'Что означает этот знак?', askMeaning: 'У какого знака такое значение?', askFind: 'Найдите этот знак', correct: 'Верно.', wrong: 'Не совсем.',
      yourAnswer: 'Ваш ответ', rightAnswer: 'Верный ответ', next: 'Следующий знак', last: 'Посмотреть итог',
      action: 'Ваше действие', mistake: 'Частая ошибка', card: 'Карточка знака и источники →',
      summary: 'Круг пройден', summaryLine: (right, total) => `${right} из ${total} верно`, missed: 'Стоит повторить',
      roundSigns: 'Знаки этого круга', gotRight: 'Верно', gotWrong: 'Ошибка', testsLink: 'Проверьте себя в тестах по знакам →',
      practiseMissed: 'Повторить ошибки', newRound: 'Новый круг', lessons: 'К урокам', practiseAnyway: 'Всё равно потренироваться',
      nextDue: when => `Следующие знаки пора повторить ${when}.`, noneDue: 'Сейчас повторять нечего. Вернитесь, когда подойдёт срок, или начните следующий урок.',
      empty: 'В этом наборе пока нет знаков с проверенным пояснением.',
      hint: account => `${account ? 'Прогресс сохраняется в аккаунте.' : 'Прогресс хранится в этом браузере. Войдите, чтобы сохранять его в аккаунте.'} Знак переходит дальше, только если ответить верно в день повторения; ошибка начинает его заново.`,
      keys: 'С клавиатуры: 1–4 — ответ, Enter — дальше.', settings: 'Настройки прогресса',
      resetCopy: 'Это удалит уровни всех знаков и результаты уроков по знакам.', reset: 'Сбросить прогресс',
      resetConfirm: 'Сбросить весь прогресс по знакам? Результаты уроков и текущий круг тоже будут очищены.',
      saving: 'Сохранение…', saved: 'Сохранено в аккаунте', failed: 'Сохранено в браузере. Синхронизация ожидает подключения.', retry: 'Повторить синхронизацию',
      failedLoad: 'Не удалось загрузить знаки. Обновите страницу.', sign: 'Дорожный знак', option: index => `Вариант ${index}`,
    },
  };
  const t = () => T[lang()];

  const state = { signs: [], lessons: [], byCode: new Map(), lessonsOf: new Map(), scope: null, round: null };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function shuffle(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  }
  const name = sign => (lang() === 'ru' && sign.name_ru) || sign.name;
  const local = value => value?.[lang()] || value?.en || '';
  // "Find the sign" shows its checked meaning; a sign whose note has no meaning is asked by its name,
  // because its action alone ("check priority again at the next junction") reads like a riddle.
  const describe = sign => (local(sign.teaching.meaning)
    ? { ask: t().askMeaning, text: local(sign.teaching.meaning), kind: 'meaning' }
    : { ask: t().askFind, text: `«${name(sign)}»`, kind: 'name' });

  // ── What this round is about ───────────────────────────────────────────────
  function resolveScope() {
    const lesson = state.lessons.find(item => item.id === shell.dataset.lesson);
    const group = shell.dataset.group;
    const weakest = list => shuffle(list).sort((a, b) => rank(a) - rank(b) || store.box(a.code) - store.box(b.code));
    const rank = sign => ({ due: 0, new: 1, learning: 2, learned: 3 })[store.status(sign.code)];
    let pool; let kind; let label = '';
    if (lesson) {
      pool = lesson.codes.map(code => state.byCode.get(code)).filter(Boolean);
      kind = 'lesson'; label = t().scopeLesson(String(lesson.number).padStart(2, '0'), lang() === 'ru' ? lesson.title_ru : lesson.title);
    } else if (group) {
      pool = state.signs.filter(sign => sign.group === group);
      kind = 'group'; label = t().scopeGroup(pool[0]?.group_label || group);
    } else pool = state.signs;
    if (REVIEW_ONLY) return { kind: 'due', pool: weakest(pool.filter(sign => store.isDue(sign.code))), label: label || t().dueOnly };
    if (kind) return { kind, pool: weakest(pool), label };
    const due = pool.filter(sign => store.isDue(sign.code));
    if (due.length) return { kind: 'auto-due', pool: weakest(due), label: t().scopeDue(due.length) };
    const met = pool.filter(sign => store.status(sign.code) !== 'new');
    if (met.length) return { kind: 'auto-practice', pool: weakest(met), label: t().scopePractice };
    const first = state.lessons[0];
    return { kind: 'auto-fresh', pool: shuffle(first.codes.map(code => state.byCode.get(code)).filter(Boolean)), label: t().scopeFresh };
  }

  // ── Questions ─────────────────────────────────────────────────────────────
  // Wrong choices come from the same lesson or family, and never share a visible name or an
  // equivalent arrow with the answer (D11.2 and D11.4 both mean "left").
  function buildOptions(sign) {
    const takenEn = new Set([sign.name]); const takenRu = new Set([sign.name_ru]);
    const equivalents = new Set([sign.teaching.quiz_equivalence].filter(Boolean));
    const mates = new Set((state.lessonsOf.get(sign.code) || []).flatMap(lesson => lesson.codes));
    const candidates = [
      ...shuffle(state.signs.filter(other => mates.has(other.code) && other.group === sign.group)),
      ...shuffle(state.signs.filter(other => !mates.has(other.code) && other.group === sign.group)),
      ...shuffle(state.signs.filter(other => mates.has(other.code) && other.group !== sign.group)),
      ...shuffle(state.signs.filter(other => other.group !== sign.group)),
    ];
    const picks = [];
    for (const other of candidates) {
      if (picks.length >= 3) break;
      const equivalent = other.teaching.quiz_equivalence;
      if (other.code === sign.code || takenEn.has(other.name) || takenRu.has(other.name_ru) || (equivalent && equivalents.has(equivalent))) continue;
      takenEn.add(other.name); takenRu.add(other.name_ru); if (equivalent) equivalents.add(equivalent);
      picks.push(other.code);
    }
    return shuffle([sign.code, ...picks]);
  }

  function newRound(pool) {
    const deck = (pool || state.scope.pool).slice(0, ROUND_SIZE).map(sign => sign.code);
    const offset = Math.round(Math.random());
    state.round = { version: 2, scope: SCOPE_KEY, createdAt: Date.now(), deck, types: deck.map((_, index) => ((index + offset) % 2 ? 'image' : 'name')),
      position: 0, right: 0, results: [], missed: [], answered: false, chosen: null, options: [], finished: false };
    saveRound(); render();
  }
  function saveRound() { try { localStorage.setItem(ROUND_KEY, JSON.stringify(state.round)); } catch (_) { /* practice still works */ } }
  function restoreRound() {
    try {
      const saved = JSON.parse(localStorage.getItem(ROUND_KEY) || 'null');
      if (!saved || saved.version !== 2 || saved.scope !== SCOPE_KEY || !Number.isFinite(saved.createdAt)
        || Date.now() - saved.createdAt > MAX_AGE || saved.createdAt > Date.now() + 60000 || !Array.isArray(saved.deck) || !saved.deck.length
        || saved.deck.length > ROUND_SIZE || saved.deck.some(code => !state.byCode.has(code)) || !Array.isArray(saved.types)
        || saved.types.length !== saved.deck.length || saved.types.some(type => !['name', 'image'].includes(type))
        || !Number.isInteger(saved.position) || saved.position < 0 || saved.position > saved.deck.length
        || !Number.isInteger(saved.right) || saved.right < 0 || saved.right > saved.deck.length || !Array.isArray(saved.results)
        || !Array.isArray(saved.options) || saved.options.some(code => !state.byCode.has(code))) return false;
      if (saved.answered && (!state.byCode.has(saved.chosen) || !saved.options.includes(saved.chosen))) return false;
      saved.missed = Array.isArray(saved.missed) ? saved.missed.filter(code => saved.deck.includes(code)) : [];
      saved.finished = saved.position === saved.deck.length;
      state.round = saved;
      return true;
    } catch (_) { return false; }
  }

  function answer(chosen) {
    const round = state.round;
    if (round.answered || round.finished) return;
    const code = round.deck[round.position];
    const right = chosen === code;
    round.answered = true; round.chosen = chosen; round.results.push(right);
    if (right) round.right += 1; else if (!round.missed.includes(code)) round.missed.push(code);
    store.grade(code, right, 'quiz');
    saveRound(); render();
    document.getElementById('nextBtn')?.focus({ preventScroll: true });
  }
  function advance() {
    const round = state.round;
    round.position += 1; round.answered = false; round.chosen = null; round.options = [];
    round.finished = round.position >= round.deck.length;
    saveRound(); render();
    (stage.querySelector('.sr-question') || stage.querySelector('.summary-score'))?.focus({ preventScroll: true });
    // The next question starts at the top of the room, under the sticky site bar.
    const room = document.querySelector('.sr-room');
    if (room && room.getBoundingClientRect().top < 64) window.scrollTo({ top: room.getBoundingClientRect().top + window.scrollY - 72, behavior: 'auto' });
  }

  // Like the test room: the visual (the sign, or the meaning to match) on the left, the question and
  // the answers on the right, so the eye starts at the top and reads straight down to the answers.
  function renderQuestion() {
    const round = state.round;
    const sign = state.byCode.get(round.deck[round.position]);
    const type = round.types[round.position];
    if (!round.options.length) { round.options = buildOptions(sign); saveRound(); }
    const options = round.options.map(code => state.byCode.get(code));
    const card = el('div', 'sr-card sr-card--' + type);
    const prompt = el('div', 'sr-prompt');
    const answers = el('div', 'sr-answers');
    const ask = el('h2', 'sr-question'); ask.tabIndex = -1; ask.id = 'learnQuestion';
    if (type === 'name') {
      const art = el('div', 'learn-art sr-art'); const image = el('img'); image.src = sign.image; image.alt = round.answered ? `${sign.code}: ${name(sign)}` : t().sign; image.width = 240; image.height = 240; art.append(image);
      prompt.append(art);
      ask.textContent = t().askName;
      answers.append(ask);
    } else {
      const about = describe(sign);
      ask.textContent = about.ask;
      prompt.append(ask, el('p', 'learn-question sr-description sr-description--' + about.kind, about.text));
    }
    const list = el('div', type === 'name' ? 'learn-options sr-options' : 'learn-images sr-images');
    list.setAttribute('role', 'group'); list.setAttribute('aria-labelledby', 'learnQuestion');
    options.forEach((option, index) => {
      const button = el('button', type === 'name' ? 'learn-option sr-option' : 'image-option sr-image-option');
      button.type = 'button'; button.dataset.code = option.code; button.disabled = round.answered;
      const key = el('span', 'option-key', String(index + 1));
      if (type === 'name') button.append(key, el('span', 'sr-option-copy', name(option)));
      else { const image = el('img'); image.src = option.image; image.alt = t().option(index + 1); button.append(key, image); }
      if (round.answered) {
        if (option.code === sign.code) { button.classList.add('is-correct'); button.append(el('span', 'sr-verdict', t().rightAnswer)); }
        else if (option.code === round.chosen) { button.classList.add('is-wrong'); button.append(el('span', 'sr-verdict', t().yourAnswer)); }
      }
      button.addEventListener('click', () => answer(option.code));
      list.append(button);
    });
    answers.append(list);
    if (round.answered) {
      const right = round.chosen === sign.code;
      const why = el('div', 'learn-feedback sr-why ' + (right ? 'is-correct' : 'is-wrong')); why.setAttribute('role', 'status');
      why.append(el('strong', 'sr-why-verdict', right ? t().correct : t().wrong));
      const head = el('div', 'sr-why-head');
      const image = el('img'); image.src = sign.image; image.alt = ''; image.width = 48; image.height = 48;
      head.append(image, el('span', 'explain-code', sign.code), el('b', '', name(sign)));
      why.append(head);
      if (sign.teaching.meaning) why.append(el('p', '', local(sign.teaching.meaning)));
      [[t().action, sign.teaching.action], [t().mistake, sign.teaching.mistake]].forEach(([label, value]) => {
        const row = el('p', 'sr-why-row');
        row.append(el('b', '', `${label}: `), document.createTextNode(local(value)));
        why.append(row);
      });
      if (sign.name_da) why.append(el('p', 'sr-why-da', `På dansk: ${sign.name_da}`));
      const more = el('a', 'sr-why-link', t().card); more.href = `/signs/${sign.code}`; why.append(more);
      const next = el('button', 'btn-primary sx-btn', round.position + 1 >= round.deck.length ? t().last : t().next); next.type = 'button'; next.id = 'nextBtn';
      next.addEventListener('click', advance);
      answers.append(why, el('div', 'learn-actions sr-actions'));
      answers.lastChild.append(next);
    }
    card.append(prompt, answers);
    stage.append(card);
  }

  // The result reads like a test result: the score, every sign of the round marked right or missed,
  // then what comes next.
  function renderSummary() {
    const round = state.round;
    const box = el('div', 'sr-summary');
    const head = el('div', 'sr-summary-head');
    const score = el('div', 'summary-score', `${round.right}/${round.deck.length}`); score.tabIndex = -1;
    const words = el('div', 'sr-summary-words');
    words.append(el('h2', 'summary-line', t().summary), el('p', 'sr-summary-copy', t().summaryLine(round.right, round.deck.length)));
    const next = store.nextDue(courseCodes.concat(round.deck));
    if (next) words.append(el('p', 'sr-summary-copy', t().nextDue(window.WEXSignProgress.formatDue(next, lang()))));
    head.append(score, words);
    box.append(head, el('p', 'sr-summary-label', t().roundSigns));
    const grid = el('div', 'summary-grid');
    round.deck.forEach((code, index) => {
      const sign = state.byCode.get(code);
      if (!sign) return;
      const right = round.results[index] === true;
      const link = el('a', 'summary-item ' + (right ? 'is-correct' : 'is-wrong')); link.href = `/signs/${sign.code}`;
      const image = el('img'); image.src = sign.image; image.alt = '';
      const copy = el('span', 'summary-item-copy');
      copy.append(el('b', 'summary-item-verdict', right ? t().gotRight : t().gotWrong), el('span', '', `${sign.code} · ${name(sign)}`));
      link.append(image, copy);
      grid.append(link);
    });
    box.append(grid);
    const missed = round.missed.map(code => state.byCode.get(code)).filter(Boolean);
    const actions = el('div', 'learn-actions sr-actions');
    if (missed.length) {
      const again = el('button', 'btn-primary sx-btn', t().practiseMissed); again.type = 'button';
      again.addEventListener('click', () => newRound(missed));
      actions.append(again);
    }
    const fresh = el('button', missed.length ? 'btn-ghost sx-btn' : 'btn-primary sx-btn', t().newRound); fresh.type = 'button';
    fresh.addEventListener('click', () => { state.scope = resolveScope(); newRound(); });
    const lessons = el('a', 'btn-ghost sx-btn', t().lessons); lessons.href = '/signs/lessons';
    actions.append(fresh, lessons);
    box.append(actions);
    if (userId) { const tests = el('a', 'sr-why-link sr-tests-link', t().testsLink); tests.href = '/dashboard#signTests'; box.append(tests); }
    stage.append(box);
  }

  function renderEmpty() {
    const box = el('div', 'sr-summary');
    box.append(el('p', 'sr-summary-copy', REVIEW_ONLY ? t().noneDue : t().empty));
    const next = store.nextDue(courseCodes);
    if (REVIEW_ONLY && next) box.append(el('p', 'sl-note', t().nextDue(window.WEXSignProgress.formatDue(next, lang()))));
    const actions = el('div', 'learn-actions sr-actions');
    const lessons = el('a', 'btn-primary sx-btn', t().lessons); lessons.href = '/signs/lessons';
    actions.append(lessons);
    if (REVIEW_ONLY) { const anyway = el('a', 'btn-ghost sx-btn', t().practiseAnyway); anyway.href = '/signs/learn'; actions.append(anyway); }
    box.append(actions);
    stage.append(box);
  }

  function renderChrome() {
    document.getElementById('learnTitle').textContent = t().title;
    document.getElementById('learnScope').textContent = state.scope?.label || '';
    const all = state.signs.map(sign => sign.code);
    const counts = store.summary(all);
    document.getElementById('statDue').textContent = counts.due;
    document.getElementById('statLearning').textContent = counts.learning;
    document.getElementById('statLearned').textContent = store.summary(courseCodes).learned;
    document.getElementById('statDueLabel').textContent = t().due;
    document.getElementById('statLearningLabel').textContent = t().learning;
    document.getElementById('statLearnedLabel').textContent = t().learned;
    document.getElementById('learnHint').textContent = t().hint(Boolean(userId));
    document.getElementById('keysHint').textContent = t().keys;
    document.getElementById('practiceSettingsLabel').textContent = t().settings;
    document.getElementById('resetCopy').textContent = t().resetCopy;
    document.getElementById('learnReset').textContent = t().reset;
    const round = state.round;
    const counter = document.getElementById('sessionCounter');
    const pills = document.getElementById('sessionPills');
    if (!round || round.finished) { counter.textContent = ''; pills.replaceChildren(); document.getElementById('sessionScore').textContent = ''; }
    else {
      counter.textContent = t().counter(Math.min(round.position + 1, round.deck.length), round.deck.length);
      pills.replaceChildren(...round.deck.map((_, index) => {
        const pill = el('span');
        if (index < round.results.length) pill.className = round.results[index] ? 'is-right' : 'is-wrong';
        else if (index === round.position) pill.className = 'is-current';
        return pill;
      }));
      document.getElementById('sessionScore').textContent = t().score(round.right, round.results.length);
    }
    syncStatus();
  }
  function syncStatus() {
    const status = document.getElementById('learnSyncStatus');
    const retry = document.getElementById('learnSyncRetry');
    status.textContent = !userId ? '' : store.sync === 'failed' ? t().failed : store.sync === 'saving' ? t().saving : t().saved;
    retry.hidden = store.sync !== 'failed';
    retry.textContent = t().retry;
  }

  function render() {
    stage.replaceChildren();
    if (!state.round || !state.round.deck.length) renderEmpty();
    else if (state.round.finished) renderSummary();
    else renderQuestion();
    renderChrome();
  }

  shell.querySelectorAll('.lang-btn').forEach(button => button.addEventListener('click', () => {
    if (state.scope) state.scope.label = resolveScope().label;
    render();
  }));
  document.getElementById('learnSyncRetry').addEventListener('click', () => store.flush());
  store.onChange(syncStatus);
  document.getElementById('learnReset').addEventListener('click', () => {
    if (!window.confirm(t().resetConfirm)) return;
    store.reset();
    try { localStorage.removeItem(ROUND_KEY); } catch (_) { /* nothing stored */ }
    state.scope = resolveScope(); newRound();
  });
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey || window.WEXNavigation?.isOpen() || document.querySelector('.cookie-consent.show')) return;
    if (event.target instanceof Element && event.target.matches('input, textarea, select, button, a, summary')) return;
    if (event.key >= '1' && event.key <= '4' && state.round && !state.round.answered) {
      const option = stage.querySelectorAll('.learn-option, .image-option')[Number(event.key) - 1];
      if (option) { event.preventDefault(); option.click(); }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      const button = document.getElementById('nextBtn');
      if (button) { event.preventDefault(); button.click(); }
    }
  });

  fetch('/api/signs')
    .then(response => response.json())
    .then(async data => {
      state.signs = (data.signs || []).filter(sign => sign.teaching && sign.teaching.action);
      state.lessons = data.lessons || [];
      state.byCode = new Map(state.signs.map(sign => [sign.code, sign]));
      state.lessons.forEach(lesson => lesson.codes.forEach(code => {
        if (!state.lessonsOf.has(code)) state.lessonsOf.set(code, []);
        state.lessonsOf.get(code).push(lesson);
      }));
      await store.load();
      state.scope = resolveScope();
      if (restoreRound()) render(); else if (state.scope.pool.length) newRound(); else { state.round = null; render(); }
    })
    .catch(() => { stage.replaceChildren(el('p', 'sl-note', t().failedLoad)); });
})();
