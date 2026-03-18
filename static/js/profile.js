(function () {
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

  document.getElementById('profileBurgerBtn')?.addEventListener('click', sbOpen);
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);
  document.getElementById('promoRedeemBtn')?.addEventListener('click', redeemPromoCode);
  document.getElementById('promoCodeInput')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      redeemPromoCode();
    }
  });

  document.getElementById('copyUserIdBtn')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const publicId = button?.dataset.publicId || '';
    if (!publicId) return;
    try {
      await navigator.clipboard.writeText(publicId);
      showToast('User ID copied', 'success');
    } catch (e) {
      showToast('Unable to copy User ID', 'error');
    }
  });

  document.querySelectorAll('[data-history-url]').forEach((row) => {
    row.addEventListener('click', () => {
      if (row.dataset.historyUrl) {
        window.location.href = row.dataset.historyUrl;
      }
    });
  });
})();
