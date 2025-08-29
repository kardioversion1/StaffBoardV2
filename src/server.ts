/**
 * Client-side API wrapper for server persistence endpoints.
 */
export async function load<T = any>(key: string, params?: Record<string, any>): Promise<T> {
  const url = new URL(`/api/${key}`, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`load ${key} failed`);
  return res.json() as Promise<T>;
}

/**
 * Persist data to the server.
 */
export async function save(key: string, payload: unknown, params?: Record<string, any>): Promise<void> {
  const url = new URL(`/api/${key}`, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
  }
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });
}

/**
 * Soft-delete a staff member by ID.
 */
export async function softDeleteStaff(id: string): Promise<void> {
  await fetch(`/api/staff/${id}`, { method: 'DELETE', credentials: 'same-origin' });
}

/**
 * Trigger a CSV export of published history.
 */
export function exportHistoryCSV(filters?: { from?: string; to?: string; nurseId?: string }): void {
  const url = new URL('/api/history/export', window.location.origin);
  if (filters) {
    for (const [k, v] of Object.entries(filters)) {
      if (v) url.searchParams.set(k, String(v));
    }
  }
  window.location.href = url.toString();
}
