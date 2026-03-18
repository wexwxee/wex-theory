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

  async function redeemPromoCode() {
    const input = document.getElementById('promoCodeInput');
    const btn = document.getElementById('promoRedeemBtn');
    const msg = document.getElementById('promoRedeemMsg');
    const code = (input?.value || '').trim().toUpperCase();
    if (!input || !btn || !msg) return;

    if (!code) {
      msg.style.display = 'block';
      msg.style.background = 'var(--wrong-bg)';
      msg.style.color = 'var(--wrong)';
      msg.style.border = '1px solid var(--wrong)';
      msg.textContent = 'Enter a promo code first.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Activating...';
    msg.style.display = 'none';
    try {
      const res = await fetch('/api/promo-codes/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (data.success) {
        msg.style.display = 'block';
        msg.style.background = 'var(--correct-bg)';
        msg.style.color = 'var(--correct)';
        msg.style.border = '1px solid var(--correct)';
        msg.textContent = data.message || 'Promo code applied successfully.';
        showToast(data.message || 'Promo code applied', 'success');
        input.value = '';
        window.setTimeout(() => window.location.reload(), 900);
      } else {
        msg.style.display = 'block';
        msg.style.background = 'var(--wrong-bg)';
        msg.style.color = 'var(--wrong)';
        msg.style.border = '1px solid var(--wrong)';
        msg.textContent = data.error || 'Unable to apply promo code.';
      }
    } catch (e) {
      msg.style.display = 'block';
      msg.style.background = 'var(--wrong-bg)';
      msg.style.color = 'var(--wrong)';
      msg.style.border = '1px solid var(--wrong)';
      msg.textContent = 'Connection error.';
    }
    btn.disabled = false;
    btn.textContent = 'Activate';
  }

  document.getElementById('dashboardBurgerBtn')?.addEventListener('click', sbOpen);
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);
  document.getElementById('promoRedeemBtn')?.addEventListener('click', redeemPromoCode);
  document.getElementById('promoCodeInput')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      redeemPromoCode();
    }
  });
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
