import {
  getShiftByDate,
  savePublishedShift,
  indexStaffAssignments,
  PublishedShiftSnapshot,
} from '@/state/history';
import { exportShiftCSV } from '@/history';
import { DB, KS } from '@/state';
import './history.css';

function isPublishedShiftSnapshot(obj: any): obj is PublishedShiftSnapshot {
  return (
    obj &&
    typeof obj === 'object' &&
    'version' in obj &&
    'dateISO' in obj &&
    'shift' in obj &&
    'publishedAtISO' in obj &&
    'publishedBy' in obj
  );
}

/**
 * Render the calendar-based history view with listing, saving, and export.
 * @param root element to populate
 * @returns nothing
 */
export function renderCalendarView(root: HTMLElement): void {
  root.innerHTML = `
    <div class="history-calendar">
      <div class="form-row">
        <button class="btn" data-quick="today">Today</button>
        <button class="btn" data-quick="yesterday">Yesterday</button>
        <button class="btn" data-quick="week">Past Week</button>
        <input id="hist-date" type="date">
        <button id="hist-load" class="btn">Load</button>
        <button id="hist-save" class="btn">Save snapshot</button>
        <button id="hist-export" class="btn" disabled>Export CSV</button>
      </div>
      <div id="hist-list" class="history-box"></div>
    </div>
  `;

  const listEl = root.querySelector('#hist-list') as HTMLElement;
  const exportBtn = root.querySelector('#hist-export') as HTMLButtonElement;
  let loaded: PublishedShiftSnapshot[] = [];

  function renderTable(snaps: PublishedShiftSnapshot[]): void {
    if (snaps.length === 0) {
      listEl.innerHTML = '<div class="muted">No history found</div>';
      return;
    }
    const rows = snaps
      .flatMap((s) =>
        s.zoneAssignments.map(
          (a) =>
            `<tr><td>${s.dateISO}</td><td>${s.shift}</td><td>${a.displayName}</td><td>${a.role}</td><td>${a.zone}</td></tr>`
        )
      )
      .join('');
    listEl.innerHTML = `
      <table class="history-table">
        <thead><tr><th>Date</th><th>Shift</th><th>Name</th><th>Role</th><th>Zone</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  async function loadSingle(date: string): Promise<void> {
    const day = await getShiftByDate(date, 'day');
    const night = await getShiftByDate(date, 'night');
    loaded = [day, night].filter(Boolean) as PublishedShiftSnapshot[];
    renderTable(loaded);
    exportBtn.disabled = loaded.length === 0;
  }

  document.getElementById('hist-load')!.addEventListener('click', () => {
    const d = (document.getElementById('hist-date') as HTMLInputElement).value;
    if (d) void loadSingle(d);
  });

  document.getElementById('hist-save')!.addEventListener('click', async () => {
    const d = (document.getElementById('hist-date') as HTMLInputElement).value;
    if (!d) return;
    const day = await DB.get(KS.ACTIVE(d, 'day')).catch(() => null);
    const night = await DB.get(KS.ACTIVE(d, 'night')).catch(() => null);
    if (isPublishedShiftSnapshot(day)) {
      await savePublishedShift(day);
      await indexStaffAssignments(day);
    }
    if (isPublishedShiftSnapshot(night)) {
      await savePublishedShift(night);
      await indexStaffAssignments(night);
    }
    alert('History saved');
  });

  exportBtn.addEventListener('click', () => {
    if (loaded.length === 0) return;
    const parts = loaded.map(exportShiftCSV);
    const blob = new Blob([parts.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shift-history.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  root.querySelectorAll('[data-quick]').forEach((btn) => {
    const el = btn as HTMLButtonElement;
    el.addEventListener('click', async () => {
      const mode = el.dataset.quick!;
      const dateInput = document.getElementById('hist-date') as HTMLInputElement;
      if (mode === 'today') {
        const d = new Date().toISOString().slice(0, 10);
        dateInput.value = d;
        await loadSingle(d);
      } else if (mode === 'yesterday') {
        const d = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        dateInput.value = d;
        await loadSingle(d);
      } else if (mode === 'week') {
        const snaps: PublishedShiftSnapshot[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
          const day = await getShiftByDate(d, 'day');
          const night = await getShiftByDate(d, 'night');
          if (day) snaps.push(day);
          if (night) snaps.push(night);
        }
        loaded = snaps;
        renderTable(loaded);
        exportBtn.disabled = loaded.length === 0;
      }
    });
  });
}
