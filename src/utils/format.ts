/**
 * Format date to MM/DD/YYYY string.
 * @param d date input
 * @returns formatted date
 */
export function formatDateUS(d: Date | string | number) {
  const dt = new Date(d);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/**
 * Format time in 24h HH:MM for Louisville zone.
 * @param d date input
 * @returns formatted time
 */
export function formatTime24h(d: Date | string | number) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Kentucky/Louisville',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));
}

/**
 * Format duration between two ISO timestamps as H:MM.
 * @param startISO start ISO timestamp
 * @param endISO end ISO timestamp
 * @returns formatted duration or empty string if invalid
 */
export function formatDuration(startISO: string, endISO: string): string {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  if (!isFinite(start) || !isFinite(end) || end <= start) return '';
  const minutes = Math.round((end - start) / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${String(mins).padStart(2, '0')}`;
}
