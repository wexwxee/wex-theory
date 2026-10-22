/* Road signs page: one next step, the state of every lesson and the learner's counts. */
(function () {
  'use strict';
  const root = document.getElementById('lessonOverview');
  if (!root || !window.WEXSignProgress) return;
  const checks = JSON.parse(document.getElementById('lessonChecks').textContent);
  const lessons = JSON.parse(document.getElementById('lessonData').textContent)
    .map(lesson => ({ ...lesson, revision: checks[lesson.id].revision }));
  const courseCodes = [...new Set(lessons.flatMap(lesson => lesson.codes))];
  const userId = root.dataset.userId || '';
  const account = userId || 'guest';
  const store = window.WEXSignProgress.create({ userId });
  const checkStore = window.WEXLessonCheck;
  const lang = () => document.documentElement.lang === 'ru' ? 'ru' : 'en';
  const two = number => String(number).padStart(2, '0');
  const plural = (count, one, few, many) => window.WEXSignProgress.ruPlural(count, one, few, many);
  const T = {
    en: {
      states: { new: 'New', progress: 'In progress', review: 'Fix mistakes', done: 'Done' },
      situations: 'Situations', afterReview: 'after review', signsMet: 'signs started',
      lessonsDone: 'lessons done', due: count => `${count} due`,
      review: count => [`Repeat ${count} ${count === 1 ? 'sign' : 'signs'}`, 'They are due today. One short round keeps them in memory.', `Repeat ${count} ${count === 1 ? 'sign' : 'signs'} →`],
      mistakes: lesson => [lesson.title, 'Your first check had mistakes. Read why, then try those situations again.', 'Review my mistakes →'],
      continue: lesson => [lesson.title, lesson.focus, `Continue lesson ${two(lesson.number)} →`],
      first: lesson => [lesson.title, lesson.focus, `Start lesson ${two(lesson.number)} →`],
      start: lesson => [lesson.title, lesson.focus, `Start lesson ${two(lesson.number)} →`],
      done: () => ['Every lesson is done', 'Now check yourself in the exam format: road sign tests 1–4. Keep repeating signs when they are due.', 'Go to the road sign tests →'],
      practise: 'Practise signs', repeat: 'Repeat signs', placeholder: 'Topic, sign or code, e.g. parking, C55', showing: 'Lessons shown',
    },
    ru: {
      states: { new: 'Новый', progress: 'Начат', review: 'Есть ошибки', done: 'Пройден' },
      situations: 'Ситуации', afterReview: 'после разбора', signsMet: 'знаков начато',
      lessonsDone: 'уроков пройдено', due: count => `${count} повторить`,
      review: count => [`Повторите ${count} ${plural(count, 'знак', 'знака', 'знаков')}`, 'Им пора на повторение сегодня. Один короткий круг — и они останутся в памяти.', `Повторить ${count} ${plural(count, 'знак', 'знака', 'знаков')} →`],
      mistakes: lesson => [lesson.title_ru, 'В первой проверке были ошибки. Разберите причины и повторите эти ситуации.', 'Разобрать ошибки →'],
      continue: lesson => [lesson.title_ru, lesson.focus_ru, `Продолжить урок ${two(lesson.number)} →`],
      first: lesson => [lesson.title_ru, lesson.focus_ru, `Начать урок ${two(lesson.number)} →`],
      start: lesson => [lesson.title_ru, lesson.focus_ru, `Начать урок ${two(lesson.number)} →`],
      done: () => ['Все уроки пройдены', 'Теперь проверьте себя в формате экзамена: тесты по знакам 1–4. И повторяйте знаки, когда им пора.', 'К тестам по знакам →'],
      practise: 'Тренировать знаки', repeat: 'Повторить знаки', placeholder: 'Тема, название или код — например, стоянка, C55', showing: 'Показано уроков',
    },
  };
  const t = () => T[lang()];
  const storage = () => { try { return window.localStorage; } catch (_) { return null; } };

  // Dynamic text is written by this script; the language switch must not reset it.
  ['nextStepTitle', 'nextStepCopy', 'lessonSuggested'].forEach(id => {
    const element = document.getElementById(id);
    delete element.dataset.en; delete element.dataset.ru;
  });
  root.querySelectorAll('[data-lesson-state]').forEach(element => { delete element.dataset.en; delete element.dataset.ru; });

  function savedCheck(lesson) {
    const context = { ...checks[lesson.id], owner: `${account}:${lesson.id}:standalone` };
    return { context, saved: checkStore.read(storage(), `wexSignLesson:${account}:${lesson.id}`, context) };
  }

  // A check finished on the earlier lesson page lives only in this browser for seven days;
  // keep it as a lasting result so the learner does not lose it.
  function adoptFinishedChecks() {
    lessons.forEach(lesson => {
      if (store.lessonResult(lesson.id, lesson.revision)) return;
      const { context, saved } = savedCheck(lesson);
      if (!saved || !(saved.finished || saved.firstAnswers)) return;
      const first = checkStore.score(saved.firstAnswers || saved.answers, context.questions);
      const reviewed = saved.finished ? Math.max(first, checkStore.score(saved.answers, context.questions)) : first;
      store.saveLessonResult(lesson.id, { revision: lesson.revision, first, total: context.questions.length, reviewed });
    });
  }

  function inProgress(lesson) {
    const run = store.readRun(lesson.id, lesson.revision);
    if (run && (run.stage !== 'learn' || run.learnIndex > 0)) return true;
    const { saved } = savedCheck(lesson);
    return Boolean(saved && Object.keys(saved.answers).length && !saved.finished);
  }

  function renderLessons() {
    let done = 0;
    lessons.forEach(lesson => {
      const result = store.lessonResult(lesson.id, lesson.revision);
      const counts = store.summary(lesson.codes);
      // Signs shared with an earlier lesson fill the meter, but only an opened lesson is "in progress".
      const state = result ? (result.reviewed < result.total ? 'review' : 'done') : (inProgress(lesson) ? 'progress' : 'new');
      if (result) done += 1;
      const chip = root.querySelector(`[data-lesson-state="${lesson.id}"]`);
      chip.dataset.state = state;
      chip.textContent = t().states[state];
      root.querySelector(`[data-lesson-meter="${lesson.id}"]`).style.width = `${Math.round((counts.met / counts.total) * 100)}%`;
      const line = root.querySelector(`[data-lesson-result="${lesson.id}"]`);
      if (result) {
        line.textContent = `${t().situations} ${result.first}/${result.total}`
          + (result.reviewed !== result.first ? ` · ${t().afterReview} ${result.reviewed}/${result.total}` : '');
      } else line.textContent = counts.met ? `${counts.met}/${counts.total} ${t().signsMet}` : '';
    });
    return done;
  }

  function renderNext(done) {
    const counts = store.summary(courseCodes);
    document.getElementById('gantryLearned').textContent = counts.met;
    document.getElementById('gantryDue').textContent = counts.due;
    document.getElementById('gantryLessons').textContent = done;
    document.getElementById('lessonOverviewProgress').textContent = `${done}/${lessons.length} ${t().lessonsDone}`;
    const step = window.WEXSignProgress.nextStep(store, lessons, inProgress);
    const [title, copy, action] = t()[step.kind](step.kind === 'review' ? step.due : step.lesson);
    document.getElementById('nextStepTitle').textContent = title;
    document.getElementById('nextStepCopy').textContent = copy;
    const button = document.getElementById('lessonSuggested');
    button.textContent = action;
    button.href = step.kind === 'review' ? '/signs/learn?review=due'
      : step.kind === 'mistakes' ? `/signs/lesson/${step.lesson.id}#lessonQuiz`
        : step.kind === 'done' ? '#signTests' : `/signs/lesson/${step.lesson.id}`;
    root.querySelector('.sx-next').dataset.kind = step.kind;
    const link = document.getElementById('signReviewLink');
    link.href = counts.due ? '/signs/learn?review=due' : '/signs/learn';
    link.querySelector('span').textContent = counts.met ? t().repeat : t().practise;
    document.getElementById('signReviewCount').textContent = counts.due ? `(${t().due(counts.due)})` : '';
  }

  const search = document.getElementById('lessonSearch');
  let topic = 'all';
  function filter() {
    const query = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;
    root.querySelectorAll('[data-lesson-card]').forEach(card => {
      card.hidden = (topic !== 'all' && card.dataset.topic !== topic) || !query.every(part => card.dataset.search.includes(part));
      if (!card.hidden) visible += 1;
    });
    document.getElementById('lessonEmpty').hidden = visible > 0;
    document.getElementById('lessonFilterCount').textContent = `${t().showing}: ${visible}/${lessons.length}`;
    search.placeholder = t().placeholder;
  }
  root.querySelectorAll('[data-lesson-topic]').forEach(button => button.addEventListener('click', () => {
    topic = button.dataset.lessonTopic;
    root.querySelectorAll('[data-lesson-topic]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    filter();
  }));
  search.addEventListener('input', filter);
  document.getElementById('lessonShowAll').addEventListener('click', () => {
    search.value = ''; root.querySelector('[data-lesson-topic="all"]').click(); search.focus();
  });

  function render() { renderNext(renderLessons()); filter(); }
  adoptFinishedChecks();
  store.onChange(render);
  root.querySelectorAll('.lang-btn').forEach(button => button.addEventListener('click', render));
  window.addEventListener('pageshow', render);
  window.addEventListener('storage', event => { if (event.key && /^wexSign/.test(event.key)) { store.refresh(); render(); } });
  render();
  store.load().then(() => { adoptFinishedChecks(); render(); });
})();
