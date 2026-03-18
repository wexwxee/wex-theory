(function () {
  try {
    const theme = localStorage.getItem('wex-theme');
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch (e) {
    // Ignore storage access issues and keep the default theme.
  }
})();
