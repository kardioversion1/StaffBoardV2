import type { Staff } from '@/state';

let NURSES: Staff[] = [];

/**
 * Set the in-memory nurse cache.
 */
export function setNurseCache(list: Staff[]): void {
  NURSES = Array.isArray(list) ? [...list] : [];
}

/**
 * Format a short name from a full name.
 * Returns "First L." given "First Last".
 */
export function formatShortName(full: string): string {
  const [f = '', l = ''] = (full || '').trim().split(/\s+/);
  return l ? `${f} ${l[0].toUpperCase()}.` : f;
}

/**
 * Retrieve a nurse by id from the cache.
 */
export function getNurseById(id: string): Staff | undefined {
  return NURSES.find((n) => n.id === id);
}

/**
 * Get a display label for a nurse id.
 * Falls back to empty string if the nurse is not found.
 */
export function labelFromId(id?: string): string {
  if (!id) return '';
  const n = getNurseById(id);
  if (!n) return '';
  const full = n.name || `${n.first || ''} ${n.last || ''}`.trim();
  return formatShortName(full);
}
