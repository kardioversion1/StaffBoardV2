/**
 * Adapter for server-side persistence backed by api.php.
 */
import { get as idbGet, set as idbSet } from '@/db';
import { createDebouncer } from '@/utils/debouncedSave';

export interface ServerAPI {
  /** Perform a simple health check on the API. */
  health(): Promise<boolean>;
  /** Load data from the server with optional caching. */
  load<T = any>(key: string, params?: Record<string, any>): Promise<T>;
  /** Save data to the server and cache locally. */
  save(key: string, payload: unknown, params?: Record<string, any>): Promise<any>;
  /** Soft delete a staff member by id. */
  softDeleteStaff(id: string): Promise<any>;
  /** Export history data as CSV by opening a download. */
  exportHistoryCSV(filters?: Record<string, any>): void;
  /** Publish the next shift draft to the active board. */
  publishNextToActive(opts?: { appendHistory?: boolean }): Promise<void>;
}

const cacheKey = (key: string, params?: Record<string, any>): string => {
  const qs = params ? new URLSearchParams(params).toString() : '';
  return `staffboard:${key}${qs ? ':' + qs : ''}`;
};

const API_KEY = import.meta.env.VITE_API_KEY || '';

const withAuth = (headers: HeadersInit = {}): HeadersInit => (
  API_KEY ? { 'X-API-Key': API_KEY, ...headers } : headers
);

export const health: ServerAPI['health'] = async () => {
  try {
    const res = await fetch('/api.php?action=health', {
      cache: 'no-store',
      headers: withAuth(),
    });
    return res.ok;
  } catch {
    return false;
  }
};

export const load: ServerAPI['load'] = async (key, params = {}) => {
  const keyName = cacheKey(key, params);
  const qs = new URLSearchParams({ action: 'load', key, ...params });

  const attemptFetch = async () => {
    const res = await fetch(`/api.php?${qs.toString()}`, {
      cache: 'no-store',
      headers: withAuth(),
    });
    if (!res.ok) throw new Error('Network');
    return res.json();
  };

  try {
    const data = await attemptFetch();
    try {
      await idbSet(keyName, data);
    } catch {
      /* ignore persistence errors */
    }
    return data;
  } catch (err) {
    let cached: unknown;
    try {
      cached = await idbGet(keyName);
    } catch {
      cached = undefined;
    }
    if (cached !== undefined) return cached as any;
    try {
      const retry = await attemptFetch();
      try {
        await idbSet(keyName, retry);
      } catch {
        /* ignore persistence errors */
      }
      return retry;
    } catch (err2) {
      if (typeof alert === 'function') {
        alert('Unable to load data and no cached copy is available.');
      }
      throw err2;
    }
  }
};

const flushActive = createDebouncer(
  () => pendingActive!,
  async ({ payload, params }) => rawSave('active', payload, params),
  300
);

let pendingActive: { payload: unknown; params: Record<string, any> } | null = null;

const rawSave = async (key: string, payload: unknown, params: Record<string, any>) => {
  const keyName = cacheKey(key, {});
  const qs = new URLSearchParams({ action: 'save', key, ...params });

  const attemptFetch = async () => {
    const res = await fetch(`/api.php?${qs.toString()}`, {
      method: 'POST',
      headers: withAuth({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Network');
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'save failed');
    return j;
  };

  try {
    const j = await attemptFetch();
    try {
      await idbSet(keyName, payload);
    } catch {
      /* ignore persistence errors */
    }
    return j;
  } catch (err) {
    try {
      const retry = await attemptFetch();
      try {
        await idbSet(keyName, payload);
      } catch {
        /* ignore persistence errors */
      }
      return retry;
    } catch (err2) {
      if (typeof alert === 'function') {
        alert('Unable to save data.');
      }
      throw err2;
    }
  }
};

export const save: ServerAPI['save'] = async (key, payload, params = {}) => {
  if (key === 'active') {
    pendingActive = { payload, params };
    flushActive();
    return { ok: true } as any;
  }
  return rawSave(key, payload, params);
};

export const softDeleteStaff: ServerAPI['softDeleteStaff'] = async (id) => {
  const qs = new URLSearchParams({ action: 'softDeleteStaff', id });
  const res = await fetch(`/api.php?${qs.toString()}`, {
    headers: withAuth(),
  });
  const j = await res.json();
  if (!res.ok || !j.ok) throw new Error(j.error || 'delete failed');
  return j;
};

export const exportHistoryCSV: ServerAPI['exportHistoryCSV'] = async (filters = {}) => {
  const qs = new URLSearchParams({ action: 'exportHistoryCSV', ...filters });
  const res = await fetch(`/api.php?${qs.toString()}`, { headers: withAuth() });
  if (!res.ok) throw new Error('Network');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'history.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const publishNextToActive: ServerAPI['publishNextToActive'] = async (
  opts = {}
) => {
  const draft = await load('next');
  if (!draft || !draft.dateISO || !draft.shift || !draft.zones) {
    throw new Error('Draft incomplete');
  }
  await save('active', draft, {
    appendHistory: String(!!opts.appendHistory),
  });
  await save('next', {});
};

const Server: ServerAPI = {
  health,
  load,
  save,
  softDeleteStaff,
  exportHistoryCSV,
  publishNextToActive,
};
export default Server;
