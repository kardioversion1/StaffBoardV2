/** Day or night shift label. */
export type Shift = "day" | "night";

/**
 * Pad number to two digits.
 * @param n number to format
 * @returns zero-padded string
 */
export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Get current time in HH:MM local format.
 * @returns formatted time string
 */
export function hhmmNowLocal(): string {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Determine shift from clock time.
 * @param hhmm time string in HH:MM
 * @param dayAnchor day shift start
 * @param nightAnchor night shift start
 * @returns shift label
 */
export function deriveShift(
  hhmm: string,
  dayAnchor = "07:00",
  nightAnchor = "19:00",
): Shift {
  const t = toMinutes(hhmm);
  const dayStart = toMinutes(dayAnchor);
  const nightStart = toMinutes(nightAnchor);
  if (dayStart <= nightStart) {
    if (t >= dayStart && t < nightStart) return "day";
    return "night";
  } else {
    if (t >= dayStart || t < nightStart) return "day";
    return "night";
  }
}

/**
 * Compute next shift given a date and current shift.
 * @param dateISO base date in ISO format
 * @param shift current shift label
 * @returns tuple with next shift info
 */
export function nextShiftTuple(
  dateISO: string,
  shift: Shift,
): { dateISO: string; shift: Shift } {
  if (shift === "day") {
    return { dateISO, shift: "night" };
  }
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return { dateISO: toDateISO(d), shift: "day" };
}

/**
 * Convert Date to YYYY-MM-DD string.
 * @param date date object to format
 * @returns ISO date string
 */
export function toDateISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Format ISO date to long human string.
 * @param dateISO date in YYYY-MM-DD format
 * @returns locale date string
 */
export function fmtLong(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
