import { loadStaff } from '@/state';
import { findShiftsByStaff } from '@/state/history';
import { exportNurseHistoryCSV } from '@/history';
import './history.css';

/**
 * Render the nurse-centric history search view.
 * @param root element to populate
 * @returns nothing
 */
export function renderNurseHistory(root: HTMLElement): void {
  root.innerHTML = `
    <div class="history-nurse">
      <div class="form-row">
        <select id="hist-nurse"></select>
        <button id="hist-nurse-load" class="btn">Load</button>
        <button id="hist-nurse-export" class="btn">Export CSV</button>
      </div>
      <table class="history-table">
        <thead><tr><th>Date</th><th>Shift</th><th>Zone</th><th>Prev Zone</th></tr></thead>
        <tbody id="hist-nurse-body"><tr><td colspan="4">Select a nurse</td></tr></tbody>
      </table>
    </div>
  `;

  const sel = root.querySelector('#hist-nurse') as HTMLSelectElement;
  const body = root.querySelector('#hist-nurse-body') as HTMLElement;
  let current: any[] = [];

  (async () => {
    const staff = await loadStaff();
    sel.innerHTML = staff
      .map((s) => {
        const label = s.name || `${s.first || ''} ${s.last || ''}`.trim() || s.id;
        return `<option value="${s.id}">${label}</option>`;
      })
      .join('');
  })();

  document.getElementById('hist-nurse-load')!.addEventListener('click', async () => {
    const id = sel.value;
    current = await findShiftsByStaff(id);
    body.innerHTML = current.length
      ? current
          .map(
            (r) =>
              `<tr><td>${r.dateISO}</td><td>${r.shift}</td><td>${r.zone}</td><td>${r.previousZone ?? ''}</td></tr>`
          )
          .join('')
      : '<tr><td colspan="4">No history found</td></tr>';
  });

  document
    .getElementById('hist-nurse-export')!
    .addEventListener('click', () => {
      if (current.length === 0) return;
      const csv = exportNurseHistoryCSV(current);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nurse-history.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
}

