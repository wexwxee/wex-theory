// Server routes enforce permissions. This also clears a previously rendered
// admin screen when another tab signs out or switches accounts.
(function () {
  const expectedId = Number(document.currentScript.dataset.userId);
  let pending = false;
  let leaving = false;
  function hide() { document.documentElement.style.visibility = 'hidden'; }
  async function check() {
    if (pending || leaving) return;
    pending = true;
    try {
      const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
      const user = response.ok ? await response.json() : null;
      if (!user || !user.is_admin || user.id !== expectedId) {
        hide();
        leaving = true;
        location.replace(user ? '/dashboard' : '/login');
        return;
      }
      if (!document.hidden && document.hasFocus()) document.documentElement.style.visibility = '';
    } catch (_) {
      hide();
      leaving = true;
      location.replace('/login');
    } finally { pending = false; }
  }
  hide();
  window.addEventListener('pagehide', hide);
  window.addEventListener('pageshow', () => { hide(); check(); });
  window.addEventListener('blur', hide);
  window.addEventListener('focus', () => { hide(); check(); });
  document.addEventListener('visibilitychange', () => { hide(); if (!document.hidden) check(); });
  setInterval(check, 3000);
  check();
})();
