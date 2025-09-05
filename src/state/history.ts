import * as DB from '@/db';

/** API key for authenticated server requests. */
const API_KEY = import.meta.env.VITE_API_KEY || '';

const withAuth = (headers: HeadersInit = {}): HeadersInit =>
  API_KEY ? { 'X-API-Key': API_KEY, ...headers } : headers;

async function serverGet<T>(key: string): Promise<T | undefined> {
  const qs = new URLSearchParams({ action: 'historyKv', mode: 'get', key });
  try {
    const res = await fetch(`/api.php?${qs.toString()}`, {
      cache: 'no-store',
      headers: withAuth(),
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data === null ? undefined : (data as T);
  } catch {
    return undefined;
  }
}

async function serverSet<T>(key: string, val: T): Promise<void> {
  const qs = new URLSearchParams({ action: 'historyKv', mode: 'set', key });
  try {
    await fetch(`/api.php?${qs.toString()}`, {
      method: 'POST',
      headers: withAuth({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(val),
    });
  } catch {
    /* ignore network errors */
  }
}

async function serverDel(key: string): Promise<void> {
  const qs = new URLSearchParams({ action: 'historyKv', mode: 'del', key });
  try {
    await fetch(`/api.php?${qs.toString()}`, {
      method: 'POST',
      headers: withAuth(),
    });
  } catch {
    /* ignore network errors */
  }
}

/** IndexedDB-backed key-value helpers with server sync. */
async function kvGet<T>(key: string): Promise<T | undefined> {
  const local = await DB.get<T>(key);
  if (local !== undefined) return local;
  const remote = await serverGet<T>(key);
  if (remote !== undefined) await DB.set(key, remote);
  return remote;
}

async function kvSet<T>(key: string, val: T): Promise<void> {
  await DB.set(key, val);
  await serverSet(key, val);
}

async function kvDel(key: string): Promise<void> {
  await DB.del(key);
  await serverDel(key);
}

const MIGRATION_KEY = 'history:migratedToServer';

/** Upload any existing client-stored history to the server. */
async function migrateHistory(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const migrated = await DB.get<boolean>(MIGRATION_KEY);
  if (migrated) return;

  // Upload existing IndexedDB history entries.
  const keys = await DB.keys('history:');
  for (const key of keys) {
    if (key === MIGRATION_KEY) continue;
    const val = await DB.get(key);
    if (val !== undefined) await serverSet(key, val);
  }

  // Migrate legacy localStorage entries if present.
  if (typeof localStorage !== 'undefined') {
    const lsKeys = Object.keys(localStorage).filter((k) => k.startsWith('history:'));
    for (const key of lsKeys) {
      if (key === MIGRATION_KEY) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const val = JSON.parse(raw);
        await kvSet(key, val);
      } catch {
        /* ignore parse errors */
      }
      localStorage.removeItem(key);
    }
  }

  await DB.set(MIGRATION_KEY, true);
}

// Kick off migration after current tick in browser environments.
if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
  void queueMicrotask(() => {
    void migrateHistory();
  });
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
  nedocs: number;
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
  previousZone?: string;
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

async function migrateHistorySchema(_from?: number): Promise<void> {
  // Placeholder for future migrations
}

async function ensureVersion(): Promise<void> {
  const v = await kvGet<number>(VERSION_KEY);
  if (v !== HISTORY_SCHEMA_VERSION) {
    await migrateHistorySchema(v);
    await kvSet(VERSION_KEY, HISTORY_SCHEMA_VERSION);
  }
}

/** Persist a published shift snapshot. */
export async function savePublishedShift(
  snapshot: PublishedShiftSnapshot,
  user = 'system',
  reason = 'update'
): Promise<void> {
  await ensureVersion();
  const existing = await kvGet<PublishedShiftSnapshot>(
    SHIFT_KEY(snapshot.dateISO, snapshot.shift)
  );
  const now = new Date().toISOString();
  if (existing) {
    const baseAudit = existing.audit || { createdAtISO: now, createdBy: user };
    snapshot.audit = {
      ...baseAudit,
      mutatedAtISO: now,
      mutatedBy: user,
      reason,
    };
  } else if (!snapshot.audit) {
    snapshot.audit = { createdAtISO: now, createdBy: user };
  }
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
    const start = new Date(a.startISO).getTime();
    const end = new Date(a.endISO).getTime();
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
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new Event('history-saved'));
  }
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

/** Remove shift snapshots older than the specified number of days. */
export async function purgeOldShifts(maxAgeDays: number): Promise<void> {
  await ensureVersion();
  const cutoff = Date.now() - maxAgeDays * 86400000;
  const keys = await DB.keys('history:shift:');
  for (const k of keys) {
    const snap = await kvGet<PublishedShiftSnapshot>(k);
    if (snap && new Date(snap.audit.createdAtISO).getTime() < cutoff) {
      await kvDel(k);
    }
  }
}

/** Retrieve shift snapshots within a date range inclusive. */
export async function listShiftsInRange(
  startISO: string,
  endISO: string
): Promise<PublishedShiftSnapshot[]> {
  await ensureVersion();
  const keys = await DB.keys('history:shift:');
  const out: PublishedShiftSnapshot[] = [];
  for (const k of keys) {
    const snap = await kvGet<PublishedShiftSnapshot>(k);
    if (snap && snap.dateISO >= startISO && snap.dateISO <= endISO) {
      out.push(snap);
    }
  }
  return out.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}

