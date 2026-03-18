(function () {
  const currentTheme = localStorage.getItem('wex-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  const navBtn = document.getElementById('navThemeBtn');
  if (navBtn) navBtn.textContent = currentTheme === 'dark' ? 'вЂпёЏ' : 'рџЊ™';

  document.getElementById('supportBurgerBtn')?.addEventListener('click', sbOpen);
  navBtn?.addEventListener('click', toggleTheme);

  const supportPage = document.getElementById('supportPage');
  const isAdminView = supportPage?.dataset.isAdminView === 'true';
  let activeThreadId = supportPage?.dataset.activeThreadId ? Number(supportPage.dataset.activeThreadId) : null;
  const dataUrlBase = isAdminView ? '/api/support/threads-data?scope=admin' : '/api/support/threads-data';
  const threadList = document.getElementById('threadList');
  const chatPanel = document.getElementById('chatPanel');
  let isSubmitting = false;
  let lastMessagesSignature = '';
  let draftByThread = {};
  let statusDraftByThread = {};

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function createNode(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  function clearNode(node) {
    if (node) node.replaceChildren();
  }

  function formatPreview(thread) {
    if (thread.preview) return escapeHtml(thread.preview);
    if (thread.has_attachment) return 'Attachment added';
    return 'No messages yet';
  }

  function syncDraftFromComposer() {
    const textarea = document.getElementById('replyMessage');
    if (textarea && activeThreadId) {
      draftByThread[activeThreadId] = textarea.value;
    }
    const statusSelect = document.getElementById('replyStatus');
    if (statusSelect && activeThreadId) {
      statusDraftByThread[activeThreadId] = statusSelect.value;
    }
  }

  function hasPendingAttachment() {
    const fileInput = document.getElementById('replyAttachment');
    return !!(fileInput && fileInput.files && fileInput.files.length);
  }

  function buildMessagesSignature(thread) {
    return (thread.messages || []).map((message) => `${message.id}:${message.created_at}:${message.body}:${message.attachment_name}`).join('|');
  }

  function messageBubbleClass(message) {
    if (message.sender_role === 'system') return 'message-row system';
    const mine = (isAdminView && message.sender_role === 'admin') || (!isAdminView && message.sender_role === 'user');
    return mine ? 'message-row mine' : 'message-row';
  }

  function renderAttachment(message) {
    if (!message.attachment_path) return null;
    const card = createNode('div', 'attachment-card');
    card.appendChild(createNode('div', 'attachment-title', 'Attachment'));
    card.appendChild(createNode('div', 'attachment-name', message.attachment_name || 'Attached file'));

    const actions = createNode('div', 'attachment-actions');

    const openLink = createNode('a', 'btn-ghost btn-sm', 'Open attachment');
    openLink.href = message.attachment_path;
    openLink.target = '_blank';
    openLink.rel = 'noopener';
    actions.appendChild(openLink);

    const downloadLink = createNode('a', 'btn-ghost btn-sm', 'Download');
    downloadLink.href = message.attachment_path;
    downloadLink.download = '';
    actions.appendChild(downloadLink);

    card.appendChild(actions);

    if (message.is_image) {
      const preview = createNode('img', 'attachment-preview');
      preview.src = message.attachment_path;
      preview.alt = message.attachment_name || 'attachment';
      card.appendChild(preview);
    }

    return card;
  }

  function renderThreadList(threads) {
    if (!threadList) return;
    clearNode(threadList);
    if (!threads.length) {
      const empty = createNode('div', 'chat-empty-inner');
      const title = createNode('div', 'chat-title', 'No conversations yet');
      title.style.marginBottom = '8px';
      empty.appendChild(title);
      empty.appendChild(createNode('div', 'empty-copy', isAdminView
        ? 'User support conversations will appear here automatically.'
        : 'Open Contact to create your first support conversation.'
      ));
      threadList.appendChild(empty);
      return;
    }

    threads.forEach((thread) => {
      const node = createNode('a', `thread-card${thread.id === activeThreadId ? ' active' : ''}`);
      node.href = '#';
      node.dataset.threadId = String(thread.id);

      const head = createNode('div', 'thread-card-head');
      head.appendChild(createNode('div', 'thread-subject', thread.subject));
      const headRight = createNode('div');
      headRight.style.cssText = 'display:flex;gap:8px;align-items:center;';
      if (thread.has_attachment) {
        headRight.appendChild(createNode('span', 'attach-badge', 'File'));
      }
      if (thread.unread_count > 0) {
        headRight.appendChild(createNode('span', 'count-pill', String(thread.unread_count)));
      }
      head.appendChild(headRight);
      node.appendChild(head);

      if (isAdminView) {
        node.appendChild(createNode('div', 'thread-meta', `${thread.user_name || ''} В· ${thread.user_public_id || ''}`));
      }

      node.appendChild(createNode('div', 'thread-preview', formatPreview(thread)));
      if (thread.unread_count > 0) {
        node.appendChild(createNode('div', 'thread-fresh', 'New message'));
      }
      const updated = createNode('div', 'thread-meta', `Updated ${thread.updated_at || ''}`);
      updated.style.marginTop = '10px';
      node.appendChild(updated);

      node.addEventListener('click', function (event) {
        event.preventDefault();
        activeThreadId = Number(this.getAttribute('data-thread-id'));
        updateUrl(activeThreadId);
        loadSupportData(true);
      });
      threadList.appendChild(node);
    });
    return;
  }

  function renderChat(activeThread, threads) {
    if (!chatPanel) return;
    syncDraftFromComposer();
    clearNode(chatPanel);

    if (!activeThread) {
      lastMessagesSignature = '';
      const empty = createNode('div', 'chat-empty');
      const inner = createNode('div', 'chat-empty-inner');
      const title = createNode('div', 'chat-title', 'No active chat selected');
      title.style.marginBottom = '10px';
      inner.appendChild(title);
      inner.appendChild(createNode('div', 'empty-copy', isAdminView
        ? 'Choose a conversation on the left to view the chat, status, and attachments.'
        : 'Open Contact and create a request. Your support chat will appear here automatically.'
      ));
      empty.appendChild(inner);
      chatPanel.appendChild(empty);
      return;
    }

    const storedDraft = draftByThread[activeThread.id] || '';
    const storedStatus = statusDraftByThread[activeThread.id] || activeThread.status;
    const statusText = activeThread.status.charAt(0).toUpperCase() + activeThread.status.slice(1);

    const wrap = createNode('div', 'chat-wrap');
    const header = createNode('div', 'chat-header');
    const headerTop = createNode('div', 'chat-header-top');
    const headerLeft = createNode('div');
    headerLeft.appendChild(createNode('div', 'chat-title', activeThread.subject));
    headerLeft.appendChild(createNode('div', 'chat-meta', `Status: ${statusText} В· Created ${activeThread.created_at}`));
    headerTop.appendChild(headerLeft);
    headerTop.appendChild(createNode('span', 'status-badge', statusText));
    header.appendChild(headerTop);

    const headerCopy = createNode('div', 'chat-header-copy');
    if (isAdminView) {
      headerCopy.appendChild(createNode('strong', null, activeThread.user_name || ''));
      headerCopy.appendChild(document.createTextNode(` В· ${activeThread.user_email || ''}`));
      headerCopy.appendChild(document.createElement('br'));
      headerCopy.appendChild(document.createTextNode('User ID: '));
      headerCopy.appendChild(createNode('strong', null, activeThread.user_public_id || ''));
    } else {
      headerCopy.appendChild(document.createTextNode('If you attached a screenshot or file, it will appear directly in the message below with the '));
      headerCopy.appendChild(createNode('strong', null, 'Open attachment'));
      headerCopy.appendChild(document.createTextNode(' button.'));
    }
    header.appendChild(headerCopy);
    wrap.appendChild(header);

    const messagesNode = createNode('div', 'chat-scroll');
    messagesNode.id = 'chatMessages';
    (activeThread.messages || []).forEach((message) => {
      const row = createNode('div', messageBubbleClass(message));
      const bubble = createNode('div', 'message-bubble');
      const meta = createNode('div', 'message-meta');
      meta.appendChild(createNode('span', null, message.sender_name || (message.sender_role === 'system' ? 'System' : message.sender_role === 'admin' ? 'Support' : 'User')));
      meta.appendChild(createNode('span', null, message.created_at || ''));
      bubble.appendChild(meta);
      if (message.body) {
        bubble.appendChild(createNode('div', 'message-body', message.body));
      }
      const attachmentNode = renderAttachment(message);
      if (attachmentNode) bubble.appendChild(attachmentNode);
      row.appendChild(bubble);
      messagesNode.appendChild(row);
    });
    wrap.appendChild(messagesNode);

    const form = createNode('form', 'composer');
    form.id = 'replyForm';
    form.action = `/api/support/threads/${activeThread.id}/reply`;
    form.method = 'post';
    form.enctype = 'multipart/form-data';

    if (isAdminView) {
      const statusGroup = createNode('div', 'form-group');
      const statusLabel = createNode('label', 'form-label', 'Status');
      statusLabel.setAttribute('for', 'replyStatus');
      const statusSelectNode = createNode('select');
      statusSelectNode.id = 'replyStatus';
      statusSelectNode.name = 'status';
      ['open', 'answered', 'closed'].forEach((value) => {
        const option = createNode('option', null, value.charAt(0).toUpperCase() + value.slice(1));
        option.value = value;
        if (value === activeThread.status) option.selected = true;
        statusSelectNode.appendChild(option);
      });
      statusGroup.appendChild(statusLabel);
      statusGroup.appendChild(statusSelectNode);
      form.appendChild(statusGroup);
    }

    const messageGroup = createNode('div', 'form-group');
    const messageLabel = createNode('label', 'form-label', isAdminView ? 'Reply' : 'Message');
    messageLabel.setAttribute('for', 'replyMessage');
    const textarea = createNode('textarea');
    textarea.id = 'replyMessage';
    textarea.name = 'message';
    textarea.rows = 4;
    textarea.placeholder = isAdminView
      ? 'Reply to the user here...'
      : 'Describe the problem in more detail. If there is an error, you can attach a screenshot or file below.';
    messageGroup.appendChild(messageLabel);
    messageGroup.appendChild(textarea);
    form.appendChild(messageGroup);

    const uploadBox = createNode('div', 'upload-box');
    const uploadLabel = createNode('label', 'form-label', 'Attachment (optional)');
    uploadLabel.setAttribute('for', 'replyAttachment');
    const fileInput = createNode('input');
    fileInput.type = 'file';
    fileInput.id = 'replyAttachment';
    fileInput.name = 'attachment';
    fileInput.accept = '.png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.log,.json';
    const uploadHint = createNode('div', 'upload-hint', 'You can attach a screenshot, PDF, log, JSON, or another supported file up to 10 MB.');
    const uploadName = createNode('div', 'upload-name', 'No file selected');
    uploadName.id = 'uploadName';
    const uploadPreview = createNode('img', 'upload-preview');
    uploadPreview.id = 'uploadPreview';
    uploadPreview.alt = 'Selected attachment preview';
    uploadBox.appendChild(uploadLabel);
    uploadBox.appendChild(fileInput);
    uploadBox.appendChild(uploadHint);
    uploadBox.appendChild(uploadName);
    uploadBox.appendChild(uploadPreview);
    form.appendChild(uploadBox);

    const composerRow = createNode('div', 'composer-row');
    composerRow.style.marginTop = '14px';
    composerRow.appendChild(createNode('div', 'composer-note', 'Live mode is on. New messages will appear automatically.'));
    const submitBtn = createNode('button', 'btn-primary', isAdminView ? 'Send Reply' : 'Send Message');
    submitBtn.type = 'submit';
    submitBtn.id = 'replySubmit';
    composerRow.appendChild(submitBtn);
    form.appendChild(composerRow);

    wrap.appendChild(form);
    chatPanel.appendChild(wrap);

    bindComposer();
    textarea.value = storedDraft;
    const statusSelectNode = document.getElementById('replyStatus');
    if (statusSelectNode && storedStatus) {
      statusSelectNode.value = storedStatus;
    }
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
    lastMessagesSignature = buildMessagesSignature(activeThread);
    return;

  }

  function bindComposer() {
    const form = document.getElementById('replyForm');
    const fileInput = document.getElementById('replyAttachment');
    const nameNode = document.getElementById('uploadName');
    const previewNode = document.getElementById('uploadPreview');
    if (!form) return;

    const textarea = document.getElementById('replyMessage');
    if (textarea) {
      textarea.addEventListener('input', syncDraftFromComposer);
    }
    const statusSelect = document.getElementById('replyStatus');
    if (statusSelect) {
      statusSelect.addEventListener('change', syncDraftFromComposer);
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (isSubmitting) return;
      isSubmitting = true;
      const submitBtn = document.getElementById('replySubmit');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: {
            'x-requested-with': 'XMLHttpRequest',
            'accept': 'application/json'
          }
        });
        const data = await response.json();
        if (!response.ok) {
          alert(data.error || 'Failed to send message');
          return;
        }
        form.reset();
        if (activeThreadId) {
          draftByThread[activeThreadId] = '';
        }
        if (nameNode) nameNode.textContent = 'No file selected';
        if (previewNode) {
          previewNode.style.display = 'none';
          previewNode.removeAttribute('src');
        }
        await loadSupportData(true);
      } catch (error) {
        alert('Could not send the message right now.');
      } finally {
        isSubmitting = false;
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        const file = this.files && this.files[0];
        if (nameNode) nameNode.textContent = file ? file.name : 'No file selected';
        if (!previewNode) return;
        if (file && file.type && file.type.startsWith('image/')) {
          previewNode.src = URL.createObjectURL(file);
          previewNode.style.display = 'block';
        } else {
          previewNode.style.display = 'none';
          previewNode.removeAttribute('src');
        }
      });
    }
  }

  function updateUrl(threadId) {
    const url = new URL(window.location.href);
    if (threadId) {
      url.searchParams.set('thread', threadId);
    } else {
      url.searchParams.delete('thread');
    }
    window.history.replaceState({}, '', url.toString());
  }

  async function loadSupportData(forceScroll) {
    try {
      syncDraftFromComposer();
      const url = `${dataUrlBase}${activeThreadId ? `&thread=${activeThreadId}` : ''}`;
      const response = await fetch(url, { headers: { accept: 'application/json' } });
      if (!response.ok) return;
      const data = await response.json();
      if (!activeThreadId && data.active_thread_id) {
        activeThreadId = data.active_thread_id;
        updateUrl(activeThreadId);
      }
      const activeThread = data.threads.find((thread) => thread.id === activeThreadId) || data.threads[0] || null;
      if (activeThread && activeThread.id !== activeThreadId) {
        activeThreadId = activeThread.id;
        updateUrl(activeThreadId);
      }
      renderThreadList(data.threads);

      const nextSignature = activeThread ? buildMessagesSignature(activeThread) : '';
      const sameThread = activeThread && activeThread.id === activeThreadId;
      const shouldSkipChatRerender = !forceScroll && sameThread && hasPendingAttachment();

      if (!shouldSkipChatRerender && (forceScroll || nextSignature !== lastMessagesSignature || !document.getElementById('replyForm'))) {
        renderChat(activeThread, data.threads);
      }

      if (forceScroll) {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
      }
      if (window.refreshSupportUnreadUI) {
        window.refreshSupportUnreadUI();
      }
    } catch (error) {
      console.error('Support refresh failed', error);
    }
  }

  bindComposer();
  loadSupportData(false);
  window.setInterval(function () {
    if (!document.hidden) loadSupportData(false);
  }, 4000);
})();

