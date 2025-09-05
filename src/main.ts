import './styles.css';
import '@/ui/util.css';

import {
  STATE,
  initState,
  applyDraftToActive,
  loadConfig,
  zonesInvalid,
  DB,
  KS,
} from '@/state';
import { applyTheme } from '@/state/theme';
import { applyUI } from '@/state/uiConfig';
import { seedDefaults } from '@/seedDefaults';
import { seedDemoHistory } from '@/history/seed';
import { hhmmNowLocal, deriveShift } from '@/utils/time';
import { renderHeader } from '@/ui/header';
import { renderTabs, activeTab } from '@/ui/tabs';
import { renderBoard } from '@/ui/board';
import { renderSettings } from '@/ui/settings';
import { renderHistoryTab } from '@/ui/historyTab';
import { renderNextShiftPage } from '@/ui/nextShift/NextShiftPage';
import { outlineBlockers } from '@/utils/debug';
import { showBanner, showToast } from '@/ui/banner';
import * as Server from '@/server';

document.addEventListener('history-saved', () =>
  showToast('assignments saved to history')
);

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
    case 'NextShift':
      await renderNextShiftPage(root);
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
        clearInterval(activeTimer);
      });
    }
  });
})();
