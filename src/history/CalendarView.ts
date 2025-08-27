import type { PublishedShiftSnapshot } from '@/state/history';
import './history.css';

/** Render the calendar-based history view. */
export function renderCalendarView(root: HTMLElement): void {
  root.innerHTML = '<div class="history-calendar"><p class="muted">Calendar view coming soon.</p></div>';
}

