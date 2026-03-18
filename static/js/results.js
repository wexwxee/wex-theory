document.getElementById('resultsBurgerBtn')?.addEventListener('click', sbOpen);
document.getElementById('resultsTranslateBtn')?.addEventListener('click', toggleResultsTranslate);
document.getElementById('modalTranslateBtn')?.addEventListener('click', toggleResultsTranslate);
document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);
document.getElementById('modalCloseBtn')?.addEventListener('click', closeModal);
document.getElementById('modalPrev')?.addEventListener('click', () => modalNav(-1));
document.getElementById('modalNext')?.addEventListener('click', () => modalNav(1));
document.querySelectorAll('[data-modal-index]').forEach((card) => {
  card.addEventListener('click', () => openModal(Number(card.dataset.modalIndex)));
});
document.querySelectorAll('[data-open-modal]').forEach((btn) => {
  btn.addEventListener('click', () => openModal(Number(btn.dataset.openModal)));
});

// Build a serialisable array (Jinja2 objects в†’ plain JS)
const DATA = JSON.parse(document.getElementById('resultsDataJson').value);

let currentModal = 0;
let resultsTranslateMode = false;
const resultsTranslateCache = {};
const _RESULTS_STOP = new Set(['the','a','an','in','to','of','and','or','is','are','you','at','on','for',
  'it','be','as','by','with','from','this','that','not','but','if','up','do','so','we','he',
  'she','they','my','your','all','have','has','had','was','were','will','can','i','its','our',
  'their','into','also','when','then','than','there','about','been','which','who','what']);
const _RESULTS_GLOSSARY = [
  { phrase: 'turn right', translation: 'РїРѕРІРµСЂРЅСѓС‚СЊ РЅР°РїСЂР°РІРѕ', words: ['turn', 'right'] },
  { phrase: 'turn left', translation: 'РїРѕРІРµСЂРЅСѓС‚СЊ РЅР°Р»РµРІРѕ', words: ['turn', 'left'] },
  { phrase: 'right turn', translation: 'РїРѕРІРѕСЂРѕС‚ РЅР°РїСЂР°РІРѕ', words: ['right', 'turn'] },
  { phrase: 'left turn', translation: 'РїРѕРІРѕСЂРѕС‚ РЅР°Р»РµРІРѕ', words: ['left', 'turn'] },
  { phrase: 'signal-controlled junction', translation: 'СЂРµРіСѓР»РёСЂСѓРµРјС‹Р№ РїРµСЂРµРєСЂРµСЃС‚РѕРє', words: ['signal', 'controlled', 'junction'] },
  { phrase: 'pedestrian crossing', translation: 'РїРµС€РµС…РѕРґРЅС‹Р№ РїРµСЂРµС…РѕРґ', words: ['pedestrian', 'crossing'] },
  { phrase: 'bus lane', translation: 'РїРѕР»РѕСЃР° РґР»СЏ Р°РІС‚РѕР±СѓСЃРѕРІ', words: ['bus', 'lane'] },
  { phrase: 'cycle path', translation: 'РІРµР»РѕРґРѕСЂРѕР¶РєР°', words: ['cycle', 'path'] },
  { phrase: 'own lane', translation: 'СЃРІРѕСЏ РїРѕР»РѕСЃР°', words: ['own', 'lane'] },
  { phrase: 'keep to my own lane', translation: 'РґРµСЂР¶Р°С‚СЊСЃСЏ СЃРІРѕРµР№ РїРѕР»РѕСЃС‹', words: ['keep', 'own', 'lane'] },
  { phrase: 'pull in', translation: 'РїРµСЂРµСЃС‚СЂРѕРёС‚СЊСЃСЏ Р±Р»РёР¶Рµ Рє РєСЂР°СЋ', words: ['pull', 'in'] },
  { phrase: 'directly behind you', translation: 'РЅРµРїРѕСЃСЂРµРґСЃС‚РІРµРЅРЅРѕ РїРѕР·Р°РґРё РІР°СЃ', words: ['directly', 'behind'] },
  { phrase: 'all the way', translation: 'РґРѕ СЃР°РјРѕРіРѕ РєРѕРЅС†Р°', words: ['all', 'way'] },
  { phrase: 'remain there', translation: 'РѕСЃС‚Р°РІР°С‚СЊСЃСЏ С‚Р°Рј', words: ['remain', 'there'] },
  { phrase: 'kerb', translation: 'Р±РѕСЂРґСЋСЂ', words: ['kerb'] },
  { phrase: 'lane', translation: 'РїРѕР»РѕСЃР° РґРІРёР¶РµРЅРёСЏ', words: ['lane'] },
  { phrase: 'junction', translation: 'РїРµСЂРµРєСЂРµСЃС‚РѕРє', words: ['junction'] }
];
let _resultsWordPopup = null;
let _resultsPopupHideTimer = null;

function _resultsTranslateUrl(text) {
  return 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&q=' + encodeURIComponent(text);
}

function _extractResultsTranslation(data) {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
  return data[0].map(part => Array.isArray(part) ? (part[0] || '') : '').join('').trim() || null;
}

async function _translateResultsText(text) {
  if (!text || !text.trim()) return null;
  const key = 'gr_' + btoa(unescape(encodeURIComponent(text.trim().slice(0, 60)))).slice(0, 36);
  const cached = sessionStorage.getItem(key);
  if (cached) return cached;
  try {
    const res = await fetch(_resultsTranslateUrl(text.slice(0, 500)));
    const data = await res.json();
    const translated = _extractResultsTranslation(data);
    if (translated) {
      try { sessionStorage.setItem(key, translated); } catch(e) {}
      return translated;
    }
  } catch(e) {}
  return null;
}

async function _translateResultsWord(word) {
  const key = 'rw_' + word.toLowerCase();
  const cached = sessionStorage.getItem(key);
  if (cached) { try { return JSON.parse(cached); } catch(e) {} }
  try {
    const res = await fetch(_resultsTranslateUrl(word));
    const data = await res.json();
    const result = { main: _extractResultsTranslation(data) || '-', variants: [] };
    try { sessionStorage.setItem(key, JSON.stringify(result)); } catch(e) {}
    return result;
  } catch(e) {
    return { main: '-', variants: [] };
  }
}

function _normalizeResultsContext(text) {
  return (text || '').toLowerCase().replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function _findResultsGlossaryMatch(word, contextText) {
  const lcWord = (word || '').toLowerCase();
  const normalized = _normalizeResultsContext(contextText);
  return _RESULTS_GLOSSARY
    .filter(item => item.words.includes(lcWord) && normalized.includes(item.phrase))
    .sort((a, b) => b.phrase.length - a.phrase.length)[0] || null;
}

async function _translateResultsWordInContext(word, contextText) {
  const glossary = _findResultsGlossaryMatch(word, contextText);
  const base = glossary ? { main: glossary.translation, variants: [] } : await _translateResultsWord(word);
  return {
    main: base.main || '-',
    variants: base.variants || [],
    contextPhrase: glossary ? glossary.phrase : '',
    contextTranslation: glossary ? glossary.translation : ''
  };
}

async function _ensureResultTranslated(d) {
  const cacheKey = 'result_translate_' + d.index;
  if (resultsTranslateCache[cacheKey]) return resultsTranslateCache[cacheKey];
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      resultsTranslateCache[cacheKey] = JSON.parse(cached);
      return resultsTranslateCache[cacheKey];
    } catch(e) {}
  }
  const texts = [d.text, ...d.answers.map(a => a.text)];
  if (d.explanation) texts.push(d.explanation);
  const translated = await Promise.all(texts.map(_translateResultsText));
  const payload = {
    q: translated[0] || d.text,
    a: translated.slice(1, 1 + d.answers.length),
    explanation: d.explanation ? (translated[translated.length - 1] || d.explanation) : ''
  };
  resultsTranslateCache[cacheKey] = payload;
  try { sessionStorage.setItem(cacheKey, JSON.stringify(payload)); } catch(e) {}
  return payload;
}

function appendResultsWrappedText(parent, text, stopWords) {
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

function _wrapResultsWords(el) {
  if (!el || el.dataset.wrapped) return;
  el.dataset.wrapped = '1';

  function processNode(node) {
    if (node.nodeType === 3) {
      const text = node.textContent;
      if (!/[a-zA-Z]{3,}/.test(text)) return;
      const wrap = document.createElement('span');
      appendResultsWrappedText(wrap, text, _RESULTS_STOP);
      node.parentNode.replaceChild(wrap, node);
    } else if (node.nodeType === 1 &&
               !['SCRIPT','STYLE','INPUT','TEXTAREA'].includes(node.tagName) &&
               !node.classList.contains('tw')) {
      Array.from(node.childNodes).forEach(processNode);
    }
  }

  Array.from(el.childNodes).forEach(processNode);
}

function _resultsPopupPos(popup, rect) {
  const pw = popup.offsetWidth;
  const ph = popup.offsetHeight;
  const left = Math.max(4, Math.min(rect.left + rect.width / 2 - pw / 2, window.innerWidth - pw - 4));
  const top = rect.top + window.scrollY - ph - 10;
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
}

function addResultBadge(parent, className, text) {
  const badge = document.createElement('span');
  badge.className = className;
  badge.textContent = text;
  parent.appendChild(badge);
}

function setResultsPopupLoading(popup, word) {
  popup.replaceChildren();
  const orig = document.createElement('div');
  orig.className = 'wp-orig';
  orig.textContent = word;
  const loading = document.createElement('div');
  loading.className = 'wp-load';
  loading.textContent = 'вЏі';
  popup.appendChild(orig);
  popup.appendChild(loading);
}

function setResultsPopupResult(popup, word, result) {
  popup.replaceChildren();
  const orig = document.createElement('div');
  orig.className = 'wp-orig';
  orig.textContent = word;
  const translation = document.createElement('div');
  translation.className = 'wp-tr';
  translation.textContent = result.main || '-';
  popup.appendChild(orig);
  popup.appendChild(translation);
  if (result.contextPhrase) {
    const context = document.createElement('div');
    context.className = 'wp-context';
    context.textContent = `Context: ${result.contextPhrase} -> ${result.contextTranslation}`;
    popup.appendChild(context);
  }
  if (Array.isArray(result.variants) && result.variants.length) {
    const variants = document.createElement('div');
    variants.className = 'wp-variants';
    result.variants.forEach((item) => {
      const variant = document.createElement('span');
      variant.className = 'wp-v';
      variant.textContent = item;
      variants.appendChild(variant);
    });
    popup.appendChild(variants);
  }
}

async function toggleResultsTranslate() {
  resultsTranslateMode = !resultsTranslateMode;
  const btn = document.getElementById('resultsTranslateBtn');
  const modalBtn = document.getElementById('modalTranslateBtn');
  if (btn) {
    btn.textContent = resultsTranslateMode ? 'EN' : 'RU';
  }
  if (modalBtn) {
    modalBtn.textContent = resultsTranslateMode ? 'EN' : 'RU';
  }
  if (resultsTranslateMode && DATA[currentModal]) {
    await _ensureResultTranslated(DATA[currentModal]);
  }
  if (document.getElementById('qModal').classList.contains('open')) {
    renderModal();
  }
}

function openModal(i) {
  currentModal = i;
  renderModal();
  document.getElementById('qModal').classList.add('open');
}

function closeModal() {
  document.getElementById('qModal').classList.remove('open');
}

function modalNav(dir) {
  currentModal = Math.max(0, Math.min(DATA.length - 1, currentModal + dir));
  renderModal();
}

async function renderModal() {
  const d = DATA[currentModal];
  const trans = resultsTranslateMode ? await _ensureResultTranslated(d) : null;

  document.getElementById('modalMeta').textContent = `Question ${d.index} of ${DATA.length}`;
  const qEl = document.getElementById('modalQuestion');
  qEl.textContent = d.text;
  qEl.dataset.sourceText = d.text;
  delete qEl.dataset.wrapped;
  const qRuEl = document.getElementById('modalQuestionRu');
  if (resultsTranslateMode && trans?.q) {
    qRuEl.textContent = trans.q;
    qRuEl.style.display = 'block';
  } else {
    qRuEl.style.display = 'none';
  }

  // Image
  const imgWrap = document.getElementById('modalImgWrap');
  const img = document.getElementById('modalImg');
  if (d.image) {
    img.src = '/test-images/' + d.image;
    imgWrap.style.display = 'block';
  } else {
    imgWrap.style.display = 'none';
  }

  // Answers
  const answersEl = document.getElementById('modalAnswers');
  answersEl.innerHTML = '';
  d.answers.forEach((a, idx) => {
    const wasSelected = d.selected_ids.includes(a.id);
    const isCorrect = d.correct_ids.includes(a.id);

    let cls;
    if (wasSelected && isCorrect) {
      cls = 'answer-row user-correct';
    } else if (wasSelected && !isCorrect) {
      cls = 'answer-row user-wrong';
    } else if (!wasSelected && isCorrect) {
      cls = 'answer-row missed-correct';
    } else {
      cls = 'answer-row neutral';
    }

    const row = document.createElement('div');
    row.className = cls;

    const textWrap = document.createElement('div');
    textWrap.style.flex = '1';

    const answerText = document.createElement('span');
    answerText.textContent = a.text;
    answerText.dataset.sourceText = a.text;
    textWrap.appendChild(answerText);

    if (resultsTranslateMode && trans?.a?.[idx]) {
      const answerRu = document.createElement('div');
      answerRu.textContent = trans.a[idx];
      answerRu.style.cssText = 'font-size:0.82rem;color:#6b7280;font-style:italic;margin-top:6px;';
      textWrap.appendChild(answerRu);
    }

    const badgesWrap = document.createElement('span');
    badgesWrap.style.cssText = 'display:flex;gap:6px;flex-shrink:0;';
    if (wasSelected && isCorrect) {
      addResultBadge(badgesWrap, 'badge-user', 'вњ“ Your answer');
      addResultBadge(badgesWrap, 'badge-correct', 'Correct');
    } else if (wasSelected && !isCorrect) {
      addResultBadge(badgesWrap, 'badge-user', 'вњ— Your answer');
      addResultBadge(badgesWrap, 'badge-wrong', 'Wrong');
    } else if (!wasSelected && isCorrect) {
      addResultBadge(badgesWrap, 'badge-correct', 'Correct (missed)');
    }

    row.appendChild(textWrap);
    row.appendChild(badgesWrap);
    answersEl.appendChild(row);
    _wrapResultsWords(answerText);
  });

  // Explanation
  const expl = document.getElementById('modalExplanation');
  const explBody = document.getElementById('modalExplanationBody');
  const explRu = document.getElementById('modalExplanationRu');
  if (d.explanation) {
    expl.style.display = 'block';
    explBody.textContent = d.explanation;
    explBody.dataset.sourceText = d.explanation;
    delete explBody.dataset.wrapped;
    if (resultsTranslateMode && trans?.explanation) {
      explRu.textContent = trans.explanation;
      explRu.style.display = 'block';
    } else {
      explRu.style.display = 'none';
    }
  } else {
    expl.style.display = 'none';
  }

  // Status
  const statusEl = document.getElementById('modalStatus');
  statusEl.replaceChildren();
  const statusText = document.createElement('span');
  statusText.style.fontWeight = '600';
  statusText.style.color = d.is_correct ? '#22c55e' : '#ef4444';
  statusText.textContent = d.is_correct ? 'вњ“ Correct' : 'вњ— Wrong';
  statusEl.appendChild(statusText);

  // Prev/Next buttons
  document.getElementById('modalPrev').disabled = currentModal === 0;
  document.getElementById('modalNext').disabled = currentModal === DATA.length - 1;
  _wrapResultsWords(qEl);
  if (d.explanation) _wrapResultsWords(explBody);
}

// Close on overlay click
document.getElementById('qModal').addEventListener('click', e => {
  if (e.target === document.getElementById('qModal')) closeModal();
});
// Close on Escape is handled by base.html sbClose, but we override for modal
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') { if(document.getElementById('qModal').classList.contains('open')) modalNav(-1); }
  if (e.key === 'ArrowRight') { if(document.getElementById('qModal').classList.contains('open')) modalNav(1); }
});

document.addEventListener('mouseover', (e) => {
  if (!e.target.classList.contains('tw')) return;
  clearTimeout(_resultsPopupHideTimer);
  const word = e.target.textContent.trim();
  if (!word || _RESULTS_STOP.has(word.toLowerCase()) || word.length < 3) return;
  if (_resultsWordPopup) { _resultsWordPopup.remove(); _resultsWordPopup = null; }

  const popup = document.createElement('div');
  popup.className = 'word-popup';
  setResultsPopupLoading(popup, word);
  document.body.appendChild(popup);
  _resultsWordPopup = popup;

  const rect = e.target.getBoundingClientRect();
  const contextHost = e.target.closest('[data-source-text]');
  const contextText = contextHost ? contextHost.dataset.sourceText || '' : '';
  _resultsPopupPos(popup, rect);

  _translateResultsWordInContext(word, contextText).then(result => {
    if (_resultsWordPopup !== popup) return;
    setResultsPopupResult(popup, word, result);
    _resultsPopupPos(popup, rect);
  });
});

document.addEventListener('mouseout', (e) => {
  if (!e.target.classList.contains('tw')) return;
  _resultsPopupHideTimer = setTimeout(() => {
    if (_resultsWordPopup) { _resultsWordPopup.remove(); _resultsWordPopup = null; }
  }, 120);
});

// Animate score counter
(function(){
  const SCORE = Number(document.getElementById('resultsPageMeta')?.dataset.score || 0);
  const TOTAL = 25;
  const duration = 900;
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
    const val = Math.round(eased * SCORE);
    const el = document.getElementById('scoreDisplay');
    const correct = document.getElementById('statCorrect');
    const wrong = document.getElementById('statWrong');
    const pct = document.getElementById('statPct');
    if (el) el.textContent = val;
    if (correct) correct.textContent = val;
    if (wrong) wrong.textContent = TOTAL - val;
    if (pct) pct.textContent = Math.round((val / TOTAL) * 100) + '%';
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  // Animate progress bar
  setTimeout(() => {
    const bar = document.getElementById('scoreBar');
    if (bar) bar.style.width = ((SCORE / TOTAL) * 100) + '%';
  }, 50);
})();
