(function () {
  function showPaywall() {
    document.getElementById('paywallModal')?.classList.add('open');
  }

  function updateSubscriptionTimer() {
    const el = document.getElementById('subTimer');
    if (!el || !el.dataset.accessExpiry) return;
    const exp = new Date(el.dataset.accessExpiry);

    function tick() {
      const now = new Date();
      const diff = Math.floor((exp - now) / 1000);
      if (diff <= 0) {
        el.textContent = 'Your extended access has ended.';
        el.style.color = '#ef4444';
        return;
      }
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      if (d > 0) {
        el.textContent = d + ' day' + (d === 1 ? '' : 's') + ' remaining';
      } else {
        el.textContent = h + 'h ' + m + 'm remaining';
      }
      el.style.color = d < 3 ? '#ef4444' : 'var(--text-muted)';
    }

    tick();
    window.setInterval(tick, 60000);
  }

  document.getElementById('dashboardBurgerBtn')?.addEventListener('click', sbOpen);
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);
  document.getElementById('paywallCloseBtn')?.addEventListener('click', () => {
    document.getElementById('paywallModal')?.classList.remove('open');
  });
  function openCard(card) {
    if (card.dataset.locked === 'true') {
      showPaywall();
      return;
    }
    if (card.dataset.testUrl) {
      window.location.href = card.dataset.testUrl;
    }
  }
  document.querySelectorAll('[data-test-card]').forEach((card) => {
    card.addEventListener('click', () => openCard(card));
    // The cards are focusable, so Enter and Space open them too.
    card.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openCard(card);
    });
  });

  function resumeSavedTest(){
    const root=document.getElementById('dashboardStudy');
    if(!root)return;
    const entries=window.WEXTestDrafts.list(root.dataset.userId,root.dataset.hasAccess==='true',JSON.parse(root.dataset.tests),JSON.parse(root.dataset.readyWording));
    const panel=document.getElementById('resumeTest');
    panel.hidden=!entries.length;
    if(!entries.length)return;
    const entry=entries[0],draft=entry.draft;
    const name=entry.test===0?'Starter test':entry.test===14?'Exam Mode':`Test ${entry.test}`;
    document.getElementById('resumeTestCopy').textContent=`${name}${entry.wording==='exam'?' · Alternative wording':''} · ${entry.answered}/${draft.ids.length} answered · question ${draft.currentIndex+1} · ${Math.ceil(draft.timerSeconds/60)} min remaining`;
    document.getElementById('resumeTestLink').href=entry.href;
  }
  window.addEventListener('pageshow',resumeSavedTest);
  window.addEventListener('storage',resumeSavedTest);
  resumeSavedTest();
  updateSubscriptionTimer();
})();
