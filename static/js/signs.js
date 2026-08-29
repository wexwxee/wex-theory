(function () {
  document.getElementById('signsBurgerBtn')?.addEventListener('click', sbOpen);
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);

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
          (!query ||
            card.dataset.code.includes(query) ||
            card.dataset.name.includes(query));
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
