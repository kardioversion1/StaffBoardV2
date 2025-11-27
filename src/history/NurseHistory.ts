import { rosterStore, type Staff } from '@/state/staff';
import { findShiftsByStaff } from '@/history';
import { exportNurseHistoryCSV } from '@/history/ui';
import { formatTime24h, formatDuration } from '@/utils/format';
import './history.css';

/**
 * Render staff history search with two-column picker.
 * @param root element to populate
 * @returns nothing
 */
export function renderNurseHistory(root: HTMLElement): void {
  root.innerHTML = `
    <div class="history-nurse">
      <div class="form-row">
        <input id="hist-staff-search" class="input" placeholder="Search staff">
      </div>
      <div class="assign-cols">
        <div id="hist-nurse-list" class="assign-col"></div>
        <div id="hist-tech-list" class="assign-col"></div>
      </div>
      <div id="hist-staff-details" class="history-box"></div>
      <div class="form-row">
        <button id="hist-staff-export" class="btn" disabled>Export CSV</button>
      </div>
    </div>
  `;

  const nurseCol = root.querySelector('#hist-nurse-list') as HTMLElement;
  const techCol = root.querySelector('#hist-tech-list') as HTMLElement;
  const searchInput = root.querySelector('#hist-staff-search') as HTMLInputElement;
  const details = root.querySelector('#hist-staff-details') as HTMLElement;
  const exportBtn = root.querySelector('#hist-staff-export') as HTMLButtonElement;

  let staffList: Staff[] = [];
  let current: any[] = [];
  let selected: string | null = null;

  (async () => {
    await rosterStore.load();
    staffList = rosterStore.all();
    render();
  })();

  function render(filter = '') {
    const norm = filter.toLowerCase();
    const nurses = staffList.filter(
      (s) =>
        s.role === 'nurse' &&
        (!filter || (s.name || `${s.first ?? ''} ${s.last ?? ''}`.trim() || s.id).toLowerCase().includes(norm))
    );
    const techs = staffList.filter(
      (s) =>
        s.role === 'tech' &&
        (!filter || (s.name || `${s.first ?? ''} ${s.last ?? ''}`.trim() || s.id).toLowerCase().includes(norm))
    );
    nurseCol.innerHTML = nurses
      .map(
        (s) =>
          `<div class="assign-item${selected === s.id ? ' selected' : ''}" data-id="${s.id}">${s.name || s.id}</div>`
      )
      .join('');
    techCol.innerHTML = techs
      .map(
        (s) =>
          `<div class="assign-item${selected === s.id ? ' selected' : ''}" data-id="${s.id}">${s.name || s.id}</div>`
      )
      .join('');
    root.querySelectorAll('.assign-item').forEach((el) => {
      const id = (el as HTMLElement).dataset.id!;
      el.addEventListener('click', () => select(id));
    });
  }

  async function select(id: string) {
    selected = id;
    root.querySelectorAll('.assign-item').forEach((el) => {
      el.classList.toggle('selected', (el as HTMLElement).dataset.id === id);
    });
    current = await findShiftsByStaff(id);
    exportBtn.disabled = current.length === 0;
    details.innerHTML = current.length
      ? `<table class="history-table"><thead><tr><th>Date</th><th>Shift</th><th>Zone</th><th>Prev Zone</th><th>Start</th><th>End</th><th>Total</th></tr></thead><tbody>${current
          .map((r) => {
            const start = formatTime24h(r.startISO);
            const end = r.endISO ? formatTime24h(r.endISO) : '';
            const total = r.endISO ? formatDuration(r.startISO, r.endISO) : '';
            return `<tr><td>${r.dateISO}</td><td>${r.shift}</td><td>${r.zone}</td><td>${r.previousZone ?? ''}</td><td>${start}</td><td>${end}</td><td>${total}</td></tr>`;
          })
          .join('')}</tbody></table>`
      : '<div class="muted">No history found</div>';
  }

  searchInput.addEventListener('input', () => render(searchInput.value));

  exportBtn.addEventListener('click', () => {
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


