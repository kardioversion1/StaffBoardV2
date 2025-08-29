// state/index.ts (merged)

// NOTE: This file merges the functionality from `main` and drops the bare re-exports.
// If you really want a split-module structure later, we can move the concrete pieces
// into ./config, ./staff, ./board and keep only re-exports here.

import { Shift, hhmmNowLocal, toDateISO, deriveShift } from '@/utils/time';
import * as DB from '@/db';
import * as Server from '@/server';
import { canonNurseType, type NurseType } from '@/domain/lexicon';
import { ensureStaffId } from '@/utils/id';
import { ensureRole } from '@/utils/role';
import {
  savePublishedShift,
  indexStaffAssignments,
  getHuddle,
  type ShiftKind,
  type PublishedShiftSnapshot,
  type Assignment,
} from '@/state/history';

export type Staff = {
  id: string;
  name?: string;
  first?: string;
  last?: string;
  rf?: number;
  role: 'nurse' | 'tech';
  type: NurseType;
  active?: boolean;
  notes?: string;
  prefDay?: boolean;
  prefNight?: boolean;
  eligibleRoles?: ('charge' | 'triage' | 'admin')[];
  defaultZone?: string;
  dtoEligible?: boolean;
};

import type { Slot } from '@/slots';
export type { Slot } from '@/slots';
export {
  getConfig,
  loadConfig,
  saveConfig,
  mergeConfigDefaults,
  zonesInvalid,
  WIDGETS_DEFAULTS,
} from './config';
export type { Config, WidgetsConfig } from './config';

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

export function initState() {
  STATE.dateISO = toDateISO(new Date());
  STATE.locked = false;
  STATE.clockHHMM = hhmmNowLocal();
  STATE.shift = deriveShift(STATE.clockHHMM);
}

let ACTIVE_BOARD_CACHE: ActiveBoard | undefined;
export function setActiveBoardCache(board: ActiveBoard): void {
  ACTIVE_BOARD_CACHE = board;
}
export function getActiveBoardCache(): ActiveBoard | undefined {
  return ACTIVE_BOARD_CACHE;
}
export function migrateActiveBoard(raw: unknown): ActiveBoard {
  const r = raw as Partial<ActiveBoard> | undefined;
  const zones = r?.zones && typeof r.zones === 'object' ? r.zones : {};
  return {
    dateISO: r?.dateISO ?? toDateISO(new Date()),
    shift: r?.shift === 'night' ? 'night' : 'day',
    charge: r?.charge ?? undefined,
    triage: r?.triage ?? undefined,
    admin: r?.admin ?? undefined,
    zones: Object.fromEntries(
      Object.entries(zones).map(([k, v]) => [k, Array.isArray(v) ? (v as Slot[]) : []])
    ),
    incoming: Array.isArray(r?.incoming)
      ? r.incoming.filter(
          (i): i is ActiveBoard['incoming'][number] =>
            typeof i?.nurseId === 'string'
        )
      : [],
    offgoing: Array.isArray(r?.offgoing)
      ? r.offgoing.filter(
          (o): o is ActiveBoard['offgoing'][number] =>
            typeof o?.nurseId === 'string' && typeof o?.ts === 'number'
        )
      : [],
    comments: typeof r?.comments === 'string' ? r.comments : '',
    huddle: typeof r?.huddle === 'string' ? r.huddle : '',
    handoff: typeof r?.handoff === 'string' ? r.handoff : '',
    version: CURRENT_SCHEMA_VERSION,
  };
}

export const KS = {
  CONFIG: 'CONFIG',
  STAFF: 'STAFF',
  HISTORY: 'HISTORY',
  PHYS: (dateISO: string) => `PHYS:${dateISO}`,
  ACTIVE: (dateISO: string, shift: Shift) => `ACTIVE:${dateISO}:${shift}`,
  ONBAT: (dateISO: string, shift: Shift) => `ONBAT:${dateISO}:${shift}`,
  DRAFT: (dateISO: string, shift: Shift) => `DRAFT:${dateISO}:${shift}`,
} as const;

export async function loadStaff(): Promise<Staff[]> {
  try {
    const remote = await Server.load('roster');
    await DB.set(KS.STAFF, remote);
  } catch {}
  const list = (await DB.get<Staff[]>(KS.STAFF)) || [];
  let changed = false;
  const normalized = list.map((s) => {
    ensureRole(s);
    const id = ensureStaffId(s.id);
    const rawType = (s as { type?: string | null }).type;
    const type = (canonNurseType(rawType) || rawType || 'home') as NurseType;
    if (id !== s.id) changed = true;
    return { ...s, id, type } as Staff;
  });
  if (changed) await DB.set(KS.STAFF, normalized);
  return normalized;
}

export async function saveStaff(list: Staff[]): Promise<void> {
  try {
    await Server.save('roster', list);
  } catch {}
  await DB.set(KS.STAFF, list);
}

export async function importHistoryFromJSON(json: string): Promise<DraftShift[]> {
  const data = JSON.parse(json) as DraftShift[];
  await DB.set(KS.HISTORY, data);
  return data;
}

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
        endISO: now,
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
      endISO: now,
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
      endISO: now,
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
      endISO: now,
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
}

export { DB };
