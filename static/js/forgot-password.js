(function () {
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) {
      themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('wex-theme', next);
    applyTheme(next);
  }

  function showMsg(msg, type) {
    const box = document.getElementById('msgBox');
    if (!box) return;
    box.className = 'msg-box ' + type;
    box.textContent = msg;
  }

  function getCookieValue(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    return parts.length === 2 ? parts.pop().split(';').shift() : '';
  }

  function csrfFetch(url, options = {}) {
    const opts = { ...options };
    const method = String(opts.method || 'GET').toUpperCase();
    const headers = new Headers(opts.headers || {});
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const token = getCookieValue('csrf_token');
      if (token) headers.set('X-CSRF-Token', token);
      if (!opts.credentials) opts.credentials = 'same-origin';
    }
    opts.headers = headers;
    return fetch(url, opts);
  }

  async function handleForgotPassword() {
    const btn = document.getElementById('btn');
    const email = document.getElementById('email')?.value.trim() || '';
    if (!email) {
      showMsg('Please enter your email', 'error');
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending...';
    }
    try {
      const res = await csrfFetch('/api/auth/forgot-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.success) {
        showMsg(data.message || 'If this email exists, we sent reset instructions.', 'success');
      } else {
        showMsg(data.error || 'Could not send reset email', 'error');
      }
    } catch (e) {
      showMsg('Connection error', 'error');
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Send Reset Email';
    }
  }

  const initialTheme = localStorage.getItem('wex-theme') || 'dark';
  applyTheme(initialTheme);

  document.getElementById('themeBtn')?.addEventListener('click', toggleTheme);
  document.getElementById('btn')?.addEventListener('click', handleForgotPassword);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleForgotPassword();
  });
})();
