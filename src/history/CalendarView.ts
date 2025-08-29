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

  const loadDates = async () => {
    try {
      const res = await (window as any).STAFF_API.listHistoryDates();
      listEl.innerHTML = res.dates
        .map((d: string) => `<li><button data-date="${d}">${d}</button></li>`)
        .join('');
    } catch {
      listEl.innerHTML = '';
    }
  };

  const loadHistory = async (date: string) => {
    const data = await (window as any).STAFF_API.getHistory(date);
    outEl.textContent = JSON.stringify(data, null, 2);
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
    const day = await (window as any).STAFF_API.getActive(d, 'day').catch(() => null);
    const night = await (window as any).STAFF_API.getActive(d, 'night').catch(() => null);
    const entries: any[] = [];
    if (day) entries.push({ shift: 'day', ...day });
    if (night) entries.push({ shift: 'night', ...night });
    await (window as any).STAFF_API.saveHistory({ dateISO: d, entries });
    alert('History saved');
    loadDates();
  });

  document.getElementById('hist-export')!.addEventListener('click', () => {
    const d = (document.getElementById('hist-date') as HTMLInputElement).value;
    if (d) window.location.href = (window as any).STAFF_API.historyExportUrlForDate(d);
  });

  document.getElementById('hist-export-range')!.addEventListener('click', () => {
    const s = (document.getElementById('hist-start') as HTMLInputElement).value;
    const e = (document.getElementById('hist-end') as HTMLInputElement).value;
    if (s && e) window.location.href = (window as any).STAFF_API.historyExportUrlForRange(s, e);
  });

  loadDates();
}
