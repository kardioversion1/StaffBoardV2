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

let toastTimer: number | undefined;

export function showToast(msg: string): void {
  let el = document.getElementById('app-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el?.remove();
  }, 4_000);
}
