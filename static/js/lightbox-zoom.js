/* Shared fullscreen image lightbox with pan + zoom (wheel + pinch + drag).
   Usage: window.openImageLightbox(src, alt) */
(function () {
  if (window.openImageLightbox) return;

  const ZMIN = 1, ZMAX = 6, ZSTEP = 0.2;
  let overlay, stage, img, hint;
  const state = { scale: 1, tx: 0, ty: 0 };
  const pointers = new Map();
  let pinchStartDist = 0, pinchStartScale = 1, pinchCenter = { x: 0, y: 0 };
  let panLast = null;
  let returnFocus, previousOverflow = '', inertElements = [];
  let language = 'en';
  const messages = {
    en: { close:'Close image', plus:'Zoom in', minus:'Zoom out', reset:'Reset zoom', title:'Road image', hint:'Scroll / pinch to zoom · arrow keys to pan · Esc to close' },
    ru: { close:'Закрыть изображение', plus:'Увеличить', minus:'Уменьшить', reset:'Сбросить масштаб', title:'Дорожная сцена', hint:'Колесо / жест — масштаб · стрелки — перемещение · Esc — закрыть' },
  };

  function ensureBuilt() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'lbz-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<div class="lbz-stage">' +
        '<button type="button" class="lbz-close" aria-label="Close">&times;</button>' +
        '<img class="lbz-img" alt="">' +
        '<div class="lbz-controls"><button type="button" data-lbz="minus">−</button><span class="lbz-scale">100%</span><button type="button" data-lbz="plus">+</button><button type="button" data-lbz="reset">↺</button></div>' +
        '<div class="lbz-hint">Scroll / pinch to zoom · drag to pan · double-click to reset</div>' +
      '</div>';
    document.body.appendChild(overlay);
    stage = overlay.querySelector('.lbz-stage');
    img = overlay.querySelector('.lbz-img');
    hint = overlay.querySelector('.lbz-hint');
    overlay.querySelector('.lbz-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('[data-lbz="plus"]').addEventListener('click', () => zoomAt(state.scale * 1.25, innerWidth / 2, innerHeight / 2));
    overlay.querySelector('[data-lbz="minus"]').addEventListener('click', () => zoomAt(state.scale / 1.25, innerWidth / 2, innerHeight / 2));
    overlay.querySelector('[data-lbz="reset"]').addEventListener('click', reset);
    document.addEventListener('keydown', (e) => {
      if (!overlay.classList.contains('is-open')) return;
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (['+', '=', '-', '0'].includes(e.key)) {
        e.preventDefault();
        if (e.key === '0') reset();
        else zoomAt(e.key === '-' ? state.scale / 1.25 : state.scale * 1.25, innerWidth / 2, innerHeight / 2);
      } else if (e.key.startsWith('Arrow') && state.scale > 1) {
        e.preventDefault();
        if (e.key === 'ArrowLeft') state.tx += 48;
        if (e.key === 'ArrowRight') state.tx -= 48;
        if (e.key === 'ArrowUp') state.ty += 48;
        if (e.key === 'ArrowDown') state.ty -= 48;
        clamp(); apply();
      } else if (e.key === 'Tab') {
        const buttons = [...overlay.querySelectorAll('button:not(:disabled)')];
        const index = buttons.indexOf(document.activeElement);
        if (e.shiftKey && index <= 0) { e.preventDefault(); buttons.at(-1).focus(); }
        else if (!e.shiftKey && (index < 0 || index === buttons.length - 1)) { e.preventDefault(); buttons[0].focus(); }
      }
    }, true);
    bindGestures();
  }

  function apply() {
    img.style.transform = `translate(calc(-50% + ${state.tx}px), calc(-50% + ${state.ty}px)) scale(${state.scale})`;
    stage.classList.toggle('is-zoomed', state.scale > 1.001);
    overlay.querySelector('.lbz-scale').textContent = Math.round(state.scale * 100) + '%';
    overlay.querySelector('[data-lbz="minus"]').disabled = state.scale <= ZMIN;
    overlay.querySelector('[data-lbz="plus"]').disabled = state.scale >= ZMAX;
  }

  function reset() {
    state.scale = 1; state.tx = 0; state.ty = 0;
    pointers.clear(); pinchStartDist = 0; panLast = null;
    stage && stage.classList.remove('is-panning', 'is-gesturing');
    apply();
  }

  function clamp() {
    if (state.scale <= 1.001) { state.tx = 0; state.ty = 0; return; }
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const halfX = Math.max(0, (img.clientWidth * state.scale - sw) / 2);
    const halfY = Math.max(0, (img.clientHeight * state.scale - sh) / 2);
    state.tx = Math.max(-halfX, Math.min(halfX, state.tx));
    state.ty = Math.max(-halfY, Math.min(halfY, state.ty));
  }

  function zoomAt(target, cx, cy) {
    const next = Math.min(ZMAX, Math.max(ZMIN, target));
    const r = stage.getBoundingClientRect();
    const ox = cx - r.left - r.width / 2;
    const oy = cy - r.top - r.height / 2;
    const k = next / state.scale;
    state.tx = ox - k * (ox - state.tx);
    state.ty = oy - k * (oy - state.ty);
    state.scale = next;
    clamp();
    apply();
  }

  function bindGestures() {
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      zoomAt(state.scale * (1 + dir * ZSTEP), e.clientX, e.clientY);
    }, { passive: false });

    stage.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      stage.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      stage.classList.add('is-gesturing');
      if (pointers.size === 2) {
        const [a, b] = Array.from(pointers.values());
        pinchStartDist = Math.hypot(b.x - a.x, b.y - a.y);
        pinchStartScale = state.scale;
        pinchCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      } else if (pointers.size === 1) {
        panLast = { x: e.clientX, y: e.clientY };
        if (state.scale > 1.001) stage.classList.add('is-panning');
      }
    });

    stage.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinchStartDist > 0) {
        const [a, b] = Array.from(pointers.values());
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        zoomAt(pinchStartScale * (dist / pinchStartDist), pinchCenter.x, pinchCenter.y);
      } else if (pointers.size === 1 && panLast && state.scale > 1.001) {
        state.tx += e.clientX - panLast.x;
        state.ty += e.clientY - panLast.y;
        panLast = { x: e.clientX, y: e.clientY };
        clamp(); apply();
      }
    });

    function endPointer(e) {
      if (pointers.has(e.pointerId)) {
        pointers.delete(e.pointerId);
        try { stage.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      if (pointers.size < 2) pinchStartDist = 0;
      if (pointers.size === 0) {
        panLast = null;
        stage.classList.remove('is-panning', 'is-gesturing');
      }
    }
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);
    stage.addEventListener('pointerleave', endPointer);

    stage.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (state.scale > 1.001) reset();
      else zoomAt(2.5, e.clientX, e.clientY);
    });
  }

  function open(src, alt, options = {}) {
    if (!src) return;
    ensureBuilt();
    language = (options.lang || document.documentElement.lang) === 'ru' ? 'ru' : 'en';
    const text = messages[language];
    overlay.setAttribute('aria-label', text.title);
    overlay.querySelector('.lbz-close').setAttribute('aria-label', text.close);
    ['plus', 'minus', 'reset'].forEach(action => overlay.querySelector(`[data-lbz="${action}"]`).setAttribute('aria-label', text[action]));
    hint.textContent = text.hint;
    if (!overlay.classList.contains('is-open')) {
      returnFocus = document.activeElement;
      previousOverflow = document.body.style.overflow;
      inertElements = [...document.body.children].filter(element => element !== overlay && !element.inert);
      inertElements.forEach(element => { element.inert = true; });
    }
    img.src = src;
    img.alt = alt || '';
    reset();
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    overlay.querySelector('.lbz-close').focus();
  }

  function close() {
    if (!overlay || !overlay.classList.contains('is-open')) return;
    overlay.classList.remove('is-open');
    document.body.style.overflow = previousOverflow;
    inertElements.forEach(element => { element.inert = false; });
    inertElements = [];
    reset();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }

  window.openImageLightbox = open;
  window.closeImageLightbox = close;
})();
