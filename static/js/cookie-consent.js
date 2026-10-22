(function () {
  const KEY = 'wex-cookie-consent';
  let selected = '';
  try { selected = localStorage.getItem(KEY) || ''; } catch (_) {}
  if (!['essential', 'analytics'].includes(selected)) selected = '';
  const banner = document.getElementById('cookieConsentBanner');
  if (!banner) return;
  let returnFocus = null;
  function open(trigger) {
    const fromNavigation = window.WEXNavigation?.isOpen();
    if (fromNavigation) window.sbClose();
    returnFocus = fromNavigation ? document.querySelector('.burger-btn') : trigger || document.activeElement;
    banner.classList.add('show');
    banner.setAttribute('aria-hidden', 'false');
    const button = document.getElementById(selected === 'analytics' ? 'cookieAcceptBtn' : 'cookieEssentialBtn');
    button?.focus({preventScroll:true});
  }
  function close() {
    banner.classList.remove('show');
    banner.setAttribute('aria-hidden', 'true');
    if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
    returnFocus = null;
  }
  function choose(choice) {
    selected = choice;
    try { localStorage.setItem(KEY, choice); } catch (_) {}
    close();
    document.dispatchEvent(new CustomEvent('wex:cookie-consent', {detail:{choice}}));
    if (choice === 'analytics') window.sendActivityPing?.('consent');
  }
  window.WEXCookieConsent = {choice:()=>selected, open};
  document.querySelectorAll('[data-cookie-settings]').forEach(button => button.addEventListener('click', () => open(button)));
  document.getElementById('cookieEssentialBtn')?.addEventListener('click', () => choose('essential'));
  document.getElementById('cookieAcceptBtn')?.addEventListener('click', () => choose('analytics'));
  banner.addEventListener('keydown', event => {if(event.key === 'Escape' && selected) close();});
  window.addEventListener('storage', event => {
    if(event.key !== KEY && event.key !== null) return;
    const value = event.key === null ? '' : event.newValue;
    selected = ['essential','analytics'].includes(value) ? value : '';
    if (!selected) open(); else close();
  });
  if (!selected) { banner.classList.add('show'); banner.setAttribute('aria-hidden','false'); }
})();
