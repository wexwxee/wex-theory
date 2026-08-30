(function () {
  document.getElementById('reviewBurgerBtn')?.addEventListener('click', sbOpen);
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);

  const shell = document.getElementById('reviewShell');
  const stage = document.getElementById('reviewStage');
  if (!shell || !stage) return;

  const RU_KEY = 'wexReviewRu';
  const state = {
    questions: [],
    position: 0,
    picked: new Set(),
    checked: false,
    right: 0,
  };

  // ── Russian helper, same idea as in the test: on demand, not by default ─────
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
    return state.questions[state.position];
  }

  function renderProgress() {
    const total = state.questions.length;
    const done = state.position + (state.checked ? 1 : 0);
    document.getElementById('reviewCounter').textContent = total
      ? `Question ${Math.min(state.position + 1, total)} of ${total}`
      : '';
    document.getElementById('reviewScore').textContent = done ? `${state.right}/${done} correct` : '';
    document.getElementById('reviewBar').style.width = total ? `${(done / total) * 100}%` : '0%';
  }

  function renderEmpty(message, title) {
    stage.innerHTML = '';
    const wrap = el('div', 'review-empty');
    wrap.appendChild(el('div', 'review-empty-title', title));
    wrap.appendChild(el('p', null, message));
    const actions = el('div', 'review-actions');
    actions.style.justifyContent = 'center';
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
    renderProgress();
  }

  function renderQuestion() {
    const question = current();
    if (!question) return renderSummary();

    stage.innerHTML = '';
    if (question.image_path) {
      const img = document.createElement('img');
      img.className = 'review-image';
      img.src = `/test-images/${question.image_path}`;
      img.alt = 'Traffic situation';
      stage.appendChild(img);
    }

    stage.appendChild(el('div', 'review-question', question.question_text));
    if (question.question_text_ru) {
      stage.appendChild(el('div', 'review-question-ru', question.question_text_ru));
    }

    const list = el('div', 'review-options');
    const buttons = [];

    question.answers.forEach((answer, index) => {
      const button = el('button', 'review-option');
      button.type = 'button';
      const box = el('span', 'option-box', String(index + 1));
      const body = el('span');
      body.appendChild(el('span', null, answer.text));
      if (answer.text_ru) body.appendChild(el('span', 'option-ru', answer.text_ru));
      button.append(box, body);
      button.addEventListener('click', () => {
        if (state.checked) return;
        if (state.picked.has(answer.id)) state.picked.delete(answer.id);
        else state.picked.add(answer.id);
        button.classList.toggle('is-picked', state.picked.has(answer.id));
        check.disabled = state.picked.size === 0;
      });
      buttons.push({ button, answer });
      list.appendChild(button);
    });

    const actions = el('div', 'review-actions');
    const check = el('button', 'btn-primary', 'Check');
    check.type = 'button';
    check.disabled = true;
    check.addEventListener('click', () => {
      state.checked = true;
      const correctIds = question.answers.filter((answer) => answer.is_correct).map((a) => a.id);
      const right =
        correctIds.length === state.picked.size &&
        correctIds.every((id) => state.picked.has(id));
      if (right) state.right += 1;

      buttons.forEach(({ button, answer }) => {
        button.disabled = true;
        if (answer.is_correct) button.classList.add('is-correct');
        else if (state.picked.has(answer.id)) button.classList.add('is-wrong');
      });

      const verdict = el('div', `review-verdict ${right ? 'ok' : 'no'}`,
        right ? 'Correct' : 'Not quite - the right answers are marked');
      stage.appendChild(verdict);

      if (question.explanation) {
        const explain = el('div', 'review-explain');
        explain.appendChild(el('div', null, question.explanation));
        if (question.explanation_ru) {
          explain.appendChild(el('div', 'review-explain-ru', question.explanation_ru));
        }
        stage.appendChild(explain);
      }

      check.remove();
      const next = el('button', 'btn-primary',
        state.position + 1 < state.questions.length ? 'Next question' : 'Finish');
      next.type = 'button';
      next.addEventListener('click', () => {
        state.position += 1;
        state.picked = new Set();
        state.checked = false;
        renderQuestion();
      });
      actions.appendChild(next);
      next.focus();
      renderProgress();
    });
    actions.appendChild(check);

    stage.append(list, actions);
    renderProgress();
  }

  function renderSummary() {
    stage.innerHTML = '';
    const wrap = el('div', 'review-empty');
    wrap.appendChild(el('div', 'review-empty-title', `${state.right}/${state.questions.length} correct`));
    wrap.appendChild(el('p', null,
      'Answer these in a real test to clear them from the list for good.'));
    const actions = el('div', 'review-actions');
    actions.style.justifyContent = 'center';
    const again = el('button', 'btn-primary', 'Another round');
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
    stage.innerHTML = '<p style="color:var(--text-muted);">Loading your questions&hellip;</p>';
    fetch('/api/review/questions?limit=10')
      .then((response) => {
        if (response.status === 401) throw new Error('signed out');
        return response.json();
      })
      .then((data) => {
        state.questions = data.questions || [];
        state.position = 0;
        state.picked = new Set();
        state.checked = false;
        state.right = 0;
        if (!state.questions.length) {
          renderEmpty(
            'You have no unanswered mistakes right now. Take a test and come back - anything you miss lands here.',
            'Nothing to review',
          );
          return;
        }
        renderQuestion();
      })
      .catch((error) => {
        renderEmpty(
          error.message === 'signed out'
            ? 'Your session ended. Sign in again to see your mistakes.'
            : 'Could not load your questions. Reload the page to try again.',
          'Something went wrong',
        );
      });
  }

  load();
})();
