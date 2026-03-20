(function () {
  const IS_AUTHENTICATED = document.body?.dataset.isAuthenticated === 'true';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const button = document.getElementById('navThemeBtn');
    if (button) {
      button.textContent = theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('wex-theme', next);
    applyTheme(next);
  }

  function renderFallback(page) {
    page.innerHTML = `<div style="text-align:center;padding:80px 0;">
      <div style="font-size:1.2rem;font-weight:700;margin-bottom:12px;">No results found</div>
      <p style="color:var(--text-muted);margin-bottom:24px;">Go back and take the test first.</p>
      <a href="/test/0" class="btn-primary">Open Starter Test</a>
    </div>`;
  }

  function createAnswerChip(text, state) {
    const chip = document.createElement('div');
    chip.style.cssText = 'padding:12px 14px;border-radius:12px;border:1px solid var(--border);background:var(--bg-card);font-size:0.92rem;line-height:1.45;';
    if (state === 'correct') {
      chip.style.borderColor = 'rgba(34,197,94,0.45)';
      chip.style.background = 'color-mix(in srgb, var(--bg-card) 88%, rgba(34,197,94,0.12))';
    } else if (state === 'wrong') {
      chip.style.borderColor = 'rgba(239,68,68,0.45)';
      chip.style.background = 'color-mix(in srgb, var(--bg-card) 88%, rgba(239,68,68,0.12))';
    }
    chip.textContent = text;
    return chip;
  }

  function renderSummary(page, data, testMeta) {
    const passed = data.passed;
    const score = data.score;
    const total = data.total || testMeta?.total || 15;
    const title = testMeta?.title || data.test_title || 'Test 0';
    const secondaryButton = IS_AUTHENTICATED
      ? '<a href="/dashboard" class="btn-ghost">Back to Dashboard</a>'
      : '<a href="/pricing" class="btn-ghost">Open Practice Library &#8594;</a>';
    const bottomCta = IS_AUTHENTICATED
      ? `<div style="font-weight:700;margin-bottom:8px;">Continue with your study dashboard</div>
         <p style="color:var(--text-muted);font-size:0.88rem;margin-bottom:16px;">Your account is already active. You can return to the dashboard and continue through the full library there.</p>
         <a href="/dashboard" class="btn-primary">Open Dashboard</a>`
      : `<div style="font-weight:700;margin-bottom:8px;">Continue with the full practice library</div>
         <p style="color:var(--text-muted);font-size:0.88rem;margin-bottom:16px;">Create an account to save progress, review more questions, and continue through the full study library.</p>
         <a href="/register" class="btn-primary">Create Account</a>`;
    page.innerHTML = `
      <div style="text-align:center;padding:48px 0 40px;">
        <div style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px;">${title} - Starter Sample</div>
        <div class="results-score" style="color:${passed ? 'var(--correct)' : 'var(--wrong)'};">${score}/${total}</div>
        <div style="margin-top:16px;">
          ${passed
            ? '<span class="badge-green" style="font-size:1rem;padding:8px 20px;">&#10003; PASSED</span>'
            : '<span class="badge-red" style="font-size:1rem;padding:8px 20px;">&#10005; FAILED</span>'}
        </div>
        <p style="color:var(--text-muted);font-size:0.9rem;margin-top:16px;">
          ${passed
            ? `Nice work. You scored ${score}/${total} in the starter sample.`
            : `You scored ${score}/${total}. Keep practising and try again when you are ready.`}
        </p>
        <div style="display:flex;gap:12px;justify-content:center;margin-top:28px;flex-wrap:wrap;">
          <a href="/test/0" class="btn-primary">Try Again</a>
          ${secondaryButton}
        </div>
      </div>

      <div class="card" style="margin-bottom:32px;padding:20px 24px;">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;text-align:center;">
          <div>
            <div style="font-size:1.8rem;font-weight:800;color:var(--correct);">${score}</div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">Correct</div>
          </div>
          <div>
            <div style="font-size:1.8rem;font-weight:800;color:var(--wrong);">${total - score}</div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">Wrong</div>
          </div>
          <div>
            <div style="font-size:1.8rem;font-weight:800;">${Math.round((score / total) * 100)}%</div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">Score</div>
          </div>
        </div>
      </div>

      <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:16px;">Question Breakdown</h2>
      <div id="questionList" style="display:flex;flex-direction:column;gap:10px;"></div>

      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:24px;text-align:center;margin-top:32px;">
        ${bottomCta}
      </div>
    `;
  }

  function renderResultsList(data, questions, selectedAnswers) {
    const list = document.getElementById('questionList');
    if (!list) return;
    data.results.forEach((r) => {
      const question = Array.isArray(questions) ? questions.find((q) => q.id === r.question_id) : null;
      const selectedIds = Array.isArray(r.selected_ids) ? r.selected_ids : (selectedAnswers?.[r.question_id] || selectedAnswers?.[String(r.question_id)] || []);
      const wrapper = document.createElement('div');
      wrapper.style.cssText = `background:var(--bg-card);border:1px solid ${r.is_correct ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'};border-radius:16px;padding:18px 18px 16px;`;

      const head = document.createElement('div');
      head.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px;';

      const headLeft = document.createElement('div');
      headLeft.style.cssText = 'flex:1;min-width:0;';

      const label = document.createElement('div');
      label.style.cssText = `font-size:0.82rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:6px;color:${r.is_correct ? 'var(--correct)' : 'var(--wrong)'};`;
      label.textContent = `${r.is_correct ? 'Correct' : 'Needs review'} · Question ${r.question_index}`;
      headLeft.appendChild(label);

      const qText = document.createElement('div');
      qText.style.cssText = 'font-size:1rem;font-weight:600;line-height:1.5;';
      qText.textContent = question?.question_text || `Question ${r.question_index}`;
      headLeft.appendChild(qText);
      head.appendChild(headLeft);

      if (r.image_path) {
        const thumb = document.createElement('img');
        thumb.src = `/test-images/${r.image_path}`;
        thumb.alt = `Question ${r.question_index}`;
        thumb.style.cssText = 'width:86px;height:58px;object-fit:cover;border-radius:8px;border:1px solid var(--border);flex-shrink:0;';
        head.appendChild(thumb);
      }
      wrapper.appendChild(head);

      const answerList = document.createElement('div');
      answerList.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-bottom:14px;';
      (question?.answers || []).forEach((answer) => {
        let state = '';
        if (r.correct_ids.includes(answer.id)) state = 'correct';
        else if (selectedIds.includes(answer.id)) state = 'wrong';
        answerList.appendChild(createAnswerChip(answer.text, state));
      });
      if (answerList.childElementCount) wrapper.appendChild(answerList);

      const explanation = document.createElement('div');
      explanation.style.cssText = 'padding:12px 14px;border-radius:12px;background:var(--bg);border:1px solid var(--border);';
      const exLabel = document.createElement('div');
      exLabel.style.cssText = 'font-size:0.78rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px;';
      exLabel.textContent = 'Explanation';
      const exText = document.createElement('div');
      exText.style.cssText = 'font-size:0.92rem;line-height:1.6;color:var(--text-muted);';
      exText.textContent = r.explanation || 'No explanation available for this question.';
      explanation.appendChild(exLabel);
      explanation.appendChild(exText);
      wrapper.appendChild(explanation);

      list.appendChild(wrapper);
    });
  }

  applyTheme(localStorage.getItem('wex-theme') || 'dark');
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);

  document.addEventListener('DOMContentLoaded', () => {
    const raw = sessionStorage.getItem('freeResult');
    const page = document.getElementById('resultsPage');
    if (!page) return;

    if (!raw) {
      renderFallback(page);
      return;
    }

    const { data, testMeta, questions, selectedAnswers } = JSON.parse(raw);
    sessionStorage.removeItem('freeResult');
    renderSummary(page, data, testMeta);
    renderResultsList(data, questions, selectedAnswers);
  });
})();

