import './styles.css';

import {
  STATE,
  initState,
  applyDraftToActive,
  loadConfig,
  applyThemeAndScale,
  getConfig,
} from '@/state';
import { applyUI } from '@/state/uiConfig';
import { seedDefaults } from '@/seedDefaults';
import { fetchWeather, renderWidgets } from '@/ui/widgets';
import { hhmmNowLocal, deriveShift } from '@/utils/time';
import { renderHeader } from '@/ui/header';
import { renderTabs, activeTab } from '@/ui/tabs';
import { renderMain } from '@/ui/mainTab';
import { renderSettingsTab } from '@/ui/settingsTab';
import { renderDraftTab } from '@/ui/draftTab';
import { renderHistoryTab } from '@/ui/historyTab';
import { outlineBlockers } from '@/utils/debug';

export async function renderAll() {
  applyThemeAndScale();
  await renderHeader();
  await renderTabs();
  const root = document.getElementById('panel')!;
  const { dateISO, shift } = STATE;
  switch (activeTab()) {
    case 'Main':
      await renderMain(root, { dateISO, shift });
      break;
    case 'Draft':
      renderDraftTab(root);
      break;
    case 'History':
      renderHistoryTab(root);
      break;
    case 'Settings':
      await renderSettingsTab(root);
      break;
    // other tabs can be added here
  }
  if (import.meta.env.DEV) outlineBlockers();
}

export async function manualHandoff() {
  initState();
  await applyDraftToActive(STATE.dateISO, STATE.shift);
  renderAll();
}

initState();
loadConfig().then(async () => {
  await seedDefaults();
  applyThemeAndScale();
  applyUI();
  renderAll();

  const clockTimer = setInterval(async () => {
    const hhmm = hhmmNowLocal();
    const shift = deriveShift(hhmm);
    if (shift !== STATE.shift) {
      initState();
      await applyDraftToActive(STATE.dateISO, STATE.shift);
      renderAll();
    } else if (STATE.clockHHMM !== hhmm) {
      STATE.clockHHMM = hhmm;
      document.querySelectorAll('.clock-big').forEach((el) => {
        (el as HTMLElement).textContent = hhmm;
      });
    }
  }, 1000);

  const weatherTimer = setInterval(async () => {
    const body = document.getElementById('widgets-body');
    const cfg = getConfig();
    if (body && cfg.widgets.weather.mode === 'openweather' && cfg.widgets.weather.apiKey) {
      await fetchWeather();
      await renderWidgets(body);
    }
  }, 10 * 60 * 1000);

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      clearInterval(clockTimer);
      clearInterval(weatherTimer);
    });
  }
});
