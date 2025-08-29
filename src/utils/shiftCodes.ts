/** Shift start times in HH:MM. */
export type ShiftSchedule = { dayStart: string; nightStart: string };

/**
 * Generate compact shift code like YYYYMMDD-D/N.
 * @param d date to encode
 * @param sched shift start times
 * @returns formatted code
 */
export function generateShiftCode(
  d: Date,
  sched: ShiftSchedule = { dayStart: '07:00', nightStart: '19:00' }
): string {
  const hh = d.getHours();
  const dayStart = Number(sched.dayStart.slice(0, 2));
  const nightStart = Number(sched.nightStart.slice(0, 2));
  const isDay = hh >= dayStart && hh < nightStart;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}-${isDay ? 'D' : 'N'}`;
}

/**
 * Determine upcoming shift window from current time.
 * @param now reference time
 * @param sched shift schedule
 * @returns start and end ISO strings plus label
 */
export function nextShiftWindow(
  now = new Date(),
  sched: ShiftSchedule = { dayStart: '07:00', nightStart: '19:00' }
) {
  const base = new Date(now);
  const y = base.getFullYear();
  const m = base.getMonth();
  const d = base.getDate();
  const mk = (h: number) => new Date(y, m, d, h, 0, 0, 0);
  const dayStart = mk(Number(sched.dayStart.slice(0, 2)));
  const nightStart = mk(Number(sched.nightStart.slice(0, 2)));

  if (now < dayStart) {
    return {
      startAt: dayStart.toISOString(),
      endAt: mk(Number(sched.nightStart.slice(0, 2))).toISOString(),
      label: 'D' as const,
    };
  }
  if (now < nightStart) {
    return {
      startAt: nightStart.toISOString(),
      endAt: new Date(nightStart.getTime() + 12 * 3600 * 1000).toISOString(),
      label: 'N' as const,
    };
  }
  const tomorrow = new Date(y, m, d + 1);
  const tDayStart = new Date(
    tomorrow.getFullYear(),
    tomorrow.getMonth(),
    tomorrow.getDate(),
    Number(sched.dayStart.slice(0, 2))
  );
  return {
    startAt: tDayStart.toISOString(),
    endAt: new Date(tDayStart.getTime() + 12 * 3600 * 1000).toISOString(),
    label: 'D' as const,
  };
}
