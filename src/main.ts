import './styles.css';

import {
  STATE,
  initState,
  applyDraftToActive,
  loadConfig,
  getConfig,
  zonesInvalid,
  DB,
  KS,
} from '@/state';
import { applyTheme } from '@/state/theme';
import { applyUI } from '@/state/uiConfig';
import { seedDefaults } from '@/seedDefaults';
import { seedDemoHistory } from '@/history/seed';
import { fetchWeather, renderWeather } from '@/ui/widgets';
import { hhmmNowLocal, deriveShift } from '@/utils/time';
import { renderHeader } from '@/ui/header';
import { renderTabs, activeTab } from '@/ui/tabs';
import { renderBoard } from '@/ui/board';
import { renderSettings } from '@/ui/settings';
import { renderBuilder } from '@/ui/builder';
import { renderHistoryTab } from '@/ui/historyTab';
import { outlineBlockers } from '@/utils/debug';
import { showBanner } from '@/ui/banner';
import * as Server from '@/server';

export async function renderAll() {
  applyTheme();
  await renderHeader();
  await renderTabs();
  const root = document.getElementById('panel')!;
  const { dateISO, shift } = STATE;
  switch (activeTab()) {
    case 'Board':
      await renderBoard(root, { dateISO, shift });
      break;
    case 'Builder':
      await renderBuilder(root);
      break;
    case 'History':
      renderHistoryTab(root);
      break;
    case 'Settings':
      await renderSettings(root);
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
(async () => {
  const { dateISO, shift } = STATE;
  try {
    const roster = await Server.load('roster');
    await DB.set(KS.STAFF, roster);
  } catch {}
  try {
    const active = await Server.load('active', { date: dateISO, shift });
    if (active) await DB.set(KS.ACTIVE(dateISO, shift), active);
  } catch {}
  loadConfig().then(async () => {
    await seedDefaults();
    await seedDemoHistory();
    if (zonesInvalid()) {
      showBanner('Zone data invalid, using defaults');
    }
    applyTheme();
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
    const body = document.getElementById('weather-body');
    const cfg = getConfig();
    if (body && cfg.widgets.weather.mode === 'openweather' && cfg.widgets.weather.apiKey) {
      await fetchWeather();
      await renderWeather(body);
    }
  }, 10 * 60 * 1000);

  const activeTimer = setInterval(async () => {
    const { dateISO, shift } = STATE;
    try {
      const remote = await Server.load('active', { date: dateISO, shift });
      const local = await DB.get(KS.ACTIVE(dateISO, shift));
      if (remote && JSON.stringify(remote) !== JSON.stringify(local)) {
        await DB.set(KS.ACTIVE(dateISO, shift), remote);
        renderAll();
      }
    } catch {}
  }, 60 * 1000);

    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        clearInterval(clockTimer);
        clearInterval(weatherTimer);
        clearInterval(activeTimer);
      });
    }
  });
})();
