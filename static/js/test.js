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
let timeWarningShown = false;
let bookmarkRequestInFlight = false;
let testToastTimer = null;
let speechVoices = [];
const speechPrefs = {
  voiceURI: localStorage.getItem('wexVoiceURI') || '',
};
const liveTranslationCache = new Map();
let liveTranslationRequestKey = '';

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
  initSpeechControls();
  initQuestionPanZoom();
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

function normalizeTranslationText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function needsLiveTranslation(sourceText, ruText, translationSourceText) {
  const source = normalizeTranslationText(sourceText);
  if (!source) return false;
  if (!ruText) return true;
  const storedSource = normalizeTranslationText(translationSourceText || sourceText);
  return storedSource && storedSource !== source;
}

function getTranslatedText(sourceText, storedRu, translationSourceText) {
  if (!needsLiveTranslation(sourceText, storedRu, translationSourceText)) {
    return storedRu || '';
  }
  const key = normalizeTranslationText(sourceText);
  return liveTranslationCache.has(key) ? (liveTranslationCache.get(key) || '') : '';
}

function isLiveTranslationPending(sourceText, storedRu, translationSourceText) {
  const key = normalizeTranslationText(sourceText);
  return needsLiveTranslation(sourceText, storedRu, translationSourceText) && key && !liveTranslationCache.has(key);
}

function queueLiveTranslationsForQuestion(q) {
  if (!translateMode || !q) return;
  const missing = [];
  const addIfNeeded = (text, ru, translationSourceText) => {
    const key = normalizeTranslationText(text);
    if (!needsLiveTranslation(text, ru, translationSourceText) || !key || liveTranslationCache.has(key)) return;
    missing.push(key);
  };
  addIfNeeded(q.question_text, q.question_text_ru, q.translation_source_text);
  q.answers.forEach((a) => addIfNeeded(a.text, a.text_ru, a.translation_source_text));
  const unique = Array.from(new Set(missing));
  if (!unique.length) return;
  const requestKey = unique.join('\n');
  if (requestKey === liveTranslationRequestKey) return;
  liveTranslationRequestKey = requestKey;
  fetch('/api/translate/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts: unique })
  })
    .then((res) => res.ok ? res.json() : null)
    .then((data) => {
      const translations = data?.translations || {};
      unique.forEach((text) => {
        liveTranslationCache.set(text, translations[text] || '');
      });
      if (translateMode && questions[currentIndex]?.id === q.id) renderQuestion();
    })
    .catch(() => {
      unique.forEach((text) => liveTranslationCache.set(text, ''));
      if (translateMode && questions[currentIndex]?.id === q.id) renderQuestion();
    })
    .finally(() => {
      if (liveTranslationRequestKey === requestKey) liveTranslationRequestKey = '';
    });
}

function initSpeechControls() {
  const select = document.getElementById('voiceSelect');
  if (!('speechSynthesis' in window)) {
    select?.setAttribute('disabled', 'disabled');
    return;
  }

  const populate = () => {
    speechVoices = window.speechSynthesis.getVoices();
    if (!select) return;
    const preferred = speechPrefs.voiceURI || select.value;
    select.innerHTML = '';
    const auto = document.createElement('option');
    auto.value = '';
    auto.textContent = 'Voice';
    select.appendChild(auto);
    speechVoices
      .filter((voice) => /^en|^ru/i.test(voice.lang || ''))
      .forEach((voice) => {
        const option = document.createElement('option');
        option.value = voice.voiceURI;
        option.textContent = `${voice.lang} ${voice.name}`;
        select.appendChild(option);
      });
    if (preferred && Array.from(select.options).some((option) => option.value === preferred)) {
      select.value = preferred;
    }
  };

  populate();
  window.speechSynthesis.onvoiceschanged = populate;
  select?.addEventListener('change', () => {
    speechPrefs.voiceURI = select.value;
    localStorage.setItem('wexVoiceURI', speechPrefs.voiceURI);
  });
}

function selectedSpeechVoice(text) {
  if (!speechVoices.length && 'speechSynthesis' in window) {
    speechVoices = window.speechSynthesis.getVoices();
  }
  if (speechPrefs.voiceURI) {
    const selected = speechVoices.find((voice) => voice.voiceURI === speechPrefs.voiceURI);
    if (selected) return selected;
  }
  const wantsRu = /[^\x00-\x7F]/.test(text || '');
  return speechVoices.find((voice) => (voice.lang || '').toLowerCase().startsWith(wantsRu ? 'ru' : 'en')) || null;
}

function speakText(text, btn) {
  const spoken = normalizeTranslationText(text);
  if (!spoken || !('speechSynthesis' in window)) return;
  if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(spoken);
  const voice = selectedSpeechVoice(spoken);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = /[^\x00-\x7F]/.test(spoken) ? 'ru-RU' : 'en-GB';
  }
  document.querySelectorAll('.speak-btn.speaking').forEach((el) => el.classList.remove('speaking'));
  if (btn) btn.classList.add('speaking');
  utterance.onend = utterance.onerror = () => btn?.classList.remove('speaking');
  window.speechSynthesis.speak(utterance);
}

function getQuestionSpeechText(q) {
  if (!translateMode) return q.question_text;
  return getTranslatedText(q.question_text, q.question_text_ru, q.translation_source_text) || q.question_text_ru || q.question_text;
}

function getAnswerSpeechText(answer) {
  if (!translateMode) return answer.text;
  return getTranslatedText(answer.text, answer.text_ru, answer.translation_source_text) || answer.text_ru || answer.text;
}

function createSpeakButton(textGetter, title = 'Listen') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'speak-btn';
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"></path><path d="M15.5 8.5a5 5 0 0 1 0 7"></path><path d="M18.5 5.5a9 9 0 0 1 0 13"></path></svg>';
  btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    speakText(textGetter(), btn);
  });
  return btn;
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
  const questionRu = translateMode ? getTranslatedText(q.question_text, q.question_text_ru, q.translation_source_text) : '';
  if (translateMode && questionRu) {
    qRuEl.textContent = questionRu;
    qRuEl.style.display = 'block';
  } else if (translateMode && isLiveTranslationPending(q.question_text, q.question_text_ru, q.translation_source_text)) {
    qRuEl.textContent = 'Translating...';
    qRuEl.style.display = 'block';
  } else {
    qRuEl.style.display = 'none';
  }

  const qSpeakWrap = document.getElementById('questionSpeakWrap');
  if (qSpeakWrap) {
    qSpeakWrap.replaceChildren(createSpeakButton(() => getQuestionSpeechText(q), 'Listen to question'));
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
  // Hard reset pan-zoom every render so a new question always lands at 1x
  document.getElementById('imageWrap')?.classList.toggle('has-image', Boolean(q.image_path));

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
    const ruText = translateMode ? getTranslatedText(a.text, a.text_ru, a.translation_source_text) : null;
    if (ruText) {
      label.appendChild(document.createElement('br'));
      const ruNode = document.createElement('span');
      ruNode.style.cssText = 'font-size:0.85rem;color:#6b7280;font-style:italic;';
      ruNode.textContent = ruText;
      label.appendChild(ruNode);
    } else if (translateMode && isLiveTranslationPending(a.text, a.text_ru, a.translation_source_text)) {
      label.appendChild(document.createElement('br'));
      const ruNode = document.createElement('span');
      ruNode.style.cssText = 'font-size:0.85rem;color:#6b7280;font-style:italic;';
      ruNode.textContent = 'Translating...';
      label.appendChild(ruNode);
    }
    div.appendChild(checkbox);
    div.appendChild(label);
    div.appendChild(createSpeakButton(() => getAnswerSpeechText(a), 'Listen to answer'));
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

  queueLiveTranslationsForQuestion(q);
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

// ── Question image: click to open lightbox ────────────────────────────────
function initQuestionPanZoom() {
  const wrap = document.getElementById("imageWrap");
  if (!wrap) return;
  wrap.addEventListener("click", () => {
    const img = document.getElementById("questionImg");
    if (!img || img.style.display === "none" || !img.src) return;
    if (typeof window.openImageLightbox === "function") {
      window.openImageLightbox(img.src, img.alt || "");
    }
  });
}
