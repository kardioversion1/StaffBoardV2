import './styles.css';

import { STATE, initState, applyDraftToActive, loadConfig, applyThemeAndScale } from '@/state';
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
      renderSettingsTab(root);
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
loadConfig().then(() => {
  applyThemeAndScale();
  renderAll();
  setInterval(async () => {
    const hhmm = hhmmNowLocal();
    const shift = deriveShift(hhmm);
    if (shift !== STATE.shift) {
      initState();
      await applyDraftToActive(STATE.dateISO, STATE.shift);
    } else {
      STATE.clockHHMM = hhmm;
    }
    renderAll();
  }, 1000);
});
