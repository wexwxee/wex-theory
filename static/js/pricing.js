(function () {
  document.getElementById('pricingBurgerBtn')?.addEventListener('click', sbOpen);
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);
  const button = document.getElementById('pricingPurchaseBtn');
  if (button && window.buildTelegramPurchaseUrl) {
    button.href = window.buildTelegramPurchaseUrl();
  }
})();
