(function () {
  const currentTheme = localStorage.getItem('wex-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);

  const navBtn = document.getElementById('navThemeBtn');
  if (navBtn) navBtn.textContent = currentTheme === 'dark' ? 'Light' : 'Dark';
  document.getElementById('supportBurgerBtn')?.addEventListener('click', () => {
    if (typeof window.sbOpen === 'function') window.sbOpen();
  });
  navBtn?.addEventListener('click', () => {
    if (typeof window.toggleTheme === 'function') {
      window.toggleTheme();
      const nextTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      navBtn.textContent = nextTheme === 'dark' ? 'Light' : 'Dark';
    }
  });

  const page = document.getElementById('supportPage');
  if (!page) return;

  const isAdminView = page.dataset.isAdminView === 'true';
  let activeThreadId = page.dataset.activeThreadId ? Number(page.dataset.activeThreadId) : null;
  let activeFilter = 'all';
  let searchQuery = '';
  let isSubmitting = false;
  let lastThreadSignature = '';
  let lastActiveSignature = '';
  let uploadPreviewUrl = null;
  const drafts = new Map();
  const statusDrafts = new Map();

  const threadList = document.getElementById('threadList');
  const chatPanel = document.getElementById('chatPanel');
  const threadSearch = document.getElementById('threadSearch');
  const threadFilters = document.getElementById('threadFilters');
  const threadSummary = document.getElementById('threadSummary');
  const liveState = document.getElementById('supportLiveState');

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  function setLiveState(text, offline) {
    if (!liveState) return;
    liveState.textContent = text;
    liveState.classList.toggle('is-offline', !!offline);
  }

  function formatStatus(status) {
    const raw = String(status || 'open');
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  function formatPreview(thread) {
    if (thread.preview) return thread.preview;
    if (thread.has_attachment) return 'Attachment added';
    return 'No messages yet';
  }

  function currentDataUrl() {
    const params = new URLSearchParams();
    if (isAdminView) params.set('scope', 'admin');
    if (activeThreadId) params.set('thread', String(activeThreadId));
    return `/api/support/threads-data?${params.toString()}`;
  }

  function updateUrl(threadId) {
    const url = new URL(window.location.href);
    if (threadId) url.searchParams.set('thread', String(threadId));
    else url.searchParams.delete('thread');
    window.history.replaceState({}, '', url.toString());
  }

  function visibleThreads(threads) {
    const query = searchQuery.trim().toLowerCase();
    return threads.filter((thread) => {
      if (activeFilter === 'unread' && !(thread.unread_count > 0)) return false;
      if (activeFilter !== 'all' && activeFilter !== 'unread' && thread.status !== activeFilter) return false;
      if (!query) return true;
      const haystack = [
        thread.subject,
        thread.preview,
        thread.status,
        thread.user_name,
        thread.user_email,
        thread.user_public_id,
        ...(thread.messages || []).map((message) => `${message.body} ${message.attachment_name}`)
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }

  function threadSignature(threads) {
    return threads.map((thread) => [
      thread.id,
      thread.status,
      thread.updated_at,
      thread.unread_count,
      thread.preview,
      thread.has_attachment
    ].join(':')).join('|');
  }

  function activeSignature(thread) {
    if (!thread) return '';
    return [
      thread.id,
      thread.status,
      thread.updated_at,
      ...(thread.messages || []).map((message) => [
        message.id,
        message.sender_role,
        message.created_at,
        message.body,
        message.attachment_name,
        message.attachment_path
      ].join(':'))
    ].join('|');
  }

  function syncDraft() {
    if (!activeThreadId) return;
    const textarea = document.getElementById('supportReplyMessage');
    if (textarea) drafts.set(activeThreadId, textarea.value);
    const status = document.getElementById('supportStatus');
    if (status) statusDrafts.set(activeThreadId, status.value);
  }

  function renderThreads(threads) {
    if (!threadList) return;
    const filtered = visibleThreads(threads);
    if (threadSummary) {
      const unread = threads.reduce((sum, thread) => sum + (thread.unread_count || 0), 0);
      threadSummary.textContent = `${threads.length} total${unread ? ` / ${unread} unread` : ''}`;
    }
    threadList.replaceChildren();

    if (!filtered.length) {
      threadList.appendChild(el('div', 'support-empty-card', threads.length ? 'No conversations match this filter.' : 'No support conversations yet.'));
      return;
    }

    filtered.forEach((thread) => {
      const card = el('button', [
        'support-thread-card',
        thread.id === activeThreadId ? 'is-active' : '',
        thread.unread_count > 0 ? 'is-unread' : ''
      ].filter(Boolean).join(' '));
      card.type = 'button';
      card.dataset.threadId = String(thread.id);

      const top = el('div', 'support-thread-top');
      top.appendChild(el('div', 'support-thread-title', thread.subject || 'Support request'));
      const badges = el('div', 'support-thread-badges');
      if (thread.unread_count > 0) badges.appendChild(el('span', 'support-badge support-badge--new', String(thread.unread_count)));
      badges.appendChild(el('span', 'support-badge', formatStatus(thread.status)));
      top.appendChild(badges);
      card.appendChild(top);

      if (isAdminView) {
        card.appendChild(el('div', 'support-thread-meta', `${thread.user_name || 'User'} / ${thread.user_public_id || ''}`));
      }
      card.appendChild(el('div', 'support-thread-preview', formatPreview(thread)));
      card.appendChild(el('div', 'support-thread-meta', `Updated ${thread.updated_at || ''}`));

      card.addEventListener('click', () => {
        syncDraft();
        activeThreadId = thread.id;
        updateUrl(activeThreadId);
        loadSupportData({ forceChat: true, scroll: true });
      });
      threadList.appendChild(card);
    });
  }

  function senderName(thread, message) {
    if (message.sender_role === 'system') return 'System';
    if (message.sender_role === 'admin') return isAdminView ? 'You' : 'Support';
    return isAdminView ? (thread.user_name || 'User') : 'You';
  }

  function senderSubLabel(message) {
    if (message.sender_role === 'system') return 'Automatic note';
    if (message.sender_role === 'admin') return isAdminView ? 'Admin reply' : 'WEXTheory support';
    return isAdminView ? 'User message' : 'Your message';
  }

  function avatarText(thread, message) {
    if (message.sender_role === 'system') return 'S';
    if (message.sender_role === 'admin') return 'A';
    const name = isAdminView ? (thread.user_name || 'U') : 'You';
    return String(name).trim().charAt(0).toUpperCase() || 'U';
  }

  function renderAttachment(message) {
    if (!message.attachment_path) return null;
    const box = el('div', 'support-attachment');
    box.appendChild(el('div', 'support-attachment-label', message.is_image ? 'Image attached' : 'File attached'));
    box.appendChild(el('div', 'support-attachment-name', message.attachment_name || 'Attached file'));

    const metaParts = [];
    if (message.attachment_type) metaParts.push(message.attachment_type);
    if (metaParts.length) box.appendChild(el('div', 'support-attachment-meta', metaParts.join(' / ')));

    const actions = el('div', 'support-attachment-actions');
    const open = el('a', 'support-file-btn', 'Open');
    open.href = message.attachment_path;
    open.target = '_blank';
    open.rel = 'noopener';
    const download = el('a', 'support-file-btn', 'Download');
    download.href = message.attachment_path;
    download.download = '';
    actions.append(open, download);
    box.appendChild(actions);

    if (message.is_image) {
      const image = el('img', 'support-attachment-preview');
      image.src = message.attachment_path;
      image.alt = message.attachment_name || 'Attachment';
      image.loading = 'lazy';
      image.addEventListener('error', () => {
        image.remove();
        if (!box.querySelector('.support-preview-error')) {
          box.appendChild(el('div', 'support-preview-error', 'Preview is not available. Use Open to view the file.'));
        }
      });
      box.appendChild(image);
    }

    return box;
  }

  function renderMessages(thread, scroll) {
    const list = el('div', 'support-message-list');
    list.id = 'supportMessageList';

    (thread.messages || []).forEach((message) => {
      const mine = (isAdminView && message.sender_role === 'admin') || (!isAdminView && message.sender_role === 'user');
      const row = el('div', [
        'support-message-row',
        mine ? 'is-mine' : '',
        message.sender_role === 'system' ? 'is-system' : ''
      ].filter(Boolean).join(' '));
      const avatar = el('div', [
        'support-avatar',
        `support-avatar--${message.sender_role || 'user'}`
      ].join(' '), avatarText(thread, message));
      const bubble = el('article', 'support-message');

      const meta = el('div', 'support-message-meta');
      const who = el('div');
      who.appendChild(el('strong', null, senderName(thread, message)));
      who.appendChild(el('span', null, senderSubLabel(message)));
      meta.append(who);
      meta.append(el('span', null, message.created_at || ''));
      bubble.appendChild(meta);

      if (message.body) bubble.appendChild(el('div', 'support-message-body', message.body));
      const attachment = renderAttachment(message);
      if (attachment) bubble.appendChild(attachment);

      row.append(avatar, bubble);
      list.appendChild(row);
    });

    if (scroll) {
      requestAnimationFrame(() => {
        list.scrollTop = list.scrollHeight;
      });
    }
    return list;
  }

  function renderComposer(thread) {
    const form = el('form', 'support-composer');
    form.id = 'supportReplyForm';
    form.action = `/api/support/threads/${thread.id}/reply`;
    form.enctype = 'multipart/form-data';

    const feedback = el('div', 'support-feedback');
    feedback.id = 'supportFeedback';
    feedback.setAttribute('aria-live', 'polite');
    form.appendChild(feedback);

    const grid = el('div', 'support-composer-grid');
    const messageField = el('div', 'support-field');
    const messageLabel = el('label', null, isAdminView ? 'Message to user' : 'Message to support');
    messageLabel.setAttribute('for', 'supportReplyMessage');
    const textarea = el('textarea');
    textarea.id = 'supportReplyMessage';
    textarea.name = 'message';
    textarea.rows = 4;
    textarea.placeholder = isAdminView ? 'Write the reply here...' : 'Write what happened. Add a screenshot if it helps.';
    textarea.value = drafts.get(thread.id) || '';
    textarea.addEventListener('input', syncDraft);
    messageField.append(messageLabel, textarea);
    grid.appendChild(messageField);

    if (isAdminView) {
      const statusField = el('div', 'support-field');
      const statusLabel = el('label', null, 'Ticket status');
      statusLabel.setAttribute('for', 'supportStatus');
      const select = el('select');
      select.id = 'supportStatus';
      select.name = 'status';
      ['open', 'answered', 'closed'].forEach((value) => {
        const option = el('option', null, formatStatus(value));
        option.value = value;
        option.selected = (statusDrafts.get(thread.id) || thread.status) === value;
        select.appendChild(option);
      });
      select.addEventListener('change', syncDraft);
      statusField.append(statusLabel, select);
      grid.appendChild(statusField);
    }
    form.appendChild(grid);

    const upload = el('div', 'support-upload');
    const uploadRow = el('div', 'support-upload-row');
    const fileLabel = el('label', 'support-file-btn', 'Attach');
    fileLabel.setAttribute('for', 'supportAttachment');
    const fileInput = el('input');
    fileInput.id = 'supportAttachment';
    fileInput.name = 'attachment';
    fileInput.type = 'file';
    fileInput.accept = '.png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.log,.json';
    const fileName = el('div', 'support-file-name', 'No file selected');
    fileName.id = 'supportFileName';
    uploadRow.append(fileLabel, fileInput, fileName);
    upload.appendChild(uploadRow);
    upload.appendChild(el('div', 'support-upload-hint', 'Images, PDF, logs, JSON, and text files up to 10 MB.'));
    const preview = el('img', 'support-upload-preview');
    preview.id = 'supportUploadPreview';
    preview.alt = 'Selected attachment preview';
    upload.appendChild(preview);
    form.appendChild(upload);

    const actions = el('div', 'support-composer-actions');
    actions.appendChild(el('div', 'support-composer-note', 'Live updates are on.'));
    const submit = el('button', 'support-send-btn', isAdminView ? 'Send reply' : 'Send message');
    submit.id = 'supportSubmit';
    submit.type = 'submit';
    actions.appendChild(submit);
    form.appendChild(actions);

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
      uploadPreviewUrl = null;
      upload.classList.toggle('is-filled', !!file);
      fileName.textContent = file ? `${file.name} / ${(file.size / 1024 / 1024).toFixed(file.size > 1024 * 1024 ? 1 : 2)} MB` : 'No file selected';
      if (file && file.type.startsWith('image/')) {
        uploadPreviewUrl = URL.createObjectURL(file);
        preview.src = uploadPreviewUrl;
        preview.style.display = 'block';
      } else {
        preview.style.display = 'none';
        preview.removeAttribute('src');
      }
    });

    form.addEventListener('submit', submitReply);
    return form;
  }

  function showFeedback(text, type) {
    const feedback = document.getElementById('supportFeedback');
    if (!feedback) return;
    feedback.textContent = text;
    feedback.className = `support-feedback is-visible ${type ? `is-${type}` : ''}`;
  }

  function renderChat(thread, scroll) {
    if (!chatPanel) return;
    syncDraft();
    chatPanel.replaceChildren();

    if (!thread) {
      const empty = el('div', 'support-chat-empty');
      const inner = el('div');
      inner.appendChild(el('h2', null, 'No active chat selected'));
      inner.appendChild(el('p', null, isAdminView ? 'Choose a request from the inbox to reply.' : 'Create a support request from Contact, then follow the conversation here.'));
      empty.appendChild(inner);
      chatPanel.appendChild(empty);
      return;
    }

    const layout = el('div', 'support-chat-layout');
    const header = el('header', 'support-chat-header');
    const top = el('div', 'support-chat-header-top');
    const titleBox = el('div');
    titleBox.appendChild(el('h2', 'support-chat-title', thread.subject || 'Support request'));
    titleBox.appendChild(el('div', 'support-chat-sub', `Created ${thread.created_at}`));
    top.appendChild(titleBox);
    top.appendChild(el('span', 'support-badge', formatStatus(thread.status)));
    header.appendChild(top);
    if (isAdminView) {
      const details = el('div', 'support-chat-details');
      details.appendChild(el('div', 'support-detail-card', `User: ${thread.user_name || 'User'}`));
      details.appendChild(el('div', 'support-detail-card', `Email: ${thread.user_email || ''}`));
      details.appendChild(el('div', 'support-detail-card', `ID: ${thread.user_public_id || ''}`));
      header.appendChild(details);
    } else {
      header.appendChild(el('div', 'support-chat-user', 'Attach screenshots when something looks wrong. Images appear inside the chat.'));
    }
    layout.appendChild(header);
    layout.appendChild(renderMessages(thread, scroll));
    layout.appendChild(renderComposer(thread));
    chatPanel.appendChild(layout);
  }

  async function submitReply(event) {
    event.preventDefault();
    if (isSubmitting) return;
    const form = event.currentTarget;
    const submit = document.getElementById('supportSubmit');
    const original = submit ? submit.textContent : '';
    isSubmitting = true;
    syncDraft();
    showFeedback('Sending...', '');
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Sending...';
    }

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: {
          accept: 'application/json',
          'x-requested-with': 'XMLHttpRequest'
        },
        cache: 'no-store'
      });
      const data = await response.json();
      if (!response.ok) {
        showFeedback(data.error || 'Could not send the message.', 'error');
        return;
      }
      drafts.set(activeThreadId, '');
      statusDrafts.delete(activeThreadId);
      if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
      uploadPreviewUrl = null;
      showFeedback('Sent.', 'success');
      await loadSupportData({ forceChat: true, scroll: true });
      if (typeof window.refreshSupportUnreadUI === 'function') window.refreshSupportUnreadUI();
    } catch (error) {
      showFeedback('Connection problem. Please try again.', 'error');
      setLiveState('Connection issue', true);
    } finally {
      isSubmitting = false;
      if (submit) {
        submit.disabled = false;
        submit.textContent = original;
      }
    }
  }

  async function loadSupportData(options = {}) {
    const { forceChat = false, scroll = false } = options;
    try {
      syncDraft();
      const response = await fetch(currentDataUrl(), {
        headers: { accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Support API failed');
      const data = await response.json();
      const threads = data.threads || [];
      const requested = activeThreadId;
      let activeThread = threads.find((thread) => thread.id === activeThreadId) || null;
      if (!activeThread && threads.length) {
        activeThread = threads[0];
        activeThreadId = activeThread.id;
        updateUrl(activeThreadId);
      }

      const nextThreadSignature = threadSignature(threads);
      if (forceChat || nextThreadSignature !== lastThreadSignature) {
        renderThreads(threads);
        lastThreadSignature = nextThreadSignature;
      }

      const nextActiveSignature = activeSignature(activeThread);
      const activeChanged = requested !== activeThreadId;
      if (forceChat || activeChanged || nextActiveSignature !== lastActiveSignature || !document.getElementById('supportReplyForm')) {
        renderChat(activeThread, scroll || nextActiveSignature !== lastActiveSignature);
        lastActiveSignature = nextActiveSignature;
      }
      setLiveState('Live', false);
      if (typeof window.refreshSupportUnreadUI === 'function') window.refreshSupportUnreadUI();
    } catch (error) {
      console.error('Support live refresh failed', error);
      setLiveState('Offline', true);
    }
  }

  threadSearch?.addEventListener('input', (event) => {
    searchQuery = event.target.value || '';
    lastThreadSignature = '';
    loadSupportData();
  });

  threadFilters?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    activeFilter = button.dataset.filter || 'all';
    threadFilters.querySelectorAll('[data-filter]').forEach((node) => {
      node.classList.toggle('is-active', node === button);
    });
    lastThreadSignature = '';
    loadSupportData();
  });

  window.addEventListener('focus', () => loadSupportData({ forceChat: true }));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadSupportData({ forceChat: true });
  });

  loadSupportData({ forceChat: true, scroll: true });
  window.setInterval(() => {
    if (!document.hidden && !isSubmitting) loadSupportData();
  }, 1200);
})();
