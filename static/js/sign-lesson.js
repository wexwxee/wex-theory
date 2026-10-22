/* A sign lesson as a short player: learn each sign, recall it, compare look-alikes, decide in
   road situations, then see the result. The first situation check is the lesson's result; the
   recall step grades each sign for spaced review. */
(function () {
  'use strict';
  const root = document.getElementById('signLesson');
  if (!root || !window.WEXSignProgress || !window.WEXLessonCheck) return;
  const checkStore = window.WEXLessonCheck;
  const userId = root.dataset.userId || '';
  const account = userId || 'guest';
  const lessonId = root.dataset.lessonId;
  const revision = root.dataset.revision;
  const progress = window.WEXSignProgress.create({ userId });
  const questions = JSON.parse(document.getElementById('lessonQuestions').textContent);
  const recallData = JSON.parse(document.getElementById('lessonRecallData').textContent);
  const lessonSigns = recallData.signs;
  const codes = lessonSigns.map(sign => sign.code);
  const byCode = new Map([...lessonSigns, ...recallData.pool].map(sign => [sign.code, sign]));
  const guided = window.WEXStudy?.active('signs');
  const suffix = guided ? ':study:' + guided.id : '';
  const checkKey = `wexSignLesson:${account}:${lessonId}${suffix}`;
  const context = { questions, revision, owner: `${account}:${lessonId}:${guided?.id || 'standalone'}` };
  const stages = [...root.querySelectorAll('.sl-stages [data-stage]')].map(link => link.dataset.stage);
  const panels = Object.fromEntries([...root.querySelectorAll('[data-panel]')].map(panel => [panel.dataset.panel, panel]));
  const notes = [...root.querySelectorAll('.lesson-note')];
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const lang = () => document.documentElement.lang === 'ru' ? 'ru' : 'en';
  const text = value => value?.[lang()] || value?.en || '';
  function storage() { try { return window.localStorage; } catch (_) { return null; } }
  function raw(key) { try { return JSON.parse(storage().getItem(key)); } catch (_) { return null; } }
  function node(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = value;
    return element;
  }
  function shuffle(values) {
    const copy = values.slice();
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  }
  const labels = {
    en: { question: 'Situation', of: 'of', correct: 'Correct.', wrong: 'Review this decision.', next: 'Next situation', finish: 'See my result',
      retry: 'Practise my mistakes', restart: 'Start a new check', restartAsk: 'Start a new check? This replaces this lesson’s saved result.',
      first: 'First check', savedCheck: 'Previously saved check', reviewed: 'After reviewing mistakes', allRight: 'You answered every situation correctly. The signs will come back for review, so they stay with you.',
      needsReview: 'Read why the missed decisions were wrong, then practise those situations again.', corrected: 'The first result stays as it was. You have now corrected the missed decisions.',
      practice: 'Repeat these signs', lessons: 'All lessons', nextLesson: 'Next lesson', continueStudy: 'Continue study session →',
      yourAnswer: 'Your answer', rightAnswer: 'Correct answer', readSign: 'Read the sign again →', done: 'Reviewed', stillMissed: 'To review',
      save: 'Saved in this browser while you work through this lesson.', saveAccount: 'Your result is saved to your account when the check is finished.',
      cannotSave: 'Browser storage is unavailable. You can practise, but this check will not survive closing the page.',
      updated: 'These questions were updated. A new check has started.', enlarge: 'Enlarge road scene', reviewRound: 'Mistake review',
      progress: 'answered', complete: 'Check complete', signOf: (i, n) => `Sign ${i} of ${n}`, nextSign: 'Next sign →', toRecall: 'Check yourself →',
      recallAsk: 'What does this sign mean?', recallRight: 'Correct.', recallWrong: 'Not this one.', recallNext: 'Next sign →', recallLast: 'See how you did →',
      recallAgainNote: 'You will see this sign once more at the end.', recallDone: (r, n) => `${r} of ${n} signs right on the first try`,
      recallAllRight: 'Every sign right on the first try. They are now in your review.', recallSome: 'The signs you missed come back sooner in review.',
      recallRepeat: 'Recall again', toCompare: 'Continue: similar signs →', toSituations: 'Continue to situations →',
      recallScore: 'Recall', recallScoreCopy: 'signs right on the first try', recallSkipped: 'Not done yet', recallGo: 'Check yourself on the signs →',
      reviewCount: 'In your review', nextRepeat: when => `Next repeat: ${when}`, dueNow: 'Some are due now', situationsCopy: 'situations right',
      noSituationsYet: 'Answer the situations first, then your result appears here.', missedSigns: 'Signs to look at again', startSituations: 'Answer the situations →' },
    ru: { question: 'Ситуация', of: 'из', correct: 'Верно.', wrong: 'Разберите это решение.', next: 'Следующая ситуация', finish: 'Посмотреть результат',
      retry: 'Повторить мои ошибки', restart: 'Пройти новую проверку', restartAsk: 'Начать новую проверку? Она заменит сохранённый результат этого урока.',
      first: 'Первый проход', savedCheck: 'Ранее сохранённая проверка', reviewed: 'После разбора ошибок', allRight: 'Вы верно решили все ситуации. Знаки вернутся на повторение, чтобы запомниться.',
      needsReview: 'Разберите причины ошибочных решений, затем повторите эти ситуации.', corrected: 'Первый результат остаётся прежним. Теперь ошибочные решения разобраны.',
      practice: 'Повторить эти знаки', lessons: 'Все уроки', nextLesson: 'Следующий урок', continueStudy: 'Продолжить занятие →',
      yourAnswer: 'Ваш ответ', rightAnswer: 'Верный ответ', readSign: 'Разобрать знак ещё раз →', done: 'Разобрано', stillMissed: 'К разбору',
      save: 'Сохраняется в этом браузере, пока вы проходите урок.', saveAccount: 'Результат сохранится в аккаунте, когда проверка закончится.',
      cannotSave: 'Хранилище браузера недоступно. Тренироваться можно, но при закрытии страницы проверка потеряется.',
      updated: 'Вопросы обновлены. Начата новая проверка.', enlarge: 'Увеличить дорожную сцену', reviewRound: 'Разбор ошибок',
      progress: 'ответов', complete: 'Проверка завершена', signOf: (i, n) => `Знак ${i} из ${n}`, nextSign: 'Следующий знак →', toRecall: 'Проверить себя →',
      recallAsk: 'Что означает этот знак?', recallRight: 'Верно.', recallWrong: 'Не этот.', recallNext: 'Следующий знак →', recallLast: 'Посмотреть итог →',
      recallAgainNote: 'Этот знак появится ещё раз в конце.', recallDone: (r, n) => `${r} из ${n} знаков верно с первого раза`,
      recallAllRight: 'Все знаки верно с первого раза. Они уже в вашем повторении.', recallSome: 'Знаки с ошибкой вернутся на повторение раньше.',
      recallRepeat: 'Вспомнить ещё раз', toCompare: 'Дальше: похожие знаки →', toSituations: 'К ситуациям →',
      recallScore: 'Знаки', recallScoreCopy: 'верно с первого раза', recallSkipped: 'Ещё не проверены', recallGo: 'Проверить себя по знакам →',
      reviewCount: 'В повторении', nextRepeat: when => `Следующее повторение: ${when}`, dueNow: 'Часть пора повторить сейчас', situationsCopy: 'ситуаций верно',
      noSituationsYet: 'Сначала ответьте на ситуации — итог появится здесь.', missedSigns: 'Знаки, которые стоит повторить', startSituations: 'Ответить на ситуации →' },
  };
  const t = () => labels[lang()];

  // ── Saved state ────────────────────────────────────────────────────────────
  let updated = Boolean(raw(checkKey)?.revision && raw(checkKey).revision !== revision);
  let check = checkStore.read(storage(), checkKey, context) || checkStore.fresh(context);
  const firstScore = () => checkStore.score(check.firstAnswers || check.answers, questions);
  const checkDone = () => check.finished;

  function freshRecall() {
    return { deck: shuffle(codes), index: 0, first: {}, results: [], chosen: null, options: {}, done: false };
  }
  function validRun(value) {
    if (!value || !stages.includes(value.stage) || !Number.isInteger(value.learnIndex) || value.learnIndex < 0 || value.learnIndex >= codes.length) return false;
    const recall = value.recall;
    if (recall === null) return true;
    return recall && Array.isArray(recall.deck) && recall.deck.every(code => codes.includes(code)) && recall.deck.length >= codes.length
      && Number.isInteger(recall.index) && recall.index >= 0 && recall.index <= recall.deck.length
      && recall.first && typeof recall.first === 'object' && Array.isArray(recall.results)
      && recall.options && typeof recall.options === 'object' && (recall.chosen === null || codes.includes(recall.deck[recall.index]));
  }
  const savedRun = progress.readRun(lessonId, revision, suffix);
  let run = validRun(savedRun) ? savedRun : { version: 1, revision, createdAt: Date.now(), stage: 'learn', learnIndex: 0, seen: [], compared: false, recall: null };
  run.seen = Array.isArray(run.seen) ? run.seen.filter(code => codes.includes(code)) : [];
  function saveRun() { progress.writeRun(lessonId, run, suffix); }

  function saveCheck() {
    const saved = checkStore.write(storage(), checkKey, check);
    const studyNote = guided ? (lang() === 'ru' ? ' В занятии остаётся первый завершённый результат этого шага.' : ' The study session keeps the first completed result for this step.') : '';
    document.getElementById('lessonSaveState').textContent = (!saved ? t().cannotSave : updated ? t().updated : userId ? t().saveAccount : t().save) + studyNote;
  }

  function recallScore() {
    const recall = run.recall;
    if (!recall?.done || !codes.every(code => code in recall.first)) return null;
    return codes.filter(code => recall.first[code]).length;
  }
  function saveResult() {
    if (!check.finished && !check.firstAnswers) return;
    const first = firstScore();
    const reviewed = check.finished ? Math.max(first, checkStore.score(check.answers, questions)) : first;
    const recall = recallScore();
    progress.saveLessonResult(lessonId, { revision, first, total: questions.length, reviewed,
      recall_first: recall, recall_total: recall === null ? null : codes.length });
  }

  // ── Stages ────────────────────────────────────────────────────────────────
  // Links name a step (#lessonQuiz, #lessonRecall …) or a sign (#sign-B11).
  function stageFromHash() {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash === 'lessonQuiz' || hash === 'lessonResult') return checkDone() ? 'result' : 'situations';
    if (hash === 'lessonRecall') return 'recall';
    if (hash === 'lessonCompare' && stages.includes('compare')) return 'compare';
    if (hash.startsWith('sign-') && codes.includes(hash.slice(5))) { run.learnIndex = codes.indexOf(hash.slice(5)); return 'learn'; }
    if (hash === 'lessonRead') return 'learn';
    return null;
  }
  function initialStage() {
    const fromHash = stageFromHash();
    if (fromHash) return fromHash;
    if (validRun(savedRun)) return run.stage === 'result' && !checkDone() ? 'situations' : run.stage;
    if (checkDone()) return 'result';
    if (updated || Object.keys(check.answers).length) return 'situations';
    return 'learn';
  }
  function setStage(stage, focus = true) {
    if (stage === 'result' && !checkDone()) stage = 'situations';
    if (stage === 'situations' && checkDone()) stage = 'result'; // a finished check is reopened from its result
    if (stage === 'recall' && !run.recall) run.recall = freshRecall();
    if (stage === 'compare') run.compared = true;
    run.stage = stage;
    saveRun();
    render();
    // Keep the steps at the top so the new step has the screen; a phone needs the room most.
    const bar = root.querySelector('.sl-stages');
    const top = bar.getBoundingClientRect().top;
    if (top < 0 || (window.innerWidth < 760 && top > 96)) bar.scrollIntoView({ block: 'start', behavior: reduceMotion || !document.hasFocus() ? 'auto' : 'smooth' });
    if (focus) focusStage();
  }
  function focusStage() {
    const target = run.stage === 'learn' ? notes[run.learnIndex]?.querySelector('h3')
      : run.stage === 'recall' ? (panels.recall.querySelector('#recallQuestion') || panels.recall.querySelector('.sl-recall-score') || document.getElementById('lessonRecallTitle'))
        : run.stage === 'situations' ? (panels.situations.querySelector('.lesson-question') || panels.situations.querySelector('h2'))
          : run.stage === 'result' ? panels.result.querySelector('.lesson-score') : panels[run.stage]?.querySelector('h2');
    if (target) { if (!target.hasAttribute('tabindex')) target.tabIndex = -1; target.focus({ preventScroll: true }); }
  }
  function nextAfter(stage) { const index = stages.indexOf(stage); return stages[index + 1]; }

  function renderStages() {
    root.querySelectorAll('.sl-stages [data-stage]').forEach(link => {
      const stage = link.dataset.stage;
      const done = stage === 'learn' ? run.seen.length === codes.length : stage === 'recall' ? Boolean(run.recall?.done)
        : stage === 'compare' ? run.compared : stage === 'situations' ? Boolean(check.firstAnswers || check.finished) : checkDone();
      link.classList.toggle('is-done', done);
      if (stage === run.stage) link.setAttribute('aria-current', 'step'); else link.removeAttribute('aria-current');
      if (stage === 'result') link.setAttribute('aria-disabled', String(!checkDone()));
    });
    Object.entries(panels).forEach(([stage, panel]) => { panel.hidden = stage !== run.stage; });
    const status = document.getElementById('lessonProgress');
    status.textContent = check.finished ? t().complete : `${Object.keys(check.answers).length}/${questions.length} ${t().progress}`;
  }

  // ── 1. Learn ──────────────────────────────────────────────────────────────
  function renderLearn() {
    const index = run.learnIndex;
    if (!run.seen.includes(codes[index])) run.seen.push(codes[index]);
    notes.forEach((note, position) => { note.hidden = position !== index; });
    root.querySelectorAll('[data-learn-index]').forEach(button => {
      const position = Number(button.dataset.learnIndex);
      if (position === index) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current');
      button.classList.toggle('is-seen', run.seen.includes(codes[position]));
    });
    document.getElementById('learnCounter').textContent = t().signOf(index + 1, codes.length);
    const previous = document.getElementById('learnPrev');
    previous.disabled = index === 0;
    document.getElementById('learnNext').textContent = index === codes.length - 1 ? t().toRecall : t().nextSign;
    root.querySelectorAll('[data-lesson-image]').forEach(button => button.setAttribute('aria-label', t().enlarge));
  }
  function learnMove(step) {
    const index = run.learnIndex + step;
    if (index >= codes.length) { setStage('recall'); return; }
    if (index < 0) return;
    run.learnIndex = index; saveRun(); renderLearn();
    notes[index].querySelector('h3').tabIndex = -1;
    notes[index].querySelector('h3').focus({ preventScroll: true });
  }
  document.getElementById('learnPrev').addEventListener('click', () => learnMove(-1));
  document.getElementById('learnNext').addEventListener('click', () => learnMove(1));
  root.querySelectorAll('[data-learn-index]').forEach(button => button.addEventListener('click', () => {
    run.learnIndex = Number(button.dataset.learnIndex); saveRun(); renderLearn();
  }));

  // ── 2. Recall ─────────────────────────────────────────────────────────────
  const nameOf = code => byCode.get(code)?.name;
  function buildOptions(code) {
    const sign = byCode.get(code);
    const takenEn = new Set([sign.name.en]); const takenRu = new Set([sign.name.ru]);
    const equivalents = new Set([sign.eq].filter(Boolean));
    const mates = shuffle(lessonSigns.filter(other => other.code !== code));
    const candidates = [...mates.filter(other => other.group === sign.group), ...mates.filter(other => other.group !== sign.group),
      ...shuffle(recallData.pool.filter(other => other.group === sign.group))];
    const picks = [];
    for (const other of candidates) {
      if (picks.length >= 3) break;
      if (takenEn.has(other.name.en) || takenRu.has(other.name.ru) || (other.eq && equivalents.has(other.eq))) continue;
      takenEn.add(other.name.en); takenRu.add(other.name.ru); if (other.eq) equivalents.add(other.eq);
      picks.push(other.code);
    }
    return shuffle([code, ...picks]);
  }
  function renderRecall() {
    const recall = run.recall || (run.recall = freshRecall());
    const stage = document.getElementById('recallStage');
    stage.replaceChildren();
    const pills = document.getElementById('recallPills');
    pills.replaceChildren(...recall.deck.map((_, position) => {
      const pill = node('span');
      if (position < recall.results.length) pill.className = recall.results[position] ? 'is-right' : 'is-wrong';
      else if (position === recall.index && !recall.done) pill.className = 'is-current';
      return pill;
    }));
    const counter = document.getElementById('recallCounter');
    if (recall.done) {
      counter.textContent = '';
      const right = codes.filter(code => recall.first[code]).length;
      const summary = node('div', 'sl-recall-summary');
      const score = node('div', 'sl-recall-score wx-led', `${right}/${codes.length}`); score.tabIndex = -1;
      summary.append(score, node('p', 'sl-recall-copy', t().recallDone(right, codes.length)));
      const missed = codes.filter(code => !recall.first[code]);
      summary.append(node('p', 'sl-note', missed.length ? t().recallSome : t().recallAllRight));
      if (missed.length) {
        const list = node('div', 'sl-missed');
        missed.forEach(code => {
          const item = node('button', 'sl-missed-item'); item.type = 'button'; item.dataset.reviewCode = code;
          const image = node('img'); image.src = byCode.get(code).image; image.alt = '';
          item.append(image, node('span', '', `${code} · ${text(nameOf(code))}`));
          list.append(item);
        });
        summary.append(list);
      }
      const actions = node('div', 'sl-actions');
      const forward = node('button', 'btn-primary sx-btn', nextAfter('recall') === 'compare' ? t().toCompare : t().toSituations);
      forward.type = 'button'; forward.id = 'recallContinue';
      forward.addEventListener('click', () => setStage(nextAfter('recall')));
      const again = node('button', 'btn-ghost sx-btn', t().recallRepeat); again.type = 'button';
      again.addEventListener('click', () => { run.recall = freshRecall(); saveRun(); renderRecall(); focusStage(); });
      actions.append(again, forward);
      summary.append(actions);
      stage.append(summary);
      return;
    }
    const code = recall.deck[recall.index];
    if (!recall.options[code]) { recall.options[code] = buildOptions(code); saveRun(); }
    counter.textContent = `${recall.index + 1} ${t().of} ${recall.deck.length}`;
    const card = node('div', 'sl-recall');
    const art = node('div', 'sl-recall-art'); const image = node('img'); image.src = byCode.get(code).image; image.alt = lang() === 'ru' ? 'Дорожный знак' : 'Road sign'; image.width = 150; image.height = 150; art.append(image);
    const question = node('p', 'sl-question', t().recallAsk); question.id = 'recallQuestion'; question.tabIndex = -1;
    const options = node('div', 'sl-options'); options.setAttribute('role', 'group'); options.setAttribute('aria-labelledby', 'recallQuestion');
    const answered = recall.chosen !== null;
    recall.options[code].forEach((option, position) => {
      const button = node('button', 'sl-option recall-option'); button.type = 'button'; button.dataset.code = option; button.disabled = answered;
      const copy = node('span', 'sl-option-copy', text(nameOf(option)));
      if (answered && option === code) { button.classList.add('is-correct'); copy.append(node('span', 'lesson-option-badge', t().rightAnswer)); }
      if (answered && option === recall.chosen && option !== code) { button.classList.add('is-wrong'); copy.append(node('span', 'lesson-option-badge', t().yourAnswer)); }
      button.append(node('span', 'lesson-option-key', String(position + 1)), copy);
      button.addEventListener('click', () => recallAnswer(option));
      options.append(button);
    });
    card.append(art, node('div', 'sl-recall-body'));
    card.lastChild.append(question, options);
    if (answered) {
      const right = recall.chosen === code;
      const sign = byCode.get(code);
      const why = node('div', 'lesson-answer sl-why ' + (right ? 'is-correct' : 'is-wrong')); why.setAttribute('role', 'status');
      why.append(node('strong', '', right ? t().recallRight : t().recallWrong));
      why.append(node('p', 'sl-why-name', `${code} · ${text(sign.name)}`));
      if (sign.meaning) why.append(node('p', '', text(sign.meaning)));
      else why.append(node('p', '', text(sign.action)));
      if (!right) {
        why.append(node('p', 'sl-why-mistake', text(sign.mistake)));
        if (recall.deck.indexOf(code, recall.index + 1) !== -1) why.append(node('p', 'sl-note', t().recallAgainNote));
      }
      const next = node('button', 'btn-primary sx-btn', recall.index + 1 >= recall.deck.length ? t().recallLast : t().recallNext);
      next.type = 'button'; next.id = 'recallNext';
      next.addEventListener('click', recallAdvance);
      card.lastChild.append(why, next);
    }
    stage.append(card);
  }
  function recallAnswer(choice) {
    const recall = run.recall;
    const code = recall.deck[recall.index];
    if (recall.chosen !== null || recall.done) return;
    const right = choice === code;
    recall.chosen = choice;
    recall.results.push(right);
    if (!(code in recall.first)) recall.first[code] = right;
    if (!right && recall.deck.indexOf(code, recall.index + 1) === -1) { recall.deck.push(code); }
    progress.grade(code, right, 'quiz');
    saveRun();
    renderRecall(); renderStages();
    document.getElementById('recallNext')?.focus({ preventScroll: true });
  }
  function recallAdvance() {
    const recall = run.recall;
    recall.chosen = null;
    recall.index += 1;
    if (recall.index >= recall.deck.length) { recall.done = true; saveResult(); }
    saveRun();
    renderRecall(); renderStages();
    focusStage();
  }

  // ── 3. Compare ────────────────────────────────────────────────────────────
  document.getElementById('compareNext')?.addEventListener('click', () => setStage('situations'));

  // ── 4. Situations ─────────────────────────────────────────────────────────
  const quizStage = document.getElementById('lessonQuizStage');
  function imageButton(src, alt, className) {
    const button = node('button', 'lesson-image-open'); button.type = 'button'; button.dataset.lessonImage = src;
    button.setAttribute('aria-label', t().enlarge);
    const image = node('img', className); image.src = src; image.alt = alt;
    button.append(image, node('span', 'lesson-image-hint', t().enlarge + ' ↗'));
    return button;
  }
  function renderSituations() {
    quizStage.replaceChildren();
    if (check.finished) { // the result panel holds the finished check
      const done = node('div', 'sl-done');
      done.append(node('p', '', t().complete));
      const open = node('button', 'btn-primary sx-btn', lang() === 'ru' ? 'Открыть итог →' : 'Open the result →'); open.type = 'button';
      open.addEventListener('click', () => setStage('result'));
      done.append(open); quizStage.append(done); saveCheck(); return;
    }
    const question = questions.find(item => item.id === check.deck[check.index]);
    const counter = `${check.firstAnswers ? t().reviewRound + ' · ' : ''}${t().question} ${check.index + 1} ${t().of} ${check.deck.length}`;
    quizStage.append(node('div', 'lesson-counter', counter));
    const layout = node('div', 'sl-situation');
    if (question.image) layout.append(imageButton(question.image, lang() === 'ru' ? 'Дорожная ситуация' : 'Road scene', 'lesson-quiz-photo'));
    else { const image = node('img', 'lesson-quiz-art'); image.src = '/static/signs/' + question.code + '.svg'; image.alt = question.code; layout.append(image); }
    const body = node('div', 'sl-situation-body');
    const heading = node('p', 'lesson-question', text(question.prompt)); heading.tabIndex = -1; heading.id = 'lessonCurrentQuestion'; body.append(heading);
    const answered = Object.hasOwn(check.answers, question.id);
    if (question.kind === 'statements') renderStatements(question, body, heading, answered);
    else renderOptions(question, body, heading, answered);
    if (answered) {
      const correct = check.answers[question.id] === question.correct;
      const feedback = node('div', 'lesson-answer ' + (correct ? 'is-correct' : 'is-wrong')); feedback.tabIndex = -1; feedback.setAttribute('role', 'status');
      feedback.append(node('strong', '', correct ? t().correct : t().wrong), node('p', '', text(question.explanation))); body.append(feedback);
      const next = node('button', 'btn-primary sx-btn', check.index + 1 === check.deck.length ? t().finish : t().next); next.type = 'button'; next.id = 'lessonNext';
      next.addEventListener('click', () => {
        if (!checkStore.advance(check)) return;
        if (check.finished) { saveCheck(); saveResult(); setStage('result'); return; }
        renderSituations(); renderStages(); focusStage();
      });
      body.append(next);
    }
    layout.append(body);
    quizStage.append(layout);
    saveCheck();
  }
  function afterAnswer() {
    updated = false; renderSituations(); renderStages();
    const feedback = quizStage.querySelector('.lesson-answer'); feedback.focus({ preventScroll: true }); feedback.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }
  // Exam-style: tick every statement that is true, then check. The answer is the ticked set as a
  // bit mask; it counts only when it matches the true statements exactly, as in the theory test.
  const drafts = {};
  function renderStatements(question, body, heading, answered) {
    body.append(node('p', 'lesson-statement-hint', lang() === 'ru' ? 'Отметьте все верные утверждения.' : 'Tick every statement that is true.'));
    const list = node('div', 'lesson-statements'); list.setAttribute('role', 'group'); list.setAttribute('aria-labelledby', heading.id);
    const chosen = answered ? check.answers[question.id] : (drafts[question.id] || 0);
    question.statements.forEach((statement, index) => {
      const bit = 1 << index, ticked = Boolean(chosen & bit);
      const row = node('button', 'lesson-option lesson-statement'); row.type = 'button'; row.disabled = answered;
      row.setAttribute('role', 'checkbox'); row.setAttribute('aria-checked', String(ticked));
      const copy = node('span', 'lesson-option-copy', text(statement.text));
      if (answered) {
        row.classList.add(ticked === statement.correct ? 'is-correct' : 'is-wrong');
        copy.append(node('span', 'lesson-option-badge', statement.correct ? (lang() === 'ru' ? 'Это верно' : 'This is true') : (lang() === 'ru' ? 'Это неверно' : 'This is false')),
          node('span', 'lesson-statement-why', text(statement.why)));
      }
      row.append(node('span', 'lesson-statement-box'), copy);
      row.addEventListener('click', () => {
        drafts[question.id] = (drafts[question.id] || 0) ^ bit;
        row.setAttribute('aria-checked', String(Boolean(drafts[question.id] & bit)));
      });
      list.append(row);
    });
    body.append(list);
    if (answered) return;
    const submit = node('button', 'btn-primary sx-btn', lang() === 'ru' ? 'Проверить ответ' : 'Check answer'); submit.type = 'button'; submit.id = 'lessonCheck';
    submit.addEventListener('click', () => {
      if (!checkStore.answer(check, context, drafts[question.id] || 0)) return;
      delete drafts[question.id];
      afterAnswer();
    });
    body.append(submit);
  }
  function renderOptions(question, body, heading, answered) {
    const options = node('div', 'lesson-options'); options.setAttribute('role', 'group'); options.setAttribute('aria-labelledby', heading.id);
    check.orders[question.id].forEach((answer, position) => {
      const button = node('button', 'lesson-option'); button.type = 'button'; button.dataset.answer = String(answer); button.disabled = answered;
      button.setAttribute('aria-pressed', String(answered && check.answers[question.id] === answer));
      const copy = node('span', 'lesson-option-copy', text(question.options[answer]));
      if (answered && answer === question.correct) { button.classList.add('is-correct'); copy.append(node('span', 'lesson-option-badge', t().rightAnswer)); }
      if (answered && answer === check.answers[question.id] && answer !== question.correct) { button.classList.add('is-wrong'); copy.append(node('span', 'lesson-option-badge', t().yourAnswer)); }
      button.append(node('span', 'lesson-option-key', String(position + 1)), copy);
      button.addEventListener('click', () => {
        if (!checkStore.answer(check, context, answer)) return;
        afterAnswer();
      });
      options.append(button);
    });
    body.append(options);
  }

  // ── 5. Result ─────────────────────────────────────────────────────────────
  function link(label, href, className) { const element = node('a', className, label); element.href = href; return element; }
  function scoreCard(kicker, value, copy, extra) {
    const card = node('div', 'sl-score-card');
    card.append(node('p', 'lesson-kicker', kicker), value, node('p', 'sl-score-copy', copy));
    if (extra) card.append(extra);
    return card;
  }
  function renderResult() {
    const stage = document.getElementById('lessonResultStage');
    stage.replaceChildren();
    if (!checkDone()) {
      stage.append(node('p', 'sl-note', t().noSituationsYet));
      const go = node('button', 'btn-primary sx-btn', t().startSituations); go.type = 'button'; go.addEventListener('click', () => setStage('situations'));
      stage.append(go); return;
    }
    saveCheck(); // keeps an older saved check in the current format
    const initial = firstScore();
    const current = checkStore.score(check.answers, questions);
    const grid = node('div', 'sl-result-scores');
    const score = node('div', 'lesson-score wx-led', `${initial}/${questions.length}`); score.tabIndex = -1;
    const reviewed = check.firstAnswers && current !== initial ? node('p', 'lesson-reviewed-score', `${t().reviewed}: ${current}/${questions.length}`) : null;
    grid.append(scoreCard(check.firstAnswers ? t().first : t().savedCheck, score, t().situationsCopy, reviewed));
    const recall = recallScore();
    if (recall === null) {
      const go = node('button', 'sl-text-button', t().recallGo); go.type = 'button'; go.addEventListener('click', () => setStage('recall'));
      grid.append(scoreCard(t().recallScore, node('div', 'wx-led sl-score-empty', '—'), t().recallSkipped, go));
    } else grid.append(scoreCard(t().recallScore, node('div', 'wx-led', `${recall}/${codes.length}`), t().recallScoreCopy));
    const counts = progress.summary(codes);
    const when = counts.due ? t().dueNow : t().nextRepeat(window.WEXSignProgress.formatDue(progress.nextDue(codes), lang()));
    grid.append(scoreCard(t().reviewCount, node('div', 'wx-led', `${counts.met}/${codes.length}`), counts.met ? when : (lang() === 'ru' ? 'знаки ещё не проверены' : 'signs not checked yet')));
    stage.append(grid);
    const missed = questions.filter(question => check.answers[question.id] !== question.correct);
    stage.append(node('p', 'lesson-summary-copy', missed.length ? t().needsReview : initial === questions.length ? t().allRight : t().corrected));
    const originalMisses = questions.filter(question => (check.firstAnswers || check.answers)[question.id] !== question.correct);
    if (originalMisses.length) {
      const list = node('div', 'lesson-mistakes');
      originalMisses.forEach(question => {
        const item = node('article', 'lesson-mistake' + (check.answers[question.id] === question.correct ? ' is-reviewed' : ''));
        item.append(node('p', 'lesson-kicker', check.answers[question.id] === question.correct ? t().done : t().stillMissed),
          node('h3', '', text(question.prompt)), node('p', '', text(question.explanation)));
        const again = node('button', 'sl-text-button', t().readSign); again.type = 'button'; again.dataset.reviewCode = question.code; item.append(again); list.append(item);
      });
      stage.append(list);
    }
    const actions = node('div', 'lesson-actions sl-actions');
    if (missed.length) {
      const retry = node('button', 'btn-primary sx-btn', t().retry); retry.id = 'lessonRetry'; retry.type = 'button';
      retry.addEventListener('click', () => { if (checkStore.retry(check, context)) { saveCheck(); setStage('situations'); } });
      actions.append(retry);
    }
    window.WEXStudy?.returnLink(actions, 'signs', initial, questions.length, 'quiz');
    const studyLink = actions.querySelector('[data-study-return]');
    if (studyLink) { studyLink.textContent = t().continueStudy; studyLink.classList.add('sx-btn'); if (missed.length) studyLink.className = 'btn-ghost sx-btn'; }
    actions.append(link(t().practice, '/signs/learn?lesson=' + lessonId, 'btn-ghost sx-btn'));
    const restart = node('button', 'sl-text-button', t().restart); restart.type = 'button'; restart.id = 'lessonRestart';
    restart.addEventListener('click', () => {
      if (!window.confirm(t().restartAsk)) return;
      check = checkStore.fresh(context); updated = false; saveCheck(); setStage('situations');
    });
    actions.append(restart);
    stage.append(actions);
    if (root.dataset.nextLesson) {
      const next = node('div', 'lesson-summary-next');
      const number = String(root.dataset.nextNumber).padStart(2, '0');
      next.append(node('p', 'lesson-kicker', t().nextLesson),
        link(`${number} · ${lang() === 'ru' ? root.dataset.nextRu : root.dataset.nextEn} →`, '/signs/lesson/' + root.dataset.nextLesson, missed.length || studyLink ? 'btn-ghost sx-btn' : 'btn-primary sx-btn'));
      stage.append(next);
    } else stage.append(link(t().lessons, '/signs/lessons', 'btn-ghost sx-btn'));
  }

  // ── Wiring ────────────────────────────────────────────────────────────────
  function render() {
    renderStages();
    if (run.stage === 'learn') renderLearn();
    if (run.stage === 'recall') renderRecall();
    if (run.stage === 'situations') renderSituations();
    if (run.stage === 'result') renderResult();
  }
  root.querySelectorAll('.sl-stages [data-stage]').forEach(stageLink => stageLink.addEventListener('click', event => {
    event.preventDefault();
    if (stageLink.getAttribute('aria-disabled') === 'true') return;
    history.replaceState(null, '', '#' + panels[stageLink.dataset.stage].id);
    setStage(stageLink.dataset.stage);
  }));
  root.addEventListener('click', event => {
    const image = event.target.closest('[data-lesson-image]');
    if (image) window.openImageLightbox?.(image.dataset.lessonImage, image.querySelector('img').alt, { lang: lang() });
    const review = event.target.closest('[data-review-code]');
    if (review && codes.includes(review.dataset.reviewCode)) { run.learnIndex = codes.indexOf(review.dataset.reviewCode); setStage('learn'); }
  });
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey || window.WEXNavigation?.isOpen() || document.querySelector('.cookie-consent.show')) return;
    if ((event.target instanceof Element && event.target.matches('input,textarea,select')) || document.querySelector('.lbz-overlay.is-open')) return;
    if (run.stage === 'learn' && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) { event.preventDefault(); learnMove(event.key === 'ArrowRight' ? 1 : -1); return; }
    if (/^[1-4]$/.test(event.key)) {
      const selector = run.stage === 'recall' ? '.recall-option:not(:disabled)' : run.stage === 'situations' ? '.lesson-option:not(:disabled)' : null;
      const button = selector && root.querySelectorAll(selector)[Number(event.key) - 1];
      if (button) { event.preventDefault(); button.click(); }
    }
  });
  root.querySelectorAll('.lang-btn').forEach(button => button.addEventListener('click', render));
  window.addEventListener('hashchange', () => { const stage = stageFromHash(); if (stage) setStage(stage); });

  root.classList.add('is-player');
  run.stage = initialStage(); // saved only once the learner does something
  render();
  if (location.hash && run.stage !== 'learn') root.querySelector('.sl-stages').scrollIntoView({ block: 'start' });
  progress.load().then(() => { if (check.finished || check.firstAnswers) saveResult(); if (run.stage === 'result') renderResult(); });
})();
