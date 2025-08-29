import { listShiftDates, getShiftByDate, savePublishedShift, indexStaffAssignments } from '@/state/history';
import { exportShiftCSV } from '@/history';
import { DB, KS } from '@/state';
import './history.css';

/** Render the calendar-based history view with listing, saving, and export. */
export function renderCalendarView(root: HTMLElement): void {
  root.innerHTML = `
    <div class="history-calendar">
      <div class="form-row">
        <input id="hist-date" type="date">
        <button id="hist-load" class="btn">Load history</button>
        <button id="hist-save" class="btn">Save snapshot</button>
        <button id="hist-export" class="btn">Export CSV</button>
      </div>
      <div class="form-row">
        <input id="hist-start" type="date">
        <input id="hist-end" type="date">
        <button id="hist-export-range" class="btn">Export Range</button>
      </div>
      <ul id="hist-dates" class="history-list"></ul>
      <pre id="hist-output" class="history-output"></pre>
    </div>
  `;

  const listEl = root.querySelector('#hist-dates') as HTMLElement;
  const outEl = root.querySelector('#hist-output') as HTMLElement;
  let loaded: { day?: any; night?: any } = {};

  const loadDates = async () => {
    const dates = await listShiftDates();
    listEl.innerHTML = dates
      .map((d) => `<li><button data-date="${d}">${d}</button></li>`)
      .join('');
  };

  const loadHistory = async (date: string) => {
    loaded.day = await getShiftByDate(date, 'day');
    loaded.night = await getShiftByDate(date, 'night');
    outEl.textContent = JSON.stringify(
      { dateISO: date, entries: [loaded.day, loaded.night].filter(Boolean) },
      null,
      2
    );
  };

  listEl.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest('button');
    if (!btn) return;
    const d = btn.getAttribute('data-date')!;
    (document.getElementById('hist-date') as HTMLInputElement).value = d;
    await loadHistory(d);
  });

  document.getElementById('hist-load')!.addEventListener('click', async () => {
    const d = (document.getElementById('hist-date') as HTMLInputElement).value;
    if (d) await loadHistory(d);
  });

  document.getElementById('hist-save')!.addEventListener('click', async () => {
    const d = (document.getElementById('hist-date') as HTMLInputElement).value;
    if (!d) return;
    const day = await DB.get(KS.ACTIVE(d, 'day')).catch(() => null);
    const night = await DB.get(KS.ACTIVE(d, 'night')).catch(() => null);
    if (day && typeof day === 'object' && 'version' in day) {
      await savePublishedShift(day);
      await indexStaffAssignments(day);
    }
    if (night && typeof night === 'object' && 'version' in night) {
      await savePublishedShift(night);
      await indexStaffAssignments(night);
    }
    alert('History saved');
    loadDates();
  });

  document.getElementById('hist-export')!.addEventListener('click', () => {
    const parts: string[] = [];
    if (loaded.day) parts.push(exportShiftCSV(loaded.day));
    if (loaded.night) parts.push(exportShiftCSV(loaded.night));
    if (parts.length === 0) return;
    const blob = new Blob([parts.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shift-history.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('hist-export-range')!.addEventListener('click', async () => {
    const s = (document.getElementById('hist-start') as HTMLInputElement).value;
    const e = (document.getElementById('hist-end') as HTMLInputElement).value;
    if (!s || !e) return;
    const dates = (await listShiftDates()).filter((d) => d >= s && d <= e);
    const parts: string[] = [];
    for (const d of dates) {
      const day = await getShiftByDate(d, 'day');
      const night = await getShiftByDate(d, 'night');
      if (day) parts.push(exportShiftCSV(day));
      if (night) parts.push(exportShiftCSV(night));
    }
    if (parts.length === 0) return;
    const blob = new Blob([parts.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shift-history-range.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  loadDates();
}
