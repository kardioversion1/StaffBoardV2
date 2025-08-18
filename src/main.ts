import './styles.css';

import { STATE, initState } from '@/state';
import { hhmmNowLocal, deriveShift } from '@/utils/time';
import { renderHeader } from '@/ui/header';
import { renderTabs, activeTab } from '@/ui/tabs';
import { renderMain } from '@/ui/mainTab';
import { renderSettingsTab } from '@/ui/settingsTab';
import { renderPendingTab } from '@/ui/pendingTab';
import { renderHistoryTab } from '@/ui/historyTab';
import { outlineBlockers } from '@/utils/debug';

export async function renderAll() {
  await renderHeader();
  await renderTabs();
  const root = document.getElementById('panel')!;
  const { dateISO, shift } = STATE;
  switch (activeTab()) {
    case 'Main':
      await renderMain(root, { dateISO, shift });
      break;
    case 'Pending':
      renderPendingTab(root);
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

initState();
renderAll();
setInterval(() => {
  STATE.clockHHMM = hhmmNowLocal();
  STATE.shift = deriveShift(STATE.clockHHMM);
  renderAll();
}, 1000);
