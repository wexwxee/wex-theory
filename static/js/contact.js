(function () {
  function showFormMsg(msg, type) {
    const el = document.getElementById('formMsg');
    el.style.display = 'block';
    el.style.background = type === 'error' ? 'var(--wrong-bg)' : 'var(--correct-bg)';
    el.style.color = type === 'error' ? 'var(--wrong)' : 'var(--correct)';
    el.style.border = `1px solid ${type === 'error' ? 'var(--wrong)' : 'var(--correct)'}`;
    el.textContent = msg;
  }

  async function sendMessage() {
    const name = document.getElementById('cName').value.trim();
    const email = document.getElementById('cEmail').value.trim();
    const subject = document.getElementById('cSubject').value;
    const message = document.getElementById('cMsg').value.trim();
    const attachment = document.getElementById('cAttachment').files[0];
    const btn = document.getElementById('sendBtn');

    if (!name || !email || !message) {
      showFormMsg('Please fill all required fields', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);
      formData.append('subject', subject);
      formData.append('message', message);
      if (attachment) formData.append('attachment', attachment);

      const res = await fetch('/api/contact', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        if (data.redirect) {
          window.location.href = data.redirect;
          return;
        }
        document.getElementById('formWrap').style.display = 'none';
        document.getElementById('successState').style.display = 'block';
      } else {
        showFormMsg(data.error || 'Failed to send', 'error');
        btn.disabled = false;
        btn.textContent = 'Send Message';
      }
    } catch (e) {
      showFormMsg('Connection error. Please try again.', 'error');
      btn.disabled = false;
      btn.textContent = 'Send Message';
    }
  }

  document.getElementById('contactBurgerBtn')?.addEventListener('click', sbOpen);
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);
  document.getElementById('sendBtn')?.addEventListener('click', sendMessage);
  document.getElementById('cAttachment')?.addEventListener('change', () => {
    const file = document.getElementById('cAttachment').files[0];
    const info = document.getElementById('attachmentInfo');
    if (!file) {
      info.style.display = 'none';
      info.textContent = '';
      return;
    }
    info.style.display = 'block';
    info.textContent = `Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`;
  });
})();
