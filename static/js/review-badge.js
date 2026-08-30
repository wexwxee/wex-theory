(function () {
  // The dashboard shows the review card only when there is something to review,
  // so an empty list never nags anyone.
  const card = document.getElementById('reviewCard');
  const copy = document.getElementById('reviewCardCopy');
  if (!card) return;

  fetch('/api/review/count')
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      const pending = data?.pending || 0;
      if (!pending) return;
      card.hidden = false;
      copy.textContent =
        pending === 1
          ? '1 question you got wrong is waiting'
          : `${pending} questions you got wrong are waiting`;
    })
    .catch(() => {
      // No badge is better than a broken one.
    });
})();
