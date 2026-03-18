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
        el.textContent = 'Your premium access has ended.';
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
  document.querySelectorAll('[data-test-card]').forEach((card) => {
    card.addEventListener('click', function () {
      if (this.dataset.locked === 'true') {
        showPaywall();
        return;
      }
      if (this.dataset.testUrl) {
        window.location.href = this.dataset.testUrl;
      }
    });
  });

  updateSubscriptionTimer();
})();
