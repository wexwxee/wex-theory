(function () {
  document.getElementById('pricingBurgerBtn')?.addEventListener('click', sbOpen);
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);
  document.getElementById('pricingPurchaseBtn')?.addEventListener('click', (event) => {
    event.preventDefault();
    const button = event.currentTarget;
    openTelegramPurchase({
      plan: button.dataset.plan || 'Premium',
      amount: button.dataset.amount || '99 kr',
      duration: button.dataset.duration || '30 days'
    });
  });
})();
