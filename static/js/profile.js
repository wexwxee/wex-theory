(function () {
  document.getElementById('profileBurgerBtn')?.addEventListener('click', sbOpen);
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);

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
