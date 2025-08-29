import type { Staff } from '@/state/staff';
import { getConfig } from '@/state/config';

let NURSES: Staff[] = [];

/**
 * Store staff list for lookup helpers.
 * @param list staff records to cache
 * @returns nothing
 */
export function setNurseCache(list: Staff[]): void {
  NURSES = Array.isArray(list) ? [...list] : [];
}

/**
 * Build a short name from a full name.
 * @param full full name to format
 * @param privacy hide last name when true
 * @returns formatted name
 */
export function formatName(full: string, privacy = true): string {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  const first = parts[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  if (!privacy) return [first, last].filter(Boolean).join(' ').trim();
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

/**
 * Generate privacy-on short name.
 * @param full full name to format
 * @returns formatted name
 */
export function formatShortName(full: string): string {
  return formatName(full, true);
}

/**
 * Format name respecting configuration privacy.
 * @param full full name to format
 * @returns display name
 */
export function formatDisplayName(full: string): string {
  const cfg = getConfig();
  return formatName(full, cfg.privacy !== false);
}

/**
 * Look up nurse in cache by id.
 * @param id nurse identifier
 * @returns matching staff or undefined
 */
export function getNurseById(id: string): Staff | undefined {
  return NURSES.find((n) => n.id === id);
}

/**
 * Resolve display label for nurse id.
 * @param id nurse identifier
 * @returns short label or empty string
 */
export function labelFromId(id?: string): string {
  if (!id) return '';
  const n = getNurseById(id);
  if (!n) return '';
  const full = n.name || `${n.first || ''} ${n.last || ''}`.trim();
  return formatDisplayName(full);
}
