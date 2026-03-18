(function () {
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
      <a href="/test/1" class="btn-primary">Take Test 1</a>
    </div>`;
  }

  function renderSummary(page, data) {
    const passed = data.passed;
    const score = data.score;
    page.innerHTML = `
      <div style="text-align:center;padding:48px 0 40px;">
        <div style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px;">Test 1 - Free Test</div>
        <div class="results-score" style="color:${passed ? 'var(--correct)' : 'var(--wrong)'};">${score}/25</div>
        <div style="margin-top:16px;">
          ${passed
            ? '<span class="badge-green" style="font-size:1rem;padding:8px 20px;">&#10003; PASSED</span>'
            : '<span class="badge-red" style="font-size:1rem;padding:8px 20px;">&#10005; FAILED</span>'}
        </div>
        <p style="color:var(--text-muted);font-size:0.9rem;margin-top:16px;">
          ${passed
            ? `Great work! You scored ${score}/25. Register to access all 13 tests.`
            : `You scored ${score}/25. You need at least 20 to pass. Keep practicing!`}
        </p>
        <div style="display:flex;gap:12px;justify-content:center;margin-top:28px;flex-wrap:wrap;">
          <a href="/test/1" class="btn-primary">Try Again</a>
          <a href="/pricing" class="btn-ghost">Unlock Full Access &#8594;</a>
        </div>
      </div>

      <div class="card" style="margin-bottom:32px;padding:20px 24px;">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;text-align:center;">
          <div>
            <div style="font-size:1.8rem;font-weight:800;color:var(--correct);">${score}</div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">Correct</div>
          </div>
          <div>
            <div style="font-size:1.8rem;font-weight:800;color:var(--wrong);">${25 - score}</div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">Wrong</div>
          </div>
          <div>
            <div style="font-size:1.8rem;font-weight:800;">${Math.round((score / 25) * 100)}%</div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">Score</div>
          </div>
        </div>
      </div>

      <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:16px;">Question Breakdown</h2>
      <div id="questionList" style="display:flex;flex-direction:column;gap:10px;"></div>

      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:24px;text-align:center;margin-top:32px;">
        <div style="font-weight:700;margin-bottom:8px;">Want to access all 13 tests?</div>
        <p style="color:var(--text-muted);font-size:0.88rem;margin-bottom:16px;">Create an account to track your progress and practice all official theory tests.</p>
        <a href="/register" class="btn-primary">Create Account</a>
      </div>
    `;
  }

  function renderResultsList(data) {
    const list = document.getElementById('questionList');
    if (!list) return;
    data.results.forEach((r) => {
      const div = document.createElement('div');
      const isCorrect = r.is_correct;
      div.style.cssText = `display:flex;align-items:center;gap:14px;padding:14px 18px;background:var(--bg-card);border:1px solid ${isCorrect ? 'var(--correct)' : 'var(--wrong)'};border-radius:10px;`;
      div.innerHTML = `
        <div style="font-size:1.1rem;flex-shrink:0;color:${isCorrect ? 'var(--correct)' : 'var(--wrong)'};">${isCorrect ? '&#10003;' : '&#10005;'}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:2px;">Question ${r.question_index}</div>
          <div style="font-size:0.9rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
        </div>
        ${r.image_path ? `<img src="/test-images/${r.image_path}" style="width:60px;height:40px;object-fit:cover;border-radius:4px;border:1px solid var(--border);flex-shrink:0;">` : ''}
      `;
      list.appendChild(div);
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

    const { data } = JSON.parse(raw);
    sessionStorage.removeItem('freeResult');
    renderSummary(page, data);
    renderResultsList(data);
  });
})();

