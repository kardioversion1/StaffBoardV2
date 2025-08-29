import { renderCalendarView } from './CalendarView';
import { renderNurseHistory } from './NurseHistory';
import { renderHuddleTable } from './HuddleTable';
import './history.css';
import type {
  PublishedShiftSnapshot,
  NurseShiftIndexEntry,
  HuddleRecord,
} from '@/state/history';
import * as Server from '@/server';

/**
 * Render History tab with sub-views.
 * @param root element to populate
 * @returns nothing
 */
export function renderHistory(root: HTMLElement): void {
  root.innerHTML = `
    <div class="history-nav">
      <button data-view="calendar">By Date</button>
      <button data-view="nurse">By Nurse</button>
      <button data-view="huddles">Huddles</button>
    </div>
    <div class="history-actions"><button id="history-export" class="btn">Export CSV</button></div>
    <div id="history-view"></div>
  `;
  const viewRoot = root.querySelector('#history-view') as HTMLElement;
  function show(view: string) {
    if (view === 'nurse') renderNurseHistory(viewRoot);
    else if (view === 'huddles') renderHuddleTable(viewRoot);
    else renderCalendarView(viewRoot);
  }
  root.querySelectorAll('.history-nav button').forEach((btn) => {
    const el = btn as HTMLButtonElement;
    el.addEventListener('click', () => show(el.dataset.view!));
  });
  root.querySelector('#history-export')?.addEventListener('click', () => {
    Server.exportHistoryCSV();
  });
  show('calendar');
}

/**
 * Export a single shift snapshot to CSV.
 * @param snapshot shift snapshot to serialize
 * @returns CSV string
 */
export function exportShiftCSV(snapshot: PublishedShiftSnapshot): string {
  const header = 'date,shift,zone,staffId,displayName,role,startISO,endISO,dto';
  const rows = snapshot.zoneAssignments
    .map((a) =>
      [
        snapshot.dateISO,
        snapshot.shift,
        a.zone,
        a.staffId,
        a.displayName,
        a.role,
        a.startISO,
        a.endISO,
        a.dto ? '1' : '0',
      ].join(',')
    )
    .join('\n');
  return `${header}\n${rows}`;
}

/**
 * Export nurse history entries to CSV.
 * @param entries list of nurse history rows
 * @returns CSV string
 */
export function exportNurseHistoryCSV(entries: NurseShiftIndexEntry[]): string {
  const header = 'staffId,displayName,role,date,shift,zone,startISO,endISO,dto';
  const rows = entries
    .map((e) =>
      [
        e.staffId,
        e.displayName,
        e.role,
        e.dateISO,
        e.shift,
        e.zone,
        e.startISO,
        e.endISO,
        e.dto ? '1' : '0',
      ].join(',')
    )
    .join('\n');
  return `${header}\n${rows}`;
}

/**
 * Export huddle records to CSV.
 * @param records saved huddle records
 * @returns CSV string
 */
export function exportHuddlesCSV(records: HuddleRecord[]): string {
  const header = 'date,shift,recordedAt,recordedBy,notes';
  const rows = records
    .map((r) =>
      [
        r.dateISO,
        r.shift,
        r.recordedAtISO,
        r.recordedBy,
        `"${r.notes.replace(/"/g, '""')}"`,
      ].join(',')
    )
    .join('\n');
  return `${header}\n${rows}`;
}

