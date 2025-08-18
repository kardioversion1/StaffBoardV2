import './styles.css';

import { STATE, initState } from '@/state';
import { hhmmNowLocal, deriveShift } from '@/utils/time';
import { renderHeader } from '@/ui/header';
import { renderTabs, activeTab } from '@/ui/tabs';
import { renderMain } from '@/ui/mainTab';

export async function renderAll() {
  await renderHeader();
  await renderTabs();
  const root = document.getElementById('panel')!;
  const { dateISO, shift } = STATE;
  switch (activeTab()) {
    case 'Main':
      await renderMain(root, { dateISO, shift });
      break;
    // other tabs can be added here
  }
}

initState();
renderAll();
setInterval(() => {
  STATE.clockHHMM = hhmmNowLocal();
  STATE.shift = deriveShift(STATE.clockHHMM);
  renderAll();
}, 1000);
