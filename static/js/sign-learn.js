(function () {
  document.getElementById('signsBurgerBtn')?.addEventListener('click', sbOpen);
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);

  const shell = document.getElementById('learnShell');
  const stage = document.getElementById('learnStage');
  const stats = document.getElementById('learnStats');
  const progressBar = document.getElementById('learnProgressBar');
  const chips = document.getElementById('learnChips');
  if (!shell || !stage) return;

  const KNOWN_KEY = 'wexSignsKnown';
  const HARD_KEY = 'wexSignsHard';

  const state = {
    signs: [],
    mode: 'cards',
    group: shell.dataset.group || 'all',
    deck: [],
    position: 0,
    revealed: false,
    answered: false,
    known: readSet(KNOWN_KEY),
    hard: readSet(HARD_KEY),
  };

  function readSet(key) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      return new Set(Array.isArray(raw) ? raw : []);
    } catch (e) {
      return new Set();
    }
  }

  function writeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify([...value]));
    } catch (e) {
      // private mode: this session still works, it just will not be remembered
    }
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

  // Signs you got wrong come first, then ones you have never seen, then the rest.
  function buildDeck() {
    const scope = inScope();
    const hard = shuffle(scope.filter((sign) => state.hard.has(sign.code)));
    const fresh = shuffle(scope.filter((sign) => !state.hard.has(sign.code) && !state.known.has(sign.code)));
    const known = shuffle(scope.filter((sign) => state.known.has(sign.code) && !state.hard.has(sign.code)));
    state.deck = [...hard, ...fresh, ...known];
    state.position = 0;
    state.revealed = false;
    state.answered = false;
  }

  function markKnown(code) {
    state.known.add(code);
    state.hard.delete(code);
    writeSet(KNOWN_KEY, state.known);
    writeSet(HARD_KEY, state.hard);
  }

  function markHard(code) {
    state.hard.add(code);
    state.known.delete(code);
    writeSet(KNOWN_KEY, state.known);
    writeSet(HARD_KEY, state.hard);
  }

  function renderStats() {
    const scope = inScope();
    const known = scope.filter((sign) => state.known.has(sign.code)).length;
    const hard = scope.filter((sign) => state.hard.has(sign.code)).length;
    stats.innerHTML = `<b>${known}</b> known &middot; <b>${hard}</b> to review &middot; ${scope.length} in scope`;
    const seen = Math.min(state.position, state.deck.length);
    progressBar.style.width = state.deck.length ? `${(seen / state.deck.length) * 100}%` : '0%';
  }

  function current() {
    return state.deck[state.position];
  }

  function renderDone() {
    const scope = inScope();
    const hard = scope.filter((sign) => state.hard.has(sign.code)).length;
    stage.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'learn-done';
    const title = document.createElement('div');
    title.className = 'learn-done-title';
    title.textContent = hard ? `Round finished - ${hard} still to review` : 'Round finished - nothing left to review';
    const copy = document.createElement('p');
    copy.className = 'learn-meaning';
    copy.textContent = hard
      ? 'Go again: the ones you missed come first this time.'
      : 'Pick another family, or try the same one again to keep it fresh.';
    const actions = document.createElement('div');
    actions.className = 'learn-actions';
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'btn-primary';
    again.textContent = 'Go again';
    again.addEventListener('click', () => {
      buildDeck();
      render();
    });
    const browse = document.createElement('a');
    browse.className = 'btn-ghost';
    browse.href = '/signs';
    browse.textContent = 'Browse the catalogue';
    actions.append(again, browse);
    wrap.append(title, copy, actions);
    stage.appendChild(wrap);
    renderStats();
  }

  function signArt(sign) {
    const art = document.createElement('div');
    art.className = 'learn-art';
    const img = document.createElement('img');
    img.src = sign.image;
    img.alt = state.revealed || state.answered ? `${sign.code}: ${sign.name}` : 'Road sign';
    art.appendChild(img);
    return art;
  }

  function renderCard() {
    const sign = current();
    if (!sign) return renderDone();

    stage.innerHTML = '';
    stage.appendChild(signArt(sign));

    if (state.revealed) {
      const code = document.createElement('div');
      code.className = 'learn-code';
      code.textContent = `${sign.code} - ${sign.group_label}`;
      const name = document.createElement('div');
      name.className = 'learn-name';
      name.textContent = sign.name;
      stage.append(code, name);
      if (sign.meaning) {
        const meaning = document.createElement('p');
        meaning.className = 'learn-meaning';
        meaning.textContent = sign.meaning;
        stage.appendChild(meaning);
      }
      const actions = document.createElement('div');
      actions.className = 'learn-actions';
      const knew = document.createElement('button');
      knew.type = 'button';
      knew.className = 'btn-primary';
      knew.textContent = 'I knew it';
      knew.addEventListener('click', () => {
        markKnown(sign.code);
        advance();
      });
      const again = document.createElement('button');
      again.type = 'button';
      again.className = 'btn-ghost';
      again.textContent = 'Show me again later';
      again.addEventListener('click', () => {
        markHard(sign.code);
        advance();
      });
      actions.append(knew, again);
      stage.appendChild(actions);
    } else {
      const prompt = document.createElement('p');
      prompt.className = 'learn-meaning';
      prompt.textContent = 'What does this sign mean?';
      const actions = document.createElement('div');
      actions.className = 'learn-actions';
      const reveal = document.createElement('button');
      reveal.type = 'button';
      reveal.className = 'btn-primary';
      reveal.textContent = 'Show the answer';
      reveal.addEventListener('click', () => {
        state.revealed = true;
        render();
      });
      actions.appendChild(reveal);
      stage.append(prompt, actions);
    }
    renderStats();
  }

  function optionsFor(sign) {
    const family = state.signs.filter((other) => other.group === sign.group && other.code !== sign.code);
    const pool = family.length >= 3 ? family : state.signs.filter((other) => other.code !== sign.code);
    return shuffle([sign, ...shuffle(pool).slice(0, 3)]);
  }

  function renderQuiz() {
    const sign = current();
    if (!sign) return renderDone();

    stage.innerHTML = '';
    stage.appendChild(signArt(sign));

    const list = document.createElement('div');
    list.className = 'learn-options';
    const feedback = document.createElement('div');
    feedback.className = 'learn-feedback';

    optionsFor(sign).forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'learn-option';
      button.textContent = option.name;
      button.addEventListener('click', () => {
        if (state.answered) return;
        state.answered = true;
        const right = option.code === sign.code;
        list.querySelectorAll('.learn-option').forEach((item) => {
          item.disabled = true;
          if (item.textContent === sign.name) item.classList.add('is-correct');
        });
        if (!right) button.classList.add('is-wrong');
        if (right) markKnown(sign.code);
        else markHard(sign.code);
        feedback.textContent = right
          ? `${sign.code}. ${sign.meaning || sign.name}`
          : `That was ${option.code}. This one is ${sign.code}: ${sign.meaning || sign.name}`;
        const next = document.createElement('div');
        next.className = 'learn-actions';
        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'btn-primary';
        nextBtn.textContent = 'Next sign';
        nextBtn.addEventListener('click', advance);
        next.appendChild(nextBtn);
        stage.appendChild(next);
        nextBtn.focus();
        renderStats();
      });
      list.appendChild(button);
    });

    stage.append(list, feedback);
    renderStats();
  }

  function advance() {
    state.position += 1;
    state.revealed = false;
    state.answered = false;
    render();
  }

  function render() {
    if (!state.deck.length) return renderDone();
    if (state.mode === 'cards') renderCard();
    else renderQuiz();
  }

  document.querySelectorAll('.mode-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.mode = button.dataset.mode;
      document.querySelectorAll('.mode-btn').forEach((item) => {
        item.classList.toggle('is-active', item === button);
      });
      buildDeck();
      render();
    });
  });

  chips?.addEventListener('click', (event) => {
    const chip = event.target.closest('.learn-chip');
    if (!chip) return;
    state.group = chip.dataset.group;
    chips.querySelectorAll('.learn-chip').forEach((item) => {
      item.classList.toggle('is-active', item === chip);
    });
    buildDeck();
    render();
  });

  document.getElementById('learnReset')?.addEventListener('click', () => {
    state.known = new Set();
    state.hard = new Set();
    writeSet(KNOWN_KEY, state.known);
    writeSet(HARD_KEY, state.hard);
    buildDeck();
    render();
  });

  fetch('/api/signs')
    .then((response) => response.json())
    .then((data) => {
      state.signs = data.signs || [];
      const startChip = chips?.querySelector(`.learn-chip[data-group="${state.group}"]`);
      if (startChip) {
        chips.querySelectorAll('.learn-chip').forEach((item) => {
          item.classList.toggle('is-active', item === startChip);
        });
      } else {
        state.group = 'all';
      }
      buildDeck();
      render();
    })
    .catch(() => {
      stage.innerHTML = '<p class="learn-meaning">Could not load the signs. Reload the page to try again.</p>';
    });
})();
