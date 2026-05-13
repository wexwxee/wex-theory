(function () {
  const body = document.body;

  function parseDatasetJson(value, fallback = null) {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch (e) {
      return fallback;
    }
  }

  window.WEX_SUPPORT_UNREAD_URL = body.dataset.supportUnreadUrl || null;
  window.WEX_SUPPORT_BANNER_MODE = body.dataset.supportBannerMode || null;
  window.WEX_SUPPORT_TARGET_URL = body.dataset.supportTargetUrl || null;
  window.WEX_CSRF_COOKIE_NAME = body.dataset.csrfCookieName || 'csrf_token';
  window.WEX_USER_AUTHENTICATED = body.dataset.userAuthenticated === 'true';
  window.wexPurchaseUser = body.dataset.purchasePublicId
    ? {
        public_id: body.dataset.purchasePublicId || '',
        name: body.dataset.purchaseName || '',
        email: body.dataset.purchaseEmail || '',
      }
    : null;

  function getCookieValue(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return '';
  }
  window.getCookieValue = getCookieValue;

  const COOKIE_CONSENT_KEY = 'wex-cookie-consent';

  function getCookieConsentChoice() {
    try {
      return window.localStorage.getItem(COOKIE_CONSENT_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function setCookieConsentChoice(choice) {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, choice);
    } catch (e) {}
  }

  function hasAnalyticsConsent() {
    return getCookieConsentChoice() === 'analytics';
  }
  window.hasAnalyticsConsent = hasAnalyticsConsent;

  function setupCookieConsentBanner() {
    const banner = document.getElementById('cookieConsentBanner');
    if (!banner || getCookieConsentChoice()) return;

    const acceptBtn = document.getElementById('cookieAcceptBtn');
    const essentialBtn = document.getElementById('cookieEssentialBtn');
    banner.classList.add('show');

    acceptBtn?.addEventListener('click', () => {
      setCookieConsentChoice('analytics');
      banner.classList.remove('show');
      if (typeof window.sendActivityPing === 'function') {
        window.sendActivityPing('consent');
      }
    });

    essentialBtn?.addEventListener('click', () => {
      setCookieConsentChoice('essential');
      banner.classList.remove('show');
    });
  }

  (function () {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = function (resource, options) {
      const opts = options ? { ...options } : {};
      const method = String((opts.method || 'GET')).toUpperCase();
      const rawUrl = typeof resource === 'string' ? resource : (resource && resource.url) || '';
      let sameOrigin = false;
      try {
        const resolved = new URL(rawUrl || window.location.href, window.location.origin);
        sameOrigin = resolved.origin === window.location.origin;
      } catch (e) {}

      if (sameOrigin && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        const headers = new Headers(opts.headers || (resource instanceof Request ? resource.headers : undefined) || {});
        const csrfToken = getCookieValue(window.WEX_CSRF_COOKIE_NAME);
        if (csrfToken && !headers.has('X-CSRF-Token')) {
          headers.set('X-CSRF-Token', csrfToken);
        }
        opts.headers = headers;
        if (!opts.credentials) {
          opts.credentials = 'same-origin';
        }
      }
      return nativeFetch(resource, opts);
    };
  })();

  (function () {
    const t = localStorage.getItem('wex-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  })();

  function toggleTheme() {
    const h = document.documentElement;
    const next = h.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    h.setAttribute('data-theme', next);
    localStorage.setItem('wex-theme', next);
  }
  window.toggleTheme = toggleTheme;

  function sbOpen() {
    document.getElementById('sidebar')?.classList.add('open');
    document.getElementById('sbOverlay')?.classList.add('open');
  }

  function sbClose() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sbOverlay')?.classList.remove('open');
  }

  window.sbOpen = sbOpen;
  window.sbClose = sbClose;

  function showToast(msg, type = 'info') {
    const colors = { success: 'var(--correct)', error: 'var(--wrong)', info: 'var(--text)' };
    const bgs = { success: 'var(--correct-bg)', error: 'var(--wrong-bg)', info: 'var(--bg-card)' };
    const borders = { success: 'var(--correct)', error: 'var(--wrong)', info: 'var(--border)' };
    const t = document.createElement('div');
    t.style.cssText = `background:${bgs[type]};color:${colors[type]};padding:12px 16px;border-radius:8px;font-size:0.85rem;box-shadow:0 4px 20px rgba(0,0,0,0.4);opacity:0;transition:opacity .25s,transform .25s;transform:translateX(20px);border:1px solid ${borders[type]};max-width:300px;`;
    t.textContent = msg;
    document.getElementById('toast-container')?.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateX(0)'; });
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 280); }, 3500);
  }
  window.showToast = showToast;

  async function doLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }
  window.doLogout = doLogout;

  function buildTelegramPurchaseMessage(options = {}) {
    const plan = options.plan || 'Practice Library';
    const amount = options.amount || 'Access request';
    const duration = options.duration || '30 days';
    const orderId = 'REQ-' + Date.now().toString().slice(-10) + '-' + Math.floor(100 + Math.random() * 900);
    const user = window.wexPurchaseUser;
    return {
      orderId,
      text: [
        'Hello! I would like to request access for WEXTheory.',
        '',
        `User ID: ${user.public_id}`,
        `Order ID: ${orderId}`,
        `Plan: ${plan}`,
        `Amount: ${amount}`,
        `Duration: ${duration}`,
        `Email: ${user.email}`,
        `Name: ${user.name}`
      ].join('\n')
    };
  }

  async function openTelegramPurchase(options = {}) {
    if (!window.wexPurchaseUser || !window.wexPurchaseUser.public_id) {
      const goRegister = confirm('To create a payment request, first sign in or create your account so we can attach access to your user ID. Open registration now?');
      if (goRegister) window.location.href = '/register';
      return false;
    }

    const payload = buildTelegramPurchaseMessage(options);
    const confirmed = confirm(
      'Open Telegram and copy a ready access message?\n\n' +
      `User ID: ${window.wexPurchaseUser.public_id}\n` +
      `Order ID: ${payload.orderId}\n` +
      `Plan: ${options.plan || 'Practice Library'}\n` +
      `Amount: ${options.amount || 'Access request'}`
    );
    if (!confirmed) return false;

    let copied = false;
    try {
      await navigator.clipboard.writeText(payload.text);
      copied = true;
    } catch (e) {}

    const encoded = encodeURIComponent(payload.text);
    const tgAppUrl = `tg://resolve?domain=wexwxeee&text=${encoded}`;
    const tgWebUrl = `https://t.me/wexwxeee?text=${encoded}`;

    const win = window.open(tgAppUrl, '_blank', 'noopener');
    setTimeout(() => {
      if (!win || win.closed === false) {
        window.open(tgWebUrl, '_blank', 'noopener');
      }
    }, 350);

    showToast(
      copied
        ? 'Telegram opened. If the text is not inserted automatically, just paste it into the chat.'
        : 'Telegram opened. If the text is not inserted automatically, copy the payment details manually.',
      'success'
    );
    return false;
  }
  window.openTelegramPurchase = openTelegramPurchase;

  async function refreshSupportUnreadUI() {
    const badge = document.getElementById('supportUnreadBadge');
    const banner = document.getElementById('topUnreadBanner');
    const bannerText = document.getElementById('topUnreadBannerText');
    const navPill = document.getElementById('navUnreadPill');
    const navText = document.getElementById('navUnreadText');
    if (!badge && !banner && !navPill) return;

    try {
      const url = window.WEX_SUPPORT_UNREAD_URL;
      if (!url) return;
      const response = await fetch(url, { headers: { accept: 'application/json' } });
      if (!response.ok) return;
      const data = await response.json();
      const unreadCount = Array.isArray(data.threads)
        ? data.threads.reduce((sum, thread) => sum + (thread.unread_count || 0), 0)
        : 0;

      if (badge) {
        if (unreadCount > 0) {
          badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
          badge.classList.add('show');
        } else {
          badge.textContent = '';
          badge.classList.remove('show');
        }
      }

      if (navPill && navText) {
        if (unreadCount > 0) {
          navText.textContent = window.WEX_SUPPORT_BANNER_MODE === 'admin'
            ? `${unreadCount} new support`
            : `${unreadCount} new reply`;
          navPill.classList.add('show');
          const navRight = document.querySelector('.nav-right');
          if (navRight && navPill.parentElement !== navRight) {
            navRight.insertBefore(navPill, navRight.firstChild);
          }
        } else {
          navPill.classList.remove('show');
        }
      }

      if (banner && bannerText) {
        const showOnPage = window.location.pathname === '/dashboard' || window.location.pathname === '/admin';
        if (showOnPage && unreadCount > 0) {
          if (window.WEX_SUPPORT_BANNER_MODE === 'admin') {
            bannerText.textContent = `You have ${unreadCount} unread support ${unreadCount === 1 ? 'message' : 'messages'}.`;
          } else {
            bannerText.textContent = `You have ${unreadCount} unread ${unreadCount === 1 ? 'reply' : 'replies'} from support.`;
          }
          banner.classList.add('show');
        } else {
          banner.classList.remove('show');
        }
      }
    } catch (error) {
      console.error('Unread support count failed', error);
    }
  }
  window.refreshSupportUnreadUI = refreshSupportUnreadUI;

  function injectThemeIcons() {
    const SVG_SUN = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
    const SVG_MOON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
    document.querySelectorAll('.theme-btn').forEach((btn) => {
      if (!btn.querySelector('.theme-icon-sun')) {
        btn.innerHTML = '<span class="theme-icon-sun">' + SVG_SUN + '</span><span class="theme-icon-moon">' + SVG_MOON + '</span>';
      }
    });
  }

  document.getElementById('sbOverlay')?.addEventListener('click', sbClose);
  document.getElementById('sbCloseBtn')?.addEventListener('click', sbClose);
  document.getElementById('sbThemeBtn')?.addEventListener('click', toggleTheme);
  document.getElementById('sbLogoutBtn')?.addEventListener('click', doLogout);
  document.querySelectorAll('.burger-btn').forEach((btn) => {
    btn.addEventListener('click', sbOpen);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') sbClose();
  });

  injectThemeIcons();
  setupCookieConsentBanner();
  (function () {
    const HEARTBEAT_INTERVAL_MS = 90000;
    const MIN_REPEAT_MS = 15000;
    let lastPingAt = 0;
    let pingInFlight = false;

    function getActivityTabId() {
      try {
        const existing = window.sessionStorage.getItem('wex-activity-tab-id');
        if (existing) return existing;
        const created = 'tab-' + Math.random().toString(36).slice(2, 12);
        window.sessionStorage.setItem('wex-activity-tab-id', created);
        return created;
      } catch (e) {
        return 'tab-fallback';
      }
    }

    async function sendActivityPing(reason = 'interval') {
      if (!hasAnalyticsConsent()) return;
      const path = window.location.pathname || '/';
      if (!path || path.startsWith('/api/') || path.startsWith('/static/')) return;
      if (document.hidden && reason === 'interval') return;
      if (pingInFlight && reason === 'interval') return;

      const now = Date.now();
      if (now - lastPingAt < MIN_REPEAT_MS) return;
      lastPingAt = now;

      try {
        pingInFlight = true;
        await fetch('/api/activity/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({
            path,
            tab_id: getActivityTabId(),
            reason,
            analytics_consent: true,
          }),
        });
      } catch (error) {
        console.debug('Activity ping skipped', error);
      } finally {
        pingInFlight = false;
      }
    }
    window.sendActivityPing = sendActivityPing;

    const schedulePing = (reason, delay = 0) => {
      const run = () => sendActivityPing(reason);
      if ('requestIdleCallback' in window && delay === 0) {
        window.requestIdleCallback(run, { timeout: 2500 });
      } else {
        window.setTimeout(run, delay);
      }
    };

    schedulePing('load', 1800);
    window.addEventListener('pageshow', () => sendActivityPing('pageshow'));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) sendActivityPing('visible');
    });
    window.setInterval(() => {
      sendActivityPing('interval');
    }, HEARTBEAT_INTERVAL_MS);
  })();
  (function () {
    const IMPORTANT_TEXT = /start|access|pricing|demo|words|study|support|contact|saved|history|review|test|library|continue/i;
    const sentLongView = new Set();
    let lastClick = { key: '', at: 0, count: 0 };
    let lastEventAt = 0;

    function currentPath() {
      return window.location.pathname || '/';
    }

    function canSendJourneyEvent() {
      const path = currentPath();
      return hasAnalyticsConsent()
        && !document.hidden
        && !path.startsWith('/admin')
        && !path.startsWith('/api/')
        && !path.startsWith('/static/');
    }

    function classifyAction(target, label) {
      const href = target?.getAttribute?.('href') || '';
      let path = currentPath();
      try {
        path = href ? new URL(href, window.location.origin).pathname : path;
      } catch (e) {}
      if (path.startsWith('/pricing')) return 'pricing_open';
      if (path.startsWith('/exam-words')) return 'words_open';
      if (path.startsWith('/study-guide')) return 'study_guide_open';
      if (path.startsWith('/support') || path.startsWith('/contact')) return 'support_open';
      if (path.startsWith('/test/')) return 'test_start';
      if (IMPORTANT_TEXT.test(label)) return 'important_click';
      return '';
    }

    async function sendJourneyEvent(eventType, label) {
      if (!canSendJourneyEvent() || !eventType) return;
      const now = Date.now();
      if (now - lastEventAt < 900 && eventType !== 'repeat_click') return;
      lastEventAt = now;

      try {
        await fetch('/api/activity/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({
            event_type: eventType,
            path: currentPath(),
            label: String(label || '').slice(0, 90),
            analytics_consent: true,
          }),
        });
      } catch (error) {
        console.debug('Journey event skipped', error);
      }
    }
    window.sendJourneyEvent = sendJourneyEvent;

    document.addEventListener('click', (event) => {
      const target = event.target.closest('a, button');
      if (!target || target.closest('.sidebar, .cookie-consent')) return;

      const label = (target.dataset.journeyLabel || target.textContent || target.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
      if (!label || label.length < 2) return;

      const key = `${currentPath()}|${label.toLowerCase()}`;
      const now = Date.now();
      if (lastClick.key === key && now - lastClick.at < 4200) {
        lastClick.count += 1;
      } else {
        lastClick = { key, at: now, count: 1 };
      }
      lastClick.at = now;

      if (lastClick.count >= 3) {
        sendJourneyEvent('repeat_click', label);
        lastClick.count = 0;
        return;
      }

      const eventType = classifyAction(target, label);
      if (eventType) sendJourneyEvent(eventType, label);
    }, true);

    window.setTimeout(() => {
      const path = currentPath();
      const shouldTrackLongView = path === '/pricing'
        || path === '/exam-words-demo'
        || path === '/study-guide'
        || path.startsWith('/test/')
        || path.startsWith('/support')
        || path.startsWith('/contact');
      if (shouldTrackLongView && !sentLongView.has(path)) {
        sentLongView.add(path);
        sendJourneyEvent('long_view', `Long view: ${path}`);
      }
    }, 75000);
  })();
  if (window.WEX_SUPPORT_UNREAD_URL) {
    window.setTimeout(refreshSupportUnreadUI, 1500);
    window.setInterval(() => {
      if (!document.hidden) refreshSupportUnreadUI();
    }, 20000);
  }
})();
