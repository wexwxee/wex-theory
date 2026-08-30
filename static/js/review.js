(function () {
  document.getElementById('reviewBurgerBtn')?.addEventListener('click', sbOpen);
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);

  const shell = document.getElementById('reviewShell');
  const stage = document.getElementById('reviewStage');
  const dots = document.getElementById('reviewDots');
  const source = document.getElementById('reviewSource');
  if (!shell || !stage) return;

  const RU_KEY = 'wexReviewRu';
  const state = {
    round: [], // { question, picked:Set, checked:bool, right:bool }
    position: 0,
    attempts: 0,
    pending: 0,
  };

  // ── Russian helper: on demand, the way the test does it ─────────────────────
  function setRu(on) {
    shell.classList.toggle('show-ru', on);
    document.querySelectorAll('.ru-toggle button').forEach((button) => {
      button.classList.toggle('is-active', (button.dataset.ru === 'on') === on);
    });
    try {
      localStorage.setItem(RU_KEY, on ? 'on' : 'off');
    } catch (e) {
      // private mode: the toggle still works for this visit
    }
  }

  try {
    setRu(localStorage.getItem(RU_KEY) === 'on');
  } catch (e) {
    setRu(false);
  }

  document.querySelectorAll('.ru-toggle button').forEach((button) => {
    button.addEventListener('click', () => setRu(button.dataset.ru === 'on'));
  });

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function current() {
    return state.round[state.position];
  }

  function scored() {
    return state.round.filter((item) => item.checked);
  }

  function renderProgress() {
    const total = state.round.length;
    const done = scored().length;
    const right = scored().filter((item) => item.right).length;
    document.getElementById('reviewCounter').textContent = total
      ? `Question ${Math.min(state.position + 1, total)} of ${total}`
      : '';
    document.getElementById('reviewScore').textContent = done ? `${right}/${done} correct` : '';
    document.getElementById('reviewBar').style.width = total ? `${(done / total) * 100}%` : '0%';

    if (!dots) return;
    dots.innerHTML = '';
    state.round.forEach((item, index) => {
      const dot = el('button', 'review-dot', String(index + 1));
      dot.type = 'button';
      if (index === state.position) dot.classList.add('is-current');
      if (item.checked) dot.classList.add(item.right ? 'is-right' : 'is-wrong');
      dot.setAttribute('aria-label', `Question ${index + 1}`);
      dot.addEventListener('click', () => {
        state.position = index;
        renderQuestion();
      });
      dots.appendChild(dot);
    });
    dots.hidden = !total;
  }

  function renderMeta() {
    if (!source) return;
    if (!state.pending) {
      source.textContent = '';
      return;
    }
    const attempts = state.attempts === 1 ? '1 attempt' : `${state.attempts} attempts`;
    source.textContent = `${state.pending} questions still wrong, collected from your ${attempts}.`;
  }

  function renderEmpty(title, message) {
    stage.innerHTML = '';
    const wrap = el('div', 'review-empty');
    wrap.appendChild(el('div', 'review-empty-title', title));
    wrap.appendChild(el('p', 'review-empty-copy', message));
    const actions = el('div', 'review-actions review-actions--center');
    const dashboard = document.createElement('a');
    dashboard.className = 'btn-primary';
    dashboard.href = '/dashboard';
    dashboard.textContent = 'Back to tests';
    const signs = document.createElement('a');
    signs.className = 'btn-ghost';
    signs.href = '/signs/learn';
    signs.textContent = 'Practise road signs';
    actions.append(dashboard, signs);
    wrap.appendChild(actions);
    stage.appendChild(wrap);
    if (dots) dots.hidden = true;
    renderProgress();
  }

  function renderQuestion() {
    const item = current();
    if (!item) return renderSummary();
    const question = item.question;

    stage.innerHTML = '';

    const meta = el('div', 'question-meta');
    meta.appendChild(el('span', 'question-origin', `Test ${question.test_id} · question ${question.question_index}`));
    if (question.misses > 1) {
      meta.appendChild(el('span', 'question-misses', `missed ${question.misses} times`));
    }
    stage.appendChild(meta);

    if (question.image_path) {
      const wrap = el('div', 'review-image-wrap');
      const img = document.createElement('img');
      img.className = 'review-image';
      img.src = `/test-images/${question.image_path}`;
      img.alt = 'Traffic situation';
      wrap.append(img, el('span', 'review-image-hint', 'Click to enlarge'));
      wrap.addEventListener('click', () => {
        if (typeof window.openImageLightbox === 'function') {
          window.openImageLightbox(img.src, img.alt);
        }
      });
      stage.appendChild(wrap);
    }

    stage.appendChild(el('div', 'review-question', question.question_text));
    if (question.question_text_ru) {
      stage.appendChild(el('div', 'review-question-ru', question.question_text_ru));
    }
    stage.appendChild(el('div', 'review-hint', 'More than one answer can be correct.'));

    const list = el('div', 'review-options');
    const buttons = [];

    question.answers.forEach((answer, index) => {
      const button = el('button', 'review-option');
      button.type = 'button';
      button.setAttribute('aria-pressed', item.picked.has(answer.id) ? 'true' : 'false');
      const box = el('span', 'option-box', String(index + 1));
      const body = el('span', 'option-body');
      body.appendChild(el('span', null, answer.text));
      if (answer.text_ru) body.appendChild(el('span', 'option-ru', answer.text_ru));
      button.append(box, body);
      if (item.picked.has(answer.id)) button.classList.add('is-picked');
      button.addEventListener('click', () => {
        if (item.checked) return;
        if (item.picked.has(answer.id)) item.picked.delete(answer.id);
        else item.picked.add(answer.id);
        button.classList.toggle('is-picked', item.picked.has(answer.id));
        button.setAttribute('aria-pressed', item.picked.has(answer.id) ? 'true' : 'false');
        check.disabled = item.picked.size === 0;
        picked.textContent = pickedLabel(item);
      });
      buttons.push({ button, answer });
      list.appendChild(button);
    });
    stage.appendChild(list);

    const actions = el('div', 'review-actions');
    const back = el('button', 'btn-ghost', '← Previous');
    back.type = 'button';
    back.disabled = state.position === 0;
    back.addEventListener('click', () => {
      state.position -= 1;
      renderQuestion();
    });

    const check = el('button', 'btn-primary', 'Check');
    check.type = 'button';
    check.disabled = item.picked.size === 0;
    check.addEventListener('click', () => grade(item, buttons, check, actions));

    const picked = el('span', 'picked-count', pickedLabel(item));

    actions.append(back, check, picked);
    stage.appendChild(actions);

    if (item.checked) grade(item, buttons, check, actions, true);
    renderProgress();
  }

  function pickedLabel(item) {
    if (item.checked) return '';
    return item.picked.size ? `${item.picked.size} selected` : 'Nothing selected yet';
  }

  function grade(item, buttons, check, actions, replay) {
    const question = item.question;
    const correctIds = question.answers.filter((answer) => answer.is_correct).map((a) => a.id);
    const right =
      correctIds.length === item.picked.size && correctIds.every((id) => item.picked.has(id));

    if (!replay) {
      item.checked = true;
      item.right = right;
    }

    buttons.forEach(({ button, answer }) => {
      button.disabled = true;
      button.classList.remove('is-picked');
      if (answer.is_correct) button.classList.add('is-correct');
      else if (item.picked.has(answer.id)) button.classList.add('is-wrong');
    });

    stage.appendChild(el('div', `review-verdict ${right ? 'ok' : 'no'}`,
      right ? 'Correct' : 'Not quite — the right answers are marked green'));

    if (question.explanation) {
      const explain = el('div', 'review-explain');
      explain.appendChild(el('div', null, question.explanation));
      if (question.explanation_ru) {
        explain.appendChild(el('div', 'review-explain-ru', question.explanation_ru));
      }
      stage.appendChild(explain);
    }

    check.remove();
    stage.querySelector('.picked-count')?.remove();
    const next = el('button', 'btn-primary',
      state.position + 1 < state.round.length ? 'Next question →' : 'Finish round');
    next.type = 'button';
    next.addEventListener('click', () => {
      state.position += 1;
      renderQuestion();
    });
    actions.appendChild(next);
    stage.appendChild(actions);
    if (!replay) next.focus();
    renderProgress();
  }

  function renderSummary() {
    const right = state.round.filter((item) => item.right).length;
    stage.innerHTML = '';
    const wrap = el('div', 'review-empty');
    wrap.appendChild(el('div', 'review-empty-title', `${right}/${state.round.length} correct`));
    wrap.appendChild(el('p', 'review-empty-copy',
      'Answer these in a real test to clear them from the list for good.'));

    const missed = state.round.filter((item) => item.checked && !item.right);
    if (missed.length) {
      const list = el('div', 'summary-list');
      missed.forEach((item) => {
        const row = el('button', 'summary-row');
        row.type = 'button';
        row.append(
          el('span', 'summary-row-code', `Test ${item.question.test_id} · Q${item.question.question_index}`),
          el('span', 'summary-row-text', item.question.question_text),
        );
        row.addEventListener('click', () => {
          state.position = state.round.indexOf(item);
          renderQuestion();
        });
        list.appendChild(row);
      });
      wrap.append(el('div', 'review-hint', 'Still wrong in this round'), list);
    }

    const actions = el('div', 'review-actions review-actions--center');
    const again = el('button', 'btn-primary', 'Next ten');
    again.type = 'button';
    again.addEventListener('click', load);
    const dashboard = document.createElement('a');
    dashboard.className = 'btn-ghost';
    dashboard.href = '/dashboard';
    dashboard.textContent = 'Back to tests';
    actions.append(again, dashboard);
    wrap.appendChild(actions);
    stage.appendChild(wrap);
    renderProgress();
  }

  function load() {
    stage.innerHTML = '<p class="review-empty-copy">Loading your questions…</p>';
    fetch('/api/review/questions?limit=10')
      .then((response) => {
        if (response.status === 401) throw new Error('signed out');
        return response.json();
      })
      .then((data) => {
        state.pending = data.pending || 0;
        state.attempts = data.attempts || 0;
        state.round = (data.questions || []).map((question) => ({
          question,
          picked: new Set(),
          checked: false,
          right: false,
        }));
        state.position = 0;
        renderMeta();
        if (!state.round.length) {
          renderEmpty(
            'Nothing to review',
            'You have no unanswered mistakes right now. Take a test and come back — anything you miss lands here.',
          );
          return;
        }
        renderQuestion();
      })
      .catch((error) => {
        renderEmpty(
          'Something went wrong',
          error.message === 'signed out'
            ? 'Your session ended. Sign in again to see your mistakes.'
            : 'Could not load your questions. Reload the page to try again.',
        );
      });
  }

  load();
})();
