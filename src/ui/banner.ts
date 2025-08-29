/** Display a non-blocking banner message at top of the page. */
let bannerTimer: number | undefined;

export function showBanner(msg: string): void {
  let el = document.getElementById('app-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-banner';
    el.className = 'banner';
    document.body.prepend(el);
  }
  el.textContent = msg;
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => {
    el?.remove();
  }, 10_000);
}
