const testContainer = document.getElementById('testContainer');
const TEST_ID = Number(testContainer?.dataset.testId || 0);
const IS_AUTHENTICATED = testContainer?.dataset.isAuthenticated === 'true';
const WORDING_MODE = testContainer?.dataset.wordingMode || 'original';
const FREE_SAMPLE_TEST_ID = 0;
const EXAM_MODE_TEST_ID = 14;

let questions = [];
let currentIndex = 0;
let selectedAnswers = {}; // { questionId: [answerId, ...] }
let attemptId = null;
let timerSeconds = 25 * 60;
let timerInterval = null;
let isSubmitting = false;
let imageZoomOpen = false;
let imageMagnifierActive = false;
let timeWarningShown = false;
let bookmarkRequestInFlight = false;
let testToastTimer = null;

function getExamAttemptIdFromUrl() {
  const raw = new URLSearchParams(window.location.search).get('attempt_id');
  if (!raw || !/^\d+$/.test(raw)) return null;
  return Number(raw);
}

function syncExamAttemptInUrl() {
  if (TEST_ID !== EXAM_MODE_TEST_ID || !attemptId) return;
  const url = new URL(window.location.href);
  url.searchParams.set('attempt_id', String(attemptId));
  window.history.replaceState({}, '', url.toString());
}

// в”Ђв”Ђ Init в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('testBurgerBtn')?.addEventListener('click', sbOpen);
  document.getElementById('translateBtn')?.addEventListener('click', toggleTranslate);
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);
  document.getElementById('finishBtn')?.addEventListener('click', finishTest);
  document.getElementById('bookmarkBtn')?.addEventListener('click', toggleBookmark);
  document.getElementById('prevBtn')?.addEventListener('click', prevQuestion);
  document.getElementById('nextBtn')?.addEventListener('click', nextQuestion);
  document.getElementById('finishModalCloseBtn')?.addEventListener('click', closeFinishModal);
  document.getElementById('finishKeepGoingBtn')?.addEventListener('click', closeFinishModal);
  document.getElementById('submitBtn')?.addEventListener('click', () => submitTest());
  document.getElementById('timeWarningCloseBtn')?.addEventListener('click', closeTimeWarningModal);
  document.getElementById('timeWarningOkBtn')?.addEventListener('click', closeTimeWarningModal);
  document.getElementById('questionImg')?.addEventListener('click', openQuestionImageZoom);
  document.getElementById('openQuestionImageBtn')?.addEventListener('click', openQuestionImageZoom);
  document.getElementById('closeImageZoomBtn')?.addEventListener('click', closeQuestionImageZoom);
  document.getElementById('toggleImageMagnifierBtn')?.addEventListener('click', toggleImageMagnifier);
  document.getElementById('imageZoomOverlay')?.addEventListener('click', (event) => {
    if (event.target.id === 'imageZoomOverlay') closeQuestionImageZoom();
  });
  document.getElementById('imageZoomImg')?.addEventListener('mousemove', handleMagnifierPointerMove);
  document.getElementById('imageZoomImg')?.addEventListener('touchmove', handleMagnifierPointerMove, { passive: false });
  document.getElementById('imageZoomImg')?.addEventListener('mouseleave', resetMagnifierFocus);
  document.getElementById('imageZoomImg')?.addEventListener('touchend', resetMagnifierFocus);
  if (TEST_ID !== FREE_SAMPLE_TEST_ID && !IS_AUTHENTICATED) {
    window.location.href = '/login';
    return;
  }
  await loadBookmarks();
  if (TEST_ID === EXAM_MODE_TEST_ID) {
    attemptId = getExamAttemptIdFromUrl();
    if (!attemptId) {
      await ensureExamAttempt(true);
    }
  }
  await loadQuestions();
  startTimer();
});

// в”Ђв”Ђ Load questions в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
async function loadQuestions() {
  try {
    const params = new URLSearchParams();
    if (TEST_ID === EXAM_MODE_TEST_ID && attemptId) {
      params.set('attempt_id', String(attemptId));
    }
    if (TEST_ID >= 1 && TEST_ID <= 13 && WORDING_MODE === 'exam') {
      params.set('wording', WORDING_MODE);
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/tests/${TEST_ID}/questions${query}`);
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    if (res.status === 403) {
      window.location.href = '/pricing';
      return;
    }
    if (!res.ok) throw new Error('Failed to load');
    questions = await res.json();
    if (!questions.length) throw new Error('No questions found');

    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('questionArea').style.display = 'block';
    renderDots();
    renderQuestion();
  } catch(e) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
    document.getElementById('errorMsg').textContent = e.message || 'Failed to load questions.';
  }
}

// в”Ђв”Ђ Timer в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function startTimer() {
  updateTimerDisplay();
  maybeShowTimeWarning();
  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimerDisplay();
    maybeShowTimeWarning();
    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      submitTest(true);
    }
  }, 1000);
}

function maybeShowTimeWarning() {
  if (timeWarningShown) return;
  if (timerSeconds <= 5 * 60 && timerSeconds > 0) {
    timeWarningShown = true;
    openTimeWarningModal();
  }
}

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60);
  const s = timerSeconds % 60;
  const el = document.getElementById('timerDisplay');
  el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  el.className = 'timer' + (timerSeconds <= 5 * 60 ? ' warning' : '');
}

// в”Ђв”Ђ Render в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function appendWordWrappedText(parent, text, stopWords) {
  const fragment = document.createDocumentFragment();
  const regex = /\b([a-zA-Z]{3,})\b/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }
    const word = match[0];
    if (stopWords.has(word.toLowerCase())) {
      fragment.appendChild(document.createTextNode(word));
    } else {
      const wordEl = document.createElement('span');
      wordEl.className = 'tw';
      wordEl.textContent = word;
      fragment.appendChild(wordEl);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
  parent.appendChild(fragment);
}

function setWordPopupLoading(popup, word) {
  popup.replaceChildren();
  const orig = document.createElement('div');
  orig.className = 'wp-orig';
  orig.textContent = word;
  const loading = document.createElement('div');
  loading.className = 'wp-load';
  loading.textContent = '...';
  popup.appendChild(orig);
  popup.appendChild(loading);
}

function setWordPopupResult(popup, word, result) {
  popup.replaceChildren();
  const orig = document.createElement('div');
  orig.className = 'wp-orig';
  orig.textContent = word;
  const translation = document.createElement('div');
  translation.className = 'wp-tr';
  translation.textContent = result.main || '—';
  popup.appendChild(orig);
  popup.appendChild(translation);
  if (result.pos) {
    const pos = document.createElement('div');
    pos.className = 'wp-context';
    pos.textContent = result.pos;
    popup.appendChild(pos);
  }
}

async function ensureExamAttempt(forceFresh = false) {
  if (TEST_ID === EXAM_MODE_TEST_ID && !forceFresh) {
    const existingAttemptId = getExamAttemptIdFromUrl();
    if (existingAttemptId) {
      attemptId = existingAttemptId;
      return;
    }
  }
  const suffix = TEST_ID === EXAM_MODE_TEST_ID && forceFresh ? '?fresh=1' : '';
  const res = await fetch(`/api/tests/${TEST_ID}/start${suffix}`, { method: 'POST' });
  if (res.status === 401) {
    window.location.href = '/login';
    return;
  }
  if (res.status === 403) {
    window.location.href = '/pricing';
    return;
  }
  if (!res.ok) {
    throw new Error('Failed to start exam');
  }
  const data = await res.json();
  attemptId = data.attempt_id || null;
  syncExamAttemptInUrl();
}

function renderQuestion() {
  if (!questions.length) return;
  const q = questions[currentIndex];

  document.getElementById('questionCounter').textContent = `Question ${currentIndex + 1} of ${questions.length}`;

  // Question text
  const qTextEl = document.getElementById('questionText');
  qTextEl.textContent = q.question_text;
  qTextEl.dataset.sourceText = q.question_text;
  delete qTextEl.dataset.wrapped;

  // Russian translation below (from pre-translated DB field)
  const qRuEl = document.getElementById('questionTextRu');
  if (translateMode && q.question_text_ru) {
    qRuEl.textContent = q.question_text_ru;
    qRuEl.style.display = 'block';
  } else {
    qRuEl.style.display = 'none';
  }

  // Image
  const img = document.getElementById('questionImg');
  const placeholder = document.getElementById('imgPlaceholder');
  if (q.image_path) {
    img.src = '/test-images/' + q.image_path;
    img.alt = `Question ${currentIndex + 1} image`;
    img.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    img.style.display = 'none';
    placeholder.style.display = 'flex';
  }
  syncQuestionImageZoomState(Boolean(q.image_path));

  // Answers
  const container = document.getElementById('answersContainer');
  container.innerHTML = '';
  const selected = selectedAnswers[q.id] || [];
  q.answers.forEach((a, idx) => {
    const div = document.createElement('div');
    div.className = 'answer-option' + (selected.includes(a.id) ? ' selected' : '');
    const checkbox = document.createElement('div');
    checkbox.className = 'answer-checkbox';
    const label = document.createElement('span');
    label.className = 'answer-option-label';
    label.textContent = a.text;
    label.dataset.sourceText = a.text;
    const ruText = (translateMode && a.text_ru) ? a.text_ru : null;
    if (ruText) {
      label.appendChild(document.createElement('br'));
      const ruNode = document.createElement('span');
      ruNode.style.cssText = 'font-size:0.85rem;color:#6b7280;font-style:italic;';
      ruNode.textContent = ruText;
      label.appendChild(ruNode);
    }
    div.appendChild(checkbox);
    div.appendChild(label);
    div.addEventListener('click', () => toggleAnswer(q.id, a.id, div));
    container.appendChild(div);
  });

  // Fixed nav
  document.getElementById('navButtons').style.display = 'flex';
  document.getElementById('prevBtn').disabled = currentIndex === 0;
  document.getElementById('nextBtn').textContent = currentIndex === questions.length - 1 ? 'Review →' : 'Next →';
  document.getElementById('navCounter').textContent = `${currentIndex + 1} / ${questions.length}`;

  // Progress
  document.getElementById('progressBar').style.width = `${((currentIndex + 1) / questions.length) * 100}%`;

  // Dots
  updateDots();
  updateBookmarkBtn();

  // Wrap words for click-to-translate
  _wrapWords(document.getElementById('questionText'));
  document.querySelectorAll('#answersContainer .answer-option-label').forEach(_wrapWords);
}

function toggleAnswer(questionId, answerId, clickedDiv) {
  const current = selectedAnswers[questionId] || [];
  const idx = current.indexOf(answerId);
  if (idx === -1) {
    current.push(answerId);
  } else {
    current.splice(idx, 1);
  }
  selectedAnswers[questionId] = current;
  clickedDiv.classList.toggle('selected', current.includes(answerId));
  updateDots();
}

function renderDots() {
  const nav = document.getElementById('dotNav');
  nav.innerHTML = '';
  const max = Math.min(questions.length, 13);
  for (let i = 0; i < max; i++) {
    const dot = document.createElement('button');
    dot.style.cssText = 'width:8px;height:8px;border-radius:50%;border:1px solid var(--border);background:var(--border);cursor:pointer;padding:0;transition:background 0.15s;';
    dot.addEventListener('click', () => {
      currentIndex = i;
      renderQuestion();
    });
    dot.id = `dot-${i}`;
    nav.appendChild(dot);
  }
  if (questions.length > 13) {
    const more = document.createElement('span');
    more.style.cssText = 'font-size:0.75rem;color:var(--text-muted);';
    more.textContent = `+${questions.length - 13}`;
    nav.appendChild(more);
  }
}

function updateDots() {
  for (let i = 0; i < Math.min(questions.length, 13); i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (!dot) continue;
    const q = questions[i];
    const answered = (selectedAnswers[q.id] || []).length > 0;
    if (i === currentIndex) {
      dot.style.background = 'var(--text)';
      dot.style.borderColor = 'var(--text)';
    } else if (answered) {
      dot.style.background = 'var(--text-muted)';
      dot.style.borderColor = 'var(--text-muted)';
    } else {
      dot.style.background = 'var(--border)';
      dot.style.borderColor = 'var(--border)';
    }
  }
}

function prevQuestion() {
  if (currentIndex > 0) { currentIndex--; renderQuestion(); }
}

function nextQuestion() {
  if (currentIndex < questions.length - 1) {
    currentIndex++;
    renderQuestion();
  } else {
    finishTest();
  }
}

// в”Ђв”Ђ Finish modal в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function finishTest() {
  const answered = Object.keys(selectedAnswers).length;
  const total = questions.length;
  const unanswered = total - answered;
  const savedInThisTest = questions.filter(q => bookmarkedIds.has(q.id)).length;
  let summary = `You've answered ${answered} of ${total} questions.`;
  if (unanswered > 0) summary += ` ${unanswered} question${unanswered > 1 ? 's' : ''} unanswered.`;
  if (savedInThisTest > 0) {
    summary += ` You saved ${savedInThisTest} question${savedInThisTest > 1 ? 's' : ''} for review, and they will appear on the results page.`;
  }
  document.getElementById('finishSummary').textContent = summary;
  document.getElementById('finishModal').classList.add('open');
}

function closeFinishModal() {
  document.getElementById('finishModal').classList.remove('open');
}

function openTimeWarningModal() {
  document.getElementById('timeWarningModal')?.classList.add('open');
}

function closeTimeWarningModal() {
  document.getElementById('timeWarningModal')?.classList.remove('open');
}

// в”Ђв”Ђ Submit в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function showSubmitOverlay() {
  const el = document.getElementById('submitOverlay');
  if (el) el.style.display = 'flex';
}

function hideSubmitOverlay() {
  const el = document.getElementById('submitOverlay');
  if (el) el.style.display = 'none';
}

async function submitTest(auto = false) {
  if (isSubmitting) return;
  isSubmitting = true;
  clearInterval(timerInterval);
  closeFinishModal();
  closeTimeWarningModal();
  showSubmitOverlay();

  const btn = document.getElementById('submitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

  try {
    // Starter sample uses the free results flow for all users
    if (TEST_ID === FREE_SAMPLE_TEST_ID) {
      const answers = {};
      questions.forEach(q => { answers[q.id] = selectedAnswers[q.id] || []; });
      const res = await fetch('/api/tests/0/check/free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers })
      });
      const data = await res.json();
      sessionStorage.setItem('freeResult', JSON.stringify({
        data,
        questions,
        selectedAnswers,
        testMeta: { id: FREE_SAMPLE_TEST_ID, title: 'Test 0', total: questions.length }
      }));
      window.location.href = '/results/free';
      return;
    }

    if (TEST_ID === EXAM_MODE_TEST_ID && !attemptId) {
      await ensureExamAttempt();
    }

      // 1. Start attempt
      if (TEST_ID !== EXAM_MODE_TEST_ID) {
        const startQuery = TEST_ID >= 1 && TEST_ID <= 13 ? `?wording=${encodeURIComponent(WORDING_MODE)}` : '';
        const startRes = await fetch(`/api/tests/${TEST_ID}/start${startQuery}`, { method: 'POST' });
        if (startRes.status === 403) { window.location.href = '/pricing'; return; }
        if (!startRes.ok) throw new Error('Failed to start attempt');
        const { attempt_id } = await startRes.json();
      attemptId = attempt_id;
    }

    // 2. Save all answers in a single batch request (was: 25 sequential requests)
    const answers = questions.map(q => ({
      question_id: q.id,
      answer_ids: selectedAnswers[q.id] || []
    }));
    const batchRes = await fetch(`/api/attempts/${attemptId}/answers/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers })
    });
    if (!batchRes.ok) throw new Error('Failed to save answers');

    // 3. Finish
    const finRes = await fetch(`/api/attempts/${attemptId}/finish`, { method: 'POST' });
    if (!finRes.ok) throw new Error('Failed to finish attempt');

    // 4. Redirect to results
    window.location.href = `/test/${TEST_ID}/results/${attemptId}`;

  } catch(e) {
    isSubmitting = false;
    hideSubmitOverlay();
    if (btn) { btn.disabled = false; btn.textContent = 'Submit answers'; }
    showToast('Failed to submit: ' + e.message, 'error');
  }
}

// в”Ђв”Ђ Bookmarks в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
let bookmarkedIds = new Set();

async function loadBookmarks() {
  if (!IS_AUTHENTICATED) return;
  try {
    const res = await fetch('/api/bookmarks');
    if (res.ok) {
      const data = await res.json();
      bookmarkedIds = new Set(data.map(b => b.question_id));
    }
  } catch(e) {}
}

function clearTestToasts() {
  const container = document.getElementById('toast-container');
  if (container) container.innerHTML = '';
  const toast = document.getElementById('testToast');
  if (!toast) return;
  toast.classList.remove('show', 'error');
  toast.textContent = '';
  if (testToastTimer) {
    clearTimeout(testToastTimer);
    testToastTimer = null;
  }
}

function showSingleTestToast(message, type = 'success') {
  clearTestToasts();
  const toast = document.getElementById('testToast');
  if (!toast) {
    showToast(message, type);
    return;
  }
  toast.textContent = message;
  toast.classList.toggle('error', type === 'error');
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  testToastTimer = window.setTimeout(() => {
    toast.classList.remove('show', 'error');
  }, 1800);
}

function updateBookmarkBtn() {
  const q = questions[currentIndex];
  const btn = document.getElementById('bookmarkBtn');
  const icon = document.getElementById('bookmarkIcon');
  if (!btn || !q) return;
  const active = bookmarkedIds.has(q.id);
  btn.classList.toggle('active', active);
  if (icon) icon.setAttribute('fill', active ? 'currentColor' : 'none');
  btn.title = active ? 'Remove bookmark' : 'Bookmark this question';
}

async function toggleBookmark() {
  if (bookmarkRequestInFlight) return;
  if (!IS_AUTHENTICATED) { showSingleTestToast('Sign in to bookmark questions', 'error'); return; }
  const q = questions[currentIndex];
  if (!q) return;
  bookmarkRequestInFlight = true;
  try {
    const res = await fetch(`/api/bookmarks/${q.id}`, { method: 'POST' });
    const data = await res.json();
    if (data.bookmarked) { bookmarkedIds.add(q.id); showSingleTestToast('Bookmarked', 'success'); }
    else { bookmarkedIds.delete(q.id); showSingleTestToast('Bookmark removed', 'success'); }
    const btn = document.getElementById('bookmarkBtn');
    if (btn) {
      btn.classList.remove('pop');
      void btn.offsetWidth;
      btn.classList.add('pop');
    }
    updateBookmarkBtn();
  } catch(e) {
    showSingleTestToast('Failed to bookmark', 'error');
  } finally {
    bookmarkRequestInFlight = false;
  }
}

// в”Ђв”Ђ MyMemory translation (free, no API key) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// ── Translation: pre-translated server-side, instant toggle ──────────────────
let translateMode = false;

function toggleTranslate() {
  translateMode = !translateMode;
  const btn = document.getElementById('translateBtn');
  if (btn) btn.textContent = translateMode ? 'EN' : 'RU';
  renderQuestion();
}

// Word-popup translations come from /api/dictionary/{word}.
// Cached in-memory for the session so re-hovering the same word is instant.
const _wordDictCache = {};
async function _lookupWord(word) {
  const key = (word || '').toLowerCase();
  if (!key) return { main: null, pos: null };
  if (_wordDictCache[key]) return _wordDictCache[key];
  try {
    const res = await fetch('/api/dictionary/' + encodeURIComponent(key));
    if (!res.ok) throw new Error('lookup failed');
    const data = await res.json();
    const result = { main: data.translation || null, pos: data.pos || null };
    _wordDictCache[key] = result;
    return result;
  } catch (e) {
    return { main: null, pos: null };
  }
}

// в”Ђв”Ђ Word-click popup (Duolingo-style) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const _STOP = new Set(['the','a','an','in','to','of','and','or','is','are','you','at','on','for',
  'it','be','as','by','with','from','this','that','not','but','if','up','do','so','we','he',
  'she','they','my','your','all','have','has','had','was','were','will','can','i','its','our',
  'their','into','also','when','then','than','there','about','been','which','who','what']);

let _wordPopup = null;

function _wrapWords(el) {
  if (!el || el.dataset.wrapped) return;
  el.dataset.wrapped = '1';

  function processNode(node) {
    if (node.nodeType === 3) {
      const text = node.textContent;
      if (!/[a-zA-Z]{3,}/.test(text)) return;
      const wrap = document.createElement('span');
      appendWordWrappedText(wrap, text, _STOP);
      node.parentNode.replaceChild(wrap, node);
    } else if (node.nodeType === 1 &&
               !['SCRIPT','STYLE','INPUT','TEXTAREA'].includes(node.tagName) &&
               !node.classList.contains('tw')) {
      Array.from(node.childNodes).forEach(processNode);
    }
  }

  Array.from(el.childNodes).forEach(processNode);
}

function _popupPos(popup, rect) {
  const pw = popup.offsetWidth;
  const ph = popup.offsetHeight;
  const left = Math.max(4, Math.min(rect.left + rect.width / 2 - pw / 2, window.innerWidth - pw - 4));
  const top = rect.top + window.scrollY - ph - 10;
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
}

let _popupHideTimer = null;

document.addEventListener('mouseover', (e) => {
  if (!e.target.classList.contains('tw')) return;
  clearTimeout(_popupHideTimer);
  const word = e.target.textContent.trim();
  if (!word || _STOP.has(word.toLowerCase()) || word.length < 3) return;
  if (_wordPopup) { _wordPopup.remove(); _wordPopup = null; }

  const popup = document.createElement('div');
  popup.className = 'word-popup';
  setWordPopupLoading(popup, word);
  document.body.appendChild(popup);
  _wordPopup = popup;

  const rect = e.target.getBoundingClientRect();
  _popupPos(popup, rect);

  _lookupWord(word).then(result => {
    if (_wordPopup !== popup) return;
    setWordPopupResult(popup, word, result);
    _popupPos(popup, rect);
  });
});

document.addEventListener('mouseout', (e) => {
  if (!e.target.classList.contains('tw')) return;
  _popupHideTimer = setTimeout(() => {
    if (_wordPopup) { _wordPopup.remove(); _wordPopup = null; }
  }, 120);
});

function syncQuestionImageZoomState(hasImage) {
  const openBtn = document.getElementById('openQuestionImageBtn');
  if (openBtn) {
    openBtn.hidden = !hasImage;
  }
  if (!hasImage && imageZoomOpen) {
    closeQuestionImageZoom();
  }
}

function openQuestionImageZoom() {
  const img = document.getElementById('questionImg');
  const overlay = document.getElementById('imageZoomOverlay');
  const zoomImg = document.getElementById('imageZoomImg');
  if (!img || !overlay || !zoomImg || img.style.display === 'none' || !img.src) return;
  zoomImg.src = img.src;
  zoomImg.alt = img.alt || 'Question image enlarged';
  setImageMagnifierActive(false);
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  imageZoomOpen = true;
}

function closeQuestionImageZoom() {
  const overlay = document.getElementById('imageZoomOverlay');
  const zoomImg = document.getElementById('imageZoomImg');
  if (!overlay || !zoomImg) return;
  setImageMagnifierActive(false);
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  zoomImg.src = '';
  document.body.style.overflow = '';
  imageZoomOpen = false;
}

function setImageMagnifierActive(nextState) {
  imageMagnifierActive = Boolean(nextState);
  const toggleBtn = document.getElementById('toggleImageMagnifierBtn');
  const zoomImg = document.getElementById('imageZoomImg');
  const hint = document.getElementById('imageZoomHint');
  if (toggleBtn) {
    toggleBtn.classList.toggle('active', imageMagnifierActive);
    toggleBtn.innerHTML = imageMagnifierActive
      ? '<i class="fa-solid fa-magnifying-glass-minus"></i><span>Magnifier on</span>'
      : '<i class="fa-solid fa-magnifying-glass-plus"></i><span>Magnifier</span>';
  }
  if (zoomImg) {
    zoomImg.classList.toggle('magnifier-active', imageMagnifierActive);
    if (!imageMagnifierActive) {
      zoomImg.style.transformOrigin = 'center center';
    }
  }
  if (hint) {
    hint.textContent = imageMagnifierActive
      ? 'Move over the image to inspect details more closely.'
      : 'Open image for a closer look.';
  }
}

function toggleImageMagnifier() {
  if (!imageZoomOpen) return;
  setImageMagnifierActive(!imageMagnifierActive);
}

function handleMagnifierPointerMove(event) {
  if (!imageMagnifierActive) return;
  const zoomImg = document.getElementById('imageZoomImg');
  if (!zoomImg) return;
  const rect = zoomImg.getBoundingClientRect();
  let clientX;
  let clientY;
  if (event.touches && event.touches[0]) {
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
    event.preventDefault();
  } else {
    clientX = event.clientX;
    clientY = event.clientY;
  }
  const x = Math.min(Math.max(((clientX - rect.left) / rect.width) * 100, 0), 100);
  const y = Math.min(Math.max(((clientY - rect.top) / rect.height) * 100, 0), 100);
  zoomImg.style.transformOrigin = `${x}% ${y}%`;
}

function resetMagnifierFocus() {
  if (!imageMagnifierActive) return;
  const zoomImg = document.getElementById('imageZoomImg');
  if (zoomImg) {
    zoomImg.style.transformOrigin = 'center center';
  }
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && imageZoomOpen) {
    closeQuestionImageZoom();
  }
});


