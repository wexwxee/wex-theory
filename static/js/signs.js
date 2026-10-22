(function () {
  document.getElementById('signsBurgerBtn')?.addEventListener('click', sbOpen);
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);

  // ── Language ────────────────────────────────────────────────────────────────
  // Both languages are in the page; the switch only chooses which one shows.
  // The choice is shared with the trainer, so it follows you across sign pages.
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
    });
    const search = document.getElementById('signsSearch');
    if (search) search.placeholder = SEARCH_PLACEHOLDER[lang];
    const empty = document.getElementById('signsEmpty');
    if (empty) empty.textContent = EMPTY_TEXT[lang];
    document.documentElement.lang = lang === 'ru' ? 'ru' : 'en';
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
  const empty = document.getElementById('signsEmpty');
  const groups = Array.from(document.querySelectorAll('.signs-group'));
  if (!groups.length) return;

  let activeGroup = 'all';

  function apply() {
    const query = (search?.value || '').trim().toLowerCase();
    let visible = 0;

    groups.forEach((group) => {
      const groupMatches = activeGroup === 'all' || group.dataset.group === activeGroup;
      let shownInGroup = 0;

      group.querySelectorAll('.sign-card').forEach((card) => {
        const matches =
          groupMatches &&
          (!query || card.dataset.code.includes(query) || card.dataset.name.includes(query));
        card.style.display = matches ? '' : 'none';
        if (matches) shownInGroup += 1;
      });

      group.style.display = shownInGroup ? '' : 'none';
      visible += shownInGroup;
    });

    if (empty) empty.style.display = visible ? 'none' : 'block';
  }

  search?.addEventListener('input', apply);

  chips?.addEventListener('click', (event) => {
    const chip = event.target.closest('.signs-chip');
    if (!chip) return;
    activeGroup = chip.dataset.group;
    chips.querySelectorAll('.signs-chip').forEach((item) => {
      item.classList.toggle('is-active', item === chip);
    });
    apply();
  });
})();
