(function () {
  const adminPage = document.getElementById('adminPage');
  const canManageAdminRoles = adminPage?.dataset.canManageAdminRoles === 'true';

  function parseJsonDataset(value, fallback = '') {
    if (value == null || value === '') return fallback;
    try {
      return JSON.parse(value);
    } catch (e) {
      return fallback;
    }
  }

  function switchTab(tab) {
    document.getElementById('panelUsers').style.display = tab === 'users' ? 'block' : 'none';
    document.getElementById('panelMessages').style.display = tab === 'messages' ? 'block' : 'none';
    document.getElementById('panelPromos').style.display = tab === 'promos' ? 'block' : 'none';
    document.getElementById('tabUsers').className = 'tab-btn' + (tab === 'users' ? ' active' : '');
    document.getElementById('tabMessages').className = 'tab-btn' + (tab === 'messages' ? ' active' : '');
    document.getElementById('tabPromos').className = 'tab-btn' + (tab === 'promos' ? ' active' : '');
    if (window.history?.replaceState) {
      window.history.replaceState(null, '', `/admin?tab=${tab}`);
    }
  }

  function filterUsers() {
    const query = (document.getElementById('userSearch').value || '').trim().toLowerCase();
    document.querySelectorAll('.user-row').forEach((row) => {
      row.style.display = !query || row.dataset.search.includes(query) ? '' : 'none';
    });
  }

  function setMessageAttachment(attachmentEl, attachmentName, attachmentPath, attachmentType) {
    attachmentEl.replaceChildren();
    if (!attachmentPath) {
      attachmentEl.style.display = 'none';
      return;
    }
    const isImage = (attachmentType || '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(attachmentName || '');
    attachmentEl.style.display = 'block';

    const title = document.createElement('div');
    title.style.cssText = 'font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;';
    title.textContent = 'Attachment';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;';

    const meta = document.createElement('div');
    const nameEl = document.createElement('div');
    nameEl.style.fontWeight = '600';
    nameEl.textContent = attachmentName || 'Attached file';
    const typeEl = document.createElement('div');
    typeEl.style.cssText = 'font-size:0.8rem;color:var(--text-muted);';
    typeEl.textContent = attachmentType || 'File';
    meta.appendChild(nameEl);
    meta.appendChild(typeEl);

    const link = document.createElement('a');
    link.href = attachmentPath;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'btn-ghost btn-sm';
    link.textContent = 'Open';

    row.appendChild(meta);
    row.appendChild(link);

    attachmentEl.appendChild(title);
    attachmentEl.appendChild(row);

    if (isImage) {
      const img = document.createElement('img');
      img.src = attachmentPath;
      img.alt = attachmentName || 'Attachment';
      img.style.cssText = 'margin-top:12px;max-width:100%;border-radius:8px;border:1px solid var(--border);';
      attachmentEl.appendChild(img);
    }
  }

  function openEditModal(id, name, email, isAdmin, isSuperAdmin) {
    document.getElementById('editUserId').value = id;
    document.getElementById('editName').value = name;
    document.getElementById('editEmail').value = email;
    document.getElementById('editIsAdmin').checked = isAdmin;
    document.getElementById('editIsAdmin').disabled = !canManageAdminRoles || !!isSuperAdmin;
    document.getElementById('editPassword').value = '';
    document.getElementById('editDays').value = '';
    document.getElementById('editDurationUnit').value = 'days';
    document.getElementById('editMsg').style.display = 'none';
    document.getElementById('editModal').classList.add('open');
  }
  function closeEdit() { document.getElementById('editModal').classList.remove('open'); }

  async function saveEdit() {
    const id = document.getElementById('editUserId').value;
    const name = document.getElementById('editName').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const password = document.getElementById('editPassword').value;
    const days = document.getElementById('editDays').value;
    const durationUnit = document.getElementById('editDurationUnit').value;
    const isAdmin = document.getElementById('editIsAdmin').checked;
    const btn = document.getElementById('saveEditBtn');

    const body = { name, email, is_admin: isAdmin };
    if (password) body.password = password;
    if (days !== '') {
      body.duration_value = parseInt(days, 10);
      body.duration_unit = durationUnit;
    }

    btn.disabled = true; btn.textContent = 'Saving...';
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        showToast('User updated', 'success');
        closeEdit();
        setTimeout(() => location.reload(), 500);
      } else {
        const msg = document.getElementById('editMsg');
        msg.style.display = 'block';
        msg.style.background = 'var(--wrong-bg)';
        msg.style.color = 'var(--wrong)';
        msg.style.border = '1px solid var(--wrong)';
        msg.textContent = data.error || 'Failed';
      }
    } catch (e) { showToast('Connection error', 'error'); }
    btn.disabled = false; btn.textContent = 'Save';
  }

  function openCreateModal() {
    document.getElementById('createName').value = '';
    document.getElementById('createEmail').value = '';
    document.getElementById('createPassword').value = '';
    document.getElementById('createDays').value = '30';
    document.getElementById('createDurationUnit').value = 'days';
    document.getElementById('createIsAdmin').checked = false;
    document.getElementById('createIsAdmin').disabled = !canManageAdminRoles;
    document.getElementById('createMsg').style.display = 'none';
    document.getElementById('createModal').classList.add('open');
  }
  function closeCreate() { document.getElementById('createModal').classList.remove('open'); }

  async function createUser() {
    const name = document.getElementById('createName').value.trim();
    const email = document.getElementById('createEmail').value.trim();
    const password = document.getElementById('createPassword').value;
    const durationValue = parseInt(document.getElementById('createDays').value, 10) || 30;
    const durationUnit = document.getElementById('createDurationUnit').value;
    const isAdmin = document.getElementById('createIsAdmin').checked;
    const btn = document.getElementById('createBtn');

    if (!name || !email || !password) {
      const msg = document.getElementById('createMsg');
      msg.style.display = 'block';
      msg.style.background = 'var(--wrong-bg)';
      msg.style.color = 'var(--wrong)';
      msg.style.border = '1px solid var(--wrong)';
      msg.textContent = 'Please fill all fields';
      return;
    }

    btn.disabled = true; btn.textContent = 'Creating...';
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, duration_value: durationValue, duration_unit: durationUnit, is_admin: isAdmin })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`User created: ${data.public_id || ('#' + data.id)}`, 'success');
        closeCreate();
        setTimeout(() => location.reload(), 500);
      } else {
        const msg = document.getElementById('createMsg');
        msg.style.display = 'block';
        msg.style.background = 'var(--wrong-bg)';
        msg.style.color = 'var(--wrong)';
        msg.style.border = '1px solid var(--wrong)';
        msg.textContent = data.error || 'Failed';
      }
    } catch (e) { showToast('Connection error', 'error'); }
    btn.disabled = false; btn.textContent = 'Create';
  }

  async function deleteUser(id, name) {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('User deleted', 'success');
        setTimeout(() => location.reload(), 500);
      } else {
        showToast(data.error || 'Failed to delete', 'error');
      }
    } catch (e) { showToast('Connection error', 'error'); }
  }

  function openResetModal(id, name) {
    document.getElementById('resetUserId').value = id;
    document.getElementById('resetUserName').textContent = name;
    document.getElementById('resetPassword').value = '';
    document.getElementById('resetMsg').style.display = 'none';
    document.getElementById('resetModal').classList.add('open');
  }
  function closeReset() { document.getElementById('resetModal').classList.remove('open'); }

  async function saveReset() {
    const id = document.getElementById('resetUserId').value;
    const password = document.getElementById('resetPassword').value;
    const btn = document.getElementById('resetBtn');
    const msg = document.getElementById('resetMsg');

    if (password.length < 6) {
      msg.style.display = 'block';
      msg.style.background = 'var(--wrong-bg)';
      msg.style.color = 'var(--wrong)';
      msg.style.border = '1px solid var(--wrong)';
      msg.textContent = 'Password must be at least 6 characters';
      return;
    }

    btn.disabled = true; btn.textContent = 'Saving...';
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Password updated', 'success');
        closeReset();
      } else {
        msg.style.display = 'block';
        msg.style.background = 'var(--wrong-bg)';
        msg.style.color = 'var(--wrong)';
        msg.style.border = '1px solid var(--wrong)';
        msg.textContent = data.error || 'Failed';
      }
    } catch (e) { showToast('Connection error', 'error'); }
    btn.disabled = false; btn.textContent = 'Set Password';
  }

  async function viewMessage(id, name, email, subject, message, date, isRead, attachmentName, attachmentPath, attachmentType) {
    document.getElementById('msgModalSubject').textContent = subject;
    document.getElementById('msgModalFrom').textContent = `From: ${name} <${email}>`;
    document.getElementById('msgModalDate').textContent = date;
    document.getElementById('msgModalBody').textContent = message;
    const attachmentEl = document.getElementById('msgModalAttachment');
    setMessageAttachment(attachmentEl, attachmentName, attachmentPath, attachmentType);
    document.getElementById('msgModal').classList.add('open');

    if (!isRead) {
      await fetch(`/api/admin/messages/${id}/read`, { method: 'PUT' });
      const row = document.getElementById(`msgrow-${id}`);
      if (row) row.style.fontWeight = '400';
    }
  }

  async function createPromoCode() {
    const durationDays = parseInt(document.getElementById('promoDurationDays')?.value || '0', 10);
    const maxUsesRaw = (document.getElementById('promoMaxUses')?.value || '').trim();
    const expiresAt = (document.getElementById('promoExpiresAt')?.value || '').trim();
    const msg = document.getElementById('promoCreateMsg');
    const btn = document.getElementById('createPromoBtn');

    if (!durationDays || durationDays < 1) {
      msg.style.display = 'block';
      msg.style.background = 'var(--wrong-bg)';
      msg.style.color = 'var(--wrong)';
      msg.style.border = '1px solid var(--wrong)';
      msg.textContent = 'Duration must be at least 1 day';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Generating...';
    msg.style.display = 'none';
    try {
      const res = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration_days: durationDays,
          max_uses: maxUsesRaw || null,
          expires_at: expiresAt || null
        })
      });
      const data = await res.json();
      if (data.success) {
        msg.style.display = 'block';
        msg.style.background = 'var(--correct-bg)';
        msg.style.color = 'var(--correct)';
        msg.style.border = '1px solid var(--correct)';
        msg.textContent = `Promo code created: ${data.code}`;
        showToast(`Promo code created: ${data.code}`, 'success');
        window.setTimeout(() => window.location.reload(), 700);
      } else {
        msg.style.display = 'block';
        msg.style.background = 'var(--wrong-bg)';
        msg.style.color = 'var(--wrong)';
        msg.style.border = '1px solid var(--wrong)';
        msg.textContent = data.error || 'Failed to create promo code';
      }
    } catch (e) {
      msg.style.display = 'block';
      msg.style.background = 'var(--wrong-bg)';
      msg.style.color = 'var(--wrong)';
      msg.style.border = '1px solid var(--wrong)';
      msg.textContent = 'Connection error';
    }
    btn.disabled = false;
    btn.textContent = 'Generate Promo Code';
  }

  const userSearch = document.getElementById('userSearch');
  const userSearchForm = document.getElementById('userSearchForm');
  if (userSearch) {
    const clearSearch = () => {
      userSearch.value = '';
      filterUsers();
    };
    clearSearch();
    userSearch.setAttribute('autocomplete', 'off');
    userSearch.setAttribute('name', 'lookup_term');
    requestAnimationFrame(clearSearch);
    window.setTimeout(clearSearch, 0);
    window.setTimeout(clearSearch, 150);
    window.addEventListener('pageshow', clearSearch);
  }
  userSearchForm?.setAttribute('autocomplete', 'off');
  userSearchForm?.addEventListener('submit', (event) => event.preventDefault());

  document.getElementById('adminBurgerBtn')?.addEventListener('click', sbOpen);
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);
  document.getElementById('openCreateModalBtn')?.addEventListener('click', openCreateModal);
  document.getElementById('tabUsers')?.addEventListener('click', (event) => {
    event.preventDefault();
    switchTab('users');
  });
  document.getElementById('tabMessages')?.addEventListener('click', (event) => {
    event.preventDefault();
    switchTab('messages');
  });
  document.getElementById('tabPromos')?.addEventListener('click', (event) => {
    event.preventDefault();
    switchTab('promos');
  });
  userSearch?.addEventListener('input', filterUsers);

  document.querySelectorAll('.user-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => openEditModal(
      Number(btn.dataset.userId),
      parseJsonDataset(btn.dataset.userName, ''),
      parseJsonDataset(btn.dataset.userEmail, ''),
      btn.dataset.userAdmin === '1',
      btn.dataset.userSuperAdmin === '1'
    ));
  });

  document.querySelectorAll('.user-reset-btn').forEach((btn) => {
    btn.addEventListener('click', () => openResetModal(
      Number(btn.dataset.userId),
      parseJsonDataset(btn.dataset.userName, '')
    ));
  });

  document.querySelectorAll('.user-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteUser(
      Number(btn.dataset.userId),
      parseJsonDataset(btn.dataset.userName, '')
    ));
  });

  document.querySelectorAll('.message-view-btn').forEach((btn) => {
    btn.addEventListener('click', () => viewMessage(
      Number(btn.dataset.messageId),
      parseJsonDataset(btn.dataset.messageName, ''),
      parseJsonDataset(btn.dataset.messageEmail, ''),
      parseJsonDataset(btn.dataset.messageSubject, ''),
      parseJsonDataset(btn.dataset.messageBody, ''),
      parseJsonDataset(btn.dataset.messageDate, ''),
      btn.dataset.messageRead === '1',
      parseJsonDataset(btn.dataset.attachmentName, ''),
      parseJsonDataset(btn.dataset.attachmentPath, ''),
      parseJsonDataset(btn.dataset.attachmentType, '')
    ));
  });

  document.getElementById('closeEditModalBtn')?.addEventListener('click', closeEdit);
  document.getElementById('cancelEditBtn')?.addEventListener('click', closeEdit);
  document.getElementById('saveEditBtn')?.addEventListener('click', saveEdit);
  document.getElementById('closeCreateModalBtn')?.addEventListener('click', closeCreate);
  document.getElementById('cancelCreateBtn')?.addEventListener('click', closeCreate);
  document.getElementById('createBtn')?.addEventListener('click', createUser);
  document.getElementById('closeResetModalBtn')?.addEventListener('click', closeReset);
  document.getElementById('cancelResetBtn')?.addEventListener('click', closeReset);
  document.getElementById('resetBtn')?.addEventListener('click', saveReset);
  document.getElementById('closeMsgModalBtn')?.addEventListener('click', () => {
    document.getElementById('msgModal').classList.remove('open');
  });
  document.getElementById('createPromoBtn')?.addEventListener('click', createPromoCode);
})();
