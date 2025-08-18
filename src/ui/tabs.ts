import { renderAll } from '@/main';
import { t } from '@/i18n/en';

let active: string = 'Main';

export function activeTab(): string {
  return active;
}

export function renderTabs(): void {
  const app = document.getElementById('app')!;
  let nav = document.getElementById('tabs');
  if (!nav) {
    nav = document.createElement('nav');
    nav.id = 'tabs';
    app.appendChild(nav);
  }
  nav.innerHTML = `
    <button data-tab="Main">Main</button>
    <button data-tab="Draft">${t('nav.draft')}</button>
    <button data-tab="Settings">Settings</button>
    <button data-tab="History">${t('nav.history')}</button>
  `;
  nav.querySelectorAll('button').forEach((btn) => {
    btn.onclick = () => {
      active = btn.getAttribute('data-tab') || 'Main';
      renderAll();
    };
  });
  let panel = document.getElementById('panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'panel';
    app.appendChild(panel);
  }
}
