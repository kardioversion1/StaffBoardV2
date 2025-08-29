Nice. I merged the two `@/server` implementations into a single, type-safe module that uses a global adapter **if present** and otherwise falls back to the built-in `fetch` wrappers. This should resolve module resolution + type errors anywhere you `import * as Server from '@/server'`.

```ts
// server.ts — unified adapter with fallback

/**
 * Server API types
 */
export type LoadFn = <T = any>(
  key: string,
  params?: Record<string, any>
) => Promise<T>;

export type SaveFn = (
  key: string,
  payload: unknown,
  params?: Record<string, any>
) => Promise<void>;

export type SoftDeleteFn = (id: string) => Promise<void>;

export type ExportFn = (filters?: {
  from?: string;
  to?: string;
  nurseId?: string;
}) => void;

export interface ServerAPI {
  load: LoadFn;
  save: SaveFn;
  softDeleteStaff: SoftDeleteFn;
  exportHistoryCSV: ExportFn;
}

/**
 * If a global adapter is provided (e.g., by the host app),
 * we delegate to it; otherwise, we use fetch-based fallbacks.
 */
const globalApi: Partial<ServerAPI> | undefined = (globalThis as any)?.Server;

/* -------------------- Fallbacks -------------------- */

async function fallbackLoad<T = any>(
  key: string,
  params?: Record<string, any>
): Promise<T> {
  const url = new URL(`/api/${key}`, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`load ${key} failed`);
  return res.json() as Promise<T>;
}

async function fallbackSave(
  key: string,
  payload: unknown,
  params?: Record<string, any>
): Promise<void> {
  const url = new URL(`/api/${key}`, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`save ${key} failed`);
}

async function fallbackSoftDeleteStaff(id: string): Promise<void> {
  const res = await fetch(`/api/staff/${id}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error(`softDeleteStaff ${id} failed`);
}

function fallbackExportHistoryCSV(filters?: {
  from?: string;
  to?: string;
  nurseId?: string;
}): void {
  const url = new URL('/api/history/export', window.location.origin);
  if (filters) {
    for (const [k, v] of Object.entries(filters)) {
      if (v) url.searchParams.set(k, String(v));
    }
  }
  window.location.href = url.toString();
}

/* -------------------- Unified exports -------------------- */

export const load: LoadFn = (...args) =>
  (globalApi?.load ? globalApi.load(...args) : fallbackLoad(...args));

export const save: SaveFn = (...args) =>
  (globalApi?.save ? globalApi.save(...args) : fallbackSave(...args));

export const softDeleteStaff: SoftDeleteFn = (...args) =>
  (globalApi?.softDeleteStaff
    ? globalApi.softDeleteStaff(...args)
    : fallbackSoftDeleteStaff(...args));

export const exportHistoryCSV: ExportFn = (...args) =>
  (globalApi?.exportHistoryCSV
    ? globalApi.exportHistoryCSV(...args)
    : fallbackExportHistoryCSV(...args));

export default { load, save, softDeleteStaff, exportHistoryCSV };
```
