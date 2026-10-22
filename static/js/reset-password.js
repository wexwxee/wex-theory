(function () {
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) {
      themeBtn.textContent = theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
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

  function togglePassword(inputId, buttonId) {
    const input = document.getElementById(inputId);
    const button = document.getElementById(buttonId);
    if (!input || !button) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.textContent = show ? '\uD83D\uDE48' : '\uD83D\uDC41';
    button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  }

  async function handleResetPassword() {
    const btn = document.getElementById('btn');
    const email = document.getElementById('email')?.value.trim() || '';
    const code = document.getElementById('code')?.value.trim() || '';
    const password = document.getElementById('password')?.value || '';
    if (!email || !code || !password) {
      showMsg('Please fill all fields', 'error');
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      showMsg('Password must be at least 8 characters and include a letter and number', 'error');
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Updating...';
    }
    try {
      const res = await csrfFetch('/api/auth/reset-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, password })
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = data.redirect || '/login?reset=1';
      } else {
        showMsg(data.error || 'Could not reset password', 'error');
      }
    } catch (e) {
      showMsg('Connection error', 'error');
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Update Password';
    }
  }

  const initialTheme = localStorage.getItem('wex-theme') || 'dark';
  applyTheme(initialTheme);

  const params = new URLSearchParams(window.location.search);
  const emailInput = document.getElementById('email');
  const codeInput = document.getElementById('code');
  if (emailInput) emailInput.value = params.get('email') || '';
  if (codeInput) codeInput.value = params.get('code') || '';
  const error = params.get('error') || '';
  if (error) showMsg(error, 'error');

  document.getElementById('themeBtn')?.addEventListener('click', toggleTheme);
  document.getElementById('passwordToggle')?.addEventListener('click', () => togglePassword('password', 'passwordToggle'));
  document.getElementById('btn')?.addEventListener('click', handleResetPassword);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleResetPassword();
  });
})();

