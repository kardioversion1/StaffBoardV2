import { renderAll } from '@/main';
import { t } from '@/i18n/en';

interface Tab {
  id: string;
  label: () => string;
}

const TABS: Tab[] = [
  { id: 'Board', label: () => 'Board' },
  { id: 'NextShift', label: () => t('nav.nextShift') },
  { id: 'Settings', label: () => 'Settings' },
  { id: 'History', label: () => t('nav.history') },
];

let active = 'Board';

export function activeTab(): string {
  return active;
}

export function initTabs(): void {
  const hash = location.hash.replace('#', '');
  if (TABS.some((t) => t.id === hash)) {
    active = hash;
  }
  history.replaceState({ tab: active }, '', `#${active}`);
  window.addEventListener('popstate', (e) => {
    const tab = (e.state && e.state.tab) || location.hash.replace('#', '');
    if (TABS.some((t) => t.id === tab)) {
      active = tab;
      renderTabs();
      renderAll();
    }
  });
}

function setActive(id: string): void {
  if (active === id) return;
  active = id;
  history.pushState({ tab: id }, '', `#${id}`);
  renderTabs();
  renderAll();
}

export function renderTabs(): void {
  let nav = document.getElementById('tabs');
  if (!nav) {
    nav = document.createElement('nav');
    nav.id = 'tabs';
    document.body.insertBefore(nav, document.getElementById('panel'));
  }
  nav.setAttribute('role', 'tablist');
  nav.innerHTML = TABS.map((t) => `<button role="tab" data-tab="${t.id}">${t.label()}</button>`).join('');
  nav.onkeydown = (e) => {
    if (!(e.target instanceof HTMLButtonElement)) return;
    let idx = TABS.findIndex((t) => t.id === e.target.dataset.tab);
    if (e.key === 'ArrowRight') idx = (idx + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') idx = (idx - 1 + TABS.length) % TABS.length;
    else return;
    const next = TABS[idx].id;
    setActive(next);
    (nav!.querySelector(`button[data-tab="${next}"]`) as HTMLButtonElement)?.focus();
    e.preventDefault();
  };
  nav.querySelectorAll('button').forEach((btn) => {
    const id = btn.getAttribute('data-tab') || 'Board';
    btn.classList.toggle('active', id === active);
    btn.setAttribute('aria-selected', id === active ? 'true' : 'false');
    btn.tabIndex = id === active ? 0 : -1;
    btn.onclick = () => setActive(id);
  });
  let panel = document.getElementById('panel');
  if (!panel) {
    panel = document.createElement('main');
    panel.id = 'panel';
    document.body.appendChild(panel);
  }
}
