import * as Server from '@/server';

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

/** Load all draft shifts from the server. */
export async function loadShifts(): Promise<Shift[]> {
  try {
    return (await Server.load('shifts')) as Shift[];
  } catch {
    return [];
  }
}

/** Persist draft shifts to the server. */
export async function saveShifts(list: Shift[]): Promise<void> {
  try {
    await Server.save('shifts', list);
  } catch {
    /* ignore */
  }
}

/** Load the active handoff record from the server. */
export async function loadActiveHandoff(): Promise<Handoff | undefined> {
  try {
    const data = await Server.load('handoff');
    return data && Object.keys(data).length ? (data as Handoff) : undefined;
  } catch {
    return undefined;
  }
}

/** Save the active handoff record to the server. */
export async function saveActiveHandoff(h: Handoff | undefined): Promise<void> {
  try {
    await Server.save('handoff', h || {});
  } catch {
    /* ignore */
  }
}
