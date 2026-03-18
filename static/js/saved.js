(function () {
  async function removeSavedQuestion(questionId, btn) {
    if (!questionId || !btn) return;
    btn.classList.add('loading');
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Removing...';
    try {
      const res = await fetch(`/api/bookmarks/${questionId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.bookmarked !== false) {
        throw new Error(data.error || 'Failed to remove');
      }
      const card = document.getElementById(`saved-card-${questionId}`);
      if (card) card.remove();
      const list = document.getElementById('savedList');
      const remaining = list ? list.children.length : 0;
      const countEl = document.getElementById('savedCount');
      if (countEl) {
        countEl.textContent = `${remaining} question${remaining === 1 ? '' : 's'} saved`;
      }
      if (remaining === 0) {
        location.reload();
        return;
      }
      showToast('Removed from saved questions', 'success');
    } catch (e) {
      btn.classList.remove('loading');
      btn.disabled = false;
      btn.textContent = original;
      showToast(e.message || 'Failed to remove', 'error');
    }
  }

  document.getElementById('savedBurgerBtn')?.addEventListener('click', sbOpen);
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);
  document.querySelectorAll('[data-remove-saved]').forEach((btn) => {
    btn.addEventListener('click', () => removeSavedQuestion(Number(btn.dataset.removeSaved), btn));
  });
})();
