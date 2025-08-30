import { listHuddles, type HuddleRecord } from '@/state/history';
import { exportHuddlesCSV } from '@/history';
import './history.css';

/**
 * Render table of saved huddle records.
 * @param root element to populate
 * @returns nothing
 */
export function renderHuddleTable(root: HTMLElement): void {
  root.innerHTML = `
    <div class="history-huddles">
      <div class="form-row">
        <button id="huddle-export" class="btn">Export CSV</button>
      </div>
      <table class="history-table">
        <thead><tr><th>Date</th><th>Shift</th><th>By</th><th>Checklist</th><th>Notes</th></tr></thead>
        <tbody id="huddle-body"></tbody>
      </table>
    </div>
  `;

  const body = root.querySelector('#huddle-body') as HTMLElement;
  let records: HuddleRecord[] = [];

  (async () => {
    records = await listHuddles();
    body.innerHTML = records
      .map((r) => {
        const items = r.checklist
          .map(
            (i) =>
              `${i.label}: ${i.state}${i.note ? ` (${i.note})` : ''}`
          )
          .join('<br>');
        return `<tr><td>${r.dateISO}</td><td>${r.shift}</td><td>${r.recordedBy}</td><td>${items}</td><td>${r.notes}</td></tr>`;
      })
      .join('');
  })();

  document.getElementById('huddle-export')!.addEventListener('click', () => {
    if (records.length === 0) return;
    const csv = exportHuddlesCSV(records);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'huddles.csv';
    a.click();
    URL.revokeObjectURL(url);
  });
}

