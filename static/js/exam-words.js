/* Exam Words: one study loop and one dictionary.
   The dictionary itself lives in exam-words-data.js.

   The page used to be three parallel toys - a list, a card stack and a quiz -
   each with its own filters, and nothing that felt like studying. Now there is
   a session: ten words at a time, weakest first, recall then check, with the
   dictionary as the second tab for looking things up. */

(function () {
  'use strict';

  const modeNode = document.getElementById('exam-words-mode');
  const DEMO_MODE = modeNode?.dataset.examWordsDemo === '1';
  const SESSION_SIZE = 10;
  const LEARNED_STREAK = 2; // right answers in a row before a word counts as learned

  // ── Data preparation ───────────────────────────────────────────────────────
  if (DEMO_MODE) {
    // A demo that opens on brake linings sells nothing. Exam wording first.
    const limits = { wording: 12, general: 10, reform2026: 6, motorcycle: 3, trailer: 3, heavy: 3 };
    Object.entries(DICTIONARY).forEach(([key, cat]) => {
      const limit = limits[key] || 4;
      const examFirst = cat.items.filter((item) => itemScope(item, key) === 'exam');
      cat.items = (examFirst.length >= limit ? examFirst : cat.items).slice(0, limit);
    });
  }

  function termId(item) {
    return item.dk.replace(/[^a-zA-Z0-9æøåÆØÅ]/g, '').toLowerCase();
  }

  const ALL_TERMS = [];
  Object.entries(DICTIONARY).forEach(([key, cat]) => {
    cat.key = key;
    cat.items.forEach((item) => {
      item.id = termId(item);
      item.scope = itemScope(item, key);
      item.category = key;
      item.categoryLabel = cat.title_en;
      ALL_TERMS.push(item);
    });
  });

  // ── Storage ────────────────────────────────────────────────────────────────
  const SCOPE_KEY = DEMO_MODE ? 'demo' : 'full';
  const PROGRESS_KEY = `wex-exam-words-2026-${SCOPE_KEY}-progress-v1`; // { id: 'known' | 'hard' }
  const STREAK_KEY = `wex-exam-words-2026-${SCOPE_KEY}-streaks-v1`;    // { id: rightInARow }
  const SETTINGS_KEY = `wex-exam-words-2026-${SCOPE_KEY}-settings-v1`;
  const SERVER_SYNC = !DEMO_MODE;

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // private mode: this visit still works, it is simply not remembered
    }
  }

  const state = {
    progress: readJson(PROGRESS_KEY, {}),
    streaks: readJson(STREAK_KEY, {}),
    settings: readJson(SETTINGS_KEY, {}),
    session: null,
    query: '',
  };

  state.scope = state.settings.scope || 'exam';
  state.tab = state.settings.tab || 'study';
  state.dictCategory = state.settings.dictCategory || 'all';

  let syncTimer = null;

  function saveProgress() {
    writeJson(PROGRESS_KEY, state.progress);
    writeJson(STREAK_KEY, state.streaks);
    if (!SERVER_SYNC) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(pushProgress, 500);
  }

  function saveSettings() {
    state.settings.scope = state.scope;
    state.settings.tab = state.tab;
    state.settings.dictCategory = state.dictCategory;
    writeJson(SETTINGS_KEY, state.settings);
  }

  async function pushProgress() {
    try {
      await fetch('/api/exam-words/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ progress: state.progress }),
      });
    } catch (e) {
      // offline: localStorage still holds it, the next change tries again
    }
  }

  async function pullProgress() {
    if (!SERVER_SYNC) return;
    try {
      const response = await fetch('/api/exam-words/progress', { credentials: 'same-origin' });
      if (!response.ok) return;
      const data = await response.json();
      if (!data || !data.progress) return;
      // The account is the source of truth; local additions are kept.
      state.progress = Object.assign({}, state.progress, data.progress);
      writeJson(PROGRESS_KEY, state.progress);
      render();
    } catch (e) {
      // no server progress today
    }
  }

  // ── Word helpers ───────────────────────────────────────────────────────────
  function inScope(item) {
    if (state.scope === 'all') return true;
    if (state.scope === 'car') return item.scope !== 'other';
    return item.scope === 'exam';
  }

  function statusOf(item) {
    return state.progress[item.id] || 'new';
  }

  function scopeTerms() {
    return ALL_TERMS.filter(inScope);
  }

  function counts() {
    const terms = scopeTerms();
    const known = terms.filter((item) => statusOf(item) === 'known').length;
    const hard = terms.filter((item) => statusOf(item) === 'hard').length;
    return { total: terms.length, known, hard, fresh: terms.length - known - hard };
  }

  function grade(item, right) {
    const streak = right ? (state.streaks[item.id] || 0) + 1 : 0;
    state.streaks[item.id] = streak;
    if (right && streak >= LEARNED_STREAK) state.progress[item.id] = 'known';
    else if (right) delete state.progress[item.id];
    else state.progress[item.id] = 'hard';
    saveProgress();
  }

  function setStatus(item, status) {
    if (status === 'new') {
      delete state.progress[item.id];
      delete state.streaks[item.id];
    } else {
      state.progress[item.id] = status;
      state.streaks[item.id] = status === 'known' ? LEARNED_STREAK : 0;
    }
    saveProgress();
  }

  // ── Speech ─────────────────────────────────────────────────────────────────
  const speech = { supported: 'speechSynthesis' in window, voices: [] };

  function loadVoices() {
    if (!speech.supported) return;
    speech.voices = window.speechSynthesis.getVoices() || [];
  }

  function voiceFor(lang) {
    const wanted = lang === 'da' ? 'da' : 'en';
    return speech.voices.find((voice) => voice.lang && voice.lang.toLowerCase().startsWith(wanted)) || null;
  }

  function say(text, lang) {
    if (!speech.supported || !text) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = voiceFor(lang);
      if (voice) utterance.voice = voice;
      utterance.lang = voice ? voice.lang : (lang === 'da' ? 'da-DK' : 'en-GB');
      utterance.rate = 0.92;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      // some browsers refuse without a user gesture; the button click is one
    }
  }

  // ── Small DOM helpers ──────────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function speakButton(text, lang, label) {
    const button = el('button', 'ew-speak', label);
    button.type = 'button';
    button.title = lang === 'da' ? 'Listen in Danish' : 'Listen in English';
    button.setAttribute('aria-label', button.title);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      say(text, lang);
    });
    return button;
  }

  function shuffle(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // ── Session ────────────────────────────────────────────────────────────────
  // Weakest first: words you got wrong, then ones you have never seen, then the
  // rest. Every third item is asked as a quiz so you have to recall, not just
  // nod along to a card.
  function startSession() {
    const terms = scopeTerms();
    const hard = shuffle(terms.filter((item) => statusOf(item) === 'hard'));
    const fresh = shuffle(terms.filter((item) => statusOf(item) === 'new'));
    const known = shuffle(terms.filter((item) => statusOf(item) === 'known'));
    const queue = [...hard, ...fresh, ...known].slice(0, SESSION_SIZE);

    state.session = {
      queue,
      index: 0,
      revealed: false,
      answered: null,
      right: 0,
      missed: [],
    };
    render();
  }

  function sessionItem() {
    return state.session ? state.session.queue[state.session.index] : null;
  }

  function isQuizStep(index) {
    return index % 3 === 2;
  }

  function advance(right, item) {
    grade(item, right);
    const session = state.session;
    if (right) session.right += 1;
    else session.missed.push(item);
    session.index += 1;
    session.revealed = false;
    session.answered = null;
    render();
  }

  function quizOptions(item) {
    const pool = shuffle(scopeTerms().filter((other) => other.id !== item.id && other.ru !== item.ru));
    return shuffle([item, ...pool.slice(0, 3)]);
  }

  // ── Rendering: study ───────────────────────────────────────────────────────
  function renderStudy(root) {
    const session = state.session;

    if (!session) {
      const c = counts();
      const intro = el('div', 'ew-card ew-intro');
      intro.appendChild(el('div', 'ew-intro-kicker', 'Study session'));
      intro.appendChild(el('h2', 'ew-intro-title', `${SESSION_SIZE} words, weakest first`));
      intro.appendChild(el('p', 'ew-intro-copy',
        'You see the English as the test writes it, recall what it means, then check yourself. '
        + 'Words you miss come back sooner; two right answers in a row and a word counts as learned.'));

      const stats = el('div', 'ew-intro-stats');
      [[c.hard, 'to repeat'], [c.fresh, 'not started'], [c.known, 'learned']].forEach(([value, label]) => {
        const box = el('div', 'ew-intro-stat');
        box.append(el('b', null, String(value)), el('span', null, label));
        stats.appendChild(box);
      });
      intro.appendChild(stats);

      const start = el('button', 'ew-btn ew-btn-primary', c.total ? 'Start studying' : 'Nothing in this set');
      start.type = 'button';
      start.disabled = !c.total;
      start.addEventListener('click', startSession);
      intro.appendChild(start);
      root.appendChild(intro);
      return;
    }

    if (session.index >= session.queue.length) {
      const done = el('div', 'ew-card ew-summary');
      done.appendChild(el('div', 'ew-summary-score', `${session.right}/${session.queue.length}`));
      done.appendChild(el('p', 'ew-intro-copy', session.missed.length
        ? 'The ones you missed come first next round.'
        : 'Clean round. The next one brings words you have not seen yet.'));

      if (session.missed.length) {
        const list = el('div', 'ew-summary-list');
        session.missed.forEach((item) => {
          const row = el('div', 'ew-summary-row');
          row.append(el('b', null, item.en), el('span', null, item.ru));
          list.appendChild(row);
        });
        done.appendChild(list);
      }

      const again = el('button', 'ew-btn ew-btn-primary', 'Next ten');
      again.type = 'button';
      again.addEventListener('click', startSession);
      const browse = el('button', 'ew-btn', 'Open the dictionary');
      browse.type = 'button';
      browse.addEventListener('click', () => switchTab('dictionary'));
      const actions = el('div', 'ew-actions');
      actions.append(again, browse);
      done.appendChild(actions);
      root.appendChild(done);
      return;
    }

    const item = sessionItem();
    const card = el('div', 'ew-card ew-study');

    const progress = el('div', 'ew-dots');
    session.queue.forEach((_, index) => {
      const dot = el('span', 'ew-dot');
      if (index < session.index) dot.classList.add('is-done');
      if (index === session.index) dot.classList.add('is-current');
      progress.appendChild(dot);
    });
    card.appendChild(progress);

    if (isQuizStep(session.index)) {
      card.appendChild(el('div', 'ew-step-label', 'Choose the meaning'));
      const phrase = el('div', 'ew-term');
      phrase.append(el('span', null, item.en), speakButton(item.en, 'en', '🔊'));
      card.appendChild(phrase);

      const options = el('div', 'ew-options');
      const buttons = [];
      quizOptions(item).forEach((option) => {
        const button = el('button', 'ew-option', option.ru);
        button.type = 'button';
        button.addEventListener('click', () => {
          if (session.answered) return;
          session.answered = option.id;
          const right = option.id === item.id;
          buttons.forEach((entry) => {
            entry.button.disabled = true;
            if (entry.option.id === item.id) entry.button.classList.add('is-right');
            else if (entry.option.id === option.id) entry.button.classList.add('is-wrong');
          });
          const verdict = el('div', `ew-verdict ${right ? 'is-right' : 'is-wrong'}`,
            right ? 'Correct' : `It means: ${item.ru}`);
          card.appendChild(verdict);
          const next = el('button', 'ew-btn ew-btn-primary', 'Next word');
          next.type = 'button';
          next.addEventListener('click', () => advance(right, item));
          const wrap = el('div', 'ew-actions');
          wrap.appendChild(next);
          card.appendChild(wrap);
          next.focus();
        });
        buttons.push({ button, option });
        options.appendChild(button);
      });
      card.appendChild(options);
      root.appendChild(card);
      return;
    }

    card.appendChild(el('div', 'ew-step-label', 'What does this mean?'));
    const phrase = el('div', 'ew-term');
    phrase.append(el('span', null, item.en), speakButton(item.en, 'en', '🔊'));
    card.appendChild(phrase);

    if (!session.revealed) {
      const reveal = el('button', 'ew-btn ew-btn-primary', 'Show the meaning');
      reveal.type = 'button';
      reveal.addEventListener('click', () => {
        session.revealed = true;
        render();
      });
      const wrap = el('div', 'ew-actions');
      wrap.appendChild(reveal);
      card.appendChild(wrap);
      root.appendChild(card);
      return;
    }

    const meaning = el('div', 'ew-meaning', item.ru);
    const danish = el('div', 'ew-danish');
    danish.append(el('span', 'ew-danish-label', 'Dansk'), el('span', null, item.dk),
      speakButton(item.dk, 'da', '🔊'));
    const where = el('div', 'ew-where', item.categoryLabel);
    card.append(meaning, danish, where);

    const knew = el('button', 'ew-btn ew-btn-primary', 'I knew it');
    knew.type = 'button';
    knew.addEventListener('click', () => advance(true, item));
    const repeat = el('button', 'ew-btn', 'Repeat later');
    repeat.type = 'button';
    repeat.addEventListener('click', () => advance(false, item));
    const actions = el('div', 'ew-actions');
    actions.append(knew, repeat);
    card.appendChild(actions);
    root.appendChild(card);
  }

  // ── Rendering: dictionary ──────────────────────────────────────────────────
  function matches(item, query) {
    if (!query) return true;
    const haystack = `${item.en} ${item.ru} ${item.dk}`.toLowerCase();
    return query.split(/\s+/).every((token) => haystack.includes(token));
  }

  function renderDictionary(root) {
    const query = state.query.trim().toLowerCase();

    const chips = el('div', 'ew-chips');
    const categories = Object.values(DICTIONARY)
      .map((cat) => [cat, cat.items.filter(inScope).length])
      .filter(([, count]) => count > 0);

    const allChip = el('button', 'ew-chip' + (state.dictCategory === 'all' ? ' is-active' : ''), 'All');
    allChip.type = 'button';
    allChip.addEventListener('click', () => {
      state.dictCategory = 'all';
      saveSettings();
      render();
    });
    chips.appendChild(allChip);

    categories.forEach(([cat, count]) => {
      const chip = el('button', 'ew-chip' + (state.dictCategory === cat.key ? ' is-active' : ''));
      chip.type = 'button';
      chip.append(el('span', null, cat.title_en), el('span', 'ew-chip-count', String(count)));
      chip.addEventListener('click', () => {
        state.dictCategory = cat.key;
        saveSettings();
        render();
      });
      chips.appendChild(chip);
    });
    root.appendChild(chips);

    let shown = 0;
    categories.forEach(([cat]) => {
      if (state.dictCategory !== 'all' && state.dictCategory !== cat.key) return;
      const items = cat.items.filter((item) => inScope(item) && matches(item, query));
      if (!items.length) return;
      shown += items.length;

      const group = el('section', 'ew-group');
      const head = el('div', 'ew-group-head');
      head.append(el('h2', 'ew-group-title', cat.title_en), el('span', 'ew-group-count', String(items.length)));
      group.appendChild(head);
      if (cat.title_ru) group.appendChild(el('div', 'ew-group-sub', `${cat.title} · ${cat.title_ru}`));

      items.forEach((item) => {
        const row = el('div', `ew-row is-${statusOf(item)}`);

        const main = el('div', 'ew-row-main');
        const term = el('div', 'ew-row-term');
        term.append(el('span', null, item.en), speakButton(item.en, 'en', '🔊'));
        const meaning = el('div', 'ew-row-meaning', item.ru);
        const danish = el('div', 'ew-row-danish');
        danish.append(el('span', 'ew-danish-label', 'DA'), el('span', null, item.dk),
          speakButton(item.dk, 'da', '🔊'));
        main.append(term, meaning, danish);

        const marks = el('div', 'ew-row-marks');
        const known = el('button', 'ew-mark' + (statusOf(item) === 'known' ? ' is-on' : ''), 'Learned');
        known.type = 'button';
        known.addEventListener('click', () => {
          setStatus(item, statusOf(item) === 'known' ? 'new' : 'known');
          render();
        });
        const hard = el('button', 'ew-mark' + (statusOf(item) === 'hard' ? ' is-on' : ''), 'Repeat');
        hard.type = 'button';
        hard.addEventListener('click', () => {
          setStatus(item, statusOf(item) === 'hard' ? 'new' : 'hard');
          render();
        });
        marks.append(known, hard);

        row.append(main, marks);
        group.appendChild(row);
      });

      root.appendChild(group);
    });

    if (!shown) {
      root.appendChild(el('p', 'ew-empty', query
        ? 'Nothing matches that word.'
        : 'This set is empty. Try a wider one above.'));
    }
  }

  // ── Chrome ─────────────────────────────────────────────────────────────────
  function renderHeader() {
    const c = counts();
    const scopeCounts = {
      exam: ALL_TERMS.filter((item) => item.scope === 'exam').length,
      car: ALL_TERMS.filter((item) => item.scope !== 'other').length,
      all: ALL_TERMS.length,
    };

    document.querySelectorAll('.ew-scope').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.scope === state.scope);
      const count = button.querySelector('.ew-scope-count');
      if (count) count.textContent = scopeCounts[button.dataset.scope];
    });

    document.querySelectorAll('.ew-tab').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.tab === state.tab);
    });

    const known = c.total ? (c.known / c.total) * 100 : 0;
    const hard = c.total ? (c.hard / c.total) * 100 : 0;
    $('#ew-bar-known').style.width = `${known}%`;
    $('#ew-bar-hard').style.width = `${hard}%`;
    $('#ew-legend').innerHTML =
      `<b>${c.total}</b> words in this set &middot; <b>${c.known}</b> learned &middot; `
      + `<b>${c.hard}</b> to repeat &middot; ${c.fresh} not started`;
  }

  function switchTab(tab) {
    state.tab = tab;
    saveSettings();
    render();
  }

  function render() {
    renderHeader();
    const root = $('#ew-body');
    root.innerHTML = '';
    root.className = `ew-body is-${state.tab}`;
    $('#ew-search-wrap').hidden = state.tab !== 'dictionary';
    if (state.tab === 'study') renderStudy(root);
    else renderDictionary(root);
  }

  // ── Wiring ─────────────────────────────────────────────────────────────────
  document.querySelectorAll('.ew-scope').forEach((button) => {
    button.addEventListener('click', () => {
      state.scope = button.dataset.scope;
      state.session = null;
      saveSettings();
      render();
    });
  });

  document.querySelectorAll('.ew-tab').forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });

  $('#ew-search')?.addEventListener('input', (event) => {
    state.query = event.target.value;
    render();
  });

  $('#ew-reset')?.addEventListener('click', () => {
    if (!window.confirm('Reset what you have learned in Exam Words?')) return;
    state.progress = {};
    state.streaks = {};
    state.session = null;
    saveProgress();
    render();
  });

  document.getElementById('examWordsBurgerBtn')?.addEventListener('click', () => {
    if (typeof sbOpen === 'function') sbOpen();
  });
  document.getElementById('ew-theme')?.addEventListener('click', () => {
    if (typeof toggleTheme === 'function') toggleTheme();
  });

  if (speech.supported) {
    loadVoices();
    if ('onvoiceschanged' in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  render();
  pullProgress();
})();
