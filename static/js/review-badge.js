(function () {
  // The review tile joins the stats row only when there is something to review,
  // so a clean slate never carries a nagging zero.
  const tile = document.getElementById('reviewTile');
  const value = document.getElementById('reviewTileValue');
  if (!tile || !value) return;

  fetch('/api/review/count')
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      const pending = data?.pending || 0;
      if (!pending) return;
      value.textContent = pending;
      tile.hidden = false;
    })
    .catch(() => {
      // No tile is better than a broken one.
    });
})();
