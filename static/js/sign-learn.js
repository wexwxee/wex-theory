(function () {
  document.getElementById('signsBurgerBtn')?.addEventListener('click', sbOpen);
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);

  const shell = document.getElementById('learnShell');
  const stage = document.getElementById('learnStage');
  if (!shell || !stage) return;

  const PROGRESS_KEY = 'wexSignsProgress';
  const LANG_KEY = 'wexSignsLang';
  const LEGACY_KNOWN = 'wexSignsKnown';
  const LEGACY_HARD = 'wexSignsHard';
  const SESSION_SIZE = 12;
  const LEARNED_AT = 3; // correct answers in a row before a sign counts as learned

  const T = {
    en: {
      title: 'Practise road signs',
      modes: { cards: 'Cards', name: 'Sign → meaning', image: 'Meaning → sign' },
      reset: 'Reset my progress',
      all: 'All signs',
      stats: (learned, review, total) =>
        `<b>${learned}</b> learned &middot; <b>${review}</b> to review &middot; ${total} in this set`,
      counter: (index, total) => `Question ${index} of ${total}`,
      score: (right, asked) => (asked ? `${right}/${asked} correct` : ''),
      askCard: 'What does this sign mean?',
      askName: 'What does this sign mean?',
      askImage: 'Which sign means this?',
      reveal: 'Show the answer',
      knew: 'I knew it',
      again: 'Show me again',
      next: 'Next sign',
      correct: 'Correct.',
      wrong: (name) => `Not quite — that one is <b>${name}</b>.`,
      summary: 'Round finished',
      summaryLine: (right, total) => `${right} of ${total} right`,
      missed: 'Worth another look',
      practiseMissed: 'Practise these',
      newRound: 'New round',
      browse: 'Browse the catalogue',
      empty: 'Nothing to practise in this set yet.',
      hint:
        'Progress stays in this browser. Signs you miss come back sooner, and a sign counts as learned after three correct answers in a row.',
      keys: 'Keyboard: 1-4 to answer, Enter to continue.',
      failed: 'Could not load the signs. Reload the page to try again.',
      danish: 'In Danish',
      groups: {
        A: 'Warning', B: 'Priority', C: 'Prohibitory', D: 'Mandatory', E: 'Information',
        U: 'Subpanels', F: 'Direction', G: 'Portal', H: 'Distance', I: 'Exits',
        J: 'Lanes', K: 'Route', M: 'Services',
      },
    },
    ru: {
      title: 'Тренажёр знаков',
      modes: { cards: 'Карточки', name: 'Знак → значение', image: 'Значение → знак' },
      reset: 'Сбросить прогресс',
      all: 'Все знаки',
      stats: (learned, review, total) =>
        `<b>${learned}</b> выучено &middot; <b>${review}</b> на повторение &middot; ${total} в наборе`,
      counter: (index, total) => `Вопрос ${index} из ${total}`,
      score: (right, asked) => (asked ? `${right}/${asked} верно` : ''),
      askCard: 'Что означает этот знак?',
      askName: 'Что означает этот знак?',
      askImage: 'Какой знак это означает?',
      reveal: 'Показать ответ',
      knew: 'Знал',
      again: 'Показать ещё раз',
      next: 'Следующий знак',
      correct: 'Верно.',
      wrong: (name) => `Не то — это <b>${name}</b>.`,
      summary: 'Круг пройден',
      summaryLine: (right, total) => `${right} из ${total} верно`,
      missed: 'Стоит повторить',
      practiseMissed: 'Повторить их',
      newRound: 'Новый круг',
      browse: 'Открыть каталог',
      empty: 'В этом наборе пока нечего тренировать.',
      hint:
        'Прогресс хранится в этом браузере. Знаки, где вы ошиблись, возвращаются раньше, а выученным знак считается после трёх верных ответов подряд.',
      keys: 'С клавиатуры: 1-4 — ответ, Enter — дальше.',
      failed: 'Не удалось загрузить знаки. Обновите страницу.',
      danish: 'По-датски',
      groups: {
        A: 'Предупреждающие', B: 'Приоритет', C: 'Запрещающие', D: 'Предписывающие',
        E: 'Информационные', U: 'Таблички', F: 'Указатели', G: 'Порталы', H: 'Расстояния',
        I: 'Съезды', J: 'Полосы', K: 'Маршрут', M: 'Сервис',
      },
    },
  };

  const state = {
    signs: [],
    lang: readLang(),
    mode: 'cards',
    group: shell.dataset.group || 'all',
    progress: readProgress(),
    deck: [],
    position: 0,
    revealed: false,
    answered: false,
    chosen: null,
    right: 0,
    missed: [],
    finished: false,
  };

  function t() {
    return T[state.lang] || T.en;
  }

  function readLang() {
    try {
      return localStorage.getItem(LANG_KEY) === 'ru' ? 'ru' : 'en';
    } catch (e) {
      return 'en';
    }
  }

  function readProgress() {
    try {
      const stored = JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null');
      if (stored && typeof stored === 'object') return stored;
      // First run after the old two-list version: keep what the learner had.
      const known = JSON.parse(localStorage.getItem(LEGACY_KNOWN) || '[]');
      const hard = JSON.parse(localStorage.getItem(LEGACY_HARD) || '[]');
      const migrated = {};
      (Array.isArray(known) ? known : []).forEach((code) => { migrated[code] = { box: LEARNED_AT }; });
      (Array.isArray(hard) ? hard : []).forEach((code) => { migrated[code] = { box: 0 }; });
      return migrated;
    } catch (e) {
      return {};
    }
  }

  function save() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.progress));
      localStorage.setItem(LANG_KEY, state.lang);
    } catch (e) {
      // private mode: the session still works, it just is not remembered
    }
  }

  function box(code) {
    return state.progress[code]?.box || 0;
  }

  function grade(code, right) {
    const entry = state.progress[code] || { box: 0 };
    entry.box = right ? Math.min(entry.box + 1, 5) : 0;
    state.progress[code] = entry;
    save();
  }

  function label(sign) {
    return (state.lang === 'ru' && sign.name_ru) || sign.name;
  }

  function explanation(sign) {
    return (state.lang === 'ru' && sign.meaning_ru) || sign.meaning || '';
  }

  function inScope() {
    return state.group === 'all'
      ? state.signs
      : state.signs.filter((sign) => sign.group === state.group);
  }

  function shuffle(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Weakest first: never answered or last answered wrong, then the rest by box.
  function startSession(pool) {
    const scope = pool || inScope();
    const ordered = shuffle(scope).sort((a, b) => box(a.code) - box(b.code));
    state.deck = ordered.slice(0, Math.min(SESSION_SIZE, ordered.length));
    state.position = 0;
    state.right = 0;
    state.missed = [];
    state.revealed = false;
    state.answered = false;
    state.chosen = null;
    state.finished = false;
    render();
  }

  function current() {
    return state.deck[state.position];
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function signArt(sign, reveal) {
    const art = el('div', 'learn-art');
    const img = document.createElement('img');
    img.src = sign.image;
    img.alt = reveal ? `${sign.code}: ${label(sign)}` : 'Road sign';
    art.appendChild(img);
    return art;
  }

  function optionKey(index) {
    return el('span', 'option-key', String(index + 1));
  }

  // Options never repeat a visible label: some signs share a name (D11.1-D11.8),
  // and two identical answers would both be right.
  function buildOptions(sign) {
    const taken = new Set([label(sign)]);
    const family = shuffle(state.signs.filter((other) => other.group === sign.group));
    const rest = shuffle(state.signs);
    const distractors = [];

    [...family, ...rest].forEach((other) => {
      if (distractors.length >= 3) return;
      const text = label(other);
      if (other.code === sign.code || taken.has(text)) return;
      taken.add(text);
      distractors.push(other);
    });

    return shuffle([sign, ...distractors]);
  }

  function finishAnswer(sign, chosen, buttons, feedback) {
    state.answered = true;
    state.chosen = chosen;
    const right = chosen.code === sign.code;
    if (right) state.right += 1;
    else state.missed.push(sign);
    grade(sign.code, right);
    showAnswer(sign, chosen, buttons, feedback);
  }

  // Drawing the answered state is separate from grading it: a language switch
  // re-renders the question and must not score it a second time.
  function showAnswer(sign, chosen, buttons, feedback) {
    const right = chosen.code === sign.code;

    buttons.forEach((button) => {
      button.disabled = true;
      if (button.dataset.code === sign.code) button.classList.add('is-correct');
      if (!right && button.dataset.code === chosen.code) button.classList.add('is-wrong');
    });

    feedback.innerHTML = right ? t().correct : t().wrong(label(chosen));
    const explain = el('div', 'learn-explain');
    explain.appendChild(el('span', 'explain-code', sign.code));
    explain.appendChild(document.createTextNode(explanation(sign) || label(sign)));
    if (sign.name_da) explain.appendChild(el('div', 'explain-danish', `${t().danish}: ${sign.name_da}`));
    feedback.appendChild(explain);

    const actions = el('div', 'learn-actions');
    const next = el('button', 'btn-primary', t().next);
    next.type = 'button';
    next.id = 'nextBtn';
    next.addEventListener('click', advance);
    actions.appendChild(next);
    stage.appendChild(actions);
    next.focus();
    renderStats();
  }

  function renderCard(sign) {
    stage.appendChild(signArt(sign, state.revealed));

    if (!state.revealed) {
      stage.appendChild(el('p', 'learn-question', t().askCard));
      const actions = el('div', 'learn-actions');
      const reveal = el('button', 'btn-primary', t().reveal);
      reveal.type = 'button';
      reveal.id = 'revealBtn';
      reveal.addEventListener('click', () => {
        state.revealed = true;
        render();
      });
      actions.appendChild(reveal);
      stage.appendChild(actions);
      return;
    }

    stage.appendChild(el('div', 'learn-code', `${sign.code} · ${sign.group_label}`));
    stage.appendChild(el('div', 'learn-name', label(sign)));
    if (sign.name_da) stage.appendChild(el('div', 'learn-danish', `${t().danish}: ${sign.name_da}`));
    if (explanation(sign)) stage.appendChild(el('p', 'learn-meaning', explanation(sign)));

    const actions = el('div', 'learn-actions');
    const knew = el('button', 'btn-primary', t().knew);
    knew.type = 'button';
    knew.addEventListener('click', () => {
      state.right += 1;
      grade(sign.code, true);
      advance();
    });
    const again = el('button', 'btn-ghost', t().again);
    again.type = 'button';
    again.addEventListener('click', () => {
      state.missed.push(sign);
      grade(sign.code, false);
      advance();
    });
    actions.append(knew, again);
    stage.appendChild(actions);
  }

  function renderNameQuiz(sign) {
    stage.appendChild(signArt(sign, state.answered));
    stage.appendChild(el('div', 'learn-prompt', t().askName));

    const list = el('div', 'learn-options');
    const feedback = el('div', 'learn-feedback');
    const buttons = [];

    buildOptions(sign).forEach((option, index) => {
      const button = el('button', 'learn-option');
      button.type = 'button';
      button.dataset.code = option.code;
      button.append(optionKey(index), el('span', null, label(option)));
      button.addEventListener('click', () => {
        if (state.answered) return;
        finishAnswer(sign, option, buttons, feedback);
      });
      buttons.push(button);
      list.appendChild(button);
    });

    stage.append(list, feedback);
    if (state.answered && state.chosen) showAnswer(sign, state.chosen, buttons, feedback);
  }

  function renderImageQuiz(sign) {
    stage.appendChild(el('div', 'learn-prompt', t().askImage));
    stage.appendChild(el('p', 'learn-question', explanation(sign) || label(sign)));

    const grid = el('div', 'learn-images');
    const feedback = el('div', 'learn-feedback');
    const buttons = [];

    buildOptions(sign).forEach((option, index) => {
      const button = el('button', 'image-option');
      button.type = 'button';
      button.dataset.code = option.code;
      const img = document.createElement('img');
      img.src = option.image;
      img.alt = `Option ${index + 1}`;
      button.append(optionKey(index), img);
      button.addEventListener('click', () => {
        if (state.answered) return;
        finishAnswer(sign, option, buttons, feedback);
      });
      buttons.push(button);
      grid.appendChild(button);
    });

    stage.append(grid, feedback);
    if (state.answered && state.chosen) showAnswer(sign, state.chosen, buttons, feedback);
  }

  function renderSummary() {
    const total = state.deck.length;
    stage.appendChild(el('div', 'summary-score', `${state.right}/${total}`));
    stage.appendChild(el('div', 'summary-line', t().summary));

    const missed = state.missed.filter(
      (sign, index, list) => list.findIndex((other) => other.code === sign.code) === index,
    );

    if (missed.length) {
      stage.appendChild(el('div', 'learn-prompt', t().missed));
      const grid = el('div', 'summary-grid');
      missed.forEach((sign) => {
        const link = document.createElement('a');
        link.className = 'summary-item';
        link.href = `/signs/${sign.code}`;
        const img = document.createElement('img');
        img.src = sign.image;
        img.alt = label(sign);
        link.append(img, el('span', null, `${sign.code} · ${label(sign)}`));
        grid.appendChild(link);
      });
      stage.appendChild(grid);
    }

    const actions = el('div', 'learn-actions');
    if (missed.length) {
      const again = el('button', 'btn-primary', t().practiseMissed);
      again.type = 'button';
      again.addEventListener('click', () => startSession(missed));
      actions.appendChild(again);
    }
    const fresh = el('button', missed.length ? 'btn-ghost' : 'btn-primary', t().newRound);
    fresh.type = 'button';
    fresh.addEventListener('click', () => startSession());
    const browse = document.createElement('a');
    browse.className = 'btn-ghost';
    browse.href = '/signs';
    browse.textContent = t().browse;
    actions.append(fresh, browse);
    stage.appendChild(actions);
  }

  function renderStats() {
    const scope = inScope();
    const learned = scope.filter((sign) => box(sign.code) >= LEARNED_AT).length;
    const review = scope.filter((sign) => {
      const entry = state.progress[sign.code];
      return entry && entry.box < LEARNED_AT;
    }).length;
    document.getElementById('learnStats').innerHTML = t().stats(learned, review, scope.length);

    const asked = state.finished ? state.deck.length : state.position + (state.answered ? 1 : 0);
    document.getElementById('sessionCounter').textContent = state.finished
      ? ''
      : t().counter(Math.min(state.position + 1, state.deck.length), state.deck.length);
    document.getElementById('sessionScore').textContent = t().score(state.right, asked);
    document.getElementById('sessionBar').style.width = state.deck.length
      ? `${(asked / state.deck.length) * 100}%`
      : '0%';

    document.querySelectorAll('.learn-chip').forEach((chip) => {
      const group = chip.dataset.group;
      const signs = group === 'all' ? state.signs : state.signs.filter((sign) => sign.group === group);
      const done = signs.filter((sign) => box(sign.code) >= LEARNED_AT).length;
      const meter = chip.querySelector('[data-meter]');
      if (meter) meter.style.width = signs.length ? `${(done / signs.length) * 100}%` : '0%';
      const labelNode = chip.querySelector('[data-chip-label]');
      if (labelNode) {
        labelNode.textContent =
          group === 'all' ? t().all : `${group} · ${t().groups[group] || group}`;
      }
    });
  }

  function renderChrome() {
    document.getElementById('learnTitle').textContent = t().title;
    document.getElementById('modeCards').textContent = t().modes.cards;
    document.getElementById('modeName').textContent = t().modes.name;
    document.getElementById('modeImage').textContent = t().modes.image;
    document.getElementById('learnReset').textContent = t().reset;
    document.getElementById('learnHint').textContent = t().hint;
    document.getElementById('keysHint').textContent = t().keys;
    document.querySelectorAll('.lang-btn').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.lang === state.lang);
    });
  }

  function render() {
    renderChrome();
    stage.innerHTML = '';

    if (!state.deck.length) {
      stage.appendChild(el('p', 'learn-meaning', t().empty));
      renderStats();
      return;
    }
    if (state.finished) {
      renderSummary();
      renderStats();
      return;
    }

    const sign = current();
    if (state.mode === 'cards') renderCard(sign);
    else if (state.mode === 'name') renderNameQuiz(sign);
    else renderImageQuiz(sign);
    renderStats();
  }

  function advance() {
    state.position += 1;
    state.revealed = false;
    state.answered = false;
    state.chosen = null;
    if (state.position >= state.deck.length) state.finished = true;
    render();
  }

  document.querySelectorAll('.mode-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.mode = button.dataset.mode;
      document.querySelectorAll('.mode-btn').forEach((item) => {
        item.classList.toggle('is-active', item === button);
      });
      startSession();
    });
  });

  document.querySelectorAll('.lang-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.lang = button.dataset.lang === 'ru' ? 'ru' : 'en';
      save();
      render();
    });
  });

  document.getElementById('learnChips')?.addEventListener('click', (event) => {
    const chip = event.target.closest('.learn-chip');
    if (!chip) return;
    state.group = chip.dataset.group;
    document.querySelectorAll('.learn-chip').forEach((item) => {
      item.classList.toggle('is-active', item === chip);
    });
    startSession();
  });

  document.getElementById('learnReset')?.addEventListener('click', () => {
    state.progress = {};
    try {
      localStorage.removeItem(LEGACY_KNOWN);
      localStorage.removeItem(LEGACY_HARD);
    } catch (e) {
      // nothing to clean up
    }
    save();
    startSession();
  });

  document.addEventListener('keydown', (event) => {
    if (event.target instanceof Element && event.target.matches('input, textarea, select')) return;
    if (event.key >= '1' && event.key <= '4' && !state.answered) {
      const options = stage.querySelectorAll('.learn-option, .image-option');
      const option = options[Number(event.key) - 1];
      if (option) {
        event.preventDefault();
        option.click();
      }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      const button = document.getElementById('nextBtn') || document.getElementById('revealBtn');
      if (button) {
        event.preventDefault();
        button.click();
      }
    }
  });

  fetch('/api/signs')
    .then((response) => response.json())
    .then((data) => {
      state.signs = data.signs || [];
      const startChip = document.querySelector(`.learn-chip[data-group="${state.group}"]`);
      if (startChip) {
        document.querySelectorAll('.learn-chip').forEach((item) => {
          item.classList.toggle('is-active', item === startChip);
        });
      } else {
        state.group = 'all';
      }
      startSession();
    })
    .catch(() => {
      stage.innerHTML = '';
      stage.appendChild(el('p', 'learn-meaning', t().failed));
    });
})();
