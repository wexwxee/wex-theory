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

  function ensureBuilt() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'lbz-overlay';
    overlay.innerHTML =
      '<div class="lbz-stage">' +
        '<button type="button" class="lbz-close" aria-label="Close">&times;</button>' +
        '<img class="lbz-img" alt="">' +
        '<div class="lbz-hint">Scroll / pinch to zoom · drag to pan · double-click to reset</div>' +
      '</div>';
    document.body.appendChild(overlay);
    stage = overlay.querySelector('.lbz-stage');
    img = overlay.querySelector('.lbz-img');
    hint = overlay.querySelector('.lbz-hint');
    overlay.querySelector('.lbz-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target === stage) close(); });
    document.addEventListener('keydown', (e) => {
      if (!overlay.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
    });
    bindGestures();
  }

  function apply() {
    img.style.transform = `translate(calc(-50% + ${state.tx}px), calc(-50% + ${state.ty}px)) scale(${state.scale})`;
    stage.classList.toggle('is-zoomed', state.scale > 1.001);
  }

  function reset() {
    state.scale = 1; state.tx = 0; state.ty = 0;
    pointers.clear(); pinchStartDist = 0; panLast = null;
    stage && stage.classList.remove('is-panning', 'is-gesturing');
    apply();
  }

  function clamp() {
    if (state.scale <= 1.001) { state.tx = 0; state.ty = 0; return; }
    const r = img.getBoundingClientRect();
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const halfX = Math.max(0, (r.width - sw) / 2);
    const halfY = Math.max(0, (r.height - sh) / 2);
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

  function open(src, alt) {
    if (!src) return;
    ensureBuilt();
    img.src = src;
    img.alt = alt || '';
    reset();
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    reset();
  }

  window.openImageLightbox = open;
  window.closeImageLightbox = close;
})();
