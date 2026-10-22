(() => {
  'use strict';

  // Runs in <head> on the home page only. When motion is welcome, blocks start hidden and
  // home-wall.js assembles them in cells as they come into view. If that script never
  // reports in, everything is shown again so a failed load cannot hide the page.
  const root = document.documentElement;
  const css = window.CSS && CSS.supports;
  const masks = css && (CSS.supports('mask-image', 'url("x.svg")') || CSS.supports('-webkit-mask-image', 'url("x.svg")'));
  if (!masks || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.classList.add('hw-anim');
  window.setTimeout(() => {
    if (!root.classList.contains('hw-anim-ready')) root.classList.remove('hw-anim');
  }, 3000);
})();
