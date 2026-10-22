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
  const accountScope = modeNode?.dataset.studyAccount;
  const SCOPE_KEY = (DEMO_MODE ? 'demo' : 'full') + (accountScope ? `-user-${accountScope}` : '');
  const PROGRESS_KEY = `wex-exam-words-2026-${SCOPE_KEY}-progress-v1`; // { id: 'known' | 'hard' }
  const STREAK_KEY = `wex-exam-words-2026-${SCOPE_KEY}-streaks-v1`;    // { id: rightInARow }
  const SETTINGS_KEY = `wex-exam-words-2026-${SCOPE_KEY}-settings-v1`;
  const SERVER_SYNC = !DEMO_MODE;
  const roundStore = window.WEXWordRoundStore;
  const guidedStudy = window.WEXStudy?.active('words');
  const ROUND_OWNER = `${SCOPE_KEY}:${guidedStudy ? 'study-' + guidedStudy.id : 'standalone'}`;
  const ROUND_KEY = `wexWordRound:v1:${ROUND_OWNER}`;
  const roundContext = { owner: ROUND_OWNER, terms: ALL_TERMS, revision: roundStore.revision(ALL_TERMS), guided: Boolean(guidedStudy) };
  function browserStorage() { try { return window.localStorage; } catch (_) { return null; } }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      const value = raw ? JSON.parse(raw) : fallback;
      return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
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

  state.scope = roundStore.SCOPES.includes(state.settings.scope) ? state.settings.scope : 'exam';
  state.mode = roundStore.MODES.includes(state.settings.mode) ? state.settings.mode : 'mixed';
  state.filter = ['all', 'new', 'hard', 'known'].includes(state.settings.filter) ? state.settings.filter : 'all';
  if (guidedStudy) { state.scope = 'exam'; state.mode = 'quiz'; state.filter = 'all'; }
  let roundRestored = false;
  let roundSaved = false;

  let syncTimer = null;
  let progressDirty = false;

  function saveProgress() {
    writeJson(PROGRESS_KEY, state.progress);
    writeJson(STREAK_KEY, state.streaks);
    if (!SERVER_SYNC) return;
    progressDirty = true;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(pushProgress, 500);
  }

  function saveSettings() {
    state.settings.scope = state.scope;
    state.settings.mode = state.mode;
    state.settings.filter = state.filter;
    writeJson(SETTINGS_KEY, state.settings);
  }

  async function pushProgress(keepalive = false) {
    const snapshot = JSON.stringify(state.progress);
    try {
      const response = await fetch('/api/exam-words/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ progress: state.progress }),
        keepalive,
      });
      if(response.ok && JSON.stringify(state.progress) === snapshot)progressDirty=false;
    } catch (e) {
      // offline: localStorage still holds it, the next change tries again
    }
  }

  window.addEventListener('pagehide',()=>{if(SERVER_SYNC&&progressDirty){clearTimeout(syncTimer);pushProgress(true);}});

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

  // Reading Danish with an English voice is worse than silence: it teaches the
  // wrong sound. So we look for a real voice of that language and, if there is
  // none, we do not offer the button at all.
  function voiceFor(lang) {
    const exact = lang === 'da' ? 'da-dk' : 'en-gb';
    const prefix = lang === 'da' ? 'da' : 'en';
    const candidates = speech.voices.filter(
      (voice) => voice.lang && voice.lang.toLowerCase().replace('_', '-').startsWith(prefix),
    );
    if (!candidates.length) return null;
    const score = (voice) => {
      const code = voice.lang.toLowerCase().replace('_', '-');
      let value = 0;
      if (code === exact) value += 4;
      if (voice.localService) value += 2; // installed voices beat network ones
      if (voice.default) value += 1;
      return value;
    };
    return candidates.slice().sort((a, b) => score(b) - score(a))[0];
  }

  function canSpeak(lang) {
    return speech.supported && Boolean(voiceFor(lang));
  }

  function say(text, lang) {
    if (!speech.supported || !text) return;
    const voice = voiceFor(lang);
    if (!voice) return; // no voice for this language: stay quiet rather than fake it
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
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

  const SPEAKER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
    + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>'
    + '<path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';

  function speakButton(text, lang) {
    if (!canSpeak(lang)) return document.createComment(`no ${lang} voice installed`);
    const button = el('button', 'ew-speak');
    button.innerHTML = SPEAKER_SVG;
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

  // A phrase means nothing alone; it means something in a sentence from a real
  // question. exam-words-examples.js pairs them with the Russian that ships
  // with that question, so the example is honest rather than invented.
  function exampleFor(item) {
    if (typeof EXAM_WORD_EXAMPLES === 'undefined') return null;
    return EXAM_WORD_EXAMPLES[item.id] || null;
  }

  function exampleBlock(item) {
    const example = exampleFor(item);
    if (!example) return null;
    const box = el('div', 'ew-example');
    const label = el('div', 'ew-example-label', 'From a question in this library');
    const english = el('div', 'ew-example-en');
    // Highlight the phrase itself so the eye finds it in the sentence.
    const escaped = example.match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(${escaped})`, 'i');
    const parts = example.en.split(pattern);
    parts.forEach((part, index) => {
      if (index % 2 === 1) english.appendChild(el('mark', null, part));
      else english.appendChild(document.createTextNode(part));
    });
    box.append(label, english);
    if (example.ru) box.appendChild(el('div', 'ew-example-ru', example.ru));
    return box;
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
    state.session = { queue, index: 0, revealed: false, answered: null, right: 0, missed: [],
      answers: [], options: [], startedAt: Date.now(), audioPlayed: false };
    roundRestored = false;
    render();
  }

  function saveRound() {
    const session = state.session;
    roundSaved = roundStore.write(browserStorage(), ROUND_KEY, {
      version: 1, owner: ROUND_OWNER, revision: roundContext.revision, startedAt: session.startedAt,
      mode: state.mode, scope: state.scope, queue: session.queue.map(item => item.id),
      answers: session.answers, revealed: session.revealed, answered: session.answered,
      options: session.options.map(item => item.id),
    });
  }

  function restoreRound() {
    const saved = roundStore.read(browserStorage(), ROUND_KEY, roundContext);
    if (!saved) return false;
    const terms = new Map(ALL_TERMS.map(item => [item.id, item]));
    state.mode = saved.mode;
    state.scope = saved.scope;
    const queue = saved.queue.map(id => terms.get(id));
    state.session = { queue, index: saved.answers.length, answers: saved.answers, revealed: saved.revealed,
      answered: saved.answered, options: saved.options.map(id => terms.get(id)), startedAt: saved.startedAt,
      right: saved.answers.filter(Boolean).length, missed: queue.filter((_, i) => saved.answers[i] === false),
      audioPlayed: true }; // Restoring a listening question must not start audio without a gesture.
    roundRestored = true;
    render();
    return true;
  }

  function sessionItem() {
    const session = state.session;
    if (!session || session.index >= session.queue.length) return null;
    return session.queue[session.index];
  }

  // What the current word asks of you. "mixed" alternates so a round has both
  // recognition and recall; the other modes do one thing all the way through.
  function stepKind(index) {
    return roundStore.kind(state.mode, index);
  }

  function advance(right, item) {
    const session = state.session;
    if (sessionItem() !== item) return; // Ignore a second activation of a detached Next button.
    grade(item, right);
    session.answers.push(right);
    if (right) session.right += 1;
    else session.missed.push(item);
    session.index += 1;
    session.revealed = false;
    session.answered = null;
    session.options = [];
    session.audioPlayed = false;
    render();
    focusStage();
  }

  function focusStage() {
    const target = $('#ew-body .ew-term') || $('#ew-body .ew-done-score');
    if (target) { target.tabIndex = -1; target.focus({preventScroll: true}); }
  }

  function quizOptions(item) {
    const label = option => state.mode === 'reverse' ? option.en : option.ru;
    const seen = new Set([label(item)]);
    const pool = shuffle(scopeTerms().filter(other => other.id !== item.id)).filter(other => {
      if (seen.has(label(other))) return false;
      seen.add(label(other));
      return true;
    });
    return shuffle([item, ...pool.slice(0, 3)]);
  }

  // ── The stage (left) ───────────────────────────────────────────────────────
  function renderStage(root) {
    const session = state.session;
    if (!session) return;

    if (session.index >= session.queue.length) {
      const done = el('div', 'ew-done');
      done.appendChild(el('p', 'ew-result-kind', state.mode === 'cards' ? 'Cards · self-assessed recall' : state.mode === 'mixed' ? 'Mixed · includes self-assessed recall' : 'Quiz · checked answers'));
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
          row.addEventListener('click', () => { startSession(item); focusStage(); $('#ew-body').scrollIntoView({block: 'start', behavior: 'instant'}); });
          list.appendChild(row);
        });
        done.appendChild(list);
      }

      const again = el('button', 'ew-btn ew-btn-primary', 'Next ten words');
      again.type = 'button';
      again.addEventListener('click', () => startSession());
      done.appendChild(again);
      window.WEXStudy?.returnLink(done,'words',session.right,session.queue.length,state.mode);
      root.appendChild(done);
      return;
    }

    const item = sessionItem();
    const kind = stepKind(session.index);

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

    const card = el('div', 'ew-stage-card');

    function finishWith(right, extra) {
      const verdict = el('div', `ew-verdict ${right ? 'is-right' : 'is-wrong'}`);
      verdict.setAttribute('role', 'status');
      verdict.append(el('b', null, right ? 'Correct' : 'Not this one'), el('span', null, extra));
      card.appendChild(verdict);
      const example = exampleBlock(item);
      if (example) card.appendChild(example);
      const next = el('button', 'ew-btn ew-btn-primary', 'Next word  ⏎');
      next.type = 'button';
      next.dataset.role = 'next';
      next.addEventListener('click', () => advance(right, item));
      const actions = el('div', 'ew-actions');
      actions.appendChild(next);
      card.appendChild(actions);
    }

    function askOptions(promptText, promptNode, optionText, answerHint) {
      card.appendChild(el('div', 'ew-ask', promptText));
      card.appendChild(promptNode);
      const options = el('div', 'ew-options');
      if (!session.options.length) session.options = quizOptions(item);
      session.options.forEach((option, index) => {
        const button = el('button', 'ew-option');
        button.type = 'button';
        button.append(el('span', 'ew-option-key', String(index + 1)), el('span', 'ew-option-meaning', optionText(option)));
        button.addEventListener('click', () => {
          if (session.answered) return;
          session.answered = option.id;
          render();
          $('#ew-body [data-role="next"]')?.focus();
        });
        if (session.answered) {
          button.disabled = true;
          const label = [option.id === session.answered ? 'Your answer' : '', option.id === item.id ? 'Correct meaning' : ''].filter(Boolean).join(' · ');
          if (label) button.appendChild(el('span', 'ew-option-state', label));
          if (option.id === item.id) button.classList.add('is-right');
          else if (option.id === session.answered) button.classList.add('is-wrong');
        }
        options.appendChild(button);
      });
      card.appendChild(options);
      if (session.answered) finishWith(session.answered === item.id, answerHint());
    }

    if (kind === 'quiz') {
      const phrase = el('div', 'ew-term');
      phrase.append(el('span', null, item.en), speakButton(item.en, 'en'));
      askOptions('Which meaning is right?', phrase, (option) => option.ru,
        () => `${item.en} — ${item.ru}`);
      root.appendChild(card);
      return;
    }

    if (kind === 'reverse') {
      const phrase = el('div', 'ew-term ew-term-ru');
      phrase.appendChild(el('span', null, item.ru));
      askOptions('Which English does the test use?', phrase, (option) => option.en,
        () => `${item.en} · ${item.dk}`);
      root.appendChild(card);
      return;
    }

    if (kind === 'listening') {
      card.appendChild(el('div', 'ew-ask', 'Listen and choose the meaning'));
      const play = el('button', 'ew-play');
      play.type = 'button';
      play.innerHTML = SPEAKER_SVG;
      play.append(el('span', null, 'Play again'));
      play.addEventListener('click', () => say(item.en, 'en'));
      const holder = el('div', 'ew-listen');
      holder.appendChild(play);
      if (!session.audioPlayed && !session.answered && canSpeak('en')) {
        say(item.en, 'en');
        session.audioPlayed = true;
      }
      if (!canSpeak('en')) {
        play.disabled = true;
        holder.append(el('p', 'ew-no-voice', 'No English voice is available on this device. Read the phrase instead:'),
          el('div', 'ew-term', item.en));
      }
      askOptions('', holder, (option) => option.ru, () => `${item.en} — ${item.ru}`);
      card.querySelector('.ew-ask:nth-of-type(2)')?.remove();
      root.appendChild(card);
      return;
    }

    // recall
    const phrase = el('div', 'ew-term');
    phrase.append(el('span', null, item.en), speakButton(item.en, 'en'));

    if (!session.revealed) {
      card.classList.add('is-clickable');
      card.title = 'Click or press space to reveal';
      card.addEventListener('click', () => {
        session.revealed = true;
        render();
        $('#ew-body [data-role="knew"]')?.focus({preventScroll: true});
      });
      card.appendChild(el('div', 'ew-ask', 'What does this mean?'));
      card.appendChild(phrase);
      const hint = el('button', 'ew-btn ew-btn-primary', 'Show the meaning  ␣');
      hint.type = 'button';
      hint.dataset.role = 'reveal';
      const actions = el('div', 'ew-actions');
      actions.appendChild(hint);
      card.appendChild(actions);
      root.appendChild(card);
      return;
    }

    card.appendChild(el('div', 'ew-ask', 'What does this mean?'));
    card.appendChild(phrase);
    card.appendChild(el('div', 'ew-meaning', item.ru));
    const danish = el('div', 'ew-danish');
    danish.append(el('span', 'ew-danish-label', 'Dansk'), el('span', null, item.dk), speakButton(item.dk, 'da'));
    if (speech.supported && !canSpeak('da')) {
      danish.appendChild(el('span', 'ew-no-voice', 'no Danish voice on this device'));
    }
    card.appendChild(danish);

    const example = exampleBlock(item);
    if (example) card.appendChild(example);

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
      chip.dataset.filter = key;
      chip.setAttribute('aria-pressed', String(state.filter === key));
      chip.append(el('span', null, label), el('span', 'ew-chip-count', String(count)));
      chip.addEventListener('click', () => {
        state.filter = key;
        saveSettings();
        render();
        $(`#ew-side-filters [data-filter="${key}"]`)?.focus({preventScroll: true});
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
      if (current && current.id === item.id) { row.classList.add('is-current'); row.setAttribute('aria-current', 'true'); }
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

    document.querySelectorAll('.ew-mode').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.mode === state.mode);
      button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode));
      button.hidden = button.dataset.mode === 'listening' && !canSpeak('en') && state.mode !== 'listening';
      button.disabled = Boolean(guidedStudy) && button.dataset.mode !== 'quiz';
    });

    document.querySelectorAll('.ew-scope').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.scope === state.scope);
      button.setAttribute('aria-pressed', String(button.dataset.scope === state.scope));
      button.disabled = Boolean(guidedStudy) && button.dataset.scope !== 'exam';
      const count = button.querySelector('.ew-scope-count');
      if (count) count.textContent = scopeCounts[button.dataset.scope];
    });

    const descriptions = {mixed: 'Mixed: recall a meaning, then check it in a quiz. Card answers are self-assessed.', cards: 'Cards: recall the meaning before revealing it, then assess your own answer.', quiz: 'Quiz: read the English phrase and choose its Russian meaning.', reverse: 'RU → EN: choose the English phrase for the Russian meaning.', listening: 'Listening: hear the English phrase and choose its Russian meaning.'};
    $('#ew-mode-description').textContent = descriptions[state.mode];
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
    saveRound();
    const notice = $('#ew-round-status');
    const text = !roundSaved ? 'Browser storage is unavailable. This round lasts for this visit.'
      : roundRestored ? 'Saved round restored. It stays in this browser for up to seven days.'
      : 'Your round stays in this browser for up to seven days.';
    if (notice && notice.textContent !== text) notice.textContent = text;
  }

  // ── Keyboard: the loop should not need the mouse ───────────────────────────
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey || window.WEXNavigation?.isOpen() || document.querySelector('.cookie-consent.show')) return;
    if (event.target instanceof Element) {
      if (event.target.closest('input, textarea, select, a, summary, [contenteditable="true"], [role="dialog"]')) return;
      const control = event.target.closest('button');
      if (control && !(control.closest('#ew-body') && /^[1-4]$/.test(event.key))) return;
    }
    const session = state.session;
    if (!session) return;

    const press = (role) => {
      const button = document.querySelector(`#ew-body [data-role="${role}"]`);
      if (button) {
        event.preventDefault();
        button.click();
        return true;
      }
      return false;
    };

    if (event.key === ' ' || event.key === 'Enter') {
      if (!press('next')) press('reveal');
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
      if (guidedStudy && button.dataset.scope !== 'exam') return;
      state.scope = button.dataset.scope;
      saveSettings();
      startSession();
    });
  });

  document.querySelectorAll('.ew-mode').forEach((button) => {
    button.addEventListener('click', () => {
      if (guidedStudy && button.dataset.mode !== 'quiz') return;
      if (button.dataset.mode === 'listening' && !canSpeak('en')) return;
      state.mode = button.dataset.mode;
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

  $('#ew-new-round')?.addEventListener('click', () => {
    if (!window.confirm('Start a new round? The saved round will be replaced. Learned words will stay.')) return;
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
      window.speechSynthesis.onvoiceschanged = () => {
        loadVoices();
        render();
      };
    }
  }

  if (!restoreRound()) startSession();
  pullProgress();
})();
