/* The learner's own state on catalogue cards and on a sign's page. */
(function () {
  'use strict';
  const root = document.getElementById('signsCatalogue') || document.getElementById('signDetail');
  if (!root || !window.WEXSignProgress) return;
  const store = window.WEXSignProgress.create({ userId: root.dataset.userId || '' });
  const lang = () => (document.documentElement.lang === 'ru' ? 'ru' : 'en');
  const LABELS = {
    en: { new: 'Not started yet', learning: 'Learning', learned: 'Learned', due: 'Repeat now', next: when => `next repeat ${when}` },
    ru: { new: 'Ещё не начат', learning: 'Изучается', learned: 'Выучен', due: 'Пора повторить', next: when => `следующее повторение ${when}` },
  };

  function render() {
    let learned = 0;
    root.querySelectorAll('[data-sign]').forEach(card => {
      const status = store.status(card.dataset.sign);
      if (status === 'learned') learned += 1;
      const dot = card.querySelector('[data-status]');
      if (dot) dot.dataset.state = status;
    });
    const count = document.getElementById('catalogueLearned');
    if (count) count.textContent = learned;
    const line = document.getElementById('signStatus');
    if (line) {
      const code = line.dataset.code;
      const status = store.status(code);
      const labels = LABELS[lang()];
      const due = store.dueAt(code);
      line.dataset.state = status;
      line.querySelector('[data-status-text]').textContent = labels[status]
        + (status === 'learning' || status === 'learned' ? ` · ${labels.next(window.WEXSignProgress.formatDue(due, lang()))}` : '');
    }
  }
  root.querySelectorAll('.lang-btn').forEach(button => button.addEventListener('click', render));
  window.addEventListener('pageshow', render);
  render();
  store.load().then(render);
})();
