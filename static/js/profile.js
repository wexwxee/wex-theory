(function () {
  document.getElementById('profileBurgerBtn')?.addEventListener('click', sbOpen);
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);

  const avatarInput = document.getElementById('avatarInput');
  const avatarPickBtn = document.getElementById('avatarPickBtn');
  const avatarImg = document.getElementById('profileAvatarImg');
  const avatarInitial = document.getElementById('profileAvatarInitial');
  const avatarHint = document.getElementById('avatarHint');
  const removeAvatarBtn = document.getElementById('removeAvatarBtn');
  const profileNameText = document.getElementById('profileNameText');
  const editNameBtn = document.getElementById('editNameBtn');
  const nameEditForm = document.getElementById('nameEditForm');
  const profileNameInput = document.getElementById('profileNameInput');
  const saveNameBtn = document.getElementById('saveNameBtn');
  const cancelNameBtn = document.getElementById('cancelNameBtn');
  let previewUrl = null;

  function setAvatar(url) {
    if (!avatarImg || !avatarInitial) return;
    if (url) {
      avatarImg.src = url;
      avatarImg.hidden = false;
      avatarInitial.hidden = true;
      if (removeAvatarBtn) removeAvatarBtn.style.display = '';
    } else {
      avatarImg.removeAttribute('src');
      avatarImg.hidden = true;
      avatarInitial.hidden = false;
      if (removeAvatarBtn) removeAvatarBtn.style.display = 'none';
    }
  }

  avatarPickBtn?.addEventListener('click', () => {
    avatarInput?.click();
  });

  avatarInput?.addEventListener('change', async () => {
    const file = avatarInput.files && avatarInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Choose an image file', 'error');
      avatarInput.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Profile photo must be 2 MB or smaller', 'error');
      avatarInput.value = '';
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    setAvatar(previewUrl);
    if (avatarHint) avatarHint.textContent = 'Uploading photo...';
    if (avatarPickBtn) avatarPickBtn.disabled = true;

    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.avatar_url) {
        throw new Error(data.detail || data.error || 'Upload failed');
      }
      setAvatar(data.avatar_url + '?v=' + Date.now());
      showToast('Profile photo updated', 'success');
      if (avatarHint) avatarHint.textContent = 'PNG, JPG, WEBP or GIF up to 2 MB.';
    } catch (err) {
      showToast(err.message || 'Unable to upload photo', 'error');
      window.setTimeout(() => window.location.reload(), 700);
    } finally {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
      }
      if (avatarPickBtn) avatarPickBtn.disabled = false;
      avatarInput.value = '';
    }
  });

  removeAvatarBtn?.addEventListener('click', async () => {
    removeAvatarBtn.disabled = true;
    try {
      const res = await fetch('/api/profile/avatar/remove', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.detail || 'Remove failed');
      setAvatar('');
      showToast('Profile photo removed', 'success');
    } catch (err) {
      showToast(err.message || 'Unable to remove photo', 'error');
    } finally {
      removeAvatarBtn.disabled = false;
    }
  });

  function closeNameEditor() {
    nameEditForm?.classList.remove('open');
    if (profileNameInput && profileNameText) {
      profileNameInput.value = profileNameText.textContent.trim();
    }
  }

  editNameBtn?.addEventListener('click', () => {
    nameEditForm?.classList.add('open');
    profileNameInput?.focus();
    profileNameInput?.select();
  });

  cancelNameBtn?.addEventListener('click', closeNameEditor);

  nameEditForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = (profileNameInput?.value || '').replace(/\s+/g, ' ').trim();
    if (name.length < 2) {
      showToast('Name must be at least 2 characters', 'error');
      return;
    }
    if (saveNameBtn) saveNameBtn.disabled = true;
    try {
      const res = await fetch('/api/profile/name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.name) {
        throw new Error(data.error || data.detail || 'Unable to save name');
      }
      if (profileNameText) profileNameText.textContent = data.name;
      if (avatarInitial) avatarInitial.textContent = data.name.trim().charAt(0).toUpperCase();
      closeNameEditor();
      showToast('Name updated', 'success');
    } catch (err) {
      showToast(err.message || 'Unable to save name', 'error');
    } finally {
      if (saveNameBtn) saveNameBtn.disabled = false;
    }
  });

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
    row.addEventListener('click', (event) => {
      if (event.target.closest('[data-history-action]')) return;
      if (row.dataset.historyUrl) {
        window.location.href = row.dataset.historyUrl;
      }
    });
  });
})();
