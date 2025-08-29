export type ShiftId = string;

export type ShiftStatus = 'draft' | 'onbat' | 'live' | 'overlap' | 'archived';

export type Shift = {
  id: ShiftId;
  code: string; // e.g., 20250818-D
  dateISO: string; // shift anchor date
  startAt: string; // ISO string
  endAt: string; // ISO string
  assignments: { nurseId: string; zoneId: string }[];
  notes?: string;
  status: ShiftStatus;
};

export type Handoff = {
  id: string;
  fromShiftId: ShiftId;
  toShiftId: ShiftId | null; // becomes non-null on createNextShift
  startedAt: string; // ISO
  updates: {
    callouts?: string;
    travelers?: string;
    rfChanges?: string;
    dtoNotes?: string;
    misc?: string;
  };
  inPersonSeconds: number; // countdown target in seconds
  overlapMinutes: number; // default 30
  overlapEndsAt?: string; // ISO when overlap ends
  status: 'draft' | 'inPerson' | 'readyToCreate' | 'overlap' | 'done';
};

const SHIFTS_KEY = 'sb_shifts_v1';
const HANDOFF_KEY = 'sb_handoff_v1';

export function loadShifts(): Shift[] {
  try {
    const raw = sessionStorage.getItem(SHIFTS_KEY);
    return raw ? (JSON.parse(raw) as Shift[]) : [];
  } catch {
    return [];
  }
}

export function saveShifts(list: Shift[]): void {
  try {
    sessionStorage.setItem(SHIFTS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function loadActiveHandoff(): Handoff | undefined {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    return raw ? (JSON.parse(raw) as Handoff) : undefined;
  } catch {
    return undefined;
  }
}

export function saveActiveHandoff(h: Handoff | undefined): void {
  try {
    if (h) sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(h));
    else sessionStorage.removeItem(HANDOFF_KEY);
  } catch {
    /* ignore */
  }
}
