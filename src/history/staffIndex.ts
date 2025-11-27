import { ensureVersion, kvGet, kvSet } from './storage';
import type {
  PublishedShiftSnapshot,
  ShiftKind,
  RoleKind,
} from './shifts';

const STAFF_KEY = (staffId: string) => `history:staff:${staffId}`;

export interface NurseShiftIndexEntry {
  staffId: string;
  displayName: string;
  role: RoleKind;
  dateISO: string;
  shift: ShiftKind;
  zone: string;
  previousZone?: string | undefined;
  startISO: string;
  endISO?: string | undefined;
  dto?: boolean | undefined;
}

/** Index staff assignments for quick lookup by nurse. */
export async function indexStaffAssignments(
  snapshot: PublishedShiftSnapshot
): Promise<void> {
  await ensureVersion();
  for (const a of snapshot.zoneAssignments) {
    const start = new Date(a.startISO).getTime();
    const end = a.endISO ? new Date(a.endISO).getTime() : NaN;
    if (isFinite(start) && isFinite(end)) {
      const minutes = (end - start) / 60000;
      if (minutes < 20) continue;
    }
    const key = STAFF_KEY(a.staffId);
    const list = (await kvGet<NurseShiftIndexEntry[]>(key)) || [];
    const prev = list.find(
      (e) => e.dateISO === snapshot.dateISO && e.shift === snapshot.shift
    );
    const prevZone = prev?.zone !== a.zone ? prev?.zone : undefined;
    const entry: NurseShiftIndexEntry = {
      staffId: a.staffId,
      displayName: a.displayName,
      role: a.role,
      dateISO: snapshot.dateISO,
      shift: snapshot.shift,
      zone: a.zone,
      previousZone: prevZone,
      startISO: a.startISO,
      ...(a.endISO ? { endISO: a.endISO } : {}),
      dto: !!a.dto,
    };
    list.unshift(entry);
    await kvSet(key, list);
  }
}

/** Find shifts by staff member. */
export async function findShiftsByStaff(
  staffId: string
): Promise<NurseShiftIndexEntry[]> {
  await ensureVersion();
  return (await kvGet<NurseShiftIndexEntry[]>(STAFF_KEY(staffId))) || [];
}

