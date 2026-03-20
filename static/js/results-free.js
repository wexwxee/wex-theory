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

  function buildViewerData(data, questions) {
    return data.results.map((result) => {
      const question = Array.isArray(questions) ? questions.find((q) => q.id === result.question_id) : null;
      return {
        index: result.question_index,
        text: question?.question_text || `Question ${result.question_index}`,
        image: result.image_path || '',
        explanation: result.explanation || question?.explanation || '',
        is_correct: !!result.is_correct,
        selected_ids: Array.isArray(result.selected_ids) ? result.selected_ids : [],
        correct_ids: Array.isArray(result.correct_ids) ? result.correct_ids : [],
        answers: (question?.answers || []).map((answer) => ({
          id: answer.id,
          text: answer.text
        }))
      };
    });
  }

  function renderSummary(page, data, testMeta) {
    const passed = data.passed;
    const score = data.score;
    const total = data.total || testMeta?.total || 15;
    const title = testMeta?.title || data.test_title || 'Test 0';
    const passNeed = total === 15 ? 12 : Math.max(1, Math.ceil(total * 0.8));
    page.innerHTML = `
      <div style="text-align:center;padding:40px 0 36px;">
        <div style="font-size:0.82rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:14px;">${title}</div>
        <div style="font-size:clamp(1.4rem,4vw,2.2rem);font-weight:800;color:${passed ? '#22c55e' : '#ef4444'};line-height:1.2;margin-bottom:8px;">
          ${passed ? '&#10003; Congratulations! You passed!' : '&#10005; Unfortunately! You did not pass.'}
        </div>
        <div style="font-size:1.1rem;color:${passed ? '#22c55e' : '#ef4444'};font-weight:600;"><span id="scoreDisplay">0</span>/${total} correct</div>
        <div style="max-width:320px;margin:12px auto 4px;">
          <div style="height:6px;background:var(--border);border-radius:999px;overflow:hidden;">
            <div id="scoreBar" style="height:100%;width:0%;border-radius:999px;transition:width 1s ease;background:${passed ? '#22c55e' : '#ef4444'};"></div>
          </div>
        </div>
        <p style="color:var(--text-muted);font-size:0.88rem;margin-top:10px;">You need at least ${passNeed} correct answers to pass.</p>

        <div style="display:inline-grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:24px;text-align:center;">
          <div>
            <div id="statCorrect" style="font-size:2rem;font-weight:800;color:#22c55e;">0</div>
            <div style="font-size:0.78rem;color:var(--text-muted);">Correct</div>
          </div>
          <div>
            <div id="statWrong" style="font-size:2rem;font-weight:800;color:#ef4444;">0</div>
            <div style="font-size:0.78rem;color:var(--text-muted);">Wrong</div>
          </div>
          <div>
            <div id="statPct" style="font-size:2rem;font-weight:800;">0%</div>
            <div style="font-size:0.78rem;color:var(--text-muted);">Score</div>
          </div>
        </div>

        <div style="display:flex;gap:12px;justify-content:center;margin-top:28px;flex-wrap:wrap;">
          <a href="/test/0" class="btn-primary">Try Again</a>
          ${IS_AUTHENTICATED
            ? '<a href="/dashboard" class="btn-ghost">Back to Dashboard</a>'
            : '<a href="/register" class="btn-ghost">Create Account</a>'}
        </div>
      </div>

      <h2 style="font-size:1rem;font-weight:700;margin-bottom:16px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Question Breakdown</h2>
      <div class="result-grid" id="freeResultGrid"></div>

      <div style="display:flex;gap:12px;justify-content:center;margin:12px 0 40px;flex-wrap:wrap;">
        <a href="/test/0" class="btn-primary">Try Again</a>
        ${IS_AUTHENTICATED
          ? '<a href="/dashboard" class="btn-ghost">Back to Dashboard</a>'
          : '<a href="/register" class="btn-ghost">Create Account</a>'}
      </div>
    `;
  }

  function renderResultCards(data, viewerData) {
    const grid = document.getElementById('freeResultGrid');
    if (!grid) return;
    viewerData.forEach((item, idx) => {
      const result = data.results[idx];
      const card = document.createElement('div');
      card.className = `result-card ${result?.is_correct ? 'correct' : 'wrong'}`;
      card.dataset.modalIndex = String(idx);

      if (item.image) {
        const img = document.createElement('img');
        img.src = `/test-images/${item.image}`;
        img.alt = '';
        img.loading = 'lazy';
        card.appendChild(img);
      } else {
        const noImg = document.createElement('div');
        noImg.style.cssText = 'aspect-ratio:16/9;background:#111;display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:#444;';
        noImg.textContent = 'No image';
        card.appendChild(noImg);
      }

      const num = document.createElement('span');
      num.className = 'rc-num';
      num.textContent = item.index;
      card.appendChild(num);

      const icon = document.createElement('span');
      icon.className = 'rc-icon';
      icon.textContent = result?.is_correct ? '✓' : '✕';
      card.appendChild(icon);

      grid.appendChild(card);
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

    const { data, testMeta, questions } = JSON.parse(raw);
    sessionStorage.removeItem('freeResult');

    renderSummary(page, data, testMeta);
    const viewerData = buildViewerData(data, questions);
    renderResultCards(data, viewerData);

    const dataField = document.getElementById('resultsDataJson');
    const meta = document.getElementById('resultsPageMeta');
    if (dataField) dataField.value = JSON.stringify(viewerData);
    if (meta) {
      meta.dataset.score = String(data.score || 0);
      meta.dataset.total = String(data.total || testMeta?.total || 15);
    }

    if (typeof window.initResultsViewer === 'function') {
      window.initResultsViewer({
        data: viewerData,
        score: Number(data.score || 0),
        total: Number(data.total || testMeta?.total || 15)
      });
    }
  });
})();
