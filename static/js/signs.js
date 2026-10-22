(function () {
  document.getElementById('signsBurgerBtn')?.addEventListener('click', sbOpen);
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);

  // ── Language ────────────────────────────────────────────────────────────────
  // Both languages are in the page; the switch only chooses which one shows.
  // The choice is shared by every sign page, so it follows the learner around.
  const LANG_KEY = 'wexSignsLang';
  const SEARCH_PLACEHOLDER = {
    en: 'Search by code or name, e.g. C55 or roundabout',
    ru: 'Поиск по коду или названию: C55, круг, стоянка',
  };
  const EMPTY_TEXT = {
    en: 'Nothing matches that. Try a code like C55 or a word like cycle.',
    ru: 'Ничего не нашлось. Попробуйте код вроде C55 или слово вроде «велосипед».',
  };

  function readLang() {
    try {
      return localStorage.getItem(LANG_KEY) === 'ru' ? 'ru' : 'en';
    } catch (e) {
      return 'en';
    }
  }

  function applyLang(lang) {
    document.querySelectorAll('[data-en]').forEach((node) => {
      const ru = node.dataset.ru;
      node.textContent = lang === 'ru' && ru ? ru : node.dataset.en;
    });
    document.querySelectorAll('.lang-btn').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.lang === lang);
      button.setAttribute('aria-pressed', String(button.dataset.lang === lang));
    });
    const search = document.getElementById('signsSearch');
    if (search) search.placeholder = SEARCH_PLACEHOLDER[lang];
    const empty = document.getElementById('signsEmpty');
    if (empty) empty.textContent = EMPTY_TEXT[lang];
    document.documentElement.lang = lang === 'ru' ? 'ru' : 'en';
    document.querySelectorAll('.lesson-lang').forEach(group => group.setAttribute('aria-label', lang === 'ru' ? 'Язык' : 'Language'));
  }

  let lang = readLang();
  applyLang(lang);

  document.querySelectorAll('.lang-btn').forEach((button) => {
    button.addEventListener('click', () => {
      lang = button.dataset.lang === 'ru' ? 'ru' : 'en';
      try {
        localStorage.setItem(LANG_KEY, lang);
      } catch (e) {
        // private mode: the switch still works for this page view
      }
      applyLang(lang);
    });
  });

  // ── Catalogue search and family filter ──────────────────────────────────────
  const search = document.getElementById('signsSearch');
  const chips = document.getElementById('signsChips');
  const reviewed = document.getElementById('signsReviewed');
  const empty = document.getElementById('signsEmpty');
  const groups = Array.from(document.querySelectorAll('.signs-group'));
  if (!groups.length) return;

  let activeGroup = 'all';
  try { if (reviewed && localStorage.getItem('wexSignsReviewedOnly') === 'true') reviewed.checked = true; } catch (_) { /* storage blocked */ }

  function apply() {
    const query = (search?.value || '').trim().toLowerCase();
    let visible = 0;

    groups.forEach((group) => {
      const groupMatches = activeGroup === 'all' || group.dataset.group === activeGroup;
      let shownInGroup = 0;

      group.querySelectorAll('.sign-card').forEach((card) => {
        const matches =
          groupMatches &&
          (!reviewed?.checked || card.dataset.reviewed === 'true') &&
          (!query || card.dataset.code.includes(query) || card.dataset.name.includes(query));
        card.hidden = !matches;
        if (matches) shownInGroup += 1;
      });

      group.hidden = !shownInGroup;
      visible += shownInGroup;
    });

    if (empty) empty.hidden = Boolean(visible);
  }

  search?.addEventListener('input', apply);
  reviewed?.addEventListener('change', () => { try { localStorage.setItem('wexSignsReviewedOnly', String(reviewed.checked)); } catch (_) { /* storage blocked */ } apply(); });

  chips?.addEventListener('click', (event) => {
    const chip = event.target.closest('.signs-chip');
    if (!chip) return;
    activeGroup = chip.dataset.group;
    chips.querySelectorAll('.signs-chip').forEach((item) => {
      item.classList.toggle('is-active', item === chip);
      item.setAttribute('aria-pressed', String(item === chip));
    });
    apply();
  });
  window.addEventListener('pageshow', apply);
  apply();
})();
