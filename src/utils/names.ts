import type { Staff } from '@/state';
import { getConfig } from '@/state';

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
export function formatName(full: string, privacy = true): string {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  const first = parts[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  if (!privacy) return [first, last].filter(Boolean).join(' ').trim();
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

/**
 * Convenience wrapper for privacy-on short names.
 */
export function formatShortName(full: string): string {
  return formatName(full, true);
}

export function formatDisplayName(full: string): string {
  const cfg = getConfig();
  return formatName(full, cfg.privacy !== false);
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
  return formatDisplayName(full);
}
