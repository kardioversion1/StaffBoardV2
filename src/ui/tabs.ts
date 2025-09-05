import { renderAll } from '@/main';
import { t } from '@/i18n/en';
import { flags } from '@/flags';

let active: string = 'Board';

export function activeTab(): string {
  return active;
}

export function renderTabs(): void {
  let nav = document.getElementById('tabs');
  if (!nav) {
    nav = document.createElement('nav');
    nav.id = 'tabs';
    document.body.insertBefore(nav, document.getElementById('panel'));
  }
  nav.innerHTML = `
    <button data-tab="Board">Board</button>
    ${flags.enableShiftBuilderV2 ? `<button data-tab="Builder">${t('nav.builder')}</button>` : ''}
    <button data-tab="Settings">Settings</button>
    <button data-tab="History">${t('nav.history')}</button>
  `;
  nav.querySelectorAll('button').forEach((btn) => {
    btn.onclick = () => {
      active = btn.getAttribute('data-tab') || 'Board';
      renderAll();
    };
  });
  let panel = document.getElementById('panel');
  if (!panel) {
    panel = document.createElement('main');
    panel.id = 'panel';
    document.body.appendChild(panel);
  }
}
