export type Shift = "day" | "night";

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function hhmmNowLocal(): string {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function deriveShift(
  hhmm: string,
  dayAnchor = "07:00",
  nightAnchor = "19:00"
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

export function nextShiftTuple(
  dateISO: string,
  shift: Shift
): { dateISO: string; shift: Shift } {
  if (shift === "day") {
    return { dateISO, shift: "night" };
  }
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return { dateISO: toDateISO(d), shift: "day" };
}

export function toDateISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function fmtLong(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
