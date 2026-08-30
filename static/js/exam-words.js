/* Exam Words: a workspace, not a slideshow.
   The dictionary itself lives in exam-words-data.js.

   Left: the word you are working on. Right: the whole set, live, so you can see
   where you are and jump to any word. No intro screen, no tabs, no mode
   switching - the session starts as soon as the page opens, and the keyboard
   carries the loop (space to reveal, 1 knew it, 2 repeat, 1-4 for the quiz). */

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
  state.filter = state.settings.filter || 'all';

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
    state.settings.filter = state.filter;
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

  // ── DOM helpers ────────────────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function speakButton(text, lang) {
    const button = el('button', 'ew-speak', '🔊');
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
  // Weakest first: missed words, then unseen, then the rest. Every third word is
  // asked as multiple choice so you have to recall it, not just recognise it.
  function buildQueue() {
    const terms = scopeTerms();
    const hard = shuffle(terms.filter((item) => statusOf(item) === 'hard'));
    const fresh = shuffle(terms.filter((item) => statusOf(item) === 'new'));
    const known = shuffle(terms.filter((item) => statusOf(item) === 'known'));
    return [...hard, ...fresh, ...known].slice(0, SESSION_SIZE);
  }

  function startSession(firstItem) {
    let queue = buildQueue();
    if (firstItem) {
      queue = [firstItem, ...queue.filter((item) => item.id !== firstItem.id)].slice(0, SESSION_SIZE);
    }
    state.session = { queue, index: 0, revealed: false, answered: null, right: 0, missed: [] };
    render();
  }

  function sessionItem() {
    const session = state.session;
    if (!session || session.index >= session.queue.length) return null;
    return session.queue[session.index];
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

  // ── The stage (left) ───────────────────────────────────────────────────────
  function renderStage(root) {
    const session = state.session;
    if (!session) return;

    if (session.index >= session.queue.length) {
      const done = el('div', 'ew-done');
      done.appendChild(el('div', 'ew-done-score', `${session.right}/${session.queue.length}`));
      done.appendChild(el('p', 'ew-done-copy', session.missed.length
        ? 'The words you missed lead the next round.'
        : 'Clean round. Next one brings words you have not seen yet.'));

      if (session.missed.length) {
        const list = el('div', 'ew-done-list');
        session.missed.forEach((item) => {
          const row = el('button', 'ew-done-row');
          row.type = 'button';
          row.append(el('b', null, item.en), el('span', null, item.ru));
          row.addEventListener('click', () => startSession(item));
          list.appendChild(row);
        });
        done.appendChild(list);
      }

      const again = el('button', 'ew-btn ew-btn-primary', 'Next ten words');
      again.type = 'button';
      again.addEventListener('click', () => startSession());
      done.appendChild(again);
      root.appendChild(done);
      return;
    }

    const item = sessionItem();

    const meta = el('div', 'ew-stage-meta');
    meta.append(
      el('span', 'ew-stage-count', `Word ${session.index + 1} of ${session.queue.length}`),
      el('span', 'ew-stage-cat', item.categoryLabel),
    );
    root.appendChild(meta);

    const track = el('div', 'ew-track');
    session.queue.forEach((_, index) => {
      const dot = el('span', 'ew-track-dot');
      if (index < session.index) dot.classList.add('is-done');
      if (index === session.index) dot.classList.add('is-current');
      track.appendChild(dot);
    });
    root.appendChild(track);

    const card = el('div', 'ew-card');

    if (isQuizStep(session.index)) {
      card.appendChild(el('div', 'ew-ask', 'Which meaning is right?'));
      const phrase = el('div', 'ew-term');
      phrase.append(el('span', null, item.en), speakButton(item.en, 'en'));
      card.appendChild(phrase);

      const options = el('div', 'ew-options');
      const buttons = [];
      quizOptions(item).forEach((option, index) => {
        const button = el('button', 'ew-option');
        button.type = 'button';
        button.append(el('span', 'ew-option-key', String(index + 1)), el('span', null, option.ru));
        button.addEventListener('click', () => {
          if (session.answered) return;
          session.answered = option.id;
          const right = option.id === item.id;
          buttons.forEach((entry) => {
            entry.button.disabled = true;
            if (entry.option.id === item.id) entry.button.classList.add('is-right');
            else if (entry.option.id === option.id) entry.button.classList.add('is-wrong');
          });
          const verdict = el('div', `ew-verdict ${right ? 'is-right' : 'is-wrong'}`);
          verdict.append(
            el('b', null, right ? 'Correct' : 'Not this one'),
            el('span', null, right ? item.dk : `${item.en} — ${item.ru}`),
          );
          card.appendChild(verdict);
          const next = el('button', 'ew-btn ew-btn-primary', 'Next word  ⏎');
          next.type = 'button';
          next.dataset.role = 'next';
          next.addEventListener('click', () => advance(right, item));
          card.appendChild(el('div', 'ew-actions')).appendChild(next);
          next.focus();
        });
        buttons.push({ button, option });
        options.appendChild(button);
      });
      card.appendChild(options);
      root.appendChild(card);
      return;
    }

    card.appendChild(el('div', 'ew-ask', 'What does this mean?'));
    const phrase = el('div', 'ew-term');
    phrase.append(el('span', null, item.en), speakButton(item.en, 'en'));
    card.appendChild(phrase);

    if (!session.revealed) {
      card.classList.add('is-clickable');
      card.title = 'Click or press space to reveal';
      card.addEventListener('click', () => {
        session.revealed = true;
        render();
      });
      const hint = el('button', 'ew-btn ew-btn-primary', 'Show the meaning  ␣');
      hint.type = 'button';
      hint.dataset.role = 'reveal';
      card.appendChild(el('div', 'ew-actions')).appendChild(hint);
      root.appendChild(card);
      return;
    }

    card.appendChild(el('div', 'ew-meaning', item.ru));
    const danish = el('div', 'ew-danish');
    danish.append(el('span', 'ew-danish-label', 'Dansk'), el('span', null, item.dk), speakButton(item.dk, 'da'));
    card.appendChild(danish);

    const actions = el('div', 'ew-actions');
    const knew = el('button', 'ew-btn ew-btn-primary', 'I knew it  1');
    knew.type = 'button';
    knew.dataset.role = 'knew';
    knew.addEventListener('click', () => advance(true, item));
    const repeat = el('button', 'ew-btn', 'Repeat later  2');
    repeat.type = 'button';
    repeat.dataset.role = 'repeat';
    repeat.addEventListener('click', () => advance(false, item));
    actions.append(knew, repeat);
    card.appendChild(actions);
    root.appendChild(card);
  }

  // ── The word list (right) ──────────────────────────────────────────────────
  function matches(item, query) {
    if (!query) return true;
    const haystack = `${item.en} ${item.ru} ${item.dk}`.toLowerCase();
    return query.split(/\s+/).every((token) => haystack.includes(token));
  }

  function passesFilter(item) {
    if (state.filter === 'all') return true;
    if (state.filter === 'new') return statusOf(item) === 'new';
    return statusOf(item) === state.filter;
  }

  function renderSideFilters() {
    const wrap = $('#ew-side-filters');
    if (!wrap) return;
    const c = counts();
    const filters = [
      ['all', 'All', c.total],
      ['hard', 'To repeat', c.hard],
      ['new', 'Not started', c.fresh],
      ['known', 'Learned', c.known],
    ];
    wrap.innerHTML = '';
    filters.forEach(([key, label, count]) => {
      const chip = el('button', 'ew-chip' + (state.filter === key ? ' is-active' : ''));
      chip.type = 'button';
      chip.append(el('span', null, label), el('span', 'ew-chip-count', String(count)));
      chip.addEventListener('click', () => {
        state.filter = key;
        saveSettings();
        render();
      });
      wrap.appendChild(chip);
    });
  }

  function renderList(root) {
    const query = state.query.trim().toLowerCase();
    const current = sessionItem();
    const items = scopeTerms().filter((item) => passesFilter(item) && matches(item, query));

    root.innerHTML = '';
    if (!items.length) {
      root.appendChild(el('p', 'ew-empty', query ? 'Nothing matches that.' : 'Nothing here yet.'));
      return;
    }

    let lastCategory = null;
    items.forEach((item) => {
      if (item.category !== lastCategory) {
        lastCategory = item.category;
        root.appendChild(el('div', 'ew-list-head', item.categoryLabel));
      }

      const row = el('button', `ew-list-row is-${statusOf(item)}`);
      row.type = 'button';
      if (current && current.id === item.id) row.classList.add('is-current');
      const body = el('span', 'ew-list-body');
      body.append(el('span', 'ew-list-term', item.en), el('span', 'ew-list-ru', item.ru));
      row.append(body, el('span', 'ew-list-dot'));
      row.addEventListener('click', () => startSession(item));
      root.appendChild(row);
    });
  }

  // ── Header ─────────────────────────────────────────────────────────────────
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

    $('#ew-bar-known').style.width = c.total ? `${(c.known / c.total) * 100}%` : '0%';
    $('#ew-bar-hard').style.width = c.total ? `${(c.hard / c.total) * 100}%` : '0%';
    $('#ew-legend').innerHTML = `<b>${c.known}</b> learned &middot; <b>${c.hard}</b> to repeat &middot; ${c.total} in set`;
  }

  function render() {
    renderHeader();
    renderSideFilters();
    const stage = $('#ew-body');
    stage.innerHTML = '';
    renderStage(stage);
    renderList($('#ew-side-list'));
  }

  // ── Keyboard: the loop should not need the mouse ───────────────────────────
  document.addEventListener('keydown', (event) => {
    if (event.target instanceof Element && event.target.matches('input, textarea, select')) return;
    const session = state.session;
    if (!session) return;

    const press = (role) => {
      const button = document.querySelector(`#ew-body [data-role="${role}"]`);
      if (button) {
        event.preventDefault();
        button.click();
      }
    };

    if (event.key === ' ' || event.key === 'Enter') {
      press('next');
      press('reveal');
      return;
    }
    if (event.key === '1') {
      const options = document.querySelectorAll('#ew-body .ew-option:not([disabled])');
      if (options.length) {
        event.preventDefault();
        options[0].click();
        return;
      }
      press('knew');
      return;
    }
    if (event.key === '2') {
      const options = document.querySelectorAll('#ew-body .ew-option:not([disabled])');
      if (options.length) {
        event.preventDefault();
        options[1]?.click();
        return;
      }
      press('repeat');
      return;
    }
    if (event.key === '3' || event.key === '4') {
      const options = document.querySelectorAll('#ew-body .ew-option:not([disabled])');
      const option = options[Number(event.key) - 1];
      if (option) {
        event.preventDefault();
        option.click();
      }
    }
  });

  // ── Wiring ─────────────────────────────────────────────────────────────────
  document.querySelectorAll('.ew-scope').forEach((button) => {
    button.addEventListener('click', () => {
      state.scope = button.dataset.scope;
      saveSettings();
      startSession();
    });
  });

  $('#ew-search')?.addEventListener('input', (event) => {
    state.query = event.target.value;
    renderList($('#ew-side-list'));
  });

  $('#ew-reset')?.addEventListener('click', () => {
    if (!window.confirm('Reset what you have learned in Exam Words?')) return;
    state.progress = {};
    state.streaks = {};
    saveProgress();
    startSession();
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

  startSession();
  pullProgress();
})();
