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
        msg.textContent = `Subscription activated for ${data.duration_days} day${data.duration_days === 1 ? '' : 's'}.`;
        showToast(data.message || 'Promo code applied', 'success');
        input.value = '';
        window.setTimeout(() => window.location.reload(), 900);
      } else {
        msg.style.display = 'block';
        msg.style.background = 'var(--wrong-bg)';
        msg.style.color = 'var(--wrong)';
        msg.style.border = '1px solid var(--wrong)';
        msg.textContent = data.error || 'Invalid promo code.';
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

  document.getElementById('promoBurgerBtn')?.addEventListener('click', sbOpen);
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);
  document.getElementById('promoRedeemBtn')?.addEventListener('click', redeemPromoCode);
  document.getElementById('promoCodeInput')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      redeemPromoCode();
    }
  });
})();
