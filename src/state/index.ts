import * as DB from '@/db';
import { KS } from './keys';
import type { Slot } from '@/slots';
export type { Staff } from './staff';
export { loadStaff, saveStaff } from './staff';
export { getConfig, loadConfig, saveConfig, zonesInvalid } from './config';

export const CURRENT_SCHEMA_VERSION = 1;

export interface DraftShift {
  dateISO: string;
  shift: 'day' | 'night';
  charge?: Slot;
  triage?: Slot;
  admin?: Slot;
  zones: Record<string, Slot[]>;
  incoming: Slot[];
  offgoing: Slot[];
  huddle?: string;
  handoff?: string;
  comments?: string;
  version?: number;
}

export interface ActiveBoard extends DraftShift {
  comments: string;
  huddle: string;
  handoff: string;
  version: number;
}

export const STATE = {
  dateISO: new Date().toISOString().slice(0, 10),
  shift: 'day' as 'day' | 'night',
  clockHHMM: '00:00',
  locked: false,
};

/** Initialize the global state object. */
export function initState(): void {
  /* placeholder for future state init */
}

/**
 * Move a draft roster into the active board and record a simple history
 * snapshot.
 */
export async function applyDraftToActive(
  dateISO: string,
  shift: 'day' | 'night',
): Promise<void> {
  const draftKey = KS.DRAFT(dateISO, shift);
  const draft = await DB.get<DraftShift>(draftKey);
  if (!draft) return;
  await DB.set(KS.ACTIVE(dateISO, shift), draft as ActiveBoard);
  await DB.del(draftKey);

  const start = new Date(`${dateISO}T${shift === 'day' ? '07:00:00' : '19:00:00'}`);
  const end = new Date(start);
  end.setHours(end.getHours() + 12);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  const zoneAssignments: any[] = [];
  for (const [zone, slots] of Object.entries(draft.zones)) {
    for (const s of slots) {
      zoneAssignments.push({ zone, nurseId: s.nurseId, startISO, endISO });
    }
  }
  if (draft.charge?.nurseId)
    zoneAssignments.push({ zone: 'Charge', nurseId: draft.charge.nurseId, startISO, endISO });
  if (draft.triage?.nurseId)
    zoneAssignments.push({ zone: 'Triage', nurseId: draft.triage.nurseId, startISO, endISO });
  if (draft.admin?.nurseId)
    zoneAssignments.push({ zone: 'Admin', nurseId: draft.admin.nurseId, startISO, endISO });
  await DB.set(`history:shift:${dateISO}:${shift}`, { zoneAssignments });
}

type CacheKey = string;
const ACTIVE_CACHE: Record<CacheKey, ActiveBoard | undefined> = {};

/** Cache the active board for quick access. */
export function setActiveBoardCache(board: ActiveBoard | undefined): void {
  if (!board) return;
  ACTIVE_CACHE[`${board.dateISO}:${board.shift}`] = board;
}

/** Retrieve a cached active board for a given date and shift. */
export function getActiveBoardCache(
  dateISO: string,
  shift: 'day' | 'night',
): ActiveBoard | undefined {
  return ACTIVE_CACHE[`${dateISO}:${shift}`];
}

/** Merge remote and local active board data. */
export function mergeBoards(remote: ActiveBoard, local: ActiveBoard): ActiveBoard {
  const merged: ActiveBoard = {
    ...remote,
    ...local,
    charge: local.charge ?? remote.charge,
    triage: local.triage ?? remote.triage,
    admin: local.admin ?? remote.admin,
    comments: local.comments || remote.comments,
    huddle: local.huddle || remote.huddle,
    handoff: local.handoff || remote.handoff,
    zones: {},
    incoming: [],
    offgoing: [],
    version: remote.version,
  };

  const zoneNames = new Set([
    ...Object.keys(remote.zones || {}),
    ...Object.keys(local.zones || {}),
  ]);
  for (const z of zoneNames) {
    const r = remote.zones[z] || [];
    const l = local.zones[z] || [];
    const arr = [...r];
    for (const s of l) {
      if (!arr.some((ex) => ex.nurseId === s.nurseId)) arr.push(s);
    }
    merged.zones[z] = arr;
  }

  const mergeArr = <T extends { nurseId: string }>(
    r: T[],
    l: T[],
    key: (t: T) => string,
  ): T[] => {
    const localMap = new Map<string, T>();
    for (const item of l) localMap.set(key(item), item);
    const result: T[] = [];
    for (const item of r) {
      const k = key(item);
      if (localMap.has(k)) {
        result.push({ ...item, ...localMap.get(k)! });
        localMap.delete(k);
      } else {
        result.push(item);
      }
    }
    for (const item of l) {
      const k = key(item);
      if (localMap.has(k)) {
        result.push(item);
        localMap.delete(k);
      }
    }
    return result;
  };

  merged.incoming = mergeArr(
    remote.incoming,
    local.incoming,
    (i) => `${i.nurseId}|${(i as any).eta}`,
  );
  merged.offgoing = mergeArr(
    remote.offgoing,
    local.offgoing,
    (i) => `${i.nurseId}|${(i as any).ts}`,
  );
  return merged;
}

/** Normalize a partial board to the current schema. */
export function migrateActiveBoard(board: Partial<ActiveBoard>): ActiveBoard {
  return {
    dateISO: board.dateISO || STATE.dateISO,
    shift: (board.shift as 'day' | 'night') || STATE.shift,
    charge: board.charge,
    triage: board.triage,
    admin: board.admin,
    zones: board.zones || {},
    incoming: board.incoming || [],
    offgoing: board.offgoing || [],
    comments: board.comments || '',
    huddle: board.huddle || '',
    handoff: board.handoff || '',
    version: CURRENT_SCHEMA_VERSION,
  };
}

export { DB, KS };
