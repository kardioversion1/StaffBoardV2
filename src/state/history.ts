import * as DB from '@/db';

/** Attempt IndexedDB first, fallback to localStorage. */
async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    return await DB.get<T>(key);
  } catch {
    if (typeof localStorage === 'undefined') return undefined;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  }
}

async function kvSet<T>(key: string, val: T): Promise<void> {
  try {
    await DB.set(key, val);
  } catch {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(val));
    }
  }
}

async function kvDel(key: string): Promise<void> {
  try {
    await DB.del(key);
  } catch {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  }
}

export type ShiftKind = 'day' | 'night';
export type RoleKind = 'nurse' | 'tech';

export interface Assignment {
  staffId: string;
  displayName: string;
  role: RoleKind;
  zone: string;
  startISO: string;
  endISO: string;
  dto?: {
    effectiveISO: string;
    offgoingUntilISO: string;
  };
}

export interface HuddleChecklistItem {
  id: string;
  label: string;
  section: string;
  required?: boolean;
  state: 'ok' | 'issue' | 'na';
  note?: string;
}

export interface HuddleRecord {
  dateISO: string;
  shift: ShiftKind;
  recordedAtISO: string;
  recordedBy: string;
  checklist: HuddleChecklistItem[];
  notes: string;
}

export interface PublishedShiftSnapshot {
  version: number;
  dateISO: string;
  shift: ShiftKind;
  publishedAtISO: string;
  publishedBy: string;
  charge?: string;
  triage?: string;
  admin?: string;
  zoneAssignments: Assignment[];
  incoming: string[];
  offgoing: string[];
  comments: string;
  huddle?: HuddleRecord;
  audit: {
    createdAtISO: string;
    createdBy: string;
    mutatedAtISO?: string;
    mutatedBy?: string;
    reason?: string;
  };
}

export interface NurseShiftIndexEntry {
  staffId: string;
  displayName: string;
  role: RoleKind;
  dateISO: string;
  shift: ShiftKind;
  zone: string;
  startISO: string;
  endISO: string;
  dto?: boolean;
}

export interface HistoryDB {
  byDate: Record<string, PublishedShiftSnapshot>;
  byStaff: Record<string, NurseShiftIndexEntry[]>;
  huddles: Record<string, HuddleRecord>;
  schemaVersion: number;
}

const SHIFT_KEY = (dateISO: string, shift: ShiftKind) => `history:shift:${dateISO}:${shift}`;
const STAFF_KEY = (staffId: string) => `history:staff:${staffId}`;
const HUDDLE_KEY = (dateISO: string, shift: ShiftKind) => `history:huddle:${dateISO}:${shift}`;
const VERSION_KEY = 'history:schemaVersion';

export const HISTORY_SCHEMA_VERSION = 1;

async function ensureVersion(): Promise<void> {
  const v = await kvGet<number>(VERSION_KEY);
  if (v !== HISTORY_SCHEMA_VERSION) {
    await kvSet(VERSION_KEY, HISTORY_SCHEMA_VERSION);
  }
}

/** Persist a published shift snapshot. */
export async function savePublishedShift(snapshot: PublishedShiftSnapshot): Promise<void> {
  await ensureVersion();
  await kvSet(SHIFT_KEY(snapshot.dateISO, snapshot.shift), snapshot);
}

/** Retrieve a published shift snapshot by date and shift. */
export async function getShiftByDate(
  dateISO: string,
  shift: ShiftKind
): Promise<PublishedShiftSnapshot | undefined> {
  await ensureVersion();
  return kvGet<PublishedShiftSnapshot>(SHIFT_KEY(dateISO, shift));
}

/** Index staff assignments for quick lookup by nurse. */
export async function indexStaffAssignments(
  snapshot: PublishedShiftSnapshot
): Promise<void> {
  await ensureVersion();
  for (const a of snapshot.zoneAssignments) {
    const key = STAFF_KEY(a.staffId);
    const list = (await kvGet<NurseShiftIndexEntry[]>(key)) || [];
    const entry: NurseShiftIndexEntry = {
      staffId: a.staffId,
      displayName: a.displayName,
      role: a.role,
      dateISO: snapshot.dateISO,
      shift: snapshot.shift,
      zone: a.zone,
      startISO: a.startISO,
      endISO: a.endISO,
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

/** Save a huddle record. */
export async function saveHuddle(record: HuddleRecord): Promise<void> {
  await ensureVersion();
  await kvSet(HUDDLE_KEY(record.dateISO, record.shift), record);
}

/** Retrieve a huddle record. */
export async function getHuddle(
  dateISO: string,
  shift: ShiftKind
): Promise<HuddleRecord | undefined> {
  await ensureVersion();
  return kvGet<HuddleRecord>(HUDDLE_KEY(dateISO, shift));
}

/** Submit a huddle record and archive it to history. */
export async function submitHuddle(record: HuddleRecord): Promise<void> {
  await ensureVersion();
  const base = HUDDLE_KEY(record.dateISO, record.shift);
  await kvSet(`${base}:${record.recordedAtISO}`, record);
  await kvDel(base);
}

/** Clone and replace an existing snapshot with audit trail update. */
export async function adminOverrideShift(
  dateISO: string,
  shift: ShiftKind,
  patch: Partial<PublishedShiftSnapshot>,
  reason: string,
  user = 'admin'
): Promise<void> {
  const existing = await getShiftByDate(dateISO, shift);
  if (!existing) return;
  const now = new Date().toISOString();
  const updated: PublishedShiftSnapshot = {
    ...existing,
    ...patch,
    audit: {
      ...existing.audit,
      mutatedAtISO: now,
      mutatedBy: user,
      reason,
    },
  };
  await kvSet(SHIFT_KEY(dateISO, shift), updated);
}

/** List all dates that have saved shift snapshots. */
export async function listShiftDates(): Promise<string[]> {
  await ensureVersion();
  const keys = await DB.keys('history:shift:');
  const dates = new Set<string>();
  keys.forEach((k) => {
    const parts = k.split(':');
    if (parts.length >= 4) dates.add(parts[2]);
  });
  return Array.from(dates).sort();
}

/** Retrieve all saved huddle records. */
export async function listHuddles(): Promise<HuddleRecord[]> {
  await ensureVersion();
  const keys = (await DB.keys('history:huddle:')).filter(
    (k) => k.split(':').length > 4
  );
  const out: HuddleRecord[] = [];
  for (const k of keys) {
    const rec = await kvGet<HuddleRecord>(k);
    if (rec) out.push(rec);
  }
  return out.sort((a, b) => a.recordedAtISO.localeCompare(b.recordedAtISO));
}

