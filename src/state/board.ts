import { Shift, hhmmNowLocal, toDateISO, deriveShift } from '@/utils/time';
import * as DB from '@/db';
import { savePublishedShift, indexStaffAssignments, getHuddle, type ShiftKind, type PublishedShiftSnapshot, type Assignment } from '@/state/history';
import { loadStaff, type Staff } from './staff';
import { KS } from './keys';

import type { Slot } from '@/slots';
export type { Slot } from '@/slots';

export interface ZoneAssignment {
  id: string;
  role: 'nurse' | 'tech';
  start?: string;
  end?: string;
}

export const CURRENT_SCHEMA_VERSION = 2;

export interface ActiveShift {
  dateISO: string;
  shift: Shift;
  endAtISO?: string;
  charge?: Slot;
  triage?: Slot;
  admin?: Slot;
  zones: Record<string, Slot[]>;
  incoming: { nurseId: string; eta: string; arrived?: boolean }[];
  offgoing: { nurseId: string; ts: number }[];
  comments: string;
  huddle: string;
  handoff: string;
  version: number;
}

export type ActiveBoard = ActiveShift;
export type DraftShift = Omit<ActiveShift, 'comments'>;

export interface AppState {
  dateISO: string;
  locked: boolean;
  clockHHMM: string;
  shift: Shift;
}

const _clock = hhmmNowLocal();
export const STATE: AppState = {
  dateISO: toDateISO(new Date()),
  locked: false,
  clockHHMM: _clock,
  shift: deriveShift(_clock),
};

/** Reset basic app state values */
export function initState(): void {
  STATE.dateISO = toDateISO(new Date());
  STATE.locked = false;
  STATE.clockHHMM = hhmmNowLocal();
  STATE.shift = deriveShift(STATE.clockHHMM);
}

const ACTIVE_BOARD_CACHE: Record<string, ActiveBoard> = {};
/** Cache the current active board */
export function setActiveBoardCache(board: ActiveBoard): void {
  ACTIVE_BOARD_CACHE[KS.ACTIVE(board.dateISO, board.shift)] = board;
}
/** Retrieve the cached active board */
export function getActiveBoardCache(
  dateISO: string,
  shift: Shift
): ActiveBoard | undefined {
  return ACTIVE_BOARD_CACHE[KS.ACTIVE(dateISO, shift)];
}

/** Migrate possibly older active board structures */
export function migrateActiveBoard(raw: any): ActiveBoard {
  const zones = raw?.zones && typeof raw.zones === 'object' ? raw.zones : {};
  return {
    dateISO: raw?.dateISO ?? toDateISO(new Date()),
    shift: raw?.shift === 'night' ? 'night' : 'day',
    endAtISO:
      typeof raw?.endAtISO === 'string'
        ? raw.endAtISO
        : (() => {
            const startHH = raw?.shift === 'night' ? '19:00' : '07:00';
            const d = new Date(`${raw?.dateISO ?? toDateISO(new Date())}T${startHH}`);
            d.setHours(d.getHours() + 12);
            return d.toISOString();
          })(),
    charge: raw?.charge ?? undefined,
    triage: raw?.triage ?? undefined,
    admin: raw?.admin ?? undefined,
    zones: Object.fromEntries(
      Object.entries(zones).map(([k, v]) => [k, Array.isArray(v) ? v : []])
    ),
    incoming: Array.isArray(raw?.incoming)
      ? raw.incoming.filter((i: any) => typeof i?.nurseId === 'string')
      : [],
    offgoing: Array.isArray(raw?.offgoing)
      ? raw.offgoing.filter(
          (o: any) => typeof o?.nurseId === 'string' && typeof o?.ts === 'number'
        )
      : [],
    comments: typeof raw?.comments === 'string' ? raw.comments : '',
    huddle: typeof raw?.huddle === 'string' ? raw.huddle : '',
    handoff: typeof raw?.handoff === 'string' ? raw.handoff : '',
    version: CURRENT_SCHEMA_VERSION,
  };
}

/**
 * Normalize possibly older draft board structures.
 * @param raw Unknown draft data.
 * @returns DraftShift in the current schema.
 */
export function migrateDraft(raw: any): DraftShift {
  const zones = raw?.zones && typeof raw.zones === 'object' ? raw.zones : {};
  return {
    dateISO: raw?.dateISO ?? toDateISO(new Date()),
    shift: raw?.shift === 'night' ? 'night' : 'day',
    endAtISO:
      typeof raw?.endAtISO === 'string'
        ? raw.endAtISO
        : (() => {
            const startHH = raw?.shift === 'night' ? '19:00' : '07:00';
            const d = new Date(`${raw?.dateISO ?? toDateISO(new Date())}T${startHH}`);
            d.setHours(d.getHours() + 12);
            return d.toISOString();
          })(),
    charge: raw?.charge ?? undefined,
    triage: raw?.triage ?? undefined,
    admin: raw?.admin ?? undefined,
    zones: Object.fromEntries(
      Object.entries(zones).map(([k, v]) => [k, Array.isArray(v) ? v : []])
    ),
    incoming: Array.isArray(raw?.incoming)
      ? raw.incoming.filter((i: any) => typeof i?.nurseId === 'string')
      : [],
    offgoing: Array.isArray(raw?.offgoing)
      ? raw.offgoing.filter(
          (o: any) => typeof o?.nurseId === 'string' && typeof o?.ts === 'number'
        )
      : [],
    huddle: typeof raw?.huddle === 'string' ? raw.huddle : '',
    handoff: typeof raw?.handoff === 'string' ? raw.handoff : '',
    version: CURRENT_SCHEMA_VERSION,
  };
}

/** Import published shift history from a JSON string */
export async function importHistoryFromJSON(json: string): Promise<DraftShift[]> {
  const data = JSON.parse(json) as DraftShift[];
  await DB.set(KS.HISTORY, data);
  return data;
}

/** Apply a draft board to become the active board */
export async function applyDraftToActive(
  dateISO: string,
  shift: Shift
): Promise<void> {
  const draft = await DB.get<DraftShift>(KS.DRAFT(dateISO, shift));
  if (!draft) return;
  await DB.set(KS.ACTIVE(dateISO, shift), draft);
  await DB.del(KS.DRAFT(dateISO, shift));

  // Build and persist a published snapshot for history.
  const staff = await loadStaff();
  const staffMap: Record<string, Staff> = Object.fromEntries(
    staff.map((s) => [s.id, s])
  );
  const assignments: Assignment[] = [];
  for (const [zone, slots] of Object.entries(draft.zones)) {
    for (const slot of slots) {
      const info = staffMap[slot.nurseId];
      const now = new Date().toISOString();
      assignments.push({
        staffId: slot.nurseId,
        displayName: info?.name || slot.nurseId,
        role: info?.role || 'nurse',
        zone,
        startISO: now,
        dto: slot.dto
          ? { effectiveISO: now, offgoingUntilISO: now }
          : undefined,
      });
    }
  }

  const now = new Date().toISOString();
  if (draft.charge?.nurseId) {
    const info = staffMap[draft.charge.nurseId];
    assignments.push({
      staffId: draft.charge.nurseId,
      displayName: info?.name || draft.charge.nurseId,
      role: info?.role || 'nurse',
      zone: 'Charge',
      startISO: now,
    });
  }
  if (draft.triage?.nurseId) {
    const info = staffMap[draft.triage.nurseId];
    assignments.push({
      staffId: draft.triage.nurseId,
      displayName: info?.name || draft.triage.nurseId,
      role: info?.role || 'nurse',
      zone: 'Triage',
      startISO: now,
    });
  }
  if (draft.admin?.nurseId) {
    const info = staffMap[draft.admin.nurseId];
    assignments.push({
      staffId: draft.admin.nurseId,
      displayName: info?.name || draft.admin.nurseId,
      role: info?.role || 'nurse',
      zone: 'Secretary',
      startISO: now,
    });
  }
  const huddle = await getHuddle(dateISO, shift as ShiftKind);
  const snapshot: PublishedShiftSnapshot = {
    version: 1,
    dateISO,
    shift: shift as ShiftKind,
    publishedAtISO: new Date().toISOString(),
    publishedBy: 'unknown',
    charge: draft.charge?.nurseId,
    triage: draft.triage?.nurseId,
    admin: draft.admin?.nurseId,
    zoneAssignments: assignments,
    incoming: draft.incoming.map((i) => i.nurseId),
    offgoing: draft.offgoing.map((o) => o.nurseId),
    comments: '',
    huddle: huddle,
    audit: {
      createdAtISO: new Date().toISOString(),
      createdBy: 'unknown',
    },
  };
  await savePublishedShift(snapshot);
  await indexStaffAssignments(snapshot);
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new Event('history-saved'));
  }
}

export { DB };
export { KS } from './keys';
