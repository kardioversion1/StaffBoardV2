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
export async function kvGet<T>(key: string): Promise<T | undefined> {
  const local = await DB.get<T>(key);
  if (local !== undefined) return local;
  const remote = await serverGet<T>(key);
  if (remote !== undefined) await DB.set(key, remote);
  return remote;
}

/** Persist a value to both IndexedDB and the server. */
export async function kvSet<T>(key: string, val: T): Promise<void> {
  await DB.set(key, val);
  await serverSet(key, val);
}

/** Remove a key from both IndexedDB and the server. */
export async function kvDel(key: string): Promise<void> {
  await DB.del(key);
  await serverDel(key);
}

const MIGRATION_KEY = 'history:migratedToServer';

/** Upload any existing client-stored history to the server. */
export async function migrateHistory(): Promise<void> {
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

const VERSION_KEY = 'history:schemaVersion';

export const HISTORY_SCHEMA_VERSION = 1;

async function migrateHistorySchema(_from?: number): Promise<void> {
  // Placeholder for future migrations
}

/** Ensure the client-side history schema matches the expected version. */
export async function ensureVersion(): Promise<void> {
  const v = await kvGet<number>(VERSION_KEY);
  if (v !== HISTORY_SCHEMA_VERSION) {
    await migrateHistorySchema(v);
    await kvSet(VERSION_KEY, HISTORY_SCHEMA_VERSION);
  }
}

