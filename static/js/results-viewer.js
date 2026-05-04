(function () {
  window.initResultsViewer = async function initResultsViewer(options = {}) {
    if (typeof sbOpen === 'function') {
      document.getElementById('resultsBurgerBtn')?.addEventListener('click', sbOpen);
    }
    document.getElementById('resultsTranslateBtn')?.addEventListener('click', toggleResultsTranslate);
    document.getElementById('modalTranslateBtn')?.addEventListener('click', toggleResultsTranslate);
    if (typeof toggleTheme === 'function') {
      document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);
    }
    document.getElementById('modalCloseBtn')?.addEventListener('click', closeModal);
    document.getElementById('modalPrev')?.addEventListener('click', () => modalNav(-1));
    document.getElementById('modalNext')?.addEventListener('click', () => modalNav(1));
    document.querySelectorAll('[data-modal-index]').forEach((card) => {
      card.addEventListener('click', () => openModal(Number(card.dataset.modalIndex)));
    });
    document.querySelectorAll('[data-open-modal]').forEach((btn) => {
      btn.addEventListener('click', () => openModal(Number(btn.dataset.openModal)));
    });
    document.getElementById('modalBookmarkBtn')?.addEventListener('click', toggleModalBookmark);
    initPanZoom();
    document.querySelectorAll('[data-delete-saved]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSavedCard(Number(btn.dataset.deleteSaved), btn);
      });
    });

    const DATA = options.data || JSON.parse(document.getElementById('resultsDataJson').value);
    const SCORE = Number(options.score ?? document.getElementById('resultsPageMeta')?.dataset.score ?? 0);
    const TOTAL = Number(options.total ?? document.getElementById('resultsPageMeta')?.dataset.total ?? 25);

    let currentModal = 0;
    let resultsTranslateMode = false;
    let speechVoices = [];
    const speechPrefs = { voiceURI: localStorage.getItem('wexVoiceURI') || '' };
    const liveTranslationCache = new Map();
    let liveTranslationRequestKey = '';
    initSpeechControls();
    function _resultTranslated(d) {
      return {
        q: getTranslatedText(d.text, d.text_ru, d.translation_source_text),
        a: d.answers.map((a) => getTranslatedText(a.text, a.text_ru, a.translation_source_text)),
        explanation: d.explanation_ru || ''
      };
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

    function queueLiveTranslationsForReview(d) {
      if (!resultsTranslateMode || !d) return;
      const missing = [];
      const addIfNeeded = (text, ru, translationSourceText) => {
        const key = normalizeTranslationText(text);
        if (!needsLiveTranslation(text, ru, translationSourceText) || !key || liveTranslationCache.has(key)) return;
        missing.push(key);
      };
      addIfNeeded(d.text, d.text_ru, d.translation_source_text);
      d.answers.forEach((a) => addIfNeeded(a.text, a.text_ru, a.translation_source_text));
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
          if (resultsTranslateMode && DATA[currentModal]?.question_id === d.question_id) renderModal();
        })
        .catch(() => {
          unique.forEach((text) => liveTranslationCache.set(text, ''));
          if (resultsTranslateMode && DATA[currentModal]?.question_id === d.question_id) renderModal();
        })
        .finally(() => {
          if (liveTranslationRequestKey === requestKey) liveTranslationRequestKey = '';
        });
    }

    function initSpeechControls() {
      const select = document.getElementById('modalVoiceSelect');
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

    function getQuestionSpeechText(d) {
      if (!resultsTranslateMode) return d.text;
      return getTranslatedText(d.text, d.text_ru, d.translation_source_text) || d.text_ru || d.text;
    }

    function getAnswerSpeechText(answer) {
      if (!resultsTranslateMode) return answer.text;
      return getTranslatedText(answer.text, answer.text_ru, answer.translation_source_text) || answer.text_ru || answer.text;
    }

    function addResultBadge(parent, className, text) {
      const badge = document.createElement('span');
      badge.className = className;
      badge.textContent = text;
      parent.appendChild(badge);
    }

    function setResultsPopupResult(popup, word, result) {
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

    function toggleResultsTranslate(e) {
      // Prevent the default <button> behaviour from bubbling up and
      // accidentally scrolling the modal/page to the top.
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      resultsTranslateMode = !resultsTranslateMode;
      const btn = document.getElementById('resultsTranslateBtn');
      const modalBtn = document.getElementById('modalTranslateBtn');
      if (btn) btn.textContent = resultsTranslateMode ? 'EN' : 'RU';
      if (modalBtn) modalBtn.textContent = resultsTranslateMode ? 'EN' : 'RU';
      if (document.getElementById('qModal').classList.contains('open')) {
        // Preserve the scroll position of the modal body across the re-render.
        const scroller = document.querySelector('.review-modal-scroll');
        const prevTop = scroller ? scroller.scrollTop : 0;
        renderModal();
        if (scroller) scroller.scrollTop = prevTop;
      }
    }

    function openModal(i) {
      currentModal = Math.max(0, Math.min(DATA.length - 1, Number(i) || 0));
      renderModal();
      document.getElementById('qModal').classList.add('open');
    }

    function closeModal() {
      document.getElementById('qModal').classList.remove('open');
    }

    // ── Click question image to open shared lightbox ────────────────────
    function initPanZoom() {
      const wrap = document.getElementById("modalImgWrap");
      if (!wrap) return;
      wrap.addEventListener("click", () => {
        const img = document.getElementById("modalImg");
        if (!img || !img.src || wrap.style.display === "none") return;
        if (typeof window.openImageLightbox === "function") {
          window.openImageLightbox(img.src, img.alt || "");
        }
      });
    }
    function _pzReset() { /* no-op: lightbox handles its own state */ }

    function updateBookmarkBtnState(active) {
      const btn = document.getElementById('modalBookmarkBtn');
      if (!btn) return;
      btn.classList.toggle('active', !!active);
      btn.querySelector('svg')?.setAttribute('fill', active ? 'currentColor' : 'none');
    }

    async function toggleModalBookmark() {
      const d = DATA[currentModal];
      if (!d || !d.question_id) return;
      const btn = document.getElementById('modalBookmarkBtn');
      if (btn) btn.disabled = true;
      try {
        const res = await fetch(`/api/bookmarks/${d.question_id}`, { method: 'POST' });
        if (!res.ok) throw new Error('failed');
        const json = await res.json();
        d.is_bookmarked = !!json.bookmarked;
        updateBookmarkBtnState(d.is_bookmarked);
        // Sync grid card "Saved" pill + saved-in-test card visibility
        const card = document.querySelector(`[data-modal-index="${currentModal}"]`);
        if (card) {
          const existingPill = card.querySelector('.rc-save');
          if (d.is_bookmarked && !existingPill) {
            const pill = document.createElement('span');
            pill.className = 'rc-save';
            pill.textContent = 'Saved';
            card.appendChild(pill);
          } else if (!d.is_bookmarked && existingPill) {
            existingPill.remove();
          }
        }
        const savedCard = document.querySelector(`[data-saved-question-id="${d.question_id}"]`);
        if (!d.is_bookmarked && savedCard) {
          savedCard.classList.add('removing');
          setTimeout(() => savedCard.remove(), 260);
        }
      } catch (e) {
        // silent
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    async function deleteSavedCard(questionId, btn) {
      btn.disabled = true;
      try {
        const res = await fetch(`/api/bookmarks/${questionId}`, { method: 'POST' });
        if (!res.ok) throw new Error('failed');
        const json = await res.json();
        // If still bookmarked (toggle re-added), do nothing visually
        if (json.bookmarked) { btn.disabled = false; return; }
        const card = btn.closest('.saved-review-card');
        if (card) {
          card.classList.add('removing');
          setTimeout(() => card.remove(), 260);
        }
        // Update DATA + grid pill
        const target = DATA.find((x) => x.question_id === questionId);
        if (target) target.is_bookmarked = false;
        const idx = DATA.findIndex((x) => x.question_id === questionId);
        if (idx >= 0) {
          const gridCard = document.querySelector(`[data-modal-index="${idx}"]`);
          gridCard?.querySelector('.rc-save')?.remove();
        }
      } catch (e) {
        btn.disabled = false;
      }
    }

    function modalNav(dir) {
      currentModal = Math.max(0, Math.min(DATA.length - 1, currentModal + dir));
      renderModal();
    }

    function openReviewFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('review') || params.get('question');
      if (!raw || !DATA.length) return;
      const normalized = raw.trim().toLowerCase();
      let index = 0;
      if (!['1', 'true', 'open', 'yes'].includes(normalized)) {
        const requested = Number.parseInt(normalized, 10);
        if (Number.isFinite(requested)) {
          index = requested > 0 ? requested - 1 : requested;
        }
      }
      window.requestAnimationFrame(() => openModal(index));
    }

    function renderModal() {
      const d = DATA[currentModal];
      const trans = resultsTranslateMode ? _resultTranslated(d) : null;

      document.getElementById('modalMeta').textContent = `Question ${d.index} of ${DATA.length}`;
      updateBookmarkBtnState(d.is_bookmarked);
      const qEl = document.getElementById('modalQuestion');
      qEl.textContent = d.text;
      qEl.dataset.sourceText = d.text;
      delete qEl.dataset.wrapped;
      const qSpeakWrap = document.getElementById('modalQuestionSpeakWrap');
      qSpeakWrap?.replaceChildren(createSpeakButton(() => getQuestionSpeechText(d), 'Listen to question'));
      const qRuEl = document.getElementById('modalQuestionRu');
      if (resultsTranslateMode && trans?.q) {
        qRuEl.textContent = trans.q;
        qRuEl.style.display = 'block';
      } else if (resultsTranslateMode && isLiveTranslationPending(d.text, d.text_ru, d.translation_source_text)) {
        qRuEl.textContent = 'Translating...';
        qRuEl.style.display = 'block';
      } else {
        qRuEl.style.display = 'none';
      }

      const imgWrap = document.getElementById('modalImgWrap');
      const img = document.getElementById('modalImg');
      // Hard reset pan-zoom state every time we change question / re-render.
      _pzReset();
      if (d.image) {
        img.src = '/test-images/' + d.image;
        imgWrap.style.display = 'block';
      } else {
        imgWrap.style.display = 'none';
      }

      const answersEl = document.getElementById('modalAnswers');
      answersEl.innerHTML = '';
      const selectedWrongCount = d.selected_ids.filter((id) => !d.correct_ids.includes(id)).length;
      const missedCorrectCount = d.correct_ids.filter((id) => !d.selected_ids.includes(id)).length;
      d.answers.forEach((a, idx) => {
        const wasSelected = d.selected_ids.includes(a.id);
        const isCorrect = d.correct_ids.includes(a.id);
        let cls = 'answer-row neutral';
        let statusLabelText = 'Not selected';
        if (wasSelected && isCorrect) { cls = 'answer-row user-correct'; statusLabelText = '✓ You selected — Correct'; }
        else if (wasSelected && !isCorrect) { cls = 'answer-row user-wrong'; statusLabelText = '✕ You selected — Wrong'; }
        else if (!wasSelected && isCorrect) { cls = 'answer-row missed-correct'; statusLabelText = '⚠ Missed — should have selected'; }

        const row = document.createElement('div');
        row.className = cls;
        row.style.flexDirection = 'column';
        row.style.alignItems = 'stretch';

        const statusLine = document.createElement('div');
        statusLine.className = 'row-status';
        statusLine.textContent = statusLabelText;
        row.appendChild(statusLine);

        const bodyRow = document.createElement('div');
        bodyRow.style.cssText = 'display:flex;align-items:flex-start;gap:10px;';

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
        } else if (resultsTranslateMode && isLiveTranslationPending(a.text, a.text_ru, a.translation_source_text)) {
          const answerRu = document.createElement('div');
          answerRu.textContent = 'Translating...';
          answerRu.style.cssText = 'font-size:0.82rem;color:#6b7280;font-style:italic;margin-top:6px;';
          textWrap.appendChild(answerRu);
        }

        const badgesWrap = document.createElement('span');
        badgesWrap.className = 'review-answer-badges';
        if (wasSelected && isCorrect) {
          addResultBadge(badgesWrap, 'badge-user', 'Your answer');
          addResultBadge(badgesWrap, 'badge-correct', 'Correct');
        } else if (wasSelected && !isCorrect) {
          addResultBadge(badgesWrap, 'badge-user', 'Your answer');
          addResultBadge(badgesWrap, 'badge-wrong', 'Wrong');
        } else if (!wasSelected && isCorrect) {
          addResultBadge(badgesWrap, 'badge-missed', 'Missed correct');
        }

        bodyRow.appendChild(textWrap);
        bodyRow.appendChild(badgesWrap);
        bodyRow.appendChild(createSpeakButton(() => getAnswerSpeechText(a), 'Listen to answer'));
        row.appendChild(bodyRow);
        answersEl.appendChild(row);
      });

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

      const statusLabel = document.getElementById('modalStatusLabel');
      const statusHint = document.getElementById('modalStatusHint');
      const statusPill = document.getElementById('modalStatusPill');
      if (statusLabel && statusHint && statusPill) {
        statusLabel.textContent = d.is_correct ? 'Correct answer' : 'Needs review';
        statusLabel.className = `review-status-label ${d.is_correct ? 'correct' : 'wrong'}`;
        if (d.is_correct) {
          statusHint.textContent = 'All required answers were selected for this question.';
          statusPill.className = 'badge-correct';
          statusPill.textContent = 'Correct';
        } else {
          const parts = [];
          if (selectedWrongCount) {
            parts.push(`${selectedWrongCount} incorrect option${selectedWrongCount === 1 ? '' : 's'} selected`);
          }
          if (missedCorrectCount) {
            parts.push(`${missedCorrectCount} correct option${missedCorrectCount === 1 ? '' : 's'} missed`);
          }
          statusHint.textContent = parts.join(' and ') || 'Review this question carefully before your next attempt.';
          statusPill.className = 'badge-wrong';
          statusPill.textContent = 'Wrong';
        }
      }

      const statusEl = document.getElementById('modalStatus');
      statusEl.replaceChildren();
      const statusText = document.createElement('span');
      statusText.style.fontWeight = '600';
      statusText.style.color = 'var(--text-muted)';
      statusText.textContent = `Review ${currentModal + 1} / ${DATA.length}`;
      statusEl.appendChild(statusText);

      document.getElementById('modalPrev').disabled = currentModal === 0;
      document.getElementById('modalNext').disabled = currentModal === DATA.length - 1;
      queueLiveTranslationsForReview(d);
    }

    document.getElementById('qModal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('qModal')) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      const open = document.getElementById('qModal')?.classList.contains('open');
      if (!open) return;
      if (e.key === 'ArrowLeft') modalNav(-1);
      if (e.key === 'ArrowRight') modalNav(1);
      if (e.key === 'Escape') closeModal();
    });

    (function animateScore() {
      const duration = 900;
      const start = performance.now();
      function tick(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
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
      setTimeout(() => {
        const bar = document.getElementById('scoreBar');
        if (bar) bar.style.width = ((SCORE / TOTAL) * 100) + '%';
      }, 50);
    })();

    openReviewFromUrl();
  };
})();
