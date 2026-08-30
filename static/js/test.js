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
let speechState = { button: null, text: '', paused: false };
let voiceUsage = {};
const liveTranslationCache = new Map();
let liveTranslationRequestKey = '';
const wordHelpContexts = new WeakMap();
const wordHelpCache = new Map();
let wordHelpRequestId = 0;
let wordHelpSelectionTimer = null;

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
  document.getElementById('flagBtn')?.addEventListener('click', toggleFlag);
  document.getElementById('mapBtn')?.addEventListener('click', toggleQuestionMap);
  document.getElementById('mapCloseBtn')?.addEventListener('click', closeQuestionMap);
  document.getElementById('questionMap')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeQuestionMap();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeQuestionMap();
  });
  document.getElementById('finishModalCloseBtn')?.addEventListener('click', closeFinishModal);
  document.getElementById('finishKeepGoingBtn')?.addEventListener('click', closeFinishModal);
  document.getElementById('submitBtn')?.addEventListener('click', () => submitTest());
  document.getElementById('timeWarningCloseBtn')?.addEventListener('click', closeTimeWarningModal);
  document.getElementById('timeWarningOkBtn')?.addEventListener('click', closeTimeWarningModal);
  initSpeechControls();
  initWordHelp();
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
  loadFlags();
  updateFlagBtn();
  refreshQuestionMap();
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

function getWordHelpContextTranslation(sourceText, storedRu, translationSourceText) {
  const translated = getTranslatedText(sourceText, storedRu, translationSourceText);
  if (translated) return translated;
  // Exam-style wording may differ from the sentence that the stored Russian
  // text was translated from. Showing no context is safer than showing the
  // wrong sentence as if it matched the selected wording.
  return needsLiveTranslation(sourceText, storedRu, translationSourceText)
    ? ''
    : (storedRu || '');
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

function normalizeWordHelpSelection(value) {
  return String(value || '')
    .replace(/’/g, "'")
    .trim()
    .replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '')
    .replace(/\s+/g, ' ');
}

function isValidWordHelpSelection(value) {
  const normalized = normalizeWordHelpSelection(value);
  if (!normalized || normalized.length > 96) return false;
  const words = normalized.split(' ');
  return words.length <= 5 && words.every((word) => /^[A-Za-z]+(?:['-][A-Za-z]+)*$/.test(word));
}

function hasSelectionInsideElement(element) {
  const selection = window.getSelection?.();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return false;
  const range = selection.getRangeAt(0);
  const startNode = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer
    : range.startContainer.parentElement;
  const endNode = range.endContainer.nodeType === Node.ELEMENT_NODE
    ? range.endContainer
    : range.endContainer.parentElement;
  if (!startNode || !endNode || !element.contains(startNode) || !element.contains(endNode)) return false;
  return range.toString().length > 0;
}

function closeWordHelp(clearSelection = false) {
  const popup = document.getElementById('wordHelpPopup');
  if (popup) popup.hidden = true;
  wordHelpRequestId += 1;
  if (clearSelection) window.getSelection?.()?.removeAllRanges();
}

function dismissWordHelpHint() {
  document.getElementById('wordHelpHint')?.setAttribute('hidden', '');
  try { localStorage.setItem('wex-word-help-hint-seen', '1'); } catch (e) {}
}

function positionWordHelpPopup(rect) {
  const popup = document.getElementById('wordHelpPopup');
  if (!popup || !rect) return;
  popup.style.visibility = 'hidden';
  popup.hidden = false;
  const gap = 12;
  const width = popup.offsetWidth;
  const height = popup.offsetHeight;
  let left = rect.left + (rect.width / 2) - (width / 2);
  left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
  let top = rect.top - height - gap;
  if (top < 12) top = Math.min(window.innerHeight - height - 12, rect.bottom + gap);
  popup.style.left = `${Math.max(12, left)}px`;
  popup.style.top = `${Math.max(12, top)}px`;
  popup.style.visibility = '';
}

function wordHelpSourceLabel(result) {
  if (result?.source === 'curated_context') return 'Фраза из контекста';
  if (result?.source === 'curated_phrase') return 'Дорожная фраза';
  if (result?.source === 'curated') return 'Словарное значение';
  if (result?.source === 'automatic') return 'Общее значение';
  if (result?.source === 'composed_gloss') return 'По словам · не готовый перевод';
  return '';
}

function renderWordHelpResult(selection, contextRu, result, rect) {
  const popup = document.getElementById('wordHelpPopup');
  const selectedEl = document.getElementById('wordHelpSelected');
  const translationEl = document.getElementById('wordHelpTranslation');
  const badgeEl = document.getElementById('wordHelpSourceBadge');
  const contextEl = document.getElementById('wordHelpContext');
  const contextTextEl = document.getElementById('wordHelpContextText');
  const glosses = Array.isArray(result?.glosses)
    ? result.glosses.filter((item) => item?.term && item?.translation)
    : [];
  const isLoading = result?.source === 'loading';
  const isError = result?.source === 'error';
  const hasTranslation = typeof result?.translation === 'string' && result.translation.trim();
  const state = isLoading
    ? 'loading'
    : (hasTranslation || glosses.length ? 'ready' : (isError ? 'error' : 'unavailable'));
  const matched = normalizeWordHelpSelection(result?.matched_term || '');
  if (popup) {
    popup.dataset.state = state;
    popup.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  }
  if (selectedEl) {
    selectedEl.textContent = matched && matched.toLowerCase() !== selection.toLowerCase()
      ? `${selection} → ${matched}`
      : selection;
  }
  if (translationEl) {
    if (isLoading) {
      translationEl.textContent = 'Ищем в словаре…';
    } else if (glosses.length) {
      translationEl.textContent = glosses
        .map((item) => `${item.term} — ${item.translation}`)
        .join('\n');
    } else if (hasTranslation) {
      translationEl.textContent = result.translation.trim();
    } else if (isError) {
      translationEl.textContent = 'Не удалось загрузить. Попробуйте ещё раз.';
    } else {
      translationEl.textContent = 'Отдельного значения пока нет';
    }
    translationEl.classList.toggle('is-glosses', glosses.length > 0);
  }
  const sourceLabel = state === 'ready' ? wordHelpSourceLabel(result) : '';
  if (badgeEl) {
    badgeEl.textContent = sourceLabel;
    badgeEl.hidden = !sourceLabel;
  }
  if (contextEl && contextTextEl) {
    contextTextEl.textContent = contextRu || '';
    contextEl.hidden = isLoading || !contextRu;
  }
  positionWordHelpPopup(rect);
}

async function openWordHelp(selectionData) {
  const popup = document.getElementById('wordHelpPopup');
  if (!popup || !selectionData) return;
  const { selection, sourceText, contextRu, start, end, rect } = selectionData;
  const cacheKey = `${sourceText}\n${start}:${end}\n${selection.toLowerCase()}`;
  dismissWordHelpHint();
  renderWordHelpResult(selection, contextRu, { source: 'loading' }, rect);
  const requestId = ++wordHelpRequestId;
  let result = wordHelpCache.get(cacheKey);
  if (!result) {
    let cacheable = false;
    try {
      const response = await fetch('/api/translate/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selection,
          source_text: sourceText,
          selection_start: start,
          selection_end: end,
        }),
      });
      if (response.ok) {
        result = await response.json();
        cacheable = true;
      } else {
        result = { translation: null, source: 'error' };
      }
    } catch (e) {
      result = { translation: null, source: 'error' };
    }
    if (cacheable) {
      wordHelpCache.set(cacheKey, result);
    }
  }
  if (requestId !== wordHelpRequestId || popup.hidden) return;
  renderWordHelpResult(selection, contextRu, result, rect);
}

function inspectWordHelpSelection() {
  const selection = window.getSelection?.();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer
    : range.startContainer.parentElement;
  const endElement = range.endContainer.nodeType === Node.ELEMENT_NODE
    ? range.endContainer
    : range.endContainer.parentElement;
  const sourceElement = startElement?.closest?.('.word-help-source');
  if (!sourceElement || sourceElement !== endElement?.closest?.('.word-help-source')) return;

  const selectedText = normalizeWordHelpSelection(range.toString());
  if (!isValidWordHelpSelection(selectedText)) return;
  const context = wordHelpContexts.get(sourceElement);
  if (!context) return;

  const prefixRange = document.createRange();
  prefixRange.selectNodeContents(sourceElement);
  prefixRange.setEnd(range.startContainer, range.startOffset);
  const selectedRange = document.createRange();
  selectedRange.selectNodeContents(sourceElement);
  selectedRange.setEnd(range.endContainer, range.endOffset);
  const start = prefixRange.toString().length;
  const end = selectedRange.toString().length;
  const rect = range.getBoundingClientRect();
  if (!rect || (!rect.width && !rect.height)) return;
  openWordHelp({
    selection: selectedText,
    sourceText: context.sourceText,
    contextRu: context.contextRu,
    start,
    end,
    rect,
  });
}

function scheduleWordHelpInspection(delay = 0) {
  window.clearTimeout(wordHelpSelectionTimer);
  wordHelpSelectionTimer = window.setTimeout(inspectWordHelpSelection, delay);
}

function initWordHelp() {
  const hint = document.getElementById('wordHelpHint');
  try {
    if (localStorage.getItem('wex-word-help-hint-seen') === '1') hint?.setAttribute('hidden', '');
  } catch (e) {}
  document.getElementById('wordHelpHintClose')?.addEventListener('click', dismissWordHelpHint);
  document.getElementById('wordHelpClose')?.addEventListener('click', () => closeWordHelp(true));
  document.addEventListener('pointerup', () => scheduleWordHelpInspection(0));
  document.addEventListener('keyup', (event) => {
    if (event.key === 'Escape') {
      closeWordHelp(true);
      return;
    }
    scheduleWordHelpInspection(0);
  });
  document.addEventListener('selectionchange', () => scheduleWordHelpInspection(420));
  window.addEventListener('resize', () => closeWordHelp(false), { passive: true });
  document.addEventListener('pointerdown', (event) => {
    const popup = document.getElementById('wordHelpPopup');
    if (!popup || popup.hidden || popup.contains(event.target)) return;
    // Keep the native selection alive while the user adjusts mobile handles.
    // A normal click elsewhere will collapse it on its own.
    closeWordHelp(false);
  }, true);
}

function attachAnswerOptionInteraction(option, sourceElement, questionId, answerId) {
  const gesture = {
    startedAt: 0,
    x: 0,
    y: 0,
    moved: false,
    cancelled: false,
    pointerType: '',
  };
  let pendingTextClick = 0;
  const cancelPendingTextClick = () => {
    window.clearTimeout(pendingTextClick);
    pendingTextClick = 0;
  };

  option.addEventListener('pointerdown', (event) => {
    if (event.isPrimary === false || event.button > 0) return;
    if (
      pendingTextClick
      && (event.pointerType || 'mouse') === 'mouse'
      && sourceElement.contains(event.target)
    ) {
      // The second pointerdown arrives before the second click/dblclick, so it
      // can cancel the pending single-click toggle without blocking selection.
      cancelPendingTextClick();
    }
    gesture.startedAt = performance.now();
    gesture.x = event.clientX;
    gesture.y = event.clientY;
    gesture.moved = false;
    gesture.cancelled = false;
    gesture.pointerType = event.pointerType || '';
  });
  option.addEventListener('pointermove', (event) => {
    if (!gesture.startedAt) return;
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 7) {
      gesture.moved = true;
    }
  });
  option.addEventListener('pointercancel', () => {
    gesture.cancelled = true;
    gesture.startedAt = 0;
    cancelPendingTextClick();
  });
  option.addEventListener('click', (event) => {
    const onSourceText = sourceElement.contains(event.target);
    const pointerType = gesture.pointerType || 'mouse';
    const held = gesture.startedAt && performance.now() - gesture.startedAt > 450;
    const hasSelection = hasSelectionInsideElement(sourceElement);
    const isMouseMultiClick = onSourceText
      && pointerType === 'mouse'
      && event.detail >= 2;
    gesture.startedAt = 0;
    if (gesture.cancelled || gesture.moved || held || hasSelection || isMouseMultiClick) {
      cancelPendingTextClick();
      scheduleWordHelpInspection(0);
      return;
    }

    if (onSourceText && pointerType === 'mouse') {
      // Delay only mouse clicks directly on text so a second click can turn
      // them into native word selection. Checkbox/padding and touch stay fast.
      cancelPendingTextClick();
      pendingTextClick = window.setTimeout(() => {
        pendingTextClick = 0;
        if (!option.isConnected || questions[currentIndex]?.id !== questionId) return;
        if (hasSelectionInsideElement(sourceElement)) {
          scheduleWordHelpInspection(0);
          return;
        }
        toggleAnswer(questionId, answerId, option);
      }, 420);
      return;
    }

    toggleAnswer(questionId, answerId, option);
  });
  sourceElement.addEventListener('dblclick', () => {
    cancelPendingTextClick();
    window.requestAnimationFrame(inspectWordHelpSelection);
  });
  option.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    cancelPendingTextClick();
    event.preventDefault();
    toggleAnswer(questionId, answerId, option);
  });
}

function loadVoiceUsage() {
  try {
    voiceUsage = JSON.parse(localStorage.getItem('wexVoiceUsage') || '{}') || {};
  } catch (e) {
    voiceUsage = {};
  }
}

function saveVoiceUsage(voiceURI) {
  if (!voiceURI) return;
  voiceUsage[voiceURI] = (voiceUsage[voiceURI] || 0) + 1;
  localStorage.setItem('wexVoiceUsage', JSON.stringify(voiceUsage));
}

function voiceLanguageMode(text) {
  return /[^\x00-\x7F]/.test(text || '') ? 'ru' : 'en';
}

function isUsefulVoice(voice) {
  return Boolean(voice && (voice.voiceURI || voice.name));
}

function voiceStudyScore(voice) {
  const lang = (voice.lang || '').toLowerCase();
  const name = (voice.name || '').toLowerCase();
  let score = 0;
  if (lang === 'en-gb') score += 80;
  if (lang === 'en-us') score += 70;
  if (lang === 'en-au' || lang === 'en-ca') score += 45;
  if (lang === 'ru-ru') score += 30;
  if (name.includes('google')) score += 35;
  if (name.includes('female')) score += 16;
  if (name.includes('male')) score += 12;
  if (name.includes('microsoft')) score += 10;
  if (name.includes('aria') || name.includes('libby') || name.includes('sonia')) score += 22;
  if (name.includes('david') || name.includes('mark') || name.includes('ryan') || name.includes('george')) score += 16;
  if (name.includes('irina') || name.includes('pavel') || name.includes('google')) score += 10;
  return score;
}

function voiceDisplayName(voice) {
  const lang = (voice.lang || '').toLowerCase();
  const rawName = (voice.name || '').replace(/^Google\s+/i, '').replace(/^Microsoft\s+/i, '').trim();
  const cleaned = rawName
    .replace(/\bUS English\b/i, 'English')
    .replace(/\bUK English\b/i, 'English')
    .replace(/\s+-\s+/g, ' ')
    .trim();
  if (lang === 'en-us') return cleaned && cleaned !== 'English' ? `US ${cleaned}` : 'US English';
  if (lang === 'en-gb') return cleaned && cleaned !== 'English' ? `UK ${cleaned}` : 'UK English';
  if (lang === 'ru-ru') return cleaned || 'Russian';
  if (lang === 'da-dk') return cleaned || 'Danish';
  return cleaned || (voice.lang || 'Voice');
}

function voiceGroupRank(voice) {
  const lang = (voice.lang || '').toLowerCase();
  if (voiceStudyScore(voice) >= 80) return 0;
  if (lang.startsWith('en')) return 1;
  if (lang.startsWith('ru')) return 2;
  if (lang.startsWith('da')) return 3;
  return 4;
}

function filteredVoices() {
  const seen = new Set();
  return speechVoices
    .filter(isUsefulVoice)
    .filter((voice) => {
      const key = `${voice.lang}|${voice.name}|${voice.voiceURI}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function sortedVoices(searchTerm = '') {
  const query = searchTerm.trim().toLowerCase();
  return filteredVoices()
    .filter((voice) => {
      if (!query) return true;
      return `${voice.lang} ${voice.name}`.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      const used = (voiceUsage[b.voiceURI] || 0) - (voiceUsage[a.voiceURI] || 0);
      if (used) return used;
      const group = voiceGroupRank(a) - voiceGroupRank(b);
      if (group) return group;
      const recommended = voiceStudyScore(b) - voiceStudyScore(a);
      if (recommended) return recommended;
      return voiceDisplayName(a).localeCompare(voiceDisplayName(b));
    });
}

function updateVoicePickerLabel() {
  const label = document.getElementById('voicePickerLabel');
  if (!label) return;
  const selected = speechVoices.find((voice) => voice.voiceURI === speechPrefs.voiceURI);
  label.textContent = selected ? voiceDisplayName(selected) : 'Study voice';
}

function renderVoiceList(searchTerm = '') {
  const list = document.getElementById('voiceList');
  if (!list) return;
  list.innerHTML = '';
  const voices = sortedVoices(searchTerm);
  if (!voices.length) {
    const empty = document.createElement('div');
    empty.className = 'voice-group-title';
    empty.textContent = 'No matching voices';
    list.appendChild(empty);
    return;
  }
  let lastGroup = '';
  voices.forEach((voice) => {
    const used = voiceUsage[voice.voiceURI] || 0;
    const score = voiceStudyScore(voice);
        const lang = (voice.lang || '').toLowerCase();
        let group = 'Other languages';
        if (used) group = 'Frequently used';
        else if (score >= 80) group = 'Recommended for study';
        else if (lang.startsWith('en')) group = 'English voices';
        else if (lang.startsWith('ru')) group = 'Russian translation';
        else if (lang.startsWith('da')) group = 'Danish voices';
    if (group !== lastGroup && !searchTerm.trim()) {
      const title = document.createElement('div');
      title.className = 'voice-group-title';
      title.textContent = group;
      list.appendChild(title);
      lastGroup = group;
    }
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'voice-option' + (voice.voiceURI === speechPrefs.voiceURI ? ' active' : '');
    const main = document.createElement('span');
    main.className = 'voice-option-main';
    main.textContent = voiceDisplayName(voice);
    const meta = document.createElement('span');
    meta.className = 'voice-option-meta';
    meta.textContent = `${(voice.lang || '').toUpperCase()}${score >= 80 ? ' · recommended' : ''}${used ? ` · used ${used}x` : ''}`;
    option.appendChild(main);
    option.appendChild(meta);
    option.addEventListener('click', () => {
      speechPrefs.voiceURI = voice.voiceURI;
      localStorage.setItem('wexVoiceURI', speechPrefs.voiceURI);
      saveVoiceUsage(voice.voiceURI);
      updateVoicePickerLabel();
      renderVoiceList(document.getElementById('voiceSearchInput')?.value || '');
      document.getElementById('voicePicker')?.classList.remove('open');
    });
    list.appendChild(option);
  });
}

function initSpeechControls() {
  const picker = document.getElementById('voicePicker');
  const button = document.getElementById('voicePickerBtn');
  const search = document.getElementById('voiceSearchInput');
  if (!('speechSynthesis' in window)) {
    button?.setAttribute('disabled', 'disabled');
    return;
  }
  loadVoiceUsage();
  const populate = () => {
    speechVoices = window.speechSynthesis.getVoices();
    updateVoicePickerLabel();
    renderVoiceList(search?.value || '');
  };
  populate();
  window.speechSynthesis.onvoiceschanged = populate;
  button?.addEventListener('click', (event) => {
    event.stopPropagation();
    picker?.classList.toggle('open');
    if (picker?.classList.contains('open')) {
      renderVoiceList(search?.value || '');
      setTimeout(() => search?.focus(), 0);
    }
  });
  search?.addEventListener('input', () => renderVoiceList(search.value));
  document.addEventListener('click', (event) => {
    if (picker && !picker.contains(event.target)) picker.classList.remove('open');
  });
}

function selectedSpeechVoice(text) {
  if (!speechVoices.length && 'speechSynthesis' in window) {
    speechVoices = window.speechSynthesis.getVoices();
  }
  const mode = voiceLanguageMode(text);
  if (speechPrefs.voiceURI) {
    const selected = speechVoices.find((voice) => voice.voiceURI === speechPrefs.voiceURI);
    if (selected && (selected.lang || '').toLowerCase().startsWith(mode)) return selected;
  }
  return filteredVoices()
    .filter((voice) => (voice.lang || '').toLowerCase().startsWith(mode))
    .sort((a, b) => voiceStudyScore(b) - voiceStudyScore(a))[0] || null;
}

function clearSpeechButtons() {
  document.querySelectorAll('.speak-btn.speaking, .speak-btn.paused').forEach((el) => {
    el.classList.remove('speaking', 'paused');
  });
}

function speakText(text, btn) {
  const spoken = normalizeTranslationText(text);
  if (!spoken || !('speechSynthesis' in window)) return;
  const sameButton = speechState.button === btn && speechState.text === spoken;
  if (sameButton && (window.speechSynthesis.speaking || window.speechSynthesis.paused)) {
    window.speechSynthesis.cancel();
    clearSpeechButtons();
    speechState = { button: null, text: '', paused: false };
    return;
  }
  if (window.speechSynthesis.speaking || window.speechSynthesis.paused) {
    window.speechSynthesis.cancel();
  }
  clearSpeechButtons();
  const utterance = new SpeechSynthesisUtterance(spoken);
  const voice = selectedSpeechVoice(spoken);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = voiceLanguageMode(spoken) === 'ru' ? 'ru-RU' : 'en-GB';
  }
  speechState = { button: btn, text: spoken, paused: false };
  if (btn) btn.classList.add('speaking');
  utterance.onend = utterance.onerror = () => {
    if (speechState.button === btn) speechState = { button: null, text: '', paused: false };
    btn?.classList.remove('speaking', 'paused');
  };
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
  closeWordHelp(true);
  const q = questions[currentIndex];

  document.getElementById('questionCounter').textContent = `Question ${currentIndex + 1} of ${questions.length}`;

  // Question text
  const qTextEl = document.getElementById('questionText');
  qTextEl.textContent = q.question_text;
  qTextEl.classList.add('word-help-source');
  qTextEl.dataset.sourceText = q.question_text;
  delete qTextEl.dataset.wrapped;
  wordHelpContexts.set(qTextEl, {
    sourceText: q.question_text,
    contextRu: getWordHelpContextTranslation(
      q.question_text,
      q.question_text_ru,
      q.translation_source_text,
    ),
  });

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
    div.tabIndex = 0;
    div.setAttribute('role', 'checkbox');
    div.setAttribute('aria-checked', selected.includes(a.id) ? 'true' : 'false');
    const checkbox = document.createElement('div');
    checkbox.className = 'answer-checkbox';
    checkbox.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'answer-option-label';
    const sourceNode = document.createElement('span');
    sourceNode.className = 'word-help-source';
    sourceNode.textContent = a.text;
    sourceNode.dataset.sourceText = a.text;
    label.appendChild(sourceNode);
    wordHelpContexts.set(sourceNode, {
      sourceText: a.text,
      contextRu: getWordHelpContextTranslation(
        a.text,
        a.text_ru,
        a.translation_source_text,
      ),
    });
    const ruText = translateMode ? getTranslatedText(a.text, a.text_ru, a.translation_source_text) : null;
    if (ruText) {
      const ruNode = document.createElement('span');
      ruNode.className = 'answer-translation';
      ruNode.textContent = ruText;
      label.appendChild(ruNode);
    } else if (translateMode && isLiveTranslationPending(a.text, a.text_ru, a.translation_source_text)) {
      const ruNode = document.createElement('span');
      ruNode.className = 'answer-translation';
      ruNode.textContent = 'Translating...';
      label.appendChild(ruNode);
    }
    div.appendChild(checkbox);
    div.appendChild(label);
    div.appendChild(createSpeakButton(() => getAnswerSpeechText(a), 'Listen to answer'));
    attachAnswerOptionInteraction(div, sourceNode, q.id, a.id);
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
  updateFlagBtn();
  refreshQuestionMap();

  queueLiveTranslationsForQuestion(q);
  preloadNearbyQuestionImages();
}

function preloadNearbyQuestionImages() {
  const preloadIndexes = [currentIndex + 1, currentIndex + 2];
  preloadIndexes.forEach((idx) => {
    const next = questions[idx];
    if (!next || !next.image_path) return;
    const image = new Image();
    image.decoding = 'async';
    image.src = '/test-images/' + next.image_path;
  });
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
  clickedDiv.setAttribute('aria-checked', current.includes(answerId) ? 'true' : 'false');
  updateDots();
  refreshQuestionMap();
}

const FLAG_STORAGE_KEY = `wexFlags:${TEST_ID}`;
let flaggedQuestions = new Set();

function loadFlags() {
  try {
    const stored = JSON.parse(localStorage.getItem(FLAG_STORAGE_KEY) || '[]');
    const known = new Set(questions.map((q) => q.id));
    flaggedQuestions = new Set((Array.isArray(stored) ? stored : []).filter((id) => known.has(id)));
  } catch (e) {
    flaggedQuestions = new Set();
  }
  saveFlags();
}

function saveFlags() {
  try {
    localStorage.setItem(FLAG_STORAGE_KEY, JSON.stringify([...flaggedQuestions]));
  } catch (e) {
    // private mode or storage disabled: flags stay for this session only
  }
}

function toggleFlag() {
  const q = questions[currentIndex];
  if (!q) return;
  if (flaggedQuestions.has(q.id)) {
    flaggedQuestions.delete(q.id);
  } else {
    flaggedQuestions.add(q.id);
  }
  saveFlags();
  updateFlagBtn();
  refreshQuestionMap();
}

function updateFlagBtn() {
  const btn = document.getElementById('flagBtn');
  const q = questions[currentIndex];
  if (!btn || !q) return;
  const on = flaggedQuestions.has(q.id);
  btn.classList.toggle('is-flagged', on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.title = on ? 'Remove flag' : 'Flag for review';
}

function answeredCount() {
  return questions.filter((q) => (selectedAnswers[q.id] || []).length > 0).length;
}

function refreshQuestionMap() {
  const label = document.getElementById('mapBtnLabel');
  if (label) label.textContent = `${answeredCount()}/${questions.length} answered`;
  const flags = document.getElementById('mapBtnFlags');
  if (flags) {
    flags.textContent = flaggedQuestions.size ? `${flaggedQuestions.size} flagged` : '';
    flags.style.display = flaggedQuestions.size ? 'inline' : 'none';
  }
  const overlay = document.getElementById('questionMap');
  if (overlay && !overlay.hidden) renderQuestionMap();
}

function renderQuestionMap() {
  const grid = document.getElementById('questionMapGrid');
  if (!grid) return;
  grid.innerHTML = '';
  questions.forEach((q, i) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'qmap-cell';
    if ((selectedAnswers[q.id] || []).length > 0) cell.classList.add('is-answered');
    if (flaggedQuestions.has(q.id)) cell.classList.add('is-flagged');
    if (i === currentIndex) cell.classList.add('is-current');
    cell.textContent = String(i + 1);
    cell.setAttribute('aria-label', `Question ${i + 1}`);
    cell.addEventListener('click', () => {
      currentIndex = i;
      closeQuestionMap();
      renderQuestion();
    });
    grid.appendChild(cell);
  });
}

function openQuestionMap() {
  const overlay = document.getElementById('questionMap');
  if (!overlay || !questions.length) return;
  renderQuestionMap();
  overlay.hidden = false;
  document.getElementById('mapBtn')?.setAttribute('aria-expanded', 'true');
  document.getElementById('mapCloseBtn')?.focus();
}

function closeQuestionMap() {
  const overlay = document.getElementById('questionMap');
  if (!overlay) return;
  overlay.hidden = true;
  document.getElementById('mapBtn')?.setAttribute('aria-expanded', 'false');
}

function toggleQuestionMap() {
  const overlay = document.getElementById('questionMap');
  if (!overlay) return;
  if (overlay.hidden) openQuestionMap();
  else closeQuestionMap();
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
