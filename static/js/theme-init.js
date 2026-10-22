(function () {
  try {
    // Dark is the default; a visitor's own choice is kept. The key changed in October 2026, so a
    // light theme saved before the redesign does not carry over.
    const theme = localStorage.getItem('wex-theme-v2');
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
  } catch (e) {
    // Ignore storage access issues and keep the default theme.
  }
})();
