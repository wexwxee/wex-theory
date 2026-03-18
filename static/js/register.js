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
    if (parts.length === 2) return parts.pop().split(';').shift();
    return '';
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

  let pendingVerificationEmail = '';

  function initFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email') || '';
    const code = params.get('code') || '';
    const error = params.get('error') || '';
    if (email) {
      document.getElementById('email').value = email;
      pendingVerificationEmail = email;
    }
    if (code) {
      document.getElementById('verifyCode').value = code;
      document.getElementById('verifyBox').classList.add('show');
    }
    if (error) {
      showMsg(error, 'error');
    }
  }

  async function handleRegister() {
    const btn = document.getElementById('btn');
    const name = document.getElementById('name')?.value.trim() || '';
    const email = document.getElementById('email')?.value.trim() || '';
    const password = document.getElementById('password')?.value || '';
    if (!name || !email || !password) {
      showMsg('Please fill all fields', 'error');
      return;
    }
    if (password.length < 8) {
      showMsg('Password must be at least 8 characters', 'error');
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      showMsg('Password must include at least one letter and one number', 'error');
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending...';
    }
    try {
      const res = await csrfFetch('/api/auth/register', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (data.success) {
        pendingVerificationEmail = data.email || email;
        document.getElementById('verifyBox')?.classList.add('show');
        showMsg(data.message || 'Verification code sent', 'success');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Resend Verification Code';
        }
        document.getElementById('verifyCode')?.focus();
      } else {
        showMsg(data.error || 'Registration failed', 'error');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Send Verification Code';
        }
      }
    } catch (e) {
      showMsg('Connection error', 'error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Send Verification Code';
      }
    }
  }

  async function handleVerify() {
    const verifyBtn = document.getElementById('verifyBtn');
    const email = pendingVerificationEmail || document.getElementById('email')?.value.trim() || '';
    const code = document.getElementById('verifyCode')?.value.trim() || '';
    if (!email) {
      showMsg('Please request the verification code first', 'error');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      showMsg('Enter the 6-digit code from your email', 'error');
      return;
    }

    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = 'Verifying...';
    }
    try {
      const res = await csrfFetch('/api/auth/register/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = data.redirect || '/dashboard';
      } else {
        showMsg(data.error || 'Verification failed', 'error');
        if (verifyBtn) {
          verifyBtn.disabled = false;
          verifyBtn.textContent = 'Verify And Create Account';
        }
      }
    } catch (e) {
      showMsg('Connection error', 'error');
      if (verifyBtn) {
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verify And Create Account';
      }
    }
  }

  const initialTheme = localStorage.getItem('wex-theme') || 'dark';
  applyTheme(initialTheme);
  initFromQuery();

  document.getElementById('themeBtn')?.addEventListener('click', toggleTheme);
  document.getElementById('passwordToggle')?.addEventListener('click', () => togglePassword('password', 'passwordToggle'));
  document.getElementById('btn')?.addEventListener('click', handleRegister);
  document.getElementById('verifyBtn')?.addEventListener('click', handleVerify);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (document.getElementById('verifyBox')?.classList.contains('show')) {
      handleVerify();
    } else {
      handleRegister();
    }
  });
})();

