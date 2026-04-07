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
    const _RESULTS_STOP = new Set(['the','a','an','in','to','of','and','or','is','are','you','at','on','for',
      'it','be','as','by','with','from','this','that','not','but','if','up','do','so','we','he',
      'she','they','my','your','all','have','has','had','was','were','will','can','i','its','our',
      'their','into','also','when','then','than','there','about','been','which','who','what']);
    let _resultsWordPopup = null;
    let _resultsPopupHideTimer = null;

    const _resultsWordDictCache = {};
    async function _lookupResultsWord(word) {
      const key = (word || '').toLowerCase();
      if (!key) return { main: null, pos: null };
      if (_resultsWordDictCache[key]) return _resultsWordDictCache[key];
      try {
        const res = await fetch('/api/dictionary/' + encodeURIComponent(key));
        if (!res.ok) throw new Error('lookup failed');
        const data = await res.json();
        const result = { main: data.translation || null, pos: data.pos || null };
        _resultsWordDictCache[key] = result;
        return result;
      } catch (e) {
        return { main: null, pos: null };
      }
    }

    function _resultTranslated(d) {
      return {
        q: d.text_ru || '',
        a: d.answers.map((a) => a.text_ru || ''),
        explanation: d.explanation_ru || ''
      };
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
      loading.textContent = '...';
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
      currentModal = i;
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

    function renderModal() {
      const d = DATA[currentModal];
      const trans = resultsTranslateMode ? _resultTranslated(d) : null;

      document.getElementById('modalMeta').textContent = `Question ${d.index} of ${DATA.length}`;
      updateBookmarkBtnState(d.is_bookmarked);
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
        row.appendChild(bodyRow);
        answersEl.appendChild(row);
        _wrapResultsWords(answerText);
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
      _wrapResultsWords(qEl);
      if (d.explanation) _wrapResultsWords(explBody);
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

    document.addEventListener('mouseover', (e) => {
      if (!e.target.classList.contains('tw')) return;
      clearTimeout(_resultsPopupHideTimer);
      const word = e.target.textContent.trim();
      if (!word || _RESULTS_STOP.has(word.toLowerCase()) || word.length < 3) return;
      if (_resultsWordPopup) {
        _resultsWordPopup.remove();
        _resultsWordPopup = null;
      }

      const popup = document.createElement('div');
      popup.className = 'word-popup';
      setResultsPopupLoading(popup, word);
      document.body.appendChild(popup);
      _resultsWordPopup = popup;

      const rect = e.target.getBoundingClientRect();
      _resultsPopupPos(popup, rect);

      _lookupResultsWord(word).then((result) => {
        if (_resultsWordPopup !== popup) return;
        setResultsPopupResult(popup, word, result);
        _resultsPopupPos(popup, rect);
      });
    });

    document.addEventListener('mouseout', (e) => {
      if (!e.target.classList.contains('tw')) return;
      _resultsPopupHideTimer = setTimeout(() => {
        if (_resultsWordPopup) {
          _resultsWordPopup.remove();
          _resultsWordPopup = null;
        }
      }, 120);
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
  };
})();
